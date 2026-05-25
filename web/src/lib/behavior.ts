/**
 * 캐릭터 행동 상태 시스템
 *
 * 6가지 행동 패턴을 hunger/affection/터치/시간 조건으로 결정한다.
 * 레벨이나 수치는 사용자에게 절대 노출하지 않고,
 * 캐릭터의 행동과 움직임으로만 상태를 전달한다.
 *
 * 행동 패턴 (우선순위 순):
 *   1. aegyo   — 애교: 애정 높음 + 터치 직후
 *   2. joyful  — 즐거움: 먹이 먹은 직후 / 애정 받은 직후
 *   3. sad     — 슬픔: 애정 낮음
 *   4. hungry  — 배고픔: 배고픔 낮음
 *   5. happy   — 행복: 기본 상태 (배고픔/애정 모두 괜찮음)
 *
 * 스탯 상호작용:
 *   - 배고픔 낮은 상태 지속 → 애정 추가 감소
 *   - 터치 → 애정 소량 증가
 *   - 먹이 → 배고픔 회복 + 애정 소량 증가
 */

/* ─── 행동 타입 ─── */

/** 캐릭터가 취할 수 있는 5가지 행동 */
export type Behavior = 'happy' | 'sad' | 'hungry' | 'joyful' | 'aegyo';

/** 행동별 움직임 설정 */
export interface BehaviorMotion {
  /** 멈춤 최소 시간 (ms) */
  pauseMin: number;
  /** 멈춤 최대 시간 (ms) */
  pauseMax: number;
  /** 한 홉 이동 범위 (px) */
  moveRange: number;
  /** 점프 높이 배율 (1.0 = 기본) */
  hopScale: number;
  /** 프레임 속도 배율 (1.0 = 기본 300ms, 낮을수록 빠름) */
  frameSpeedScale: number;
  /** 특수 행동 (제자리 뛰기, 회전 등) */
  specialAction?: 'bounce_in_place' | 'spin' | 'shake' | 'sway' | 'crouch';
}

/* ─── 행동별 움직임 상수 ─── */

export const BEHAVIOR_MOTION: Record<Behavior, BehaviorMotion> = {
  /* 행복: 활발하게 돌아다님 */
  happy: {
    pauseMin: 1500,
    pauseMax: 3500,
    moveRange: 120,
    hopScale: 1.0,
    frameSpeedScale: 1.0,
  },

  /* 즐거움: 신나서 빠르게 움직임, 제자리 뛰기 */
  joyful: {
    pauseMin: 600,
    pauseMax: 1200,
    moveRange: 60,
    hopScale: 1.5,
    frameSpeedScale: 0.6,
    specialAction: 'bounce_in_place',
  },

  /* 애교: 터치 방향으로 다가와서 작은 점프 연속 */
  aegyo: {
    pauseMin: 400,
    pauseMax: 800,
    moveRange: 40,
    hopScale: 0.8,
    frameSpeedScale: 0.7,
    specialAction: 'sway',
  },

  /* 배고픔: 느릿느릿, 가끔 흔들거림 */
  hungry: {
    pauseMin: 4000,
    pauseMax: 7000,
    moveRange: 50,
    hopScale: 0.5,
    frameSpeedScale: 1.4,
    specialAction: 'shake',
  },

  /* 슬픔: 구석에 웅크림, 거의 안 움직임 */
  sad: {
    pauseMin: 6000,
    pauseMax: 12000,
    moveRange: 20,
    hopScale: 0.2,
    frameSpeedScale: 1.8,
    specialAction: 'crouch',
  },

};

/* ─── 행동별 이미지 타입 매핑 ─── */

/**
 * character_images 테이블의 type 필드명.
 * LLM이 행동별 이미지를 생성할 때 이 이름으로 저장한다.
 */
/**
 * 행동별 이미지 타입 (4프레임 애니메이션)
 * DB에는 pixel_happy1, pixel_happy2, pixel_happy3, pixel_happy4 로 저장
 */
/**
 * 행동별 이미지 타입 (4프레임 애니메이션)
 *
 * 기본 이동: pixel_move1~4 (항상 사용, 돌아다님)
 * 감정 표현: 랜덤 또는 조건에 따라 잠깐 보여줌
 */
