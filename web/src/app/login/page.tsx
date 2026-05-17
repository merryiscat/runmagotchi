/**
 * 로그인 / 회원가입 페이지 (O1 기획 기반)
 *
 * 기획안: frame--web 풀스크린, 센터 정렬, max-width 420px 콘텐츠.
 * 로고 크게 + 이메일/비밀번호 + 소셜 로그인.
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  /** 소셜 로그인 */
  async function handleSocialLogin(provider: 'google' | 'kakao') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMessage(`${provider} 로그인 실패: ${error.message}`);
  }

  /** 이메일 로그인/가입 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setMessage(`가입 실패: ${error.message}`);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 이미 프로필이 있으면 중복 가입
          const { data: existing } = await supabase
            .from('profiles').select('id').eq('id', user.id).single();
          if (existing) {
            setMessage('이미 가입된 이메일입니다');
            setLoading(false);
            return;
          }
          window.location.href = '/onboarding';
          setLoading(false);
          return;
        }
        setMessage('확인 메일 발송 완료');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(`로그인 실패: ${error.message}`);
      } else if (data?.user) {
        // 프로필 존재 여부로 기존 가입자인지 확인
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          // 기존 가입자 → 대시보드
          window.location.href = '/dashboard';
        } else {
          // 신규 (프로필 미생성) → 온보딩
          window.location.href = '/onboarding';
        }
      }
    }
    setLoading(false);
  }

  return (
    /* O1 기획: frame--web 풀스크린, 세로 센터 정렬 */
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper"
         style={{ border: '1px solid var(--line-strong)' }}>
      <div style={{ maxWidth: 420, width: '100%', padding: 'var(--s-5)', textAlign: 'center' }}>

        {/* 로고 — O1 기획: 큰 워드마크 */}
        <div style={{ marginBottom: 'var(--s-7)' }}>
          <img src="/logo.png" alt="Runmagotchi" style={{ height: 56, margin: '0 auto' }} />
        </div>

        {/* 이메일/비밀번호 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 'var(--s-3)' }}>
          <input
            type="email" placeholder="이메일" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            style={{
              width: '100%', padding: 'var(--s-3)', border: '1px solid var(--line)',
              background: 'var(--surface)', color: 'var(--ink-strong)',
              fontSize: 'var(--fs-md)', fontFamily: 'inherit',
            }}
          />
          <input
            type="password" placeholder="비밀번호" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6}
            style={{
              width: '100%', padding: 'var(--s-3)', border: '1px solid var(--line)',
              background: 'var(--surface)', color: 'var(--ink-strong)',
              fontSize: 'var(--fs-md)', fontFamily: 'inherit',
            }}
          />
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 'var(--s-3) var(--s-4)',
            background: 'var(--jeok)', color: 'var(--on-jeok)',
            border: '1px solid var(--jeok)', fontSize: 'var(--fs-md)',
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1, fontFamily: 'inherit',
          }}>
            {loading ? '처리 중...' : isSignUp ? '가입' : '로그인'}
          </button>
        </form>

        {/* 메시지 */}
        {message && (
          <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)' }}>{message}</p>
        )}

        {/* 구분선 */}
        <div className="flex items-center" style={{ gap: 'var(--s-3)', margin: 'var(--s-5) 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)' }}>또는</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line-soft)' }} />
        </div>

        {/* 소셜 로그인 — O1 기획: btn--social 스타일 */}
        <div className="flex flex-col" style={{ gap: 'var(--s-3)' }}>
          <button onClick={() => handleSocialLogin('google')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-3)',
            width: '100%', padding: 'var(--s-3) var(--s-4)',
            border: '1px solid var(--line)', background: 'var(--surface)',
            fontSize: 'var(--fs-md)', color: 'var(--ink-default)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 시작하기
          </button>
          <button onClick={() => handleSocialLogin('kakao')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--s-3)',
            width: '100%', padding: 'var(--s-3) var(--s-4)',
            border: '1px solid var(--line)', background: 'var(--surface)',
            fontSize: 'var(--fs-md)', color: 'var(--ink-default)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 3C6.48 3 2 6.36 2 10.44c0 2.66 1.76 4.99 4.4 6.32-.19.72-.7 2.6-.8 3-.12.48.18.47.37.34.15-.1 2.4-1.63 3.36-2.29.88.13 1.78.19 2.67.19 5.52 0 10-3.36 10-7.56S17.52 3 12 3z" fill="#3C1E1E"/>
            </svg>
            카카오로 시작하기
          </button>
        </div>

        {/* 모드 전환 */}
        <button onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }}
          style={{
            marginTop: 'var(--s-5)', fontSize: 'var(--fs-sm)', color: 'var(--ink-muted)',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {isSignUp ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 가입'}
        </button>

        {/* 약관 */}
        <div style={{ marginTop: 'var(--s-5)', fontSize: 'var(--fs-xs)', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
          시작하면 <u>이용약관</u> 및 <u>개인정보 처리방침</u>에 동의하게 됩니다.
        </div>

        {/* 하단 안내 */}
        <div style={{
          marginTop: 'var(--s-7)', fontSize: 'var(--fs-xs)', color: 'var(--ink-faint)',
          lineHeight: 1.6, textAlign: 'center',
        }}>
          <div>© 2026 merryiscat. All rights reserved.</div>
          <div style={{ marginTop: 'var(--s-1)' }}>Made by merryiscat</div>
        </div>
      </div>
    </div>
  );
}
