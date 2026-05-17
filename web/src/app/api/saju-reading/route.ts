/**
 * 사주 해석 + 캐릭터 원재료 생성 API
 *
 * 생년월일 + 성별 → 만세력 계산 → GPT-4.1로 사주 해석 + 동물/색상/특성 추출
 * structured output(JSON)으로 반환해서 프론트에서 알 3개 조합에 사용.
 *
 * POST /api/saju-reading
 * Body: { "birthDate": "1992-02-21", "gender": "male" }
 */

import { NextResponse } from 'next/server';
import { Solar } from 'lunar-typescript';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 한글 매핑 테이블 ──

const GAN_KR: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정',
  '戊': '무', '己': '기', '庚': '경', '辛': '신',
  '壬': '임', '癸': '계',
};
const ZHI_KR: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘',
  '辰': '진', '巳': '사', '午': '오', '未': '미',
  '申': '신', '酉': '유', '戌': '술', '亥': '해',
};

// ── Zod 스키마: LLM이 반환할 JSON 구조 ──

/** 동물 1개의 구조 */
const AnimalSchema = z.object({
  name: z.string().describe('동물 이름 (한국어, 예: 여우, 수달, 올빼미)'),
  reasoning: z.string().describe('왜 이 동물이 이 사주와 닮았는지 상세 설명 (3문장 이상)'),
});

/** 보조 특성 1개의 구조 */
const TraitSchema = z.object({
  source: z.string().describe('이 특성의 근거가 된 신살/결핍 (예: 도화, 귀문, 역마)'),
  appearance: z.string().describe('외형적 특성 (예: 빛나는 꼬리, 야행성 눈동자)'),
  behavior: z.string().describe('감정/상황에 따른 생태적 변화 (예: 긴장하면 털색 변함)'),
});

/** 색상 1개의 구조 */
const ColorSchema = z.object({
  hex: z.string().describe('hex 코드 (예: #1976D2)'),
  name: z.string().describe('색상 이름 (한국어, 예: 딥 아쿠아 블루)'),
  reasoning: z.string().describe('왜 이 색인지 오행/기질/납음 근거 설명'),
});

/** 전체 응답 스키마 */
const SajuReadingSchema = z.object({
  /** 1단계: 성격 분석 */
  personality: z.string().describe('핵심 성격 분석. 감정 구조와 행동 습관 중심. 5문장 이상.'),

  /** 2단계: 성향 분석 */
  tendency: z.string().describe('대인관계, 감정 표현, 스트레스 반응, 외로움 패턴. 5문장 이상.'),

  /** 3단계: 결핍/신살 */
  deficiency: z.string().describe('오행 과부족 + 신살(도화/역마/귀문/화개 등) 분석. 각 신살이 행동에 주는 영향.'),

  /** 4단계: 신기와 귀문 */
  spiritual: z.string().describe('영감/직관이 열리는 시기, 귀문이 열리는 나이대와 의미.'),

  /** 5단계: 추천 실존 동물 3마리 */
  animals: z.array(AnimalSchema).length(3).describe('성격/성향에 어울리는 실존 동물 3마리. 전투형이 아니라 성격이 보이는 동물.'),

  /** 6단계: 판타지/전설 동물 1마리 */
  fantasyAnimal: AnimalSchema.describe('위 3마리와 별개로, 사주 전체 에너지에 어울리는 판타지/전설 동물 1마리.'),

  /** 7단계: 보조 특성 (신살 기반) */
  traits: z.array(TraitSchema).min(3).max(5).describe('신살/결핍에서 파생되는 외형+생태적 특성 3~5개.'),

  /** 8단계: 색상 3개 */
  colors: z.array(ColorSchema).length(3).describe('메인 색, 보조 색, 포인트 색. 오행/기질/납음 근거.'),
});

