/**
 * BouncingCharacter — 스테이지를 돌아다니는 캐릭터
 *
 * - 스테이지 전체를 활동 범위로 사용 (부모 크기 기준)
 * - 느릿느릿 걸어다니며 가끔 멈추고 가끔 방향 전환
 * - 점프는 작고 느리게 (부산하지 않게)
 * - 이미지가 컨테이너 밖으로 잘리지 않도록 패딩 처리
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 애니메이션 상수 ─────────────────────────────────── */

/** 프레임 표시 시간 (ms) — 느리게 */
const FRAME_DURATION = 300;

/** 점프 높이 (px) — 작게 */
const HOP_HEIGHT = 12;

/** 기분(mood)별 움직임 설정 */
const MOOD_CONFIG = {
  /* happy: 기본 — 활발하게 돌아다님 */
  happy:   { pauseMin: 1500, pauseMax: 3500, moveRange: 120, hopScale: 1.0 },
  /* neutral: 느긋 — 움직임이 느려지고 점프가 작아짐 */
  neutral: { pauseMin: 3000, pauseMax: 6000, moveRange: 80,  hopScale: 0.7 },
  /* sad: 우울 — 거의 안 움직이고 점프도 미미 */
  sad:     { pauseMin: 6000, pauseMax: 10000, moveRange: 30, hopScale: 0.3 },
} as const;

export type Mood = keyof typeof MOOD_CONFIG;

/** 캐릭터 크기 (px) */
const CHAR_SIZE = 120;

/** 캐릭터 안쪽 여백 (잘림 방지) */
const PADDING = 80;

/** 음식 위치 — FeedingStage에서 전달 */
export interface FoodTarget {
  uid: string;
  x: number;
  y: number;
}

interface Props {
  characterId: string;
  idleUrl?: string;
  /** 캐릭터 기분 — 배고픔/애정 스탯에 따라 결정 */
  mood?: Mood;
  /** 먹으러 갈 음식 좌표 (null이면 자유 이동) */
  foodTarget?: FoodTarget | null;
  /** 음식 위치에 도착했을 때 호출 */
  onReachFood?: (uid: string) => void;
}

