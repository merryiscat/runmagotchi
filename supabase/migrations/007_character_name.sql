-- 캐릭터 이름 (부화 시 사용자가 지정, 변경 불가)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_name text DEFAULT null;
-- 캐릭터 성별 (알 생성 시 50% 랜덤)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_gender text DEFAULT null;
-- 부화 여부
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hatched boolean DEFAULT false;
