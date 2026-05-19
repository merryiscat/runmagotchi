---
name: runmagotchi-design
description: Use this skill to generate well-branded interfaces and assets for Runmagotchi — a Korean running-tamagotchi PWA — either for production or throwaway prototypes/mocks. Contains the wireframe-stage design vocabulary, copy rules, color and type tokens, the planned AI character-art style guide, and a recreated UI kit for the core screens (landing, egg pick, dashboard, upload flow, hatch, profile).
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

**Color direction adopted**: 오방색 (5-direction) — chrome stays neutral (한지 paper + 흙 clay + 먹 ink), five accents drawn from 청·적·황·백·흑 are each bound to specific product states. Pre-color wireframe rules carry forward.

- **6-step grayscale legacy tokens (`--c-0` … `--c-6`) still resolve** via aliases so the existing wireframe screens keep working. New work should use semantic tokens (`--paper`, `--clay`, `--ink-strong`, `--cheong`, `--jeok`, etc.).
- **The single non-grayscale surface for the character** is still the per-user `color_palette` derived from saju (사주). It applies to the egg illustration, crack stages, and AI-generated character art — never on UI chrome.
- **Accent use rules**: one accent per screen by default. **적 (`--jeok` #B33A2A) is reserved for the upload/confirm CTA** — destructive states stay grayscale + heavier border weight, never red.
- **Korean-first**, noun-centric, ≤ 3-word labels. No honorifics, no exclamations, no emoji.
- The words **사주**, **운명**, and every internal seed field (archetype, fantasy_modifier, signature_marks, color_palette, lore_one_liner, temperament, 일주/월주/년주, 십신, 레벨, EXP) are **forbidden in user-facing copy**. Only `name` and `gender` are public. (오방색 is a separate Korean color heritage and is fine to surface — it is not saju.)

## Files to read

| File | When |
|---|---|
| `README.md` | Always first. Product context + full visual/content foundations. |
| `colors_and_type.css` | The canonical token layer. Import this rather than duplicating. |
| `assets/wireframe.css` | Verbatim source primitives used by the original screens. |
| `preview/*.html` | Cards illustrating each token, component, and brand rule. Open them to sanity-check a specific concept. |
| `ui_kits/runmagotchi/` | Working recreation of the 6 core screens. Reuse the JSX components. |

## Don'ts

- Don't introduce color outside the 오방색 5-accent system on UI chrome.
- Don't use red (`--jeok`) for danger / destructive — it is reserved for the primary CTA.
- Don't use more than one accent per screen without a documented reason.
- Don't add rounded corners with colored left-border accents.
- Don't add soft shadows, gradients, frosted glass, or pill buttons.
- Don't add emoji or exclamation marks.
- Don't expose the words 사주 / 운명 / archetype / level / EXP, even as labels.
- Don't draw original character art — use the two-diagonal placeholder, or note that real character art is generated under `ART_STYLE_GUIDE = "soft painterly, pastel background, full body, slight 3/4 view, clean lineart, no text"`.

## Do's

- Do use semantic tokens (`var(--paper)`, `var(--clay)`, `var(--ink-strong)`, `var(--jeok)`, etc.) over the legacy `--c-0` … `--c-6` aliases for new work.
- Do write Korean copy as nouns or short status phrases (`업로드`, `확정`, `부화 중...`).
- Do use the monospace token chip for dynamic values (`<span class="token">{캐릭터 이름}</span>`).
- Do apply the per-user `color_palette` via inline CSS variables on the egg / character only — never let it override `--jeok`/`--cheong`/etc.
- Do reach for `border-weight` changes (1 → 2 → 3 px) to express elevation / selection, not shadows.
- Do bind each 오방색 accent to its mapped role: 청 streak · 적 CTA · 황 칭호 · 백 완전체 · 흑 야간.
