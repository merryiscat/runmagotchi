/**
 * 서버 전용 Supabase 클라이언트
 *
 * Server Component, Server Action, Route Handler 등
 * 서버 측 코드에서 Supabase에 접근할 때 사용한다.
 *
 * Next.js의 cookies()를 사용해서 세션 쿠키를 읽고 쓴다.
 * 브라우저가 아닌 서버에서 실행되므로 createBrowserClient가 아닌
 * createServerClient를 사용한다.
 *
 * 사용 예시:
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버용 Supabase 클라이언트를 생성한다.
 * Next.js의 cookies()가 비동기이므로 이 함수도 async다.
 */
export async function createClient() {
  // Next.js의 쿠키 저장소 가져오기 (async)
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * 현재 요청의 모든 쿠키를 읽는다.
         * Supabase가 세션 토큰을 확인할 때 호출된다.
         */
        getAll() {
          return cookieStore.getAll();
        },

        /**
         * 쿠키를 설정한다.
         * Supabase가 세션 토큰을 갱신할 때 호출된다.
         *
         * Server Component에서는 쿠키 쓰기가 불가능할 수 있다.
         * 그 경우 에러를 무시한다 (미들웨어에서 처리됨).
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출되면 쿠키 쓰기 불가 — 무시
            // 미들웨어(middleware.ts)에서 세션 갱신을 대신 처리한다.
          }
        },
      },
    },
  );
}
