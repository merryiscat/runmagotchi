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

/** 폴짝 한 사이클 후 대기 (ms) — 넉넉히 */
const HOP_PAUSE_MIN = 1500;
const HOP_PAUSE_MAX = 3500;

/** 점프 높이 (px) — 작게 */
const HOP_HEIGHT = 12;

/** 캐릭터 크기 (px) */
const CHAR_SIZE = 120;

/** 캐릭터 안쪽 여백 (잘림 방지) */
const PADDING = 80;

interface Props {
  characterId: string;
  idleUrl?: string;
}

export default function BouncingCharacter({ characterId, idleUrl }: Props) {
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
  const initialized = useRef(false);

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
    if (initialized.current) return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setPosX((rect.width - CHAR_SIZE) / 2);
    setPosY((rect.height - CHAR_SIZE) / 2);
    initialized.current = true;
  }, [frames]);

  /* ─── 폴짝 루프 ────────────────────────────────────── */

  const doHop = useCallback(() => {
    const el = containerRef.current;
    if (!el || frames.length <= 1) return;

    const rect = el.getBoundingClientRect();
    const maxX = rect.width - CHAR_SIZE - PADDING;
    const maxY = rect.height - CHAR_SIZE - PADDING;

    // 다음 위치: 현재 위치에서 적당히 이동 (스테이지 전체 범위)
    const moveRange = 120;
    let nextX = posX + (Math.random() - 0.5) * moveRange * 2;
    let nextY = posY + (Math.random() - 0.5) * moveRange;

    // 범위 제한
    nextX = Math.max(PADDING, Math.min(maxX, nextX));
    nextY = Math.max(PADDING, Math.min(maxY, nextY));

    const goingRight = nextX > posX;
    setFacingRight(goingRight);

    // 프레임 시퀀스: 웅크림 → 점프 → 최고점 → 착지 → idle
    const seq = [
      { frame: 1, hy: 2 },
      { frame: 2, hy: -HOP_HEIGHT * 0.6 },
      { frame: 3, hy: -HOP_HEIGHT },
      { frame: 4, hy: 2 },
      { frame: 0, hy: 0 },
    ];

    let step = 0;
    const stepInterval = setInterval(() => {
      if (step >= seq.length) {
        clearInterval(stepInterval);
        // 다음 폴짝까지 랜덤 대기
        const pause = HOP_PAUSE_MIN + Math.random() * (HOP_PAUSE_MAX - HOP_PAUSE_MIN);
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
  }, [frames, posX, posY]);

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

  if (frames.length === 0) return null;
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
          transition: `left 0.8s ease-in-out, top 0.8s ease-in-out, transform ${FRAME_DURATION}ms ease-out`,
        }}
      />
    </div>
  );
}
