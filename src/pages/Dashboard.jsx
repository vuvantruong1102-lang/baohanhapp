import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { adminCall, getKey, setKey, clearKey } from '../lib/adminApi.js'
import { platformLabel, sourceLabel } from '../lib/site.js'
import ZaloInbox from '../components/ZaloInbox.jsx'
import ImportPanel from '../components/ImportPanel.jsx'
import ResizableTable from '../components/ResizableTable.jsx'
import '../admin.css'

const fmtPrice = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + 'đ')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

// Xuất mảng object ra file Excel
function rowsToSheet(rows, columns, filename) {
  const data = rows.map((r) => {
    const o = {}
    columns.forEach((c) => { o[c.label] = c.raw ? c.raw(r) : (r[c.key] ?? '') })
    return o
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, filename)
}

// Kéo TOÀN BỘ dữ liệu (theo từ khoá tìm hiện tại) rồi xuất Excel.
// Phân trang theo từng mẻ để chắc chắn lấy hết, không phụ thuộc số dòng đang xem.
async function exportAll(action, search, columns, filename) {
  const BATCH = 1000
  let offset = 0, all = []
  while (true) {
    const { rows } = await adminCall(action, { search, offset, limit: BATCH })
    if (!rows || rows.length === 0) break
    all = all.concat(rows)
    if (rows.length < BATCH) break
    offset += BATCH
    if (all.length >= 100000) break // chặn an toàn
  }
  if (!all.length) { alert('Không có dữ liệu để xuất.'); return }
  rowsToSheet(all, columns, filename)
}

const NAV = [
  { key: 'orders', label: 'Đơn hàng', icon: '▤' },
  { key: 'warranties', label: 'Bảo hành', icon: '✓' },
  { key: 'inbox', label: 'Tin nhắn Zalo', icon: '✉', badge: 'unread' },
]
const TITLES = {
  orders: 'Đơn hàng', warranties: 'Bảo hành đã kích hoạt', inbox: 'Tin nhắn Zalo OA',
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(!!getKey())
  const [tab, setTab] = useState('orders')
  const [stats, setStats] = useState(null)
  const [backing, setBacking] = useState(false)

  async function refreshStats() {
    try { setStats(await adminCall('stats')) } catch { /* ignore */ }
  }
  useEffect(() => { if (authed) refreshStats() }, [authed, tab])

  // Lưu trữ toàn bộ dữ liệu ra file JSON
  async function backupJSON() {
    setBacking(true)
    try {
      const [orders, warranties, customers] = await Promise.all([
        adminCall('orders', { offset: 0, limit: 100000 }),
        adminCall('warranties', { offset: 0, limit: 100000 }),
        adminCall('customers', { offset: 0, limit: 100000 }),
      ])
      const dump = {
        exported_at: new Date().toISOString(),
        orders: orders.rows || [],
        warranties: warranties.rows || [],
        customers: customers.rows || [],
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sao-luu-bao-hanh-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Lỗi sao lưu: ' + e.message) }
    setBacking(false)
  }

  if (!authed) return <Login onOk={() => setAuthed(true)} />

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="logo"><span className="brand-dot" />Quản trị bảo hành</div>
        <nav>
          {NAV.map((n) => (
            <button key={n.key} className={tab === n.key ? 'active' : ''} onClick={() => setTab(n.key)}>
              <span className="ico">{n.icon}</span>{n.label}
              {n.badge === 'unread' && stats?.unread > 0 && <span className="pill">{stats.unread}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="backup-btn" onClick={backupJSON} disabled={backing}>
            {backing ? <span className="spinner" /> : <><span className="ico">⇩</span>Lưu trữ dữ liệu</>}
          </button>
          <button className="logout" onClick={() => { clearKey(); setAuthed(false) }}>Đăng xuất</button>
        </div>
      </aside>

      <main className="admin-main">
        <h1 className="page-title">{TITLES[tab]}</h1>
        {tab === 'orders' && <OrdersView onStats={refreshStats} />}
        {tab === 'warranties' && <WarrantiesView />}
        {tab === 'inbox' && <ZaloInbox />}
      </main>
    </div>
  )
}

function Login({ onOk }) {
  const [val, setVal] = useState(''); const [err, setErr] = useState(''); const [loading, setLoading] = useState(false)
  async function submit() {
    setErr(''); setLoading(true); setKey(val)
    try { await adminCall('login'); onOk() }
    catch (e) { clearKey(); setErr(e.message === 'UNAUTHORIZED' ? 'Sai mã quản trị.' : e.message) }
    setLoading(false)
  }
  return (
    <div className="wrap login-box">
      <div className="card">
        <div className="brand-mark" style={{ marginBottom: 18 }}><span className="brand-dot" />Đăng nhập quản trị</div>
        <div className="field"><label>Mã quản trị (ADMIN_KEY)</label>
          <input type="password" value={val} autoFocus onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
        <button className="btn" onClick={submit} disabled={loading || !val}>
          {loading ? <span className="spinner" /> : 'Vào quản trị'}</button>
        {err && <div className="notice" style={{ marginTop: 14 }}>{err}</div>}
      </div>
    </div>
  )
}

// ===== Hook dùng chung tải dữ liệu (có phân trang) =====
const PAGE = 100
function useData(action) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function load(reset = true) {
    setLoading(true); setErr('')
    try {
      const offset = reset ? 0 : rows.length
      const { rows: r, total } = await adminCall(action, { search, offset, limit: PAGE })
      setRows(reset ? r : [...rows, ...r])
      setTotal(total ?? r.length)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { load(true) }, [])
  return { rows, total, search, setSearch, loading, err, load,
    loadMore: () => load(false), hasMore: rows.length < total }
}

function Toolbar({ search, setSearch, load, loading, placeholder }) {
  return (
    <div className="toolbar">
      <input placeholder={placeholder} value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && load(true)} />
      <button className="btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => load(true)} disabled={loading}>
        {loading ? <span className="spinner" /> : 'Tìm'}</button>
    </div>
  )
}

function Footer({ d, unit }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
        Hiển thị {d.rows.length}/{d.total} {unit} · kéo viền cột để chỉnh độ rộng
      </span>
      {d.hasMore && (
        <button className="btn btn-ghost" style={{ width: 'auto', padding: '8px 18px' }}
          onClick={d.loadMore} disabled={d.loading}>
          {d.loading ? <span className="spinner" /> : 'Tải thêm'}
        </button>
      )}
    </div>
  )
}

function ExportButton({ action, search, columns, filename }) {
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try { await exportAll(action, search, columns, filename) }
    catch (e) { alert('Lỗi xuất Excel: ' + e.message) }
    setBusy(false)
  }
  return (
    <button className="btn btn-ghost export-btn" onClick={run} disabled={busy}>
      {busy ? <span className="spinner" /> : '⇩ Xuất Excel'}
    </button>
  )
}

function OrdersView({ onStats }) {
  const d = useData('orders')
  const columns = [
    { key: 'order_code', label: 'Mã đơn', width: 170 },
    { key: 'platform', label: 'Sàn', width: 110, render: (r) => platformLabel(r.platform), raw: (r) => platformLabel(r.platform) },
    { key: 'buyer', label: 'Người mua', width: 150 },
    { key: 'product', label: 'Sản phẩm', width: 300 },
    { key: 'quantity', label: 'SL', width: 60 },
    { key: 'price', label: 'Giá sản phẩm', width: 130, render: (r) => fmtPrice(r.price), raw: (r) => r.price ?? '' },
    { key: 'purchase_date', label: 'Ngày đặt hàng', width: 140, render: (r) => fmtDate(r.purchase_date), raw: (r) => r.purchase_date ?? '' },
    { key: 'order_status', label: 'Trạng thái', width: 150,
      render: (r) => (r.order_status ? <span className="tag neutral">{r.order_status}</span> : '—'),
      raw: (r) => r.order_status ?? '' },
  ]
  return (
    <>
      <ImportPanel onImported={() => { d.load(true); onStats && onStats() }} />
      <div className="list-head">
        <Toolbar {...d} placeholder="Tìm theo mã đơn / sản phẩm / người mua..." />
        <ExportButton action="orders" search={d.search} columns={columns} filename="don-hang.xlsx" />
      </div>
      {d.err && <div className="notice" style={{ marginBottom: 14 }}>{d.err}</div>}
      <ResizableTable columns={columns} rows={d.rows} emptyText="Chưa có đơn hàng. Hãy import ở khung phía trên." />
      <Footer d={d} unit="đơn" />
    </>
  )
}

function WarrantiesView() {
  const d = useData('warranties')
  const columns = [
    { key: 'warranty_code', label: 'Mã bảo hành', width: 180 },
    { key: 'source', label: 'Nguồn', width: 110, render: (r) => sourceLabel(r.source), raw: (r) => sourceLabel(r.source) },
    { key: 'buyer', label: 'Người mua', width: 140 },
    { key: 'product', label: 'Sản phẩm', width: 280 },
    { key: 'phone', label: 'SĐT', width: 130 },
    { key: 'activated_at', label: 'Ngày kích hoạt', width: 140, render: (r) => fmtDate(r.activated_at), raw: (r) => r.activated_at ?? '' },
    { key: 'expires_at', label: 'Hết hạn', width: 120, render: (r) => fmtDate(r.expires_at), raw: (r) => r.expires_at ?? '' },
    { key: 'channel', label: 'Kênh', width: 90 },
    { key: 'status', label: 'Trạng thái', width: 120,
      render: (r) => <span className={'tag ' + (r.status === 'active' ? 'active' : 'expired')}>{r.status}</span>,
      raw: (r) => r.status },
  ]
  return (
    <>
      <div className="list-head">
        <Toolbar {...d} placeholder="Tìm theo mã bảo hành / SĐT..." />
        <ExportButton action="warranties" search={d.search} columns={columns} filename="bao-hanh.xlsx" />
      </div>
      {d.err && <div className="notice" style={{ marginBottom: 14 }}>{d.err}</div>}
      <ResizableTable columns={columns} rows={d.rows} emptyText="Chưa có bảo hành nào được kích hoạt." />
      <Footer d={d} unit="bản ghi" />
    </>
  )
}
