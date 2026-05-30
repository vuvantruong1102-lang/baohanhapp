-- =====================================================================
-- MIGRATION v4: thêm username (tên tài khoản sàn) vào bảo hành & khách hàng
-- An toàn chạy lại nhiều lần.
-- =====================================================================
alter table wrt_warranties add column if not exists buyer text;
alter table wrt_customers  add column if not exists username text;
