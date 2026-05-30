// Chuẩn hoá dữ liệu — dùng chung cho cả frontend lẫn serverless function.

// Chuẩn hoá SĐT VN về dạng 0xxxxxxxxx
export function normalizePhone(input) {
  if (!input) return null
  let p = String(input).replace(/[\s.\-()]/g, '')
  if (p.startsWith('+84')) p = '0' + p.slice(3)
  else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2)
  // chấp nhận đầu số di động VN hợp lệ
  if (/^0(3|5|7|8|9)\d{8}$/.test(p)) return p
  return null
}

// Chuẩn hoá mã đơn: bỏ khoảng trắng, viết hoa
export function normalizeOrderCode(input) {
  if (!input) return null
  const c = String(input).trim().replace(/\s+/g, '').toUpperCase()
  return c.length >= 4 ? c : null
}

// Trích SĐT + mã đơn từ 1 đoạn text tự do (dùng cho webhook Zalo)
export function extractFromText(text) {
  const phoneMatch = String(text).match(/(0|\+84|84)(3|5|7|8|9)\d{8}/)
  const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : null
  // mã đơn: chuỗi chữ-số 6-20 ký tự, loại trùng với SĐT
  const tokens = String(text).toUpperCase().match(/[A-Z0-9]{6,20}/g) || []
  const orderCode = tokens.find((t) => t !== (phoneMatch && phoneMatch[0])) || null
  return { phone, orderCode: orderCode ? normalizeOrderCode(orderCode) : null }
}

export function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}
