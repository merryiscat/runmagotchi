/**
 * 알 선택 페이지
 *
 * 알 선택 → characters 테이블에 캐릭터 생성 → 백그라운드 이미지 생성 → 대시보드
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import EggCarousel from '@/components/EggCarousel';

interface EggChoice {
  url: string;
  combo: string[];
  pattern: string;
  colors: string[];
}

export default function EggSelectPage() {
  const [eggs, setEggs] = useState<EggChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('egg_choices').eq('id', user.id).single();
      if (!profile?.egg_choices || profile.egg_choices.length === 0) {
        router.push('/onboarding'); return;
      }
      setEggs(profile.egg_choices);
      setLoading(false);
    }
    load();
  }, []);

  async function handleConfirm() {
    if (selected === null) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('로그인 필요'); setSaving(false); return; }

    const chosen = eggs[selected];

    /* 기존 활성 캐릭터 비활성화 (중복 방지) */
    await supabase
      .from('characters')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    /* 성별 50% 랜덤 */
    const gender = Math.random() < 0.5 ? '수컷' : '암컷';

    /* ── characters 테이블에 새 캐릭터 생성 ── */
    const { data: newChar, error: charErr } = await supabase
      .from('characters')
      .insert({
        user_id: user.id,
        gender,
        stage: 'egg',
        combo: chosen.combo,
        palette: chosen.colors,
        pattern: chosen.pattern,
        egg_image_url: chosen.url,
        is_active: true,
      })
      .select('id')
      .single();

    if (charErr || !newChar) {
      setMessage(`캐릭터 생성 실패: ${charErr?.message}`);
      setSaving(false);
      return;
    }

    /* ── 백그라운드 캐릭터 이미지 생성 (fire-and-forget) ── */
    const { data: profileData } = await supabase
      .from('profiles').select('saju_reading').eq('id', user.id).single();
    const reading = profileData?.saju_reading;

    fetch('/api/generate-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        combo: chosen.combo,
        colors: chosen.colors,
        traits: reading?.traits || [],
        personality: reading?.personality || '',
        userId: user.id,
        characterId: newChar.id,
      }),
    }); // fire-and-forget

    window.location.href = '/dashboard';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p style={{ fontSize: 'var(--fs-md)', color: 'var(--ink-muted)' }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper"
         style={{ border: '1px solid var(--line-strong)' }}>
      <div style={{ width: '100%', maxWidth: 1200, padding: 'var(--s-5)' }}>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '85vh',
        }}>
          {eggs.length > 0 ? (
            <>
              <EggCarousel
                images={eggs.map(e => e.url)}
                onSelect={(idx) => setSelected(idx)}
                selectedIndex={selected}
              />
              <button onClick={handleConfirm} disabled={selected === null || saving}
                style={{
                  marginTop: 'var(--s-6)', minWidth: 200,
                  padding: 'var(--s-4) var(--s-5)',
                  background: 'var(--ink-strong)', color: 'var(--surface)',
                  border: '1px solid var(--ink-strong)',
                  fontSize: 'var(--fs-lg)', fontWeight: 700, fontFamily: 'inherit',
                  cursor: (selected === null || saving) ? 'not-allowed' : 'pointer',
                  opacity: (selected === null || saving) ? 0.5 : 1,
                }}>
                {saving ? '저장 중...' : '선택'}
              </button>
            </>
          ) : (
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--ink-muted)' }}>준비 중...</p>
          )}
          {message && (
            <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-sm)', color: 'var(--jeok)' }}>{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
