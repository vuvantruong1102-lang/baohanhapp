import { supabaseAdmin } from './_supabase.js'

// Một endpoint admin gộp nhiều action, bảo vệ bằng ADMIN_KEY (gửi qua header).
// POST /api/admin  { action, ...params }   header: x-admin-key
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Xác thực
  const key = req.headers['x-admin-key']
  if (!key || key !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: 'Sai mã quản trị.' })

  const { action } = req.body || {}
  const db = supabaseAdmin()

  try {
    switch (action) {
      case 'login':
        // chỉ cần qua được check key ở trên là hợp lệ
        return res.status(200).json({ ok: true })

      case 'stats': {
        const [orders, warranties, customers, threads] = await Promise.all([
          db.from('wrt_orders').select('id', { count: 'exact', head: true }),
          db.from('wrt_warranties').select('id', { count: 'exact', head: true }),
          db.from('wrt_customers').select('id', { count: 'exact', head: true }),
          db.from('wrt_zalo_threads').select('unread'),
        ])
        const unread = (threads.data || []).reduce((s, t) => s + (t.unread || 0), 0)
        return res.status(200).json({
          orders: orders.count || 0,
          warranties: warranties.count || 0,
          customers: customers.count || 0,
          unread,
        })
      }

      case 'orders': {
        const { brand, search } = req.body
        let q = db.from('wrt_orders').select('*').order('imported_at', { ascending: false }).limit(200)
        if (brand) q = q.eq('brand', brand)
        if (search) q = q.or(`order_code.ilike.%${search}%,phone.ilike.%${search}%`)
        const { data, error } = await q
        if (error) throw error
        return res.status(200).json({ rows: data })
      }

      case 'warranties': {
        const { brand, search } = req.body
        let q = db.from('wrt_warranties').select('*').order('activated_at', { ascending: false }).limit(200)
        if (brand) q = q.eq('brand', brand)
        if (search) q = q.or(`order_code.ilike.%${search}%,phone.ilike.%${search}%`)
        const { data, error } = await q
        if (error) throw error
        return res.status(200).json({ rows: data })
      }

      case 'customers': {
        const { search } = req.body
        let q = db.from('wrt_customers').select('*').order('last_active_at', { ascending: false }).limit(200)
        if (search) q = q.or(`phone.ilike.%${search}%,name.ilike.%${search}%`)
        const { data, error } = await q
        if (error) throw error
        return res.status(200).json({ rows: data })
      }

      case 'threads': {
        const { data, error } = await db.from('wrt_zalo_threads')
          .select('*').order('last_message_at', { ascending: false }).limit(100)
        if (error) throw error
        return res.status(200).json({ rows: data })
      }

      case 'messages': {
        const { zaloUserId } = req.body
        const { data, error } = await db.from('wrt_messages')
          .select('*').eq('zalo_user_id', zaloUserId).order('created_at', { ascending: true }).limit(500)
        if (error) throw error
        // đánh dấu đã đọc
        await db.from('wrt_zalo_threads').update({ unread: 0 }).eq('zalo_user_id', zaloUserId)
        return res.status(200).json({ rows: data })
      }

      case 'reply': {
        const { zaloUserId, text } = req.body
        if (!zaloUserId || !text) return res.status(400).json({ error: 'Thiếu nội dung.' })
        if (!process.env.ZALO_ACCESS_TOKEN)
          return res.status(400).json({ error: 'Chưa cấu hình ZALO_ACCESS_TOKEN.' })

        const zr = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', access_token: process.env.ZALO_ACCESS_TOKEN },
          body: JSON.stringify({ recipient: { user_id: zaloUserId }, message: { text } }),
        })
        const zdata = await zr.json()
        if (zdata.error && zdata.error !== 0)
          return res.status(400).json({ error: 'Zalo: ' + (zdata.message || 'gửi thất bại') })

        // lưu tin OA gửi
        await db.from('wrt_messages').insert({ zalo_user_id: zaloUserId, direction: 'out', text })
        await db.from('wrt_zalo_threads').update({
          last_message: text, last_message_at: new Date().toISOString(), unread: 0,
        }).eq('zalo_user_id', zaloUserId)

        return res.status(200).json({ ok: true })
      }

      default:
        return res.status(400).json({ error: 'Action không hợp lệ.' })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
