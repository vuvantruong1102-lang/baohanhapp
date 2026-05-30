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
