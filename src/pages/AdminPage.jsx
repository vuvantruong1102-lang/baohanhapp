import { useState } from 'react'

// Parser CSV gọn nhẹ (hỗ trợ dấu phẩy, có header).
function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (!lines.length) return []
  const headers = splitLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = splitLine(line)
    const obj = {}
    headers.forEach((h, i) => (obj[h.trim()] = (cells[i] || '').trim()))
    return obj
  })
}
function splitLine(line) {
  const out = []; let cur = ''; let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur); return out
}

export default function AdminPage() {
  const [brand, setBrand] = useState('tamayoko')
  const [platform, setPlatform] = useState('shopee')
  const [adminKey, setAdminKey] = useState('')
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  function onFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => { setRows(parseCSV(reader.result)); setMsg('') }
    reader.readAsText(f, 'utf-8')
  }

  async function doImport() {
    setMsg(''); setLoading(true)
    try {
      const r = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, platform, rows, adminKey }),
      })
      const data = await r.json()
      setMsg(data.error ? '✕ ' + data.error : `✓ Đã import ${data.imported} đơn hàng.`)
    } catch { setMsg('✕ Lỗi kết nối.') }
    setLoading(false)
  }

  return (
    <div className="wrap-wide">
      <div className="topbar">
        <div className="brand-mark"><span className="brand-dot" />Quản trị · Import đơn hàng</div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label>Brand</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}
              style={selectStyle}>
              <option value="tamayoko">Tamayoko</option>
              <option value="yokool">Yokool</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
            <label>Sàn</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              style={selectStyle}>
              <option value="shopee">Shopee</option>
              <option value="tiktok">TikTok</option>
              <option value="other">Khác</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Mã quản trị (ADMIN_KEY)</label>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
        </div>

        <div className="field">
          <label>File CSV đơn hàng</label>
          <input type="file" accept=".csv" onChange={onFile} />
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
          Cột nhận dạng được: <code>order_code / Mã đơn</code>, <code>phone / Số điện thoại</code>,
          {' '}<code>product / Sản phẩm</code>, <code>quantity / Số lượng</code>,
          {' '}<code>price / Giá</code>, <code>purchase_date / Ngày mua</code>, <code>Tên khách</code>.
        </p>

        {rows.length > 0 && (
          <>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              <strong>{fileName}</strong> — xem trước {Math.min(rows.length, 5)}/{rows.length} dòng:
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>{Object.keys(rows[0]).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>{Object.keys(rows[0]).map((h) => <td key={h}>{r[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <button className="btn" style={{ marginTop: 18 }} onClick={doImport}
          disabled={loading || rows.length === 0 || !adminKey}>
          {loading ? <span className="spinner" /> : `Import ${rows.length} đơn`}
        </button>

        {msg && <div className="notice" style={{ marginTop: 16 }}>{msg}</div>}
      </div>
    </div>
  )
}

const selectStyle = {
  width: '100%', padding: '14px 16px', fontSize: 16, fontFamily: 'inherit',
  border: '1px solid var(--line)', borderRadius: 12, background: 'var(--paper)',
}
