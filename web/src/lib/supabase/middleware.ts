/**
 * 미들웨어 전용 Supabase 클라이언트
 *
 * Next.js 미들웨어(middleware.ts)에서 세션을 확인하고 갱신할 때 사용한다.
 * 미들웨어는 모든 요청마다 실행되므로, 여기서 만료된 토큰을 자동 갱신한다.
 *
 * 일반 서버 클라이언트(server.ts)와 다른 점:
 * - request/response 객체에서 직접 쿠키를 읽고 쓴다.
 * - Next.js의 cookies()가 아닌 request.cookies를 사용한다.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 미들웨어에서 Supabase 세션을 확인하고 갱신한다.
 *
 * @param request - Next.js 미들웨어가 받는 요청 객체
 * @returns { supabase, response } - Supabase 클라이언트와 응답 객체
 */
export async function updateSession(request: NextRequest) {
  // 기본 응답 객체 생성 (나중에 쿠키를 붙여서 반환)
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * 요청에서 쿠키 읽기
         */
        getAll() {
          return request.cookies.getAll();
        },

        /**
         * 응답에 쿠키 쓰기
         * 요청과 응답 모두에 쿠키를 설정해야 한다:
         * - request: 이후 서버 코드에서 갱신된 세션을 읽을 수 있도록
         * - response: 브라우저에 갱신된 쿠키가 전달되도록
         */
        setAll(cookiesToSet) {
          // 요청 쿠키에 설정 (서버 코드용)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          // 응답 재생성 (갱신된 요청 쿠키 포함)
          response = NextResponse.next({ request });

          // 응답 쿠키에 설정 (브라우저 전달용)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 확인 + 만료된 토큰 자동 갱신
  // getUser()가 내부적으로 토큰 갱신을 처리한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, response, user };
}
