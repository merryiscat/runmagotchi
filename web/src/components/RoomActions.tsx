/**
 * RoomActions — 방 만들기 + 코드 입장 (클라이언트 컴포넌트)
 *
 * 서버 컴포넌트(rooms/page.tsx)에서 방 목록은 이미 로드됨.
 * 여기서는 방 만들기/코드 입장 인터랙션만 처리.
 */

'use client';

import { useState } from 'react';

interface Props {
  userId: string;
  characterId: string;
}

export default function RoomActions({ userId, characterId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState('');

  /* ── 방 만들기 ── */
  async function handleCreate() {
    if (!newName.trim() || !characterId) return;
    setCreating(true);

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        user_id: userId,
        character_id: characterId,
        name: newName.trim(),
      }),
    });
    const data = await res.json();

    if (data.room) {
      window.location.href = `/room/${data.room.code}`;
    } else {
      setMessage(data.error || '생성 실패');
      setCreating(false);
    }
  }

  /* ── 코드로 참여 ── */
  async function handleJoin() {
    if (!joinCode.trim() || !characterId) return;
    setJoining(true);

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        user_id: userId,
        character_id: characterId,
        code: joinCode.trim(),
      }),
    });
    const data = await res.json();

    if (data.room) {
      window.location.href = `/room/${data.room.code}`;
    } else {
      setMessage(data.error || '참여 실패');
      setJoining(false);
    }
  }

  return (
    <>
      {/* 코드 입장 */}
      <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-5)' }}>
        <input
          className="input"
          type="text"
          placeholder="초대 코드 입력"
          maxLength={6}
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
        />
        <button
          className="btn btn--primary"
          onClick={handleJoin}
          disabled={joinCode.length < 6 || joining}
        >
          {joining ? '...' : '입장'}
        </button>
      </div>

      {/* 방 만들기 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--s-3)' }}>
        <button className="btn" onClick={() => setShowCreate(true)} style={{ fontSize: 14 }}>
          + 방 만들기
        </button>
      </div>

      {/* 방 만들기 모달 */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--s-4)',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--ink-strong)',
            padding: 'var(--s-5)', width: '100%', maxWidth: 360,
            display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
            fontFamily: 'var(--font-handwriting)',
          }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>방 만들기</div>
            <input
              className="input"
              type="text"
              placeholder="방 이름 (2~20자)"
              maxLength={20}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>취소</button>
              <button
                className="btn btn--primary" style={{ flex: 2 }}
                onClick={handleCreate}
                disabled={newName.trim().length < 2 || creating}
              >
                {creating ? '만드는 중...' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {message && (
        <div style={{
          marginTop: 'var(--s-3)', padding: 'var(--s-3)',
          border: '1px solid var(--jeok)', color: 'var(--jeok)',
          fontSize: 'var(--fs-sm)', textAlign: 'center',
        }}>
          {message}
        </div>
      )}
    </>
  );
}
