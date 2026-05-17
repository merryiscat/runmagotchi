-- 캐릭터 이미지 테이블 (profiles에서 분리)
-- 한 캐릭터에 여러 이미지(일러스트, 도트, 스프라이트 시트 등) 저장

CREATE TABLE IF NOT EXISTS public.character_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 성장 단계: baby(유아), child(유년), teen(초기체), adult(중기체), final(완전체)
  stage text NOT NULL DEFAULT 'baby',

  -- 이미지 종류
  --   illust: 고퀄 일러스트 (프로필, 진화 연출용)
  --   pixel_idle: 도트 기본 자세 (정면)
  --   pixel_walk: 도트 걷기 스프라이트 시트 (4방향 × 2프레임 = 8칸 그리드)
  --   pixel_run: 도트 뛰기 스프라이트 시트 (2프레임)
  --   pixel_emote: 도트 애교 스프라이트 시트 (기쁨/잠/하트 = 3칸)
  --   pixel_blink: 도트 눈 깜빡임 (2프레임)
  type text NOT NULL,

  -- 이미지 URL (Supabase Storage)
  url text NOT NULL,

  -- 스프라이트 시트 메타: 프레임 수, 가로/세로 칸 수
  frame_count int DEFAULT 1,
  cols int DEFAULT 1,
  rows int DEFAULT 1,

  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.character_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 캐릭터 이미지 읽기" ON public.character_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 캐릭터 이미지 생성" ON public.character_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 캐릭터 이미지 수정" ON public.character_images
  FOR UPDATE USING (auth.uid() = user_id);

-- 인덱스: user_id + stage + type 조합으로 빠르게 조회
CREATE INDEX IF NOT EXISTS idx_char_images_user_stage ON public.character_images(user_id, stage, type);
