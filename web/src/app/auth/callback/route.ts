/**
 * 인증 콜백 라우트
 *
 * 이메일 확인 / Google / Kakao OAuth 완료 후 여기로 돌아옴.
 * 세션 교환 후 프로필·캐릭터 유무에 따라 적절한 페이지로 리다이렉트.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  // Docker 컨테이너 내부에서는 origin이 0.0.0.0:3000이 되므로
  // 환경변수 NEXT_PUBLIC_SITE_URL이 있으면 그걸 우선 사용
  const origin = process.env.NEXT_PUBLIC_SITE_URL || requestOrigin;
  const code = searchParams.get('code');

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 현재 사용자 확인
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // 프로필 존재 여부
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // 캐릭터 존재 여부
  const { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!character) {
    return NextResponse.redirect(`${origin}/egg-select`);
  }

  // 전부 있으면 대시보드
  return NextResponse.redirect(`${origin}/dashboard`);
}
