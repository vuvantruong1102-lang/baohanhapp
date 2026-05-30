-- =====================================================================
-- BỔ SUNG: lưu hội thoại Zalo OA để xem/trả lời trong admin
-- Chạy thêm file này sau supabase_schema.sql
-- =====================================================================

-- Mỗi cuộc hội thoại với 1 user Zalo
create table if not exists wrt_zalo_threads (
  id              bigint generated always as identity primary key,
  zalo_user_id    text unique not null,
  display_name    text,
  avatar          text,
  brand           text,
  last_message    text,
  last_message_at timestamptz,
  unread          integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_wrt_threads_last on wrt_zalo_threads (last_message_at desc);

-- Từng tin nhắn trong hội thoại
create table if not exists wrt_messages (
  id           bigint generated always as identity primary key,
  zalo_user_id text not null,
  direction    text not null check (direction in ('in','out')), -- in: khách gửi, out: OA gửi
  text         text,
  msg_id       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_wrt_messages_user on wrt_messages (zalo_user_id, created_at);

alter table wrt_zalo_threads enable row level security;
alter table wrt_messages     enable row level security;
-- Không tạo policy anon → chỉ serverless (service_role) truy cập được.
