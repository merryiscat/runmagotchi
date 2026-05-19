/**
 * InventoryBar — 스테이지 하단 인벤토리 아이템 사용 바
 *
 * 보유 아이템을 캐릭터에게 사용 → EXP 증가.
 * 부화/진화 모두 스테이지 안에서 처리 (페이지 이동 없음).
 * 부화 시 이름 짓기 모달을 스테이지 위에 띄움.
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 아이템 효과 정의 ──────────────────────────────────── */

interface ItemDef {
  id: string;
  emoji: string;
  name: string;
  expGain: number;
}

const ITEM_DEFS: ItemDef[] = [
  { id: 'feed', emoji: '🍖', name: '먹이', expGain: 10 },
];

/* ─── 성장 계산 ─────────────────────────────────────────── */

const LEVEL_THRESHOLDS: number[] = [0];
(() => {
  const targets = [500, 1500, 3500, 7000, 13000];
  for (let stage = 0; stage < 5; stage++) {
    const prev = stage === 0 ? 0 : targets[stage - 1];
    const diff = targets[stage] - prev;
    for (let i = 1; i <= 10; i++) {
      LEVEL_THRESHOLDS.push(prev + Math.round((diff * i) / 10));
    }
  }
})();

function expToLevel(exp: number): number {
  for (let lv = LEVEL_THRESHOLDS.length - 1; lv >= 1; lv--) {
    if (exp >= LEVEL_THRESHOLDS[lv]) return lv;
  }
  return 0;
}

function levelToStage(level: number): string {
  if (level <= 0) return 'egg';
  if (level <= 10) return 'baby';
  if (level <= 20) return 'child';
  if (level <= 30) return 'teen';
  if (level <= 40) return 'adult';
  return 'final';
}

function stageLabel(s: string): string {
  return { egg: '알', baby: '유아', child: '유년', teen: '초기체', adult: '중기체', final: '완전체' }[s] || s;
}

/* ─── Props ──────────────────────────────────────────────── */

interface Props {
  characterId: string;
  initialInventory: Record<string, number>;
  initialExp: number;
  initialLevel: number;
  hatched: boolean;
}

/* ─── 컴포넌트 ──────────────────────────────────────────── */

export default function InventoryBar({
  characterId, initialInventory, initialExp, initialLevel, hatched: initialHatched,
}: Props) {
  const [inventory, setInventory] = useState<Record<string, number>>(initialInventory);
  const [exp, setExp] = useState(initialExp);
  const [level, setLevel] = useState(initialLevel);
  const [hatched, setHatched] = useState(initialHatched);
  const [using, setUsing] = useState('');
  const [message, setMessage] = useState('');

  // 부화 이름짓기 모달
  const [showNaming, setShowNaming] = useState(false);
  const [charName, setCharName] = useState('');
  const [namingSaving, setNamingSaving] = useState(false);

  const supabase = createClient();

  /** 아이템 사용 → EXP 증가 */
  async function handleUse(item: ItemDef) {
    const count = inventory[item.id] || 0;
    if (count <= 0) return;

    setUsing(item.id);
    setMessage('');

    // 인벤토리에서 1개 차감
    const newInv = { ...inventory };
    newInv[item.id] = count - 1;
    if (newInv[item.id] <= 0) delete newInv[item.id];

    // EXP 계산
    const newExp = exp + item.expGain;
    const newLevel = expToLevel(newExp);
    const oldLevel = level;
    const newStage = levelToStage(newLevel);

    const { error } = await supabase
      .from('characters')
      .update({ inventory: newInv, total_exp: newExp, level: newLevel, stage: newStage })
      .eq('id', characterId);

    if (error) { setMessage('실패'); setUsing(''); return; }

    setInventory(newInv);
    setExp(newExp);
    setLevel(newLevel);
    setUsing('');

    // 부화 트리거: 레벨 1 도달 + 아직 알 → 이름짓기 모달
    if (!hatched && newLevel >= 1) {
      setShowNaming(true);
      return;
    }

    // 진화 알림
    const oldStage = levelToStage(oldLevel);
    if (newStage !== oldStage && newStage !== 'egg') {
      setMessage(`${stageLabel(newStage)}(으)로 진화!`);
      // 페이지 새로고침으로 새 이미지 반영
      setTimeout(() => window.location.reload(), 1500);
      return;
    }

    setMessage(`${item.emoji} +${item.expGain} EXP`);
    setTimeout(() => setMessage(''), 1500);
  }

  /** 이름 확정 → 부화 완료 */
  async function handleNameConfirm() {
    if (charName.length < 2) return;
    setNamingSaving(true);

    const { error } = await supabase
      .from('characters')
      .update({ name: charName, hatched: true, stage: 'baby' })
      .eq('id', characterId);

    if (error) { setNamingSaving(false); return; }

    setHatched(true);
    setShowNaming(false);
    // 새로고침해서 도트 캐릭터 표시
    window.location.reload();
  }

  // 아이템이 하나도 없으면 표시 안 함
  const hasItems = ITEM_DEFS.some(d => (inventory[d.id] || 0) > 0);

  return (
    <>
      {/* 인벤토리 바 */}
      {(hasItems || message) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--s-3)', padding: 'var(--s-2) var(--s-4)',
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)',
          borderTop: '1px solid var(--line-soft)',
        }}>
          {ITEM_DEFS.map(item => {
            const count = inventory[item.id] || 0;
            if (count <= 0) return null;
            return (
              <button
                key={item.id}
                onClick={() => handleUse(item)}
                disabled={using === item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--s-1)',
                  padding: 'var(--s-2) var(--s-3)',
                  border: '1px solid var(--line)', background: 'var(--surface)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                }}
              >
                <span>{item.emoji}</span>
                <span style={{ fontWeight: 700 }}>{count}</span>
              </button>
            );
          })}

          {message && (
            <span className="text-xs fw-bold" style={{
              color: message.includes('실패') ? 'var(--jeok)' : 'var(--cheong)',
            }}>
              {message}
            </span>
          )}
        </div>
      )}

      {/* 부화 이름짓기 모달 — fixed로 전체 화면 중앙 오버레이 */}
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
              value={charName}
              onChange={e => setCharName(e.target.value)}
              className="input"
              autoFocus
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
    </>
  );
}
