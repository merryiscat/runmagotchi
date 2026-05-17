/**
 * 사주 계산 API (전체 버전)
 *
 * 생년월일 + 성별을 받아서 전체 만세력 데이터를 반환한다.
 * lunar-typescript로 양력 → 음력 → 사주(팔자) + 대운 계산.
 *
 * POST /api/saju
 * Body: { "birthDate": "1992-02-21", "gender": "male" }
 *   - birthDate: "YYYY-MM-DD" 형식
 *   - gender: "male" 또는 "female" (대운 계산에 필요)
 *
 * Response: {
 *   saju: { 사주 팔자 },
 *   lunar: { 음력 정보 },
 *   yun: { 대운 정보 }
 * }
 */

import { NextResponse } from 'next/server';
import { Solar } from 'lunar-typescript';

/** 천간(天干) → 오행 매핑 */
const GAN_TO_ELEMENT: Record<string, string> = {
  '甲': '목', '乙': '목',
  '丙': '화', '丁': '화',
  '戊': '토', '己': '토',
  '庚': '금', '辛': '금',
  '壬': '수', '癸': '수',
};

/** 천간(天干) → 한글 음 매핑 */
const GAN_TO_KR: Record<string, string> = {
  '甲': '갑', '乙': '을',
  '丙': '병', '丁': '정',
  '戊': '무', '己': '기',
  '庚': '경', '辛': '신',
  '壬': '임', '癸': '계',
};

/** 지지(地支) → 한글 음 매핑 */
const ZHI_TO_KR: Record<string, string> = {
  '子': '자', '丑': '축',
  '寅': '인', '卯': '묘',
  '辰': '진', '巳': '사',
  '午': '오', '未': '미',
  '申': '신', '酉': '유',
  '戌': '술', '亥': '해',
};

/**
 * 천간+지지 쌍을 오행·한글 정보와 함께 반환하는 헬퍼
 */
function parsePillar(gan: string, zhi: string) {
  return {
    gan,                              // 천간 한자 (예: 壬)
    zhi,                              // 지지 한자 (예: 申)
    ganKr: GAN_TO_KR[gan] || gan,     // 천간 한글 (예: 임)
    zhiKr: ZHI_TO_KR[zhi] || zhi,     // 지지 한글 (예: 신)
    element: GAN_TO_ELEMENT[gan],      // 오행 (예: 수)
    text: `${gan}${zhi}`,             // 합쳐진 형태 (예: 壬申)
    textKr: `${GAN_TO_KR[gan]}${ZHI_TO_KR[zhi]}`, // 한글 (예: 임신)
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { birthDate, gender = 'male' } = body;

    if (!birthDate) {
      return NextResponse.json({ error: '생년월일이 필요합니다.' }, { status: 400 });
    }

    // "1992-02-21" → [1992, 2, 21]
    const [year, month, day] = birthDate.split('-').map(Number);

    if (!year || !month || !day) {
      return NextResponse.json({ error: '날짜 형식 오류 (YYYY-MM-DD)' }, { status: 400 });
    }

    // ── 양력 → 음력 → 사주 계산 ──
    // 시간은 0시 고정 (시주 계산에 사용)
    const solar = Solar.fromYmdHms(year, month, day, 0, 0, 0);
    const lunar = solar.getLunar();
    const eightChar = lunar.getEightChar();

    // ── 사주 팔자 (시·일·월·년) ──
    const saju = {
      // 시주 (태어난 시간 기준 — 0시 고정)
      timePillar: parsePillar(eightChar.getTimeGan(), eightChar.getTimeZhi()),
      // 일주 (= "나" 자신, 사주에서 가장 중요)
      dayPillar: parsePillar(eightChar.getDayGan(), eightChar.getDayZhi()),
      // 월주
      monthPillar: parsePillar(eightChar.getMonthGan(), eightChar.getMonthZhi()),
      // 년주
      yearPillar: parsePillar(eightChar.getYearGan(), eightChar.getYearZhi()),
    };

    // ── 오행 분포 (천간 기준) ──
    const allElements = [
      saju.yearPillar.element,
      saju.monthPillar.element,
      saju.dayPillar.element,
      saju.timePillar.element,
    ];
    const elementCount: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    allElements.forEach((el) => { if (el) elementCount[el]++; });

    // ── 음력 정보 ──
    const lunarInfo = {
      year: lunar.getYear(),
      month: lunar.getMonth(),
      day: lunar.getDay(),
      yearChinese: lunar.getYearInChinese(),
      monthChinese: lunar.getMonthInChinese(),
      dayChinese: lunar.getDayInChinese(),
      isLeap: lunar.getMonth() < 0, // 윤달 여부
    };

    // ── 대운 계산 ──
    // gender: 1 = 남자, 0 = 여자 (lunar-typescript 규칙)
    const genderCode = gender === 'male' ? 1 : 0;
    const yun = eightChar.getYun(genderCode);
    const daYunList = yun.getDaYun();

    // 현재 나이 계산
    const now = new Date();
    const currentAge = now.getFullYear() - year;

    // 대운 목록 생성
    const daYuns = daYunList.map((d: { getStartAge: () => number; getGanZhi: () => string }) => {
      const ganZhi = d.getGanZhi();
      const gan = ganZhi ? ganZhi[0] : '';
      const zhi = ganZhi ? ganZhi[1] : '';
      return {
        startAge: d.getStartAge(),        // 시작 나이
        ganZhi: ganZhi || '',              // 간지 (예: 丙午)
        gan,
        zhi,
        element: GAN_TO_ELEMENT[gan] || '',
      };
    }).filter((d: { ganZhi: string }) => d.ganZhi); // 빈 값 제거

    // 현재 대운 찾기 (나이 기준)
    let currentDaYun = null;
    for (let i = daYuns.length - 1; i >= 0; i--) {
      if (currentAge >= daYuns[i].startAge) {
        currentDaYun = daYuns[i];
        break;
      }
    }

    const yunInfo = {
      startYear: yun.getStartYear(),     // 대운 시작 년
      startMonth: yun.getStartMonth(),   // 대운 시작 월
      startDay: yun.getStartDay(),       // 대운 시작 일
      currentAge,                         // 현재 나이
      currentDaYun,                       // 현재 대운
      daYuns,                             // 전체 대운 목록
    };

    return NextResponse.json({
      saju,
      elementCount,
      lunar: lunarInfo,
      yun: yunInfo,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
