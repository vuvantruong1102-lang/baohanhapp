import { supabaseAdmin } from './_supabase.js'

// POST /api/import  { brand, platform, rows: [...], adminKey }
// rows: mảng object đã parse từ CSV ở client.
// Bảo vệ bằng ADMIN_KEY để không ai import bừa.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const { brand, platform, rows, adminKey } = req.body || {}
    if (adminKey !== process.env.ADMIN_KEY)
      return res.status(401).json({ error: 'Sai mã quản trị.' })
    if (!brand || !platform || !Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'Thiếu dữ liệu import.' })

    const normPhone = (p) => {
      if (!p) return null
      let s = String(p).replace(/[\s.\-()]/g, '')
      if (s.startsWith('+84')) s = '0' + s.slice(3)
      else if (s.startsWith('84') && s.length === 11) s = '0' + s.slice(2)
      return /^0(3|5|7|8|9)\d{8}$/.test(s) ? s : null
    }

    const records = rows.map((r) => ({
      brand,
      platform,
      order_code: String(r.order_code || r.ma_don || r['Mã đơn'] || '').trim().toUpperCase(),
      phone: normPhone(r.phone || r.sdt || r['Số điện thoại']),
      customer_name: r.customer_name || r.ten || r['Tên khách'] || null,
      product: r.product || r.san_pham || r['Sản phẩm'] || null,
      quantity: parseInt(r.quantity || r.so_luong || r['Số lượng'] || 1) || 1,
      price: parseFloat(String(r.price || r.gia || r['Giá'] || 0).replace(/[^\d.]/g, '')) || null,
      purchase_date: r.purchase_date || r.ngay_mua || r['Ngày mua'] || null,
      raw: r,
    })).filter((r) => r.order_code)

    const db = supabaseAdmin()
    // upsert theo (brand, platform, order_code) → import lại không tạo trùng
    const { data, error } = await db.from('wrt_orders')
      .upsert(records, { onConflict: 'brand,platform,order_code' }).select('id')
    if (error) throw error

    return res.status(200).json({ ok: true, imported: data.length })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
