/**
 * 프로필 페이지 (P1 기획 + UI Kit)
 *
 * 기획안: p1-layout (좌 사이드바 + 우 콘텐츠)
 * 사이드바: 알/캐릭터 이미지 + 닉네임 + 성별 + 화면 표시 토글 + 로그아웃
 * 콘텐츠: 런닝 통계 + 칭호
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, birth_date, egg_image_url, egg_combo')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>

      {/* GNB — 프로필 탭 활성 */}
      <div className="gnb">
        <a href="/dashboard" className="gnb__logo">
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 28 }} />
        </a>
        <nav className="gnb__nav">
          <a href="/upload">업로드</a>
          <a href="/profile" className="active">프로필</a>
        </nav>
      </div>

      {/* p1-layout: 사이드바 + 콘텐츠 */}
      <div className="p1-layout" style={{ flex: 1 }}>

        {/* 좌: 사이드바 */}
        <div className="p1-sidebar">
          {/* 알/캐릭터 이미지 */}
          <div className="p1-sidebar__img">
            {profile.egg_image_url ? (
              <img src={profile.egg_image_url} alt="알"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span>???</span>
            )}
          </div>

          {/* 닉네임 + 성별 */}
          <div className="text-sm fw-bold">
            {profile.nickname || '???'}
          </div>

          {/* 로그아웃 */}
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-xs text-muted" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', marginTop: 'var(--s-1)',
            }}>
              로그아웃
            </button>
          </form>

          {/* 화면 표시 토글 */}
          <div style={{ width: '100%', marginTop: 'var(--s-4)' }}>
            <div className="text-xs fw-bold" style={{ marginBottom: 'var(--s-2)' }}>화면 표시</div>
            <div className="list-item" style={{ borderBottom: 'none', padding: 'var(--s-2) 0', gap: 'var(--s-2)' }}>
              <div style={{
                width: 32, height: 32, border: '1px solid var(--line)',
                borderRadius: '50%', background: 'var(--clay-soft)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4,
              }}>
                {profile.egg_image_url ? (
                  <img src={profile.egg_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : <span style={{ fontSize: 9 }}>?</span>}
              </div>
              <div style={{ flex: 1, fontSize: 12 }}>{profile.nickname || '???'}</div>
              <div className="toggle toggle--on" />
            </div>
          </div>
        </div>

        {/* 우: 콘텐츠 */}
        <div className="p1-content">
          {/* 런닝 통계 */}
          <div className="section-head">
            <span className="text-sm fw-bold">런닝 통계</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">누적 거리</span>
            <span className="info-row__value">0 km</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">총 횟수</span>
            <span className="info-row__value">0 회</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">최장 연속</span>
            <span className="info-row__value">0 일</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">PB</span>
            <span className="info-row__value">— km</span>
          </div>

          {/* 칭호 */}
          <div className="section-head">
            <span className="text-sm fw-bold">칭호</span>
            <span className="text-xs text-muted">0개</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">기록 없음</span>
          </div>
        </div>
      </div>
    </div>
  );
}
