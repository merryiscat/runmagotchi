/**
 * Next.js 미들웨어
 *
 * 모든 페이지 요청마다 실행된다. 역할:
 * 1. Supabase 세션(로그인 상태)을 확인하고 만료된 토큰을 갱신
 * 2. 비로그인 사용자가 보호 페이지에 접근하면 /login으로 리다이렉트
 * 3. 로그인했지만 생년월일 미입력 사용자를 /onboarding으로 리다이렉트
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * 보호가 필요 없는 공개 경로들.
 * 여기에 포함된 경로는 로그인 없이도 접근 가능하다.
 */
const PUBLIC_PATHS = ['/login', '/auth', '/api'];

export async function middleware(request: NextRequest) {
  // 현재 요청 경로
  const { pathname } = request.nextUrl;

  // 세션 확인 + 토큰 갱신
  const { response, user } = await updateSession(request);

  // ── 공개 경로: 누구나 접근 가능 ──
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return response;
  }

  // ── 비로그인: /login으로 보내기 ──
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── 로그인 됨: 세션 갱신된 응답 반환 ──
  return response;
}

/**
 * 미들웨어가 실행될 경로 패턴.
 * 정적 파일(_next, favicon 등)은 제외한다.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
