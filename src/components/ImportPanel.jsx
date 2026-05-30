import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { adminCall } from '../lib/adminApi.js'
import { parseShopee, parseTiktok, isTiktokDescriptionRow, dedupeByOrder } from '../lib/parsers.js'

export default function ImportPanel() {
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState('')
  const shopeeRef = useRef(null)
  const tiktokRef = useRef(null)

  async function readWorkbook(file) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })
  }

  async function handleShopee(e) {
    const file = e.target.files[0]; if (!file) return
    setBusy('shopee'); setMsg(null)
    try {
      const raw = await readWorkbook(file)
      const records = dedupeByOrder(parseShopee(raw))
      await push(records, 'shopee', 'Shopee')
    } catch (err) { setMsg({ type: 'err', text: 'Lỗi đọc file Shopee: ' + err.message }) }
    setBusy(''); if (shopeeRef.current) shopeeRef.current.value = ''
  }

  async function handleTiktok(e) {
    const file = e.target.files[0]; if (!file) return
    setBusy('tiktok'); setMsg(null)
    try {
      const raw = await readWorkbook(file)
      const cleaned = raw.filter((r) => !isTiktokDescriptionRow(r['Order ID']))
      const records = dedupeByOrder(parseTiktok(cleaned))
      await push(records, 'tiktokshop', 'TikTokShop')
    } catch (err) { setMsg({ type: 'err', text: 'Lỗi đọc file TikTokShop: ' + err.message }) }
    setBusy(''); if (tiktokRef.current) tiktokRef.current.value = ''
  }

  async function push(records, platform, label) {
    if (!records.length) {
      setMsg({ type: 'err', text: 'Không tìm thấy đơn hợp lệ trong file. Kiểm tra lại file export.' })
      return
    }
    const rows = records.map((r) => ({
      order_code: r.order_code, product: r.product,
      quantity: r.quantity, price: r.price, purchase_date: r.purchase_date,
    }))
    const res = await adminCall('importOrders', { platform, rows })
    setMsg({ type: 'ok', text: `✓ ${label}: đã import ${res.imported}/${records.length} đơn.` })
  }

  return (
    <>
      <div className="import-grid">
        <div className="import-card shopee">
          <div className="pf">Shopee</div>
          <div className="desc">File export "Order_all_….xlsx"</div>
          <label className="drop">
            <div className="big">🛒</div>
            <div className="sm">{busy === 'shopee' ? 'Đang xử lý...' : 'Bấm để chọn file Shopee'}</div>
            <input ref={shopeeRef} type="file" accept=".xlsx,.xls" hidden
              onChange={handleShopee} disabled={busy} />
          </label>
        </div>

        <div className="import-card tiktok">
          <div className="pf">TikTokShop</div>
          <div className="desc">File export "Tất cả đơn hàng….xlsx"</div>
          <label className="drop">
            <div className="big">🎵</div>
            <div className="sm">{busy === 'tiktok' ? 'Đang xử lý...' : 'Bấm để chọn file TikTokShop'}</div>
            <input ref={tiktokRef} type="file" accept=".xlsx,.xls" hidden
              onChange={handleTiktok} disabled={busy} />
          </label>
        </div>
      </div>

      {msg && (
        <div className="notice" style={{
          marginTop: 18,
          background: msg.type === 'ok' ? '#e7f5ee' : 'var(--accent-soft)',
          color: msg.type === 'ok' ? 'var(--ok)' : 'var(--accent-dark)',
        }}>{msg.text}</div>
      )}

      <div className="panel" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--ink)' }}>Lưu ý:</strong> File export từ Shopee và TikTokShop
          đều <em>che số điện thoại</em> khách, nên hệ thống dùng <strong>mã đơn hàng</strong> làm khóa
          tra cứu. Số điện thoại thật được lấy khi khách tự kích hoạt bảo hành. Import lại cùng file
          sẽ không tạo đơn trùng. Đơn nhiều sản phẩm được gộp thành một đơn.
        </div>
      </div>
    </>
  )
}
