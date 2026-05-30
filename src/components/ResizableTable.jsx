import { useState, useRef, useCallback } from 'react'

// Bảng với cột kéo-thả điều chỉnh độ rộng.
// columns: [{ key, label, width, render?(row) }]
export default function ResizableTable({ columns, rows, emptyText = 'Không có dữ liệu' }) {
  const [widths, setWidths] = useState(() => columns.map((c) => c.width || 140))
  const dragRef = useRef(null)

  const onMouseDown = useCallback((idx, e) => {
    e.preventDefault()
    dragRef.current = { idx, startX: e.clientX, startW: widths[idx] }
    const onMove = (ev) => {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      const next = Math.max(60, dragRef.current.startW + delta)
      setWidths((w) => { const c = [...w]; c[dragRef.current.idx] = next; return c })
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
  }, [widths])

  return (
    <div className="rtbl-scroll">
      <table className="rtbl" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
        <colgroup>
          {columns.map((c, i) => <col key={c.key} style={{ width: widths[i] }} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} style={{ width: widths[i] }}>
                <span className="th-label">{c.label}</span>
                {i < columns.length - 1 && (
                  <span className="col-resizer" onMouseDown={(e) => onMouseDown(i, e)} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="rtbl-empty">{emptyText}</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={row.id ?? ri}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
