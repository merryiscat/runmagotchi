/**
 * 대시보드 (M1)
 *
 * profiles(계정) + characters(활성 캐릭터) + character_images(도트/일러스트) 조회.
 * 코인 잔액은 GNB 상점 링크 옆에 표시.
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RetryCharacter from '@/components/RetryCharacter';
import IllustButton from '@/components/IllustButton';
import BouncingCharacter from '@/components/BouncingCharacter';
import ZoomableStage from '@/components/ZoomableStage';
import InventoryBar from '@/components/InventoryBar';

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

  // 활성 캐릭터 조회 (가장 최근 것 1개)
  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  const character = characters?.[0] ?? null;
  if (!character) redirect('/egg-select');

  // 런닝 기록 조회
  const { data: runs } = await supabase
    .from('runs')
    .select('distance_km, duration_minutes, pace, run_date, tokens_earned')
    .eq('character_id', character.id)
    .order('run_date', { ascending: false });

  const totalKm = runs?.reduce((sum, r) => sum + Number(r.distance_km), 0) || 0;
  const totalRuns = runs?.length || 0;
  const coins = character.tokens || 0;

  // 도트 idle 이미지
  const { data: pixelImg } = await supabase
    .from('character_images')
    .select('url')
    .eq('character_id', character.id)
    .eq('type', 'pixel_idle')
    .single();

  // 일러스트 이미지
  const { data: illustImg } = await supabase
    .from('character_images')
    .select('url')
    .eq('character_id', character.id)
    .eq('type', 'illust')
    .eq('stage', 'baby')
    .single();

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>

      {/* GNB */}
      <div className="gnb">
        <a href="/dashboard" className="gnb__logo">
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 28 }} />
        </a>
        <nav className="gnb__nav" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          {/* 코인 (클릭 불가, 표시만) */}
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink-default)' }}>
            🪙 {coins}
          </span>
          {/* 구분선 */}
          <span style={{ width: 1, height: 14, background: 'var(--line-soft)' }} />
          <a href="/shop">상점</a>
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

        {/* Stage 영역 — 줌: 웹 휠, 모바일 핀치 */}
        <div className="stage" style={{ overflow: 'hidden', touchAction: 'none', background: 'transparent' }}>
          {/* 일러스트 보기 버튼 — 부화 후에만 표시 (알 상태는 스포일러) */}
          {character.hatched && illustImg?.url && <IllustButton url={illustImg.url} />}

          {/* 스테이지 콘텐츠: 줌/패닝 가능 (알 + 캐릭터 모두 포함) */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <ZoomableStage>
              {character.hatched && pixelImg?.url ? (
                <BouncingCharacter characterId={character.id} idleUrl={pixelImg.url} />
              ) : character.egg_image_url ? (
                <div style={{ width: 220, maxWidth: '70%' }}>
                  <img src={character.egg_image_url} alt="알"
                    style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
                  {character.image_status === 'failed' && <RetryCharacter characterId={character.id} />}
                </div>
              ) : (
                character.image_status === 'failed'
                  ? <RetryCharacter characterId={character.id} />
                  : null
              )}
            </ZoomableStage>
          </div>

          {/* 스테이지 하단: 이름 + 인벤토리 아이템 사용 */}
          <div className="stage__footer" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            {character.hatched && character.name && (
              <div>
                <div className="fw-bold text-sm">{character.name}</div>
                <div className="text-xs text-muted">{character.gender}</div>
              </div>
            )}
            <InventoryBar
              characterId={character.id}
              initialInventory={character.inventory || {}}
              initialExp={character.total_exp || 0}
              initialLevel={character.level || 0}
              hatched={!!character.hatched}
            />
          </div>
        </div>

        {/* Panel */}
        <div className="panel">

          {/* 런닝 스탯 */}
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

          {/* 업로드 버튼 */}
          <div className="panel__section">
            <a className="btn btn--primary btn--full btn--lg" href="/upload">기록 업로드</a>
          </div>

          {/* 최근 기록 */}
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
                    <div className="text-xs text-muted">
                      {r.pace || ''} {r.duration_minutes}분
                      {r.tokens_earned ? ` · 🪙${r.tokens_earned}` : ''}
                    </div>
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
