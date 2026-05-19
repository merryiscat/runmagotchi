/**
 * 캐릭터 이미지 생성 API (3단계 순차)
 *
 * 1단계: baby illust + final illust 병렬 생성
 * 2단계: baby illust → 도트 변환 (pixel_idle)
 * 3단계: pixel_idle 참조 → bounce1~4 (폴짝폴짝 뛰는 애니메이션)
 *
 * service_role 키로 RLS 우회. Storage + DB 직접 저장.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { removeWhiteBg } from '@/lib/remove-bg';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** 이미지 응답 타입 (b64_json 포함) */
type ImageResult = { data: { b64_json?: string }[] };

/** 이미지 생성 + 1회 재시도 */
async function generateWithRetry(params: Parameters<typeof openai.images.generate>[0]): Promise<ImageResult> {
  try { return await openai.images.generate(params) as ImageResult; }
  catch { await new Promise(r => setTimeout(r, 3000)); return await openai.images.generate(params) as ImageResult; }
}

/** 이미지 편집 + 1회 재시도 */
async function editWithRetry(params: Parameters<typeof openai.images.edit>[0]): Promise<ImageResult> {
  try { return await openai.images.edit(params) as ImageResult; }
  catch { await new Promise(r => setTimeout(r, 3000)); return await openai.images.edit(params) as ImageResult; }
}

/** 배경 제거 → Storage 업로드 → DB 저장 */
async function saveImage(
  b64: string, userId: string, characterId: string,
  stage: string, type: string, threshold = 240
) {
  const cleaned = await removeWhiteBg(b64, threshold);
  const ts = Date.now();
  const fileName = `${userId}/${stage}-${type}-${ts}.png`;

  await supabase.storage.from('eggs')
    .upload(fileName, Buffer.from(cleaned, 'base64'), { contentType: 'image/png', upsert: true });
  const { data: urlData } = supabase.storage.from('eggs').getPublicUrl(fileName);

  const { error } = await supabase.from('character_images').insert({
    character_id: characterId, stage, type,
    url: urlData.publicUrl, frame_count: 1, cols: 1, rows: 1,
  });
  if (error) console.error(`[save] DB 실패 (${stage}-${type}):`, error.message);
  else console.log(`[save] ${stage}-${type} 저장 완료`);

  return cleaned;
}

export async function POST(request: Request) {
  try {
    const { combo, colors, traits, personality, userId, characterId } = await request.json();
    if (!combo || !Array.isArray(combo) || combo.length === 0 || !userId || !characterId) {
      return NextResponse.json({ error: '필수 데이터 누락' }, { status: 400 });
    }

    const colorText = colors?.length ? `Color palette: ${colors.join(', ')}.` : '';
    const traitText = traits?.length
      ? traits.map((t: { appearance: string }) => t.appearance).join('. ') + '.'
      : '';
    const creature = `a cute fantasy pet inspired by ${combo.join(' and ')}`;

    const stageGuide = `This character has 5 growth stages:
Stage 1 (Baby): Newborn, very tiny, simple round blob with tiny eyes. Minimal detail. Like a just-hatched chick.
Stage 5 (Final): Fully grown, majestic, all features at maximum. Impressive and powerful.`;

    const commonStyle = `Art style: soft watercolor illustration with clean lines.
Warm gentle colors. Rounded cute proportions. Studio Ghibli meets Pokemon feel.
${colorText} ${traitText}
White background. No text. Single character only.`;

    console.log(`[generate-character] 시작: ${combo[0]}+${combo[1] || ''}`);

    /* ══ 1단계: baby illust + final illust 병렬 ══ */
    console.log(`[generate-character] 1단계: 일러스트 2장 생성...`);

    const [babyRes, finalRes] = await Promise.all([
      generateWithRetry({
        model: 'gpt-image-2', n: 1, size: '1024x1024',
        prompt: `${stageGuide}
Draw STAGE 1 (Baby) — the very first newborn form.
${creature}. Extremely tiny, round, blobby. Barely any limbs. Like a newborn chick or tadpole. Very simple, very cute.
${commonStyle}`,
      }),
      generateWithRetry({
        model: 'gpt-image-2', n: 1, size: '1024x1024',
        prompt: `${stageGuide}
Draw STAGE 5 (Final) — the ultimate fully evolved form.
${creature}. Fully grown, powerful, majestic, all features maximized. ${personality ? `Personality: ${personality}.` : ''}
${commonStyle}`,
      }),
    ]);

    // 일러스트 저장
    const babyB64 = babyRes.data[0].b64_json as string;
    await saveImage(babyB64, userId, characterId, 'baby', 'illust', 248);
    await saveImage(finalRes.data[0].b64_json as string, userId, characterId, 'final', 'illust', 248);

    console.log(`[generate-character] 2단계: baby 일러스트 → 도트 변환...`);

    /* ══ 2단계: baby illust를 참조해서 도트(pixel_idle) 생성 ══ */
    const babyBuffer = Buffer.from(babyB64, 'base64');

    const idleRes = await editWithRetry({
      model: 'gpt-image-2',
      image: new File([babyBuffer], 'baby.png', { type: 'image/png' }),
      prompt: `Convert this character illustration to a 64x64 pixel art sprite.
Keep the same character design, same colors, same proportions.
Pixel art style: clean crisp pixel edges, no anti-aliasing, limited color palette.
Front-facing idle pose. Cute chunky pixels. Each pixel clearly visible.
White background. No text.`,
      n: 1, size: '1024x1024',
    });

    const idleB64 = idleRes.data[0].b64_json as string;
    await saveImage(idleB64, userId, characterId, 'baby', 'pixel_idle', 235);

    console.log(`[generate-character] 3단계: pixel_idle → 바운스 프레임 생성...`);

    /* ══ 3단계: pixel_idle 참조 → bounce1~4 (폴짝폴짝 뛰는 애니메이션) ══ */
    const idleBuffer = Buffer.from(idleB64, 'base64');

    const frames = [
      { type: 'pixel_bounce1', prompt: 'Edit this pixel art sprite: squash the character down slightly — crouching, preparing to jump. Body compressed shorter and wider. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_bounce2', prompt: 'Edit this pixel art sprite: character is jumping up in the air — legs tucked under body, stretched upward. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_bounce3', prompt: 'Edit this pixel art sprite: character at the peak of a jump — body slightly stretched vertically, floating at highest point. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_bounce4', prompt: 'Edit this pixel art sprite: character landing from a jump — body squashed down on impact, slightly wider. Keep same character, same colors, same pixel style. White background.' },
    ];

    for (const frame of frames) {
      try {
        console.log(`[generate-character] 생성: ${frame.type}`);
        const res = await editWithRetry({
          model: 'gpt-image-2',
          image: new File([idleBuffer], 'idle.png', { type: 'image/png' }),
          prompt: frame.prompt,
          n: 1, size: '1024x1024',
        });
        await saveImage(res.data[0].b64_json as string, userId, characterId, 'baby', frame.type, 235);
      } catch (err) {
        console.error(`[generate-character] ${frame.type} 실패:`, err instanceof Error ? err.message : err);
      }
    }

    // 성공 → 상태 업데이트
    await supabase.from('characters').update({ image_status: 'done' }).eq('id', characterId);
    console.log(`[generate-character] 모든 이미지 생성 완료!`);
    return NextResponse.json({ ok: true });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[generate-character] 치명적 에러:', msg);
    // 실패 → 상태 업데이트
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body.characterId) {
        await supabase.from('characters').update({ image_status: 'failed' }).eq('id', body.characterId);
      }
    } catch { /* ignore */ }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
