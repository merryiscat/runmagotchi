-- ============================================================
-- DB 재설계: profiles(계정) + characters(캐릭터) + character_images(이미지)
-- ============================================================

-- 1. characters 테이블 신규 생성
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text DEFAULT null,                    -- 캐릭터 이름 (부화 시 지정, 변경 불가)
  gender text DEFAULT null,                  -- 수컷/암컷 (알 선택 시 50% 랜덤)
  stage text NOT NULL DEFAULT 'egg',         -- egg, baby, child, teen, adult, final
  combo jsonb DEFAULT null,                  -- 동물 조합 { first, second }
  palette text[] DEFAULT '{}',               -- 색상 팔레트 hex 배열
  pattern text DEFAULT null,                 -- 알 무늬 이름
  egg_image_url text DEFAULT null,           -- 알 이미지 URL
  hatched boolean DEFAULT false,             -- 부화 여부
  is_active boolean DEFAULT true,            -- 현재 활성 캐릭터 여부
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 캐릭터 읽기" ON public.characters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 캐릭터 생성" ON public.characters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 캐릭터 수정" ON public.characters FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_characters_user ON public.characters(user_id);

-- 2. character_images의 FK를 characters로 변경
-- 기존 character_images 테이블 삭제 후 재생성
DROP TABLE IF EXISTS public.character_images;

CREATE TABLE public.character_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
  stage text NOT NULL DEFAULT 'baby',         -- 이미지가 속한 성장 단계
  type text NOT NULL,                         -- illust, pixel_idle, pixel_walk1, pixel_walk2, pixel_blink, pixel_happy
  url text NOT NULL,
  frame_count int DEFAULT 1,
  cols int DEFAULT 1,
  rows int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.character_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "캐릭터 이미지 읽기" ON public.character_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));
CREATE POLICY "캐릭터 이미지 생성" ON public.character_images FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_id AND c.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_char_images_char ON public.character_images(character_id, stage, type);

-- 3. profiles에서 캐릭터 관련 컬럼 정리 (남겨둘 것: nickname, birth_date, saju_reading, egg_choices)
-- 나머지 캐릭터 관련은 characters 테이블로 이동했으므로 사용 안 함
-- 삭제하지는 않고 무시 (기존 데이터 호환)
