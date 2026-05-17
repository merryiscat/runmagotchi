/**
 * 브라우저(클라이언트) 전용 Supabase 클라이언트
 *
 * 'use client' 컴포넌트에서 Supabase에 접근할 때 사용한다.
 * 브라우저의 쿠키를 자동으로 읽고 써서 로그인 세션을 유지한다.
 *
 * 사용 예시:
 *   const supabase = createClient();
 *   const { data } = await supabase.auth.getUser();
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저용 Supabase 클라이언트를 생성한다.
 * 환경변수에서 URL과 Key를 읽어온다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
