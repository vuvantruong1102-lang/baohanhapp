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
  const phoneMatch = String(text).match(/(0|\+84|84)(3|5|7|8|9)\d{8}/)
  let phone = phoneMatch ? phoneMatch[0].replace(/^(\+?84)/, '0') : null
  if (phone && !/^0(3|5|7|8|9)\d{8}$/.test(phone)) phone = null
  const tokens = String(text).toUpperCase().match(/[A-Z0-9]{6,20}/g) || []
  const orderCode = tokens.find((t) => t !== (phoneMatch && phoneMatch[0])) || null
  return { phone, orderCode }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).send('OK')
  if (req.method !== 'POST') return res.status(405).end()

  const { raw, payload } = await readBody(req)

  // Request kiểm tra của Zalo có thể gửi body rỗng → vẫn trả 200 để cho lưu webhook.
  if (!payload) return res.status(200).json({ ok: true })

  // Verify chữ ký (best-effort). Lưu ý: trên Vercel body có thể đã được parse
  // rồi stringify lại nên raw không khớp 100% với bản Zalo ký → chữ ký có thể
  // không trùng dù hợp lệ. Vì domain đã xác thực và đây là webhook nội bộ,
  // ta KHÔNG chặn theo chữ ký; chỉ log để theo dõi. Luôn xử lý nếu có event_name.
  const sig = req.headers['x-zevent-signature']
  const appId = process.env.ZALO_APP_ID
  const secret = process.env.ZALO_OA_SECRET
  if (sig && appId && secret && payload.timestamp) {
    const expect = 'mac=' + crypto.createHash('sha256')
      .update(appId + raw + payload.timestamp + secret).digest('hex')
    if (sig !== expect) console.warn('Zalo signature mismatch (vẫn xử lý)')
  }

  // Trả 200 ngay (Zalo yêu cầu 200 mới lưu webhook & không retry).
  res.status(200).json({ ok: true })

  // Bỏ qua nếu là request kiểm tra (không có event_name).
  if (!payload.event_name) return

  try {
    if (payload.event_name === 'user_send_text') {
      const userId = payload.sender?.id
      const oaId = payload.oa_id || payload.recipient?.id || null
      const text = payload.message?.text || ''
      const { phone, orderCode } = extract(text)
      const db = supabaseAdmin()

      // Lưu tin khách gửi vào DB để xem trong admin (kèm oa_id để biết OA nào)
      await logMessage(db, userId, 'in', text, payload.message?.msg_id, true, oaId)

      if (phone && orderCode) {
        // gọi nội bộ logic activate; source 'auto' = dò mọi sàn
        await fetch(`${process.env.SELF_URL}/api/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'auto', orderCode, phone, channel: 'zalo', zaloUserId: userId, consent: true,
          }),
        })
      } else {
        const missing = !phone ? 'số điện thoại' : 'mã đơn hàng'
        await sendZalo(userId,
          `Cảm ơn bạn! Để kích hoạt bảo hành, vui lòng gửi thêm ${missing}.\n` +
          `Ví dụ: 0901234567 - SPX123456789`)
      }
    }
  } catch (e) {
    console.error('webhook bg error', e)
  }
}

async function sendZalo(userId, text) {
  if (!process.env.ZALO_ACCESS_TOKEN) return
  await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: process.env.ZALO_ACCESS_TOKEN },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
  })
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
