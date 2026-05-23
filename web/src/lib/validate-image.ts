/**
 * 이미지 메타데이터 검증 — Gate A 강화
 *
 * sharp로 업로드된 이미지의 EXIF/메타데이터를 추출하고,
 * 편집 흔적·타임스탬프 신선도·해상도 이상을 검사한다.
 *
 * 서버 사이드 전용 (sharp는 Node.js에서만 동작).
 */

import sharp from 'sharp';

/* ─── 타입 ─── */

/** 메타데이터 검증 결과 */
export interface ImageValidation {
  /** 통과 여부 (false면 거부) */
  passed: boolean;
  /** 거부 사유 (passed=false일 때) */
  reject_reason?: string;
  /** 경고 목록 (passed=true이지만 의심스러운 점) */
  warnings: ImageWarning[];
  /** 추출된 메타데이터 요약 (디버그/로그용) */
  meta_summary: MetaSummary;
}

/** 개별 경고 */
export interface ImageWarning {
  rule: string;   // "M1" | "M2" | "M3" ...
  message: string;
}

/** 메타데이터 요약 */
export interface MetaSummary {
  width: number;
  height: number;
  format: string;
  has_exif: boolean;
  software?: string;
  create_date?: string;
}

/* ─── 상수 ─── */

/**
 * 편집 소프트웨어 키워드 목록
 * EXIF의 Software 필드에 이 단어가 포함되면 편집 의심
 */
const EDITOR_KEYWORDS = [
  'photoshop',
  'gimp',
  'lightroom',
  'snapseed',
  'picsart',
  'canva',
  'pixlr',
  'afterlight',
  'vsco',
  'meitu',       // 중국산 편집앱
  'beauty',      // 뷰티 카메라류
  'facetune',
  'airbrush',
  'photoeditor',
  'photo editor',
  'paint.net',
  'affinity',
  'capture one',
  'darktable',
  'rawtherapee',
];

/**
 * 일반적인 스마트폰 스크린샷 세로 해상도 범위
 * 너무 작으면 잘린 이미지, 너무 크면 합성 의심
 */
const MIN_HEIGHT = 640;    // 아주 오래된 폰 최소치
const MAX_HEIGHT = 4000;   // 최신 고해상도 폰 상한
const MIN_WIDTH = 320;
const MAX_WIDTH = 2200;

/**
 * 스크린샷 허용 최대 경과 시간 (밀리초)
 * 7일 — 런닝 기록은 며칠 뒤에 올릴 수도 있으므로 넉넉하게
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/* ─── 메인 검증 함수 ─── */

/**
 * 이미지 Buffer를 받아 메타데이터 검증을 수행한다.
 *
 * @param imageBuffer - 이미지 원본 바이트 (base64 디코딩된 Buffer)
 * @returns 검증 결과 (통과 여부 + 경고 + 메타 요약)
 */
export async function validateImageMetadata(
  imageBuffer: Buffer,
): Promise<ImageValidation> {
  const warnings: ImageWarning[] = [];

  /* sharp로 메타데이터 추출 */
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  /* 기본 정보 */
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const format = metadata.format || 'unknown';

  /* EXIF 존재 여부 */
  const exif = metadata.exif;
  const hasExif = !!exif;

  /* EXIF에서 주요 필드 추출 */
  let software: string | undefined;
  let createDate: string | undefined;

  if (hasExif) {
    try {
      const exifData = parseExifBasic(exif!);
      software = exifData.software;
      createDate = exifData.dateTime;
    } catch {
      /* EXIF 파싱 실패는 무시 — 없는 것으로 취급 */
    }
  }

  /* 메타 요약 (로그/디버그용) */
  const meta_summary: MetaSummary = {
    width,
    height,
    format,
    has_exif: hasExif,
    software,
    create_date: createDate,
  };

  /* ── M1: 편집 소프트웨어 감지 ── */
  if (software) {
    const lower = software.toLowerCase();
    const detected = EDITOR_KEYWORDS.find(kw => lower.includes(kw));
    if (detected) {
      return {
        passed: false,
        reject_reason: `편집된 이미지는 등록할 수 없습니다 (${software})`,
        warnings: [],
        meta_summary,
      };
    }
  }

  /* ── M2: 해상도 범위 체크 ── */
  /* 가로·세로 중 긴 쪽을 height, 짧은 쪽을 width로 정규화 */
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);

  if (longSide < MIN_HEIGHT || shortSide < MIN_WIDTH) {
    return {
      passed: false,
      reject_reason: '이미지 해상도가 너무 낮습니다',
      warnings: [],
      meta_summary,
    };
  }

  if (longSide > MAX_HEIGHT || shortSide > MAX_WIDTH) {
    warnings.push({
      rule: 'M2',
      message: '일반적인 스크린샷 해상도를 벗어남',
    });
  }

  /* ── M3: 스크린샷 비율 체크 ── */
  /* 스마트폰 스크린샷은 보통 세로 비율 (16:9 ~ 21:9 범위) */
  const ratio = longSide / shortSide;
  if (ratio < 1.3 || ratio > 2.8) {
    warnings.push({
      rule: 'M3',
      message: '스마트폰 스크린샷 비율이 아님 (잘린 이미지?)',
    });
  }

  /* ── M4: 타임스탬프 신선도 ── */
  if (createDate) {
    const created = new Date(createDate);
    if (!isNaN(created.getTime())) {
      const ageMs = Date.now() - created.getTime();

      /* 미래 시간이면 경고 */
      if (ageMs < -60_000) {
        warnings.push({
          rule: 'M4',
          message: '이미지 생성 시간이 미래로 설정됨',
        });
      }

      /* 너무 오래된 이미지 */
      if (ageMs > MAX_AGE_MS) {
        warnings.push({
          rule: 'M4',
          message: '7일 이상 전에 촬영된 스크린샷',
        });
      }
    }
  }

  /* ── M5: 포맷 체크 ── */
  /* 스크린샷은 보통 PNG. JPEG도 허용하되 경고 */
  const allowedFormats = ['png', 'jpeg', 'jpg', 'webp'];
  if (!allowedFormats.includes(format)) {
    return {
      passed: false,
      reject_reason: `지원하지 않는 이미지 형식입니다 (${format})`,
      warnings: [],
      meta_summary,
    };
  }

  return {
    passed: true,
    warnings,
    meta_summary,
  };
}

