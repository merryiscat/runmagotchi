/**
 * 아이콘 생성 스크립트
 *
 * OpenAI gpt-image-1으로 Runmagotchi 디자인 시스템에 맞는
 * 단색 라인 아이콘을 생성한다.
 *
 * === 사용법 ===
 *
 * 단일 아이콘 생성:
 *   node scripts/gen-icon.mjs --name "upload" --desc "an upward arrow emerging from a tray"
 *
 * 옵션:
 *   --name      파일명 (확장자 제외, 필수)
 *   --desc      아이콘 설명 (영어, 필수)
 *   --size      출력 크기 px (기본 24, 선택: 24/48/64)
 *   --variants  후보 개수 (기본 3, 최대 5)
 *
 * 배치 생성:
 *   node scripts/gen-icon.mjs --batch icons.json
 *
 *   icons.json 형식:
 *   [
 *     { "name": "upload", "desc": "an upward arrow emerging from a tray" },
 *     { "name": "run",    "desc": "a running person in side profile" }
 *   ]
 *
 * 결과:
 *   public/icons/{name}-1.png, {name}-2.png, {name}-3.png (후보)
 *   → 사용자가 선택 후 최종 파일명 {name}.png으로 변경
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

// ─── .env.local 파싱 (dotenv ESM 호환 문제 우회) ───
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
} catch {
  // .env.local 없으면 환경변수에서 직접 읽음
}

import OpenAI from 'openai';
import sharp from 'sharp';

// ─── 경로 설정 ───
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── OpenAI 클라이언트 ───
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── CLI 인자 파싱 ───
const { values: args } = parseArgs({
  options: {
    name:     { type: 'string' },              // 파일명
    desc:     { type: 'string' },              // 아이콘 설명 (영어)
    size:     { type: 'string', default: '24' }, // 출력 크기
    variants: { type: 'string', default: '3' },  // 후보 개수
    batch:    { type: 'string' },              // 배치 JSON 파일 경로
  },
  strict: true,
});

/**
 * 디자인 시스템에 맞는 아이콘 프롬프트 생성
 *
 * Runmagotchi 아이콘 규칙:
 * - Lucide 스타일 (1.5px stroke, no fill, square corners)
 * - 단색 (#1A1A1A) on 투명 배경
 * - 그림자/그라데이션/3D 금지
 */
function buildPrompt(desc, size) {
  return `A minimal line icon for a mobile app UI.

Style rules (STRICT):
- Single-weight stroke only (1.5px equivalent at 24px scale). No filled shapes.
- Square line caps and square line joins. No rounded ends.
- Pure black color (#1A1A1A) lines on a completely transparent/empty background.
- Canvas: ${size}x${size} pixels with ~12% padding on all sides.
- No rounded corners on any shape.
- No shadows, no gradients, no glow, no 3D effects, no perspective.
- No decorative elements. Pure geometric construction.
- Must be instantly recognizable at 24x24px.

Subject: ${desc}

Output: a single clean icon, centered, on transparent background. Nothing else in the image.`;
}

/**
 * 아이콘 1장 생성
 *
 * gpt-image-1에 프롬프트를 보내고 결과를 PNG로 저장한다.
 * API가 투명 배경을 지원하므로 output_format: 'png' 사용.
 */
async function generateIcon(name, desc, size, variantIndex) {
  const prompt = buildPrompt(desc, size);

  // 파일명: 후보 번호 붙임 (예: upload-1.png)
  const fileName = `${name}-${variantIndex}.png`;
  console.log(`  생성 중: ${fileName} ...`);

  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',         // 큰 사이즈로 생성 후 축소가 더 선명
    output_format: 'png',      // 투명 배경 지원
  });

  // base64 → Buffer
  const imageData = response.data[0].b64_json;
  const rawBuffer = Buffer.from(imageData, 'base64');

  // 배경 제거: 밝은 배경(#F0F0F0 이상)을 투명으로 변환
  const filePath = join(OUTPUT_DIR, fileName);
  const { data: pixels, info } = await sharp(rawBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 각 픽셀 순회 — 밝은 배경색을 투명으로 처리
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    // 밝은 회색~흰색 배경 (#F0F0F0 이상) → 투명
    if (r >= 235 && g >= 235 && b >= 235) {
      pixels[i + 3] = 0; // alpha = 0
    }
  }

  await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(filePath);

  console.log(`  저장됨 (배경 제거): ${filePath}`);

  return filePath;
}

/**
 * 재시도 래퍼 (API 일시 오류 대비)
 *
 * 최대 2번 재시도, 3초 간격.
 */
async function withRetry(fn, label, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`  경고: ${label} 실패, 3초 후 재시도... (${err.message})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * 단일 아이콘의 후보 N개 생성
 */
async function generateIconSet(name, desc, size, variantCount) {
  console.log(`\n아이콘: ${name} (${desc})`);
  console.log(`  크기: ${size}px / 후보: ${variantCount}개\n`);

  const paths = [];

  for (let i = 1; i <= variantCount; i++) {
    const path = await withRetry(
      () => generateIcon(name, desc, size, i),
      `${name}-${i}`
    );
    paths.push(path);

    // API rate limit 방지: 1초 대기
    if (i < variantCount) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return paths;
}

/**
 * 메인 실행
 *
 * --batch 모드: JSON 파일에서 여러 아이콘을 순차 생성
 * 단일 모드: --name, --desc로 하나의 아이콘 생성
 */
async function main() {
  console.log('=== Runmagotchi 아이콘 생성기 ===\n');

  // 배치 모드
  if (args.batch) {
    const batchPath = resolve(process.cwd(), args.batch);
    const icons = JSON.parse(readFileSync(batchPath, 'utf8'));
    const size = parseInt(args.size, 10);
    const variants = Math.min(parseInt(args.variants, 10), 5);

    console.log(`배치 모드: ${icons.length}개 아이콘 생성\n`);

    for (const icon of icons) {
      await generateIconSet(
        icon.name,
        icon.desc,
        icon.size || size,
        icon.variants || variants
      );
    }

    console.log(`\n완료! ${icons.length}개 아이콘 생성됨`);
    console.log(`  경로: ${OUTPUT_DIR}/`);
    return;
  }

  // 단일 모드 — 필수 인자 체크
  if (!args.name || !args.desc) {
    console.error('사용법:');
    console.error('  node scripts/gen-icon.mjs --name "upload" --desc "an upward arrow emerging from a tray"');
    console.error('  node scripts/gen-icon.mjs --batch icons.json');
    console.error('\n옵션:');
    console.error('  --name      파일명 (필수)');
    console.error('  --desc      아이콘 설명, 영어 (필수)');
    console.error('  --size      출력 크기 px (기본 24)');
    console.error('  --variants  후보 개수 (기본 3, 최대 5)');
    process.exit(1);
  }

  const size = parseInt(args.size, 10);
  const variants = Math.min(parseInt(args.variants, 10), 5);

  const paths = await generateIconSet(args.name, args.desc, size, variants);

  console.log(`\n완료! 후보 ${paths.length}개 생성됨`);
  console.log(`  경로: ${OUTPUT_DIR}/`);
  console.log(`\n선택 후 최종 파일: ${OUTPUT_DIR}/${args.name}.png`);
}

main().catch(err => {
  console.error(`에러: ${err.message}`);
  process.exit(1);
});
