/**
 * 배경 제거 테스트
 * 기존 알 이미지(Storage)를 다운로드 → sharp로 흰 배경 제거 → 저장
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function removeWhiteBg(inputBuffer, threshold = 240) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  let removed = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (r >= threshold && g >= threshold && b >= threshold) {
      pixels[i + 3] = 0;
      removed++;
    }
  }

  console.log(`  픽셀 총: ${pixels.length / 4}, 제거: ${removed} (${(removed / (pixels.length / 4) * 100).toFixed(1)}%)`);

  const outputBuffer = await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  return outputBuffer;
}

// 기존 생성된 알 이미지로 테스트
const testFile = join(__dirname, '..', 'public', 'eggs', 'pattern-01.png');
try {
  const input = readFileSync(testFile);
  console.log('입력:', testFile, `(${(input.length / 1024).toFixed(0)}KB)`);

  const output = await removeWhiteBg(input);
  const outPath = join(__dirname, '..', 'public', 'eggs', 'pattern-01-nobg.png');
  writeFileSync(outPath, output);
  console.log('출력:', outPath, `(${(output.length / 1024).toFixed(0)}KB)`);
  console.log('✅ 성공');
} catch (e) {
  console.error('❌', e.message);
}
