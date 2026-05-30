// Parser đọc theo VỊ TRÍ CỘT (index) thay vì tên header.
// Lý do: file Shopee có nhiều cột tên gần giống ("Giá gốc"/"Giá ưu đãi"),
// đọc theo tên dễ lệch/gộp. Đọc theo index cột là chắc chắn nhất.
//
// rows ở đây là ARRAY OF ARRAYS (aoa) từ XLSX.utils.sheet_to_json(ws,{header:1}).

const num = (v) => {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isNaN(n) ? null : n
}
const toDate = (v) => {
  if (!v) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}
const clean = (v) => (v == null ? null : String(v).trim().toUpperCase())

// === SHOPEE === (index cột, 0-based)
// 0 Mã đơn | 2 Ngày đặt | 16 Tên SP | 20 Tên phân loại | 19 SKU phân loại
// 25 Giá ưu đãi (cột Z) | 26 Số lượng | 53 Người Mua (cột BB)
const SP = { code: 0, date: 2, name: 16, variant: 20, sku: 19, price: 25, qty: 26, buyer: 53 }

export function parseShopee(aoa) {
  const out = []
  for (let i = 1; i < aoa.length; i++) {     // bỏ header dòng 0
    const r = aoa[i]; if (!r) continue
    const code = clean(r[SP.code]); if (!code) continue
    const product = [r[SP.name], r[SP.variant]].filter(Boolean).join(' - ') || null
    out.push({
      order_code: code,
      product,
      sku: r[SP.sku] || null,
      quantity: parseInt(r[SP.qty]) || 1,
      price: num(r[SP.price]),                  // cột Z = Giá ưu đãi
      purchase_date: toDate(r[SP.date]),
      buyer: r[SP.buyer] || null,               // cột BB = Người Mua
    })
  }
  return out
}

// === TIKTOKSHOP === (index cột, 0-based)
// 0 Order ID | 7 Product Name | 8 Variation | 6 Seller SKU | 9 Quantity
// 15 SKU Subtotal After Discount | 24 Created Time | 38 Buyer Username (cột AM)
const TT = { code: 0, name: 7, variant: 8, sku: 6, qty: 9, price: 15, date: 24, buyer: 38 }

export function parseTiktok(aoa) {
  const out = []
  // dòng 0 = header, dòng 1 = mô tả tiếng Anh → bắt đầu từ dòng 1 nhưng lọc
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r) continue
    const rawCode = r[TT.code]
    // bỏ dòng mô tả: mã đơn TikTok là chuỗi số dài
    if (!rawCode || !/^\d{6,}$/.test(String(rawCode).trim())) continue
    const code = clean(rawCode)
    const product = [r[TT.name], r[TT.variant]].filter(Boolean).join(' - ') || null
    out.push({
      order_code: code,
      product,
      sku: r[TT.sku] || null,
      quantity: parseInt(r[TT.qty]) || 1,
      price: num(r[TT.price]),
      purchase_date: toDate(r[TT.date]),
      buyer: r[TT.buyer] || null,               // cột AM = Buyer Username
    })
  }
  return out
}

// Gộp các dòng cùng order_code (đơn nhiều sản phẩm)
export function dedupeByOrder(records) {
  const map = new Map()
  for (const r of records) {
    if (!r.order_code) continue
    if (!map.has(r.order_code)) {
      map.set(r.order_code, { ...r, _products: r.product ? [r.product] : [] })
    } else {
      const e = map.get(r.order_code)
      e.quantity = (e.quantity || 0) + (r.quantity || 0)
      e.price = (e.price || 0) + (r.price || 0)
      if (r.product && !e._products.includes(r.product)) e._products.push(r.product)
      if (!e.buyer && r.buyer) e.buyer = r.buyer
    }
  }
  return Array.from(map.values()).map((e) => {
    const { _products, ...rest } = e
    return { ...rest, product: _products.join(' + ') || rest.product }
  })
}
