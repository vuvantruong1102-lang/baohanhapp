import crypto from 'crypto'
import { supabaseAdmin } from './_supabase.js'

// Webhook Zalo OA. GET: Zalo verify. POST: nhận sự kiện tin nhắn.

// Đọc raw body. Trên Vercel function thuần, req.body có thể đã được parse sẵn
// (object) hoặc chưa (stream). Hàm này trả cả raw string lẫn payload object.
async function readBody(req) {
  // Nếu Vercel đã parse sẵn thành object
  if (req.body && typeof req.body === 'object') {
    return { raw: JSON.stringify(req.body), payload: req.body }
  }
  // Nếu là string
  if (typeof req.body === 'string' && req.body.length) {
    try { return { raw: req.body, payload: JSON.parse(req.body) } }
    catch { return { raw: req.body, payload: null } }
  }
  // Đọc từ stream
  const raw = await new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(''))
  })
  let payload = null
  try { payload = raw ? JSON.parse(raw) : null } catch { payload = null }
  return { raw, payload }
}

function extract(text) {
  const s = String(text || '')

  // --- SĐT ---
  // Ưu tiên theo nhãn "số điện thoại / sđt / phone"
  let phone = null
  const phoneLabel = s.match(/(?:s[ốô]\s*[đd]i[ệe]n\s*tho[ạa]i|s[đd]t|phone|tel)\s*[:\-]?\s*((?:0|\+?84)\d[\d\s.]{7,13})/i)
  const phoneRaw = phoneLabel ? phoneLabel[1] : (s.match(/(0|\+84|84)(3|5|7|8|9)\d{8}/) || [])[0]
  if (phoneRaw) {
    let p = phoneRaw.replace(/[\s.]/g, '').replace(/^(\+?84)/, '0')
    if (/^0(3|5|7|8|9)\d{8}$/.test(p)) phone = p
  }

  // --- Mã đơn ---
  // Ưu tiên theo nhãn "mã đơn hàng / mã đơn / order"
  let orderCode = null
  const codeLabel = s.match(/(?:m[ãa]\s*[đd][ơo]n(?:\s*h[àa]ng)?|order(?:\s*id)?|m[ãa]\s*v[ậa]n\s*[đd][ơo]n)\s*[:\-]?\s*([A-Za-z0-9]{6,24})/i)
  if (codeLabel) {
    orderCode = codeLabel[1].toUpperCase()
  } else {
    // fallback: dò token chữ-số 6–24 ký tự, loại SĐT và các từ thuần chữ cái.
    // Mã đơn thật thường CÓ cả chữ lẫn số (vd 260520VUK3TN5J) hoặc toàn số dài.
    const tokens = s.toUpperCase().match(/[A-Z0-9]{6,24}/g) || []
    const phoneUpper = phone ? phone.toUpperCase() : null
    orderCode = tokens.find((t) => {
      if (t === phoneUpper) return false
      if (/^\d{9,11}$/.test(t) && t === phoneUpper) return false // tránh SĐT
      const hasDigit = /\d/.test(t)
      const hasAlpha = /[A-Z]/.test(t)
      // ưu tiên token vừa có chữ vừa có số, hoặc chuỗi số dài (>=8) không phải SĐT
      return (hasDigit && hasAlpha) || (/^\d{8,}$/.test(t) && t !== phoneUpper)
    }) || null
  }

  return { phone, orderCode }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).send('OK')
  if (req.method !== 'POST') return res.status(405).end()

  const { raw, payload } = await readBody(req)

  // Request kiểm tra của Zalo có thể gửi body rỗng → vẫn trả 200 để cho lưu webhook.
  if (!payload) return res.status(200).json({ ok: true })

  // Verify chữ ký (best-effort, không chặn).
  const sig = req.headers['x-zevent-signature']
  const appId = process.env.ZALO_APP_ID
  const secret = process.env.ZALO_OA_SECRET
  if (sig && appId && secret && payload.timestamp) {
    const expect = 'mac=' + crypto.createHash('sha256')
      .update(appId + raw + payload.timestamp + secret).digest('hex')
    if (sig !== expect) console.warn('Zalo signature mismatch (vẫn xử lý)')
  }

  // Xử lý XONG rồi mới trả 200. (Trên Vercel function thuần, nếu trả response
  // trước thì code phía sau có thể không kịp chạy → tin không được lưu.)
  if (payload.event_name === 'user_send_text') {
    try {
      const userId = payload.sender?.id
      const oaId = payload.oa_id || payload.recipient?.id || null
      const text = payload.message?.text || ''
      const { phone, orderCode } = extract(text)
      const db = supabaseAdmin()

      // Lưu tin khách gửi vào DB để xem trong admin (kèm oa_id để biết OA nào)
      await logMessage(db, userId, 'in', text, payload.message?.msg_id, true, oaId)

      // Nếu đủ SĐT + mã đơn thì kích hoạt bảo hành luôn (source auto = dò mọi sàn)
      if (phone && orderCode && process.env.SELF_URL) {
        await fetch(`${process.env.SELF_URL}/api/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'auto', orderCode, phone, channel: 'zalo', zaloUserId: userId, consent: true,
          }),
        }).catch((e) => console.error('activate call error', e))
      }
    } catch (e) {
      console.error('webhook handle error', e)
    }
  }

  return res.status(200).json({ ok: true })
}

// Lưu tin nhắn + cập nhật thread (dùng chung cho cả webhook và API gửi)
export async function logMessage(db, userId, direction, text, msgId, incUnread, oaId) {
  await db.from('wrt_messages').insert({
    zalo_user_id: userId, direction, text, msg_id: msgId || null, oa_id: oaId || null,
  })
  // upsert thread
  const { data: existing } = await db.from('wrt_zalo_threads')
    .select('unread').eq('zalo_user_id', userId).limit(1)
  const prevUnread = existing && existing[0] ? existing[0].unread : 0
  const patch = {
    zalo_user_id: userId,
    last_message: text,
    last_message_at: new Date().toISOString(),
    unread: direction === 'in' && incUnread ? prevUnread + 1 : (direction === 'out' ? 0 : prevUnread),
  }
  if (oaId) patch.oa_id = oaId
  await db.from('wrt_zalo_threads').upsert(patch, { onConflict: 'zalo_user_id' })
}
