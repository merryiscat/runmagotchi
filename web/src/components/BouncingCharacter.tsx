/**
 * BouncingCharacter — 스테이지를 돌아다니는 캐릭터
 *
 * 행동 시스템 (6가지):
 *   happy   — 활발하게 돌아다님 (기본)
 *   joyful  — 신나서 제자리 뛰기, 빠른 움직임
 *   aegyo   — 터치 방향으로 다가와서 좌우 흔들기
 *   hungry  — 느릿느릿, 가끔 흔들거림
 *   sad     — 구석에 웅크림, 거의 안 움직임
 *   angry   — 빠르게 왔다갔다, 거친 움직임
 *
 * 터치 인터랙션:
 *   - 애정 ≥ 60: 터치 위치로 다가옴 → aegyo 행동
 *   - 애정 < 60 & ≥ 25: 터치 반응 없음 (무시)
 *   - 애정 < 25: 터치 반대 방향으로 도망감
 *
 * 행동별 이미지:
 *   character_images 테이블에서 pixel_{behavior} 타입으로 로드.
 *   없으면 pixel_idle 폴백.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type Behavior,
  BEHAVIOR_MOTION,
  BEHAVIOR_IMAGE_TYPES,
} from '@/lib/behavior';

/* ─── 상수 ─────────────────────────────────────────────── */

/** 기본 프레임 표시 시간 (ms) */
const BASE_FRAME_DURATION = 300;

/** 점프 높이 (px) — 기본 */
const HOP_HEIGHT = 12;

/** 캐릭터 크기 (px) */
const CHAR_SIZE = 120;

/** 캐릭터 안쪽 여백 (잘림 방지) */
const PADDING = 80;

/* ─── 터치 좌표 타입 ─── */

/** 터치/클릭 위치 (스테이지 내부 좌표) */
export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

/** 음식 위치 — FeedingStage에서 전달 */
export interface FoodTarget {
  uid: string;
  x: number;
  y: number;
}

/* ─── Props ─── */

interface Props {
  characterId: string;
  idleUrl?: string;
  /** 현재 행동 상태 */
  behavior?: Behavior;
  /** 현재 애정도 (터치 반응 방향 결정) */
  affection?: number;
  /** 스테이지 터치 좌표 (부모에서 전달) */
  touchPoint?: TouchPoint | null;
  /** 먹으러 갈 음식 좌표 (null이면 자유 이동) */
  foodTarget?: FoodTarget | null;
  /** 음식 위치에 도착했을 때 호출 */
  onReachFood?: (uid: string) => void;
}

/* ─── 특수 행동 CSS 클래스 ─── */

const SPECIAL_CSS: Record<string, string> = {
  /* 제자리에서 빠르게 위아래 뛰기 */
  bounce_in_place: `
    @keyframes bounceInPlace {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-16px); }
    }
  `,
  /* 좌우 살랑살랑 흔들기 (애교) */
  sway: `
    @keyframes sway {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }
  `,
  /* 부들부들 떨기 (배고픔/화남) */
  shake: `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
  `,
  /* 웅크리기 (슬픔) */
  crouch: `
    @keyframes crouch {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(0.85) translateY(8px); }
    }
  `,
};

/* ─── 메인 컴포넌트 ─── */

