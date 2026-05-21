---
name: icon-gen
description: 프로젝트 디자인 시스템에 맞는 아이콘을 GPT image API로 생성하는 스킬. "아이콘 만들어", "icon", "아이콘 생성", "버튼 아이콘", "탭 아이콘" 같은 의도가 보이면 발동.
---

# icon-gen

OpenAI `gpt-image-1` API를 사용해서 Runmagotchi 디자인 시스템에 맞는 아이콘을 생성한다.

## 발동 조건

다음 의도가 보이면 발동:

- "아이콘 만들어", "아이콘 생성", "icon 생성"
- "~ 아이콘 필요", "~ 버튼 아이콘"
- "탭 아이콘", "네비 아이콘", "메뉴 아이콘"
- 특정 UI 요소에 들어갈 아이콘을 요청할 때

---

## 1. 디자인 원칙 — Runmagotchi 아이콘 스타일

### 기본 스타일
프로젝트의 디자인 시스템(`web/ui_kits/README.md`)에서 정의한 아이콘 방향:
- **Lucide 스타일**: 1.5px stroke, no fill, square corners
- **단색**: `--ink-strong (#1A1A1A)` 또는 `--ink-muted (#707070)`
- **배경 없음**: 투명 배경 PNG
- **크기**: 기본 24x24px (필요시 48x48, 64x64)
- **여백**: 아이콘 영역의 ~12.5% padding (24px 기준 3px 내부 여백)

### 금지 사항
- 컬러 아이콘 금지 (오방색 accent는 CSS로 적용, 아이콘 자체는 단색)
- 그라데이션, 그림자, 3D 효과 금지
- 둥근 모서리 금지 (square corners)
- fill 채우기 금지 (stroke only)
- 이모지 스타일 금지

---

## 2. 작업 절차

### ① 요구사항 확인

사용자에게 다음을 확인한다:
- **무엇을**: 어떤 아이콘이 필요한지 (예: 업로드, 설정, 달리기 등)
- **어디에**: 어디에 사용할 건지 (GNB, 버튼, 탭바 등)
- **크기**: 기본 24px, 다른 크기 필요하면 지정
- **변형**: 여러 상태가 필요한지 (active/inactive, on/off 등)

사용자가 이미 충분히 설명했으면 확인 없이 바로 생성한다.

### ② 프롬프트 구성

아래 **시스템 프롬프트 템플릿**을 기반으로 구체적 아이콘 설명을 붙인다:

```
A minimal line icon for a mobile app UI.
Style: single-weight stroke (1.5px equivalent), no fill, square line caps and joins.
Color: pure black (#1A1A1A) on transparent background.
Canvas: {size}x{size}px with 12.5% padding on all sides.
No rounded corners, no shadows, no gradients, no 3D effects.
The icon should be clean, geometric, and instantly recognizable at small sizes.

Subject: {아이콘 설명}
```

### ③ API 호출

`web/scripts/gen-icon.mjs` 스크립트를 실행한다:

```bash
cd web && node scripts/gen-icon.mjs --name "{파일명}" --desc "{아이콘 설명}" [--size 24]
```

**옵션:**
- `--name`: 파일명 (확장자 제외, 예: `upload`, `settings`)
- `--desc`: 아이콘 설명 (영어, GPT 프롬프트에 들어감)
- `--size`: 픽셀 크기 (기본 24, 선택: 24/48/64)
- `--variants`: 변형 수 (기본 3, 최대 5) — 후보를 여러 개 생성

### ④ 결과 확인 및 선택

- 생성된 아이콘들이 `web/public/icons/` 에 저장됨
- 사용자에게 후보를 보여주고 선택하게 한다
- 선택된 아이콘만 남기고 나머지는 삭제

### ⑤ 후처리 (자동)

생성 직후 자동으로 처리됨:
- **배경 제거**: Sharp로 밝은 배경(#F0F0F0 이상)을 투명으로 변환. gpt-image-1이 투명 배경을 완벽하게 지원하지 않으므로 필수.
- 필요시 추가: Sharp로 리사이즈 / 트림, 여러 크기 변형 생성 (24, 48, 64)

---

## 3. 배치 생성

여러 아이콘을 한 번에 만들 때:

```bash
cd web && node scripts/gen-icon.mjs --batch icons.json
```

`icons.json` 형식:
```json
[
  { "name": "upload", "desc": "an upward arrow emerging from a tray" },
  { "name": "run", "desc": "a running person in side profile" },
  { "name": "settings", "desc": "a gear/cog wheel" }
]
```

---

## 4. 파일 구조

```
web/public/icons/
  ├── {name}.png          ← 최종 선택된 아이콘
  ├── {name}-1.png        ← 후보 1 (선택 전)
  ├── {name}-2.png        ← 후보 2
  └── {name}-3.png        ← 후보 3
```

---

## 5. 주의사항

- **API 비용**: gpt-image-1은 호출당 비용이 있으므로, 불필요한 재생성 자제
- **투명 배경**: 반드시 `background: transparent` 옵션 사용
- **디자인 일관성**: 생성된 아이콘이 기존 UI와 어울리는지 확인
- **라이선스**: AI 생성 아이콘이므로 브랜드 로고(Google, Kakao, Naver)에는 사용 불가 — 공식 에셋 사용할 것
