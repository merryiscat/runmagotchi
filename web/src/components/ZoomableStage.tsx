/**
 * ZoomableStage — 스테이지 줌 + 패닝 래퍼
 *
 * 줌: 웹 휠 / 모바일 핀치 (0.5x ~ 3x)
 * 이동: 마우스 드래그 / 모바일 한 손가락 드래그
 * 배경: 격자무늬 (줌/이동에 따라 같이 움직임)
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  children: React.ReactNode;
}

export default function ZoomableStage({ children }: Props) {
  // 줌 스케일
  const [scale, setScale] = useState(1);
  // 패닝 오프셋 (px)
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // 드래그 상태
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  // 핀치 줌용
  const lastDistRef = useRef<number | null>(null);

  const clamp = (v: number) => Math.min(3, Math.max(0.5, v));

  /* ─── 줌 ──────────────────────────────────────────────── */

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => clamp(prev + delta));
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // 핀치 줌 (두 손가락)
    if (e.touches.length >= 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      if (lastDistRef.current !== null) {
        const diff = dist - lastDistRef.current;
        setScale(prev => clamp(prev + diff / 200));
      }
      lastDistRef.current = dist;
      return;
    }

    // 한 손가락 드래그 (패닝)
    if (dragging.current && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy });
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      offsetStart.current = { ...offset };
    }
  }, [offset]);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    lastDistRef.current = null;
  }, []);

  /* ─── 마우스 드래그 (패닝) ────────────────────────────────── */

  const handleMouseDown = useCallback((e: MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  /* ─── 이벤트 등록 ──────────────────────────────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    /* wheel은 .stage 부모에 걸어서 위에 덮인 레이어도 줌 가능 */
    const stageEl = (el.closest('.stage') as HTMLElement) || el;
    stageEl.addEventListener('wheel', handleWheel as EventListener, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      const stageEl = (el.closest('.stage') as HTMLElement) || el;
      stageEl.removeEventListener('wheel', handleWheel as EventListener);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp]);

  /* ─── 격자 배경 크기 (줌에 따라 스케일) ─────────────────── */
  const gridSize = 32 * scale;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        cursor: dragging.current ? 'grabbing' : 'grab',
        overflow: 'hidden',
        /* 격자무늬 배경: 줌/오프셋에 따라 같이 이동 */
        backgroundColor: 'var(--clay)',
        backgroundImage: `
          linear-gradient(var(--line-soft) 1px, transparent 1px),
          linear-gradient(90deg, var(--line-soft) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${offset.x}px ${offset.y}px`,
      }}
    >
      <div style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin: 'center center',
        transition: dragging.current ? 'none' : 'transform 0.1s ease-out',
        width: '100%', height: '100%',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}
