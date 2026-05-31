import crypto from 'crypto'
import { supabaseAdmin } from './_supabase.js'

// GET /api/oauth-start?key=ADMIN_KEY
// Tạo code_verifier + code_challenge (PKCE), lưu DB, trả về link cấp quyền Zalo.
// Mở link đó, đăng nhập admin OA, đồng ý → Zalo redirect về /api/oauth-callback.

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default async function handler(req, res) {
  // cho phép mở bằng trình duyệt: nhận key qua query
  const key = req.query?.key || req.headers['x-admin-key']
  if (key !== process.env.ADMIN_KEY) return res.status(401).send('Sai mã quản trị.')

  const appId = process.env.ZALO_APP_ID
  const selfUrl = process.env.SELF_URL
  if (!appId || !selfUrl) return res.status(400).send('Thiếu ZALO_APP_ID hoặc SELF_URL.')

  // PKCE: code_verifier ngẫu nhiên, code_challenge = base64url(sha256(verifier))
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())
  const state = base64url(crypto.randomBytes(12))

  const db = supabaseAdmin()
  await db.from('wrt_zalo_tokens').insert({ code_verifier: codeVerifier, state })

  const redirectUri = `${selfUrl}/api/oauth-callback`
  const url = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge=${codeChallenge}&state=${state}`

  // Trả trang HTML nhỏ có nút bấm sang Zalo
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cấp quyền Zalo OA</title>
<style>body{font-family:system-ui,sans-serif;background:#faf8f6;color:#1a1a1d;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.box{background:#fff;border:1px solid #efeae6;border-radius:18px;padding:36px;max-width:440px;
box-shadow:0 12px 40px -12px rgba(0,0,0,.12);text-align:center}
h1{font-size:20px;margin:0 0 10px}p{color:#8a8589;font-size:14px;line-height:1.6}
a.btn{display:inline-block;margin-top:18px;background:#c20e35;color:#fff;text-decoration:none;
padding:13px 26px;border-radius:12px;font-weight:600}</style></head>
<body><div class="box"><h1>Cấp quyền Zalo OA</h1>
<p>Bấm nút dưới, đăng nhập tài khoản <b>admin của OA</b> bạn muốn lấy token,
rồi đồng ý cấp quyền. Sau đó app sẽ tự lấy access token.</p>
<a class="btn" href="${url}">Tiếp tục với Zalo →</a>
<p style="margin-top:18px;font-size:12px">Có 2 OA thì làm lần lượt từng OA.</p>
</div></body></html>`)
}
