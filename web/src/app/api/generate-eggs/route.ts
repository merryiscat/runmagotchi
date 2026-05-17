/**
 * 알 이미지 3장 생성 API
 *
 * 사주 분석 결과(동물 4마리 + 색상 3개 + 보조 특성)를 받아서
 * 동물 2마리 조합 3개를 랜덤으로 뽑고, 각 조합에 맞는 알 이미지를 gpt-image-2로 생성.
 *
 * POST /api/generate-eggs
 * Body: { reading: { animals, fantasyAnimal, colors, traits } }
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { removeWhiteBg } from '@/lib/remove-bg';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** 배열에서 랜덤 n개 */
function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

/** 동물 조합 생성: 단독(4) + 2마리(6) + 3마리(4) = 14개 중 3개 선택 */
function makeAnimalCombos(animals: { name: string; reasoning: string }[], fantasy: { name: string; reasoning: string }) {
  const all = [...animals, fantasy]; // a, b, c, d
  const combos: string[][] = [];

  // 단독 (4개): {a}, {b}, {c}, {d}
  for (const a of all) combos.push([a.name]);

  // 2마리 (6개): {a,b}, {a,c}, ...
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      combos.push([all[i].name, all[j].name]);

  // 3마리 (4개): {a,b,c}, {a,b,d}, {a,c,d}, {b,c,d}
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      for (let k = j + 1; k < all.length; k++)
        combos.push([all[i].name, all[j].name, all[k].name]);

  // 14개 중 랜덤 3개
  return pickRandom(combos, 3);
}

/** 색상 조합: 1색, 2색, 3색 중 하나씩 배정 */
function makeColorSets(colors: { hex: string; name: string }[]): string[][] {
  const [a, b, c] = colors;
  const allSets = [
    [a.hex], [b.hex], [c.hex],
    [a.hex, b.hex], [a.hex, c.hex], [b.hex, c.hex],
    [a.hex, b.hex, c.hex],
  ];
  return pickRandom(allSets, 3);
}

/** 색상 배열 → 프롬프트 텍스트 */
function colorsToText(hexes: string[]): string {
  if (hexes.length === 1) return `All pattern elements are colored in ${hexes[0]}.`;
  if (hexes.length === 2) return `Pattern elements alternate between ${hexes[0]} and ${hexes[1]}.`;
  return `Pattern elements cycle through: ${hexes[0]}, ${hexes[1]}, ${hexes[2]}.`;
}

/** 기하학 무늬 목록 */
const PATTERNS = [
  'large circles (polka dots)', 'five-pointed stars', 'horizontal stripes',
  'hearts', 'small triangles', 'vertical stripes',
  'zigzag chevron lines', 'diamonds (rhombus)', 'hexagons',
  'squares in a grid', 'crosses (plus signs)', 'concentric rings',
  'arrow shapes', 'crescent moon shapes', 'pentagon shapes',
  'oval dots', 'starburst shapes', 'checkerboard pattern',
  'confetti rectangles', 'small circles and triangles mixed',
];

export async function POST(request: Request) {
  try {
    const { reading } = await request.json();

    if (!reading?.animals || !reading?.fantasyAnimal || !reading?.colors) {
      return NextResponse.json({ error: '분석 데이터 필요' }, { status: 400 });
    }

    // ── 동물 조합 3개 ──
    const combos = makeAnimalCombos(reading.animals, reading.fantasyAnimal);

    // ── 색상 조합 3개 ──
    const colorSets = makeColorSets(reading.colors);

    // ── 무늬 3개 ──
    const patterns = pickRandom(PATTERNS, 3);

    // ── 3장 병렬 생성 ──
    const promises = combos.map((combo, i) => {
      const colorText = colorsToText(colorSets[i]);

      const animalDesc = combos[i].join(' and ');
      const prompt = `A simple monster egg sprite. Cute and round shape. Natural organic eggshell texture.
Minimal detail. ${patterns[i]} pattern on the shell.
${colorText}
The pattern hints at a creature inspired by ${animalDesc}.
Spots and stripes design mixed naturally into the shell.
Clear readable silhouette. Single egg, centered.
White background. No text, no face, no limbs. Just the egg.`;

      return openai.images.generate({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
      });
    });

    const results = await Promise.all(promises);

    // ── 배경 제거 + 결과 조합 ──
    // 알 이미지는 몸통이 밝으므로 threshold 높게 (248: 거의 순백만 제거)
    const eggs = await Promise.all(results.map(async (res, i) => ({
      image: await removeWhiteBg(res.data[0].b64_json as string, 248),
      combo: combos[i],       // string[] (동물 이름 배열)
      pattern: patterns[i],
      colors: colorSets[i],
    })));

    return NextResponse.json({ eggs });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
