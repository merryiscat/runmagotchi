/**
 * 프로필 페이지 (P1)
 *
 * 서버 컴포넌트 — 데이터를 서버에서 로드해 즉시 렌더링.
 *
 * 좌 사이드바: 캐릭터/알 이미지 + 이름 + 성별 + 화면 표시 토글
 * 우 콘텐츠: 런닝 통계 (실제 데이터) + 칭호
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GNB from '@/components/GNB';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /* 프로필 조회 */
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname, birth_date')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  /* 활성 캐릭터 조회 */
  const { data: characters } = await supabase
    .from('characters')
    .select('id, name, gender, stage, hatched, egg_image_url, tokens, level, total_exp')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const character = characters?.[0] ?? null;

  /* 캐릭터 도트 이미지 (부화 후) */
  let pixelUrl: string | null = null;
  if (character?.hatched) {
    const { data: pixelImg } = await supabase
      .from('character_images')
      .select('url')
      .eq('character_id', character.id)
      .eq('type', 'pixel_idle')
      .single();
    pixelUrl = pixelImg?.url || null;
  }

  /* 런닝 기록 조회 */
  const { data: runs } = await supabase
    .from('runs')
    .select('distance_km, duration_minutes, pace, run_date')
    .eq('user_id', user.id)
    .order('run_date', { ascending: false });

  /* ── 통계 계산 ── */
  const totalKm = runs?.reduce((sum, r) => sum + Number(r.distance_km), 0) || 0;
  const totalRuns = runs?.length || 0;

  /* PB (최장 거리) */
  const pb = runs?.reduce((max, r) => Math.max(max, Number(r.distance_km)), 0) || 0;

  /* 최장 연속 일수 */
  let maxStreak = 0;
  if (runs && runs.length > 0) {
    const dates = [...new Set(runs.map(r => r.run_date))].sort();
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, streak);
  }

  const coins = character?.tokens || 0;

  /* 캐릭터 표시 이미지: 부화 후 = 도트, 알 상태 = 알 */
  const displayImage = character?.hatched
    ? pixelUrl
    : character?.egg_image_url;

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>

      <GNB active="profile" coins={coins} />

      {/* p1-layout: 사이드바 + 콘텐츠 */}
      <div className="p1-layout" style={{ flex: 1 }}>

        {/* 좌: 사이드바 */}
        <div className="p1-sidebar">
          {/* 캐릭터/알 이미지 */}
          <div className="p1-sidebar__img">
            {displayImage ? (
              <img src={displayImage} alt={character?.name || '알'}
                style={{
                  width: '100%', height: '100%', objectFit: 'contain',
                  imageRendering: character?.hatched ? 'pixelated' as const : 'auto',
                }} />
            ) : (
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)' }}>???</span>
            )}
          </div>

          {/* 이름 + 성별 아이콘 */}
          <div style={{ textAlign: 'center' }}>
            <div className="fw-bold" style={{
              fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {character?.hatched ? character.name : profile.nickname}
              {character?.hatched && character.gender && (
                <span style={{
                  fontSize: 'var(--fs-sm)',
                  color: character.gender === '수컷' ? 'var(--cheong)' : 'var(--jeok)',
                }}>
                  {character.gender === '수컷' ? '♂' : '♀'}
                </span>
              )}
            </div>
            {!character?.hatched && (
              <div className="text-xs text-muted">알 상태</div>
            )}
          </div>

          {/* 닉네임 (캐릭터 이름과 다를 경우) */}
          {character?.hatched && character.name !== profile.nickname && (
            <div className="text-xs text-muted">
              닉네임: {profile.nickname}
            </div>
          )}
        </div>

        {/* 우: 콘텐츠 */}
        <div className="p1-content">
          {/* 런닝 통계 */}
          <div className="section-head">
            <span className="text-sm fw-bold" style={{ fontFamily: 'var(--font-penscript)', fontSize: 18 }}>
              런닝 통계
            </span>
          </div>
          <div className="info-row">
            <span className="info-row__label">누적 거리</span>
            <span className="info-row__value">{totalKm.toFixed(1)} km</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">총 횟수</span>
            <span className="info-row__value">{totalRuns} 회</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">최장 연속</span>
            <span className="info-row__value">{maxStreak} 일</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">PB</span>
            <span className="info-row__value">{pb > 0 ? `${pb.toFixed(1)} km` : '—'}</span>
          </div>

          {/* 전체 기록 */}
          {runs && runs.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 'var(--s-3)' }}>
                <span className="text-sm fw-bold" style={{ fontFamily: 'var(--font-penscript)', fontSize: 18 }}>
                  전체 기록
                </span>
                <span className="text-xs text-muted">{totalRuns}건</span>
              </div>
              {runs.map((r, i) => (
                <div key={i} className="info-row">
                  <span className="info-row__label">{r.run_date}</span>
                  <span className="info-row__value">
                    {Number(r.distance_km).toFixed(1)} km
                    {r.pace && <span className="text-xs text-muted" style={{ marginLeft: 8 }}>{r.pace}/km</span>}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* 칭호 */}
          <div className="section-head" style={{ marginTop: 'var(--s-3)' }}>
            <span className="text-sm fw-bold" style={{ fontFamily: 'var(--font-penscript)', fontSize: 18 }}>
              칭호
            </span>
            <span className="text-xs text-muted">0개</span>
          </div>
          <div className="info-row">
            <span className="info-row__label text-muted">아직 획득한 칭호가 없습니다</span>
          </div>
        </div>
      </div>
    </div>
  );
}
