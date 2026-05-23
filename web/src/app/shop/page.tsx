/**
 * 상점 페이지 — 「달리네 만물상」 장부 스타일
 *
 * 서버 컴포넌트: 데이터를 서버에서 로드해 즉시 렌더링 (딜레이 없음).
 * 구매 인터랙션은 클라이언트 컴포넌트(ShopBook)에서 처리.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GNB from '@/components/GNB';
import ShopBook from '@/components/ShopBook';

export default async function ShopPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* 활성 캐릭터 조회 */
  const { data: characters } = await supabase
    .from('characters')
    .select('id, tokens, inventory')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const character = characters?.[0] ?? null;
  if (!character) redirect('/egg-select');

  /* 알 티켓 조회 (완전체 달성 보상) */
  const { data: profileData } = await supabase
    .from('profiles')
    .select('egg_tickets')
    .eq('id', user.id)
    .single();

  const coins = character.tokens || 0;
  const eggTickets = profileData?.egg_tickets || 0;

  return (
    <div className="e-frame">

      <GNB active="shop" coins={coins} />

      {/* 장부 UI (클라이언트 컴포넌트) */}
      <ShopBook
        characterId={character.id}
        userId={user.id}
        initialCoins={coins}
        initialInventory={character.inventory || {}}
        initialEggTickets={eggTickets}
      />

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
          background-image:
            radial-gradient(ellipse at 15% 20%, rgba(184,178,166,0.18) 0, transparent 35%),
            radial-gradient(ellipse at 85% 85%, rgba(184,178,166,0.15) 0, transparent 35%);
        }

        /* === 장부 노트 본체 === */
        .e-book {
          max-width: 580px; margin: 0 auto;
          background: var(--paper);
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

        /* === 좌측 마진 메모 === */
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
