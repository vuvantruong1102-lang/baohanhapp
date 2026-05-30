import { useState, useEffect } from 'react'
import { SITE, SOURCES } from '../lib/site.js'
import { normalizePhone, normalizeOrderCode } from '../lib/format.js'

const fmtPrice = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + 'đ')
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
    document.documentElement.style.setProperty('--accent-soft', SITE.accentSoft)
    document.title = SITE.name + ' · ' + SITE.nameEn
  }, [])

  const isOther = source === 'other'

  function resetFlow() {
    setResult(null); setActivated(null); setError('')
  }

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
      if (data.error) setError(data.error)
      else setResult(data)
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
      if (data.error) setError(data.error)
      else setActivated(data.warranty)
    } catch { setError('Có lỗi kết nối, vui lòng thử lại.') }
    setLoading(false)
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand-mark"><span className="brand-dot" />{SITE.name}</div>
      </div>

      <div className="hero">
        <h1>Trung tâm <em>bảo hành</em></h1>
        <p className="hero-sub">Warranty Service</p>
        <p>Kích hoạt và tra cứu bảo hành chính hãng cho sản phẩm của bạn.</p>
      </div>

      {!activated && (
        <div className="card">
          {/* Chọn nguồn mua */}
          <div className="field">
            <label>Bạn mua sản phẩm ở đâu?</label>
            <div className="source-pick">
              {SOURCES.map((s) => (
                <button key={s.key} type="button"
                  className={source === s.key ? 'active' : ''}
                  onClick={() => { setSource(s.key); resetFlow() }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nguồn sàn: nhập mã đơn + tra cứu */}
          {!isOther && (
            <>
              <div className="field">
                <label>Mã đơn hàng *</label>
                <input value={orderCode} onChange={(e) => setOrderCode(e.target.value)}
                  placeholder="VD: 2605017SA6M9E3" />
              </div>
              <div className="field">
                <label>Số điện thoại *</label>
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
                  <div className="result"><span className="badge err">✕ Không tìm thấy</span>
                    <div className="notice" style={{ marginTop: 12 }}>{result.message}</div></div>
                  <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={resetFlow}>Thử lại</button>
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
                    <div className="full"><div className="k">Sản phẩm</div><div className="v">{result.order.product || '—'}</div></div>
                    <div><div className="k">Mã đơn</div><div className="v">{result.order.order_code}</div></div>
                    <div><div className="k">Số lượng</div><div className="v">{result.order.quantity}</div></div>
                    <div><div className="k">Giá</div><div className="v">{fmtPrice(result.order.price)}</div></div>
                    <div><div className="k">Ngày đặt hàng</div><div className="v">{fmtDate(result.order.purchase_date)}</div></div>
                    {result.activated && (
                      <div><div className="k">Hết hạn BH</div><div className="v">{fmtDate(result.warranty.expires_at)}</div></div>
                    )}
                  </div>

                  {!result.activated && (
                    <div style={{ marginTop: 20 }}>
                      <div className="field"><label>Họ tên (không bắt buộc)</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" /></div>
                      <Consent checked={consent} onChange={setConsent} />
                      <button className="btn" onClick={handleActivate} disabled={loading}>
                        {loading ? <span className="spinner" /> : 'Kích hoạt bảo hành ngay'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Nguồn Khác: không cần mã đơn */}
          {isOther && (
            <>
              <div className="field"><label>Số điện thoại *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0901234567" inputMode="numeric" /></div>
              <div className="field"><label>Ngày mua *</label>
                <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
              <div className="field"><label>Tên sản phẩm</label>
                <input value={product} onChange={(e) => setProduct(e.target.value)}
                  placeholder="Tên sản phẩm bạn đã mua" /></div>
              <div className="field"><label>Họ tên (không bắt buộc)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" /></div>
              <Consent checked={consent} onChange={setConsent} />
              <button className="btn" onClick={handleActivate} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Kích hoạt bảo hành ngay'}
              </button>
            </>
          )}

          {error && <div className="notice" style={{ marginTop: 16 }}>{error}</div>}
        </div>
      )}

      {activated && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 46, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, marginBottom: 8 }}>Kích hoạt thành công!</h2>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 22 }}>Bảo hành cho sản phẩm của bạn đã được kích hoạt.</p>
          <div className="kv" style={{ textAlign: 'left' }}>
            <div className="full"><div className="k">Sản phẩm</div><div className="v">{activated.product || '—'}</div></div>
            <div><div className="k">Mã bảo hành</div><div className="v">{activated.warranty_code}</div></div>
            <div><div className="k">Hết hạn BH</div><div className="v">{fmtDate(activated.expires_at)}</div></div>
          </div>
        </div>
      )}

      <div className="foot">© {new Date().getFullYear()} {SITE.name} · {SITE.nameEn}</div>
    </div>
  )
}

function Consent({ checked, onChange }) {
  return (
    <label className="consent">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Tôi đồng ý cho trung tâm bảo hành lưu trữ và sử dụng số điện thoại để
        phục vụ bảo hành và chăm sóc khách hàng (theo Nghị định 13/2023).</span>
    </label>
  )
}
