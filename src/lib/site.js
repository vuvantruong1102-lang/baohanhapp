// Một thương hiệu chung — không còn phân biệt Tamayoko/Yokool.
export const SITE = {
  name: 'Trung tâm bảo hành',
  nameEn: 'Warranty Service',
  accent: '#dc143b',
  accentSoft: '#fbe7eb',
  warrantyMonths: 12,
}

// Nguồn mua hàng dùng ở form kích hoạt và import.
export const SOURCES = [
  { key: 'shopee', label: 'Shopee', requiresCode: true },
  { key: 'tiktokshop', label: 'TikTokShop', requiresCode: true },
  { key: 'other', label: 'Khác', requiresCode: false },
]

export function sourceLabel(key) {
  const s = SOURCES.find((x) => x.key === key)
  return s ? s.label : key
}

// Nhãn sàn hiển thị: viết hoa chữ đầu, TikTokShop đúng tên.
export function platformLabel(key) {
  const map = { shopee: 'Shopee', tiktok: 'TikTokShop', tiktokshop: 'TikTokShop', other: 'Khác' }
  return map[(key || '').toLowerCase()] || key
}

// Map OA ID → nhãn brand. Frontend không biết OA ID thật (nằm ở env server),
// nên server trả sẵn nhãn 'oa_label' trong dữ liệu thread. Hàm này chỉ fallback.
export function oaLabelFallback(oaId) {
  return oaId ? ('OA ' + String(oaId).slice(-4)) : 'Zalo OA'
}

// Rút gọn trạng thái đơn dài (Shopee/TikTok) thành nhãn ngắn dễ đọc.
export function shortStatus(s) {
  if (!s) return null
  const t = String(s).toLowerCase()
  if (/hoàn thành|completed/.test(t)) return 'Hoàn thành'
  if (/đã hủy|huỷ|cancel/.test(t)) return 'Đã hủy'
  if (/trả hàng|hoàn tiền|return|refund/.test(t)) return 'Trả/Hoàn'
  if (/xác nhận đã nhận|đã nhận được hàng|delivered|giao thành công|đã giao/.test(t)) return 'Đã nhận hàng'
  if (/đang giao|on the way|in transit|shipping/.test(t)) return 'Đang giao'
  if (/cần vận chuyển|chờ lấy hàng|to ship|awaiting|chuẩn bị/.test(t)) return 'Chờ giao hàng'
  if (/chờ xác nhận|pending|unpaid|chưa thanh toán/.test(t)) return 'Chờ xác nhận'
  return s.length > 24 ? s.slice(0, 24) + '…' : s
}
