/**
 * 런닝 기록 검증 — Gate B (자동 거부) + Gate C (이상치 확인)
 *
 * Gate B: 물리적으로 불가능하거나 모순되는 기록을 자동 차단.
 * Gate C: 의심스럽지만 가능한 기록에 대해 사용자 확인을 요청.
 *
 * 서버 사이드에서 사용. 클라이언트에서 import하지 않는다.
 */

/* ─── 타입 ─── */

/** 검증 대상 런닝 기록 */
export interface RunInput {
  distance_km: number;      // 거리 (km)
  duration_minutes: number; // 시간 (분)
  pace: string | null;      // "mm:ss" /km 형식
  run_date: string;         // "YYYY-MM-DD"
  /* ── 캐릭터 진화 속성 ── */
  time_of_day?: string;     // dawn/morning/afternoon/evening/night
  route_type?: string;      // track/road/trail/treadmill/unknown
}

/** 과거 기록 요약 (Gate C에서 사용) */
export interface RunHistory {
  recent_paces: number[];   // 최근 10회 페이스 (초/km 단위)
  today_total_km: number;   // 오늘 누적 거리
  today_count: number;      // 오늘 업로드 건수
}

/** Gate B 결과: 거부 시 에러 메시지 반환 */
export interface GateBResult {
  passed: boolean;
  error?: string;           // 거부 사유
  rule?: string;            // "B1" | "B2" | "B3" | "B4"
}

/** Gate C 결과: 경고 목록 반환 (빈 배열이면 통과) */
export interface GateCResult {
  warnings: { rule: string; message: string }[];
}

/* ─── 유틸 ─── */

/**
 * "mm:ss" 형식 페이스 → 초 단위로 변환
 *
 * 예: "05:30" → 330초
 */
export function paceToSeconds(pace: string): number {
  const parts = pace.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * 거리(km)와 시간(분)으로 페이스(초/km) 계산
 */
function calcPaceSeconds(km: number, minutes: number): number {
  if (km <= 0) return 0;
  return (minutes * 60) / km;
}

/* ─── Gate B: 자동 거부 ─── */

/**
 * Gate B — 물리적으로 불가능한 기록 차단
 *
 * B1: 페이스 ≤ 2:50/km (세계 기록 수준 이하)
 * B2: 거리·시간·페이스 상호 모순 (오차 > 15%)
 * B3: 거리 > 100km인데 시간 < 5시간 (울트라마라톤도 불가능)
 * B4: 미래 날짜
 */
export function checkGateB(run: RunInput): GateBResult {
  /* B4: 미래 날짜 */
  const today = new Date();
  today.setHours(23, 59, 59, 999); // 오늘 끝까지 허용
  const runDateObj = new Date(run.run_date + 'T23:59:59');
  if (runDateObj > today) {
    return { passed: false, error: '미래 날짜는 등록할 수 없음', rule: 'B4' };
  }

  /* B1: 비현실적 페이스 (2:50/km = 170초 이하) */
  if (run.pace) {
    const paceSec = paceToSeconds(run.pace);
    if (paceSec > 0 && paceSec < 170) {
      return { passed: false, error: '페이스가 비현실적 (세계 기록 이하)', rule: 'B1' };
    }
  }

  /* B3: 극단 기록 — 100km 넘는데 5시간 미만 */
  if (run.distance_km > 100 && run.duration_minutes < 300) {
    return { passed: false, error: '거리 대비 시간이 비현실적', rule: 'B3' };
  }

  /* B2: 수치 모순 — 거리·시간으로 계산한 페이스 vs 입력 페이스 오차 > 15% */
  if (run.pace && run.distance_km > 0 && run.duration_minutes > 0) {
    const inputPace = paceToSeconds(run.pace);
    const calcPace = calcPaceSeconds(run.distance_km, run.duration_minutes);
    if (inputPace > 0 && calcPace > 0) {
      const diff = Math.abs(inputPace - calcPace) / calcPace;
      if (diff > 0.15) {
        return { passed: false, error: '거리·시간·페이스 수치가 맞지 않음', rule: 'B2' };
      }
    }
  }

  return { passed: true };
}

/* ─── Gate C: 이상치 확인 ─── */

/**
 * Gate C — 의심스러운 기록에 대해 경고 목록 반환
 *
 * C1: 최근 10회 평균 페이스 대비 ±20% 이탈
 * C2: 당일 누적 > 42km (풀마라톤 초과)
 * C3: 같은 날 3건째 이상
 *
 * 경고가 있으면 클라이언트에서 "맞나요?" 확인을 받아야 한다.
 */
export function checkGateC(run: RunInput, history: RunHistory): GateCResult {
  const warnings: { rule: string; message: string }[] = [];

  /* C1: 페이스 이탈 (최근 평균 대비 ±20%) */
  if (history.recent_paces.length >= 3 && run.distance_km > 0 && run.duration_minutes > 0) {
    const avg = history.recent_paces.reduce((a, b) => a + b, 0) / history.recent_paces.length;
    const current = calcPaceSeconds(run.distance_km, run.duration_minutes);
    if (avg > 0 && current > 0) {
      const deviation = Math.abs(current - avg) / avg;
      if (deviation > 0.2) {
        warnings.push({ rule: 'C1', message: '평소와 다른 페이스' });
      }
    }
  }

  /* C2: 당일 누적 42km 초과 */
  const totalToday = history.today_total_km + run.distance_km;
  if (totalToday > 42) {
    warnings.push({ rule: 'C2', message: '오늘 기록이 많음 (42km 초과)' });
  }

  /* C3: 같은 날 3건째 */
  if (history.today_count >= 2) {
    warnings.push({ rule: 'C3', message: '같은 날 여러 건' });
  }

  return { warnings };
}
