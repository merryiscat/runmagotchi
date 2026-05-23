/**
 * 온보딩 페이지 — 닉네임 + 생년월일 + 튜토리얼
 *
 * 흐름:
 *   1. 닉네임 + 생년월일 입력 → 확정
 *   2. 튜토리얼 슬라이드 (대시보드/터치/상점/업로드 설명)
 *      └ 이 동안 백그라운드에서 사주 분석 + 알 생성
 *   3. 완료되면 "알 선택하기" 버튼 활성화
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 튜토리얼 스텝 — 대시보드 요소별 강조 ─── */

/**
 * highlight: 어떤 영역을 밝힐지 ('stage' | 'stats' | 'upload' | 'records' | 'gnb' | 'all')
 * title: 설명 제목
 * desc: 설명 내용
 * position: 설명 박스 위치 ('left' | 'right' | 'center')
 */
const STEPS = [
  {
    highlight: 'stage',
    title: '스테이지',
    desc: '런닝메이트가 살아가는 공간.\n자주 관심을 가져주세요.',
    position: 'right' as const,
  },
  {
    highlight: 'stats',
    title: '런닝 스탯',
    desc: '런닝 기록이 여기에 쌓입니다.\n거리, 횟수, 연속 일수를 확인하세요.',
    position: 'left' as const,
  },
  {
    highlight: 'upload',
    title: '기록 업로드',
    desc: '런닝 앱 스크린샷을 올리면\n거리에 따라 코인을 받습니다.',
    position: 'left' as const,
  },
  {
    highlight: 'records',
    title: '최근 기록',
    desc: '업로드한 기록이 여기에 표시됩니다.\n코인 획득 내역도 볼 수 있습니다.',
    position: 'left' as const,
  },
  {
    highlight: 'gnb',
    title: '상점 · withRUN',
    desc: '코인으로 먹이와 경험치 사탕을 구매.\nwithRUN에서 친구와 함께 달려보세요.',
    position: 'center' as const,
  },
  {
    highlight: 'all',
    title: '준비 완료',
    desc: '경험치가 쌓이면 런닝메이트가 진화합니다.\n어떻게 달렸는지가 외형에 반영됩니다.',
    position: 'center' as const,
  },
];

/* ─── 메인 ─── */

