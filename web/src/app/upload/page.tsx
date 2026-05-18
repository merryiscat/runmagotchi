/**
 * 업로드 페이지 (U1)
 *
 * 런닝 기록 수동 입력 → 토큰 계산 → runs 테이블 저장 → 캐릭터에 토큰 적립 → 대시보드로 이동.
 * 토큰 공식: km × 10 (기본). 추후 빈도/다양성 보너스 추가 예정.
 * VLM 파싱은 이후 구현. 현재는 거리/시간/페이스/날짜 직접 입력.
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function UploadPage() {
  // 입력 폼 상태
  const [km, setKm] = useState('');
  const [minutes, setMinutes] = useState('');
  const [pace, setPace] = useState('');
  const [runDate, setRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();

  /** 확정 버튼 클릭 → 토큰 계산 + 저장 + 대시보드 이동 */
  async function handleConfirm() {
    if (!km || !minutes) { setMessage('거리와 시간을 입력해주세요'); return; }
    setSaving(true);
    setMessage('');

    // 로그인 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('로그인 필요'); setSaving(false); return; }

    // 활성 캐릭터 조회 (토큰 잔액도 함께, 여러 개 있어도 안전)
    const { data: chars } = await supabase
      .from('characters')
      .select('id, tokens')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    const character = chars?.[0] ?? null;

    if (!character) { setMessage('캐릭터가 없습니다'); setSaving(false); return; }

    // 토큰 계산: km × 10 (기본 공식)
    const distanceKm = parseFloat(km);
    const tokensEarned = Math.round(distanceKm * 10);

    // runs 테이블에 기록 저장
    const { error: runError } = await supabase.from('runs').insert({
      user_id: user.id,
      character_id: character.id,
      distance_km: distanceKm,
      duration_minutes: parseInt(minutes),
      pace: pace || null,
      run_date: runDate,
      tokens_earned: tokensEarned,
    });

    if (runError) { setMessage(`저장 실패: ${runError.message}`); setSaving(false); return; }

    // 캐릭터에 토큰 적립
    const newTokens = (character.tokens || 0) + tokensEarned;
    const { error: tokenError } = await supabase
      .from('characters')
      .update({ tokens: newTokens })
      .eq('id', character.id);

    if (tokenError) { setMessage(`토큰 적립 실패: ${tokenError.message}`); setSaving(false); return; }

    // 항상 대시보드로 이동
    window.location.href = '/dashboard';
  }

  // 인풋 공통 스타일
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 'var(--s-3)',
    border: '1px solid var(--line)', background: 'var(--surface)',
    fontSize: 'var(--fs-md)', fontFamily: 'inherit',
  };

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <div style={{ padding: 'var(--s-5)', maxWidth: 720, margin: '0 auto', width: '100%' }}>

        {/* 상단바 */}
        <div className="topbar">
          <a href="/dashboard" style={{ textDecoration: 'none', color: 'var(--ink-strong)' }}>← 돌아가기</a>
          <span className="topbar__title">업로드</span>
          <span style={{ width: 60 }} />
        </div>

        {/* 입력 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>

          <div className="field">
            <div className="field__label">거리 (km)</div>
            <input type="number" step="0.1" placeholder="5.2" value={km}
              onChange={e => setKm(e.target.value)} style={inputStyle} />
          </div>

          <div className="field">
            <div className="field__label">시간 (분)</div>
            <input type="number" placeholder="28" value={minutes}
              onChange={e => setMinutes(e.target.value)} style={inputStyle} />
          </div>

          <div className="field">
            <div className="field__label">페이스 (/km)</div>
            <input type="text" placeholder="05:32" value={pace}
              onChange={e => setPace(e.target.value)} style={inputStyle} />
          </div>

          <div className="field">
            <div className="field__label">날짜</div>
            <input type="date" value={runDate}
              onChange={e => setRunDate(e.target.value)} style={inputStyle} />
          </div>

          {/* 토큰 미리보기: 입력한 거리 기반 */}
          {km && parseFloat(km) > 0 && (
            <div style={{
              padding: 'var(--s-3) var(--s-4)',
              background: 'var(--clay-soft)',
              border: '1px solid var(--line-soft)',
              fontSize: 'var(--fs-sm)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span style={{ color: 'var(--ink-muted)' }}>획득 코인</span>
              <span style={{ fontWeight: 700 }}>🪙 {Math.round(parseFloat(km) * 10)}</span>
            </div>
          )}

          <div className="text-xs text-muted">확정 후 수정·삭제 불가</div>

          <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
            <a href="/dashboard" className="btn" style={{ flex: 1, textAlign: 'center' }}>취소</a>
            <button className="btn btn--primary" style={{ flex: 2 }}
              onClick={handleConfirm} disabled={saving}>
              {saving ? '저장 중...' : '확정'}
            </button>
          </div>
        </div>

        {/* 에러/성공 메시지 */}
        {message && (
          <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-sm)', textAlign: 'center',
            color: message.includes('실패') ? 'var(--jeok)' : 'var(--ink-muted)' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
