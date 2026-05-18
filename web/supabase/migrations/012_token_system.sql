/**
 * 012_token_system.sql
 *
 * 토큰 시스템 도입:
 * - 런닝 기록 업로드 → 토큰 지급 (EXP 직접 지급 X)
 * - 스테이지에서 토큰을 소비해 경험치(EXP) 구매
 * - 부화/진화가 스테이지에서 이루어짐
 */

-- characters 테이블에 토큰/경험치/레벨 컬럼 추가
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tokens int DEFAULT 0;       -- 보유 토큰
ALTER TABLE characters ADD COLUMN IF NOT EXISTS total_exp int DEFAULT 0;    -- 누적 경험치
ALTER TABLE characters ADD COLUMN IF NOT EXISTS level int DEFAULT 0;        -- 현재 레벨

-- runs 테이블: exp_earned → tokens_earned 이름 변경
-- (기존 데이터 호환을 위해 새 컬럼 추가 방식)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS tokens_earned int DEFAULT 0;

-- 기존 exp_earned 값이 있으면 tokens_earned로 복사
UPDATE runs SET tokens_earned = exp_earned WHERE exp_earned > 0 AND tokens_earned = 0;
