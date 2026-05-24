/**
 * 개발 도구 (/dev)
 *
 * 테스트 전용 페이지. 운영 환경에서는 접근 제한 필요.
 *
 * 기능:
 *   - 캐릭터 스탯 조회 (EXP/레벨/배고픔/애정)
 *   - EXP 직접 추가 (진화 테스트)
 *   - 스탯 직접 수정 (배고픔/애정)
 *   - 생성된 이미지 목록 확인
 *   - 강제 진화 트리거
 *   - 캐릭터 이미지 재생성
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { expToLevel, levelToStage, stageLabel, LEVEL_THRESHOLDS } from '@/lib/behavior';

interface CharImage {
  type: string;
  stage: string;
  url: string;
}

export default function DevPage() {
  const [userId, setUserId] = useState('');
  const [character, setCharacter] = useState<any>(null);
  const [images, setImages] = useState<CharImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  /* 수정용 입력 */
  const [addExp, setAddExp] = useState('100');
  const [setHunger, setSetHunger] = useState('');
  const [setAffection, setSetAffection] = useState('');

  const supabase = createClient();

  /* ── 데이터 로드 ── */
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    /* 활성 캐릭터 */
    const { data: chars } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const char = chars?.[0];
    if (!char) { setLoading(false); return; }
    setCharacter(char);
    setSetHunger(String(char.hunger ?? 100));
    setSetAffection(String(char.affection ?? 100));

    /* 이미지 목록 */
    const { data: imgs } = await supabase
      .from('character_images')
      .select('type, stage, url')
      .eq('character_id', char.id)
      .order('type');

    setImages(imgs || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── EXP 추가 ── */
  async function handleAddExp() {
    if (!character) return;
    const amount = parseInt(addExp) || 0;
    if (amount <= 0) return;

    const newExp = (character.total_exp || 0) + amount;
    const newLevel = expToLevel(newExp);
    const newStage = levelToStage(newLevel);

    await supabase.from('characters').update({
      total_exp: newExp,
      level: newLevel,
      stage: newStage,
    }).eq('id', character.id);

    setMessage(`+${amount} EXP → Lv.${newLevel} (${stageLabel(newStage)})`);
    loadData();
  }

  /* ── 스탯 수정 ── */
  async function handleSetStats() {
    if (!character) return;

    await supabase.from('characters').update({
      hunger: parseInt(setHunger) || 0,
      affection: parseInt(setAffection) || 0,
      stats_updated_at: new Date().toISOString(),
    }).eq('id', character.id);

    setMessage('스탯 업데이트 완료');
    loadData();
  }

  /* ── 강제 진화 (다음 단계로) ── */
  async function handleEvolve() {
    if (!character) return;
    const currentStage = character.stage;
    const stages = ['egg', 'baby', 'child', 'teen', 'adult', 'final'];
    const idx = stages.indexOf(currentStage);
    if (idx >= stages.length - 1) { setMessage('이미 완전체'); return; }

    const nextStage = stages[idx + 1];
    /* 해당 단계 시작 레벨의 EXP로 설정 */
    const stageStartLevels: Record<string, number> = { baby: 0, child: 10, teen: 20, adult: 30, final: 40 };
    const targetLevel = stageStartLevels[nextStage] || 0;
    const targetExp = LEVEL_THRESHOLDS[targetLevel] || 0;

    await supabase.from('characters').update({
      stage: nextStage,
      level: targetLevel,
      total_exp: targetExp,
    }).eq('id', character.id);

    setMessage(`강제 진화: ${stageLabel(currentStage)} → ${stageLabel(nextStage)} (Lv.${targetLevel})`);
    loadData();
  }

  /* ── 이미지 재생성 트리거 ── */
  async function handleRegenImages() {
    if (!character) return;
    setMessage('이미지 재생성 요청 중...');

    const { data: profile } = await supabase
      .from('profiles')
      .select('saju_reading')
      .eq('id', userId)
      .single();

    const reading = profile?.saju_reading;

    await fetch('/api/generate-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        combo: character.combo || [],
        colors: character.palette || [],
        traits: reading?.traits || [],
        personality: reading?.personality || '',
        userId,
        characterId: character.id,
      }),
    });

    setMessage('이미지 재생성 시작됨 (백그라운드)');
  }

  /* ── 터치 수 직접 설정 (알 부화 테스트) ── */
  async function handleSetTouches(count: number) {
    if (!character) return;
    const affection = Math.floor(count / 100);

    await supabase.from('characters').update({
      egg_touches: count,
      affection: Math.min(100, affection),
    }).eq('id', character.id);

    setMessage(`터치 ${count}회 설정 (애정 ${affection})`);
    loadData();
  }

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'monospace' }}>로딩 중...</div>;
  }

  if (!character) {
    return <div style={{ padding: 40, fontFamily: 'monospace' }}>활성 캐릭터 없음</div>;
  }

  const level = character.level || 0;
  const exp = character.total_exp || 0;
  const nextLevelExp = LEVEL_THRESHOLDS[level + 1] || exp;
  const currentLevelExp = LEVEL_THRESHOLDS[level] || 0;
  const expInLevel = exp - currentLevelExp;
  const expNeeded = nextLevelExp - currentLevelExp;

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 14, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>DEV TOOLS</h1>
      <a href="/dashboard" style={{ color: 'blue', marginBottom: 20, display: 'block' }}>← 대시보드</a>

      {/* 메시지 */}
      {message && (
        <div style={{
          padding: '8px 12px', background: '#e8f5e9', border: '1px solid #4caf50',
          marginBottom: 16, fontSize: 13,
        }}>
          {message}
        </div>
      )}

      {/* ── 캐릭터 정보 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ border: '1px solid #ccc', padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>캐릭터 정보</h3>
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td>이름</td><td><b>{character.name || '???'}</b></td></tr>
              <tr><td>성별</td><td>{character.gender}</td></tr>
              <tr><td>단계</td><td><b>{stageLabel(character.stage)}</b> ({character.stage})</td></tr>
              <tr><td>레벨</td><td><b>Lv.{level}</b></td></tr>
              <tr><td>EXP</td><td>{exp} / {nextLevelExp} ({expInLevel}/{expNeeded})</td></tr>
              <tr><td>부화</td><td>{character.hatched ? '완료' : `미완 (터치 ${character.egg_touches || 0})`}</td></tr>
              <tr><td>배고픔</td><td>{character.hunger ?? '?'} / 100</td></tr>
              <tr><td>애정</td><td>{character.affection ?? '?'} / 100</td></tr>
              <tr><td>코인</td><td>{character.tokens || 0}</td></tr>
              <tr><td>이미지</td><td>{character.image_status}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── 조작 패널 ── */}
        <div style={{ border: '1px solid #ccc', padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>조작</h3>

          {/* EXP 추가 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#666' }}>EXP 추가</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="number" value={addExp} onChange={e => setAddExp(e.target.value)}
                style={{ width: 80, padding: 4, border: '1px solid #ccc' }} />
              <button onClick={handleAddExp}
                style={{ padding: '4px 12px', background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer' }}>
                추가
              </button>
              {[50, 200, 500, 1000].map(v => (
                <button key={v} onClick={() => { setAddExp(String(v)); }}
                  style={{ padding: '4px 8px', border: '1px solid #ccc', cursor: 'pointer', fontSize: 12 }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 스탯 수정 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#666' }}>배고픔 / 애정</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="number" value={setHunger} onChange={e => setSetHunger(e.target.value)}
                style={{ width: 60, padding: 4, border: '1px solid #ccc' }} placeholder="배고픔" />
              <input type="number" value={setAffection} onChange={e => setSetAffection(e.target.value)}
                style={{ width: 60, padding: 4, border: '1px solid #ccc' }} placeholder="애정" />
              <button onClick={handleSetStats}
                style={{ padding: '4px 12px', background: '#388e3c', color: '#fff', border: 'none', cursor: 'pointer' }}>
                적용
              </button>
            </div>
          </div>

          {/* 강제 진화 */}
          <div style={{ marginBottom: 12 }}>
            <button onClick={handleEvolve}
              style={{ padding: '6px 16px', background: '#f57c00', color: '#fff', border: 'none', cursor: 'pointer' }}>
              강제 진화 (다음 단계)
            </button>
          </div>

          {/* 이미지 재생성 */}
          <div style={{ marginBottom: 12 }}>
            <button onClick={handleRegenImages}
              style={{ padding: '6px 16px', background: '#7b1fa2', color: '#fff', border: 'none', cursor: 'pointer' }}>
              이미지 재생성
            </button>
          </div>

          {/* 알 터치 설정 */}
          {!character.hatched && (
            <div>
              <label style={{ fontSize: 12, color: '#666' }}>알 터치 설정</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1000, 3000, 5000, 9000, 9999].map(v => (
                  <button key={v} onClick={() => handleSetTouches(v)}
                    style={{ padding: '4px 8px', border: '1px solid #ccc', cursor: 'pointer', fontSize: 12 }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 생성된 이미지 목록 ── */}
      <div style={{ border: '1px solid #ccc', padding: 16 }}>
        <h3 style={{ marginBottom: 12 }}>생성된 이미지 ({images.length}장)</h3>

        {images.length === 0 ? (
          <div style={{ color: '#999' }}>이미지 없음</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {images.map((img, i) => (
              <div key={i} style={{ border: '1px solid #eee', padding: 8, textAlign: 'center' }}>
                <img src={img.url} alt={img.type}
                  style={{
                    width: '100%', height: 100, objectFit: 'contain',
                    background: '#f5f5f5',
                    imageRendering: img.type.startsWith('pixel') ? 'pixelated' as const : 'auto',
                  }} />
                <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                  {img.type}
                </div>
                <div style={{ fontSize: 10, color: '#999' }}>
                  {img.stage}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── EXP 테이블 ── */}
      <div style={{ border: '1px solid #ccc', padding: 16, marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>레벨 테이블</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, fontSize: 11 }}>
          {LEVEL_THRESHOLDS.map((threshold, lv) => (
            <div key={lv} style={{
              padding: '2px 6px',
              background: lv === level ? '#ffeb3b' : lv < level ? '#e8f5e9' : '#fff',
              border: '1px solid #ddd',
            }}>
              Lv.{lv}: {threshold} ({stageLabel(levelToStage(lv))})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
