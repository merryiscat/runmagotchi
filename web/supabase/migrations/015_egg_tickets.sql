/**
 * 015_egg_tickets.sql
 *
 * 알 티켓 시스템:
 * - 완전체(Lv 40) 달성 시 알 티켓 1장 지급
 * - 상점에서 새 알 구매 시 10,000 코인 또는 알 티켓 1장으로 구매 가능
 */

-- profiles 테이블에 알 티켓 수 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS egg_tickets int DEFAULT 0;
