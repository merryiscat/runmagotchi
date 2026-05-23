/**
 * FeedingStage — 드래그 앤 드롭 먹이주기 + 가방
 *
 * 기본 아이템 2종: 먹이(배고픔 회복), 애정(애정 회복).
 * - 알 상태: 애정만 사용 가능. 애정이 충분히 쌓이면 부화.
 * - 부화 후: 먹이 + 애정 둘 다 사용 가능.
 *
 * 드래그: 가방에서 아이템을 끌어 스테이지에 놓으면 음식이 떨어짐.
 * 캐릭터가 배고프면(hunger < 70) 스스로 먹이를 향해 걸어가서 먹음.
 * 테스트 중에는 항상 먹으러 감.
 *
 * 배고픔/애정 수치는 UI에 표시하지 않음 — 캐릭터 행동으로만 추측.
 * 아이콘은 상점에서 생성한 PNG 사용 (/icons/).
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 아이템 정의 (기본 2종) ─────────────────────────────── */

interface ItemDef {
  id: string;
  name: string;
  hungerGain: number;
  affectionGain: number;
  expGain: number;
  icon: string;
  eggAllowed: boolean;
}

const ITEM_DEFS: ItemDef[] = [
  { id: 'feed',  name: '먹이',       hungerGain: 30, affectionGain: 0,  expGain: 10, icon: '/icons/feed-1.png',  eggAllowed: false },
  { id: 'love',  name: '애정',       hungerGain: 0,  affectionGain: 40, expGain: 10, icon: '/icons/love-1.png',  eggAllowed: false },
  { id: 'candy', name: '경험치 사탕', hungerGain: 0,  affectionGain: 0,  expGain: 20, icon: '/icons/candy-1.png', eggAllowed: false },
];

/* ─── 성장 계산 — behavior.ts에서 가져옴 ────────────────── */

import {
  expToLevel,
  levelToStage,
  stageLabel,
  canUseItem,
} from '@/lib/behavior';

/* ─── Props ──────────────────────────────────────────────── */

/** 음식 타겟 — BouncingCharacter에 전달용 */
export interface FoodTarget {
  uid: string;
  x: number;
  y: number;
}

interface Props {
  characterId: string;
  initialInventory: Record<string, number>;
  initialExp: number;
  initialLevel: number;
  initialHunger: number;
  initialAffection: number;
  hatched: boolean;
  /** 현재 먹으러 갈 음식 + 도착 콜백을 부모에게 전달 */
  onFoodState?: (target: FoodTarget | null, onReach: (uid: string) => void) => void;
}

/* ─── 메인 컴포넌트 ──────────────────────────────────────── */

