import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { adminCall } from '../lib/adminApi.js'
import { parseShopee, parseTiktok, dedupeByOrder, detectFileType } from '../lib/parsers.js'

export default function ImportPanel({ onImported }) {
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState('')
  const shopeeRef = useRef(null)
  const tiktokRef = useRef(null)

  async function readWorkbook(file) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    // đọc theo mảng (header:1) để parser map theo index cột
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false })
  }

  async function handleShopee(e) {
    const file = e.target.files[0]; if (!file) return
    setBusy('shopee'); setMsg(null)
    try {
      const aoa = await readWorkbook(file)
      const kind = detectFileType(aoa)
      if (kind === 'tiktok') {
        setMsg({ type: 'err', text: 'File này có vẻ là file TikTokShop. Bạn đang bấm nút Shopee — vui lòng dùng nút "Nhập đơn TikTokShop".' })
        setBusy(''); if (shopeeRef.current) shopeeRef.current.value = ''; return
      }
      const records = dedupeByOrder(parseShopee(aoa))
      await push(records, 'shopee', 'Shopee')
    } catch (err) { setMsg({ type: 'err', text: 'Lỗi đọc file Shopee: ' + err.message }) }
    setBusy(''); if (shopeeRef.current) shopeeRef.current.value = ''
  }

  async function handleTiktok(e) {
    const file = e.target.files[0]; if (!file) return
    setBusy('tiktok'); setMsg(null)
    try {
      const aoa = await readWorkbook(file)
      const kind = detectFileType(aoa)
      if (kind === 'shopee') {
        setMsg({ type: 'err', text: 'File này có vẻ là file Shopee. Bạn đang bấm nút TikTokShop — vui lòng dùng nút "Nhập đơn Shopee".' })
        setBusy(''); if (tiktokRef.current) tiktokRef.current.value = ''; return
      }
      const records = dedupeByOrder(parseTiktok(aoa))
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
      order_code: r.order_code, product: r.product, buyer: r.buyer,
      quantity: r.quantity, price: r.price, purchase_date: r.purchase_date,
      order_status: r.order_status,
    }))
    const res = await adminCall('importOrders', { platform, rows })
    setMsg({ type: 'ok', text: `✓ ${label}: đã import ${res.imported}/${records.length} đơn.` })
    if (onImported) onImported()
  }

  return (
    <div className="import-bar">
      <div className="import-actions">
        <label className="imp-btn shopee">
          <span className="ic">🛒</span>
          {busy === 'shopee' ? 'Đang xử lý…' : 'Nhập đơn Shopee'}
          <input ref={shopeeRef} type="file" accept=".xlsx,.xls" hidden
            onChange={handleShopee} disabled={busy} />
        </label>
        <label className="imp-btn tiktok">
          <span className="ic">🎵</span>
          {busy === 'tiktok' ? 'Đang xử lý…' : 'Nhập đơn TikTokShop'}
          <input ref={tiktokRef} type="file" accept=".xlsx,.xls" hidden
            onChange={handleTiktok} disabled={busy} />
        </label>
        <span className="imp-hint">
          File export gốc từ sàn · dùng mã đơn làm khóa · import lại không tạo trùng
        </span>
      </div>

      {msg && (
        <div className="notice" style={{
          marginTop: 14,
          background: msg.type === 'ok' ? '#e7f5ee' : 'var(--accent-soft)',
          color: msg.type === 'ok' ? 'var(--ok)' : 'var(--accent-dark)',
        }}>{msg.text}</div>
      )}
    </div>
  )
}
