import { supabaseAdmin } from './_supabase.js'

// GET /api/oauth-callback?oauth_code=...&code=...&state=...
// Zalo redirect về đây sau khi admin OA đồng ý. Đổi code lấy access_token.

export default async function handler(req, res) {
  const code = req.query?.oauth_code || req.query?.code
  const state = req.query?.state
  const oaId = req.query?.oa_id || null

  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  if (!code) return res.status(400).send(html('Lỗi', 'Không nhận được mã ủy quyền từ Zalo.'))

  try {
    const db = supabaseAdmin()
    // tìm code_verifier theo state
    let verifier = null, rowId = null
    if (state) {
      const { data } = await db.from('wrt_zalo_tokens')
        .select('id, code_verifier').eq('state', state).limit(1)
      if (data && data[0]) { verifier = data[0].code_verifier; rowId = data[0].id }
    }

    // đổi code lấy token
    const body = new URLSearchParams({
      code, app_id: process.env.ZALO_APP_ID, grant_type: 'authorization_code',
    })
    if (verifier) body.set('code_verifier', verifier)

    const r = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        secret_key: process.env.ZALO_OA_SECRET,
      },
      body: body.toString(),
    })
    const data = await r.json()

    if (!data.access_token) {
      return res.status(400).send(html('Lấy token thất bại',
        'Zalo trả về: ' + JSON.stringify(data)))
    }

    const expiresAt = data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
      : null

    // lưu token (cập nhật vào row state nếu có, không thì tạo mới)
    if (rowId) {
      await db.from('wrt_zalo_tokens').update({
        access_token: data.access_token, refresh_token: data.refresh_token || null,
        oa_id: oaId, expires_at: expiresAt, updated_at: new Date().toISOString(),
      }).eq('id', rowId)
    } else {
      await db.from('wrt_zalo_tokens').insert({
        access_token: data.access_token, refresh_token: data.refresh_token || null,
        oa_id: oaId, expires_at: expiresAt,
      })
    }

    return res.status(200).send(html('Thành công!',
      'Đã lấy được access token cho OA. Bạn có thể quay lại app, vào tab ' +
      '"Khôi phục Zalo" và bấm "Kéo lịch sử về" — app sẽ tự dùng token này. ' +
      'Token sống khoảng 1 giờ.'))
  } catch (e) {
    return res.status(500).send(html('Lỗi hệ thống', e.message))
  }
}

function html(title, msg) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#faf8f6;color:#1a1a1d;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.box{background:#fff;border:1px solid #efeae6;border-radius:18px;padding:36px;max-width:460px;
box-shadow:0 12px 40px -12px rgba(0,0,0,.12);text-align:center}
h1{font-size:20px;margin:0 0 12px;color:#c20e35}p{color:#555;font-size:14px;line-height:1.7}</style>
</head><body><div class="box"><h1>${title}</h1><p>${msg}</p></div></body></html>`
}