export default function BouncingCharacter({
  characterId,
  idleUrl,
  behavior = 'happy',
  affection = 50,
  touchPoint = null,
  foodTarget = null,
  onReachFood,
}: Props) {
  /* 프레임 이미지: 행동별로 다른 세트 로드 */
  const [framesByBehavior, setFramesByBehavior] = useState<Record<string, string[]>>({});
  const [frameIdx, setFrameIdx] = useState(0);

  /* 캐릭터 절대 위치 (컨테이너 내 px) */
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [hopY, setHopY] = useState(0);
  const [facingRight, setFacingRight] = useState(true);

  /* 특수 행동 애니메이션 활성 여부 */
  const [specialActive, setSpecialActive] = useState(false);

  /* 터치 반응 타겟 (애정에 따라 접근/도망) */
  const [touchTarget, setTouchTarget] = useState<{ x: number; y: number; approach: boolean } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const hopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);
  const lastTouchRef = useRef(0);

  const supabase = createClient();

  /* ─── 행동별 이미지 로드 ────────────────────────────── */

  useEffect(() => {
    async function loadAllFrames() {
      /* 모든 행동의 이미지 타입 목록 생성 */
      const allTypes = [
        'pixel_idle',
        'pixel_bounce1', 'pixel_bounce2', 'pixel_bounce3', 'pixel_bounce4',
        ...Object.values(BEHAVIOR_IMAGE_TYPES),
      ];

      const { data } = await supabase
        .from('character_images')
        .select('type, url')
        .eq('character_id', characterId)
        .in('type', allTypes);

      if (!data || data.length === 0) {
        if (idleUrl) setFramesByBehavior({ default: [idleUrl] });
        return;
      }

      /* 타입별 URL 맵 */
      const map: Record<string, string> = {};
      data.forEach(row => { map[row.type] = row.url; });

      const idle = idleUrl || map['pixel_idle'] || '';
      if (!idle) return;

      /* 기본 바운스 프레임 (happy 등에서 사용) */
      const b1 = map['pixel_bounce1'];
      const b2 = map['pixel_bounce2'];
      const b3 = map['pixel_bounce3'];
      const b4 = map['pixel_bounce4'];

      const defaultFrames = (b1 && b2 && b3 && b4)
        ? [idle, b1, b2, b3, b4]
        : [idle];

      /* 행동별 프레임 세트 구성 */
      const result: Record<string, string[]> = { default: defaultFrames };

      for (const [beh, imgType] of Object.entries(BEHAVIOR_IMAGE_TYPES)) {
        if (map[imgType]) {
          /* 행동 전용 이미지가 있으면 그걸 사용 (단일 프레임) */
          result[beh] = [map[imgType]];
        }
        /* 없으면 default 폴백 (result에 안 넣으면 아래에서 default 사용) */
      }

      setFramesByBehavior(result);
    }
    loadAllFrames();
  }, [characterId, idleUrl]);

  /* ─── 현재 행동에 맞는 프레임 가져오기 ─── */

  const currentFrames = framesByBehavior[behavior] || framesByBehavior['default'] || [];

  /* ─── 초기 위치: 컨테이너 중앙 ─── */

  useEffect(() => {
    if (initializedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setPosX((rect.width - CHAR_SIZE) / 2);
    setPosY((rect.height - CHAR_SIZE) / 2);
    initializedRef.current = true;
  }, [currentFrames]);

  /* ─── 터치 반응 처리 ────────────────────────────────── */

  useEffect(() => {
    if (!touchPoint || touchPoint.timestamp <= lastTouchRef.current) return;
    lastTouchRef.current = touchPoint.timestamp;

    if (affection >= 60) {
      /* 높은 애정: 터치 방향으로 다가감 */
      setTouchTarget({ x: touchPoint.x, y: touchPoint.y, approach: true });
    } else if (affection < 25) {
      /* 낮은 애정: 터치 반대 방향으로 도망 */
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      /* 터치 좌표의 반대편 계산 */
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const fleeX = posX + (posX - touchPoint.x) * 0.5;
      const fleeY = posY + (posY - touchPoint.y) * 0.3;

      setTouchTarget({
        x: Math.max(PADDING, Math.min(rect.width - CHAR_SIZE - PADDING, fleeX)),
        y: Math.max(PADDING, Math.min(rect.height - CHAR_SIZE - PADDING, fleeY)),
        approach: false,
      });
    }
    /* 25~59: 무반응 */
  }, [touchPoint, affection, posX, posY]);

  /* 터치 타겟 자동 해제 (5초 후) */
  useEffect(() => {
    if (!touchTarget) return;
    const timer = setTimeout(() => setTouchTarget(null), 5000);
    return () => clearTimeout(timer);
  }, [touchTarget]);

  /* ─── 폴짝 루프 ────────────────────────────────────── */

  const doHop = useCallback(() => {
    const el = containerRef.current;
    if (!el || currentFrames.length === 0) return;

    const motion = BEHAVIOR_MOTION[behavior];
    const rect = el.getBoundingClientRect();
    const maxX = rect.width - CHAR_SIZE - PADDING;
    const maxY = rect.height - CHAR_SIZE - PADDING;

    let nextX: number;
    let nextY: number;

    if (foodTarget) {
      /* ── 음식이 있으면 음식 방향으로 ── */
      const targetX = foodTarget.x - CHAR_SIZE / 2;
      const targetY = foodTarget.y - CHAR_SIZE / 2;
      const dx = targetX - posX;
      const dy = targetY - posY;
      const dist = Math.hypot(dx, dy);

      if (dist < 50) {
        onReachFood?.(foodTarget.uid);
        nextX = posX;
        nextY = posY;
      } else {
        const hopDist = Math.min(80, dist);
        const ratio = hopDist / dist;
        nextX = posX + dx * ratio;
        nextY = posY + dy * ratio;
      }
    } else if (touchTarget) {
      /* ── 터치 반응: 다가가기 or 도망가기 ── */
      const dx = touchTarget.x - CHAR_SIZE / 2 - posX;
      const dy = touchTarget.y - CHAR_SIZE / 2 - posY;
      const dist = Math.hypot(dx, dy);

      if (touchTarget.approach && dist < 60) {
        /* 다가왔으면 특수 행동 발동 */
        setSpecialActive(true);
        setTimeout(() => setSpecialActive(false), 2000);
        setTouchTarget(null);
        nextX = posX;
        nextY = posY;
      } else {
        const hopDist = Math.min(touchTarget.approach ? 70 : 100, dist);
        const ratio = dist > 0 ? hopDist / dist : 0;
        nextX = posX + dx * ratio;
        nextY = posY + dy * ratio;
      }
    } else {
      /* ── 자유 이동: 행동에 따라 이동 범위 조절 ── */
      nextX = posX + (Math.random() - 0.5) * motion.moveRange * 2;
      nextY = posY + (Math.random() - 0.5) * motion.moveRange;
    }

    /* 범위 제한 */
    nextX = Math.max(PADDING, Math.min(maxX, nextX));
    nextY = Math.max(PADDING, Math.min(maxY, nextY));

    const goingRight = nextX > posX;
    setFacingRight(goingRight);

    /* 프레임 시퀀스 (5프레임 이상일 때만 애니메이션) */
    const hopH = HOP_HEIGHT * motion.hopScale;
    const frameDur = BASE_FRAME_DURATION * motion.frameSpeedScale;

    if (currentFrames.length >= 5) {
      /* 기본 바운스 시퀀스: 웅크림 → 점프 → 최고점 → 착지 → idle */
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
          const pause = foodTarget || touchTarget
            ? 300 + Math.random() * 200
            : motion.pauseMin + Math.random() * (motion.pauseMax - motion.pauseMin);
          hopTimer.current = setTimeout(doHop, pause);
          return;
        }

        setFrameIdx(seq[step].frame);
        setHopY(seq[step].hy);

        /* 점프 중간에 위치 이동 */
        if (step === 2) {
          setPosX(nextX);
          setPosY(nextY);
        }

        step++;
      }, frameDur);

      frameTimer.current = stepInterval as unknown as ReturnType<typeof setInterval>;
    } else {
      /* 단일 프레임: 위치만 이동 */
      setPosX(nextX);
      setPosY(nextY);
      setHopY(-hopH);
      setTimeout(() => setHopY(0), frameDur * 2);

      const pause = foodTarget || touchTarget
        ? 300 + Math.random() * 200
        : motion.pauseMin + Math.random() * (motion.pauseMax - motion.pauseMin);
      hopTimer.current = setTimeout(doHop, pause);
    }
  }, [currentFrames, posX, posY, behavior, foodTarget, touchTarget, onReachFood]);

  /* ─── 폴짝 루프 시작/재시작 ─── */

  useEffect(() => {
    if (currentFrames.length === 0) return;

    hopTimer.current = setTimeout(doHop, 1000);

    return () => {
      if (hopTimer.current) clearTimeout(hopTimer.current);
      if (frameTimer.current) clearInterval(frameTimer.current);
    };
  }, [currentFrames, doHop]);

  /* ─── 렌더링 ───────────────────────────────────────── */

  if (currentFrames.length === 0) return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
  );

  const currentSrc = currentFrames[frameIdx] || currentFrames[0];
  const motion = BEHAVIOR_MOTION[behavior];
  const specialAction = specialActive ? motion.specialAction : undefined;

  /* 특수 행동 애니메이션 스타일 */
  let specialStyle = '';
  if (specialAction === 'bounce_in_place') {
    specialStyle = 'animation: bounceInPlace 300ms ease infinite;';
  } else if (specialAction === 'sway') {
    specialStyle = 'animation: sway 600ms ease-in-out infinite;';
  } else if (specialAction === 'shake') {
    specialStyle = 'animation: shake 200ms ease infinite;';
  } else if (specialAction === 'crouch') {
    specialStyle = 'animation: crouch 3000ms ease-in-out infinite;';
  }

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
        className={specialActive ? `special-${specialAction}` : ''}
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
          transition: initializedRef.current
            ? `left 0.8s ease-in-out, top 0.8s ease-in-out, transform ${BASE_FRAME_DURATION * motion.frameSpeedScale}ms ease-out`
            : 'none',
          opacity: initializedRef.current ? 1 : 0,
        }}
      />

      {/* 특수 행동 CSS 키프레임 */}
      <style>{`
        ${Object.values(SPECIAL_CSS).join('\n')}

        .special-bounce_in_place {
          animation: bounceInPlace 300ms ease infinite !important;
        }
        .special-sway {
          animation: sway 600ms ease-in-out infinite !important;
        }
        .special-shake {
          animation: shake 200ms ease infinite !important;
        }
        .special-crouch {
          animation: crouch 3000ms ease-in-out infinite !important;
        }
      `}</style>
    </div>
  );
}
