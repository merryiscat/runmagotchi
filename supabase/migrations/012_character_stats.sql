-- 캐릭터 배고픔/애정 스탯 추가
--
-- hunger:    0~100 (100=배부름, 0=배고픔). 시간당 4씩 자동 감소.
-- affection: 0~100 (100=최대 애정, 0=외로움). 시간당 4씩 자동 감소.
-- stats_updated_at: 마지막 스탯 계산 시점. 접속 시 경과 시간으로 감소량 계산.

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS hunger          integer     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS affection       integer     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS stats_updated_at timestamptz NOT NULL DEFAULT now();
