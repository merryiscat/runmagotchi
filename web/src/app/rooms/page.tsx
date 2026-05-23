/**
 * withRUN — 방 목록/관리 페이지
 *
 * 서버 컴포넌트: 데이터 즉시 렌더링, 딜레이 없음.
 * 인터랙션(방 만들기/코드 입장)은 RoomActions 클라이언트 컴포넌트.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GNB from '@/components/GNB';
import RoomActions from '@/components/RoomActions';

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

  let rooms: Array<{ id: string; code: string; name: string; owner_id: string }> = [];
  if (myMembers && myMembers.length > 0) {
    const roomIds = myMembers.map(r => r.room_id);
    const { data: roomData } = await supabase
      .from('rooms')
      .select('id, code, name, owner_id')
      .in('id', roomIds);
    rooms = roomData || [];
  }

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <GNB active="rooms" coins={character.tokens || 0} />

      <div style={{
        padding: 'var(--s-5)', maxWidth: 600, margin: '0 auto', width: '100%',
        fontFamily: 'var(--font-handwriting)',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-penscript)', fontSize: 28,
          marginBottom: 'var(--s-5)',
        }}>
          withRUN
        </h1>

        {/* 코드 입장 + 방 만들기 (클라이언트) */}
        <RoomActions userId={user.id} characterId={character.id} />

        {/* 내 방 목록 (서버에서 이미 로드됨) */}
        <div>
          <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 20, fontWeight: 700 }}>
            내 방
          </span>

          {rooms.length === 0 ? (
            <div className="text-sm text-muted" style={{ padding: 'var(--s-4) 0' }}>
              참여 중인 방이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)', marginTop: 'var(--s-3)' }}>
              {rooms.map(room => (
                <a
                  key={room.id}
                  href={`/room/${room.code}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--s-3) var(--s-4)',
                    border: '1.5px solid var(--ink-strong)',
                    background: 'var(--paper)',
                    textDecoration: 'none', color: 'var(--ink-strong)',
                    boxShadow: '2px 2px 0 var(--ink-strong)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{room.name}</div>
                    <div className="text-xs text-muted">
                      코드: {room.code}
                      {room.owner_id === user.id && ' · 방장'}
                    </div>
                  </div>
                  <span style={{ fontSize: 20 }}>→</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
