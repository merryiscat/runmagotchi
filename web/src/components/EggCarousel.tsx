/**
 * 3D 실린더 알 선택 — UI Kit cylinder-picker.jsx 포팅
 *
 * 동작:
 * - 알 N개를 원통 둘레에 360/N도 간격으로 배치
 * - 알은 항상 카메라를 바라봄 (빌보드). 원통만 회전, 알 자체는 회전 안 함
 * - 클릭 → 가장 짧은 경로로 회전해서 정면으로
 * - 드래그 → 실시간 회전, 놓으면 가장 가까운 알로 스냅
 */

'use client';

import { useState, useRef, useMemo } from 'react';

/* ── 상수 ── */
const N_EGGS = 3;
const STEP_ANGLE = 360 / N_EGGS;  // 120도
const RADIUS = 240;                // 원통 반지름 (px)
const PERSPECTIVE = 900;
const DRAG_SENSITIVITY = 0.6;      // px → deg
const DRAG_THRESHOLD = 6;          // 클릭/드래그 구분 임계값 (px)

/* baseAngle: idx 0 → 왼쪽(-120°), idx 1 → 가운데(0°), idx 2 → 오른쪽(+120°) */
const BASE_ANGLES = [-STEP_ANGLE, 0, STEP_ANGLE];

/** 회전각 -180~180 정규화 */
function normalize(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** 최단 경로 회전값 계산 */
function shortestPath(current: number, target: number): number {
  const delta = normalize(target - current);
  return current + delta;
}

interface EggCarouselProps {
  images: string[];
  onSelect: (index: number) => void;
  selectedIndex: number | null;
}

export default function EggCarousel({ images, onSelect, selectedIndex }: EggCarouselProps) {
  const [rotation, setRotation] = useState(0);     // 누적 회전 (스냅 후)
  const [dragDelta, setDragDelta] = useState(0);   // 드래그 중 일시 회전
  const [dragging, setDragging] = useState(false);

  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const movedRef = useRef(false);

  /* 시각적 총 회전 */
  const visualRotation = rotation + dragDelta;

  /* 정면에 가장 가까운 알 인덱스 */
  const frontIdx = useMemo(() => {
    let bestIdx = 0;
    let bestAbs = Infinity;
    BASE_ANGLES.forEach((base, i) => {
      const eff = normalize(base + visualRotation);
      const a = Math.abs(eff);
      if (a < bestAbs) { bestAbs = a; bestIdx = i; }
    });
    return bestIdx;
  }, [visualRotation]);

  /** 특정 알을 정면으로 회전 */
  function rotateTo(idx: number) {
    const target = -BASE_ANGLES[idx];
    const next = shortestPath(rotation, target);
    setRotation(next);
    setDragDelta(0);
  }

  /* ── 포인터 이벤트 ── */
  function onPointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    movedRef.current = false;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;

    if (!movedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      movedRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }

    if (movedRef.current) {
      setDragDelta(dx * DRAG_SENSITIVITY);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    setDragging(false);

    if (!movedRef.current) {
      /* 클릭 → 해당 알을 정면으로 + 선택 */
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      const slot = el?.closest?.('[data-idx]') as HTMLElement;
      if (slot) {
        const idx = Number(slot.dataset.idx);
        if (!Number.isNaN(idx)) {
          rotateTo(idx);
          onSelect(idx);
        }
      }
      setDragDelta(0);
      return;
    }

    /* 드래그 종료 → 가장 가까운 알로 스냅 */
    const total = rotation + dragDelta;
    const snapped = Math.round(total / STEP_ANGLE) * STEP_ANGLE;
    setRotation(snapped);
    setDragDelta(0);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s-5)', width: '100%' }}>

      {/* 실린더 씬 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative', width: '100%', maxWidth: 720,
          height: 360, touchAction: 'pan-y',
          cursor: dragging && movedRef.current ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        {/* 스테이지 */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          perspective: PERSPECTIVE,
        }}>
          {/* 드럼 (원통) */}
          <div style={{
            position: 'relative', width: 0, height: 0,
            transformStyle: 'preserve-3d',
          }}>
            {images.map((img, i) => {
              const base = BASE_ANGLES[i];
              const eff = base + visualRotation;
              const effNorm = normalize(eff);
              const t = Math.abs(effNorm) / 180;
              const dim = 1 - t * 0.55;
              const scale = 1 - t * 0.15;
              const isFront = i === frontIdx;

              return (
                <div
                  key={i}
                  data-idx={i}
                  style={{
                    position: 'absolute',
                    width: 220, height: 280,
                    top: -140, left: -110,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${eff}deg) translateZ(${RADIUS}px) rotateY(${-eff}deg) scale(${scale})`,
                    filter: `brightness(${dim})`,
                    zIndex: Math.round(1000 - Math.abs(effNorm)),
                    transition: dragging && movedRef.current
                      ? 'none'
                      : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1), filter 380ms ease-out',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{
                    padding: 16, background: '#FFFFFF',
                    border: selectedIndex === i
                      ? '3px solid var(--ink-strong)'
                      : isFront
                        ? '2px solid var(--line)'
                        : '1px solid var(--line-soft)',
                    borderRadius: 12,
                    boxShadow: isFront
                      ? '0 8px 24px -10px rgba(0,0,0,0.35)'
                      : '0 2px 8px rgba(0,0,0,0.05)',
                  }}>
                    <img
                      src={img}
                      alt={`알 ${i + 1}`}
                      draggable={false}
                      style={{
                        width: 180, height: 180,
                        objectFit: 'contain', display: 'block',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 원통 가이드라인 */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            top: 'calc(50% - 130px)', width: 520, maxWidth: '90%',
            height: 1, background: 'var(--line-soft)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            top: 'calc(50% + 130px)', width: 520, maxWidth: '90%',
            height: 1, background: 'var(--line-soft)', pointerEvents: 'none',
          }} />
        </div>

        {/* 바닥 그림자 */}
        <div style={{
          position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
          width: 360, maxWidth: '80%', height: 28, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 40%, transparent 70%)',
        }} />
      </div>

      {/* 안내 */}
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-muted)', textAlign: 'center' }}>
        좌우로 드래그하거나 옆 알을 누르세요
      </div>

      {/* 인디케이터 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {images.map((_, i) => (
          <div
            key={i}
            onClick={() => { rotateTo(i); onSelect(i); }}
            style={{
              width: frontIdx === i ? 9 : 6,
              height: frontIdx === i ? 9 : 6,
              borderRadius: '50%', cursor: 'pointer',
              background: frontIdx === i ? 'var(--ink-strong)' : 'var(--ink-faint)',
              transition: 'all 220ms ease-out',
            }}
          />
        ))}
      </div>
    </div>
  );
}
