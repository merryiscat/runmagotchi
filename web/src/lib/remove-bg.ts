/**
 * 흰 배경 제거 유틸
 *
 * sharp를 사용해서 흰색(#FFFFFF)에 가까운 픽셀을 투명으로 변환.
 * AI 기반 배경 제거가 아니라 색상 임계값 기반이므로 빠르고 가벼움.
 *
 * 사용법:
 *   const transparentBuffer = await removeWhiteBg(base64String);
 */

import sharp from 'sharp';

/**
 * base64 이미지에서 흰 배경을 투명으로 변환
 *
 * @param base64 - base64 인코딩된 PNG 이미지
 * @param threshold - 흰색 판정 임계값 (0~255). 기본 240. 이 값 이상이면 투명 처리
 * @returns 투명 배경이 적용된 PNG의 base64 문자열
 */
export async function removeWhiteBg(base64: string, threshold = 240): Promise<string> {
  // base64 → Buffer
  const inputBuffer = Buffer.from(base64, 'base64');

  // raw 픽셀 데이터로 변환 (RGBA)
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()          // alpha 채널 보장
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);

  // 각 픽셀 순회: R, G, B 모두 threshold 이상이면 alpha를 0으로
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    if (r >= threshold && g >= threshold && b >= threshold) {
      pixels[i + 3] = 0; // alpha = 0 (투명)
    }
  }

  // 다시 PNG로 변환
  const outputBuffer = await sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  return outputBuffer.toString('base64');
}
