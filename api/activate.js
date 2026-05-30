import { supabaseAdmin } from './_supabase.js'

const WARRANTY_MONTHS = { tamayoko: 12, yokool: 12 }

function addMonths(date, m) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + m)
  return d
}

// POST /api/activate  { brand, orderCode, phone, name, channel, zaloUserId, consent }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { brand, orderCode, phone, name, channel = 'web', zaloUserId, consent } = req.body || {}
    if (!brand || !orderCode) return res.status(400).json({ error: 'Thiếu brand hoặc mã đơn' })
    if (!consent) return res.status(400).json({ error: 'Cần đồng ý điều khoản xử lý dữ liệu cá nhân.' })

    const code = String(orderCode).trim().toUpperCase()
    const db = supabaseAdmin()

    // 1) Đơn phải tồn tại
    const { data: orders } = await db
      .from('wrt_orders').select('*').eq('brand', brand).eq('order_code', code).limit(1)
    if (!orders || orders.length === 0)
      return res.status(404).json({ error: 'Mã đơn không tồn tại trong hệ thống.' })
    const order = orders[0]

    if (phone && order.phone && order.phone !== phone)
      return res.status(400).json({ error: 'Số điện thoại không khớp với mã đơn.' })

    // 2) Chống kích hoạt trùng
    const { data: existing } = await db
      .from('wrt_warranties').select('id').eq('brand', brand).eq('order_code', code).limit(1)
    if (existing && existing.length > 0)
      return res.status(409).json({ error: 'Đơn này đã được kích hoạt bảo hành trước đó.' })

    // 3) Upsert khách hàng theo phone
    const custPhone = phone || order.phone
    let customerId = null
    if (custPhone) {
      const { data: cust } = await db.from('wrt_customers').upsert(
        {
          phone: custPhone,
          name: name || order.customer_name,
          zalo_user_id: zaloUserId || null,
          brand,
          consent_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      ).select('id').limit(1)
      customerId = cust && cust[0] ? cust[0].id : null
    }

    // 4) Tính hạn bảo hành từ ngày mua (fallback hôm nay)
    const base = order.purchase_date ? new Date(order.purchase_date) : new Date()
    const expires = addMonths(base, WARRANTY_MONTHS[brand] || 12)

    // 5) Ghi bảo hành
    const { data: created, error: insErr } = await db.from('wrt_warranties').insert({
      order_id: order.id,
      customer_id: customerId,
      brand,
      order_code: code,
      phone: custPhone,
      product: order.product,
      quantity: order.quantity,
      price: order.price,
      purchase_date: order.purchase_date,
      expires_at: expires.toISOString().slice(0, 10),
      channel,
      zalo_user_id: zaloUserId || null,
    }).select('*').limit(1)
    if (insErr) throw insErr
    const warranty = created[0]

    // 6) Gửi tin Zalo xác nhận (nếu kích hoạt qua Zalo và có token)
    if (channel === 'zalo' && zaloUserId && process.env.ZALO_ACCESS_TOKEN) {
      await sendZaloConfirm(zaloUserId, brand, warranty).catch(() => {})
    }

    return res.status(200).json({ ok: true, warranty })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}

async function sendZaloConfirm(userId, brand, w) {
  const text =
    `✅ Kích hoạt bảo hành thành công!\n` +
    `Sản phẩm: ${w.product || '-'}\n` +
    `Mã đơn: ${w.order_code}\n` +
    `Hết hạn bảo hành: ${w.expires_at}\n` +
    `Cảm ơn bạn đã tin dùng ${brand === 'yokool' ? 'Yokool' : 'Tamayoko'}!`
  await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', access_token: process.env.ZALO_ACCESS_TOKEN },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
  })
}
