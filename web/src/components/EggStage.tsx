/**
 * EggStage — 알 상태 전용 인터랙션
 *
 * 터치로만 애정을 쌓아 부화시키는 컴포넌트.
 * 100 터치 = 1 애정, 10,000 터치 = 부화 (애정 100).
 *
 * 흔들림 연출:
 *   30% — 가끔 미세하게 흔들림
 *   50% — 종종 중간 강도로
 *   70% — 자주 세게
 *   90% — 거의 계속 + 균열 느낌
 *
 * 레벨/수치는 절대 표시하지 않음.
 * 알이 점점 흔들리는 것으로만 부화가 다가옴을 전달.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import {
  calcEggTouch,
  getEggShakeLevel,
  type EggShakeLevel,
} from '@/lib/behavior';

interface Props {
  characterId: string;
  eggImageUrl: string;
  /** 현재 누적 터치 수 (DB에서 로드) */
  initialTouches: number;
  /** 현재 애정 (DB에서 로드) */
  initialAffection: number;
}

export default function EggStage({
  characterId,
  eggImageUrl,
  initialTouches,
  initialAffection,
}: Props) {
  const [touches, setTouches] = useState(initialTouches);
  const [affection, setAffection] = useState(initialAffection);
  const [isShaking, setIsShaking] = useState(false);
  const [hatching, setHatching] = useState(false);
  const [showNaming, setShowNaming] = useState(false);
  const [charName, setCharName] = useState('');
  const [namingSaving, setNamingSaving] = useState(false);

  /* 터치 메시지 (하트 이펙트) */
  const [hearts, setHearts] = useState<Array<{
    uid: string; x: number; y: number;
  }>>([]);

  const supabase = createClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── DB에서 애정 폴링 (아이템 사용 반영, 3초마다) ── */
  useEffect(() => {
    const poll = setInterval(async () => {
      if (hatching) return;
      const { data } = await supabase
        .from('characters')
        .select('affection')
        .eq('id', characterId)
        .single();
      if (data && data.affection > affection) {
        setAffection(data.affection);
        /* 부화 체크 */
        if (data.affection >= 100) {
          setHatching(true);
          setTimeout(() => setShowNaming(true), 2000);
        }
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [affection, hatching, characterId, supabase]);

  /* ── 주기적 흔들림 ── */
  useEffect(() => {
    const level = getEggShakeLevel(affection);

    /* 이전 타이머 정리 */
    if (shakeTimer.current) clearInterval(shakeTimer.current);

    if (!level) return;

    /* 해당 단계의 간격으로 흔들림 반복 */
    function doShake() {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), level!.durationMs);
    }

    /* 첫 흔들림은 1초 후 */
    const initTimer = setTimeout(doShake, 1000);
    shakeTimer.current = setInterval(doShake, level.intervalMs);

    return () => {
      clearTimeout(initTimer);
      if (shakeTimer.current) clearInterval(shakeTimer.current);
    };
  }, [affection]);

  /* ── 알 터치 ── */
  const handleTouch = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (hatching) return;

    /* 하트 이펙트 — viewport 기준 좌표 (줌 transform 무관) */
    const x = e.clientX;
    const y = e.clientY;
    const uid = Math.random().toString(36).slice(2);
    setHearts(prev => [...prev, { uid, x, y }]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.uid !== uid)), 800);

    /* 터치 → 애정 소량 증가 (100터치 = 1애정) */
    const newTouches = touches + 1;
    const touchAffection = Math.floor(newTouches / 100);
    /* 현재 애정과 터치 기반 애정 중 큰 쪽 유지 (아이템으로 올린 애정 보존) */
    const newAffection = Math.min(100, Math.max(affection, touchAffection));
    setTouches(newTouches);
    setAffection(newAffection);

    /* DB 저장 (디바운스: 마지막 터치 후 1초) */
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase
        .from('characters')
        .update({
          egg_touches: newTouches,
          affection: newAffection,
          stats_updated_at: new Date().toISOString(),
        })
        .eq('id', characterId);
    }, 1000);

    /* 부화 트리거 — 애정 100 이상이면 부화 (터치든 아이템이든) */
    if (newAffection >= 100) {
      setHatching(true);
      setTimeout(() => setShowNaming(true), 2000);
    }
  }, [touches, hatching, characterId, supabase]);

  /* ── 이름 확정 → 부화 ── */
  async function handleNameConfirm() {
    if (charName.length < 2) return;
    setNamingSaving(true);
    await supabase
      .from('characters')
      .update({
        name: charName,
        hatched: true,
        stage: 'baby',
        hunger: 100,
        affection: 100,
      })
      .eq('id', characterId);
    window.location.reload();
  }

  /* ── 흔들림 강도 계산 ── */
  const shakeLevel = getEggShakeLevel(affection);
  const shakeAmp = shakeLevel?.amplitude || 0;

  /* ── 진행률 표시 (시각적 힌트만, 수치 미표시) ── */
  /* 균열 이펙트: 70% 이상에서 균열 오버레이 표시 */
  const showCrack = affection >= 70;
  const crackIntensity = affection >= 90 ? 3 : affection >= 70 ? 2 : 0;

  return (
    <>
      {/* 터치 영역 (스테이지 전체) */}
      <div
        onPointerDown={handleTouch}
        style={{
          position: 'absolute', inset: 0,
          zIndex: 2,
          cursor: 'pointer',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 알 이미지 */}
        <div
          className={isShaking ? 'egg-shaking' : ''}
          style={{
            width: 220,
            maxWidth: '70%',
            position: 'relative',
            transition: 'transform 0.1s ease',
            /* 부화 중이면 격렬하게 흔들림 */
            ...(hatching ? {
              animation: 'eggHatch 300ms ease infinite',
            } : {}),
          }}
        >
          <img
            src={eggImageUrl}
            alt="알"
            style={{
              width: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* 균열 오버레이 (70% 이상) */}
          {showCrack && (
            <div style={{
              position: 'absolute', inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: crackIntensity >= 3 ? 60 : 40,
              opacity: crackIntensity >= 3 ? 0.7 : 0.4,
              color: 'var(--ink-strong)',
              fontFamily: 'serif',
            }}>
              {crackIntensity >= 3 ? '⚡' : '✧'}
            </div>
          )}
        </div>
      </div>

      {/* 하트 이펙트 — Portal로 body에 직접 렌더 (transform 영향 회피) */}
      {typeof document !== 'undefined' && createPortal(
        hearts.map(h => (
          <div
            key={h.uid}
            className="egg-heart"
            style={{
              position: 'fixed',
              left: h.x, top: h.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 9999,
              fontFamily: 'var(--font-penscript)',
              fontSize: 42,
              color: 'var(--jeok)',
            }}
          >
            ♥
          </div>
        )),
        document.body,
      )}

      {/* 부화 이름짓기 모달 */}
      {showNaming && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--backdrop-modal)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--s-4)',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--ink-strong)',
            padding: 'var(--s-5)', width: '100%', maxWidth: 320,
            display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
          }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>이름 짓기</div>
            <input
              type="text" maxLength={12} placeholder="2~12자"
              value={charName} onChange={e => setCharName(e.target.value)}
              className="input" autoFocus
            />
            <div className="text-xs text-muted">변경 불가</div>
            <button
              className="btn btn--primary btn--full"
              onClick={handleNameConfirm}
              disabled={charName.length < 2 || namingSaving}
            >
              {namingSaving ? '저장 중...' : '확정'}
            </button>
          </div>
        </div>
      )}

      {/* 애니메이션 CSS */}
      <style>{`
        /* 알 흔들림 — 강도는 CSS 변수로 제어 */
        .egg-shaking {
          animation: eggShake ${shakeLevel?.durationMs || 600}ms ease;
        }
        @keyframes eggShake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(${shakeAmp}deg); }
          30% { transform: rotate(-${shakeAmp * 0.8}deg); }
          45% { transform: rotate(${shakeAmp * 0.6}deg); }
          60% { transform: rotate(-${shakeAmp * 0.4}deg); }
          75% { transform: rotate(${shakeAmp * 0.2}deg); }
        }

        /* 부화 연출 — 격렬한 흔들림 */
        @keyframes eggHatch {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(15deg) scale(1.02); }
          75% { transform: rotate(-15deg) scale(1.02); }
        }

        /* 하트 이펙트 */
        .egg-heart {
          animation: heartFloat 800ms ease-out forwards;
        }
        @keyframes heartFloat {
          from { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          50% { opacity: 1; transform: translate(-50%, -100%) scale(1.2); }
          to { opacity: 0; transform: translate(-50%, -150%) scale(0.8); }
        }
      `}</style>
    </>
  );
}
