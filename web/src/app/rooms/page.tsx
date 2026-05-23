/**
 * withRUN — 공유 스테이지 관리
 *
 * 서버 컴포넌트.
 * 레퍼런스: V4a 트랙 디자인
 *   - 방 카드: 이름 + 코드 + 누적/목표 km + 멤버수 + 들어가기
 *   - 상단: withRUN 제목 + 코드 버튼 + 새 트랙 버튼
 *   - 설명: "발자국이 모일수록 트랙이 길어진다"
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GNB from '@/components/GNB';
import RoomActions from '@/components/RoomActions';
import CopyCode from '@/components/CopyCode';

export default async function RoomsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* 활성 캐릭터 */
  const { data: chars } = await supabase
    .from('characters')
    .select('id, tokens')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const character = chars?.[0];
  if (!character) redirect('/egg-select');

  /* 내가 참여 중인 방 목록 */
  const { data: myMembers } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', user.id);

  /** 멤버 정보 (트랙 마커용) */
  interface MemberMarker {
    name: string;
    pixelUrl: string | null;
    km: number;
  }

  interface RoomData {
    id: string;
    code: string;
    name: string;
    owner_id: string;
    created_at: string;
    memberCount?: number;
    goalKm?: number;
    currentKm?: number;
    members?: MemberMarker[];
  }

  let rooms: RoomData[] = [];
  if (myMembers && myMembers.length > 0) {
    const roomIds = myMembers.map(r => r.room_id);
    const { data: roomData } = await supabase
      .from('rooms')
      .select('id, code, name, owner_id, created_at')
      .in('id', roomIds);

    for (const room of roomData || []) {
      /* 멤버 목록 */
      const { data: mList } = await supabase
        .from('room_members')
        .select('user_id, character_id')
        .eq('room_id', room.id);

      /* 활성 목표 */
      const { data: goals } = await supabase
        .from('room_goals')
        .select('target_km, current_km')
        .eq('room_id', room.id)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .limit(1);

      /* 멤버별 캐릭터 이미지 + 개인 km */
      const memberMarkers: MemberMarker[] = [];
      for (const m of mList || []) {
        const { data: char } = await supabase
          .from('characters')
          .select('name')
          .eq('id', m.character_id)
          .single();

        const { data: pixel } = await supabase
          .from('character_images')
          .select('url')
          .eq('character_id', m.character_id)
          .eq('type', 'pixel_idle')
          .single();

        const { data: runs } = await supabase
          .from('runs')
          .select('distance_km')
          .eq('user_id', m.user_id);

        const km = (runs || []).reduce((s, r) => s + Number(r.distance_km), 0);

        memberMarkers.push({
          name: char?.name || '?',
          pixelUrl: pixel?.url || null,
          km,
        });
      }

      rooms.push({
        ...room,
        memberCount: mList?.length || 0,
        goalKm: goals?.[0] ? Number(goals[0].target_km) : undefined,
        currentKm: goals?.[0] ? Number(goals[0].current_km) : undefined,
        members: memberMarkers,
      });
    }
  }

  const coins = character.tokens || 0;

  /* 방 경과 일수 계산 */
  function daysSince(dateStr: string): number {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <GNB active="rooms" coins={coins} />

      {/* 본문 */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: 'var(--s-5) var(--s-5) var(--s-6)',
        background: 'var(--paper)',
      }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>

          {/* ── 헤더: 제목 + 액션 버튼 ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', marginBottom: 'var(--s-2)', gap: 'var(--s-4)',
          }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--font-penscript)', fontSize: 42,
                fontWeight: 400, margin: 0, lineHeight: 1,
              }}>
                withRUN
              </h1>
            </div>

            {/* 코드 입장 + 새 트랙 (클라이언트) */}
            <RoomActions userId={user.id} characterId={character.id} />
          </div>


          {/* ── 방 목록 ── */}
          {rooms.length === 0 ? (
            <div style={{
              padding: 'var(--s-7) 0',
              textAlign: 'center',
              fontFamily: 'var(--font-handwriting)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--ink-muted)',
            }}>
              아직 참여 중인 트랙이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {rooms.map(room => {
                const days = daysSince(room.created_at);
                const isOwner = room.owner_id === user.id;
                const progress = room.goalKm && room.currentKm
                  ? Math.min(100, Math.round((room.currentKm / room.goalKm) * 100))
                  : 0;

                return (
                  <a
                    key={room.id}
                    href={`/room/${room.code}`}
                    style={{
                      border: '1.5px solid var(--ink-strong)',
                      background: 'var(--paper)',
                      boxShadow: '2px 2px 0 var(--ink-strong)',
                      padding: '18px 20px',
                      display: 'block',
                      textDecoration: 'none',
                      color: 'var(--ink-strong)',
                      fontFamily: 'var(--font-handwriting)',
                    }}
                  >
                    {/* 상단: 방 이름 + 코드 | 누적/목표 km */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', marginBottom: 14,
                      gap: 12, flexWrap: 'wrap',
                    }}>
                      {/* 좌: 이름 + 방장 + 코드 */}
                      <div style={{
                        display: 'flex', alignItems: 'baseline',
                        gap: 8, flexWrap: 'wrap', minWidth: 0,
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-penscript)', fontSize: 24,
                          whiteSpace: 'nowrap',
                        }}>
                          {room.name}
                        </span>
                        {isOwner && (
                          <span style={{
                            fontFamily: 'var(--font-myeongjo)', fontWeight: 700,
                            fontSize: 12, color: 'var(--jeok)',
                            border: '1.5px solid var(--jeok)',
                            padding: '2px 6px',
                            transform: 'rotate(-3deg)',
                            display: 'inline-block',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                            방장
                          </span>
                        )}
                        <CopyCode code={room.code} />
                      </div>

                      {/* 우: 누적 / 목표 km + 멤버수 */}
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {room.goalKm ? (
                          <>
                            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                              {(room.currentKm || 0).toFixed(1)}
                              <span style={{
                                fontSize: 13, color: 'var(--ink-muted)',
                                fontWeight: 400, marginLeft: 3,
                              }}>
                                / {room.goalKm} km
                              </span>
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>목표 미설정</div>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                          {room.memberCount}명 · {days}일째
                        </div>
                      </div>
                    </div>

                    {/* 트랙 — 멤버별 캐릭터 마커 */}
                    {room.goalKm && (
                      <div style={{ position: 'relative', height: 40, marginBottom: 14 }}>
                        {/* 점선 트랙 */}
                        <div style={{
                          position: 'absolute', top: 19,
                          left: 0, right: 0, height: 0,
                          borderTop: '1.5px dashed var(--ink-strong)',
                        }} />
                        {/* 시작 기둥 */}
                        <div style={{
                          position: 'absolute', left: 0, top: 8,
                          width: 1.5, height: 22,
                          background: 'var(--ink-strong)',
                        }} />

                        {/* 멤버별 캐릭터 마커 */}
                        {(room.members || []).map((m, mi) => {
                          const memberProgress = room.goalKm
                            ? Math.min(95, Math.round((m.km / room.goalKm!) * 100))
                            : 0;
                          return (
                            <div key={mi} style={{
                              position: 'absolute',
                              left: `${memberProgress}%`,
                              top: 2,
                              transform: 'translateX(-50%)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              zIndex: mi + 1,
                            }}>
                              {/* 캐릭터 이미지 또는 이니셜 */}
                              {m.pixelUrl ? (
                                <img src={m.pixelUrl} alt={m.name}
                                  style={{
                                    width: 24, height: 24,
                                    objectFit: 'contain',
                                    imageRendering: 'pixelated' as const,
                                    border: '1.5px solid var(--ink-strong)',
                                    borderRadius: '50%',
                                    background: 'var(--paper)',
                                  }}
                                />
                              ) : (
                                <div style={{
                                  width: 24, height: 24,
                                  borderRadius: '50%',
                                  background: 'var(--clay-soft)',
                                  border: '1.5px solid var(--ink-strong)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontFamily: 'var(--font-handwriting)', fontSize: 10, fontWeight: 700,
                                }}>
                                  {m.name.slice(0, 1)}
                                </div>
                              )}
                              {/* 이름 + km */}
                              <span style={{
                                fontSize: 10, color: 'var(--ink-muted)',
                                whiteSpace: 'nowrap', marginTop: 1,
                                background: 'rgba(250,250,247,0.85)',
                                padding: '0 2px',
                              }}>
                                {m.km.toFixed(0)}
                              </span>
                            </div>
                          );
                        })}

                        {/* 깃발 (목표) */}
                        <div style={{
                          position: 'absolute', right: 0, top: 4,
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                        }}>
                          <div style={{
                            width: 0, height: 0,
                            borderLeft: '8px solid var(--jeok)',
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                            marginLeft: 1.5,
                          }} />
                          <div style={{
                            width: 1.5, height: 16,
                            background: 'var(--ink-strong)',
                          }} />
                        </div>
                      </div>
                    )}

                    {/* 하단: 상태 + 들어가기 */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', fontSize: 13,
                      color: 'var(--ink-muted)',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-penscript)', fontSize: 18,
                        color: 'var(--ink-strong)',
                      }}>
                        들어가기 →
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
