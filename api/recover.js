import { supabaseAdmin } from './_supabase.js'
import { logMessage } from './webhook.js'

// POST /api/recover  header x-admin-key
// body: { accessToken, oaId, maxConversations }
// Kéo lịch sử hội thoại cũ từ Zalo OA (dùng token tạm, chạy 1 lần).
// - Lưu tin vào wrt_messages / wrt_zalo_threads
// - Tin nào có SĐT + mã đơn → kích hoạt bảo hành (qua /api/activate)
//
// API Zalo dùng:
//   GET openapi.zalo.me/v2.0/oa/listrecentchat  (danh sách user gần đây)
//   GET openapi.zalo.me/v2.0/oa/conversation    (tin nhắn với 1 user)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'Sai mã quản trị.' })

  const { accessToken: tokenInput, oaId, maxConversations = 50 } = req.body || {}

  const db = supabaseAdmin()

  // Lấy token: ưu tiên token dán tay; nếu không, lấy token mới nhất đã lưu qua OAuth.
  let accessToken = tokenInput && tokenInput.trim()
  if (!accessToken) {
    let q = db.from('wrt_zalo_tokens').select('access_token, oa_id, expires_at')
      .not('access_token', 'is', null).order('updated_at', { ascending: false }).limit(1)
    if (oaId) q = db.from('wrt_zalo_tokens').select('access_token, oa_id, expires_at')
      .eq('oa_id', oaId).not('access_token', 'is', null)
      .order('updated_at', { ascending: false }).limit(1)
    const { data } = await q
    if (data && data[0]) accessToken = data[0].access_token
  }
  if (!accessToken) return res.status(400).json({
    error: 'Chưa có access token. Hãy lấy token qua /api/oauth-start trước, hoặc dán token tạm.',
  })

  const log = []
  let savedMsgs = 0, activated = 0, scannedUsers = 0

  try {
    // 1) Lấy danh sách hội thoại gần đây
    const recent = await zaloGet(
      'https://openapi.zalo.me/v2.0/oa/listrecentchat',
      { offset: 0, count: Math.min(maxConversations, 200) },
      accessToken
    )
    if (recent.error && recent.error !== 0)
      return res.status(400).json({ error: 'Zalo: ' + (recent.message || 'không lấy được danh sách chat') })

    const users = (recent.data || []).map((u) => ({
      userId: u.user_id || u.from_id || u.src,
      name: u.display_name || u.user_name || null,
      avatar: u.avatar || null,
    })).filter((u) => u.userId)

    // 2) Với mỗi user, lấy lịch sử tin nhắn
    for (const u of users) {
      scannedUsers++
      const conv = await zaloGet(
        'https://openapi.zalo.me/v2.0/oa/conversation',
        { user_id: u.userId, offset: 0, count: 10 },
        accessToken
      )
      const msgs = (conv.data || [])
      // cập nhật tên hiển thị cho thread nếu có
      if (u.name) {
        await db.from('wrt_zalo_threads').upsert(
          { zalo_user_id: u.userId, display_name: u.name, avatar: u.avatar, oa_id: oaId || null },
          { onConflict: 'zalo_user_id' }
        )
      }

      for (const m of msgs) {
        const fromOA = (m.src === 1 || m.from_id === oaId) // 1 = OA gửi (tùy schema)
        const direction = fromOA ? 'out' : 'in'
        const text = m.message || m.text || ''
        const msgId = m.message_id || m.msg_id || null
        if (!text) continue

        // lưu tin (không tăng unread cho tin cũ)
        await db.from('wrt_messages').insert({
          zalo_user_id: u.userId, direction, text, msg_id: msgId, oa_id: oaId || null,
        })
        savedMsgs++

        // chỉ thử kích hoạt với tin của khách (in)
        if (direction === 'in') {
          const { phone, orderCode } = extract(text)
          if (phone && orderCode && process.env.SELF_URL) {
            const r = await fetch(`${process.env.SELF_URL}/api/activate`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'auto', orderCode, phone, channel: 'zalo',
                zaloUserId: u.userId, consent: true,
              }),
            })
            const rd = await r.json().catch(() => ({}))
            if (rd.ok) { activated++; log.push(`✓ Kích hoạt ${orderCode} cho ${phone}`) }
          }
        }
      }
      // cập nhật last_message cho thread
      if (msgs.length) {
        const last = msgs[0]
        await db.from('wrt_zalo_threads').upsert({
          zalo_user_id: u.userId,
          last_message: last.message || last.text || '',
          last_message_at: new Date().toISOString(),
          oa_id: oaId || null,
        }, { onConflict: 'zalo_user_id' })
      }
    }

    return res.status(200).json({
      ok: true, scannedUsers, savedMessages: savedMsgs, activated, log: log.slice(0, 50),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message, partial: { scannedUsers, savedMsgs, activated } })
  }
}

async function zaloGet(url, params, accessToken) {
  const qs = new URLSearchParams()
  // Zalo nhận tham số dạng JSON trong query 'data' cho một số endpoint;
  // listrecentchat/conversation nhận query thường.
  Object.entries(params).forEach(([k, v]) => qs.set(k, v))
  const r = await fetch(`${url}?${qs.toString()}`, {
    headers: { access_token: accessToken },
  })
  return r.json()
}

function extract(text) {
  const phoneMatch = String(text).match(/(0|\+84|84)(3|5|7|8|9)\d{8}/)
  let phone = phoneMatch ? phoneMatch[0].replace(/^(\+?84)/, '0') : null
  if (phone && !/^0(3|5|7|8|9)\d{8}$/.test(phone)) phone = null
  const tokens = String(text).toUpperCase().match(/[A-Z0-9]{6,20}/g) || []
  const orderCode = tokens.find((t) => t !== (phoneMatch && phoneMatch[0])) || null
  return { phone, orderCode }
}
