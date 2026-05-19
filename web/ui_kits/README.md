# Runmagotchi Design System

> **Stage**: Color direction chosen — **오방색 (5-direction)** as of 2026-05-16. The wireframe vocabulary (1px borders, no shadow, no gradient) carries forward; saturated color is added only as a strict 5-accent system. See `color-palette-proposals.html` for the 5 candidate palettes that led to this choice, and `colors_and_type.css` for the new token layer.

## What is Runmagotchi?

Runmagotchi is a Korean-language **PWA** that turns running into a Tamagotchi-style pet game. The core loop, per the product plan:

1. User uploads a screenshot from their running app (Strava, 나이키런, 삼성헬스 …).
2. A vision model parses distance, pace, time, time-of-day, route attributes.
3. Those attributes accumulate as XP + tags on a virtual character.
4. On signup the user picks one of three eggs (color-only differentiation). The user's birth date seeds an internal saju (사주) reading that an LLM converts into a private "DNA card" — animal archetype, fantasy modifier, signature marks, a 3-color palette.
5. At 10 km cumulative the egg **hatches** (one AI-generated baby image). At Lv.10/20/30/40 the character evolves (four more AI images). Lv.50 = complete; character stays on stage and the user can start a new cycle.

The **differentiator** is "how you ran shows up visually on the character." Identity is preserved across evolutions by a DNA card, a 5-stage storyboard written up-front, an art-style guide, and previous-stage image conditioning.

### Saju is invisible

Although saju (사주, Korean four-pillars-of-destiny) seeds the character internally, **the words "사주" / "운명" and every internal field (archetype, fantasy_modifier, signature_marks, color_palette, lore_one_liner, element_base/balance, temperament, 일주/월주/년주, 십신) are forbidden from any user-facing copy or label.** Only `name` and `gender` are public. See `runmagotchi/docs/screens/README.md` (the source) and the *Content Fundamentals* section below.

## Sources used

Everything in this design system was extracted from these inputs:

