/**
 * 런닝 기록 업로드 API
 *
 * 스크린샷 기반 런닝 기록 등록. 3단계 검증 게이트를 거친다.
 *
 * POST /api/upload-run
 *
 * step별 동작:
 *   1. check-hash  — SHA-256 해시로 중복 스크린샷 차단 (Gate A)
 *   2. parse       — 메타데이터 검증 (Gate A 강화) + VLM(gpt-4.1 vision) 파싱
 *   3. confirm     — Gate B/C 검증 + Storage 저장 + DB INSERT + 토큰 적립
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  checkGateB,
  checkGateC,
  paceToSeconds,
  type RunInput,
  type RunHistory,
} from '@/lib/validate-run';
import { validateImageMetadata } from '@/lib/validate-image';
import { aggregateRunTraits } from '@/lib/run-traits';

/* ─── 클라이언트 초기화 ─── */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * service_role 키로 Supabase 클라이언트 생성
 * — Storage 업로드, RLS 우회가 필요하므로 서버 전용
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/* ─── VLM 파싱 Zod 스키마 ─── */

/** VLM이 반환할 런닝 데이터 구조 (기본 + 캐릭터 속성) */
const RunParseSchema = z.object({
  /* ── 기본 기록 ── */
  distance_km: z.number().describe('총 거리 (km, 소수점 2자리)'),
  duration_minutes: z.number().describe('총 시간 (분, 정수로 반올림)'),
  pace: z.string().nullable().describe('평균 페이스 (mm:ss/km 형식, 없으면 null)'),
  run_date: z.string().nullable().describe('런닝 날짜 (YYYY-MM-DD, 없으면 null)'),
  app_name: z.enum(['strava', 'nike', 'samsung', 'garmin', 'other']).describe('런닝 앱 이름'),
  confidence: z.number().describe('파싱 확신도 (0.0~1.0). 런닝 스크린샷이 아니면 0'),

  /* ── 캐릭터 진화 속성 ── */
  time_of_day: z.enum(['dawn', 'morning', 'afternoon', 'evening', 'night']).describe(
    '런닝 시간대. 앱에 표시된 시간/라벨 기준: dawn(04~06), morning(06~12), afternoon(12~17), evening(17~21), night(21~04). "Night Run" 등 라벨이 있으면 그대로 따른다'
  ),
  route_type: z.enum(['track', 'road', 'trail', 'treadmill', 'unknown']).describe(
    '루트 유형. GPS 궤적 형태 기반: track=반복 루프/트랙, road=직선/도로, trail=불규칙/산길, treadmill=GPS 없음/실내 표시. 판별 불가하면 unknown'
  ),
});

type RunParseResult = z.infer<typeof RunParseSchema>;

/* ─── VLM 프롬프트 ─── */

const VLM_SYSTEM = `당신은 런닝 앱 스크린샷을 분석하는 전문가입니다.
이미지에서 런닝 기록 데이터와 환경 속성을 정확하게 추출하세요.

지원하는 앱: Strava, 나이키런(Nike Run Club), 삼성헬스(Samsung Health), Garmin Connect, 기타.

기본 기록 규칙:
- 거리는 항상 km 단위로 변환하세요 (마일이면 × 1.609).
- 시간은 분 단위 정수로 반올림하세요.
- 페이스는 "mm:ss" 형식 (/km). 표시가 없으면 거리÷시간으로 계산하세요.
- 날짜가 보이면 YYYY-MM-DD 형식으로. 연도가 없으면 올해(2026)로 가정하세요.
- 런닝 스크린샷이 아니면 confidence를 0으로 설정하세요.
- 데이터가 일부만 보이면 보이는 것만 추출하고 confidence를 낮추세요.

환경 속성 규칙:
- time_of_day: "Night Run", "Morning Run" 같은 라벨이 있으면 우선. 없으면 시각 데이터로 판단. dawn=04~06, morning=06~12, afternoon=12~17, evening=17~21, night=21~04.
- route_type: GPS 궤적 형태로 판단. 타원/원형 반복 루프=track, 직선/구간 왕복=road, 불규칙 곡선/산길=trail, GPS 없거나 실내 표시=treadmill, 불명=unknown.`;

