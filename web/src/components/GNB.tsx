/**
 * GNB — 전역 상단 네비게이션 바
 *
 * 모든 페이지에서 동일한 구조:
 *   [로고]                    [코인] | [대시보드] [withRUN] [상점] [프로필] [로그아웃]
 *
 * 탭 너비 고정 — 활성 탭이 bold 되어도 코인 위치가 밀리지 않음.
 */

interface Props {
  /** 현재 페이지 */
  active?: 'dashboard' | 'shop' | 'profile' | 'upload' | 'rooms';
  /** 코인 잔액 (undefined면 코인 표시 안 함) */
  coins?: number;
  /** 뒤로가기 모드 */
  backTo?: string;
  /** 페이지 제목 (뒤로가기 모드일 때 중앙에 표시) */
  title?: string;
}

/* 탭 정의 — 고정 너비로 bold 시 레이아웃 시프트 방지 */
const TABS = [
  { key: 'dashboard', label: '대시보드', href: '/dashboard', width: 62 },
  { key: 'rooms',     label: 'withRUN',  href: '/rooms',     width: 60 },
  { key: 'shop',      label: '상점',     href: '/shop',      width: 34 },
  { key: 'profile',   label: '프로필',   href: '/profile',   width: 42 },
] as const;

export default function GNB({ active, coins, backTo, title }: Props) {
  return (
    <div className="gnb">
      {/* 좌: 로고 또는 뒤로가기 */}
      {backTo ? (
        <a href={backTo} className="gnb__logo" style={{ textDecoration: 'none' }}>
          ← {title ? '' : '돌아가기'}
        </a>
      ) : (
        <a href="/dashboard" className="gnb__logo">
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 28 }} />
        </a>
      )}

      {/* 중앙: 제목 (뒤로가기 모드) */}
      {title && (
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-md)',
          fontWeight: 700, color: 'var(--ink-strong)',
        }}>
          {title}
        </span>
      )}

      {/* 우: 네비게이션 */}
      <nav className="gnb__nav" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
        {/* 코인 표시 */}
        {coins !== undefined && (
          <>
            <span style={{
              fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink-default)',
              fontFamily: 'var(--font-handwriting)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
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
          </>
        )}

        {/* 탭 링크 — 고정 너비 */}
        {TABS.map(tab => {
          const isActive = active === tab.key;
          return (
            <a
              key={tab.key}
              href={tab.href}
              className={isActive ? 'active' : ''}
              style={{
                width: tab.width,
                textAlign: 'center',
                fontWeight: isActive ? 700 : undefined,
                color: isActive ? 'var(--ink-strong)' : undefined,
              }}
            >
              {tab.label}
            </a>
          );
        })}

        {/* 로그아웃 */}
        <form action="/auth/signout" method="post" style={{ display: 'inline' }}>
          <button type="submit" style={{
            color: 'var(--ink-faint)', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
          }}>로그아웃</button>
        </form>
      </nav>
    </div>
  );
}
