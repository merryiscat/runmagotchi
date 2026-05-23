/**
 * 014_run_traits.sql
 *
 * 런닝 속성 시스템:
 * - runs 테이블에 진화 속성 컬럼 추가 (VLM이 추출)
 * - characters 테이블에 누적 속성 JSONB 추가 (집계)
 */

-- runs 테이블에 캐릭터 진화 속성 컬럼 추가
ALTER TABLE runs ADD COLUMN IF NOT EXISTS time_of_day text;      -- dawn/morning/afternoon/evening/night
ALTER TABLE runs ADD COLUMN IF NOT EXISTS distance_type text;    -- short/mid/long
ALTER TABLE runs ADD COLUMN IF NOT EXISTS pace_type text;        -- sprint/jogger/slow
ALTER TABLE runs ADD COLUMN IF NOT EXISTS route_type text;       -- track/road/trail/treadmill/unknown

-- characters 테이블에 누적 속성 JSONB 추가
-- 진화 이미지 프롬프트 생성 시 사용
ALTER TABLE characters ADD COLUMN IF NOT EXISTS run_traits jsonb DEFAULT '{}';
