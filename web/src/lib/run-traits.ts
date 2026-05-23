/**
 * 런닝 속성 집계 — 캐릭터 진화 프롬프트용
 *
 * runs 테이블의 개별 속성을 캐릭터 단위로 집계해서
 * characters.run_traits JSONB에 저장한다.
 *
 * 진화 이미지 생성 시 이 데이터를 프롬프트에 넣어
 * "야간 러너 → 달빛 무늬", "장거리 → 날렵한 체형" 등을 반영.
 */

/* ─── 누적 속성 타입 ─── */

/** characters.run_traits에 저장되는 구조 */
export interface RunTraits {
  /** 총 런닝 횟수 */
  total_runs: number;

  /** 시간대 분포 (최다 빈도가 주 속성) */
  time_of_day: Record<string, number>;
  /** 시간대 주 속성 */
  dominant_time: string | null;

  /** 거리 패턴 분포 */
  distance_type: Record<string, number>;
  /** 거리 주 속성 */
  dominant_distance: string | null;

  /** 페이스 유형 분포 */
  pace_type: Record<string, number>;
  /** 페이스 주 속성 */
  dominant_pace: string | null;

  /** 루트 유형 분포 */
  route_type: Record<string, number>;
  /** 루트 주 속성 */
  dominant_route: string | null;

  /** 최대 연속 업로드 일수 */
  max_streak: number;

  /** 배고픔 압박 비율 (0~1, 배고픔<30이었던 시간 비율) */
  hunger_pressure: number;
}

/** runs 테이블에서 가져올 행 */
interface RunRow {
  run_date: string;
  time_of_day: string | null;
  distance_type: string | null;
  pace_type: string | null;
  route_type: string | null;
}

/* ─── 집계 함수 ─── */

/**
 * 런닝 기록 배열에서 누적 속성을 계산한다.
 *
 * @param runs - 해당 캐릭터의 모든 런닝 기록
 * @param hungerPressure - 배고픔 압박 비율 (외부에서 계산해서 전달)
 * @returns 집계된 RunTraits
 */
export function aggregateRunTraits(
  runs: RunRow[],
  hungerPressure: number = 0,
): RunTraits {
  /* 빈도 카운터 초기화 */
  const timeCounts: Record<string, number> = {};
  const distCounts: Record<string, number> = {};
  const paceCounts: Record<string, number> = {};
  const routeCounts: Record<string, number> = {};

  /* 연속 일수 계산용 날짜 목록 */
  const dates = new Set<string>();

  for (const run of runs) {
    /* 빈도 집계 */
    if (run.time_of_day) {
      timeCounts[run.time_of_day] = (timeCounts[run.time_of_day] || 0) + 1;
    }
    if (run.distance_type) {
      distCounts[run.distance_type] = (distCounts[run.distance_type] || 0) + 1;
    }
    if (run.pace_type) {
      paceCounts[run.pace_type] = (paceCounts[run.pace_type] || 0) + 1;
    }
    if (run.route_type && run.route_type !== 'unknown') {
      routeCounts[run.route_type] = (routeCounts[run.route_type] || 0) + 1;
    }

    /* 날짜 수집 */
    if (run.run_date) dates.add(run.run_date);
  }

  return {
    total_runs: runs.length,
    time_of_day: timeCounts,
    dominant_time: getDominant(timeCounts),
    distance_type: distCounts,
    dominant_distance: getDominant(distCounts),
    pace_type: paceCounts,
    dominant_pace: getDominant(paceCounts),
    route_type: routeCounts,
    dominant_route: getDominant(routeCounts),
    max_streak: calcMaxStreak(dates),
    hunger_pressure: hungerPressure,
  };
}

/* ─── 유틸 ─── */

/** 빈도 맵에서 최다 항목 반환 */
function getDominant(counts: Record<string, number>): string | null {
  let max = 0;
  let result: string | null = null;
  for (const [key, count] of Object.entries(counts)) {
    if (count > max) { max = count; result = key; }
  }
  return result;
}

/** 날짜 Set에서 최대 연속 일수 계산 */
function calcMaxStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;

  /* 날짜를 정렬 */
  const sorted = [...dates].sort();
  let maxStreak = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 1;
    }
  }

  return maxStreak;
}

/* ─── 속성 → 프롬프트 변환 ─── */

/**
 * RunTraits를 진화 이미지 프롬프트 조각으로 변환한다.
 *
 * 캐릭터 진화 이미지 생성 시 이 텍스트를 프롬프트에 삽입하면
 * 런닝 패턴이 외형에 반영된다.
 */
