/**
 * 부화 페이지 (E1 기획)
 *
 * 누적 10km 달성 → 알 깨짐 연출 → 캐릭터 등장 → 이름 짓기 팝업
 * 이름 확정 → characters 테이블 업데이트 (name, hatched, stage) → 대시보드
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function HatchingPage() {
  const [phase, setPhase] = useState<'egg' | 'cracking' | 'hatched' | 'naming'>('egg');
  const [characterName, setCharacterName] = useState('');
  const [gender, setGender] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [eggUrl, setEggUrl] = useState('');
  const [pixelUrl, setPixelUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }

      const { data: char } = await supabase
        .from('characters')
        .select('id, gender, hatched, egg_image_url')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!char) { window.location.href = '/dashboard'; return; }

      // 이미 부화했으면 대시보드로
      if (char.hatched) { window.location.href = '/dashboard'; return; }

      setCharacterId(char.id);
      setGender(char.gender || '');
      setEggUrl(char.egg_image_url || '');

      // 도트 이미지 조회
      const { data: pixel } = await supabase
        .from('character_images')
        .select('url')
        .eq('character_id', char.id)
        .eq('type', 'pixel_idle')
        .single();
      if (pixel) setPixelUrl(pixel.url);

      // 부화 연출 시작
      setTimeout(() => setPhase('cracking'), 1000);
      setTimeout(() => setPhase('hatched'), 3000);
      setTimeout(() => setPhase('naming'), 4000);
    }
    load();
  }, []);

  async function handleNameConfirm() {
    if (characterName.length < 2) { setMessage('2자 이상 입력해주세요'); return; }
    setSaving(true);

    const { error } = await supabase
      .from('characters')
      .update({
        name: characterName,
        hatched: true,
        stage: 'baby',
      })
      .eq('id', characterId);

    if (error) { setMessage(`저장 실패: ${error.message}`); setSaving(false); return; }

    window.location.href = '/dashboard';
  }

  return (
    <div className="frame frame--web" style={{ minHeight: '100vh', maxWidth: 'none' }}>
      <div className="gnb">
        <a href="/dashboard" className="gnb__logo">
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 28 }} />
        </a>
      </div>

      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--clay)', position: 'relative',
      }}>
        <div style={{ textAlign: 'center' }}>

          {/* 알 → 균열 → 캐릭터 등장 */}
          {(phase === 'egg' || phase === 'cracking') && eggUrl && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={eggUrl} alt="알"
                style={{
                  width: 200, objectFit: 'contain',
                  animation: phase === 'cracking' ? 'shake 0.3s infinite' : 'none',
                }} />
              {phase === 'cracking' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--fs-2xl)', color: 'var(--ink-strong)',
                }}>
                  💥
                </div>
              )}
            </div>
          )}

          {(phase === 'hatched' || phase === 'naming') && pixelUrl && (
            <img src={pixelUrl} alt="캐릭터"
              style={{
                width: 200, objectFit: 'contain', imageRendering: 'pixelated',
                animation: 'fadeIn 0.8s ease-out',
              }} />
          )}

          {(phase === 'hatched' || phase === 'naming') && !pixelUrl && eggUrl && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)', marginTop: 'var(--s-4)' }}>
              부화 완료
            </div>
          )}

          {/* 부화 중 텍스트 */}
          {phase === 'cracking' && (
            <div style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
              부화 중...
            </div>
          )}
        </div>

        {/* 이름 짓기 팝업 */}
        {phase === 'naming' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--s-4)', zIndex: 10,
          }}>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--ink-strong)',
              padding: 'var(--s-5)', width: '100%', maxWidth: 320,
              display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
            }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>이름 짓기</div>
              {gender && (
                <div style={{ textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)' }}>
                  {gender}
                </div>
              )}
              <input
                type="text" maxLength={12} placeholder="2~12자"
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                className="input"
              />
              <div className="text-xs text-muted">변경 불가 · 한글·영문·숫자</div>
              <button
                className="btn btn--primary btn--full"
                onClick={handleNameConfirm}
                disabled={characterName.length < 2 || saving}
              >
                {saving ? '저장 중...' : '확정'}
              </button>
              {message && (
                <div className="text-xs" style={{ color: 'var(--jeok)', textAlign: 'center' }}>{message}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 애니메이션 CSS */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(-4px) rotate(-2deg); }
          75% { transform: translateX(4px) rotate(2deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