export const BEHAVIOR_FRAME_TYPES: Record<string, string[]> = {
  move:   ['pixel_move1', 'pixel_move2', 'pixel_move3', 'pixel_move4'],
  happy:  ['pixel_happy1', 'pixel_happy2', 'pixel_happy3', 'pixel_happy4'],
  sad:    ['pixel_sad1', 'pixel_sad2', 'pixel_sad3', 'pixel_sad4'],
  hungry: ['pixel_hungry1', 'pixel_hungry2', 'pixel_hungry3', 'pixel_hungry4'],
  joyful: ['pixel_joyful1', 'pixel_joyful2', 'pixel_joyful3', 'pixel_joyful4'],
  aegyo:  ['pixel_aegyo1', 'pixel_aegyo2', 'pixel_aegyo3', 'pixel_aegyo4'],
};

/* ─── 행동 결정 로직 ─── */

/** 행동 결정에 필요한 입력 */
export interface BehaviorInput {
  /** 배고픔 (0~100, 0=극도로 배고픔) */
  hunger: number;
  /** 애정 (0~100) */
  affection: number;
  /** 최근 터치 여부 (터치 후 10초 이내) */
  recentlyTouched: boolean;
  /** 최근 먹이/애정 아이템 사용 여부 (사용 후 15초 이내) */
  recentlyFed: boolean;
}

/**
 * 현재 스탯과 상호작용 이력으로 행동을 결정한다.
 *
 * 기본: 이동 (move) — 항상 돌아다님
 * 감정 표현이 조건에 따라 끼어듦:
 *   1. aegyo   — 터치 직후 (애정 ≥ 60)
 *   2. joyful  — 먹이/애정 받은 직후 (15초)
 *   3. sad     — 애정 < 25 (방치)
 *   4. hungry  — 배고픔 < 30
 *   5. happy   — 기분 좋을 때 랜덤 (20%)
 *   6. move    — 기본 이동
 */
export function determineBehavior(input: BehaviorInput): Behavior {
  const { hunger, affection, recentlyTouched, recentlyFed } = input;

  /* 1. 애교: 터치 직후 + 애정 충분 */
  if (recentlyTouched && affection >= 60) {
    return 'aegyo';
  }

  /* 2. 즐거움: 방금 먹이/애정 받음 */
  if (recentlyFed) {
    return 'joyful';
  }

  /* 3. 슬픔: 방치 (밥 안 줌 → 애정 하락) */
  if (affection < 25) {
    return 'sad';
  }

  /* 4. 배고픔 */
  if (hunger < 30) {
    return 'hungry';
  }

  /* 5. 랜덤 happy: 컨디션 좋을 때 가끔 */
  if (hunger >= 50 && affection >= 50 && Math.random() < 0.2) {
    return 'happy';
  }

  /* 6. 기본: 이동 — BouncingCharacter에서 move 프레임 사용 */
  return 'happy';
}

/* ─── 스탯 상호작용 계산 ─── */

/** 스탯 변화 결과 */
export interface StatsDelta {
  /** 배고픔 변화량 */
  hungerDelta: number;
  /** 애정 변화량 */
  affectionDelta: number;
}

/**
 * 터치 시 스탯 변화를 계산한다 (부화 후 캐릭터).
 *
 * - 애정 +3 (터치 1회당)
 * - 배고픔 변화 없음
 */
export function calcTouchDelta(): StatsDelta {
  return { hungerDelta: 0, affectionDelta: 3 };
}

/* ─── 알 부화 시스템 ─── */

/**
 * 알 부화 규칙:
 *   - 알 상태에서는 터치만 가능 (먹이 불가)
 *   - 100 터치 = 1 애정 (0.01 per touch)
 *   - 애정 100 = 부화 → 총 10,000 터치 필요
 *   - 30% (애정 30): 알 흔들림 시작
 *   - 50/70/90%: 흔들림 빈번해짐
 */

/** 알 부화에 필요한 총 터치 수 */
export const EGG_HATCH_TOUCHES = 10_000;

