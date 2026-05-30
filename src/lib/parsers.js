// Mapping cột thực tế từ file export Shopee & TikTok (2026).
// Lưu ý: cả 2 sàn đều CHE số điện thoại trong file export, nên ta KHÔNG
// dùng SĐT từ file làm định danh. Khóa chính để khách tra cứu là MÃ ĐƠN.

const num = (v) => {
  if (v == null || v === '') return null
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isNaN(n) ? null : n
}

// Chuẩn hóa ngày: hỗ trợ "2026-05-01 00:01" (Shopee) và "27/05/2026 17:31:07" (TikTok)
const toDate = (v) => {
  if (!v) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

// === SHOPEE ===
// Header ở dòng 1, data từ dòng 2.
export function parseShopee(rows) {
  // rows: mảng object {header: value}
  return rows.map((r) => {
    const product = [r['Tên sản phẩm'], r['Tên phân loại hàng']]
      .filter(Boolean).join(' - ') || null
    return {
      order_code: clean(r['Mã đơn hàng']),
      product,
      sku: r['SKU phân loại hàng'] || r['SKU sản phẩm'] || null,
      quantity: parseInt(r['Số lượng']) || 1,
      price: num(r['Giá ưu đãi']) ?? num(r['Giá gốc']),
      purchase_date: toDate(r['Ngày đặt hàng']),
      status: r['Trạng Thái Đơn Hàng'] || null,
      buyer: r['Người Mua'] || null,           // username, không phải SĐT
    }
  }).filter((r) => r.order_code)
}

// === TIKTOK ===
// Header dòng 1, dòng 2 là MÔ TẢ (bỏ qua), data từ dòng 3.
export function parseTiktok(rows) {
  return rows.map((r) => {
    const product = [r['Product Name'], r['Variation']]
      .filter(Boolean).join(' - ') || null
    return {
      order_code: clean(r['Order ID']),
      product,
      sku: r['Seller SKU'] || r['SKU ID'] || null,
      quantity: parseInt(r['Quantity']) || 1,
      price: num(r['SKU Subtotal After Discount']) ?? num(r['SKU Unit Original Price']),
      purchase_date: toDate(r['Created Time']),
      status: r['Order Status'] || null,
      buyer: r['Buyer Username'] || null,
    }
  }).filter((r) => r.order_code)
}

function clean(v) {
  if (v == null) return null
  return String(v).trim().toUpperCase()
}

// Gộp các dòng cùng order_code thành 1 bản ghi đơn:
// - sản phẩm: nối tên các sản phẩm (cách nhau bằng " + ")
// - quantity: cộng dồn
// - price: cộng dồn (tổng giá trị đơn)
// - các field khác: lấy từ dòng đầu
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
    }
  }
  return Array.from(map.values()).map((e) => {
    const { _products, ...rest } = e
    return { ...rest, product: _products.join(' + ') || rest.product }
  })
}

// TikTok: bỏ dòng mô tả (dòng 2). Nhận biết: ô Order ID chứa text mô tả.
export function isTiktokDescriptionRow(orderId) {
  if (!orderId) return true
  const s = String(orderId)
  // mã đơn TikTok là chuỗi số dài; dòng mô tả là câu tiếng Anh
  return !/^\d{6,}$/.test(s.trim())
}
