/**
 * 상점 페이지
 *
 * 코인으로 먹이/애정 아이템 구매 → 인벤토리에 저장.
 * EXP 적용은 여기서 안 함 — 대시보드 스테이지에서 사용.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 아이템 정의 ────────────────────────────────────────── */

interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  desc: string;
}

const ITEMS: ShopItem[] = [
  { id: 'feed', name: '먹이', emoji: '🍖', cost: 10, desc: '기본 먹이' },
];

/* ─── 컴포넌트 ──────────────────────────────────────────── */

export default function ShopPage() {
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState('');
  const [message, setMessage] = useState('');

  const supabase = createClient();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }

    const { data: chars } = await supabase
      .from('characters')
      .select('id, tokens, inventory')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    const char = chars?.[0] ?? null;
    if (!char) { window.location.href = '/egg-select'; return; }
    setCharacter(char);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /** 아이템 구매 → 인벤토리에 추가 */
  async function handleBuy(item: ShopItem) {
    if (!character) return;
    const coins = character.tokens || 0;
    if (coins < item.cost) { setMessage('코인 부족'); return; }

    setBuying(item.id);
    setMessage('');

    // 인벤토리 업데이트: { feed: 3, love: 1, ... }
    const inv = { ...(character.inventory || {}) };
    inv[item.id] = (inv[item.id] || 0) + 1;

    const newCoins = coins - item.cost;

    const { error } = await supabase
      .from('characters')
      .update({ tokens: newCoins, inventory: inv })
      .eq('id', character.id);

    if (error) { setMessage(`실패: ${error.message}`); setBuying(''); return; }

    setCharacter({ ...character, tokens: newCoins, inventory: inv });
    setBuying('');
    setMessage(`${item.emoji} ${item.name} 구매 완료`);
  }

  /* ─── 렌더링 ────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-sm text-muted">로딩 중...</div>
      </div>
    );
  }

  if (!character) return null;

  const coins = character.tokens || 0;
  const inv = character.inventory || {};

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>

      {/* 상단바 */}
      <div className="topbar">
        <a href="/dashboard" style={{ textDecoration: 'none', color: 'var(--ink-strong)' }}>← 돌아가기</a>
        <span className="topbar__title">상점</span>
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }}>🪙 {coins}</span>
      </div>

      <div style={{ padding: 'var(--s-5)', maxWidth: 480, margin: '0 auto', width: '100%' }}>

        {/* 인벤토리 요약 */}
        {Object.keys(inv).length > 0 && (
          <div style={{
            padding: 'var(--s-3) var(--s-4)', marginBottom: 'var(--s-4)',
            border: '1px solid var(--line)', background: 'var(--surface)',
            display: 'flex', gap: 'var(--s-4)', fontSize: 'var(--fs-sm)',
          }}>
            <span className="text-xs text-muted">보유</span>
            {ITEMS.map(item => inv[item.id] ? (
              <span key={item.id}>{item.emoji} {inv[item.id]}개</span>
            ) : null)}
          </div>
        )}

        {/* 아이템 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}>
          {ITEMS.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--s-4)',
              padding: 'var(--s-4)', border: '1px solid var(--line)',
              background: 'var(--surface)',
            }}>
              <div style={{ fontSize: 'var(--fs-2xl)', flexShrink: 0 }}>{item.emoji}</div>
              <div style={{ flex: 1 }}>
                <div className="text-sm fw-bold">{item.name}</div>
                <div className="text-xs text-muted">{item.desc}</div>
              </div>
              <button
                className="btn btn--primary"
                style={{ padding: 'var(--s-2) var(--s-3)', fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}
                onClick={() => handleBuy(item)}
                disabled={buying === item.id || coins < item.cost}
              >
                {buying === item.id ? '...' : `🪙 ${item.cost}`}
              </button>
            </div>
          ))}
        </div>

        {/* 피드백 */}
        {message && (
          <div style={{
            marginTop: 'var(--s-4)', textAlign: 'center',
            fontSize: 'var(--fs-sm)', fontWeight: 700,
            color: message.includes('실패') || message.includes('부족') ? 'var(--jeok)' : 'var(--ink-strong)',
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