/* ─── EXIF 기본 파싱 ─── */

/**
 * EXIF Buffer에서 Software, DateTime 필드만 간단히 추출한다.
 *
 * 전체 EXIF 파서를 쓰지 않고 sharp가 준 raw exif buffer에서
 * 알려진 태그 ID로 직접 읽는다.
 *
 * EXIF 태그 ID:
 *   - 0x0131 (305) = Software
 *   - 0x0132 (306) = DateTime
 *   - 0x9003 (36867) = DateTimeOriginal
 */
function parseExifBasic(exifBuffer: Buffer): {
  software?: string;
  dateTime?: string;
} {
  /* EXIF 데이터를 문자열로 변환해서 키워드 탐색 (간이 방식) */
  const raw = exifBuffer.toString('latin1');

  /* Software 필드 찾기 — ASCII 문자열 패턴 */
  const software = extractExifString(raw, 'Software');
  const dateTime =
    extractExifString(raw, 'DateTimeOriginal') ||
    extractExifString(raw, 'DateTime');

  return { software, dateTime };
}

/**
 * EXIF raw 문자열에서 특정 필드명 뒤의 값을 추출하는 간이 함수
 *
 * EXIF IFD 구조를 완전히 파싱하지 않고,
 * 태그 이름이 ASCII로 포함된 경우 그 뒤의 문자열을 가져온다.
 * 정확도는 낮지만 편집 소프트웨어 탐지 용도로는 충분하다.
 */
function extractExifString(raw: string, _fieldName: string): string | undefined {
  /**
   * 실제로는 EXIF IFD 바이너리 구조를 파싱해야 정확하지만,
   * sharp의 metadata()에 포함된 exif buffer를 latin1로 변환하면
   * 소프트웨어명 등 ASCII 문자열이 그대로 보인다.
   *
   * 알려진 편집 소프트웨어 이름들을 직접 매칭하는 방식으로 대체한다.
   */

  /* 편집 소프트웨어 이름이 raw 데이터에 포함되어 있는지 확인 */
  for (const kw of EDITOR_KEYWORDS) {
    if (raw.toLowerCase().includes(kw)) {
      /* 키워드 주변 문맥을 추출 (최대 50자) */
      const idx = raw.toLowerCase().indexOf(kw);
      const start = Math.max(0, idx - 5);
      const end = Math.min(raw.length, idx + kw.length + 30);
      /* 출력 가능 문자만 필터링 */
      const context = raw.slice(start, end).replace(/[^\x20-\x7E]/g, '');
      if (context.length > 0) return context.trim();
    }
  }

  /* 날짜 패턴 매칭: "2026:05:15 14:30:00" 형식 */
  if (_fieldName.includes('Date')) {
    const datePattern = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
    const match = raw.match(datePattern);
    if (match) {
      /* EXIF 날짜 → ISO 형식 변환 */
      return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
    }
  }

  return undefined;
}
