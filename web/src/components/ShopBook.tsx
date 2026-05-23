/**
 * ShopBook — 상점 장부 UI (클라이언트 컴포넌트)
 *
 * 구매 버튼 클릭 → Supabase 업데이트 → 상태 반영.
 * 데이터 로드는 부모(서버 컴포넌트)에서 하고 props로 전달받는다.
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 아이템 정의 ─── */

interface ShopItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  exp: number;
  /** 알 티켓으로도 구매 가능 여부 */
  ticketBuyable?: boolean;
}

const ITEMS: ShopItem[] = [
  { id: 'feed',  name: '먹이',       desc: '배고픔 회복',      cost: 10,    exp: 10 },
  { id: 'love',  name: '애정',       desc: '애정 회복',        cost: 40,    exp: 10 },
  { id: 'candy', name: '경험치 사탕', desc: '달콤한 성장의 맛', cost: 50,    exp: 20 },
  { id: 'egg',   name: '새 알',      desc: '새로운 시작',      cost: 10000, exp: 0, ticketBuyable: true },
];

/* ─── Props ─── */

interface Props {
  characterId: string;
  userId: string;
  initialCoins: number;
  initialInventory: Record<string, number>;
  /** 보유 알 티켓 수 (완전체 달성 보상) */
  initialEggTickets: number;
}

/* ─── 아이콘 ─── */

function ItemIcon({ id }: { id: string }) {
  return (
    <img
      src={`/icons/${id}-1.png`}
      alt={id}
      width={30}
      height={30}
      style={{ objectFit: 'contain' }}
    />
  );
}

/* ─── 컴포넌트 ─── */

