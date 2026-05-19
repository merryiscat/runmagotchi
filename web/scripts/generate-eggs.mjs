/**
 * 알 무늬 20종 이미지 생성 스크립트
 *
 * gpt-image-1로 흰색 배경 알에 각기 다른 무늬를 그린 이미지 20장 생성.
 * 무늬는 단색(회색)으로 그려서, 나중에 CSS로 사주 색상을 입힐 수 있게 함.
 *
 * 실행: node scripts/generate-eggs.mjs
 * 결과: public/eggs/pattern-01.png ~ pattern-20.png
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';

// .env.local 직접 파싱 (dotenv ESM 호환 문제 우회)
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
});
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'eggs');
mkdirSync(OUTPUT_DIR, { recursive: true });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** 20가지 무늬 정의 */
const PATTERNS = [
  { id: '01', name: 'polka-dots', desc: 'evenly spaced round polka dots' },
  { id: '02', name: 'stars', desc: 'small five-pointed stars scattered across' },
  { id: '03', name: 'waves', desc: 'horizontal wavy lines' },
  { id: '04', name: 'hearts', desc: 'small heart shapes scattered' },
  { id: '05', name: 'flowers', desc: 'simple daisy-like flowers' },
  { id: '06', name: 'triangles', desc: 'small triangles in a geometric pattern' },
  { id: '07', name: 'stripes', desc: 'vertical stripes' },
  { id: '08', name: 'chevron', desc: 'zigzag chevron lines' },
  { id: '09', name: 'diamonds', desc: 'small diamond shapes in a grid' },
  { id: '10', name: 'spirals', desc: 'small spiral swirl motifs' },
  { id: '11', name: 'crescents', desc: 'crescent moon shapes' },
  { id: '12', name: 'leaves', desc: 'small leaf shapes scattered' },
  { id: '13', name: 'clouds', desc: 'tiny cloud shapes' },
  { id: '14', name: 'lightning', desc: 'small lightning bolt shapes' },
  { id: '15', name: 'scales', desc: 'overlapping fish scale pattern' },
  { id: '16', name: 'confetti', desc: 'random small rectangles and squares like confetti' },
  { id: '17', name: 'crosshatch', desc: 'diagonal crosshatch lines' },
  { id: '18', name: 'paw-prints', desc: 'tiny animal paw print marks' },
  { id: '19', name: 'bubbles', desc: 'circles of varying sizes like bubbles' },
  { id: '20', name: 'feathers', desc: 'delicate feather shapes' },
];

/**
 * 알 이미지 1장 생성
 */
async function generateEgg(pattern) {
  const prompt = `A single egg on a pure white background, viewed from the front.
The egg is white/cream colored with a simple repeating pattern of ${pattern.desc} drawn in light gray (#AAAAAA) color.
The pattern covers the entire egg surface evenly.
Style: clean, minimal, cute, flat illustration. No shadow, no 3D effect, no text.
The egg shape is smooth and symmetrical like a real chicken egg.
High quality, centered, isolated on white.`;

  console.log(`  생성 중: ${pattern.id} ${pattern.name}...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
  });

  const imageData = response.data[0].b64_json;
  const filePath = join(OUTPUT_DIR, `pattern-${pattern.id}.png`);
  writeFileSync(filePath, Buffer.from(imageData, 'base64'));
  console.log(`  ✓ 저장: ${filePath}`);
}

/**
 * 재시도 래퍼 (API 실패 대비)
 */
async function withRetry(fn, label, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`  ⚠ ${label} 실패, ${3}초 후 재시도... (${err.message})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * 메인: 20장 순차 생성 (API rate limit 고려)
 */
async function main() {
  console.log(`🥚 알 무늬 20종 생성 시작\n`);

  for (const pattern of PATTERNS) {
    await withRetry(() => generateEgg(pattern), pattern.name);
    // API rate limit 방지: 1초 대기
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ 완료! ${PATTERNS.length}장 생성됨`);
  console.log(`   경로: ${OUTPUT_DIR}/pattern-01.png ~ pattern-20.png`);
}

main().catch(err => {
  console.error(`❌ 에러: ${err.message}`);
  process.exit(1);
});
