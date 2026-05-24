/**
 * 진화 이미지 사전 생성 API
 *
 * POST /api/generate-evolution
 *
 * Lv 9/19/29/39 도달 시 호출.
 * 다음 단계의 일러스트 + 도트 idle + 행동 모션 4종을 백그라운드 생성.
 * 이전 단계 이미지 + 런닝 속성을 참조해서 진화 연속성 유지.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { removeWhiteBg } from '@/lib/remove-bg';
import { createClient } from '@supabase/supabase-js';
import { traitsToPromptFragment, type RunTraits } from '@/lib/run-traits';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ImageResult = { data: { b64_json?: string }[] };

async function generateWithRetry(params: Parameters<typeof openai.images.generate>[0]): Promise<ImageResult> {
  try { return await openai.images.generate(params) as ImageResult; }
  catch { await new Promise(r => setTimeout(r, 3000)); return await openai.images.generate(params) as ImageResult; }
}

async function editWithRetry(params: Parameters<typeof openai.images.edit>[0]): Promise<ImageResult> {
  try { return await openai.images.edit(params) as ImageResult; }
  catch { await new Promise(r => setTimeout(r, 3000)); return await openai.images.edit(params) as ImageResult; }
}

async function saveImage(
  b64: string, userId: string, characterId: string,
  stage: string, type: string, threshold = 235
) {
  const cleaned = await removeWhiteBg(b64, threshold);
  const ts = Date.now();
  const fileName = `${userId}/${stage}-${type}-${ts}.png`;

  await supabase.storage.from('eggs')
    .upload(fileName, Buffer.from(cleaned, 'base64'), { contentType: 'image/png', upsert: true });
  const { data: urlData } = supabase.storage.from('eggs').getPublicUrl(fileName);

  await supabase.from('character_images').insert({
    character_id: characterId, stage, type,
    url: urlData.publicUrl, frame_count: 1, cols: 1, rows: 1,
  });

  return cleaned;
}

/* 단계별 설명 */
const STAGE_DESC: Record<string, string> = {
  child: 'Stage 2 (Child) — young and curious, slightly bigger than baby, features becoming more defined. Playful and energetic.',
  teen:  'Stage 3 (Teen) — adolescent, noticeably larger, features sharpening. Confident posture, developing strength.',
  adult: 'Stage 4 (Adult) — mature and strong, all features well-developed. Powerful and graceful.',
  final: 'Stage 5 (Final) — ultimate fully evolved form. Majestic, powerful, all features at maximum. Impressive and awe-inspiring.',
};

