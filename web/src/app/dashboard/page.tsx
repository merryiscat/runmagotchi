/**
 * 대시보드 (M1)
 *
 * profiles(계정) + characters(활성 캐릭터) + character_images(도트/일러스트) 조회
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RetryCharacter from '@/components/RetryCharacter';
import IllustButton from '@/components/IllustButton';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .single();
  if (!profile) redirect('/onboarding');

  // 활성 캐릭터 조회
  const { data: character } = await supabase
    .from('characters')
    .select('id, name, gender, stage, egg_image_url, hatched, image_status')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!character) redirect('/egg-select');

  // 런닝 기록 조회 → 누적 거리/횟수 계산
  const { data: runs } = await supabase
    .from('runs')
    .select('distance_km, duration_minutes, pace, run_date')
    .eq('character_id', character.id)
    .order('run_date', { ascending: false });

  const totalKm = runs?.reduce((sum, r) => sum + Number(r.distance_km), 0) || 0;
  const totalRuns = runs?.length || 0;

  // 부화 조건 체크: 10km 이상인데 아직 부화 안 했으면 부화 페이지로
  if (totalKm >= 10 && !character.hatched) {
    redirect('/hatching');
  }

  // 도트 idle 이미지
  const { data: pixelImg } = character ? await supabase
    .from('character_images')
    .select('url')
    .eq('character_id', character.id)
    .eq('type', 'pixel_idle')
    .single() : { data: null };

  // 일러스트 이미지
  const { data: illustImg } = character ? await supabase
    .from('character_images')
    .select('url')
    .eq('character_id', character.id)
    .eq('type', 'illust')
    .eq('stage', 'baby')
    .single() : { data: null };

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>

      {/* GNB */}
      <div className="gnb">
        <a href="/dashboard" className="gnb__logo">
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 28 }} />
        </a>
        <nav className="gnb__nav">
          <a href="/profile">프로필</a>
          <form action="/auth/signout" method="post" style={{ display: 'inline' }}>
            <button type="submit" style={{
              color: 'var(--ink-faint)', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
            }}>로그아웃</button>
          </form>
        </nav>
      </div>

      {/* m1-layout */}
      <div className="m1-layout" style={{ flex: 1 }}>

        {/* Stage */}
        <div className="stage">
          {/* 일러스트 보기 버튼 */}
          {illustImg?.url && <IllustButton url={illustImg.url} />}

          {/* 스테이지 중앙 */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '48px var(--s-5)',
          }}>
            <div style={{ width: 220, maxWidth: '70%' }}>
              {character.hatched && pixelImg?.url ? (
                /* 부화 완료 → 도트 캐릭터 */
                <img src={pixelImg.url} alt="캐릭터"
                  style={{ width: '100%', objectFit: 'contain', display: 'block', imageRendering: 'pixelated' }} />
              ) : character.egg_image_url ? (
                /* 부화 전 → 알 이미지 */
                <div>
                  <img src={character.egg_image_url} alt="알"
                    style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
                  {character.image_status === 'failed' && <RetryCharacter characterId={character.id} />}
                </div>
              ) : (
                character.image_status === 'failed'
                  ? <RetryCharacter characterId={character.id} />
                  : null
              )}
            </div>
          </div>

          {/* 풋터 */}
          <div className="stage__footer">
            {character.hatched && character.name ? (
              <div>
                <div className="fw-bold text-sm">{character.name}</div>
                <div className="text-xs text-muted">{character.gender}</div>
              </div>
            ) : (
              <div className="text-xs text-muted">부화 전</div>
            )}
          </div>
        </div>

        {/* Panel */}
        <div className="panel">
          <div className="panel__section">
            <div className="row row--between mb-4">
              <span className="text-sm fw-bold">런닝 스탯</span>
              <select className="period-select">
                <option>이번 달</option><option>지난 달</option><option>전체</option>
              </select>
            </div>
            <div className="stats-row">
              <div><div className="stat-v">{totalKm.toFixed(1)}</div><div className="stat-l">km</div></div>
              <div><div className="stat-v">{totalRuns}</div><div className="stat-l">회</div></div>
              <div><div className="stat-v">0</div><div className="stat-l">일 연속</div></div>
            </div>
          </div>

          <div className="panel__section">
            <a className="btn btn--primary btn--full btn--lg" href="/upload">업로드</a>
          </div>

          <div className="panel__section" style={{ flex: 1 }}>
            <div className="row row--between mb-3">
              <span className="text-sm fw-bold">최근 기록</span>
              <span className="text-xs text-muted" style={{ cursor: 'pointer' }}>전체 보기</span>
            </div>
            {runs && runs.length > 0 ? (
              runs.slice(0, 3).map((r, i) => (
                <div key={i} className="run-row">
                  <div>
                    <div className="text-sm fw-bold">{Number(r.distance_km).toFixed(1)} km</div>
                    <div className="text-xs text-muted">{r.pace || ''} {r.duration_minutes}분</div>
                  </div>
                  <div className="text-xs text-muted">{r.run_date}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted" style={{ padding: 'var(--s-3) 0' }}>기록 없음</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
