/**
 * 공유 스테이지 페이지 (/room/[code])
 *
 * 방 코드로 입장 → 참여자 전원 캐릭터가 같은 스테이지에서 움직임.
 * - 아무 캐릭터 터치 가능 (반응)
 * - 팀 km 목표 진행률 표시
 * - 먹이주기 없음
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import GNB from '@/components/GNB';
import BouncingCharacter from '@/components/BouncingCharacter';
import type { TouchPoint } from '@/components/BouncingCharacter';
import { determineBehavior, TouchTracker } from '@/lib/behavior';

/* ─── 타입 ─── */

interface RoomMember {
  user_id: string;
  character_id: string;
  nickname: string;
  character: {
    name: string;
    gender: string;
    stage: string;
    hatched: boolean;
    level: number;
  } | null;
  pixel_url: string | null;
}

interface RoomGoal {
  target_km: number;
  current_km: number;
  start_date: string;
  end_date: string;
  completed: boolean;
}

interface RoomInfo {
  id: string;
  code: string;
  name: string;
  owner_id: string;
}

/* ─── 메인 컴포넌트 ─── */

export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string || '').toUpperCase();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [goal, setGoal] = useState<RoomGoal | null>(null);
  const [myUserId, setMyUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [touchPoint, setTouchPoint] = useState<TouchPoint | null>(null);

  const touchTracker = useRef(new TouchTracker(60_000));
  const supabase = createClient();

  /* ── 데이터 로드 ── */
  const loadRoom = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }
    setMyUserId(user.id);

    /* 방 조회 */
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, code, name, owner_id')
      .eq('code', code)
      .limit(1);

    const rm = rooms?.[0];
    if (!rm) { setError('존재하지 않는 방 코드'); setLoading(false); return; }
    setRoom(rm);

    /* 멤버 + 캐릭터 정보 */
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'members', room_id: rm.id }),
    });
    const data = await res.json();

    setMembers(data.members || []);
    setGoal(data.goal || null);
    setLoading(false);
  }, [code, supabase]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  /* ── 스테이지 터치 ── */
  const handleTouch = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTouchPoint({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: Date.now(),
    });
    touchTracker.current.record();
  }, []);

  /* ── 목표 진행률 ── */
  const goalPercent = goal
    ? Math.min(100, Math.round((Number(goal.current_km) / Number(goal.target_km)) * 100))
    : 0;

  /* ── 로딩/에러 ── */
  if (loading) {
    return (
      <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
        <GNB />
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-handwriting)', fontSize: 20,
        }}>
          방 불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
        <GNB />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--s-4)',
          fontFamily: 'var(--font-handwriting)',
        }}>
          <div style={{ fontSize: 20, color: 'var(--jeok)' }}>{error}</div>
          <a href="/dashboard" className="btn">대시보드로</a>
        </div>
      </div>
    );
  }

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <GNB />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ── 방 정보 바 ── */}
        <div style={{
          padding: 'var(--s-3) var(--s-4)',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'var(--font-handwriting)',
        }}>
          <div>
            <span style={{
              fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)', fontWeight: 700,
            }}>
              {room?.name}
            </span>
            <span className="text-xs text-muted" style={{ marginLeft: 'var(--s-2)' }}>
              코드: {room?.code}
            </span>
          </div>
          <div className="text-sm text-muted">
            {members.length}명 참여 중
          </div>
        </div>

        {/* ── 팀 목표 ── */}
        {goal && (
          <div style={{
            padding: 'var(--s-3) var(--s-4)',
            borderBottom: '1px solid var(--line)',
            fontFamily: 'var(--font-handwriting)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 'var(--s-2)',
            }}>
              <span className="text-sm fw-bold">팀 목표</span>
              <span className="text-sm">
                {Number(goal.current_km).toFixed(1)} / {Number(goal.target_km)} km
              </span>
            </div>
            {/* 프로그레스 바 */}
            <div style={{
              height: 8, background: 'var(--clay-soft)',
              border: '1px solid var(--line)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${goalPercent}%`,
                background: goalPercent >= 100 ? 'var(--cheong)' : 'var(--hwang)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 'var(--s-1)' }}>
              {goal.start_date} ~ {goal.end_date}
              {goalPercent >= 100 && ' · 달성!'}
            </div>
          </div>
        )}

        {/* ── 공유 스테이지 ── */}
        <div
          onPointerDown={handleTouch}
          style={{
            flex: 1, position: 'relative',
            background: 'var(--clay)',
            cursor: 'pointer',
            touchAction: 'none',
            minHeight: 400,
          }}
        >
          {/* 각 멤버 캐릭터 */}
          {members.map(m => {
            if (!m.character?.hatched || !m.pixel_url) return null;

            const behavior = determineBehavior({
              hunger: 50,
              affection: 50,
              recentlyTouched: touchTracker.current.isRecentlyTouched(),
              recentlyFed: false,
            });

            return (
              <BouncingCharacter
                key={m.character_id}
                characterId={m.character_id}
                idleUrl={m.pixel_url}
                behavior={behavior}
                affection={50}
                touchPoint={touchPoint}
              />
            );
          })}

          {/* 멤버 이름 태그 (하단) */}
          <div style={{
            position: 'absolute', bottom: 'var(--s-3)', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 'var(--s-3)',
            flexWrap: 'wrap', padding: '0 var(--s-3)',
          }}>
            {members.map(m => (
              <div key={m.user_id} style={{
                padding: '2px 8px',
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                fontSize: 12,
                fontFamily: 'var(--font-handwriting)',
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: 0.9,
              }}>
                {m.character?.name || m.nickname}
                {m.character?.gender && (
                  <span style={{
                    color: m.character.gender === '수컷' ? 'var(--cheong)' : 'var(--jeok)',
                    fontSize: 10,
                  }}>
                    {m.character.gender === '수컷' ? '♂' : '♀'}
                  </span>
                )}
                {m.user_id === room?.owner_id && (
                  <span style={{ fontSize: 10, color: 'var(--hwang)' }}>★</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
