# Webapp Bảo hành — Tamayoko & Yokool

Hệ thống kích hoạt & tra cứu bảo hành, dùng chung Supabase, deploy Vercel.
Hai brand chung một app, tách theo route: `/tamayoko` và `/yokool`.

## Kiến trúc

| Phần | Chạy ở đâu | File |
|---|---|---|
| Trang khách tra cứu/kích hoạt | Frontend tĩnh (Vercel) | `src/pages/WarrantyPage.jsx` |
| Trang admin import CSV | Frontend (Vercel) | `src/pages/AdminPage.jsx` |
| API tra cứu mã đơn | Serverless (Vercel) | `api/lookup.js` |
| API kích hoạt + gửi Zalo | Serverless | `api/activate.js` |
| Webhook nhận tin Zalo realtime | Serverless | `api/zalo-webhook.js` |
| API import đơn hàng | Serverless | `api/import.js` |
| API quản trị (data + Zalo inbox) | Serverless | `api/admin.js` |

### Các trang
- `/tamayoko`, `/yokool` — trang khách tra cứu/kích hoạt bảo hành.
- `/admin` — **trung tâm quản trị**: tổng quan, đơn hàng, bảo hành, khách hàng, hộp thư Zalo (đọc + trả lời tin). Đăng nhập bằng `ADMIN_KEY`.
- `/admin/import` — upload CSV đơn hàng.

> Mọi secret (Supabase service role, Zalo token) chỉ nằm trong **serverless function** qua biến môi trường. Trang khách không bao giờ chạm vào secret.

## Các bước triển khai (toàn bộ trên trình duyệt)

### 1. Supabase
- Mở project Supabase → **SQL Editor** → dán toàn bộ `supabase_schema.sql` → Run.
- Chạy tiếp `supabase_schema_messages.sql` (bảng lưu hội thoại Zalo).
- Lấy ở **Settings → API**: `Project URL` và `service_role` key.

### 2. Đẩy code lên GitHub
- Tạo repo mới (vd `warranty-app`), upload toàn bộ thư mục này.

### 3. Vercel
- **Add New → Project** → chọn repo. Framework tự nhận Vite.
- **Settings → Environment Variables**, thêm (xem `.env.example`):
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_KEY` (tự đặt chuỗi bí mật)
  - `ZALO_APP_ID`, `ZALO_OA_SECRET`, `ZALO_ACCESS_TOKEN`, `ZALO_DEFAULT_BRAND`
  - `SELF_URL` (điền sau khi có domain Vercel, vd `https://warranty-app.vercel.app`)
- Deploy.

### 4. Zalo Webhook
- developers.zalo.me → app YKMess → **Webhook** → Callback URL:
  `https://<domain-vercel>/api/zalo-webhook`
- Tích sự kiện `user_send_text`.

### 5. Gắn link vào website
- Tamayoko: `https://<domain-vercel>/tamayoko`
- Yokool: `https://<domain-vercel>/yokool`
- (Khi sẵn sàng, có thể trỏ subdomain `baohanh.tamayoko.com` về Vercel.)

## Quy trình hằng ngày
1. Export đơn hàng từ Shopee/TikTok ra CSV.
2. Vào `/admin/import`, chọn brand + sàn, nhập `ADMIN_KEY`, upload CSV → Import.
   (Import lại file cũ không tạo trùng nhờ upsert theo mã đơn.)

## CSV — tên cột nhận dạng được
`order_code` (Mã đơn), `phone` (Số điện thoại), `product` (Sản phẩm),
`quantity` (Số lượng), `price` (Giá), `purchase_date` (Ngày mua), `Tên khách`.

## Phần làm tiếp (giai đoạn 2)
- ZNS chăm sóc khách cũ (nhắc hết hạn BH, win-back) — cần xin quyền **ZNS API** + duyệt template.
- State machine hội thoại Zalo đầy đủ (bảng `wrt_sessions`).
- Dashboard thống kê bảo hành theo brand/sản phẩm.

## Chính sách bảo hành
Mặc định 12 tháng tính từ `purchase_date`. Sửa trong `api/activate.js` (`WARRANTY_MONTHS`)
và `src/lib/brands.js` (`warrantyMonths`).