export function traitsToPromptFragment(traits: RunTraits): string {
  const fragments: string[] = [];

  /* 시간대 → 색감/분위기 */
  const timeMap: Record<string, string> = {
    dawn: 'soft golden dawn light aura, early morning mist energy',
    morning: 'bright sunny disposition, warm orange tones',
    afternoon: 'vibrant midday energy, strong golden highlights',
    evening: 'warm sunset glow, amber and rose tones',
    night: 'moonlit aura, subtle starlight patterns, mysterious dark-blue accents',
  };
  if (traits.dominant_time && timeMap[traits.dominant_time]) {
    fragments.push(timeMap[traits.dominant_time]);
  }

  /* 거리 → 체형 */
  const distMap: Record<string, string> = {
    short: 'compact agile build, quick and nimble proportions',
    mid: 'balanced athletic build, well-proportioned',
    long: 'lean endurance build, sleek elongated limbs',
  };
  if (traits.dominant_distance && distMap[traits.dominant_distance]) {
    fragments.push(distMap[traits.dominant_distance]);
  }

  /* 페이스 → 근육/역동성 */
  const paceMap: Record<string, string> = {
    sprint: 'powerful muscular frame, explosive energy lines',
    jogger: 'toned balanced physique, relaxed confident posture',
    slow: 'sturdy grounded build, calm steady presence',
  };
  if (traits.dominant_pace && paceMap[traits.dominant_pace]) {
    fragments.push(paceMap[traits.dominant_pace]);
  }

  /* 루트 → 성격/무늬 */
  const routeMap: Record<string, string> = {
    track: 'disciplined guardian aura, circular pattern markings',
    road: 'adventurous explorer spirit, wind-swept details',
    trail: 'wild nature spirit, earthy organic textures, leaf patterns',
    treadmill: 'focused indoor warrior, clean geometric markings',
  };
  if (traits.dominant_route && routeMap[traits.dominant_route]) {
    fragments.push(routeMap[traits.dominant_route]);
  }

  /* 꾸준함 → 안정감 */
  if (traits.max_streak >= 7) {
    fragments.push('rock-solid stable presence, radiating consistency and discipline');
  } else if (traits.max_streak >= 3) {
    fragments.push('developing steady rhythm, hints of growing determination');
  }

  /* 배고픔 압박 → 눈매 */
  if (traits.hunger_pressure >= 0.4) {
    fragments.push('intense fierce eyes, sharp determined gaze, wild edge');
  } else if (traits.hunger_pressure >= 0.2) {
    fragments.push('slightly sharp eyes, hints of hunger-driven resilience');
  }

  return fragments.join('. ');
}

/* ─── 진화 전 전체 기록 LLM 분석 ─── */

/** 전체 런닝 기록 요약 (LLM 입력용) */
export interface RunSummaryRow {
  run_date: string;
  distance_km: number;
  duration_minutes: number;
  pace: string | null;
  time_of_day: string | null;
  distance_type: string | null;
  pace_type: string | null;
  route_type: string | null;
}

/**
 * 전체 런닝 기록을 LLM에 넘길 텍스트로 변환한다.
 *
 * 예시 출력:
 *   "총 15회 런닝. 3.0km(야간,트랙,슬로우) / 5.2km(아침,도로,조거) / ..."
 */
export function runsToSummaryText(runs: RunSummaryRow[]): string {
  if (runs.length === 0) return '런닝 기록 없음';

  /* 날짜순 정렬 */
  const sorted = [...runs].sort((a, b) => a.run_date.localeCompare(b.run_date));

  /* 각 기록을 한 줄로 */
  const lines = sorted.map(r => {
    const tags = [r.time_of_day, r.distance_type, r.pace_type, r.route_type]
      .filter(Boolean)
      .join(',');
    return `${r.run_date}: ${r.distance_km}km ${r.duration_minutes}분 ${r.pace || ''} [${tags}]`;
  });

  /* 통계 요약 */
  const totalKm = sorted.reduce((s, r) => s + r.distance_km, 0);
  const avgKm = totalKm / sorted.length;

  const header = `총 ${sorted.length}회, 누적 ${totalKm.toFixed(1)}km, 평균 ${avgKm.toFixed(1)}km/회`;

  return `${header}\n${lines.join('\n')}`;
}

/**
 * 진화 직전 전체 런닝 기록 + 통계 속성을 종합해서
 * LLM이 캐릭터 외형 묘사 프롬프트를 생성한다.
 *
 * traitsToPromptFragment()는 규칙 기반 매핑이라 패턴이 고정적이지만,
 * 이 함수는 LLM이 전체 기록의 맥락을 읽고 창의적으로 묘사한다.
 *
 * 예: "초반에는 짧은 거리를 천천히 달렸지만 점점 거리와 페이스가 늘어났다
 *     → 성장하는 캐릭터, 초반의 소심함이 남아있지만 눈빛이 단단해진 느낌"
 *
 * @param runs - 캐릭터의 전체 런닝 기록
 * @param traits - 통계 기반 누적 속성
 * @param currentStage - 현재 단계 (baby/child/teen/adult)
 * @param nextStage - 진화할 단계 (child/teen/adult/final)
 * @returns 영어 외형 묘사 프롬프트 (이미지 생성용)
 */
export function buildEvolutionAnalysisPrompt(
  runs: RunSummaryRow[],
  traits: RunTraits,
  currentStage: string,
  nextStage: string,
): string {
  const summaryText = runsToSummaryText(runs);
  const statsFragment = traitsToPromptFragment(traits);

  return `You are an expert at translating running behavior patterns into fantasy creature visual descriptions.

Below is a runner's complete running history and statistical profile.
Analyze the PATTERNS, GROWTH TRAJECTORY, and PERSONALITY implied by this data,
then output a visual description for the creature's next evolution stage.

## Running History
${summaryText}

## Statistical Profile
- Dominant time: ${traits.dominant_time || 'none'}
- Dominant distance: ${traits.dominant_distance || 'none'}
- Dominant pace: ${traits.dominant_pace || 'none'}
- Dominant route: ${traits.dominant_route || 'none'}
- Max streak: ${traits.max_streak} days
- Hunger pressure: ${(traits.hunger_pressure * 100).toFixed(0)}%
- Base visual traits: ${statsFragment || 'none yet'}

## Evolution Context
- Current stage: ${currentStage}
- Evolving to: ${nextStage}

## Instructions
1. Look for PATTERNS over time: Did they speed up? Switch from night to morning? Get more consistent?
2. Note any UNIQUE behaviors: Always 3km? Only runs on weekends? Sudden burst after long gap?
3. Translate these into VISUAL TRAITS for a fantasy creature evolving from ${currentStage} to ${nextStage}.
4. Output ONLY the visual description in English, 2-3 sentences max.
5. Focus on: body shape, eye expression, color accents, special markings, aura/energy, posture.
6. The description should feel like this creature was SHAPED by this specific runner's journey.`;
}

