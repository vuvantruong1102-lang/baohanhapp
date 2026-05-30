import { useState, useEffect, useRef } from 'react'
import { adminCall } from '../lib/adminApi.js'

const initial = (s) => (s || '?').trim().charAt(0).toUpperCase()
const fmtTime = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

export default function ZaloInbox() {
  const [threads, setThreads] = useState([])
  const [active, setActive] = useState(null)      // zalo_user_id
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const bodyRef = useRef(null)

  async function loadThreads() {
    try {
      const { rows } = await adminCall('threads')
      setThreads(rows)
    } catch (e) { setErr(e.message) }
  }

  async function openThread(uid) {
    setActive(uid); setErr('')
    try {
      const { rows } = await adminCall('messages', { zaloUserId: uid })
      setMessages(rows)
      // reset unread cục bộ
      setThreads((ts) => ts.map((t) => (t.zalo_user_id === uid ? { ...t, unread: 0 } : t)))
    } catch (e) { setErr(e.message) }
  }

  async function send() {
    if (!draft.trim() || !active) return
    setSending(true); setErr('')
    const text = draft.trim()
    try {
      await adminCall('reply', { zaloUserId: active, text })
      setMessages((m) => [...m, { id: Date.now(), direction: 'out', text, created_at: new Date().toISOString() }])
      setDraft('')
      loadThreads()
    } catch (e) { setErr(e.message) }
    setSending(false)
  }

  useEffect(() => { loadThreads() }, [])
  // auto refresh danh sách mỗi 15s
  useEffect(() => {
    const id = setInterval(loadThreads, 15000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  const activeThread = threads.find((t) => t.zalo_user_id === active)

  return (
    <>
      {err && <div className="notice" style={{ marginBottom: 14 }}>{err}</div>}
      <div className="inbox">
        <div className="thread-list">
          {threads.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-soft)', fontSize: 14 }}>
              Chưa có hội thoại nào. Khi khách nhắn Zalo OA, tin sẽ hiện ở đây.
            </div>
          )}
          {threads.map((t) => (
            <div key={t.zalo_user_id}
              className={'thread' + (active === t.zalo_user_id ? ' active' : '')}
              onClick={() => openThread(t.zalo_user_id)}>
              <div className="av">{initial(t.display_name || t.zalo_user_id)}</div>
              <div className="meta">
                <div className="nm">{t.display_name || ('Khách ' + String(t.zalo_user_id).slice(-4))}</div>
                <div className="pre">{t.last_message}</div>
              </div>
              {t.unread > 0 && <span className="badge-unread">{t.unread}</span>}
            </div>
          ))}
        </div>

        <div className="chat">
          {!active ? (
            <div className="chat-empty">Chọn một hội thoại để xem tin nhắn</div>
          ) : (
            <>
              <div className="chat-head">
                {activeThread?.display_name || ('Khách ' + String(active).slice(-4))}
                <small>Zalo user ID: {active}</small>
              </div>
              <div className="chat-body" ref={bodyRef}>
                {messages.map((m) => (
                  <div key={m.id} className={'bubble ' + m.direction}>
                    {m.text}
                    <div className="t">{fmtTime(m.created_at)}</div>
                  </div>
                ))}
              </div>
              <div className="window-note">
                ⓘ Zalo chỉ cho phép gửi tin tự do trong vòng 48 giờ kể từ tin cuối của khách.
                Ngoài cửa sổ này cần dùng ZNS (tin có template).
              </div>
              <div className="chat-input">
                <input value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Nhập tin trả lời..." />
                <button onClick={send} disabled={sending || !draft.trim()}>
                  {sending ? '...' : 'Gửi'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
