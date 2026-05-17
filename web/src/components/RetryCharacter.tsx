/**
 * 캐릭터 이미지 재생성 버튼
 *
 * 클릭 → 생성 요청 → 버튼 비활성화 → 폴링으로 완료 감지 → 자동 새로고침
 */

'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RetryCharacterProps {
  characterId: string;
}

export default function RetryCharacter({ characterId }: RetryCharacterProps) {
  const [status, setStatus] = useState<'idle' | 'requested' | 'done'>('idle');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  async function handleRetry() {
    setStatus('requested');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus('idle'); return; }

    const { data: char } = await supabase
      .from('characters').select('combo, palette').eq('id', characterId).single();
    const { data: profile } = await supabase
      .from('profiles').select('saju_reading').eq('id', user.id).single();

    if (!char) { setStatus('idle'); return; }

    // 상태를 pending으로 되돌리기
    await supabase.from('characters').update({ image_status: 'pending' }).eq('id', characterId);

    // fire-and-forget 요청
    fetch('/api/generate-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        combo: char.combo,
        colors: char.palette,
        traits: profile?.saju_reading?.traits || [],
        personality: profile?.saju_reading?.personality || '',
        userId: user.id,
        characterId,
      }),
    });

    // 5초마다 폴링 — pixel_idle 이미지가 생기면 새로고침
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('character_images')
        .select('id')
        .eq('character_id', characterId)
        .eq('type', 'pixel_idle')
        .single();

      if (data) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatus('done');
        window.location.reload();
      }
    }, 5000);
  }

  if (status === 'requested') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="text-sm text-muted">캐릭터 생성 중...</div>
        <div className="text-xs text-muted" style={{ marginTop: 'var(--s-1)' }}>
          완료되면 자동으로 새로고침됩니다
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="text-sm text-muted" style={{ marginBottom: 'var(--s-2)' }}>
        캐릭터 이미지 생성 중
      </div>
      <button
        onClick={handleRetry}
        style={{
          padding: 'var(--s-2) var(--s-4)',
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          fontSize: 'var(--fs-xs)',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        재시도
      </button>
    </div>
  );
}
