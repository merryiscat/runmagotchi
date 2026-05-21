/**
 * StageWithFeeding — 스테이지 + 먹이주기 통합 클라이언트 래퍼
 *
 * BouncingCharacter와 FeedingStage를 연결한다.
 * FeedingStage에서 드롭된 음식 위치를 BouncingCharacter에 전달하고,
 * 캐릭터가 음식 위치에 도착하면 먹기 처리를 콜백으로 연결.
 */

'use client';

import { useState, useCallback } from 'react';
import BouncingCharacter from '@/components/BouncingCharacter';
import type { FoodTarget as BCFoodTarget } from '@/components/BouncingCharacter';
import FeedingStage from '@/components/FeedingStage';
import type { FoodTarget } from '@/components/FeedingStage';

interface Props {
  characterId: string;
  idleUrl?: string;
  mood: 'happy' | 'neutral' | 'sad';
  inventory: Record<string, number>;
  exp: number;
  level: number;
  hunger: number;
  affection: number;
  hatched: boolean;
}

export default function StageWithFeeding({
  characterId, idleUrl, mood,
  inventory, exp, level, hunger, affection, hatched,
}: Props) {
  /* FeedingStage에서 전달받은 음식 타겟 + 도착 콜백 */
  const [foodTarget, setFoodTarget] = useState<FoodTarget | null>(null);
  const [onReachFn, setOnReachFn] = useState<((uid: string) => void) | null>(null);

  /* FeedingStage → 부모로 음식 상태 전달 */
  const handleFoodState = useCallback((
    target: FoodTarget | null,
    onReach: (uid: string) => void,
  ) => {
    setFoodTarget(target);
    /* setState에 함수를 넣으면 실행되므로 래핑 */
    setOnReachFn(() => onReach);
  }, []);

  /* BouncingCharacter → 음식 도착 콜백 */
  const handleReachFood = useCallback((uid: string) => {
    onReachFn?.(uid);
  }, [onReachFn]);

  return (
    <>
      {/* 캐릭터 */}
      {hatched && idleUrl ? (
        <BouncingCharacter
          characterId={characterId}
          idleUrl={idleUrl}
          mood={mood}
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
