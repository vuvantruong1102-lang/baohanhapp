import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { resolveBrand } from '../lib/brands.js'
import { normalizePhone, normalizeOrderCode } from '../lib/format.js'

const fmtPrice = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + 'đ')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export default function WarrantyPage() {
  const { brand: brandParam } = useParams()
  const brand = resolveBrand(brandParam)

  const [orderCode, setOrderCode] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)   // {found, activated, order, warranty}
  const [error, setError] = useState('')
  const [activated, setActivated] = useState(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', brand.accent)
    document.documentElement.style.setProperty('--accent-soft', brand.accentSoft)
    document.title = `Bảo hành ${brand.name}`
  }, [brand])

  async function handleLookup() {
    setError(''); setResult(null); setActivated(null)
    const code = normalizeOrderCode(orderCode)
    if (!code) return setError('Vui lòng nhập mã đơn hàng hợp lệ.')
    const ph = phone ? normalizePhone(phone) : null
    if (phone && !ph) return setError('Số điện thoại không hợp lệ.')

    setLoading(true)
    try {
      const r = await fetch('/api/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brand.key, orderCode: code, phone: ph }),
      })
      const data = await r.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch { setError('Có lỗi kết nối, vui lòng thử lại.') }
    setLoading(false)
  }

  async function handleActivate() {
    setError('')
    if (!consent) return setError('Vui lòng đồng ý điều khoản xử lý dữ liệu cá nhân.')
    setLoading(true)
    try {
      const r = await fetch('/api/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: brand.key, orderCode: normalizeOrderCode(orderCode),
          phone: phone ? normalizePhone(phone) : null, name, channel: 'web', consent: true,
        }),
      })
      const data = await r.json()
      if (data.error) setError(data.error)
      else setActivated(data.warranty)
    } catch { setError('Có lỗi kết nối, vui lòng thử lại.') }
    setLoading(false)
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand-mark">
          <span className="brand-dot" />{brand.name}
        </div>
        <div className="brand-switch">
          <Link to="/tamayoko" className={brand.key === 'tamayoko' ? 'active' : ''}>Tamayoko</Link>
          <Link to="/yokool" className={brand.key === 'yokool' ? 'active' : ''}>Yokool</Link>
        </div>
      </div>

      <div className="hero">
        <h1>Kích hoạt <em>bảo hành</em><br />chính hãng</h1>
        <p>{brand.tagline}. Nhập mã đơn hàng để tra cứu và kích hoạt bảo hành cho sản phẩm của bạn.</p>
      </div>

      {!activated && (
        <div className="card">
          <div className="field">
            <label>Mã đơn hàng *</label>
            <input value={orderCode} onChange={(e) => setOrderCode(e.target.value)}
              placeholder="VD: SPX1234567890" />
          </div>
          <div className="field">
            <label>Số điện thoại</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 0901234567" inputMode="numeric" />
          </div>

          {!result && (
            <button className="btn" onClick={handleLookup} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Tra cứu đơn hàng'}
            </button>
          )}

          {result && !result.found && (
            <>
              <div className="result">
                <span className="badge err">✕ Không tìm thấy</span>
                <div className="notice" style={{ marginTop: 12 }}>{result.message}</div>
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 16 }}
                onClick={() => setResult(null)}>Thử lại</button>
            </>
          )}

          {result && result.found && (
            <div className="result">
              <div className="result-head">
                {result.activated
                  ? <span className="badge ok">✓ Đã kích hoạt bảo hành</span>
                  : <span className="badge warn">● Đơn hợp lệ — chưa kích hoạt</span>}
              </div>
              <div className="kv">
                <div className="full"><div className="k">Sản phẩm</div>
                  <div className="v">{result.order.product || '—'}</div></div>
                <div><div className="k">Mã đơn</div><div className="v">{result.order.order_code}</div></div>
                <div><div className="k">Sàn</div><div className="v">{result.order.platform}</div></div>
                <div><div className="k">Số lượng</div><div className="v">{result.order.quantity}</div></div>
                <div><div className="k">Giá</div><div className="v">{fmtPrice(result.order.price)}</div></div>
                <div><div className="k">Ngày mua</div><div className="v">{fmtDate(result.order.purchase_date)}</div></div>
                {result.activated && (
                  <div><div className="k">Hết hạn BH</div>
                    <div className="v">{fmtDate(result.warranty.expires_at)}</div></div>
                )}
              </div>

              {!result.activated && (
                <div style={{ marginTop: 20 }}>
                  <div className="field">
                    <label>Họ tên (không bắt buộc)</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
                  </div>
                  <label className="consent">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>Tôi đồng ý cho {brand.name} lưu trữ và sử dụng số điện thoại để
                      phục vụ bảo hành và chăm sóc khách hàng (theo Nghị định 13/2023).</span>
                  </label>
                  <button className="btn" onClick={handleActivate} disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Kích hoạt bảo hành ngay'}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <div className="notice" style={{ marginTop: 16 }}>{error}</div>}
        </div>
      )}

      {activated && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 46, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, marginBottom: 8 }}>
            Kích hoạt thành công!
          </h2>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 22 }}>
            Bảo hành cho sản phẩm của bạn đã được kích hoạt.
          </p>
          <div className="kv" style={{ textAlign: 'left' }}>
            <div className="full"><div className="k">Sản phẩm</div><div className="v">{activated.product || '—'}</div></div>
            <div><div className="k">Mã đơn</div><div className="v">{activated.order_code}</div></div>
            <div><div className="k">Hết hạn BH</div><div className="v">{fmtDate(activated.expires_at)}</div></div>
          </div>
        </div>
      )}

      <div className="foot">
        © {new Date().getFullYear()} {brand.name} · <a href={brand.site}>{brand.site.replace('https://', '')}</a>
      </div>
    </div>
  )
}