/** 터치 → 애정 변환 비율 (100터치 = 1애정) */
export const EGG_TOUCH_PER_AFFECTION = 100;

/** 알 부화에 필요한 애정 (100) */
export const EGG_HATCH_AFFECTION = 100;

/** 알 흔들림 단계 */
export interface EggShakeLevel {
  /** 흔들림 시작 애정 비율 (0~1) */
  threshold: number;
  /** 흔들림 간격 (ms) — 낮을수록 자주 흔들림 */
  intervalMs: number;
  /** 흔들림 강도 (px) */
  amplitude: number;
  /** 흔들림 지속 시간 (ms) */
  durationMs: number;
}

/**
 * 애정 비율(0~1)에 따른 알 흔들림 단계 정의
 *
 * 30%: 가끔 미세하게 흔들림
 * 50%: 종종 중간 강도로 흔들림
 * 70%: 자주 세게 흔들림
 * 90%: 거의 계속 강하게 흔들림 + 균열 연출
 */
export const EGG_SHAKE_LEVELS: EggShakeLevel[] = [
  { threshold: 0.3, intervalMs: 8000, amplitude: 3,  durationMs: 600 },
  { threshold: 0.5, intervalMs: 4000, amplitude: 5,  durationMs: 800 },
  { threshold: 0.7, intervalMs: 2000, amplitude: 8,  durationMs: 1000 },
  { threshold: 0.9, intervalMs: 800,  amplitude: 12, durationMs: 1200 },
];

/**
 * 알의 현재 애정으로 흔들림 단계를 결정한다.
 *
 * @param affection - 현재 애정 (0~100)
 * @returns 해당하는 가장 높은 단계, 없으면 null (아직 안 흔들림)
 */
export function getEggShakeLevel(affection: number): EggShakeLevel | null {
  const ratio = affection / EGG_HATCH_AFFECTION;
  let result: EggShakeLevel | null = null;

  for (const level of EGG_SHAKE_LEVELS) {
    if (ratio >= level.threshold) {
      result = level;
    }
  }

  return result;
}

/**
 * 알 터치 시 애정 증가량을 계산한다.
 *
 * @param currentTouches - 현재 누적 터치 수 (characters.egg_touches)
 * @returns 새로운 터치 수와 애정
 */
export function calcEggTouch(currentTouches: number): {
  newTouches: number;
  newAffection: number;
  hatched: boolean;
} {
  const newTouches = currentTouches + 1;
  const newAffection = Math.min(
    EGG_HATCH_AFFECTION,
    Math.floor(newTouches / EGG_TOUCH_PER_AFFECTION),
  );
  const hatched = newAffection >= EGG_HATCH_AFFECTION;

  return { newTouches, newAffection, hatched };
}

/**
 * 시간 경과에 따른 스탯 감소를 계산한다.
 *
 * - 기본: 시간당 배고픔 -4, 애정 -2
 * - 배고픔 < 20 지속 시: 애정 추가 감소 (시간당 -3 추가)
 *
 * @param hoursElapsed - 마지막 업데이트 후 경과 시간
 * @param currentHunger - 현재 배고픔
 */
export function calcDecayDelta(
  hoursElapsed: number,
  currentHunger: number,
): StatsDelta {
  /* 기본 감소 */
  let hungerDecay = hoursElapsed * 4;
  let affectionDecay = hoursElapsed * 2;

  /* 배고픔이 낮으면 애정도 추가로 떨어짐 (방치 패널티) */
  if (currentHunger < 20) {
    affectionDecay += hoursElapsed * 3;
  }

  return {
    hungerDelta: -hungerDecay,
    affectionDelta: -affectionDecay,
  };
}

/**
 * 스탯을 0~100 범위로 클램핑한다.
 */
export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/* ─── 터치 빈도 추적 (클라이언트 전용) ─── */

/**
 * 최근 N초 동안 터치 횟수를 추적하는 간단한 카운터.
 * 컴포넌트에서 useRef로 인스턴스를 유지한다.
 */
export class TouchTracker {
  /** 터치 타임스탬프 배열 */
  private timestamps: number[] = [];
  /** 추적 기간 (ms) — 기본 60초 */
  private window: number;

