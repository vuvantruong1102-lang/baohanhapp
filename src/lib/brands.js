// Cấu hình theo từng brand. Cùng 1 webapp, tách theme + nội dung.
export const BRANDS = {
  tamayoko: {
    key: 'tamayoko',
    name: 'Tamayoko',
    tagline: 'Trung tâm bảo hành chính hãng',
    accent: '#dc143b',
    accentSoft: '#fbe7eb',
    warrantyMonths: 12,           // chính sách bảo hành mặc định (tháng)
    site: 'https://tamayoko.com',
  },
  yokool: {
    key: 'yokool',
    name: 'Yokool',
    tagline: 'Kích hoạt & tra cứu bảo hành',
    accent: '#dc143b',
    accentSoft: '#fbe7eb',
    warrantyMonths: 12,
    site: 'https://yokool.com',
  },
}

export function resolveBrand(param) {
  const key = (param || '').toLowerCase()
  return BRANDS[key] || BRANDS.tamayoko
}