export default function OnboardingPage() {
  /* 입력 상태 */
  const [nickname, setNickname] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [message, setMessage] = useState('');

  /* 단계: 'form' → 'tutorial' */
  const [phase, setPhase] = useState<'form' | 'tutorial'>('form');

  /* 튜토리얼 슬라이드 인덱스 */
  const [slideIdx, setSlideIdx] = useState(0);

  /* 백그라운드 API 완료 여부 */
  const [apiDone, setApiDone] = useState(false);
  const [apiError, setApiError] = useState('');

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

  /* ── 확정 → 튜토리얼 전환 + 백그라운드 API ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    /* 즉시 튜토리얼로 전환 */
    setPhase('tutorial');

    /* 백그라운드에서 API 처리 */
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setApiError('로그인 필요'); return; }

      const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const signupHour = new Date().getHours();

      /* 프로필 저장 */
      await supabase
        .from('profiles')
        .upsert({ id: user.id, nickname, birth_date: birthDate, signup_hour: signupHour });

      /* 사주 분석 */
      const res = await fetch('/api/saju-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate, gender: 'male', nickname, birthHour: signupHour }),
      });
      const data = await res.json();
      if (data.error) { setApiError(`분석 실패: ${data.error}`); return; }

      /* 사주 결과 저장 */
      await supabase
        .from('profiles')
        .update({ saju_reading: data.reading })
        .eq('id', user.id);

      /* 알 3장 생성 */
      const eggRes = await fetch('/api/generate-eggs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading: data.reading }),
      });
      const eggData = await eggRes.json();
      if (eggData.error) { setApiError(`알 생성 실패: ${eggData.error}`); return; }

      /* Storage 업로드 */
      const eggMeta = [];
      for (let i = 0; i < eggData.eggs.length; i++) {
        const egg = eggData.eggs[i];
        const ts = Date.now();
        const fileName = `${user.id}/egg-${i}-${ts}.png`;
        const imageBytes = Uint8Array.from(atob(egg.image), c => c.charCodeAt(0));

        await supabase.storage
          .from('eggs')
          .upload(fileName, imageBytes, { contentType: 'image/png', upsert: true });

        const { data: urlData } = supabase.storage.from('eggs').getPublicUrl(fileName);

        eggMeta.push({
          url: urlData.publicUrl,
          combo: egg.combo,
          pattern: egg.pattern,
          colors: egg.colors,
        });
      }

      await supabase
        .from('profiles')
        .update({ egg_choices: eggMeta })
        .eq('id', user.id);

      /* 완료 */
      setApiDone(true);

    } catch {
      setApiError('처리 중 오류 발생');
    }
  }

  /* 셀렉트 공통 스타일 */
  const selectStyle: React.CSSProperties = {
    padding: 'var(--s-3)', border: '1px solid var(--line)',
    background: 'var(--surface)', color: 'var(--ink-strong)',
    fontSize: 'var(--fs-md)', fontFamily: 'inherit', cursor: 'pointer',
  };

  /* 현재 스텝 */
  const step = STEPS[slideIdx];
  const isLastStep = slideIdx === STEPS.length - 1;

  /* 영역 밝힘 여부 — highlight 아닌 영역은 어둡게 */
  function isLit(area: string) {
    return step.highlight === 'all' || step.highlight === area;
  }

  /* ─── 폼 화면 ─── */
  if (phase === 'form') {
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
            <button type="submit" disabled={!isValid} style={{
              width: '100%', padding: 'var(--s-4) var(--s-5)',
              background: 'var(--jeok)', color: 'var(--on-jeok)',
              border: '1px solid var(--jeok)', fontSize: 'var(--fs-lg)',
              fontWeight: 700, cursor: !isValid ? 'not-allowed' : 'pointer',
              opacity: !isValid ? 0.5 : 1, fontFamily: 'inherit',
              marginTop: 'var(--s-3)',
            }}>
              확정
            </button>
          </form>

          {message && (
            <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-sm)', color: 'var(--ink-strong)', textAlign: 'center' }}>{message}</p>
          )}
        </div>
      </div>
    );
  }

  /* ─── 튜토리얼 — 대시보드 모킹 + 스포트라이트 오버레이 ─── */

  /**
   * 각 영역에 data-area 속성을 부여하고,
   * 해당 영역의 위치를 ref로 잡아서 스포트라이트 구멍을 뚫는 방식.
   *
   * 간소화: 영역별 고정 좌표 대신 CSS box-shadow 스포트라이트 사용.
   * - 강조 영역에 position: relative + z-index: 3
   * - 나머지는 오버레이 아래 (정상 렌더링, 어둡게 덮임)
   */

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--paper)', position: 'relative',
    }}>

      {/* ── 대시보드 모킹 (정상 렌더링) ── */}
      <div className="gnb">
        <span className="gnb__logo">
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 28 }} />
        </span>
        <nav className="gnb__nav" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          <span style={{
            fontWeight: 700, fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-handwriting)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--hwang)', color: 'var(--on-hwang)',
              fontSize: 9, fontWeight: 900, fontFamily: 'serif',
            }}>₩</span>
            0
          </span>
          <span style={{ width: 1, height: 14, background: 'var(--line-soft)' }} />
          <span style={{ color: 'var(--ink-strong)', fontWeight: 700 }}>대시보드</span>
          <span style={{ color: 'var(--ink-muted)' }}>withRUN</span>
          <span style={{ color: 'var(--ink-muted)' }}>상점</span>
          <span style={{ color: 'var(--ink-muted)' }}>프로필</span>
        </nav>
      </div>

      <div className="m1-layout" style={{ flex: 1 }}>
        {/* 스테이지 */}
        <div className="stage" style={{ minHeight: 400, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: '50%', top: '40%',
            transform: 'translate(-50%, -50%)',
            width: 100, height: 100, borderRadius: '50%',
            background: 'var(--clay-soft)', border: '1.5px dashed var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-handwriting)', fontSize: 14, color: 'var(--ink-faint)',
          }}>
            런닝메이트
          </div>
          <div className="stage__footer">
            <div style={{ fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)', textAlign: 'center' }}>???</div>
          </div>
        </div>

        {/* 패널 */}
        <div className="panel" style={{ fontFamily: 'var(--font-handwriting)' }}>
          <div className="panel__section">
            <div className="row row--between mb-4">
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-penscript)', fontSize: 18 }}>런닝 스탯</span>
              <span className="text-xs text-muted">이번 달</span>
            </div>
            <div className="stats-row">
              <div><div className="stat-v">0</div><div className="stat-l">km</div></div>
              <div><div className="stat-v">0</div><div className="stat-l">회</div></div>
              <div><div className="stat-v">0</div><div className="stat-l">일 연속</div></div>
            </div>
          </div>
          <div className="panel__section">
            <div className="btn btn--primary btn--full btn--lg"
              style={{ fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)', textAlign: 'center' }}>
              기록 업로드
            </div>
          </div>
          <div className="panel__section" style={{ flex: 1 }}>
            <div className="row row--between mb-3">
              <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, fontWeight: 700 }}>최근 기록</span>
            </div>
            <div style={{ padding: 'var(--s-3) 0', fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)' }}>기록 없음</div>
          </div>
        </div>
      </div>

      {/* ── 오버레이 + 스포트라이트 (하나의 div) ──
        box-shadow 9999px로 강조 영역 바깥을 전부 어둡게 덮음.
        강조 영역 안은 투명 → 대시보드가 그대로 보임. */}
      <div style={{
        position: 'fixed',
        ...(step.highlight === 'all'
          ? { inset: 0, border: 'none', boxShadow: 'none' }
          : {
              ...(step.highlight === 'stage' ? { top: 48, left: 0, width: '65%', bottom: 180 } :
                 step.highlight === 'stats' ? { top: 48, left: '65%', right: 0, height: 140 } :
                 step.highlight === 'upload' ? { top: 188, left: '65%', right: 0, height: 80 } :
                 step.highlight === 'records' ? { top: 268, left: '65%', right: 0, bottom: 180 } :
                 step.highlight === 'gnb' ? { top: 0, left: 0, right: 0, height: 48 } :
                 {}),
              border: '3px solid var(--jeok)',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            }),
        zIndex: 5,
        pointerEvents: 'none',
        transition: 'all 0.4s ease',
      }} />

      {/* ── 설명 (투명 배경, 화면 위에 떠 있음) ── */}
      <div style={{
        position: 'fixed',
        bottom: 'var(--s-5)', left: 'var(--s-4)', right: 'var(--s-4)',
        zIndex: 10,
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          maxWidth: 480, width: '100%',
          background: 'rgba(250, 250, 247, 0.92)',
          border: '1.5px solid var(--ink-strong)',
          padding: 'var(--s-4) var(--s-5)',
          boxShadow: '3px 3px 0 var(--ink-strong)',
        }}>
          <div style={{
            fontFamily: 'var(--font-penscript)', fontSize: 32,
            fontWeight: 700, marginBottom: 'var(--s-2)', textAlign: 'center',
          }}>
            {step.title}
          </div>
          <div style={{
            fontFamily: 'var(--font-handwriting)', fontSize: 20,
            color: 'var(--ink-default)', lineHeight: 1.7,
            whiteSpace: 'pre-line', textAlign: 'center',
            marginBottom: 'var(--s-4)',
          }}>
            {step.desc}
          </div>

          {/* 인디케이터 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 'var(--s-3)' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === slideIdx ? 20 : 6, height: 6,
                background: i === slideIdx ? 'var(--ink-strong)' : 'var(--line)',
                transition: 'width 0.2s',
              }} />
            ))}
          </div>

          {/* 버튼 */}
          {isLastStep ? (
            <button
              onClick={() => { window.location.href = '/egg-select'; }}
              disabled={!apiDone}
              style={{
                width: '100%', padding: 'var(--s-3)',
                background: apiDone ? 'var(--jeok)' : 'var(--line)',
                color: apiDone ? 'var(--on-jeok)' : 'var(--ink-faint)',
                border: 'none', fontSize: 'var(--fs-xl)',
                fontWeight: 700, fontFamily: 'inherit',
                cursor: apiDone ? 'pointer' : 'not-allowed',
              }}
            >
              {apiDone ? '알 선택하기' : '준비 중...'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
              <button
                onClick={() => setSlideIdx(STEPS.length - 1)}
                style={{
                  flex: 1, padding: 'var(--s-3)',
                  background: 'none', border: '1px solid var(--line)',
                  fontFamily: 'var(--font-handwriting)', fontSize: 'var(--fs-md)',
                  color: 'var(--ink-muted)', cursor: 'pointer',
                }}
              >
                건너뛰기
              </button>
              <button
                onClick={() => setSlideIdx(i => i + 1)}
                style={{
                  flex: 2, padding: 'var(--s-3)',
                  background: 'var(--ink-strong)', border: 'none',
                  color: 'var(--paper)', fontFamily: 'inherit',
                  fontSize: 'var(--fs-lg)', fontWeight: 700, cursor: 'pointer',
                }}
              >
                다음
              </button>
            </div>
          )}
          {apiError && (
            <p style={{ marginTop: 'var(--s-2)', fontSize: 'var(--fs-sm)', color: 'var(--ink-strong)', textAlign: 'center' }}>{apiError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