  constructor(windowMs = 60_000) {
    this.window = windowMs;
  }

  /** 터치 발생 기록 */
  record(): void {
    this.timestamps.push(Date.now());
    this.cleanup();
  }

  /** 추적 기간 내 터치 횟수 */
  count(): number {
    this.cleanup();
    return this.timestamps.length;
  }

  /** 마지막 터치 이후 경과 시간 (ms). 터치 없으면 Infinity */
  sinceLastTouch(): number {
    if (this.timestamps.length === 0) return Infinity;
    return Date.now() - this.timestamps[this.timestamps.length - 1];
  }

  /** 최근 터치 여부 (10초 이내) */
  isRecentlyTouched(): boolean {
    return this.sinceLastTouch() < 10_000;
  }

  /** 기간 밖 타임스탬프 정리 */
  private cleanup(): void {
    const cutoff = Date.now() - this.window;
    this.timestamps = this.timestamps.filter(t => t >= cutoff);
  }
}

/* ─── 성장 곡선 (레벨/진화) ─── */

/**
 * 진화 구간 (알 부화 후):
 *   유아   Lv  0~10  —  200 EXP (20/lv)
 *   유년   Lv 10~20  —  500 EXP (50/lv)
 *   초기체 Lv 20~30  —  900 EXP (90/lv)
 *   중기체 Lv 30~40  — 1400 EXP (140/lv)
 *   ─────────────────────────────
 *   총 3,000 EXP → 완전체(Lv 40)
 *
 * 초기에 빠르게, 뒤로 갈수록 느리게.
 */

/** 진화 단계 정의 */
export interface Stage {
  name: string;       // 코드명 (DB 저장용)
  label: string;      // 한국어 표시명
  minLevel: number;   // 시작 레벨
  maxLevel: number;   // 끝 레벨 (다음 단계 시작 전)
  expPerLevel: number; // 레벨당 필요 EXP
}

export const STAGES: Stage[] = [
  { name: 'baby',  label: '유아',   minLevel: 0,  maxLevel: 10, expPerLevel: 20 },
  { name: 'child', label: '유년',   minLevel: 10, maxLevel: 20, expPerLevel: 50 },
  { name: 'teen',  label: '초기체', minLevel: 20, maxLevel: 30, expPerLevel: 90 },
  { name: 'adult', label: '중기체', minLevel: 30, maxLevel: 40, expPerLevel: 140 },
];

/** 최대 레벨 */
export const MAX_LEVEL = 40;

/**
 * 진화 이미지 사전 생성 트리거 레벨
 * 해당 레벨 도달 시 다음 단계 이미지를 백그라운드 생성
 */
export const PRE_EVOLVE_LEVELS: Record<number, string> = {
  9:  'child',  // Lv 9 도달 → 유년 이미지 사전 생성
  19: 'teen',   // Lv 19 도달 → 초기체 이미지 사전 생성
  29: 'adult',  // Lv 29 도달 → 중기체 이미지 사전 생성
  39: 'final',  // Lv 39 도달 → 완전체 이미지 사전 생성
};

/** 완전체 단계명 */
export const FINAL_STAGE = { name: 'final', label: '완전체' };

/**
 * 레벨별 누적 EXP 테이블을 생성한다.
 * LEVEL_THRESHOLDS[lv] = 해당 레벨 도달에 필요한 누적 EXP
 */
export const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds = [0]; // Lv 0 = 0 EXP
  let cumulative = 0;

  for (const stage of STAGES) {
    for (let lv = stage.minLevel; lv < stage.maxLevel; lv++) {
      cumulative += stage.expPerLevel;
      thresholds.push(cumulative);
    }
  }

  return thresholds;
})();

/**
 * 누적 EXP → 레벨 변환
 */
export function expToLevel(exp: number): number {
  for (let lv = LEVEL_THRESHOLDS.length - 1; lv >= 1; lv--) {
    if (exp >= LEVEL_THRESHOLDS[lv]) return lv;
  }
  return 0;
}

/**
 * 레벨 → 진화 단계명 변환
 */
