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

// === SHOPEE === đọc theo TÊN HEADER (bền vững khi Shopee đổi bố cục cột).
// Tìm index cột theo tên gần đúng; nếu file đổi thứ tự cột vẫn đúng.
function findCol(header, ...names) {
  // normalize('NFC') gộp dấu thanh tổ hợp (vd "a"+dấu sắc rời) về ký tự liền,
  // vì file Shopee dùng Unicode tổ hợp khiến so chuỗi thất bại dù nhìn giống.
  const norm = (s) => String(s || '').normalize('NFC').trim().toLowerCase()
  for (const name of names) {
    const target = norm(name)
    const idx = header.findIndex((h) => norm(h) === target)
    if (idx !== -1) return idx
  }
  for (const name of names) {
    const target = norm(name)
    const idx = header.findIndex((h) => norm(h).includes(target))
    if (idx !== -1) return idx
  }
  return -1
}

export function parseShopee(aoa) {
  const out = []
  if (!aoa.length) return out
  const H = aoa[0]
  const col = {
    code: findCol(H, 'Mã đơn hàng'),
    status: findCol(H, 'Trạng Thái Đơn Hàng', 'Trạng thái đơn hàng'),
    date: findCol(H, 'Ngày đặt hàng'),
    name: findCol(H, 'Tên sản phẩm'),
    variant: findCol(H, 'SKU phân loại hàng', 'Tên phân loại hàng', 'Phân loại hàng'),
    sku: findCol(H, 'SKU sản phẩm'),
    price: findCol(H, 'Giá ưu đãi'),
    qty: findCol(H, 'Số lượng'),
    buyer: findCol(H, 'Người Mua', 'Người mua', 'Tên Người mua'),
  }
  const g = (r, k) => (col[k] >= 0 ? r[col[k]] : null)
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r) continue
    const code = clean(g(r, 'code')); if (!code) continue
    const product = [g(r, 'name'), g(r, 'variant')].filter(Boolean).join(' - ') || null
    out.push({
      order_code: code,
      product,
      sku: g(r, 'sku') || null,
      quantity: parseInt(g(r, 'qty')) || 1,
      price: num(g(r, 'price')),
      purchase_date: toDate(g(r, 'date')),
      buyer: g(r, 'buyer') || null,
      order_status: g(r, 'status') ? String(g(r, 'status')).trim() : null,
    })
  }
  return out
}

// === TIKTOKSHOP === đọc theo TÊN HEADER (tiếng Anh).
export function parseTiktok(aoa) {
  const out = []
  if (!aoa.length) return out
  const H = aoa[0]
  const col = {
    code: findCol(H, 'Order ID'),
    status: findCol(H, 'Order Status'),
    name: findCol(H, 'Product Name'),
    variant: findCol(H, 'Variation'),
    sku: findCol(H, 'Seller SKU', 'SKU'),
    qty: findCol(H, 'Quantity'),
    price: findCol(H, 'SKU Subtotal After Discount', 'SKU Subtotal Before Discount'),
    date: findCol(H, 'Created Time'),
    buyer: findCol(H, 'Buyer Username'),
  }
  const g = (r, k) => (col[k] >= 0 ? r[col[k]] : null)
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r) continue
    const rawCode = g(r, 'code')
    if (!rawCode || !/^\d{6,}$/.test(String(rawCode).trim())) continue
    const code = clean(rawCode)
    const product = [g(r, 'name'), g(r, 'variant')].filter(Boolean).join(' - ') || null
    out.push({
      order_code: code,
      product,
      sku: g(r, 'sku') || null,
      quantity: parseInt(g(r, 'qty')) || 1,
      price: num(g(r, 'price')),
      purchase_date: toDate(g(r, 'date')),
      buyer: g(r, 'buyer') || null,
      order_status: g(r, 'status') ? String(g(r, 'status')).trim() : null,
    })
  }
  return out
}

// Nhận diện loại file để chống import nhầm nút.
// Shopee: mã đơn là chữ-số ~14 ký tự (vd 2603034XTV9E0H).
// TikTok: mã đơn là chuỗi TOÀN SỐ dài 15-19 chữ số (vd 584223449992560000).
// Trả 'shopee' | 'tiktok' | null (không chắc).
export function detectFileType(aoa) {
  let shopeeHits = 0, tiktokHits = 0, checked = 0
  for (let i = 1; i < aoa.length && checked < 40; i++) {
    const r = aoa[i]; if (!r) continue
    const code = String(r[0] ?? '').trim()
    if (!code) continue
    checked++
    if (/^\d{15,19}$/.test(code)) tiktokHits++
    else if (/^[0-9]{6}[A-Z0-9]{6,10}$/i.test(code)) shopeeHits++
  }
  if (tiktokHits > shopeeHits && tiktokHits > 0) return 'tiktok'
  if (shopeeHits > tiktokHits && shopeeHits > 0) return 'shopee'
  return null
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
      if (r.order_status) e.order_status = r.order_status
    }
  }
  return Array.from(map.values()).map((e) => {
    const { _products, ...rest } = e
    return { ...rest, product: _products.join(' + ') || rest.product }
  })
}