export async function POST(request: Request) {
  try {
    const { characterId, targetStage } = await request.json();
    if (!characterId || !targetStage) {
      return NextResponse.json({ error: '필수 데이터 누락' }, { status: 400 });
    }

    console.log(`[generate-evolution] 시작: ${targetStage}`);

    /* 캐릭터 정보 (userId + 묘사 텍스트 포함) */
    const { data: char } = await supabase
      .from('characters')
      .select('user_id, combo, palette, run_traits, stage_descriptions')
      .eq('id', characterId)
      .single();

    if (!char) {
      return NextResponse.json({ error: '캐릭터 없음' }, { status: 404 });
    }

    const userId = char.user_id;

    /* 이전 단계 pixel_idle (이미지 참조용) */
    const { data: prevPixel } = await supabase
      .from('character_images')
      .select('url')
      .eq('character_id', characterId)
      .eq('type', 'pixel_idle')
      .order('created_at', { ascending: false })
      .limit(1);

    /* 런닝 속성 → 프롬프트 */
    const runTraits = char.run_traits as RunTraits | null;
    const traitFragment = runTraits ? traitsToPromptFragment(runTraits) : '';

    const creature = `a cute fantasy pet inspired by ${(char.combo || []).join(' and ')}`;
    const colorText = char.palette?.length ? `Color palette: ${char.palette.join(', ')}.` : '';

    /* 사전 생성된 묘사 텍스트 (있으면 사용, 없으면 하드코딩 폴백) */
    const descriptions = char.stage_descriptions as Record<string, string> | null;
    const targetDesc = descriptions?.[targetStage] || STAGE_DESC[targetStage] || '';

    const commonStyle = `Art style: soft watercolor illustration with clean lines.
Warm gentle colors. Rounded cute proportions. Studio Ghibli meets Pokemon feel.
${colorText}
${traitFragment ? `Runner personality traits: ${traitFragment}.` : ''}
White background. No text. Single character only.`;

    /* ══ 1. 일러스트 생성 — 이전 pixel_idle을 참조 입력으로 ══ */
    console.log(`[generate-evolution] 일러스트 생성: ${targetStage}`);

    let illustB64: string;

    /* 전체 5단계 진화 맥락 프롬프트 */
    const stageNumber = ({ child: 2, teen: 3, adult: 4, final: 5 } as Record<string, number>)[targetStage] || 3;
    const prevStageNumber = stageNumber - 1;

    const fullEvolutionContext = `This character evolves through 5 stages. Here is the full evolution plan:
Stage 1 (Baby): ${descriptions?.baby || 'Tiny newborn blob'}
Stage 2 (Child): ${descriptions?.child || 'Small and curious'}
Stage 3 (Teen): ${descriptions?.teen || 'Adolescent, confident'}
Stage 4 (Adult): ${descriptions?.adult || 'Mature and powerful'}
Stage 5 (Final): ${descriptions?.final || 'Ultimate majestic form'}

NOW GENERATE: Stage ${stageNumber} — ${targetDesc}
The reference image is Stage ${prevStageNumber}. Evolve it clearly to Stage ${stageNumber}.
Make it noticeably BIGGER, more DETAILED, and more DEVELOPED than the reference.
IMPORTANT: Keep the same face, same base colors, same core identity.`;

    const prevUrl = prevPixel?.[0]?.url;
    if (prevUrl) {
      const prevImageRes = await fetch(prevUrl);
      const prevImageBuffer = Buffer.from(await prevImageRes.arrayBuffer());

      const illustRes = await editWithRetry({
        model: 'gpt-image-2',
        image: new File([prevImageBuffer], 'prev.png', { type: 'image/png' }),
        prompt: `${fullEvolutionContext}
${creature}.
${traitFragment ? `Runner personality: ${traitFragment}.` : ''}
${commonStyle}`,
        n: 1, size: '1024x1024',
      });
      illustB64 = illustRes.data[0].b64_json as string;
    } else {
      const illustRes = await generateWithRetry({
        model: 'gpt-image-2', n: 1, size: '1024x1024',
        prompt: `${fullEvolutionContext}
${creature}.
${commonStyle}`,
      });
      illustB64 = illustRes.data[0].b64_json as string;
    }

    await saveImage(illustB64, userId, characterId, targetStage, 'illust', 248);

    /* ══ 2. 일러스트 → 도트 idle 변환 ══ */
    console.log(`[generate-evolution] 도트 변환: ${targetStage}`);
    const illustBuffer = Buffer.from(illustB64, 'base64');
    const idleRes = await editWithRetry({
      model: 'gpt-image-2',
      image: new File([illustBuffer], 'illust.png', { type: 'image/png' }),
      prompt: `Convert this character illustration to a 64x64 pixel art sprite.
Keep the same character design, same colors, same proportions.
Pixel art style: clean crisp pixel edges, no anti-aliasing, limited color palette.
Front-facing idle pose. Cute chunky pixels. Each pixel clearly visible.
White background. No text.`,
      n: 1, size: '1024x1024',
    });

    const idleB64 = idleRes.data[0].b64_json as string;
    await saveImage(idleB64, userId, characterId, targetStage, 'pixel_idle', 235);
    const idleBuffer = Buffer.from(idleB64, 'base64');

    /* ══ 3. bounce 프레임 4종 (이동 애니메이션) ══ */
    console.log(`[generate-evolution] 바운스 프레임 생성: ${targetStage}`);
    const bounceFrames = [
      { type: 'pixel_move1', prompt: 'Edit this pixel art sprite: squash the character down slightly — crouching, preparing to jump. Body compressed shorter and wider. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_move2', prompt: 'Edit this pixel art sprite: character is jumping up in the air — legs tucked under body, stretched upward. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_move3', prompt: 'Edit this pixel art sprite: character at the peak of a jump — body slightly stretched vertically, floating at highest point. Keep same character, same colors, same pixel style. White background.' },
      { type: 'pixel_move4', prompt: 'Edit this pixel art sprite: character landing from a jump — body squashed down on impact, slightly wider. Keep same character, same colors, same pixel style. White background.' },
    ];

    for (const bf of bounceFrames) {
      try {
        const res = await editWithRetry({
          model: 'gpt-image-2',
          image: new File([idleBuffer], 'idle.png', { type: 'image/png' }),
          prompt: bf.prompt,
          n: 1, size: '1024x1024',
        });
        await saveImage(res.data[0].b64_json as string, userId, characterId, targetStage, bf.type, 235);
      } catch (err) {
        console.error(`[generate-evolution] ${bf.type} 실패:`, err instanceof Error ? err.message : err);
      }
    }

    /* ══ 4. 행동 모션 5종 × 4프레임 ══ */
    console.log(`[generate-evolution] 행동 모션 생성: ${targetStage}`);
    const behaviorSets = [
      {
        name: 'happy', base: 'character looks happy and content — soft smiling eyes, gentle smile',
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
        name: 'joyful', base: 'character is extremely excited — jumping with joy',
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
          const res = await editWithRetry({
            model: 'gpt-image-2',
            image: new File([idleBuffer], 'idle.png', { type: 'image/png' }),
            prompt: `Edit this pixel art sprite: ${beh.base}. Frame ${i + 1} of 4: ${beh.frames[i]}. Keep same character, same colors, same pixel style. White background.`,
            n: 1, size: '1024x1024',
          });
          await saveImage(res.data[0].b64_json as string, userId, characterId, targetStage, type, 235);
        } catch (err) {
          console.error(`[generate-evolution] ${type} 실패:`, err instanceof Error ? err.message : err);
        }
      }
    }

    console.log(`[generate-evolution] ${targetStage} 완료! (일러스트 1 + idle 1 + bounce 4 + 행동 5×4 = 26장)`);
    return NextResponse.json({ ok: true, stage: targetStage });

  } catch (error) {
    const msg = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[generate-evolution] 에러:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
