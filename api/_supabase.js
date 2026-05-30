import { createClient } from '@supabase/supabase-js'

// CHỈ dùng trong serverless function. service_role bypass RLS.
// Các biến này đặt trong Vercel → Settings → Environment Variables.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}
