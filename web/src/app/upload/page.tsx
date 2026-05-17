/**
 * 업로드 페이지 (U1)
 *
 * 런닝 기록 수동 입력 → runs 테이블 저장 → 누적 10km 체크 → 부화 트리거.
 * VLM 파싱은 이후 구현. 현재는 거리/시간/페이스/날짜 직접 입력.
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function UploadPage() {
  const [km, setKm] = useState('');
  const [minutes, setMinutes] = useState('');
  const [pace, setPace] = useState('');
  const [runDate, setRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();

  async function handleConfirm() {
    if (!km || !minutes) { setMessage('거리와 시간을 입력해주세요'); return; }
    setSaving(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('로그인 필요'); setSaving(false); return; }

    // 활성 캐릭터 조회
    const { data: character } = await supabase
      .from('characters')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!character) { setMessage('캐릭터가 없습니다'); setSaving(false); return; }

    // EXP 계산: km × 10 (기본)
    const distanceKm = parseFloat(km);
    const expEarned = Math.round(distanceKm * 10);

    // runs 테이블에 저장
    const { error } = await supabase.from('runs').insert({
      user_id: user.id,
      character_id: character.id,
      distance_km: distanceKm,
      duration_minutes: parseInt(minutes),
      pace: pace || null,
      run_date: runDate,
      exp_earned: expEarned,
    });

    if (error) { setMessage(`저장 실패: ${error.message}`); setSaving(false); return; }

    // 누적 거리 확인 → 10km 이상이면 부화 체크
    const { data: runs } = await supabase
      .from('runs')
      .select('distance_km')
      .eq('character_id', character.id);

    const totalKm = runs?.reduce((sum, r) => sum + Number(r.distance_km), 0) || 0;

    if (totalKm >= 10) {
      // 부화 조건 충족 → hatching 페이지로
      window.location.href = '/hatching';
    } else {
      setMessage(`기록 저장 완료! (누적 ${totalKm.toFixed(1)}km / 10km)`);
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 'var(--s-3)',
    border: '1px solid var(--line)', background: 'var(--surface)',
    fontSize: 'var(--fs-md)', fontFamily: 'inherit',
  };

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <div style={{ padding: 'var(--s-5)', maxWidth: 720, margin: '0 auto', width: '100%' }}>

        {/* Topbar */}
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

          <div className="text-xs text-muted">확정 후 수정·삭제 불가</div>

          <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
            <a href="/dashboard" className="btn" style={{ flex: 1, textAlign: 'center' }}>취소</a>
            <button className="btn btn--primary" style={{ flex: 2 }}
              onClick={handleConfirm} disabled={saving}>
              {saving ? '저장 중...' : '확정'}
            </button>
          </div>
        </div>

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