export async function POST(request: Request) {
  try {
    const { birthDate, gender = 'male', nickname = '', birthHour = 0 } = await request.json();

    if (!birthDate) {
      return NextResponse.json({ error: '생년월일 필요' }, { status: 400 });
    }

    const [year, month, day] = birthDate.split('-').map(Number);

    // ── 만세력 계산 (가입 시각 = 태어난 시간) ──
    const hour = Math.max(0, Math.min(23, Number(birthHour) || 0));
    const solar = Solar.fromYmdHms(year, month, day, hour, 0, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();

    // 사주 팔자
    const pillar = (gan: string, zhi: string) =>
      `${gan}${zhi} (${GAN_KR[gan]}${ZHI_KR[zhi]})`;

    // 대운
    const genderCode = gender === 'male' ? 1 : 0;
    const yun = ec.getYun(genderCode);
    const daYunList = yun.getDaYun();
    const currentAge = new Date().getFullYear() - year;

    const daYuns = daYunList
      .map((d: { getStartAge: () => number; getGanZhi: () => string }) => ({
        age: d.getStartAge(),
        ganZhi: d.getGanZhi(),
      }))
      .filter((d: { ganZhi: string }) => d.ganZhi);

    // ── GPT에 보낼 만세력 텍스트 ──
    const sajuText = `
닉네임: ${nickname || '미정'}
성별: ${gender === 'male' ? '남자' : '여자'}
양력: ${year}년 ${month}월 ${day}일
음력: ${lunar.getYearInChinese()}년 ${lunar.getMonthInChinese()}월 ${lunar.getDayInChinese()}일

[사주 팔자]
시주: ${pillar(ec.getTimeGan(), ec.getTimeZhi())}
일주: ${pillar(ec.getDayGan(), ec.getDayZhi())}
월주: ${pillar(ec.getMonthGan(), ec.getMonthZhi())}
년주: ${pillar(ec.getYearGan(), ec.getYearZhi())}

[오행]
시: ${ec.getTimeWuXing()} | 일: ${ec.getDayWuXing()} | 월: ${ec.getMonthWuXing()} | 년: ${ec.getYearWuXing()}

[십신]
년간: ${ec.getYearShiShenGan()} | 년지: ${JSON.stringify(ec.getYearShiShenZhi())}
월간: ${ec.getMonthShiShenGan()} | 월지: ${JSON.stringify(ec.getMonthShiShenZhi())}
일지: ${JSON.stringify(ec.getDayShiShenZhi())}
시간: ${ec.getTimeShiShenGan()} | 시지: ${JSON.stringify(ec.getTimeShiShenZhi())}

[지장간]
년: ${JSON.stringify(ec.getYearHideGan())} | 월: ${JSON.stringify(ec.getMonthHideGan())}
일: ${JSON.stringify(ec.getDayHideGan())} | 시: ${JSON.stringify(ec.getTimeHideGan())}

[십이운성]
년: ${ec.getYearDiShi()} | 월: ${ec.getMonthDiShi()} | 일: ${ec.getDayDiShi()} | 시: ${ec.getTimeDiShi()}

[납음]
년: ${ec.getYearNaYin()} | 월: ${ec.getMonthNaYin()} | 일: ${ec.getDayNaYin()} | 시: ${ec.getTimeNaYin()}

[신살]
길신: ${JSON.stringify(lunar.getDayJiShen())}
흉살: ${JSON.stringify(lunar.getDayXiongSha())}

[생초]
년: ${lunar.getYearShengXiao()} | 월: ${lunar.getMonthShengXiao()} | 일: ${lunar.getDayShengXiao()} | 시: ${lunar.getTimeShengXiao()}

[태원·명궁·신궁]
태원: ${ec.getTaiYuan()} ${ec.getTaiYuanNaYin()}
명궁: ${ec.getMingGong()} ${ec.getMingGongNaYin()}
신궁: ${ec.getShenGong()} ${ec.getShenGongNaYin()}

[공망]
년: ${ec.getYearXunKong()} | 일: ${ec.getDayXunKong()}

[대운] (현재 ${currentAge}세)
${daYuns.map((d: { age: number; ganZhi: string }) => `${d.age}세: ${d.ganZhi}`).join(' | ')}
`.trim();

    // ── GPT-4.1 호출 (structured output) ──
    const response = await openai.chat.completions.parse({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `너는 사주명리학 전문가이자 판타지 크리쳐 디자이너다.
만세력 데이터를 받으면 8단계로 분석해서 JSON으로 반환해라.

핵심 원칙:
- "전투형 몬스터"가 아니라 "성격이 보이는 동물"로 추천할 것.
- 감정 구조, 행동 습관, 에너지 패턴이 닮은 동물을 골라라.
- 예: 여우(매력, 감정성, 외로움), 수달(관계 의존, 물 기운), 올빼미(야행성, 직관)
- 디지몬보다는 포켓몬, 비스트스타즈, 치이카와 감성.

동물 선택 규칙:
- animals(실존 동물 3마리): 각각 서로 다른 성격 측면을 대표. 겹치지 않게.
- fantasyAnimal(판타지 1마리): animals 3마리와 독립적으로, 사주 전체 에너지에서 도출. animals를 합치지 말 것.
- 4마리 모두 서로 다른 동물이어야 함.

보조 특성 규칙:
- 신살/결핍에서 파생되는 구체적 외형 + 감정 반응형 생태적 변화.
- 추상적이지 않고, 이미지로 그릴 수 있을 만큼 구체적으로.

색상 규칙:
- 오행 균형, 납음, 기질에서 도출. 3개 모두 hex 코드 포함.
- 메인 색(가장 넓은 면적), 보조 색(중간), 포인트 색(작은 강조).`,
        },
        {
          role: 'user',
          content: sajuText,
        },
      ],
      response_format: zodResponseFormat(SajuReadingSchema, 'saju_reading'),
    });

    // 파싱된 JSON 결과
    const reading = response.choices[0].message.parsed;

    return NextResponse.json({
      sajuRaw: sajuText,
      reading,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