export default function ShopBook({
  characterId, userId, initialCoins, initialInventory, initialEggTickets,
}: Props) {
  const [coins, setCoins] = useState(initialCoins);
  const [inventory, setInventory] = useState<Record<string, number>>(initialInventory);
  const [eggTickets, setEggTickets] = useState(initialEggTickets);
  const [buying, setBuying] = useState('');
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);

  const supabase = createClient();

  /* ── 구매 처리 ── */
  async function handleBuy(item: ShopItem, useTicket = false) {
    /* 알 티켓 구매 */
    if (useTicket && item.ticketBuyable) {
      if (eggTickets <= 0) {
        setMessage({ text: '알 티켓이 없어요', warn: true });
        setTimeout(() => setMessage(null), 1600);
        return;
      }

      setBuying(item.id);
      const newTickets = eggTickets - 1;

      /* 프로필에 티켓 차감 */
      await supabase
        .from('profiles')
        .update({ egg_tickets: newTickets })
        .eq('id', userId);

      /* 인벤토리에 알 추가 */
      const inv = { ...inventory };
      inv[item.id] = (inv[item.id] || 0) + 1;
      await supabase
        .from('characters')
        .update({ inventory: inv })
        .eq('id', characterId);

      setEggTickets(newTickets);
      setInventory(inv);
      setBuying('');
      setMessage({ text: '알 티켓 사용! 새 알을 받았수', warn: false });
      setTimeout(() => setMessage(null), 1600);
      return;
    }

    /* 코인 구매 — 잔액 부족 */
    if (coins < item.cost) {
      setMessage({ text: '쥔장: 돈이 모자라네…', warn: true });
      setTimeout(() => setMessage(null), 1600);
      return;
    }

    setBuying(item.id);
    setMessage(null);

    /* 인벤토리 업데이트 */
    const inv = { ...inventory };
    inv[item.id] = (inv[item.id] || 0) + 1;
    const newCoins = coins - item.cost;

    const { error } = await supabase
      .from('characters')
      .update({ tokens: newCoins, inventory: inv })
      .eq('id', characterId);

    if (error) {
      setMessage({ text: `실패: ${error.message}`, warn: true });
      setBuying('');
      return;
    }

    setCoins(newCoins);
    setInventory(inv);
    setBuying('');
    setMessage({ text: `${item.name} 한 줄 적어드렸수`, warn: false });
    setTimeout(() => setMessage(null), 1600);
  }

  /* ── 날짜 ── */
  const today = new Date();
  const dateLabel = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;

  /* ── 합계 ── */
  const totalSpent = ITEMS.reduce((sum, item) => sum + item.cost * (inventory[item.id] || 0), 0);
  const totalItems = Object.values(inventory).reduce((a: number, b: any) => a + (b || 0), 0);

  return (
    <>
      {/* 장부 본문 */}
      <div className="e-wrap">
        <div className="e-book">

          {/* 헤더 */}
          <div className="e-head">
            <div>
              <div className="e-head__title">달리네 만물상</div>
              <div className="e-head__sub">ㅡ 외상 사절 ㅡ</div>
            </div>
            <div className="e-head__date">{dateLabel}</div>
          </div>

          {/* 표 머리줄 */}
          <div className="e-row e-row--head">
            <div className="e-row__num">#</div>
            <div className="e-row__name">품목</div>
            <div className="e-row__qty">경험</div>
            <div className="e-row__cost is-plain">값</div>
            <div className="e-row__buy is-head">장부</div>
          </div>

          {/* 아이템 줄 */}
          {ITEMS.map((item, idx) => {
            const cnt = inventory[item.id] || 0;
            const tooPoor = coins < item.cost;
            const hasTicket = item.ticketBuyable && eggTickets > 0;
            return (
              <div key={item.id} className="e-row">
                <div className="e-row__num">{idx + 1}.</div>
                <div className="e-row__name">
                  <span className="e-row__doodle"><ItemIcon id={item.id} /></span>
                  <span className="e-row__name-wrap">
                    <span className="e-row__name-text">{item.name}</span>
                    <span className="e-row__desc">{item.desc}</span>
                  </span>
                </div>
                <div className="e-row__qty">{item.exp ? `+${item.exp}` : '─'}</div>
                <div className="e-row__cost">{item.cost.toLocaleString()}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* 코인 구매 */}
                  <button
                    className={`e-row__buy ${cnt > 0 ? 'is-stamped' : ''}`}
                    onClick={() => handleBuy(item)}
                    disabled={tooPoor || buying === item.id}
                  >
                    {buying === item.id ? '...' : cnt > 0 ? `확인 ${cnt}` : '주세요'}
                  </button>
                  {/* 알 티켓 구매 (티켓 보유 시에만 표시) */}
                  {item.ticketBuyable && (
                    <button
                      className="e-row__buy"
                      onClick={() => handleBuy(item, true)}
                      disabled={!hasTicket || buying === item.id}
                      style={{
                        fontSize: 12, padding: '2px 0',
                        borderColor: hasTicket ? 'var(--hwang)' : 'var(--line)',
                        color: hasTicket ? 'var(--hwang)' : 'var(--ink-faint)',
                      }}
                    >
                      🎫 티켓 ({eggTickets})
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* 합계 줄 */}
          <div className="e-totals">
            <div className="e-totals__row">
              <span className="e-totals__label">샀음</span>
              <span>{totalItems} 개</span>
            </div>
            <div className="e-totals__row">
              <span className="e-totals__label">계</span>
              <span>{totalSpent} ⓦ</span>
            </div>
          </div>

          {/* 확인 도장 */}
          {totalItems > 0 && (
            <div className="e-stamp">
              <div className="e-stamp__big">확</div>
              <div>인 완 료</div>
            </div>
          )}

          {/* 잉크 자국 */}
          <div className="e-blot" style={{ top: 90, right: 70, width: 14, height: 14 }} />
          <div className="e-blot" style={{ top: 280, left: 90, width: 8, height: 8 }} />
          <div className="e-blot" style={{ bottom: 80, right: 180, width: 10, height: 10, opacity: 0.6 }} />

          {/* 좌측 마진 메모 */}
          <div className="e-margin-memo">{today.getMonth() + 1}월</div>
        </div>

        {/* 쥔장 한마디 */}
        {message && (
          <div className={`e-msg ${message.warn ? 'is-warn' : ''}`}>
            {message.text}
          </div>
        )}
      </div>
    </>
  );
}