export default function FeedingStage({
  characterId, initialInventory, initialExp, initialLevel,
  initialHunger, initialAffection, hatched: initialHatched,
  onFoodState,
}: Props) {
  const [inventory, setInventory] = useState<Record<string, number>>(initialInventory);
  const [exp, setExp] = useState(initialExp);
  const [level, setLevel] = useState(initialLevel);
  const [hunger, setHunger] = useState(initialHunger);
  const [affection, setAffection] = useState(initialAffection);
  const [hatched, setHatched] = useState(initialHatched);

  const [bagOpen, setBagOpen] = useState(false);

  /* 드래그: 아이템 ID + 현재 커서 좌표 */
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  /* 드롭된 음식 큐 */
  const [foods, setFoods] = useState<Array<{
    uid: string; id: string; x: number; y: number;
    status: 'dropping' | 'waiting' | 'eaten';
  }>>([]);

  /* 손글씨 메시지 */
  const [msgs, setMsgs] = useState<Array<{
    uid: string; text: string; x: number; y: number; warn?: boolean;
  }>>([]);

  /* 부화 이름짓기는 EggStage에서 처리 */

  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const availableItems = ITEM_DEFS.filter(d => hatched || d.eggAllowed);
  const hasItems = availableItems.some(d => (inventory[d.id] || 0) > 0);

  /* ── 메시지 ── */
  function pushMsg(text: string, x: number, y: number, warn = false) {
    const uid = Math.random().toString(36).slice(2);
    setMsgs(prev => [...prev, { uid, text, x, y, warn }]);
    setTimeout(() => setMsgs(prev => prev.filter(m => m.uid !== uid)), 1100);
  }

  /* ══════════════════════════════════════════════════════════
   *  드래그 — window 레벨 이벤트로 처리 (PC/모바일 모두 작동)
   * ══════════════════════════════════════════════════════════ */

  /* 드래그 시작: 가방 아이템에서 pointerdown */
  const onPickup = useCallback((id: string, e: React.PointerEvent) => {
    if (!inventory[id]) return;
    e.preventDefault();
    setDragItem(id);
    setDragPos({ x: e.clientX, y: e.clientY });
  }, [inventory]);

  /* 드래그 이동 + 끝: window에 리스너 등록 */
  useEffect(() => {
    if (!dragItem) return;

    function onMove(e: PointerEvent) {
      setDragPos({ x: e.clientX, y: e.clientY });
    }

    function onUp(e: PointerEvent) {
      /* 드롭 위치 계산 */
      const container = containerRef.current;
      if (!container) { setDragItem(null); return; }

      const r = container.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && x <= r.width && y >= 0 && y <= r.height;

      if (inside && dragItem && (inventory[dragItem] || 0) > 0) {
        dropFood(dragItem, x, y);
      }

      setDragItem(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragItem, inventory]);

  /* ── 음식 드롭 처리 ── */
  function dropFood(itemId: string, x: number, y: number) {
    /* 인벤토리 차감 */
    const newInv = { ...inventory };
    newInv[itemId] = (newInv[itemId] || 1) - 1;
    if (newInv[itemId] <= 0) delete newInv[itemId];
    setInventory(newInv);

    /* 음식 드롭 애니메이션 */
    const uid = Math.random().toString(36).slice(2);
    setFoods(prev => [...prev, { uid, id: itemId, x, y, status: 'dropping' }]);

    /* 드롭 → waiting (스테이지에 계속 남아있음) */
    setTimeout(() => {
      setFoods(prev => prev.map(f => f.uid === uid ? { ...f, status: 'waiting' } : f));
    }, 380);

    /*
     * 음식은 스테이지에 유지됨. 캐릭터가 알아서 먹으러 감.
     * 먹기 타이밍은 캐릭터가 음식 근처에 도착했을 때 처리.
     * 현재는 BouncingCharacter와 좌표 연동 전이므로,
     * waiting 상태 음식을 주기적으로 체크해서 처리하는 방식 사용.
     */
  }

  /* ── 먹기 → Supabase 업데이트 ── */
  async function eatFood(
    foodUid: string, itemId: string, x: number, y: number,
    currentInv: Record<string, number>
  ) {
    const item = ITEM_DEFS.find(d => d.id === itemId);
    if (!item) return;

    /* 포만감 체크 — 배부르면 먹이 거부, 애정 충분하면 애정 거부 */
    const check = canUseItem(itemId, hunger, affection);
    if (!check.usable) {
      /* 아이템 사용 불가 → 거부 메시지 + 인벤토리 복구 */
      pushMsg(check.reason || '안 먹어요', x, y - 40, true);
      /* 음식은 사라지지만 인벤토리에 아이템 돌려줌 */
      const restored = { ...currentInv };
      restored[itemId] = (restored[itemId] || 0) + 1;
      setInventory(restored);
      setFoods(prev => prev.filter(f => f.uid !== foodUid));
      return;
    }

    setFoods(prev => prev.map(f => f.uid === foodUid ? { ...f, status: 'eaten' } : f));

    const newHunger = Math.min(100, hunger + item.hungerGain);
    const newAffection = Math.min(100, affection + item.affectionGain);
    const newExp = exp + item.expGain;
    const newLevel = expToLevel(newExp);
    const newStage = levelToStage(newLevel);
    const oldStage = levelToStage(level);

    if (item.hungerGain > 0) pushMsg('냠!', x, y - 40);
    if (item.affectionGain > 0) pushMsg('♥', x, y - 40);
    if (itemId === 'candy') pushMsg('✦', x, y - 40);

    setHunger(newHunger);
    setAffection(newAffection);
    setExp(newExp);
    setLevel(newLevel);

    await supabase
      .from('characters')
      .update({
        inventory: currentInv,
        total_exp: newExp,
        level: newLevel,
        stage: newStage,
        hunger: newHunger,
        affection: newAffection,
        stats_updated_at: new Date().toISOString(),
      })
      .eq('id', characterId);

    setTimeout(() => {
      setFoods(prev => prev.filter(f => f.uid !== foodUid));
    }, 400);

    /* 진화 알림 */
    if (newStage !== oldStage && newStage !== 'egg') {
      pushMsg(`${stageLabel(newStage)}(으)로 진화!`, x, y - 60);
      setTimeout(() => window.location.reload(), 1500);
    }
  }

  /* ── 캐릭터가 음식 위치에 도착하면 호출됨 (BouncingCharacter에서 콜백) ── */
  const handleReachFood = useCallback((foodUid: string) => {
    const food = foods.find(f => f.uid === foodUid && f.status === 'waiting');
    if (!food) return;
    eatFood(food.uid, food.id, food.x, food.y, inventory);
  }, [foods, inventory, hunger, affection, exp, level, hatched]);

  /* ── 현재 먹으러 갈 음식 (첫 번째 waiting) — BouncingCharacter에 전달 ── */
  const currentFoodTarget = foods.find(f => f.status === 'waiting') || null;

  /* ── 부모에게 음식 상태 전달 ── */
  useEffect(() => {
    onFoodState?.(currentFoodTarget, handleReachFood);
  }, [currentFoodTarget, handleReachFood]);

  /* ── 클라이언트 실시간 감소 (1분마다) ── */
  useEffect(() => {
    const interval = setInterval(() => {
      setHunger(h => Math.max(0, h - 1));
      setAffection(a => Math.max(0, a - 1));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  /* ─── 렌더링 ─── */
  return (
    <>
      {/* 전체 컨테이너 ref (드롭 좌표 계산용) */}
      <div ref={containerRef} style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ═══ 가방 ═══ */}
      {hasItems && (
        <div style={{
          position: 'absolute', right: 'var(--s-3)', top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        }}>
          {/* 가방 제목 — 항상 보임, 클릭하면 토글 */}
          <button
            onClick={() => setBagOpen(o => !o)}
            style={{
              background: 'var(--paper)', border: '1.5px solid var(--ink-strong)',
              borderBottom: bagOpen ? '1.5px dashed var(--line)' : '1.5px solid var(--ink-strong)',
              padding: '8px 16px',
              boxShadow: bagOpen ? 'none' : '3px 3px 0 var(--ink-strong)',
              fontFamily: 'var(--font-penscript)', fontSize: 20,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            가방
          </button>

          {/* 아이템 목록 — 아래로 펼침 */}
          {bagOpen && (
            <div style={{
              background: 'var(--paper)',
              border: '1.5px solid var(--ink-strong)',
              borderTop: 'none',
              padding: 'var(--s-2) var(--s-3)',
              display: 'flex', flexDirection: 'column', gap: 'var(--s-1)',
              boxShadow: '3px 3px 0 var(--ink-strong)',
              fontFamily: 'var(--font-handwriting)',
              minWidth: 130,
            }}>
              {availableItems.map(item => {
                const count = inventory[item.id] || 0;
                const empty = count === 0;
                return (
                  <div
                    key={item.id}
                    onPointerDown={e => !empty && onPickup(item.id, e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--s-2)',
                      padding: '4px 6px', fontSize: 15,
                      border: `1.5px dashed ${dragItem === item.id ? 'var(--jeok)' : 'transparent'}`,
                      background: dragItem === item.id ? 'rgba(179,58,42,0.05)' : 'transparent',
                      cursor: empty ? 'not-allowed' : 'grab',
                      opacity: empty ? 0.35 : 1,
                      touchAction: 'none',
                      transition: 'background 120ms, border-color 120ms',
                      pointerEvents: empty ? 'none' : 'auto',
                    }}
                  >
                    <img src={item.icon} alt={item.name} width={26} height={26}
                      style={{ objectFit: 'contain', pointerEvents: 'none' }} />
                    <span style={{ flex: 1, fontWeight: 700 }}>{item.name}</span>
                    <span style={{ fontWeight: 700, color: 'var(--ink-muted)', fontSize: 14 }}>{count}개</span>
                  </div>
                );
              })}

              {/* 닫기 버튼 — 하단 */}
              <button
                onClick={() => setBagOpen(false)}
                style={{
                  marginTop: 'var(--s-1)',
                  padding: '4px 0',
                  background: 'none', border: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontSize: 14, color: 'var(--ink-muted)',
                  fontFamily: 'var(--font-handwriting)',
                }}
              >닫기</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ 드래그 중 커서에 따라다니는 아이콘 ═══ */}
      {dragItem && (
        <div style={{
          position: 'fixed',
          left: dragPos.x - 20, top: dragPos.y - 20,
          pointerEvents: 'none', zIndex: 100,
          opacity: 0.85,
        }}>
          <div style={{
            background: 'var(--paper)', border: '1.5px solid var(--ink-strong)',
            padding: 3, boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
          }}>
            <img
              src={ITEM_DEFS.find(d => d.id === dragItem)?.icon}
              alt="" width={36} height={36}
              style={{ objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* ═══ 드롭된 음식 ═══ */}
      {foods.map(food => {
        const item = ITEM_DEFS.find(d => d.id === food.id);
        if (!item) return null;
        return (
          <div
            key={food.uid}
            className={food.status === 'dropping' ? 'food-drop' : food.status === 'eaten' ? 'food-eaten' : ''}
            style={{
              position: 'absolute', left: food.x, top: food.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 8,
            }}
          >
            <div style={{
              background: 'var(--paper)', border: '1.5px solid var(--ink-strong)',
              padding: 4, boxShadow: '2px 3px 0 rgba(0,0,0,0.15)',
            }}>
              <img src={item.icon} alt={item.name} width={32} height={32}
                style={{ objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        );
      })}

      {/* ═══ 손글씨 메시지 ═══ */}
      {msgs.map(m => (
        <div
          key={m.uid}
          className="scribble-msg"
          style={{
            position: 'absolute', left: m.x, top: m.y,
            fontFamily: 'var(--font-penscript)', fontSize: 22,
            color: m.warn ? 'var(--jeok)' : 'var(--ink-strong)',
            transform: 'translate(-50%, 0)',
            pointerEvents: 'none', zIndex: 30,
          }}
        >
          {m.text}
        </div>
      ))}

      {/* ═══ 애니메이션 CSS ═══ */}
      <style>{`
        .food-drop {
          animation: foodDrop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes foodDrop {
          0%   { transform: translate(-50%, -120%) scale(0.6) rotate(-12deg); opacity: 0; }
          60%  { transform: translate(-50%, -42%)  scale(1.1) rotate(4deg); opacity: 1; }
          100% { transform: translate(-50%, -50%)  scale(1)   rotate(0deg); opacity: 1; }
        }
        .food-eaten {
          animation: foodEaten 400ms ease-in forwards;
        }
        @keyframes foodEaten {
          from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to   { transform: translate(-50%, -90%) scale(0.4); opacity: 0; }
        }
        .scribble-msg {
          animation: floatUp 1100ms ease-out forwards;
        }
        @keyframes floatUp {
          from { transform: translate(-50%, 0) rotate(-3deg); opacity: 0; }
          20%  { opacity: 1; }
          to   { transform: translate(-50%, -64px) rotate(-1deg); opacity: 0; }
        }
      `}</style>
    </>
  );
}