export function levelToStage(level: number): string {
  if (level >= MAX_LEVEL) return FINAL_STAGE.name;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (level >= STAGES[i].minLevel) return STAGES[i].name;
  }
  return STAGES[0].name;
}

/**
 * 단계 코드명 → 한국어 라벨
 */
export function stageLabel(stageName: string): string {
  if (stageName === FINAL_STAGE.name) return FINAL_STAGE.label;
  return STAGES.find(s => s.name === stageName)?.label || stageName;
}

/* ─── 포만감 시스템 ─── */

/** 먹이 거부 임계치 — 배고픔이 이 이상이면 먹이를 안 먹음 */
export const HUNGER_FULL_THRESHOLD = 80;

/** 애정 거부 임계치 — 애정이 이 이상이면 애정 아이템 거부 */
export const AFFECTION_FULL_THRESHOLD = 80;

/**
 * 아이템 사용 가능 여부를 판단한다.
 *
 * @param itemId - 아이템 ID ('feed' | 'love' | 'candy')
 * @param hunger - 현재 배고픔
 * @param affection - 현재 애정
 * @returns { usable, reason } — 사용 불가 시 거부 사유
 */
export function canUseItem(
  itemId: string,
  hunger: number,
  affection: number,
): { usable: boolean; reason?: string } {
  if (itemId === 'feed' && hunger >= HUNGER_FULL_THRESHOLD) {
    return { usable: false, reason: '배불러요~' };
  }
  if (itemId === 'love' && affection >= AFFECTION_FULL_THRESHOLD) {
    return { usable: false, reason: '충분해요~' };
  }
  /* 경험치 사탕은 제한 없음 */
  return { usable: true };
}

/* ─── 터치 EXP ─── */

/** 터치 1회당 EXP */
export const TOUCH_EXP = 1;

/* ─── 행동 언락 시스템 ─── */

/**
 * 레벨에 따라 해금되는 추가 행동 액션.
 * 행동 이미지는 LLM이 생성 — 여기선 타입과 해금 조건만 정의.
 *
 * 기본 행동(걷기/뛰기)은 항상 가능.
 * 레벨이 오를수록 새 행동이 추가됨 → 캐릭터가 점점 다채로워짐.
 */
export interface ActionDef {
  id: string;
  label: string;
  unlockLevel: number;
  /** character_images 테이블의 type 값 */
  imageType: string;
}

export const ACTION_DEFS: ActionDef[] = [
  /* 유아기 (0~10) — 기본 행동 + 초기 해금 */
  { id: 'walk',    label: '걷기',       unlockLevel: 0,  imageType: 'pixel_walk' },
  { id: 'hop',     label: '깡충뛰기',   unlockLevel: 3,  imageType: 'pixel_hop' },
  { id: 'yawn',    label: '하품',       unlockLevel: 6,  imageType: 'pixel_yawn' },
  { id: 'roll',    label: '뒹굴거리기', unlockLevel: 9,  imageType: 'pixel_roll' },

  /* 유년기 (10~20) */
  { id: 'stretch', label: '기지개',     unlockLevel: 12, imageType: 'pixel_stretch' },
  { id: 'nuzzle',  label: '비비기',     unlockLevel: 15, imageType: 'pixel_nuzzle' },
  { id: 'dance',   label: '춤추기',     unlockLevel: 18, imageType: 'pixel_dance' },

  /* 초기체 (20~30) */
  { id: 'spin',    label: '빙글빙글',   unlockLevel: 22, imageType: 'pixel_spin' },
  { id: 'sleep',   label: '낮잠',       unlockLevel: 25, imageType: 'pixel_sleep' },
  { id: 'dash',    label: '질주',       unlockLevel: 28, imageType: 'pixel_dash' },

  /* 중기체 (30~40) */
  { id: 'flex',    label: '으쓱',       unlockLevel: 32, imageType: 'pixel_flex' },
  { id: 'play',    label: '장난치기',   unlockLevel: 35, imageType: 'pixel_play' },
  { id: 'pose',    label: '포즈',       unlockLevel: 38, imageType: 'pixel_pose' },
];
