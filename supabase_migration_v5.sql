-- =====================================================================
-- MIGRATION v5: nhận diện OA nguồn (Yokool / Tamayoko) cho hội thoại Zalo
-- 2 OA dùng chung 1 App, phân biệt bằng oa_id trong payload webhook.
-- An toàn chạy lại nhiều lần.
-- =====================================================================
alter table wrt_zalo_threads add column if not exists oa_id text;
alter table wrt_messages     add column if not exists oa_id text;
