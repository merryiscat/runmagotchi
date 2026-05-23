/**
 * RoomActions — 코드 입장 + 새 트랙 생성
 *
 * 한글 입력 문제 해결:
 *   - ref 기반 비제어 입력 (uncontrolled)
 *   - 제출 시점에만 ref.current.value 읽음
 *   - React 상태로 value를 관리하지 않음 → IME 간섭 없음
 *
 * 모달 닫힘 문제 해결:
 *   - 배경 클릭 닫기 제거
 *   - 취소 버튼으로만 닫음
 */

'use client';

import { useState, useRef } from 'react';

interface Props {
  userId: string;
  characterId: string;
}

export default function RoomActions({ userId, characterId }: Props) {
  /* 어떤 모달이 열려있는지 ('code' | 'create' | null) */
  const [modal, setModal] = useState<'code' | 'create' | null>(null);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  /* 비제어 input ref — 한글 IME 간섭 방지 */
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const targetKmRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  /* ── 코드로 입장 ── */
  async function handleJoin() {
    const code = codeRef.current?.value.trim().toUpperCase();
    if (!code || code.length < 6 || !characterId) return;
    setJoining(true);
    setMessage('');

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        user_id: userId,
        character_id: characterId,
        code,
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

  /* ── 방 만들기 (이름 + 목표 한번에) ── */
  async function handleCreate() {
    const name = nameRef.current?.value.trim();
    if (!name || name.length < 2 || !characterId) return;

    const targetKm = Number(targetKmRef.current?.value) || 0;
    const startDate = startDateRef.current?.value || '';
    const endDate = endDateRef.current?.value || '';

    setCreating(true);
    setMessage('');

    /* 방 생성 */
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        user_id: userId,
        character_id: characterId,
        name,
      }),
    });
    const data = await res.json();

    if (!data.room) {
      setMessage(data.error || '생성 실패');
      setCreating(false);
      return;
    }

    /* 목표 설정 (입력했으면) */
    if (targetKm > 0 && startDate && endDate) {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-goal',
          user_id: userId,
          room_id: data.room.id,
          target_km: targetKm,
          start_date: startDate,
          end_date: endDate,
        }),
      });
    }

    window.location.href = `/room/${data.room.code}`;
  }

  /* ── 모달 닫기 ── */
  function closeModal() {
    setModal(null);
    setMessage('');
  }

  return (
    <>
      {/* 버튼 2개 */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 8 }}>
        <button
          className="btn"
          onClick={() => setModal('code')}
          style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, padding: '6px 14px' }}
        >
          코드
        </button>
        <button
          className="btn btn--primary"
          onClick={() => setModal('create')}
          style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, padding: '6px 14px' }}
        >
          새 트랙 +
        </button>
      </div>

      {/* ── 모달 ── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--s-4)',
        }}>
          <div
            /* 모달 내부 클릭이 배경으로 전파되지 않도록 차단 */
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--paper)',
              border: '1.5px solid var(--ink-strong)',
              boxShadow: '3px 3px 0 var(--ink-strong)',
              padding: 'var(--s-5)', width: '100%', maxWidth: 400,
              display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
            }}
          >
            {/* ── 코드 입력 ── */}
            {modal === 'code' && (
              <>
                <div style={{ fontFamily: 'var(--font-penscript)', fontSize: 24 }}>
                  초대 코드 입력
                </div>
                <input
                  ref={codeRef}
                  type="text"
                  placeholder="6자리 코드"
                  maxLength={6}
                  autoFocus
                  className="input"
                  style={{
                    fontFamily: 'var(--font-handwriting)', fontSize: 24,
                    letterSpacing: '0.3em', textAlign: 'center', textTransform: 'uppercase',
                  }}
                />
                <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
                  <button className="btn" style={{ flex: 1 }} onClick={closeModal}>취소</button>
                  <button
                    className="btn btn--primary" style={{ flex: 2 }}
                    onClick={handleJoin}
                    disabled={joining}
                  >
                    {joining ? '...' : '입장 →'}
                  </button>
                </div>
              </>
            )}

            {/* ── 방 만들기 ── */}
            {modal === 'create' && (
              <>
                <div style={{ fontFamily: 'var(--font-penscript)', fontSize: 24 }}>
                  새 트랙 만들기
                </div>

                {/* 트랙 이름 */}
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="트랙 이름"
                  autoFocus
                  className="input"
                  style={{ fontFamily: 'var(--font-handwriting)', fontSize: 18 }}
                />

                {/* 목표 설정 */}
                <div style={{
                  borderTop: '1px dashed var(--line)',
                  paddingTop: 'var(--s-3)',
                  marginTop: 'var(--s-1)',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-penscript)', fontSize: 18,
                    marginBottom: 'var(--s-2)',
                  }}>
                    팀 목표
                  </div>

                  {/* 목표 km */}
                  <div style={{ marginBottom: 'var(--s-2)' }}>
                    <label style={{
                      fontFamily: 'var(--font-handwriting)', fontSize: 13,
                      color: 'var(--ink-muted)', display: 'block', marginBottom: 2,
                    }}>
                      합산 목표 (km)
                    </label>
                    <input
                      ref={targetKmRef}
                      type="number"
                      placeholder="예: 100"
                      className="input"
                      style={{ fontFamily: 'var(--font-handwriting)', fontSize: 16 }}
                    />
                  </div>

                  {/* 기간 — 세로 배치 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                    <div>
                      <label style={{
                        fontFamily: 'var(--font-handwriting)', fontSize: 13,
                        color: 'var(--ink-muted)', display: 'block', marginBottom: 2,
                      }}>
                        시작일
                      </label>
                      <input
                        ref={startDateRef}
                        type="date"
                        className="input"
                        defaultValue={new Date().toISOString().split('T')[0]}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ fontFamily: 'var(--font-handwriting)', fontSize: 16, width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{
                        fontFamily: 'var(--font-handwriting)', fontSize: 13,
                        color: 'var(--ink-muted)', display: 'block', marginBottom: 2,
                      }}>
                        종료일
                      </label>
                      <input
                        ref={endDateRef}
                        type="date"
                        className="input"
                        defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ fontFamily: 'var(--font-handwriting)', fontSize: 16, width: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
                  <button className="btn" style={{ flex: 1 }} onClick={closeModal}>취소</button>
                  <button
                    className="btn btn--primary" style={{ flex: 2 }}
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? '만드는 중...' : '만들기'}
                  </button>
                </div>
              </>
            )}

            {/* 에러 메시지 */}
            {message && (
              <div style={{
                fontSize: 14, color: 'var(--ink-strong)', textAlign: 'center',
                fontFamily: 'var(--font-handwriting)',
              }}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
