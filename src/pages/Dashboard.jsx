import { useState, useEffect } from 'react'
import { adminCall, getKey, setKey, clearKey } from '../lib/adminApi.js'
import ZaloInbox from '../components/ZaloInbox.jsx'
import ImportPanel from '../components/ImportPanel.jsx'
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
        {tab === 'orders' && <DataTable kind="orders" />}
        {tab === 'warranties' && <DataTable kind="warranties" />}
        {tab === 'customers' && <DataTable kind="customers" />}
        {tab === 'inbox' && <ZaloInbox />}
      </main>
    </div>
  )
}

function Login({ onOk }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setErr(''); setLoading(true)
    setKey(val)
    try { await adminCall('login'); onOk() }
    catch (e) { clearKey(); setErr(e.message === 'UNAUTHORIZED' ? 'Sai mã quản trị.' : e.message) }
    setLoading(false)
  }

  return (
    <div className="wrap login-box">
      <div className="card">
        <div className="brand-mark" style={{ marginBottom: 18 }}>
          <span className="brand-dot" />Đăng nhập quản trị
        </div>
        <div className="field">
          <label>Mã quản trị (ADMIN_KEY)</label>
          <input type="password" value={val} autoFocus
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <button className="btn" onClick={submit} disabled={loading || !val}>
          {loading ? <span className="spinner" /> : 'Vào quản trị'}
        </button>
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
          Trung tâm quản trị bảo hành Tamayoko &amp; Yokool. Bắt đầu bằng việc import đơn hàng
          từ Shopee/TikTok, sau đó khách có thể tra cứu &amp; kích hoạt bảo hành qua web hoặc Zalo.
        </p>
        <button className="btn" style={{ width: 'auto', padding: '11px 22px' }}
          onClick={() => onGo('import')}>↥ Import đơn hàng ngay</button>
      </div>
    </>
  )
}

function DataTable({ kind }) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true); setErr('')
    try {
      const params = { search }
      if (kind !== 'customers') params.brand = brand || undefined
      const { rows } = await adminCall(kind, params)
      setRows(rows)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [kind])

  return (
    <>
      <div className="toolbar">
        <input placeholder="Tìm theo mã đơn / SĐT / tên..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} />
        {kind !== 'customers' && (
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Tất cả brand</option>
            <option value="tamayoko">Tamayoko</option>
            <option value="yokool">Yokool</option>
          </select>
        )}
        <button className="btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={load} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Lọc'}
        </button>
      </div>

      {err && <div className="notice" style={{ marginBottom: 14 }}>{err}</div>}

      <div className="panel">
        <div className="tbl-scroll">
          {kind === 'orders' && <OrdersTable rows={rows} />}
          {kind === 'warranties' && <WarrantiesTable rows={rows} />}
          {kind === 'customers' && <CustomersTable rows={rows} />}
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10 }}>{rows.length} bản ghi</p>
    </>
  )
}

function OrdersTable({ rows }) {
  return (
    <table>
      <thead><tr><th>Mã đơn</th><th>Brand</th><th>Sàn</th><th>Sản phẩm</th><th>SL</th><th>Giá</th><th>Ngày mua</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.order_code}</td><td>{r.brand}</td><td>{r.platform}</td>
            <td>{r.product || '—'}</td><td>{r.quantity}</td><td>{fmtPrice(r.price)}</td>
            <td>{fmtDate(r.purchase_date)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WarrantiesTable({ rows }) {
  return (
    <table>
      <thead><tr><th>Mã đơn</th><th>Brand</th><th>Sản phẩm</th><th>SĐT</th><th>Kích hoạt</th><th>Hết hạn</th><th>Kênh</th><th>Trạng thái</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.order_code}</td><td>{r.brand}</td><td>{r.product || '—'}</td>
            <td>{r.phone || '—'}</td><td>{fmtDate(r.activated_at)}</td><td>{fmtDate(r.expires_at)}</td>
            <td>{r.channel}</td>
            <td><span className={'tag ' + (r.status === 'active' ? 'active' : 'expired')}>{r.status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CustomersTable({ rows }) {
  return (
    <table>
      <thead><tr><th>SĐT</th><th>Tên</th><th>Brand</th><th>Zalo</th><th>Đồng ý DL</th><th>Hoạt động cuối</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.phone}</td><td>{r.name || '—'}</td><td>{r.brand || '—'}</td>
            <td>{r.zalo_user_id ? '✓' : '—'}</td><td>{r.consent_at ? fmtDate(r.consent_at) : '—'}</td>
            <td>{fmtDate(r.last_active_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
