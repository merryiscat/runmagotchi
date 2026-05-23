/**
 * 공유 스테이지(방) API
 *
 * POST /api/rooms
 *
 * action별 동작:
 *   create  — 방 생성 + 6자리 코드 발급 + 방장 자동 참여
 *   join    — 코드로 방 참여
 *   leave   — 방 나가기
 *   delete  — 방 삭제 (방장만)
 *   set-goal — 팀 km 목표 설정 (방장만)
 *   members — 방 멤버 + 캐릭터 정보 조회
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/* service_role로 RLS 우회 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/* ─── 6자리 코드 생성 ─── */

/**
 * 영대문자 + 숫자 조합 6자리 초대 코드.
 * 혼동 문자(0/O, 1/I/L) 제외.
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ─── 메인 핸들러 ─── */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create':  return handleCreate(body);
      case 'join':    return handleJoin(body);
      case 'leave':   return handleLeave(body);
      case 'delete':  return handleDelete(body);
      case 'set-goal': return handleSetGoal(body);
      case 'members': return handleMembers(body);
      default:
        return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[rooms] 에러:', err);
    return NextResponse.json({ error: err.message || '서버 에러' }, { status: 500 });
  }
}

/* ─── 방 생성 ─── */

async function handleCreate(body: {
  user_id: string;
  character_id: string;
  name: string;
}) {
  const { user_id, character_id, name } = body;
  if (!user_id || !character_id || !name) {
    return NextResponse.json({ error: 'user_id, character_id, name 필수' }, { status: 400 });
  }

  /* 코드 생성 (중복 시 재시도) */
  let code = '';
  for (let i = 0; i < 5; i++) {
    code = generateCode();
    const { data } = await supabase.from('rooms').select('id').eq('code', code).limit(1);
    if (!data || data.length === 0) break;
  }

  /* 방 생성 */
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({ code, name, owner_id: user_id })
    .select('id, code, name')
    .single();

  if (roomErr) {
    return NextResponse.json({ error: roomErr.message }, { status: 500 });
  }

  /* 방장 자동 참여 */
  await supabase.from('room_members').insert({
    room_id: room.id,
    user_id,
    character_id,
  });

  return NextResponse.json({ room });
}

/* ─── 방 참여 ─── */

async function handleJoin(body: {
  user_id: string;
  character_id: string;
  code: string;
}) {
  const { user_id, character_id, code } = body;
  if (!user_id || !character_id || !code) {
    return NextResponse.json({ error: 'user_id, character_id, code 필수' }, { status: 400 });
  }

  /* 방 찾기 */
  const { data: room } = await supabase
    .from('rooms')
    .select('id, max_members, name')
    .eq('code', code.toUpperCase())
    .single();

  if (!room) {
    return NextResponse.json({ error: '존재하지 않는 코드' }, { status: 404 });
  }

  /* 이미 참여 중인지 확인 */
  const { data: existing } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user_id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ room, already_joined: true });
  }

  /* 인원 확인 */
  const { count } = await supabase
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id);

  if ((count || 0) >= room.max_members) {
    return NextResponse.json({ error: '방이 꽉 찼어요' }, { status: 409 });
  }

  /* 참여 */
  const { error } = await supabase.from('room_members').insert({
    room_id: room.id,
    user_id,
    character_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* 마지막 활동 갱신 */
  await supabase.from('rooms').update({ last_active_at: new Date().toISOString() }).eq('id', room.id);

  return NextResponse.json({ room, joined: true });
}

/* ─── 방 나가기 ─── */

async function handleLeave(body: { user_id: string; room_id: string }) {
  const { user_id, room_id } = body;

  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', room_id)
    .eq('user_id', user_id);

  return NextResponse.json({ success: true });
}

/* ─── 방 삭제 (방장만) ─── */

async function handleDelete(body: { user_id: string; room_id: string }) {
  const { user_id, room_id } = body;

  /* 방장 확인 */
  const { data: room } = await supabase
    .from('rooms')
    .select('owner_id')
    .eq('id', room_id)
    .single();

  if (!room || room.owner_id !== user_id) {
    return NextResponse.json({ error: '방장만 삭제 가능' }, { status: 403 });
  }

  /* CASCADE로 멤버/목표도 함께 삭제됨 */
  await supabase.from('rooms').delete().eq('id', room_id);

  return NextResponse.json({ success: true });
}

/* ─── 팀 목표 설정 (방장만) ─── */

async function handleSetGoal(body: {
  user_id: string;
  room_id: string;
  target_km: number;
  start_date: string;
  end_date: string;
}) {
  const { user_id, room_id, target_km, start_date, end_date } = body;

  /* 방장 확인 */
  const { data: room } = await supabase
    .from('rooms')
    .select('owner_id')
    .eq('id', room_id)
    .single();

  if (!room || room.owner_id !== user_id) {
    return NextResponse.json({ error: '방장만 목표 설정 가능' }, { status: 403 });
  }

  /* 기존 미완료 목표가 있으면 교체 */
  await supabase
    .from('room_goals')
    .delete()
    .eq('room_id', room_id)
    .eq('completed', false);

  /* 새 목표 생성 */
  const { data: goal, error } = await supabase
    .from('room_goals')
    .insert({ room_id, target_km, start_date, end_date })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal });
}

/* ─── 멤버 + 캐릭터 정보 조회 ─── */

async function handleMembers(body: { room_id: string }) {
  const { room_id } = body;

  /* 멤버 + 캐릭터 + 프로필 조인 */
  const { data: members } = await supabase
    .from('room_members')
    .select(`
      user_id,
      character_id,
      joined_at,
      characters (
        name, gender, stage, hatched, level
      ),
      profiles:user_id (
        nickname
      )
    `)
    .eq('room_id', room_id);

  /* 각 캐릭터의 도트 이미지 조회 */
  const result = [];
  for (const m of members || []) {
    const { data: pixelImg } = await supabase
      .from('character_images')
      .select('url')
      .eq('character_id', m.character_id)
      .eq('type', 'pixel_idle')
      .single();

    result.push({
      user_id: m.user_id,
      character_id: m.character_id,
      nickname: (m as any).profiles?.nickname || '???',
      character: (m as any).characters,
      pixel_url: pixelImg?.url || null,
      joined_at: m.joined_at,
    });
  }

  /* 활성 목표 */
  const { data: goals } = await supabase
    .from('room_goals')
    .select('*')
    .eq('room_id', room_id)
    .eq('completed', false)
    .order('created_at', { ascending: false })
    .limit(1);

  return NextResponse.json({ members: result, goal: goals?.[0] || null });
}