- **GitHub repo** — [merryiscat/runmagotchi](https://github.com/merryiscat/runmagotchi) (`docs/planning/`, `docs/screens/`)
- **Local codebase** — `runmagotchi/` attached via the host's File System Access mount.
  Key paths read:
  - `runmagotchi/docs/planning/runmagotchi_plan_v2.md` — product plan v2 (image-generation scope tightened).
  - `runmagotchi/docs/screens/README.md` — domain rules + forbidden vocab.
  - `runmagotchi/docs/screens/wireframe.css` — the **complete** current visual system. Copied into `assets/wireframe.css`.
  - `runmagotchi/docs/screens/{index,components,O1,O2,M1,M1-variants,U1,E1,E2,E4,P1,S1}.html` — all wireframes.

The team can (and should) browse the repo further to refine these documents.

---

## 1. Content Fundamentals

The product plan locks copy down tighter than the visuals. From `runmagotchi/docs/screens/README.md` (translated and quoted):

### Language
- **Korean-first.** All UI strings, labels, button text are Korean. Latin is reserved for the wordmark ("Runmagotchi"), units (`km`), and tokens like `Lv.10`.

### Tone — **noun-centric, dry, ≤2-3 words per label**
Examples (real, from the wireframes):

| Where | Korean | Translation |
|---|---|---|
| Primary CTA | **업로드** | "Upload" |
| Confirm | **확정** | "Confirm" |
| Modal title | **이름 짓기** | "Name [your character]" |
| Loading | **부화 중...** | "Hatching..." |
| Evolution loading | **진화 중...** | "Evolving..." |
| VLM loading | **분석 중...** | "Analyzing..." |
| Error head | **이미 등록된 스크린샷** | "Already-registered screenshot" |
| Error body | **동일한 이미지는 다시 등록할 수 없음** | "Cannot re-register an identical image" (note: noun ending, not 합니다) |

### Forbidden in copy
- Friendly endings — no `~해 주세요`, no `~하시면 됩니다`, no `당신만의 ~`.
- Exclamation marks, emoji, all interjections.
- Internal jargon — **never** write "AI 생성", "이미지 생성", "VLM 파싱", "GPT 호출", "백그라운드 생성". Always express results: "부화 중..." / "분석 중..." / "최대 7초".
- The words **운명** ("destiny") and **사주** ("saju") and any variant.

### Allowed pronouns
Neither `너` (you, plain) nor `당신` (you, polite). Copy addresses no one — it labels.

### Casing
Korean has no case. Latin tokens are written **as the source app spells them** (Strava, 나이키런, 삼성헬스). The wordmark is `Runmagotchi`, single capital R, no space.

### Vibe
**Quiet, factual, slightly clinical.** Looks like a system message, not a coach. The drama is supposed to come from the character art, not the words.

### Domain tokens (used as inline placeholders)
Always lowercase Korean inside `{…}`, monospace, written as a token:
`{거리}`, `{시간}`, `{페이스}`, `{날짜}`, `{횟수}`, `{연속}`, `{캐릭터 이름}`, `{성별}`, `{누적 거리}`, `{PB}`.

Never expose: `{archetype}`, `{레벨}`, `{누적 EXP}`, `{element_base}`, `{temperament}`, `{lore_one_liner}` etc. These are forbidden as labels even though they exist in the data layer.

---

## 2. Visual Foundations

> **Status**: 오방색 (5-direction) palette adopted on top of the wireframe vocabulary. Chrome stays neutral (한지 paper + 흙 clay + 먹 ink); five accents are mapped to specific product states. The pre-color wireframe rules (1px borders, no shadow, no gradient) remain in force.

### Color — 한지 chrome + 5 directional accents
**Chrome (neutral)**

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#FAFAF7` | Page background (한지) |
| `--surface` | `#FFFFFF` | Card / frame inner |
| `--clay` | `#EAE3D8` | Stage — the only consistently tinted surface |
| `--line-strong` | `#4A463E` | Frame outer border (먹 묽힘) |
| `--line` | `#B8B2A6` | Card / list / input border |
| `--line-soft` | `#D2CEC4` | Divider |
| `--ink-strong` | `#1A1A1A` | Titles, primary text |
| `--ink-default` | `#3A3A3A` | Body |
| `--ink-muted` | `#707070` | Labels, inactive nav |
| `--ink-faint` | `#A09A8E` | Placeholders |

**오방색 — five-direction accents**

| Token | Hex | Direction | Role |
|---|---|---|---|
| `--cheong` (청) | `#2D5F4F` | 동 | 연속 streak · 꾸준한 발걸음 칭호 · daily-rhythm states |
| `--jeok` (적) | `#B33A2A` | 남 | **Primary CTA only** — 업로드 · 확정 |
| `--hwang` (황) | `#C99A2E` | 중앙 | New 칭호 · evolution-complete moments |
| `--baek` (백) | `#B8B5AA` | 서 | 완전체 / Lv.50 silver halo |
| `--heuk` (흑) | `#1F2937` | 북 | 야간런 · 밤의 수호자 · night-cycle titles |

**Strict use rules:**
- **One accent per screen** by default; two only with explicit justification.
- **적 is reserved for the upload / confirm flow.** Destructive states (duplicate-block, gate-reject) stay grayscale with heavier border weight per the original wireframe rule — never red. Mixing CTA red with error red collapses meaning.
- **Per-character `color_palette`** still lives entirely on egg / crack / character art. The brand 오방색 set does NOT override it — it remains the user's saju-derived 3 colors. The two systems coexist: brand chrome + brand accents on UI, character palette on character only.

The full art-style guide for character images is unchanged: `soft painterly, pastel background, full body, slight 3/4 view, clean lineart, no text`. The new accent palette was chosen with low-enough saturation that it does not fight pastel character art.

### Typography
- One sans family: **system stack + Noto Sans KR** (see `fonts/`).
- One mono family for tokens and code blocks.
- 6-step type scale: 12 / 14 / 16 / 20 / 24 / 32 px. (+ a single 40 px for the O1 wordmark.)
- 3 weights: 400 / 700 / 900. **900 is for the `Runmagotchi` wordmark and GNB logo only.**
- Body line-height **1.5**; legal text 1.6; tight 1.2 on stat numbers and buttons.

### Spacing
4 px base, 7-step scale (`--s-1` … `--s-7` = 4 / 8 / 12 / 16 / 24 / 32 / 48). Page padding is `--s-4` on mobile, `--s-5` on `≥1024px`. Frame body padding switches from `--s-4` → `--s-6` at `≥768px`.

### Layout primitives
- **Page** (`.page`) — column on mobile, two-column (main + sticky 320 px side-notes panel) at ≥1024 px. Max-width 1400 px.
- **Frame** (`.frame--web` 1200 px max, `.frame--app` 480→600→720 px responsive). Always a 1 px `--c-1` border, white surface.
- **GNB** — fixed-height 48 px top bar inside the frame: `Runmagotchi` 900-weight logo left, 2-link nav (`업로드`, `프로필`) right, inactive links in `--c-2`, active in `--c-0`, weight 700.
- **Stage** — the character habitat: `--c-5` background, 1 px `--c-4` right-border separates it from the right-hand panel on M1. Min-height 400 → 560 px responsive. **The only "tinted" surface in the product.**
- **Panel** — the right column on M1 / E1. Vertical stack of `panel__section` blocks separated by 1 px `--c-4` lines, each padded `--s-5`.

### Backgrounds
- The page is always **flat white** (`--c-6`). No image backgrounds. No full-bleed photography. No repeating patterns. No gradients. No grain.
- The **stage** is flat `--c-5`. Future may add an art background that follows the character's evolution — flagged as 미정 (TBD) in M1's side-notes.
- The **video-placeholder hero** on O1 uses a two-layer diagonal `linear-gradient` to draw a giant **× crossed-frame placeholder**. This is the *only* gradient in the system, and it represents "video goes here," not a visual treatment.

### Borders
- Always 1 px. 2 px solid `--c-1` for the `.dropzone` (U1) and the modal popup outline. 3 px solid `--c-0` for the selected egg card. Dashed `--c-3` for character-art placeholders, side-note annotations.
- **No rounded corners on chrome.** `border-radius: 0` is the default for frames, cards, buttons, inputs. Pill / circle are reserved for: 100 px circular avatar (P1 sidebar, sized down to 32 px in lists), 80 px circular character disk on the stage, 20 px toggle thumbs, 56 px circular FAB upload button (M1 variant E), and 12 px on the egg card image only.

### Shadows / elevation
**None.** Zero shadow in the product. Elevation is signalled by border weight, border color, and — for modals only — a `rgba(0, 0, 0, 0.4)` backdrop dim covering the host frame.

### Imagery — character art
The wireframes use placeholders (`.img-ph`: a 1 px box with two crossing diagonal `--c-3` lines, white fill). Real character art is generated by `gpt-image-1` under the prompt prefix `ART_STYLE_GUIDE`:

> **soft painterly, pastel background, full body, slight 3/4 view, clean lineart, no text**

This means the *only* color the product surfaces is pastel + painterly soft tones on the character itself, against a pastel painterly background. The UI never imitates that style — the contrast (clinical chrome / dreamy character) is the point.

The egg + 3 crack stages are **fixed illustrations, not AI-generated**, recolored at runtime with the user's `color_palette`. Today these are placeholders.

### Hover / press / focus
- Buttons: no hover transform, no opacity change. The primary button is `--c-0` bg / `--c-6` fg by default — there is no "hover darker" treatment.
- `.btn--social` and `.btn` outlined: no hover state on screen — implied "pressed" via 2 px border thickening on focus per OS default.
- `.egg-card:hover` → border `--c-4` → `--c-1`. `egg-card--selected` → border `--c-0` 3 px.
- `.gnb__nav a:hover` → color `--c-2` → `--c-0`.
- **No transitions / no easing curves are defined in the wireframe CSS.** Motion is TBD; see Animation below.

### Animation
- **Defined animations: zero.** The wireframe CSS contains no `transition`, no `@keyframes`. Motion is a documented gap (M1 side-notes flag "알 상태 미세 모션 디테일" as 미정).
- **Documented animation intent** (from side-notes and the E1 wireframe):
  - O1 landing: an animation video plays, then **fades out (0.8s)** to reveal the login form.
  - M1 stage: the character "freely moves" on stage (sprite + JS; details unspecified).
  - E1 mode A — Hatching: fixed-image sequence `crack-1 → crack-2 → crack-3` swap, then baby appears, then a name modal mounts. Up to 7 s total.
  - E1 mode B — Evolution: a Digimon-style "light explosion + silhouette inside light" then the new stage emerges. Up to 7 s.
- **No bounce, no spring.** The vibe is "clean cut" — fades and direct swaps, not playful springs.

### Borders vs capsules vs protection gradients
The wireframe answer is "always borders." There is **no** capsule pill style (other than the brand-color exp-fill bar at 6 px height with a solid fill — no rounded ends). There is **no** protection gradient (no "fade-to-background" overlay behind text on imagery). Where the M1-variant C explores overlaying UI on a stage, the author specifically rejected the gradient overlay because of the no-color rule and replaced it with a solid `--c-6` strip + 1 px `--c-4` top-border.

### Transparency / blur
- One instance: the **modal backdrop** at `rgba(0, 0, 0, 0.4)`. No blur on it.
- No frosted-glass / translucency / vibrancy anywhere.

### Cards
- 1 px border `--c-3`, white surface, no shadow, no radius, padding `--s-4`.
- `.egg-card` is the exception: 2 px border + 12 px radius on the inner image, 0 radius on the card.

### Iconography
See `ICONOGRAPHY` section below.

### Layout rules
- **Maximum width 1400 px** at the page level, **1200 px** on `.frame--web`, **480→720 px** on `.frame--app` responsive.
- Sticky elements: O1 has none; M1 has none; P1's sidebar becomes `position: sticky; top: 0` at `≥768px`. The notes panel is sticky `top: var(--s-5)` at `≥1024px`.
- The popup-host pattern (E1 mode A ③) puts the modal **inside** the frame via `position: absolute; inset: 0` rather than over the viewport — the modal sits within the frame's coordinate space.

---

## 3. Iconography

### Current state
**The wireframes do not use a real icon set.** What they ship instead:

| Where | Treatment | Token |
|---|---|---|
| Social login (G / K / N) | A 24 px outlined square with a single uppercase letter inside. `.icon-ph` | placeholder |
| Upload dropzone | A 48 px outlined rounded-square with `↑` glyph inside. `.dropzone__icon` | unicode |
| Top-bar back | `←` glyph | unicode |
| Top-bar placeholder right | `　` (full-width space) | unicode |
| Error state (U1 ①-b) | 48 px solid 2 px `--c-1` circle with `✕` glyph | unicode |
| Annotation arrow | `▼` glyph | unicode |
| Empty stat slot | `???` text | text |
| Image placeholder (character, screenshot) | Two crossing diagonal `--c-3` lines on white, label inside | drawn |
| FAB upload (M1 variant E only) | 56 px circle with `+` glyph | unicode |

**No icon font, no SVG sprite, no PNG asset library** is loaded by the wireframe CSS or any of the screen HTML files.

### Documented usage rules
- **Emoji is forbidden** (per copy rules — listed alongside exclamations).
- **Unicode glyphs are acceptable** for primitives: `←`, `→`, `▼`, `↑`, `✕`, `+`. They render in the system font and stay grayscale.
- **Real social icons** (Google G, Kakao talk bubble, Naver N) are flagged as needed before launch — currently rendered as the placeholder `G / K / N` letter chips, with the side-note in O1 saying "로고는 별도 제작 예정. 현재 텍스트 placeholder."

### Substitution flag
> This design system does **not** bundle an icon set. When the product needs real icons (e.g., real Google/Kakao/Naver brand marks, a back chevron, an upload glyph) the recommended path is:
> 1. Use the **official Kakao + Naver brand assets** (legal requirement for those social buttons).
> 2. For neutral UI icons, **Lucide** is the closest match to the wireframe aesthetic (1.5 px stroke, no fill, square corners). Link from CDN: `https://cdn.jsdelivr.net/npm/lucide-static/icons/*.svg`.
> 3. Stay in `--c-0` / `--c-2`; do not introduce a color palette via icons.
>
> This is a substitution. Confirm with the team before locking in.

### Logos
Runmagotchi has **no logo mark yet** — only a wordmark in weight 900. `assets/logo-wordmark.svg` ships a typographic reproduction.

---

## 4. Index

| Path | What |
|---|---|
| `README.md` | This file |
| `SKILL.md` | Agent-Skills entry point (for Claude Code) |
| `colors_and_type.css` | The full token layer + `@font-face` + semantic type classes |
| `fonts/` | Noto Sans KR drop folder + substitution notes |
| `assets/wireframe.css` | Verbatim copy of the source `wireframe.css` — the primitives the wireframes depend on |
| `assets/logo-wordmark.svg` | The "Runmagotchi" wordmark, weight 900, black, no mark |
| `assets/og-placeholder.html` | A neutral OG/share-card layout using only wireframe primitives |
| `preview/` | Design-system preview cards (typography, color, spacing, components, brand) |
| `ui_kits/runmagotchi/` | PWA UI kit (5 core screens reproduced in JSX components) |

## 5. Caveats — open questions for the team

The plan v2 explicitly lists "디자인 시스템" as undefined. Things this document **inherits as unresolved**:
- No real logo mark (only a wordmark).
- No icon set chosen (Lucide is a substitution suggestion).
- No animation curves / durations defined (only intent + 0.8 s fade + ≤7 s loading).
- No imagery direction beyond the AI prompt prefix.
- No real color palette — only the placeholder hand-picked from the team's saju → 3-color logic, which is not in code yet.
- Component library (shadcn vs custom) not chosen.
