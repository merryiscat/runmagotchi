/**
 * StageWithFeeding — 스테이지 + 먹이주기 + 터치 인터랙션 통합
 *
 * BouncingCharacter, FeedingStage, 터치 핸들러를 연결한다.
 *
 * 터치 인터랙션:
 *   - 스테이지 터치/클릭 → 캐릭터가 반응
 *   - 애정 ≥ 60: 터치 방향으로 다가옴 (aegyo)
 *   - 애정 < 25: 터치 반대로 도망
 *   - 터치 빈도에 따라 애정도 증가 (TouchTracker)
 *
 * 행동 결정:
 *   hunger/affection/터치/먹이 상태로 6가지 행동 패턴 결정.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import BouncingCharacter from '@/components/BouncingCharacter';
import type { FoodTarget as BCFoodTarget, TouchPoint } from '@/components/BouncingCharacter';
import FeedingStage from '@/components/FeedingStage';
import type { FoodTarget } from '@/components/FeedingStage';
import {
  type Behavior,
  determineBehavior,
  calcTouchDelta,
  clampStat,
  expToLevel,
  levelToStage,
  TouchTracker,
  TOUCH_EXP,
} from '@/lib/behavior';
import { createClient } from '@/lib/supabase/client';

interface Props {
  characterId: string;
  idleUrl?: string;
  inventory: Record<string, number>;
  exp: number;
  level: number;
  hunger: number;
  affection: number;
  hatched: boolean;
}

export default function StageWithFeeding({
  characterId, idleUrl,
  inventory, exp, level, hunger: initialHunger, affection: initialAffection, hatched,
}: Props) {
  /* FeedingStage에서 전달받은 음식 타겟 + 도착 콜백 */
  const [foodTarget, setFoodTarget] = useState<FoodTarget | null>(null);
  const [onReachFn, setOnReachFn] = useState<((uid: string) => void) | null>(null);

  /* 터치 좌표 (BouncingCharacter에 전달) */
  const [touchPoint, setTouchPoint] = useState<TouchPoint | null>(null);

  /* 실시간 스탯 (터치로 변할 수 있음) */
  const [hunger, setHunger] = useState(initialHunger);
  const [affection, setAffection] = useState(initialAffection);
  const [currentExp, setCurrentExp] = useState(exp);
  const [currentLevel, setCurrentLevel] = useState(level);

  /* 최근 먹이/애정 받은 여부 (15초 타이머) */
  const [recentlyFed, setRecentlyFed] = useState(false);

  /* 터치 빈도 추적 */
  const touchTracker = useRef(new TouchTracker(60_000));
  const supabase = createClient();

  /* 외부 스탯 변경 반영 (FeedingStage에서 먹이 먹으면 hunger/affection이 바뀜) */
  useEffect(() => { setHunger(initialHunger); }, [initialHunger]);
  useEffect(() => { setAffection(initialAffection); }, [initialAffection]);

  /* ── 행동 결정 ── */
  const behavior: Behavior = determineBehavior({
    hunger,
    affection,
    recentlyTouched: touchTracker.current.isRecentlyTouched(),
    recentlyFed,
  });

  /* ── FeedingStage → 부모로 음식 상태 전달 ── */
  const handleFoodState = useCallback((
    target: FoodTarget | null,
    onReach: (uid: string) => void,
  ) => {
    setFoodTarget(target);
    setOnReachFn(() => onReach);
  }, []);

  /* ── BouncingCharacter → 음식 도착 콜백 ── */
  const handleReachFood = useCallback((uid: string) => {
    onReachFn?.(uid);
    /* 먹이 먹은 직후 → joyful 행동 (15초) */
    setRecentlyFed(true);
    setTimeout(() => setRecentlyFed(false), 15_000);
  }, [onReachFn]);

  /* ── 스테이지 터치/클릭 핸들러 ── */
  const handleStageTouch = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    /* 가방 UI 등의 클릭은 무시 (pointerEvents가 auto인 요소) */
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-touch]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    /* 터치 좌표 전달 */
    setTouchPoint({ x, y, timestamp: Date.now() });

    /* 터치 빈도 기록 */
    touchTracker.current.record();

    /* 터치 → 애정 증가 + EXP 증가 */
    const delta = calcTouchDelta();
    const newAffection = clampStat(affection + delta.affectionDelta);
    const newExp = currentExp + TOUCH_EXP;
    const newLevel = expToLevel(newExp);
    const newStage = levelToStage(newLevel);
    const oldStage = levelToStage(currentLevel);

    setAffection(newAffection);
    setCurrentExp(newExp);
    setCurrentLevel(newLevel);

    /* DB 업데이트 (디바운스: 마지막 터치 후 2초 뒤) */
    if (touchDebounceRef.current) clearTimeout(touchDebounceRef.current);
    touchDebounceRef.current = setTimeout(async () => {
      await supabase
        .from('characters')
        .update({
          affection: newAffection,
          total_exp: newExp,
          level: newLevel,
          stage: newStage,
          stats_updated_at: new Date().toISOString(),
        })
        .eq('id', characterId);
    }, 2000);

    /* 진화 체크 (터치 EXP로 레벨업한 경우) */
    if (newStage !== oldStage) {
      setTimeout(() => window.location.reload(), 1500);
    }
  }, [affection, currentExp, currentLevel, characterId, supabase]);

  const touchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── 행동 변화 시 recentlyTouched 재계산 트리거 (1초마다) ── */
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* 터치 감지 영역 (스테이지 전체) */}
      <div
        onPointerDown={handleStageTouch}
        style={{
          position: 'absolute', inset: 0,
          zIndex: 1,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      />

      {/* 캐릭터 */}
      {hatched && idleUrl ? (
        <BouncingCharacter
          characterId={characterId}
          idleUrl={idleUrl}
          behavior={behavior}
          affection={affection}
          touchPoint={touchPoint}
          foodTarget={foodTarget as BCFoodTarget | null}
          onReachFood={handleReachFood}
        />
      ) : null}

      {/* 먹이주기 UI */}
      <FeedingStage
        characterId={characterId}
        initialInventory={inventory}
        initialExp={exp}
        initialLevel={level}
        initialHunger={hunger}
        initialAffection={affection}
        hatched={hatched}
        onFoodState={handleFoodState}
      />
    </>
  );
}
