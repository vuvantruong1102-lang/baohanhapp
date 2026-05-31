import { useState } from 'react'
import { getKey } from '../lib/adminApi.js'

export default function RecoverPanel() {
  const [token, setToken] = useState('')
  const [oaId, setOaId] = useState('')
  const [count, setCount] = useState(50)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  async function run() {
    setErr(''); setResult(null); setLoading(true)
    try {
      const r = await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': getKey() },
        body: JSON.stringify({
          accessToken: token.trim(), oaId: oaId.trim() || null, maxConversations: Number(count) || 50,
        }),
      })
      const data = await r.json()
      if (data.error) setErr(data.error); else setResult(data)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <>
      <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 18 }}>
          Kéo lịch sử hội thoại cũ từ Zalo OA về app (chạy một lần). Tin có đủ
          số điện thoại + mã đơn sẽ được tự động kích hoạt bảo hành.
        </p>

        <div style={{ background: 'var(--paper)', border: '1px solid var(--line)',
          borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Bước 1 — Lấy token</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Bấm nút dưới, đăng nhập admin OA và đồng ý cấp quyền. App tự lưu token (sống ~1 giờ).
            Có 2 OA thì làm lần lượt từng OA.
          </p>
          <a className="btn" style={{ width: 'auto', padding: '10px 20px', textDecoration: 'none',
            display: 'inline-block' }}
            href={`/api/oauth-start?key=${encodeURIComponent(getKey())}`} target="_blank" rel="noreferrer">
            Lấy token qua Zalo →
          </a>
        </div>

        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>Bước 2 — Kéo lịch sử</div>
        <div className="field">
          <label>Access token (để trống sẽ dùng token vừa lấy ở Bước 1)</label>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="Tùy chọn — dán token nếu muốn dùng token riêng" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>OA ID (để gắn nhãn, không bắt buộc)</label>
            <input value={oaId} onChange={(e) => setOaId(e.target.value)} placeholder="VD: 579..." />
          </div>
          <div className="field" style={{ width: 160 }}>
            <label>Số hội thoại tối đa</label>
            <input type="number" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
        </div>

        <button className="btn" style={{ marginTop: 6 }} onClick={run} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Kéo lịch sử về'}
        </button>

        {err && <div className="notice" style={{ marginTop: 16 }}>{err}</div>}
      </div>

      {result && (
        <div className="panel" style={{ padding: 24 }}>
          <div className="stats" style={{ marginBottom: result.log?.length ? 20 : 0 }}>
            <div className="stat"><div className="num">{result.scannedUsers}</div><div className="lbl">Hội thoại quét</div></div>
            <div className="stat"><div className="num">{result.savedMessages}</div><div className="lbl">Tin đã lưu</div></div>
            <div className="stat hot"><div className="num">{result.activated}</div><div className="lbl">Bảo hành kích hoạt</div></div>
          </div>
          {result.log?.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.8 }}>
              {result.log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      )}
    </>
  )
}
