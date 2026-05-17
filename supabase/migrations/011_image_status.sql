-- 캐릭터 이미지 생성 상태: pending(생성중), done(완료), failed(실패)
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS image_status text DEFAULT 'pending';
