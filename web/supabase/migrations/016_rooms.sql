/**
 * 016_rooms.sql
 *
 * 공유 스테이지(방) 시스템:
 * - 방 생성 → 6자리 코드 → 참여 → 캐릭터가 같은 스테이지에 표시
 * - 팀 km 목표 설정 → 멤버 런닝 합산 → 달성 시 보상
 */

-- 방 테이블
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 6자리 영숫자 초대 코드 (대문자)
  code text UNIQUE NOT NULL,
  -- 방 이름
  name text NOT NULL,
  -- 방장
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  -- 최대 인원 (기본 8)
  max_members int DEFAULT 8,
  created_at timestamptz DEFAULT now(),
  -- 30일 미접속 시 자동 정리용
  last_active_at timestamptz DEFAULT now()
);

-- 방 참여자 테이블
CREATE TABLE IF NOT EXISTS room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  -- 스테이지에 표시할 캐릭터
  character_id uuid NOT NULL REFERENCES characters(id),
  joined_at timestamptz DEFAULT now(),
  -- 같은 방에 같은 유저 중복 참여 방지
  UNIQUE(room_id, user_id)
);

-- 팀 목표 테이블
CREATE TABLE IF NOT EXISTS room_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  -- 목표 거리 (km)
  target_km numeric NOT NULL,
  -- 현재 달성 거리 (km) — 업로드 시 자동 합산
  current_km numeric DEFAULT 0,
  -- 목표 기간
  start_date date NOT NULL,
  end_date date NOT NULL,
  -- 달성 여부
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 인덱스: 코드로 방 찾기
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
-- 인덱스: 유저의 방 목록
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
-- 인덱스: 방의 활성 목표
CREATE INDEX IF NOT EXISTS idx_room_goals_room ON room_goals(room_id);

-- RLS 정책
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_goals ENABLE ROW LEVEL SECURITY;

-- 방: 참여자만 조회 가능
CREATE POLICY rooms_select ON rooms FOR SELECT USING (
  id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
  OR owner_id = auth.uid()
);
-- 방: 로그인 유저 생성 가능
CREATE POLICY rooms_insert ON rooms FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- 방: 방장만 수정/삭제
CREATE POLICY rooms_update ON rooms FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY rooms_delete ON rooms FOR DELETE USING (owner_id = auth.uid());

-- 멤버: 같은 방 참여자끼리 조회
CREATE POLICY room_members_select ON room_members FOR SELECT USING (
  room_id IN (SELECT room_id FROM room_members rm WHERE rm.user_id = auth.uid())
);
-- 멤버: 본인 참여/탈퇴
CREATE POLICY room_members_insert ON room_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY room_members_delete ON room_members FOR DELETE USING (user_id = auth.uid());

-- 목표: 참여자 조회
CREATE POLICY room_goals_select ON room_goals FOR SELECT USING (
  room_id IN (SELECT room_id FROM room_members WHERE user_id = auth.uid())
);
-- 목표: 방장만 생성
CREATE POLICY room_goals_insert ON room_goals FOR INSERT WITH CHECK (
  room_id IN (SELECT id FROM rooms WHERE owner_id = auth.uid())
);
