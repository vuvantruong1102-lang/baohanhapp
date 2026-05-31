import { useState, useEffect } from 'react'
import { SITE, SOURCES } from '../lib/site.js'
import { normalizePhone, normalizeOrderCode } from '../lib/format.js'

const fmtPrice = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + '₫')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export default function WarrantyPage() {
  const [source, setSource] = useState('shopee')
  const [orderCode, setOrderCode] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [product, setProduct] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activated, setActivated] = useState(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', SITE.accent)
    document.title = SITE.name + ' · ' + SITE.nameEn
  }, [])

  const isOther = source === 'other'
  const resetFlow = () => { setResult(null); setActivated(null); setError('') }

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
        body: JSON.stringify({ source, orderCode: code, phone: ph }),
      })
      const data = await r.json()
      if (data.error) setError(data.error); else setResult(data)
    } catch { setError('Có lỗi kết nối, vui lòng thử lại.') }
    setLoading(false)
  }

  async function handleActivate() {
    setError('')
    if (!consent) return setError('Vui lòng đồng ý điều khoản xử lý dữ liệu cá nhân.')
    const ph = normalizePhone(phone)
    if (!ph) return setError('Vui lòng nhập số điện thoại hợp lệ.')
    if (isOther && !purchaseDate) return setError('Vui lòng nhập ngày mua.')
    setLoading(true)
    try {
      const r = await fetch('/api/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          orderCode: isOther ? null : normalizeOrderCode(orderCode),
          phone: ph, name,
          product: isOther ? product : undefined,
          purchaseDate: isOther ? purchaseDate : undefined,
          channel: 'web', consent: true,
        }),
      })
      const data = await r.json()
      if (data.error) setError(data.error); else setActivated(data.warranty)
    } catch { setError('Có lỗi kết nối, vui lòng thử lại.') }
    setLoading(false)
  }

  return (
    <div className="cx">
      <header className="cx-head">
        <span className="cx-logo-dot" />
        <span className="cx-logo-text">{SITE.name}</span>
      </header>

      <div className="cx-main">
        {!activated ? (
          <>
            <div className="cx-hero">
              <div className="cx-eyebrow">{SITE.nameEn}</div>
              <p>Kích hoạt và tra cứu bảo hành cho sản phẩm của bạn chỉ trong vài giây.</p>
            </div>

            <div className="cx-card">
              <div className="cx-field">
                <label className="cx-label">Bạn mua sản phẩm ở đâu?</label>
                <div className="cx-seg">
                  {SOURCES.map((s) => (
                    <button key={s.key} type="button"
                      className={source === s.key ? 'active' : ''}
                      onClick={() => { setSource(s.key); resetFlow() }}>{s.label}</button>
                  ))}
                </div>
              </div>

              {!isOther && (
                <>
                  <div className="cx-field">
                    <label className="cx-label">Mã đơn hàng</label>
                    <input className="cx-input" value={orderCode}
                      onChange={(e) => setOrderCode(e.target.value)} placeholder="Nhập mã đơn hàng" />
                  </div>
                  <div className="cx-field">
                    <label className="cx-label">Số điện thoại</label>
                    <input className="cx-input" value={phone} inputMode="numeric"
                      onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại đặt hàng" />
                  </div>

                  {!result && (
                    <button className="cx-btn cx-mt" onClick={handleLookup} disabled={loading}>
                      {loading ? <span className="spinner" /> : 'Tra cứu đơn hàng'}
                    </button>
                  )}

                  {result && !result.found && (
                    <div className="cx-mt">
                      <span className="cx-pill err">Không tìm thấy đơn hàng</span>
                      <div className="cx-note" style={{ marginTop: 12 }}>{result.message}</div>
                      <button className="cx-btn ghost cx-mt" onClick={resetFlow}>Thử lại</button>
                    </div>
                  )}

                  {result && result.found && (
                    <div className="cx-detail">
                      {result.activated
                        ? <span className="cx-pill ok"><Tick /> Đã kích hoạt bảo hành</span>
                        : <span className="cx-pill warn">Đơn hợp lệ — chưa kích hoạt</span>}
                      <div className="cx-dl">
                        <div className="full"><div className="cx-dt">Sản phẩm</div><div className="cx-dd big">{result.order.product || '—'}</div></div>
                        <div><div className="cx-dt">Mã đơn</div><div className="cx-dd">{result.order.order_code}</div></div>
                        <div><div className="cx-dt">Số lượng</div><div className="cx-dd">{result.order.quantity}</div></div>
                        <div><div className="cx-dt">Giá sản phẩm</div><div className="cx-dd">{fmtPrice(result.order.price)}</div></div>
                        <div><div className="cx-dt">Ngày đặt hàng</div><div className="cx-dd">{fmtDate(result.order.purchase_date)}</div></div>
                        {result.activated && (
                          <div><div className="cx-dt">Hết hạn bảo hành</div><div className="cx-dd">{fmtDate(result.warranty.expires_at)}</div></div>
                        )}
                      </div>

                      {!result.activated && (
                        <>
                          <div className="cx-divider" />
                          <div className="cx-field">
                            <label className="cx-label">Họ tên <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(không bắt buộc)</span></label>
                            <input className="cx-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
                          </div>
                          <Consent checked={consent} onChange={setConsent} />
                          <button className="cx-btn" onClick={handleActivate} disabled={loading}>
                            {loading ? <span className="spinner" /> : 'Kích hoạt bảo hành'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {isOther && (
                <>
                  <div className="cx-field">
                    <label className="cx-label">Số điện thoại</label>
                    <input className="cx-input" value={phone} inputMode="numeric"
                      onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại của bạn" />
                  </div>
                  <div className="cx-field">
                    <label className="cx-label">Ngày mua</label>
                    <input className="cx-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                  </div>
                  <div className="cx-field">
                    <label className="cx-label">Tên sản phẩm</label>
                    <input className="cx-input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Tên sản phẩm đã mua" />
                  </div>
                  <div className="cx-field">
                    <label className="cx-label">Họ tên <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>(không bắt buộc)</span></label>
                    <input className="cx-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
                  </div>
                  <Consent checked={consent} onChange={setConsent} />
                  <button className="cx-btn" onClick={handleActivate} disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Kích hoạt bảo hành'}
                  </button>
                </>
              )}

              {error && <div className="cx-note" style={{ marginTop: 18 }}>{error}</div>}
            </div>
          </>
        ) : (
          <div className="cx-card cx-success">
            <div className="cx-check">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2>Kích hoạt thành công</h2>
            <p>Bảo hành cho sản phẩm của bạn đã được kích hoạt.</p>
            <div className="cx-divider" />
            <div className="cx-dl" style={{ textAlign: 'left' }}>
              <div className="full"><div className="cx-dt">Sản phẩm</div><div className="cx-dd big">{activated.product || '—'}</div></div>
              <div><div className="cx-dt">Mã bảo hành</div><div className="cx-dd">{activated.warranty_code}</div></div>
              <div><div className="cx-dt">Hết hạn bảo hành</div><div className="cx-dd">{fmtDate(activated.expires_at)}</div></div>
            </div>
          </div>
        )}
      </div>

      <footer className="cx-foot">© {new Date().getFullYear()} {SITE.name} · {SITE.nameEn}</footer>
    </div>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  )
}

function Consent({ checked, onChange }) {
  return (
    <label className="cx-consent">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Tôi đồng ý cho trung tâm bảo hành lưu trữ và sử dụng số điện thoại để phục vụ
        bảo hành và chăm sóc khách hàng theo Nghị định 13/2023.</span>
    </label>
  )
}
