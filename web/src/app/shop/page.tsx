/**
 * 상점 페이지 — 「달리네 만물상」 장부 스타일
 *
 * 코인으로 먹이/애정 아이템 구매 → 인벤토리에 저장.
 * EXP 적용은 여기서 안 함 — 대시보드 스테이지에서 사용.
 *
 * 디자인: 옛날 가게 장부(ledger) 모티프.
 * - 괘선 노트 배경 + 적색 마진선
 * - Gaegu(손글씨) + Nanum Pen Script(펜글씨) 폰트
 * - 인라인 SVG 낙서 아이콘
 * - 구매 시 "확인" 도장 효과
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/* ─── 아이템 정의 ────────────────────────────────────────── */

interface ShopItem {
  id: string;     // DB 키
  name: string;   // 품목명
  desc: string;   // 한줄 설명
  cost: number;   // 코인 가격
  exp: number;    // 경험치 보상 (0이면 특수효과)
}

/** 상점 판매 아이템 2종 — 가방과 동일 */
const ITEMS: ShopItem[] = [
  { id: 'feed', name: '먹이', desc: '배고픔 회복',  cost: 10, exp: 10 },
  { id: 'love', name: '애정', desc: '애정 회복',    cost: 40, exp: 50 },
];

/* ─── 아이템 아이콘 (gpt-image-1 생성 PNG) ─────────────────── */

/**
 * ItemIcon — 아이템별 펜 드로잉 스타일 아이콘
 *
 * public/icons/ 에 저장된 PNG 아이콘을 표시.
 * gpt-image-1로 생성한 손그림 스타일 아이콘.
 */
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

/* ─── 메인 컴포넌트 ──────────────────────────────────────── */

