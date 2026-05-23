/**
 * 013_egg_touches.sql
 *
 * 알 터치 부화 시스템:
 * - 100 터치 = 1 애정, 10,000 터치 = 부화 (애정 100)
 * - egg_touches: 누적 터치 수 추적
 */

-- characters 테이블에 알 터치 수 컬럼 추가
ALTER TABLE characters ADD COLUMN IF NOT EXISTS egg_touches int DEFAULT 0;
