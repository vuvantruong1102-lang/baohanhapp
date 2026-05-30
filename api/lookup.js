import { supabaseAdmin } from './_supabase.js'

// POST /api/lookup  { source, orderCode, phone }
// source: 'shopee' | 'tiktokshop' | 'other'
// - shopee/tiktokshop: đối chiếu mã đơn trong wrt_orders
// - other: không có mã đơn, không tra cứu (khách kích hoạt thẳng)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { source, orderCode, phone } = req.body || {}
    const db = supabaseAdmin()

    // Nguồn "Khác": không cần mã đơn
    if (source === 'other') {
      return res.status(200).json({ found: true, requiresCode: false, order: null })
    }

    if (!orderCode) return res.status(400).json({ error: 'Vui lòng nhập mã đơn hàng.' })
    const code = String(orderCode).trim().toUpperCase()

    // sàn lưu trong DB: tiktokshop chấp nhận cả 'tiktok' (dữ liệu cũ)
    const platforms = source === 'tiktokshop' ? ['tiktokshop', 'tiktok'] : [source]

    const { data: orders, error } = await db
      .from('wrt_orders').select('*').in('platform', platforms).eq('order_code', code).limit(1)
    if (error) throw error

    if (!orders || orders.length === 0)
      return res.status(200).json({ found: false, message: 'Không tìm thấy mã đơn này trong hệ thống.' })

    const order = orders[0]

    // kiểm tra đã kích hoạt chưa (theo warranty_code = mã đơn)
    const { data: warr } = await db
      .from('wrt_warranties').select('*').eq('warranty_code', code).limit(1)
    const activated = warr && warr.length > 0

    return res.status(200).json({
      found: true,
      requiresCode: true,
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
