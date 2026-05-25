-- 017: 운영 목표 프리셋 + room_goals 보상 확장
--
-- goal_presets: 운영단이 등록하는 주간/월간 목표 템플릿
-- room_goals 확장: 프리셋 연결 + 보상 필드

/* ── 1. goal_presets 테이블 ── */

CREATE TABLE IF NOT EXISTS public.goal_presets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,                         -- "5월 4주차 주간 목표"
  type        text NOT NULL CHECK (type IN ('weekly', 'monthly')),  -- 주간 / 월간
  target_km   numeric NOT NULL DEFAULT 0,            -- 최소 목표 km
  duration_days int NOT NULL DEFAULT 7,              -- 기간 (일)
  reward_tokens int NOT NULL DEFAULT 0,              -- 달성 보상: 코인
  reward_exp    int NOT NULL DEFAULT 0,              -- 달성 보상: 경험치
  active      boolean NOT NULL DEFAULT true,         -- 현재 선택 가능 여부
  created_at  timestamptz DEFAULT now()
);

/* 인덱스: 활성 프리셋 조회 */
CREATE INDEX IF NOT EXISTS idx_goal_presets_active
  ON public.goal_presets (active, type);

/* RLS: 누구나 조회 가능, 수정은 service_role만 */
ALTER TABLE public.goal_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_presets_select"
  ON public.goal_presets FOR SELECT
  USING (true);

/* ── 2. room_goals 확장 ── */

/* 프리셋 연결 (NULL이면 직접 설정) */
ALTER TABLE public.room_goals
  ADD COLUMN IF NOT EXISTS preset_id uuid REFERENCES public.goal_presets(id);

/* 보상 필드 */
ALTER TABLE public.room_goals
  ADD COLUMN IF NOT EXISTS reward_tokens int NOT NULL DEFAULT 0;

ALTER TABLE public.room_goals
  ADD COLUMN IF NOT EXISTS reward_exp int NOT NULL DEFAULT 0;

/* ── 3. 샘플 프리셋 (초기 데이터) ── */

INSERT INTO public.goal_presets (title, type, target_km, duration_days, reward_tokens, reward_exp) VALUES
  ('테스트 목표',                    'weekly',  10,  7,  500,  0),
  ('위드런 준비(2026년 6월 27일)',   'monthly', 50,  32, 5000, 0);
