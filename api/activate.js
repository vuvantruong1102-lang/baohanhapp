import { supabaseAdmin } from './_supabase.js'

const WARRANTY_MONTHS = 12

function addMonths(date, m) {
  const d = new Date(date); d.setMonth(d.getMonth() + m); return d
}
function genCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// POST /api/activate
// { source, orderCode, phone, name, product, purchaseDate, channel, zaloUserId, consent }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const {
      source = 'shopee', orderCode, phone, name, product, purchaseDate,
      channel = 'web', zaloUserId, consent,
    } = req.body || {}

    if (!consent) return res.status(400).json({ error: 'Cần đồng ý điều khoản xử lý dữ liệu cá nhân.' })
    if (!phone) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại.' })

    const db = supabaseAdmin()
    const isOther = source === 'other'

    let order = null
    let warrantyCode, prod, qty = 1, price = null, pDate = purchaseDate || null, buyer = null

    if (!isOther) {
      // Nguồn sàn: phải có mã đơn tồn tại
      if (!orderCode) return res.status(400).json({ error: 'Thiếu mã đơn hàng.' })
      const code = String(orderCode).trim().toUpperCase()
      let ordersQuery = db.from('wrt_orders').select('*').eq('order_code', code).limit(1)
      if (source !== 'auto') {
        const platforms = source === 'tiktokshop' ? ['tiktokshop', 'tiktok'] : [source]
        ordersQuery = db.from('wrt_orders').select('*').in('platform', platforms).eq('order_code', code).limit(1)
      }
      const { data: orders } = await ordersQuery
      if (!orders || orders.length === 0)
        return res.status(404).json({ error: 'Mã đơn không tồn tại trong hệ thống.' })
      order = orders[0]
      warrantyCode = code
      prod = order.product; qty = order.quantity; price = order.price
      pDate = order.purchase_date; buyer = order.buyer
    } else {
      // Nguồn Khác: cần ngày mua + sản phẩm, tự sinh mã bảo hành
      if (!purchaseDate) return res.status(400).json({ error: 'Vui lòng nhập ngày mua.' })
      warrantyCode = genCode('KHAC')
      prod = product || null
    }

    // chống kích hoạt trùng (chỉ với đơn sàn)
    if (!isOther) {
      const { data: existing } = await db
        .from('wrt_warranties').select('id').eq('warranty_code', warrantyCode).limit(1)
      if (existing && existing.length > 0)
        return res.status(409).json({ error: 'Đơn này đã được kích hoạt bảo hành trước đó.' })
    }

    // upsert khách theo phone
    const { data: cust } = await db.from('wrt_customers').upsert({
      phone, name: name || null, username: buyer || null, zalo_user_id: zaloUserId || null,
      consent_at: new Date().toISOString(), last_active_at: new Date().toISOString(),
    }, { onConflict: 'phone' }).select('id').limit(1)
    const customerId = cust && cust[0] ? cust[0].id : null

    const base = pDate ? new Date(pDate) : new Date()
    const expires = addMonths(base, WARRANTY_MONTHS)

    const { data: created, error: insErr } = await db.from('wrt_warranties').insert({
      order_id: order ? order.id : null,
      customer_id: customerId,
      source,
      warranty_code: warrantyCode,
      order_code: isOther ? null : warrantyCode,
      phone, product: prod, quantity: qty, price, buyer,
      purchase_date: pDate,
      expires_at: expires.toISOString().slice(0, 10),
      channel, zalo_user_id: zaloUserId || null,
    }).select('*').limit(1)
    if (insErr) throw insErr
    const warranty = created[0]

    // Không gửi tin xác nhận từ app — Zalo OA đã cấu hình tin nhắn tự động.

    return res.status(200).json({ ok: true, warranty })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
