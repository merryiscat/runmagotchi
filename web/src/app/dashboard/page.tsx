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
import type { Mood } from '@/components/BouncingCharacter';
import ZoomableStage from '@/components/ZoomableStage';
import StageWithFeeding from '@/components/StageWithFeeding';

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

  // ── 배고픔/애정 시간 감소 계산 ──
  // stats_updated_at 이후 경과 시간(시간 단위) × 4 만큼 감소
  const statsUpdatedAt = character.stats_updated_at
    ? new Date(character.stats_updated_at)
    : new Date();
  const hoursElapsed = Math.floor((Date.now() - statsUpdatedAt.getTime()) / (1000 * 60 * 60));
  const decay = hoursElapsed * 4; // 시간당 4 감소

  const currentHunger = Math.max(0, (character.hunger ?? 100) - decay);
  const currentAffection = Math.max(0, (character.affection ?? 100) - decay);

  // 감소가 있었으면 DB 업데이트 (다음 접속 기준점 갱신)
  if (decay > 0) {
    await supabase
      .from('characters')
      .update({
        hunger: currentHunger,
        affection: currentAffection,
        stats_updated_at: new Date().toISOString(),
      })
      .eq('id', character.id);
  }

  // 기분(mood) 결정: 배고픔/애정 기반
  const mood: Mood =
    (currentHunger >= 50 && currentAffection >= 50) ? 'happy' :
    (currentHunger < 20 || currentAffection < 20) ? 'sad' : 'neutral';

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
          {/* 코인 (클릭 불가, 표시만) — 손글씨 폰트 */}
          <span style={{
            fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink-default)',
            fontFamily: 'var(--font-handwriting)',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--hwang)', color: 'var(--on-hwang)',
              fontSize: 9, fontWeight: 900, fontFamily: 'serif', lineHeight: 1,
            }}>₩</span>{' '}{coins}
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
              {!character.hatched && character.egg_image_url ? (
                <div style={{ width: 220, maxWidth: '70%' }}>
                  <img src={character.egg_image_url} alt="알"
                    style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
                  {character.image_status === 'failed' && <RetryCharacter characterId={character.id} />}
                </div>
              ) : !character.hatched && character.image_status === 'failed' ? (
                <RetryCharacter characterId={character.id} />
              ) : null}
            </ZoomableStage>
          </div>

          {/* 캐릭터 + 먹이주기 통합 (클라이언트 컴포넌트) */}
          <StageWithFeeding
            characterId={character.id}
            idleUrl={pixelImg?.url}
            mood={mood}
            inventory={character.inventory || {}}
            exp={character.total_exp || 0}
            level={character.level || 0}
            hunger={currentHunger}
            affection={currentAffection}
            hatched={!!character.hatched}
          />

          {/* 스테이지 하단: 이름 */}
          <div className="stage__footer" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
            {character.hatched && character.name && (
              <div>
                <div className="fw-bold text-sm" style={{ fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)' }}>{character.name}</div>
                <div className="text-xs text-muted">{character.gender}</div>
              </div>
            )}
          </div>
        </div>

        {/* Panel — 손글씨 폰트 적용 */}
        <div className="panel" style={{ fontFamily: 'var(--font-handwriting)' }}>

          {/* 런닝 스탯 */}
          <div className="panel__section">
            <div className="row row--between mb-4">
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-penscript)', fontSize: 18 }}>런닝 스탯</span>
              <select className="period-select" style={{ fontFamily: 'var(--font-handwriting)' }}>
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
            <a className="btn btn--primary btn--full btn--lg" href="/upload"
              style={{ fontFamily: 'var(--font-penscript)', fontSize: 'var(--fs-lg)' }}>
              기록 업로드
            </a>
          </div>

          {/* 최근 기록 */}
          <div className="panel__section" style={{ flex: 1 }}>
            <div className="row row--between mb-3">
              <span style={{ fontFamily: 'var(--font-penscript)', fontSize: 18, fontWeight: 700 }}>최근 기록</span>
              <span className="text-xs text-muted" style={{ cursor: 'pointer' }}>전체 보기</span>
            </div>
            {runs && runs.length > 0 ? (
              runs.slice(0, 3).map((r, i) => (
                <div key={i} className="run-row">
                  <div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{Number(r.distance_km).toFixed(1)} km</div>
                    <div className="text-xs text-muted">
                      {r.pace || ''} {r.duration_minutes}분
                      {r.tokens_earned ? (
                        <>
                          {' · '}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 12, height: 12, borderRadius: '50%',
                            background: 'var(--hwang)', color: 'var(--on-hwang)',
                            fontSize: 7, fontWeight: 900, fontFamily: 'serif', lineHeight: 1,
                            verticalAlign: 'middle',
                          }}>₩</span>
                          {r.tokens_earned}
                        </>
                      ) : ''}
                    </div>
                  </div>
                  <div className="text-xs text-muted">{r.run_date}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: 'var(--s-3) 0', fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)' }}>기록 없음</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
