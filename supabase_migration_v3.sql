-- =====================================================================
-- MIGRATION v3: thêm tên người mua (buyer username) vào đơn hàng
-- Shopee: cột BB "Người Mua" | TikTokShop: cột AM "Buyer Username"
-- An toàn chạy lại nhiều lần.
-- =====================================================================
alter table wrt_orders add column if not exists buyer text;