export default function ShopPage() {
  /* 상태 */
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState('');
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);

  const supabase = createClient();

  /* ── 데이터 로드 ── */
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

  /* ── 구매 처리 ── */
  async function handleBuy(item: ShopItem) {
    if (!character) return;
    const coins = character.tokens || 0;

    /* 잔액 부족 */
    if (coins < item.cost) {
      setMessage({ text: '쥔장: 돈이 모자라네…', warn: true });
      setTimeout(() => setMessage(null), 1600);
      return;
    }

    setBuying(item.id);
    setMessage(null);

    /* 인벤토리 업데이트: { feed: 3, love: 1, ... } */
    const inv = { ...(character.inventory || {}) };
    inv[item.id] = (inv[item.id] || 0) + 1;
    const newCoins = coins - item.cost;

    const { error } = await supabase
      .from('characters')
      .update({ tokens: newCoins, inventory: inv })
      .eq('id', character.id);

    if (error) {
      setMessage({ text: `실패: ${error.message}`, warn: true });
      setBuying('');
      return;
    }

    setCharacter({ ...character, tokens: newCoins, inventory: inv });
    setBuying('');
    setMessage({ text: `${item.name} 한 줄 적어드렸수`, warn: false });
    setTimeout(() => setMessage(null), 1600);
  }

  /* ── 오늘 날짜 (장부용 표기) ── */
  const today = new Date();
  const dateLabel = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;

  /* ── 합계 계산 ── */
  const inv = character?.inventory || {};
  const totalSpent = ITEMS.reduce((sum, item) => sum + item.cost * (inv[item.id] || 0), 0);
  const totalItems = Object.values(inv).reduce((a: number, b: any) => a + (b || 0), 0);
  const coins = character?.tokens || 0;

  /* ─── 로딩 상태 ─── */
  if (loading) {
    return (
      <div className="e-frame">
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-handwriting)', fontSize: 20,
        }}>
          장부 펼치는 중...
        </div>
      </div>
    );
  }

  if (!character) return null;

  /* ─── 렌더링 ─── */
  return (
    <div className="e-frame">

      {/* ── GNB ── */}
      <div className="gnb" style={{ background: 'var(--paper-warm)' }}>
        <a className="gnb__logo" href="/dashboard"
           style={{ textDecoration: 'none', color: 'var(--ink-strong)' }}>
          Runmagotchi
        </a>
        <nav className="gnb__nav" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          {/* 코인 표시 */}
          <span style={{
            fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--fs-sm)',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--hwang)', color: 'var(--on-hwang)',
              fontSize: 9, fontWeight: 900, fontFamily: 'serif', lineHeight: 1,
            }}>₩</span>
            {coins.toLocaleString()}
          </span>
          {/* 구분선 */}
          <span style={{ width: 1, height: 14, background: 'var(--line-soft)' }} />
          <a href="/shop" className="active" style={{ fontWeight: 700, color: 'var(--ink-strong)' }}>상점</a>
          <a href="/dashboard">대시보드</a>
          <a href="/profile">프로필</a>
          <a href="/auth/signout" style={{ color: 'var(--ink-faint)' }}>로그아웃</a>
        </nav>
      </div>

      {/* ── 장부 본문 영역 ── */}
      <div className="e-wrap">
        <div className="e-book">

          {/* 상단 테이프 장식 (CSS ::before, ::after) — 아래 style 태그로 처리 */}

          {/* 헤더: 상호명 + 날짜 */}
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
            const cnt = inv[item.id] || 0;
            const tooPoor = coins < item.cost;
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
                <div className="e-row__cost">{item.cost}</div>
                <button
                  className={`e-row__buy ${cnt > 0 ? 'is-stamped' : ''}`}
                  onClick={() => handleBuy(item)}
                  disabled={tooPoor || buying === item.id}
                >
                  {buying === item.id ? '...' : cnt > 0 ? `확인 ${cnt}` : '주세요'}
                </button>
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

          {/* 확인 도장 — 한 번이라도 구매했으면 찍힘 */}
          {totalItems > 0 && (
            <div className="e-stamp">
              <div className="e-stamp__big">확</div>
              <div>인 완 료</div>
            </div>
          )}

          {/* 잉크 자국 (분위기 장식) */}
          <div className="e-blot" style={{ top: 90, right: 70, width: 14, height: 14 }} />
          <div className="e-blot" style={{ top: 280, left: 90, width: 8, height: 8 }} />
          <div className="e-blot" style={{ bottom: 80, right: 180, width: 10, height: 10, opacity: 0.6 }} />

          {/* 좌측 마진 메모 */}
          <div className="e-margin-memo">{today.getMonth() + 1}월</div>
        </div>

        {/* 쥔장 한마디 (구매 피드백) */}
        {message && (
          <div className={`e-msg ${message.warn ? 'is-warn' : ''}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* ── 장부 전용 스타일 ── */}
      <style>{`
        /* === 장부 프레임 === */
        .e-frame {
          border: 1px solid var(--line-strong);
          background: var(--surface);
          display: flex; flex-direction: column;
          min-height: 100vh;
        }

        /* === 장부 본문 래퍼 === */
        .e-wrap {
          flex: 1; overflow: auto;
          padding: var(--s-5) var(--s-4) var(--s-6);
          background: var(--paper-warm);
          /* 미세한 얼룩 그라데이션 — 오래된 종이 느낌 */
          background-image:
            radial-gradient(ellipse at 15% 20%, rgba(184,178,166,0.18) 0, transparent 35%),
            radial-gradient(ellipse at 85% 85%, rgba(184,178,166,0.15) 0, transparent 35%);
        }

        /* === 장부 노트 본체 === */
        .e-book {
          max-width: 580px; margin: 0 auto;
          background: var(--paper);
          /* 흑(heuk) 가로 괘선 + 적(jeok) 세로 마진선 */
          background-image:
            repeating-linear-gradient(180deg, transparent 0 34px, rgba(31,41,55,0.10) 34px 35px),
            linear-gradient(90deg, transparent 0 56px, rgba(179,58,42,0.35) 56px 57px, transparent 57px);
          border: 1px solid var(--line);
          box-shadow:
            0 1px 0 var(--surface) inset,
            0 12px 28px rgba(26,26,26,0.12),
            2px 2px 0 var(--line-soft);
          padding: 30px 36px 60px 76px;
          position: relative;
          font-family: var(--font-handwriting);
          color: var(--ink-strong);
        }

        /* 상단 테이프 장식 */
        .e-book::before, .e-book::after {
          content: ""; position: absolute; top: -8px;
          width: 50px; height: 22px;
          background: rgba(234,227,216,0.85);
          border: 1px dashed var(--line-faint);
          transform: rotate(-3deg);
        }
        .e-book::before { left: 20px; }
        .e-book::after  { right: 20px; transform: rotate(2deg); }

        /* === 헤더 === */
        .e-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          border-bottom: 2px solid var(--ink-strong);
          padding-bottom: 10px; margin-bottom: var(--s-4);
        }
        .e-head__title {
          font-family: var(--font-penscript);
          font-size: 38px; font-weight: 400; line-height: 1;
          color: var(--ink-strong);
        }
        .e-head__sub {
          font-family: var(--font-handwriting);
          font-size: 15px; color: var(--ink-muted); margin-top: 2px;
        }
        .e-head__date {
          font-family: var(--font-handwriting);
          font-size: 16px; color: var(--ink-muted);
        }

        /* === 표 행 === */
        .e-row {
          display: grid;
          grid-template-columns: 26px 1fr 60px 70px 74px;
          align-items: center;
          padding: 6px 0;
          font-size: 18px;
          gap: 8px;
          line-height: 1.4;
        }
        .e-row--head {
          border-bottom: 1.5px solid var(--ink-strong);
          font-size: 15px; color: var(--ink-muted); line-height: 28px;
        }
        .e-row__num {
          font-family: var(--font-handwriting);
          color: var(--ink-muted); font-weight: 700;
        }
        .e-row__name {
          font-family: var(--font-handwriting); font-weight: 700;
          color: var(--ink-strong);
          display: flex; align-items: center;
          min-width: 0;
        }
        .e-row__doodle {
          display: inline-flex; flex-shrink: 0; margin-right: 6px;
        }
        .e-row__name-wrap {
          display: flex; flex-direction: column; min-width: 0;
        }
        .e-row__name-text {
          white-space: nowrap;
        }
        .e-row__desc {
          font-size: 13px; color: var(--ink-muted);
          font-weight: 400; line-height: 1.3;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .e-row__qty {
          color: var(--ink-muted); font-family: var(--font-handwriting);
          text-align: center;
        }
        .e-row__cost {
          font-family: var(--font-handwriting); font-weight: 700;
          text-align: right; padding-right: 8px;
          color: var(--ink-strong);
        }
        .e-row__cost::after {
          content: " ⓦ"; font-size: 14px; color: var(--ink-muted);
        }
        .e-row__cost.is-plain::after { content: ""; }

        /* === 구매 버튼 === */
        .e-row__buy {
          font-family: var(--font-handwriting); font-size: 16px; font-weight: 700;
          padding: 4px 0; background: transparent;
          border: 2px solid var(--ink-strong);
          color: var(--ink-strong);
          cursor: pointer; transition: background 120ms;
        }
        .e-row__buy:hover { background: var(--clay-soft); }
        /* 구매 완료 → 도장 찍힌 효과 */
        .e-row__buy.is-stamped {
          border-color: var(--jeok); color: var(--jeok);
          transform: rotate(-2deg);
        }
        .e-row__buy:disabled {
          border-color: var(--line); color: var(--ink-faint);
          cursor: not-allowed;
        }
        .e-row__buy.is-head {
          border: none; font-size: 14px;
          color: var(--ink-muted); font-weight: 700;
          cursor: default;
        }

        /* === 합계 === */
        .e-totals {
          margin-top: var(--s-5); padding-top: var(--s-3);
          border-top: 1px dashed var(--ink-muted);
          display: flex; justify-content: flex-end; gap: var(--s-5);
          font-size: 20px;
        }
        .e-totals__row {
          display: flex; gap: 12px;
          font-family: var(--font-handwriting); font-weight: 700;
        }
        .e-totals__label { color: var(--ink-muted); }

        /* === 확인 도장 === */
        .e-stamp {
          position: absolute; bottom: 30px; right: 36px;
          width: 92px; height: 92px;
          border: 3px solid var(--jeok); border-radius: 50%;
          color: var(--jeok);
          font-family: var(--font-myeongjo); font-weight: 800;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-size: 12px; line-height: 1.2; letter-spacing: 0.1em;
          transform: rotate(-12deg);
          opacity: 0.88;
          background: rgba(255,255,255,0.4);
          pointer-events: none;
        }
        .e-stamp__big { font-size: 24px; }

        /* === 잉크 자국 장식 === */
        .e-blot {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle, rgba(31,41,55,0.55) 0, rgba(31,41,55,0.12) 70%, transparent 100%);
        }

        /* === 좌측 마진 메모 (세로) === */
        .e-margin-memo {
          position: absolute; left: 14px; top: 60px;
          font-family: var(--font-penscript);
          font-size: 12px; color: var(--jeok);
          writing-mode: vertical-rl; letter-spacing: 0.3em;
        }

        /* === 쥔장 피드백 메시지 === */
        .e-msg {
          text-align: center; margin-top: var(--s-4);
          font-family: var(--font-handwriting); font-size: 18px;
          color: var(--ink-strong);
        }
        .e-msg.is-warn { color: var(--jeok); }

        /* === 모바일 반응형 === */
        @media (max-width: 640px) {
          .e-book {
            padding: 24px 16px 50px 56px;
            /* 마진선 위치도 줄임 */
            background-image:
              repeating-linear-gradient(180deg, transparent 0 34px, rgba(31,41,55,0.10) 34px 35px),
              linear-gradient(90deg, transparent 0 40px, rgba(179,58,42,0.35) 40px 41px, transparent 41px);
          }
          .e-row {
            grid-template-columns: 22px 1fr 44px 52px 58px;
            font-size: 15px; gap: 4px;
          }
          .e-row__desc { display: none; }
          .e-row__doodle { display: none; }
          .e-head__title { font-size: 28px; }
          .e-margin-memo { left: 8px; }
        }
      `}</style>
    </div>
  );
}