export default function BouncingCharacter({
  characterId, idleUrl, mood = 'happy',
  foodTarget = null, onReachFood,
}: Props) {
  const [frames, setFrames] = useState<string[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);

  // 캐릭터 절대 위치 (컨테이너 내 px)
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [hopY, setHopY] = useState(0); // 점프 오프셋
  const [facingRight, setFacingRight] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const hopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  const supabase = createClient();

  /* ─── 프레임 이미지 로드 ────────────────────────────── */

  useEffect(() => {
    async function loadFrames() {
      const { data } = await supabase
        .from('character_images')
        .select('type, url')
        .eq('character_id', characterId)
        .in('type', ['pixel_idle', 'pixel_bounce1', 'pixel_bounce2', 'pixel_bounce3', 'pixel_bounce4']);

      if (!data || data.length === 0) {
        if (idleUrl) setFrames([idleUrl]);
        return;
      }

      const map: Record<string, string> = {};
      data.forEach((row) => { map[row.type] = row.url; });

      const idle = idleUrl || map['pixel_idle'] || '';
      if (!idle) return;

      const b1 = map['pixel_bounce1'];
      const b2 = map['pixel_bounce2'];
      const b3 = map['pixel_bounce3'];
      const b4 = map['pixel_bounce4'];

      if (b1 && b2 && b3 && b4) {
        setFrames([idle, b1, b2, b3, b4]);
      } else {
        setFrames([idle]);
      }
    }
    loadFrames();
  }, [characterId, idleUrl]);

  /* ─── 초기 위치: 컨테이너 중앙 ─────────────────────── */

  useEffect(() => {
    if (initializedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setPosX((rect.width - CHAR_SIZE) / 2);
    setPosY((rect.height - CHAR_SIZE) / 2);
    initializedRef.current = true;
  }, [frames]);

  /* ─── 폴짝 루프 ────────────────────────────────────── */

  const doHop = useCallback(() => {
    const el = containerRef.current;
    if (!el || frames.length <= 1) return;

    const cfg = MOOD_CONFIG[mood];
    const rect = el.getBoundingClientRect();
    const maxX = rect.width - CHAR_SIZE - PADDING;
    const maxY = rect.height - CHAR_SIZE - PADDING;

    let nextX: number;
    let nextY: number;

    if (foodTarget) {
      /* 음식이 있으면 그 방향으로 한 홉씩 다가감 */
      const targetX = foodTarget.x - CHAR_SIZE / 2;
      const targetY = foodTarget.y - CHAR_SIZE / 2;
      const dx = targetX - posX;
      const dy = targetY - posY;
      const dist = Math.hypot(dx, dy);

      if (dist < 50) {
        /* 음식에 도착 → 콜백 호출 */
        onReachFood?.(foodTarget.uid);
        nextX = posX;
        nextY = posY;
      } else {
        /* 한 홉에 최대 80px씩 다가감 */
        const hopDist = Math.min(80, dist);
        const ratio = hopDist / dist;
        nextX = posX + dx * ratio;
        nextY = posY + dy * ratio;
      }
    } else {
      /* 자유 이동: 기분에 따라 이동 범위 조절 */
      const moveRange = cfg.moveRange;
      nextX = posX + (Math.random() - 0.5) * moveRange * 2;
      nextY = posY + (Math.random() - 0.5) * moveRange;
    }

    // 범위 제한
    nextX = Math.max(PADDING, Math.min(maxX, nextX));
    nextY = Math.max(PADDING, Math.min(maxY, nextY));

    const goingRight = nextX > posX;
    setFacingRight(goingRight);

    // 프레임 시퀀스: 웅크림 → 점프 → 최고점 → 착지 → idle
    // 기분에 따라 점프 높이 조절
    const hopH = HOP_HEIGHT * cfg.hopScale;
    const seq = [
      { frame: 1, hy: 2 },
      { frame: 2, hy: -hopH * 0.6 },
      { frame: 3, hy: -hopH },
      { frame: 4, hy: 2 },
      { frame: 0, hy: 0 },
    ];

    let step = 0;
    const stepInterval = setInterval(() => {
      if (step >= seq.length) {
        clearInterval(stepInterval);
        // 다음 폴짝까지 대기 — 음식이 있으면 빨리 다가감
        const pause = foodTarget
          ? 300 + Math.random() * 200
          : cfg.pauseMin + Math.random() * (cfg.pauseMax - cfg.pauseMin);
        hopTimer.current = setTimeout(doHop, pause);
        return;
      }

      setFrameIdx(seq[step].frame);
      setHopY(seq[step].hy);

      // 점프 중간에 위치 이동
      if (step === 2) {
        setPosX(nextX);
        setPosY(nextY);
      }

      step++;
    }, FRAME_DURATION);

    frameTimer.current = stepInterval as unknown as ReturnType<typeof setInterval>;
  }, [frames, posX, posY, mood, foodTarget, onReachFood]);

  useEffect(() => {
    if (frames.length <= 1) return;

    // 첫 폴짝은 1초 후
    hopTimer.current = setTimeout(doHop, 1000);

    return () => {
      if (hopTimer.current) clearTimeout(hopTimer.current);
      if (frameTimer.current) clearInterval(frameTimer.current);
    };
  }, [frames, doHop]);

  /* ─── 렌더링 ───────────────────────────────────────── */

  if (frames.length === 0) return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
  );

  const currentSrc = frames[frameIdx] || frames[0];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <img
        src={currentSrc}
        alt="캐릭터"
        style={{
          position: 'absolute',
          width: CHAR_SIZE,
          height: CHAR_SIZE,
          objectFit: 'contain',
          imageRendering: 'pixelated' as const,
          left: posX,
          top: posY,
          transform: `translateY(${hopY}px)`,
          scale: `${facingRight ? 1 : -1} 1`,
          /* 초기화 전(0,0)에는 transition 없이 바로 배치, 이후에만 부드러운 이동 */
          transition: initializedRef.current
            ? `left 0.8s ease-in-out, top 0.8s ease-in-out, transform ${FRAME_DURATION}ms ease-out`
            : 'none',
          /* 초기화 전에는 숨김 */
          opacity: initializedRef.current ? 1 : 0,
        }}
      />
    </div>
  );
}
