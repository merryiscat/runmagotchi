/**
 * 캐릭터 이미지 생성 API (4단계 순차)
 *
 * 1단계: baby illust + final illust 병렬 생성
 * 2단계: baby illust → 도트 변환 (pixel_idle)
 * 3단계: pixel_idle 참조 → bounce1~4 (폴짝폴짝 뛰는 애니메이션)
 * 4단계: pixel_idle 참조 → 행동 모션 5종 (happy/hungry/sad/joyful/aegyo)
 *
 * service_role 키로 RLS 우회. Storage + DB 직접 저장.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
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

    /* ══ 0단계: 5단계 외형 묘사 사전 생성 (GPT-4.1, 텍스트) ══ */
    console.log(`[generate-character] 0단계: 5단계 묘사 텍스트 생성...`);

    const StageDescSchema = z.object({
      baby: z.string().describe('Stage 1 Baby: 2-3 sentences describing visual appearance in English'),
      child: z.string().describe('Stage 2 Child: 2-3 sentences, slightly bigger, more defined features'),
      teen: z.string().describe('Stage 3 Teen: 2-3 sentences, adolescent, confident, developing strength'),
      adult: z.string().describe('Stage 4 Adult: 2-3 sentences, mature, powerful, all features developed'),
      final: z.string().describe('Stage 5 Final: 2-3 sentences, ultimate form, majestic, awe-inspiring'),
    });

    const descResponse = await openai.chat.completions.parse({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: `You are a character designer. Given a fantasy creature concept, write visual descriptions for 5 growth stages. Each stage builds on the previous — the character must feel like the SAME creature growing up. Describe: body shape, size, face expression, colors, special markings, accessories/features that appear or grow. Write in English. Be specific and visual.`,
        },
        {
          role: 'user',
          content: `Creature: ${creature}
${colorText}
${traitText}
${personality ? `Personality: ${personality}` : ''}

Write 5 growth stage descriptions. Each must clearly evolve from the previous while keeping the same identity (same face, same base colors, same core features).`,
        },
      ],
      response_format: zodResponseFormat(StageDescSchema, 'stage_descriptions'),
    });

    const stageDescriptions = descResponse.choices[0].message.parsed;

    /* DB에 묘사 텍스트 저장 */
    if (stageDescriptions) {
      await supabase.from('characters')
        .update({ stage_descriptions: stageDescriptions })
        .eq('id', characterId);
      console.log(`[generate-character] 묘사 텍스트 저장 완료`);
    }

    /* 묘사를 일러스트 프롬프트에 활용 */
    const babyDesc = stageDescriptions?.baby || '';
    const finalDesc = stageDescriptions?.final || '';

    /* ══ 1단계: baby illust + final illust 병렬 ══ */
    console.log(`[generate-character] 1단계: 일러스트 2장 생성...`);

    const [babyRes, finalRes] = await Promise.all([
      generateWithRetry({
        model: 'gpt-image-2', n: 1, size: '1024x1024',
        prompt: `${stageGuide}
Draw STAGE 1 (Baby) — the very first newborn form.
${creature}.
Visual description: ${babyDesc || 'Extremely tiny, round, blobby. Barely any limbs. Like a newborn chick or tadpole. Very simple, very cute.'}
${commonStyle}`,
      }),
      generateWithRetry({
        model: 'gpt-image-2', n: 1, size: '1024x1024',
        prompt: `${stageGuide}
Draw STAGE 5 (Final) — the ultimate fully evolved form.
${creature}.
Visual description: ${finalDesc || 'Fully grown, powerful, majestic, all features maximized.'}
${personality ? `Personality: ${personality}.` : ''}
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
      { type: 'pixel_move1', prompt: 'Edit this pixel art sprite: squash the character down slightly — crouching, preparing to jump. Body compressed shorter and wider. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_move2', prompt: 'Edit this pixel art sprite: character is jumping up in the air — legs tucked under body, stretched upward. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_move3', prompt: 'Edit this pixel art sprite: character at the peak of a jump — body slightly stretched vertically, floating at highest point. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_move4', prompt: 'Edit this pixel art sprite: character landing from a jump — body squashed down on impact, slightly wider. Keep same character, same colors, same pixel style. White background.' },
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

    console.log(`[generate-character] 4단계: 행동 모션 5종 × 4프레임 생성...`);

    /* ══ 4단계: pixel_idle 참조 → 행동별 4프레임 애니메이션 ══ */
    const behaviorSets = [
      {
        name: 'happy', base: 'character looks happy and content — soft smiling eyes, gentle smile, relaxed cheerful posture',
        frames: [
          'slight smile, body relaxed, neutral happy pose',
          'bigger smile, body tilting slightly, starting to bounce',
          'full smile, eyes closed happily, body at peak of gentle bounce',
          'returning to relaxed smile, body settling back down',
        ],
      },
      {
        name: 'hungry', base: 'character looks hungry and tired — droopy eyes, body slouching',
        frames: [
          'eyes half-closed, body slightly slouched, tired pose',
          'eyes drooping more, mouth slightly open, leaning forward',
          'eyes nearly closed, body sagging down, very tired',
          'slight head bob, trying to stay awake, wobbling',
        ],
      },
      {
        name: 'sad', base: 'character looks sad and lonely — eyes looking down, body hunched',
        frames: [
          'eyes looking down, small frown, body slightly hunched',
          'head drooping lower, body curling inward',
          'most curled up, eyes nearly closed with sadness',
          'slight shiver, body still hunched, subtle movement',
        ],
      },
      {
        name: 'joyful', base: 'character is extremely excited and celebrating — jumping with joy',
        frames: [
          'crouching down, preparing to jump, excited face',
          'jumping up, arms/limbs raised, mouth open laughing',
          'at peak of jump, body stretched, eyes sparkling wide',
          'landing back down, still laughing, bouncy impact',
        ],
      },
      {
        name: 'aegyo', base: 'character acting cute and affectionate — head tilted, puppy eyes',
        frames: [
          'head tilting to one side, big round eyes, slight blush',
          'leaning forward cutely, eyes even bigger, playful pose',
          'head tilted other direction, little bounce, adorable expression',
          'settling back, eyes still big, gentle sway',
        ],
      },
    ];

    for (const beh of behaviorSets) {
      for (let i = 0; i < beh.frames.length; i++) {
        const type = `pixel_${beh.name}${i + 1}`;
        try {
          console.log(`[generate-character] 생성: ${type}`);
          const res = await editWithRetry({
            model: 'gpt-image-2',
            image: new File([idleBuffer], 'idle.png', { type: 'image/png' }),
            prompt: `Edit this pixel art sprite: ${beh.base}. Frame ${i + 1} of 4: ${beh.frames[i]}. Keep same character, same colors, same pixel style. White background.`,
            n: 1, size: '1024x1024',
          });
          await saveImage(res.data[0].b64_json as string, userId, characterId, 'baby', type, 235);
        } catch (err) {
          console.error(`[generate-character] ${type} 실패:`, err instanceof Error ? err.message : err);
        }
      }
    }

    // 성공 → 상태 업데이트
    await supabase.from('characters').update({ image_status: 'done' }).eq('id', characterId);
    console.log(`[generate-character] 모든 이미지 생성 완료! (일러스트 2 + idle 1 + bounce 4 + 행동 5×4 = 27장)`);
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
