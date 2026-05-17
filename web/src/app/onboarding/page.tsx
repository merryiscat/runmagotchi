/**
 * 온보딩 페이지 — 닉네임 + 생년월일
 *
 * 기획안 패턴: frame--web + 센터 콘텐츠.
 * 확정 후 사주 분석 API 호출 → 결과를 Supabase에 저장 → 알 선택으로.
 */

'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const [nickname, setNickname] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear; y >= currentYear - 100; y--) arr.push(y);
    return arr;
  }, [currentYear]);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = useMemo(() => {
    if (!year || !month) return Array.from({ length: 31 }, (_, i) => i + 1);
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => i + 1);
  }, [year, month]);

  const isValid = nickname.length >= 2 && year && month && day;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('로그인 필요'); setLoading(false); return; }

    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 가입 시각 기록 (시주 계산에 사용)
    const signupTime = new Date();
    const signupHour = signupTime.getHours();

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, nickname, birth_date: birthDate, signup_hour: signupHour });

    if (error) { setMessage(`저장 실패: ${error.message}`); setLoading(false); return; }

    // 분석 API 호출
    setMessage('분석 중...');
    try {
      const res = await fetch('/api/saju-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate, gender: 'male', nickname, birthHour: signupHour }),
      });
      const data = await res.json();
      if (data.error) { setMessage(`분석 실패: ${data.error}`); setLoading(false); return; }

      // 사주 결과 저장
      const { error: sajuErr } = await supabase
        .from('profiles')
        .update({ saju_reading: data.reading })
        .eq('id', user.id);
      if (sajuErr) { setMessage(`저장 실패: ${sajuErr.message}`); setLoading(false); return; }

      // ── 알 이미지 3장 생성 (동물 조합 + 색상 + 무늬) ──
      setMessage('알 생성 중...');
      const eggRes = await fetch('/api/generate-eggs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading: data.reading }),
      });
      const eggData = await eggRes.json();
      if (eggData.error) { setMessage(`알 생성 실패: ${eggData.error}`); setLoading(false); return; }

      // 알 이미지를 Supabase Storage에 업로드, URL만 DB에 저장
      setMessage('알 저장 중...');
      const eggMeta = [];
      for (let i = 0; i < eggData.eggs.length; i++) {
        const egg = eggData.eggs[i];
        const ts = Date.now();
        const fileName = `${user.id}/egg-${i}-${ts}.png`;
        const imageBytes = Uint8Array.from(atob(egg.image), c => c.charCodeAt(0));

        // Storage에 업로드
        const { error: uploadErr } = await supabase.storage
          .from('eggs')
          .upload(fileName, imageBytes, {
            contentType: 'image/png',
            upsert: true,
          });
        if (uploadErr) { setMessage(`업로드 실패: ${uploadErr.message}`); setLoading(false); return; }

        // 공개 URL 가져오기
        const { data: urlData } = supabase.storage.from('eggs').getPublicUrl(fileName);

        eggMeta.push({
          url: urlData.publicUrl,
          combo: egg.combo,
          pattern: egg.pattern,
          colors: egg.colors,
        });
      }

      const { error: eggErr } = await supabase
        .from('profiles')
        .update({ egg_choices: eggMeta })
        .eq('id', user.id);
      if (eggErr) { setMessage(`저장 실패: ${eggErr.message}`); setLoading(false); return; }

    } catch {
      setMessage('처리 중 오류 발생');
      setLoading(false);
      return;
    }

    window.location.href = '/egg-select';
  }

  /* 셀렉트 공통 스타일 */
  const selectStyle: React.CSSProperties = {
    padding: 'var(--s-3)', border: '1px solid var(--line)',
    background: 'var(--surface)', color: 'var(--ink-strong)',
    fontSize: 'var(--fs-md)', fontFamily: 'inherit', cursor: 'pointer',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper"
         style={{ border: '1px solid var(--line-strong)' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: 'var(--s-5)', textAlign: 'center' }}>

        {/* 로고 */}
        <div style={{ marginBottom: 'var(--s-5)' }}>
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 48, margin: '0 auto' }} />
        </div>
        <p style={{ fontSize: 'var(--fs-md)', color: 'var(--ink-muted)', marginBottom: 'var(--s-6)' }}>
          프로필을 입력해주세요
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 'var(--s-4)', textAlign: 'left' }}>

          {/* 닉네임 */}
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-muted)', display: 'block', marginBottom: 'var(--s-1)' }}>닉네임</label>
            <input type="text" placeholder="2~12자" value={nickname}
              onChange={(e) => setNickname(e.target.value)} required minLength={2} maxLength={12}
              style={{
                width: '100%', padding: 'var(--s-3)', border: '1px solid var(--line)',
                background: 'var(--surface)', color: 'var(--ink-strong)',
                fontSize: 'var(--fs-md)', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 생년월일 */}
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-muted)', display: 'block', marginBottom: 'var(--s-1)' }}>생년월일</label>
            <div className="flex" style={{ gap: 'var(--s-2)' }}>
              <select value={year} onChange={(e) => setYear(e.target.value)} required
                style={{ ...selectStyle, flex: 1, color: year ? 'var(--ink-strong)' : 'var(--ink-faint)' }}>
                <option value="" disabled>연도</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={month} onChange={(e) => setMonth(e.target.value)} required
                style={{ ...selectStyle, width: 80, color: month ? 'var(--ink-strong)' : 'var(--ink-faint)' }}>
                <option value="" disabled>월</option>
                {months.map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
              <select value={day} onChange={(e) => setDay(e.target.value)} required
                style={{ ...selectStyle, width: 80, color: day ? 'var(--ink-strong)' : 'var(--ink-faint)' }}>
                <option value="" disabled>일</option>
                {days.map(d => <option key={d} value={d}>{d}일</option>)}
              </select>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)', marginTop: 'var(--s-1)' }}>변경 불가</p>
          </div>

          {/* 확정 */}
          <button type="submit" disabled={loading || !isValid} style={{
            width: '100%', padding: 'var(--s-4) var(--s-5)',
            background: 'var(--jeok)', color: 'var(--on-jeok)',
            border: '1px solid var(--jeok)', fontSize: 'var(--fs-lg)',
            fontWeight: 700, cursor: (loading || !isValid) ? 'not-allowed' : 'pointer',
            opacity: (loading || !isValid) ? 0.5 : 1, fontFamily: 'inherit',
            marginTop: 'var(--s-3)',
          }}>
            {loading ? '분석 중...' : '확정'}
          </button>
        </form>

        {message && (
          <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-sm)', color: 'var(--jeok)', textAlign: 'center' }}>{message}</p>
        )}
      </div>
    </div>
  );
}
