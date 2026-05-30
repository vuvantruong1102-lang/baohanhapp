// Gọi API admin. Key lưu trong sessionStorage (mất khi đóng tab — an toàn hơn).
const KEY_NAME = 'wrt_admin_key'

export function getKey() {
  return sessionStorage.getItem(KEY_NAME) || ''
}
export function setKey(k) {
  sessionStorage.setItem(KEY_NAME, k)
}
export function clearKey() {
  sessionStorage.removeItem(KEY_NAME)
}

export async function adminCall(action, params = {}) {
  const r = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': getKey() },
    body: JSON.stringify({ action, ...params }),
  })
  const data = await r.json()
  if (r.status === 401) { clearKey(); throw new Error('UNAUTHORIZED') }
  if (data.error) throw new Error(data.error)
  return data
}
