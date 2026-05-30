-- =====================================================================
-- WARRANTY SYSTEM SCHEMA (Tamayoko + Yokool)
-- Dùng chung Supabase với project khác → mọi bảng đều prefix "wrt_"
-- Chạy file này trong Supabase SQL Editor một lần để khởi tạo.
-- =====================================================================

-- 1) Bảng đơn hàng import từ Shopee/TikTok (nguồn để đối chiếu mã đơn)
create table if not exists wrt_orders (
  id            bigint generated always as identity primary key,
  brand         text not null check (brand in ('tamayoko','yokool')),
  platform      text not null check (platform in ('shopee','tiktok','other')),
  order_code    text not null,                  -- mã đơn khách sẽ nhập
  phone         text,                           -- SĐT đã chuẩn hoá 0xxxxxxxxx
  customer_name text,
  product       text,
  quantity      integer default 1,
  price         numeric(14,2),
  purchase_date date,                           -- ngày mua hàng
  imported_at   timestamptz not null default now(),
  raw           jsonb,                          -- giữ nguyên dòng gốc để truy vết
  unique (brand, platform, order_code)
);
create index if not exists idx_wrt_orders_code  on wrt_orders (order_code);
create index if not exists idx_wrt_orders_phone on wrt_orders (phone);

-- 2) Bảng khách hàng (định danh xuyên kênh qua phone)
create table if not exists wrt_customers (
  id             bigint generated always as identity primary key,
  phone          text unique not null,          -- khóa định danh chính
  name           text,
  zalo_user_id   text,                           -- nối với Zalo OA nếu có
  brand          text,
  consent_at     timestamptz,                    -- mốc đồng ý NĐ13/2023
  first_seen_at  timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index if not exists idx_wrt_customers_zalo on wrt_customers (zalo_user_id);

-- 3) Bảng bảo hành đã kích hoạt
create table if not exists wrt_warranties (
  id             bigint generated always as identity primary key,
  order_id       bigint references wrt_orders (id) on delete set null,
  customer_id    bigint references wrt_customers (id) on delete set null,
  brand          text not null,
  order_code     text not null,
  phone          text,
  product        text,
  quantity       integer default 1,
  price          numeric(14,2),
  purchase_date  date,
  activated_at   timestamptz not null default now(),
  expires_at     date,                           -- tính theo chính sách bảo hành
  channel        text default 'web' check (channel in ('web','zalo')),
  status         text default 'active' check (status in ('active','expired','void')),
  zalo_user_id   text,
  unique (brand, order_code)                     -- 1 đơn chỉ kích hoạt 1 lần
);
create index if not exists idx_wrt_warranties_phone on wrt_warranties (phone);
create index if not exists idx_wrt_warranties_exp   on wrt_warranties (expires_at);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Trang khách dùng anon key → KHÔNG được phép đọc bừa toàn bộ data.
-- Mọi thao tác nhạy cảm đi qua serverless function dùng service_role key
-- (service_role bypass RLS). Vì vậy ta khoá chặt anon, chỉ mở khi cần.
-- =====================================================================
alter table wrt_orders     enable row level security;
alter table wrt_customers  enable row level security;
alter table wrt_warranties enable row level security;

-- Mặc định KHÔNG tạo policy cho phép anon đọc/ghi.
-- => anon key sẽ không truy cập được 3 bảng trên. Tất cả qua API server-side.
-- (Nếu sau này muốn cho phép tra cứu trực tiếp client-side, thêm policy có kiểm soát.)
