/**
 * 로그아웃 라우트
 *
 * POST 요청을 받으면 Supabase 세션을 종료하고 /login으로 리다이렉트한다.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  // Supabase 세션 종료 (쿠키 삭제)
  await supabase.auth.signOut();

  // /login 페이지로 리다이렉트
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
