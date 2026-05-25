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
 *
 * 운영 목표 프리셋:
 *   - 모달 열릴 때 프리셋 목록 fetch
 *   - 주간/월간 탭 → 카드 선택 → 자동 채움
 *   - 목표 km은 최소치 (프리셋 이상만 입력 가능)
 *   - "직접 설정" 선택 시 자유 입력
 */

'use client';

import { useState, useRef, useEffect } from 'react';

/* ─── 프리셋 타입 ─── */

interface GoalPreset {
  id: string;
  title: string;
  type: 'weekly' | 'monthly';
  target_km: number;
  duration_days: number;
  reward_tokens: number;
  reward_exp: number;
}

/* ─── Props ─── */

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

  /* 프리셋 관련 상태 */
  const [presets, setPresets] = useState<GoalPreset[]>([]);
  const [presetTab, setPresetTab] = useState<'weekly' | 'monthly'>('weekly');
  /* null = 직접 설정, string = 선택된 프리셋 id */
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  /* 비제어 input ref — 한글 IME 간섭 방지 */
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const targetKmRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  /* ── 모달 열릴 때 프리셋 로드 ── */
  useEffect(() => {
    if (modal !== 'create') return;
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-presets' }),
    })
      .then(r => r.json())
      .then(d => setPresets(d.presets || []))
      .catch(() => {});
  }, [modal]);

  /* 선택된 프리셋 객체 */
  const activePreset = presets.find(p => p.id === selectedPreset) || null;

  /* ── 프리셋 선택 시 input 값 자동 채움 ── */
  function applyPreset(preset: GoalPreset) {
    setSelectedPreset(preset.id);

    /* 목표 km → 프리셋 최소치로 설정 */
    if (targetKmRef.current) {
      targetKmRef.current.value = String(preset.target_km);
      targetKmRef.current.min = String(preset.target_km);
    }

    /* 기간 자동 계산 (시작: 오늘, 종료: +duration_days) */
    const today = new Date();
    const end = new Date(today.getTime() + preset.duration_days * 24 * 60 * 60 * 1000);
    if (startDateRef.current) startDateRef.current.value = today.toISOString().split('T')[0];
    if (endDateRef.current) endDateRef.current.value = end.toISOString().split('T')[0];
  }

  /* ── "직접 설정" 선택 ── */
  function clearPreset() {
    setSelectedPreset(null);
    if (targetKmRef.current) {
      targetKmRef.current.value = '';
      targetKmRef.current.min = '0';
    }
  }

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

    let targetKm = Number(targetKmRef.current?.value) || 0;
    const startDate = startDateRef.current?.value || '';
    const endDate = endDateRef.current?.value || '';

    /* 프리셋 최소치 검증 */
    if (activePreset && targetKm < activePreset.target_km) {
      targetKm = activePreset.target_km;
    }

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
          preset_id: selectedPreset || undefined,
          reward_tokens: activePreset?.reward_tokens || 0,
          reward_exp: activePreset?.reward_exp || 0,
        }),
      });
    }

    window.location.href = `/room/${data.room.code}`;
  }

  /* ── 모달 닫기 ── */
  function closeModal() {
    setModal(null);
    setMessage('');
    setSelectedPreset(null);
  }

  /* ── 탭별 프리셋 필터 ── */
  const filteredPresets = presets.filter(p => p.type === presetTab);

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
              maxHeight: '85vh', overflowY: 'auto',
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

                {/* ═══ 운영 목표 프리셋 ═══ */}
                {presets.length > 0 && (
                  <div style={{
                    borderTop: '1px dashed var(--line)',
                    paddingTop: 'var(--s-3)',
                    marginTop: 'var(--s-1)',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-penscript)', fontSize: 18,
                      marginBottom: 'var(--s-2)',
                    }}>
                      운영 목표
                    </div>

                    {/* 주간 / 월간 탭 */}
                    <div style={{ display: 'flex', gap: 'var(--s-2)', marginBottom: 'var(--s-3)' }}>
                      {(['weekly', 'monthly'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setPresetTab(tab)}
                          style={{
                            flex: 1, padding: '6px 0',
                            border: presetTab === tab ? '1.5px solid var(--ink-strong)' : '1px solid var(--line)',
                            background: presetTab === tab ? 'var(--ink-strong)' : 'var(--paper)',
                            color: presetTab === tab ? 'var(--paper)' : 'var(--ink-default)',
                            fontFamily: 'var(--font-handwriting)', fontSize: 14,
                            cursor: 'pointer',
                          }}
                        >
                          {tab === 'weekly' ? '주간' : '월간'}
                        </button>
                      ))}
                    </div>

                    {/* 프리셋 카드 목록 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
                      {filteredPresets.map(p => {
                        const isSelected = selectedPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => isSelected ? clearPreset() : applyPreset(p)}
                            style={{
                              padding: '10px 12px',
                              border: isSelected ? '2px solid var(--cheong)' : '1px solid var(--line)',
                              background: isSelected ? 'var(--clay-soft)' : 'var(--paper)',
                              cursor: 'pointer', textAlign: 'left',
                              display: 'flex', flexDirection: 'column', gap: 4,
                            }}
                          >
                            {/* 제목 */}
                            <div style={{
                              fontFamily: 'var(--font-handwriting)', fontSize: 15, fontWeight: 700,
                              color: 'var(--ink-strong)',
                            }}>
                              {p.title}
                              {isSelected && <span style={{ color: 'var(--cheong)', marginLeft: 6 }}>✓</span>}
                            </div>
                            {/* 상세: km + 기간 + 보상 */}
                            <div style={{
                              fontFamily: 'var(--font-handwriting)', fontSize: 12,
                              color: 'var(--ink-muted)',
                              display: 'flex', gap: 'var(--s-3)',
                            }}>
                              <span>{p.target_km}km 이상</span>
                              <span>{p.duration_days}일</span>
                              {(p.reward_tokens > 0 || p.reward_exp > 0) && (
                                <span style={{ color: 'var(--hwang)' }}>
                                  {p.reward_tokens > 0 && `₩${p.reward_tokens}`}
                                  {p.reward_tokens > 0 && p.reward_exp > 0 && ' + '}
                                  {p.reward_exp > 0 && `${p.reward_exp}EXP`}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* 직접 설정 옵션 */}
                      <button
                        onClick={clearPreset}
                        style={{
                          padding: '8px 12px',
                          border: selectedPreset === null ? '2px solid var(--cheong)' : '1px dashed var(--line)',
                          background: selectedPreset === null ? 'var(--clay-soft)' : 'var(--paper)',
                          cursor: 'pointer', textAlign: 'center',
                          fontFamily: 'var(--font-handwriting)', fontSize: 14,
                          color: 'var(--ink-muted)',
                        }}
                      >
                        직접 설정
                        {selectedPreset === null && <span style={{ color: 'var(--cheong)', marginLeft: 6 }}>✓</span>}
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══ 목표 세부 설정 ═══ */}
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

                  {/* 프리셋 선택 시 안내 문구 */}
                  {activePreset && (
                    <div style={{
                      fontFamily: 'var(--font-handwriting)', fontSize: 12,
                      color: 'var(--cheong)', marginBottom: 'var(--s-2)',
                    }}>
                      최소 {activePreset.target_km}km · 더 높은 목표로 변경 가능
                    </div>
                  )}

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
                      min={activePreset ? activePreset.target_km : 0}
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

                  {/* 보상 표시 (프리셋 선택 시) */}
                  {activePreset && (activePreset.reward_tokens > 0 || activePreset.reward_exp > 0) && (
                    <div style={{
                      marginTop: 'var(--s-3)',
                      padding: '8px 12px',
                      background: 'var(--clay-soft)',
                      border: '1px solid var(--line)',
                      fontFamily: 'var(--font-handwriting)', fontSize: 13,
                      display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                    }}>
                      <span style={{ color: 'var(--ink-muted)' }}>달성 보상:</span>
                      {activePreset.reward_tokens > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 14, height: 14, borderRadius: '50%',
                            background: 'var(--hwang)', color: 'var(--on-hwang)',
                            fontSize: 8, fontWeight: 900, fontFamily: 'serif',
                          }}>₩</span>
                          {activePreset.reward_tokens}
                        </span>
                      )}
                      {activePreset.reward_exp > 0 && (
                        <span style={{ color: 'var(--cheong)', fontWeight: 700 }}>
                          +{activePreset.reward_exp} EXP
                        </span>
                      )}
                    </div>
                  )}
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