/* ─── 메인 핸들러 ─── */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { step } = body;

    switch (step) {
      case 'check-hash': return handleCheckHash(body);
      case 'parse':      return handleParse(body);
      case 'confirm':    return handleConfirm(body);
      default:
        return NextResponse.json({ error: '알 수 없는 step' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[upload-run] 에러:', err);
    return NextResponse.json(
      { error: err.message || '서버 에러' },
      { status: 500 },
    );
  }
}

/* ─── Step 1: 해시 중복 체크 (Gate A) ─── */

/**
 * 클라이언트가 계산한 SHA-256 해시로 중복 스크린샷 여부를 확인한다.
 * 중복이면 이미지를 서버로 보내지 않아도 되므로 트래픽 절약.
 */
async function handleCheckHash(body: { user_id: string; image_hash: string }) {
  const { user_id, image_hash } = body;

  if (!user_id || !image_hash) {
    return NextResponse.json({ error: 'user_id, image_hash 필수' }, { status: 400 });
  }

  /* runs 테이블에서 (user_id, image_hash) 조합 조회 */
  const { data } = await supabase
    .from('runs')
    .select('id')
    .eq('user_id', user_id)
    .eq('image_hash', image_hash)
    .limit(1);

  const duplicate = (data && data.length > 0);

  return NextResponse.json({ duplicate });
}

/* ─── Step 2: VLM 파싱 ─── */

/**
 * 스크린샷 이미지를 메타데이터 검증 후 gpt-4.1 vision으로 분석해서
 * 런닝 데이터를 추출한다. structured output(Zod)으로 JSON 형식을 보장.
 *
 * 메타데이터 검증 (Gate A 강화):
 *   M1: 편집 소프트웨어 감지 → 즉시 거부
 *   M2: 해상도 범위 이탈 → 거부 또는 경고
 *   M3: 스마트폰 비율이 아님 → 경고
 *   M4: 타임스탬프 이상 → 경고
 *   M5: 지원하지 않는 포맷 → 거부
 */
async function handleParse(body: { image_base64: string }) {
  const { image_base64 } = body;

  if (!image_base64) {
    return NextResponse.json({ error: 'image_base64 필수' }, { status: 400 });
  }

  /* ── 메타데이터 검증 (VLM 호출 전에 먼저 체크) ── */
  const imageBuffer = Buffer.from(image_base64, 'base64');
  const validation = await validateImageMetadata(imageBuffer);

  /* 거부 대상이면 VLM 호출 없이 즉시 반환 (API 비용 절약) */
  if (!validation.passed) {
    return NextResponse.json({
      error: validation.reject_reason,
      gate: 'A',
      rule: 'metadata',
      meta_summary: validation.meta_summary,
    }, { status: 422 });
  }

  /* gpt-4.1 vision 호출 — structured output (chat.completions.parse) */
  const response = await openai.chat.completions.parse({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: VLM_SYSTEM },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${image_base64}`,
              detail: 'high',
            },
          },
          {
            type: 'text',
            text: '이 런닝 스크린샷에서 기록 데이터를 추출해주세요.',
          },
        ],
      },
    ],
    response_format: zodResponseFormat(RunParseSchema, 'run_parse'),
  });

  const parsed = response.choices[0].message.parsed as RunParseResult;

  return NextResponse.json({
    parsed,
    /* 메타데이터 경고가 있으면 함께 전달 (UI에서 표시) */
    meta_warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    meta_summary: validation.meta_summary,
  });
}

/* ─── Step 3: 검증 + 저장 (Gate B/C + Storage + DB) ─── */

/**
 * 최종 확정 단계.
 * 1) Gate B 자동 거부 체크
 * 2) Gate C 이상치 확인 (warnings 반환)
 * 3) confirmed=true면 Storage 저장 + DB INSERT + 토큰 적립
 */
async function handleConfirm(body: {
  user_id: string;
  character_id: string;
  image_hash: string;
  image_base64: string;
  run: RunInput;
  confirmed?: boolean;  // Gate C 경고 확인 여부
}) {
  const { user_id, character_id, image_hash, image_base64, run, confirmed } = body;

  if (!user_id || !character_id || !image_hash || !image_base64) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
  }

  /* Gate B: 비현실적 기록 자동 거부 */
  const gateB = checkGateB(run);
  if (!gateB.passed) {
    return NextResponse.json({
      error: gateB.error,
      gate: 'B',
      rule: gateB.rule,
    }, { status: 422 });
  }

  /* Gate C: 이상치 확인 — 과거 기록 조회 */
  const history = await getRunHistory(user_id, run.run_date);
  const gateC = checkGateC(run, history);

  /* Gate C 경고가 있고 아직 사용자 확인을 받지 않았으면 → warnings 반환 */
  if (gateC.warnings.length > 0 && !confirmed) {
    return NextResponse.json({
      gate: 'C',
      warnings: gateC.warnings,
    });
  }

  /* ── 모든 게이트 통과 → 저장 ── */

  /* Supabase Storage에 원본 이미지 저장 */
  const timestamp = Date.now();
  const storagePath = `${user_id}/${timestamp}_${image_hash.slice(0, 12)}.png`;
  const imageBuffer = Buffer.from(image_base64, 'base64');

  const { error: storageError } = await supabase.storage
    .from('screenshots')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false,
    });

  /* Storage 에러는 치명적이지 않으면 무시 (URL만 null) */
  let screenshotUrl: string | null = null;
  if (!storageError) {
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(storagePath);
    screenshotUrl = urlData.publicUrl;
  } else {
    console.warn('[upload-run] Storage 업로드 실패:', storageError.message);
  }

  /* 토큰 계산: km × 10 (기본 공식) */
  const tokensEarned = Math.round(run.distance_km * 10);

  /* 거리/페이스로 파생 속성 계산 */
  const distanceType = run.distance_km < 5 ? 'short' : run.distance_km < 10 ? 'mid' : 'long';
  const paceSeconds = run.pace ? paceToSeconds(run.pace) : (run.duration_minutes * 60) / Math.max(run.distance_km, 0.1);
  const paceType = paceSeconds < 300 ? 'sprint' : paceSeconds < 420 ? 'jogger' : 'slow';

  /* runs 테이블에 INSERT */
  const { error: insertError } = await supabase.from('runs').insert({
    user_id,
    character_id,
    distance_km: run.distance_km,
    duration_minutes: run.duration_minutes,
    pace: run.pace,
    run_date: run.run_date,
    tokens_earned: tokensEarned,
    image_hash,
    screenshot_url: screenshotUrl,
    /* 캐릭터 진화 속성 */
    time_of_day: run.time_of_day || null,
    distance_type: distanceType,
    pace_type: paceType,
    route_type: run.route_type || null,
  });

  if (insertError) {
    /* 유니크 제약 위반 = 중복 해시 (동시 요청 등) */
    if (insertError.code === '23505') {
      return NextResponse.json({ error: '이미 등록된 스크린샷', gate: 'A' }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  /* 캐릭터에 토큰 적립 */
  const { data: charData } = await supabase
    .from('characters')
    .select('tokens')
    .eq('id', character_id)
    .single();

  const newTokens = ((charData?.tokens as number) || 0) + tokensEarned;

  /* ── 누적 속성 집계 ── */
  const { data: allRuns } = await supabase
    .from('runs')
    .select('run_date, time_of_day, distance_type, pace_type, route_type')
    .eq('character_id', character_id);

  const runTraits = aggregateRunTraits(allRuns || []);

  /* 캐릭터 업데이트: 토큰 + 속성 */
  await supabase
    .from('characters')
    .update({
      tokens: newTokens,
      run_traits: runTraits,
    })
    .eq('id', character_id);

  return NextResponse.json({
    success: true,
    tokens_earned: tokensEarned,
    total_tokens: newTokens,
  });
}

/* ─── Gate C용: 최근 기록 조회 ─── */

/**
 * 사용자의 최근 런닝 기록을 조회해서 Gate C 검증에 필요한 데이터를 만든다.
 * - 최근 10회 페이스 (초/km 단위)
 * - 오늘 누적 거리
 * - 오늘 업로드 건수
 */
async function getRunHistory(userId: string, runDate: string): Promise<RunHistory> {
  /* 최근 10회 기록 (페이스 계산용) */
  const { data: recentRuns } = await supabase
    .from('runs')
    .select('distance_km, duration_minutes, pace, run_date')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  /* 페이스를 초/km 단위로 변환 */
  const recent_paces: number[] = [];
  for (const r of recentRuns || []) {
    if (r.pace) {
      const sec = paceToSeconds(r.pace);
      if (sec > 0) recent_paces.push(sec);
    } else if (r.distance_km > 0 && r.duration_minutes > 0) {
      recent_paces.push((r.duration_minutes * 60) / r.distance_km);
    }
  }

  /* 오늘 기록 (같은 날짜) */
  const todayRuns = (recentRuns || []).filter(r => r.run_date === runDate);
  const today_total_km = todayRuns.reduce((sum, r) => sum + Number(r.distance_km), 0);
  const today_count = todayRuns.length;

  return { recent_paces, today_total_km, today_count };
}
