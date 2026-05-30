import { supabaseAdmin } from './_supabase.js'

// POST /api/lookup  { brand, orderCode, phone }
// Trả về đơn có khớp không + đã kích hoạt bảo hành chưa.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { brand, orderCode, phone } = req.body || {}
    if (!brand || !orderCode) return res.status(400).json({ error: 'Thiếu brand hoặc mã đơn' })

    const code = String(orderCode).trim().toUpperCase()
    const db = supabaseAdmin()

    // 1) Tìm đơn trong bảng đã import
    let q = db.from('wrt_orders').select('*').eq('brand', brand).eq('order_code', code).limit(1)
    const { data: orders, error } = await q
    if (error) throw error

    if (!orders || orders.length === 0) {
      return res.status(200).json({ found: false, message: 'Không tìm thấy mã đơn này trong hệ thống.' })
    }
    const order = orders[0]

    // 2) Nếu khách có nhập SĐT, đối chiếu thêm cho chắc
    if (phone && order.phone && order.phone !== phone) {
      return res.status(200).json({ found: false, message: 'Số điện thoại không khớp với mã đơn.' })
    }

    // 3) Kiểm tra đã kích hoạt bảo hành chưa
    const { data: warr } = await db
      .from('wrt_warranties').select('*').eq('brand', brand).eq('order_code', code).limit(1)

    const activated = warr && warr.length > 0
    return res.status(200).json({
      found: true,
      activated,
      order: {
        order_code: order.order_code,
        product: order.product,
        quantity: order.quantity,
        price: order.price,
        purchase_date: order.purchase_date,
        platform: order.platform,
      },
      warranty: activated ? warr[0] : null,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
