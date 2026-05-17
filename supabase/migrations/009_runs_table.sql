-- 런닝 기록 테이블
CREATE TABLE IF NOT EXISTS public.runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,

  -- 런닝 데이터 (VLM 파싱 결과)
  distance_km numeric NOT NULL,           -- 거리 (km)
  duration_minutes int NOT NULL,          -- 시간 (분)
  pace text DEFAULT null,                 -- 페이스 (예: 05:32 /km)
  run_date date NOT NULL,                 -- 런닝 날짜

  -- EXP
  exp_earned int DEFAULT 0,               -- 이번 기록으로 획득한 EXP

  -- 스크린샷 원본
  screenshot_url text DEFAULT null,       -- 업로드한 스크린샷 URL

  -- 해시 (중복 방지)
  image_hash text DEFAULT null,           -- SHA-256 해시

  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 기록 읽기" ON public.runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 기록 생성" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_runs_user ON public.runs(user_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_runs_char ON public.runs(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_hash ON public.runs(user_id, image_hash);
