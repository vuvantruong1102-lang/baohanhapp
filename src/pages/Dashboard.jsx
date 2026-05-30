import { useState, useEffect } from 'react'
import { adminCall, getKey, setKey, clearKey } from '../lib/adminApi.js'
import { platformLabel, sourceLabel } from '../lib/site.js'
import ZaloInbox from '../components/ZaloInbox.jsx'
import ImportPanel from '../components/ImportPanel.jsx'
import ResizableTable from '../components/ResizableTable.jsx'
import '../admin.css'

const fmtPrice = (n) => (n == null ? '—' : Number(n).toLocaleString('vi-VN') + 'đ')
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

const NAV = [
  { key: 'overview', label: 'Tổng quan', icon: '◳' },
  { key: 'import', label: 'Import đơn', icon: '↥' },
  { key: 'orders', label: 'Đơn hàng', icon: '▤' },
  { key: 'warranties', label: 'Bảo hành', icon: '✓' },
  { key: 'customers', label: 'Khách hàng', icon: '☺' },
  { key: 'inbox', label: 'Tin nhắn Zalo', icon: '✉', badge: 'unread' },
]
const TITLES = {
  overview: 'Tổng quan', import: 'Import đơn hàng', orders: 'Đơn hàng',
  warranties: 'Bảo hành đã kích hoạt', customers: 'Khách hàng', inbox: 'Tin nhắn Zalo OA',
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(!!getKey())
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)

  async function refreshStats() {
    try { setStats(await adminCall('stats')) } catch { /* ignore */ }
  }
  useEffect(() => { if (authed) refreshStats() }, [authed, tab])

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
          <button className="logout" onClick={() => { clearKey(); setAuthed(false) }}>Đăng xuất</button>
        </div>
      </aside>

      <main className="admin-main">
        <h1 className="page-title">{TITLES[tab]}</h1>
        {tab === 'overview' && <Overview stats={stats} onGo={setTab} />}
        {tab === 'import' && <ImportPanel />}
        {tab === 'orders' && <OrdersView />}
        {tab === 'warranties' && <WarrantiesView />}
        {tab === 'customers' && <CustomersView />}
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

function Overview({ stats, onGo }) {
  return (
    <>
      <div className="stats">
        <div className="stat"><div className="num">{stats?.orders ?? '—'}</div><div className="lbl">Đơn đã import</div></div>
        <div className="stat"><div className="num">{stats?.warranties ?? '—'}</div><div className="lbl">Bảo hành đã kích hoạt</div></div>
        <div className="stat"><div className="num">{stats?.customers ?? '—'}</div><div className="lbl">Khách hàng</div></div>
        <div className="stat hot"><div className="num">{stats?.unread ?? '—'}</div><div className="lbl">Tin Zalo chưa đọc</div></div>
      </div>
      <div className="panel" style={{ padding: 24 }}>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          Trung tâm quản trị bảo hành. Import đơn hàng từ Shopee/TikTokShop, sau đó khách
          tra cứu &amp; kích hoạt bảo hành qua web hoặc Zalo. Đơn mua ngoài sàn (nguồn "Khác")
          khách kích hoạt bằng số điện thoại và ngày mua.
        </p>
        <button className="btn" style={{ width: 'auto', padding: '11px 22px' }}
          onClick={() => onGo('import')}>↥ Import đơn hàng ngay</button>
      </div>
    </>
  )
}

// ===== Hook dùng chung tải dữ liệu =====
function useData(action) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  async function load() {
    setLoading(true); setErr('')
    try { const { rows } = await adminCall(action, { search }); setRows(rows) }
    catch (e) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  return { rows, search, setSearch, loading, err, load }
}

function Toolbar({ search, setSearch, load, loading, placeholder }) {
  return (
    <div className="toolbar">
      <input placeholder={placeholder} value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && load()} />
      <button className="btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={load} disabled={loading}>
        {loading ? <span className="spinner" /> : 'Tìm'}</button>
    </div>
  )
}

function OrdersView() {
  const d = useData('orders')
  const columns = [
    { key: 'order_code', label: 'Mã đơn', width: 170 },
    { key: 'platform', label: 'Sàn', width: 120, render: (r) => platformLabel(r.platform) },
    { key: 'product', label: 'Sản phẩm', width: 320 },
    { key: 'quantity', label: 'SL', width: 70 },
    { key: 'price', label: 'Giá sản phẩm', width: 140, render: (r) => fmtPrice(r.price) },
    { key: 'purchase_date', label: 'Ngày đặt hàng', width: 140, render: (r) => fmtDate(r.purchase_date) },
  ]
  return (
    <>
      <Toolbar {...d} placeholder="Tìm theo mã đơn / sản phẩm..." />
      {d.err && <div className="notice" style={{ marginBottom: 14 }}>{d.err}</div>}
      <ResizableTable columns={columns} rows={d.rows} emptyText="Chưa có đơn hàng. Hãy import từ tab Import đơn." />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10 }}>
        {d.rows.length} đơn · kéo viền cột để chỉnh độ rộng</p>
    </>
  )
}

function WarrantiesView() {
  const d = useData('warranties')
  const columns = [
    { key: 'warranty_code', label: 'Mã bảo hành', width: 180 },
    { key: 'source', label: 'Nguồn', width: 110, render: (r) => sourceLabel(r.source) },
    { key: 'product', label: 'Sản phẩm', width: 300 },
    { key: 'phone', label: 'SĐT', width: 130 },
    { key: 'activated_at', label: 'Ngày kích hoạt', width: 140, render: (r) => fmtDate(r.activated_at) },
    { key: 'expires_at', label: 'Hết hạn', width: 120, render: (r) => fmtDate(r.expires_at) },
    { key: 'channel', label: 'Kênh', width: 90 },
    { key: 'status', label: 'Trạng thái', width: 120,
      render: (r) => <span className={'tag ' + (r.status === 'active' ? 'active' : 'expired')}>{r.status}</span> },
  ]
  return (
    <>
      <Toolbar {...d} placeholder="Tìm theo mã bảo hành / SĐT..." />
      {d.err && <div className="notice" style={{ marginBottom: 14 }}>{d.err}</div>}
      <ResizableTable columns={columns} rows={d.rows} emptyText="Chưa có bảo hành nào được kích hoạt." />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10 }}>
        {d.rows.length} bản ghi · kéo viền cột để chỉnh độ rộng</p>
    </>
  )
}

function CustomersView() {
  const d = useData('customers')
  const columns = [
    { key: 'phone', label: 'SĐT', width: 140 },
    { key: 'name', label: 'Tên', width: 180 },
    { key: 'zalo_user_id', label: 'Zalo', width: 90, render: (r) => (r.zalo_user_id ? '✓' : '—') },
    { key: 'consent_at', label: 'Đồng ý DL', width: 130, render: (r) => (r.consent_at ? fmtDate(r.consent_at) : '—') },
    { key: 'last_active_at', label: 'Hoạt động cuối', width: 150, render: (r) => fmtDate(r.last_active_at) },
  ]
  return (
    <>
      <Toolbar {...d} placeholder="Tìm theo SĐT / tên..." />
      {d.err && <div className="notice" style={{ marginBottom: 14 }}>{d.err}</div>}
      <ResizableTable columns={columns} rows={d.rows} emptyText="Chưa có khách hàng." />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10 }}>
        {d.rows.length} khách · kéo viền cột để chỉnh độ rộng</p>
    </>
  )
}
