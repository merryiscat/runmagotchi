/**
 * 공유 스테이지 (/room/[code])
 *
 * 대시보드(M1)와 동일한 레이아웃 (좌 stage + 우 panel)
 *
 * 패널 순서:
 *   1. 방 정보 (이름 + 코드 복사 버튼)
 *   2. 멤버 (가로 탭으로 선택)
 *   3. 팀 목표
 *   4. 선택한 멤버의 런닝 기록
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import GNB from '@/components/GNB';
import BouncingCharacter from '@/components/BouncingCharacter';
import type { TouchPoint } from '@/components/BouncingCharacter';
import { determineBehavior, TouchTracker } from '@/lib/behavior';
import ZoomableStage from '@/components/ZoomableStage';

/* ─── 타입 ─── */

interface RunRecord {
  distance_km: number;
  duration_minutes: number;
  pace: string | null;
  run_date: string;
  tokens_earned: number;
}

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
  runs: RunRecord[];
  total_km: number;
}

interface RoomGoal {
  target_km: number;
  current_km: number;
  start_date: string;
  end_date: string;
  completed: boolean;
  reward_tokens?: number;
  reward_exp?: number;
}

interface RoomInfo {
  id: string;
  code: string;
  name: string;
  owner_id: string;
}

/* ─── 메인 ─── */

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

  /* 선택된 멤버 (기록 보기용) */
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  /* 코드 복사 피드백 */
  const [copied, setCopied] = useState(false);

  /* 방 이름 수정 */
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const touchTracker = useRef(new TouchTracker(60_000));
  const supabase = createClient();

  /* ── 데이터 로드 ── */
  const loadRoom = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }
    setMyUserId(user.id);

    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, code, name, owner_id')
      .eq('code', code)
      .limit(1);

    const rm = rooms?.[0];
    if (!rm) { setError('존재하지 않는 방 코드'); setLoading(false); return; }
    setRoom(rm);

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'members', room_id: rm.id }),
    });
    const data = await res.json();

    const memberList = data.members || [];
    setMembers(memberList);
    setGoal(data.goal || null);
    /* 첫 번째 멤버 자동 선택 */
    if (memberList.length > 0) setSelectedMember(memberList[0].user_id);
    setLoading(false);
  }, [code, supabase]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  /* ── 코드 복사 ── */
  function handleCopy() {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /* ── 방 나가기 ── */
  async function handleLeave() {
    if (!room || !myUserId) return;
    if (!confirm('방을 나가시겠습니까?')) return;

    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'leave',
        user_id: myUserId,
        room_id: room.id,
      }),
    });

    window.location.href = '/rooms';
  }

  /* ── 방 이름 수정 (방장만) ── */
  async function handleRename() {
    const newName = nameInputRef.current?.value.trim();
    if (!newName || newName.length < 2 || !room) return;

    await supabase
      .from('rooms')
      .update({ name: newName })
      .eq('id', room.id);

    setRoom({ ...room, name: newName });
    setEditingName(false);
  }

  /* ── 터치 ── */
  const handleTouch = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTouchPoint({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: Date.now(),
    });
    touchTracker.current.record();
  }, []);

  /* ── 목표 진행률 (멤버 합산 km으로 실시간 계산) ── */
  const memberTotalKm = members.reduce((s, m) => s + m.total_km, 0);
  const goalCurrentKm = goal ? Math.max(memberTotalKm, Number(goal.current_km)) : 0;
  const goalPercent = goal
    ? Math.min(100, Math.round((goalCurrentKm / Number(goal.target_km)) * 100))
    : 0;

  /* ── 선택된 멤버 데이터 ── */
  const activeMember = members.find(m => m.user_id === selectedMember);

  /* ── 로딩/에러 ── */
  if (loading) {
    return (
      <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
        <GNB active="rooms" />
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-handwriting)', fontSize: 20,
        }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
        <GNB active="rooms" />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 'var(--s-4)',
          fontFamily: 'var(--font-handwriting)',
        }}>
          <div style={{ fontSize: 20, color: 'var(--ink-strong)' }}>{error}</div>
          <a href="/rooms" className="btn">돌아가기</a>
        </div>
      </div>
    );
  }

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <GNB active="rooms" />

      <div className="m1-layout" style={{ flex: 1 }}>

        {/* ── 좌: 공유 스테이지 ── */}
        <div
          className="stage"
          onPointerDown={handleTouch}
          style={{ overflow: 'hidden', touchAction: 'none', cursor: 'pointer' }}
        >
          {/* 격자 배경 (대시보드와 동일) */}
          <ZoomableStage>{null}</ZoomableStage>

          {/* 참여자 캐릭터들 */}
          {members.map(m => {
            if (!m.pixel_url) return null;
            const behavior = determineBehavior({
              hunger: 50, affection: 50,
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

          {members.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-handwriting)', fontSize: 'var(--fs-sm)',
              color: 'var(--ink-muted)',
            }}>
              멤버를 초대해보세요
            </div>
          )}

          {/* 하단: 방 이름 + 멤버 태그 */}
          <div className="stage__footer" style={{
            display: 'flex', flexDirection: 'column', gap: 'var(--s-2)',
          }}>
            <div className="fw-bold" style={{
              fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {room?.name}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 'var(--s-2)', flexWrap: 'wrap',
            }}>
              {members.map(m => (
                <span key={m.user_id} style={{
                  padding: '2px 8px', background: 'var(--paper)',
                  border: '1px solid var(--line)', fontSize: 12,
                  fontFamily: 'var(--font-handwriting)',
                  display: 'inline-flex', alignItems: 'center', gap: 3,
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
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 우: 패널 ── */}
        <div className="panel" style={{ fontFamily: 'var(--font-handwriting)' }}>

          {/* 1. 방 정보 + 이름 수정 + 코드 복사 */}
          <div className="panel__section">
            <div className="row row--between mb-3">
              <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, fontWeight: 700 }}>
                방 정보
              </span>
              <button
                onClick={handleLeave}
                style={{
                  background: 'none', border: '1px solid var(--line)',
                  padding: '2px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-handwriting)', fontSize: 13,
                  color: 'var(--ink-muted)',
                }}
              >
                탈퇴
              </button>
            </div>

            {/* 방 이름 — 방장이면 클릭해서 수정 가능 */}
            <div className="run-row">
              {editingName ? (
                <div style={{ display: 'flex', gap: 'var(--s-2)', flex: 1 }}>
                  <input
                    ref={nameInputRef}
                    type="text"
                    defaultValue={room?.name}
                    autoFocus
                    className="input"
                    style={{ fontFamily: 'var(--font-handwriting)', fontSize: 15, flex: 1, padding: '4px 8px' }}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
                  />
                  <button
                    onClick={handleRename}
                    style={{
                      background: 'none', border: '1px solid var(--ink-strong)',
                      padding: '2px 10px', cursor: 'pointer',
                      fontFamily: 'var(--font-handwriting)', fontSize: 13,
                    }}
                  >
                    확인
                  </button>
                </div>
              ) : (
                <>
                  <span style={{
                    fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)',
                    fontWeight: 700,
                  }}>
                    {room?.name}
                  </span>
                  {room?.owner_id === myUserId && (
                    <button
                      onClick={() => setEditingName(true)}
                      style={{
                        background: 'none', border: '1px solid var(--line)',
                        padding: '2px 10px', cursor: 'pointer',
                        fontFamily: 'var(--font-handwriting)', fontSize: 13,
                        color: 'var(--ink-muted)',
                      }}
                    >
                      수정
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 코드 + 복사 */}
            <div className="run-row">
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.1em' }}>
                #{room?.code}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: 'none', border: '1px solid var(--line)',
                  padding: '2px 10px', cursor: 'pointer',
                  fontFamily: 'var(--font-handwriting)', fontSize: 13,
                  color: copied ? 'var(--cheong)' : 'var(--ink-muted)',
                }}
              >
                {copied ? '복사됨' : '복사'}
              </button>
            </div>

          </div>

          {/* 2. 멤버 (가로 탭) */}
          <div className="panel__section">
            <div className="row row--between mb-3">
              <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, fontWeight: 700 }}>
                멤버
              </span>
              <span className="text-xs text-muted">{members.length}명</span>
            </div>
            <div style={{
              display: 'flex', gap: 'var(--s-2)', overflowX: 'auto',
              paddingBottom: 'var(--s-2)',
            }}>
              {members.map(m => {
                const isActive = m.user_id === selectedMember;
                return (
                  <button
                    key={m.user_id}
                    onClick={() => setSelectedMember(m.user_id)}
                    style={{
                      padding: '6px 14px',
                      border: isActive ? '1.5px solid var(--ink-strong)' : '1px solid var(--line)',
                      background: isActive ? 'var(--ink-strong)' : 'var(--paper)',
                      color: isActive ? 'var(--paper)' : 'var(--ink-default)',
                      fontFamily: 'var(--font-handwriting)',
                      fontSize: 14, fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {m.character?.name || m.nickname}
                    {m.character?.gender && (
                      <span style={{
                        marginLeft: 3, fontSize: 11,
                        color: isActive
                          ? 'var(--paper)'
                          : m.character.gender === '수컷' ? 'var(--cheong)' : 'var(--jeok)',
                      }}>
                        {m.character.gender === '수컷' ? '♂' : '♀'}
                      </span>
                    )}
                    {m.user_id === room?.owner_id && (
                      <span style={{ marginLeft: 3, fontSize: 10, color: isActive ? 'var(--hwang)' : 'var(--hwang)' }}>★</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* 선택된 멤버 요약 */}
          </div>

          {/* 3. 팀 목표 */}
          <div className="panel__section">
            <div className="row row--between mb-3">
              <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, fontWeight: 700 }}>
                팀 목표
              </span>
            </div>
            {goal ? (
              <>
                <div className="stats-row" style={{ marginBottom: 'var(--s-3)' }}>
                  <div>
                    <div className="stat-v">{goalCurrentKm.toFixed(1)}</div>
                    <div className="stat-l">달성</div>
                  </div>
                  <div>
                    <div className="stat-v">{Number(goal.target_km)}</div>
                    <div className="stat-l">목표 km</div>
                  </div>
                  <div>
                    <div className="stat-v">{goalPercent}%</div>
                    <div className="stat-l">진행률</div>
                  </div>
                </div>
                <div style={{
                  height: 8, background: 'var(--clay-soft)',
                  border: '1px solid var(--line)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${goalPercent}%`,
                    background: goalPercent >= 100 ? 'var(--cheong)' : 'var(--hwang)',
                    transition: 'width 0.3s',
                  }} />
                </div>

                {/* 보상 표시 (코인만) */}
                {goal.reward_tokens ? (
                  <div style={{
                    marginTop: 'var(--s-2)',
                    fontSize: 13, color: 'var(--ink-muted)',
                    display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                  }}>
                    <span>달성 보상:</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 14, height: 14, borderRadius: '50%',
                        background: 'var(--hwang)', color: 'var(--on-hwang)',
                        fontSize: 8, fontWeight: 900, fontFamily: 'serif',
                      }}>₩</span>
                      {goal.reward_tokens}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-muted" style={{ padding: 'var(--s-3) 0' }}>
                목표 미설정
              </div>
            )}
          </div>

          {/* 4. 선택한 멤버의 런닝 기록 */}
          <div className="panel__section" style={{ flex: 1 }}>
            <div className="row row--between mb-3">
              <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, fontWeight: 700 }}>
                {activeMember?.character?.name || activeMember?.nickname || ''}의 기록
              </span>
              <span className="text-xs text-muted">
                {activeMember?.runs.length || 0}건
              </span>
            </div>
            {activeMember && activeMember.runs.length > 0 ? (
              activeMember.runs.map((r, i) => (
                <div key={i} className="run-row">
                  <div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
                      {Number(r.distance_km).toFixed(1)} km
                    </div>
                    <div className="text-xs text-muted">
                      {r.pace || ''} {r.duration_minutes}분
                      {r.tokens_earned ? (
                        <>
                          {' · '}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 12, height: 12, borderRadius: '50%',
                            background: 'var(--hwang)', color: 'var(--on-hwang)',
                            fontSize: 7, fontWeight: 900, fontFamily: 'serif', lineHeight: 1,
                            verticalAlign: 'middle',
                          }}>₩</span>
                          {r.tokens_earned}
                        </>
                      ) : ''}
                    </div>
                  </div>
                  <div className="text-xs text-muted">{r.run_date}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted" style={{ padding: 'var(--s-3) 0' }}>
                기록 없음
              </div>
            )}
          </div>

          {/* 돌아가기 */}
          <div className="panel__section">
            <a href="/rooms" className="btn btn--full"
              style={{ fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)', textAlign: 'center' }}>
              ← withRUN
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
