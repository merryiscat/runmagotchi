---
name: screen-plan
description: Runmagotchi 화면 기획용 흑백 HTML 와이어프레임 작성·수정 스킬. 사용자가 "화면 기획", "와이어", "와이어프레임", "화면 설계", 영역 ID(O1/M1/U1/E1/P1/B1 등), "이 화면 만들어줘", "이 화면 그려줘" 같은 화면 설계 의도를 보이면 발동.
---

# screen-plan

Runmagotchi의 화면 기획을 흑백 HTML 와이어프레임으로 작성·수정하는 스킬.

## 발동 조건

다음 의도가 보이면 발동한다 (슬래시 명령 인자 파싱 없음, 자연어 의도 기반):

- "화면 기획", "화면 설계", "와이어", "와이어프레임", "스크린"
- 영역 ID 언급: O1, M1, U1, E1, P1, B1, 또는 신규 영역
- "이 화면 만들어줘", "S1부터 그려줘", "메인 화면 어떻게 생길지" 등

## 산출물 구조

```
docs/screens/
├── index.html         # 전체 화면 갤러리 (네비)
├── wireframe.css      # 공용 흑백 스타일시트
├── components.html    # 와이어 컴포넌트 카탈로그
├── O1.html            # 영역별 화면 파일
├── O2.html
├── M1.html
└── ...
```

## ID 채번 규칙

영역 prefix + 순번. 새 영역이 필요해지면 한 글자 prefix 추가하고 사용자에게 확인한다.

| Prefix | 영역 |
|--------|------|
| O | 온보딩 (Onboarding) |
| M | 메인 / 대시보드 (Main) |
| U | 업로드 (Upload) |
| E | 진화 (Evolution) |
| P | 프로필 (Profile) |
| B | 훈장·칭호 (Badge/Title) |

## 작성 규칙

### 시각
- **흑백만** 사용. 회색 6단계 토큰: `#000 / #333 / #666 / #999 / #ccc / #eee / #fff` (`wireframe.css`의 `--c-0`~`--c-6`).
- 그림자·그라데이션·컬러·배경 이미지 **금지**.
- 구조는 1px solid 보더로 표현.
- 폰트: 시스템 폰트 + `Noto Sans KR` fallback. (스타일시트에 이미 설정됨)
- spacing: 4px scale (`--s-1`~`--s-7`).

### 반응형
- 모바일 default, 768px+ 태블릿, 1024px+ 데스크탑. 2단계 분기.
- 고정 모바일 너비 와이어 금지 — 처음부터 반응형으로 (`feedback_wireframe_responsive` 메모리 규칙).

### 카피
- **실제 한국어 카피만** 사용. lorem ipsum 금지.
- **"운명" / "사주" 단어 금지** (Runmagotchi 사주 비공개 원칙).
- 사주 내부 필드(일주·오행·temperament 등) 노출 금지.
- DNA 카드 공개 필드(name·archetype·fantasy_modifier·signature_marks·color_palette·lore_one_liner)만 노출 허용.

### 플레이스홀더
- 이미지 박스: `.img-ph` (1px 보더 + 대각선 X + "이미지" 레이블)
- 캐릭터: `.img-ph` + "캐릭터" 텍스트
- 사용자 데이터: 중괄호 토큰 `{사용자 이름}`, `{거리}`, `{시간}` 등. 클래스 `.token`으로 표시.

## 화면 메타 블록

각 화면 HTML 상단에 `.meta` 블록으로 명시:

- ID (예: O1)
- 이름 + 한 줄 목적
- 진입점 (어디서 어떻게 들어오나)
- 다음 (어디로 나가나, 분기 조건 포함)
- 권한·로그인 상태 가정
- 작성일

## 사이드 노트 패널

각 화면에 `.notes` 패널 포함. 3섹션 고정:

- **의도** (`<h3>의도</h3>`): 왜 이 구조·카피인가
- **대안** (`<h3>대안</h3>`): 다른 옵션 / 보류된 안
- **미정** (`<h3>미정</h3>`): 이번 화면에서 결정 못한 항목

데스크탑(≥1024px)에서는 화면 옆 컬럼, 모바일에서는 하단으로 자동 스택 (CSS가 처리).

## 버전 규칙

- 화면 HTML은 **코드 성격** → 직접 편집(덮어쓰기 허용). 글로벌 `_v1` 파일명 규칙 미적용.
- 큰 구조 변경 시에만 디렉터리 묶음 단위 `screens_v1/` → `screens_v2/`로 버전업하고 사용자에게 확인.

## 작업 절차

### 새 화면 작성
1. ID·영역 prefix 결정 (사용자에게 후보 제안 OK)
2. 진입점·다음 화면 명시 (다른 화면과의 관계 점검)
3. 메타 블록 작성
4. 화면 본문 작성 — 실제 카피·실제 구조, lorem 금지
5. 사이드 노트 작성 — 의도/대안/미정
6. `docs/screens/index.html`에 항목 추가

### 기존 화면 수정
1. 해당 HTML 직접 편집
2. 진입점·다음으로 연결된 인접 화면도 같이 점검 (영향 전파)
3. ID·이름 변경 시 `index.html` 갱신

## 미리보기

- 빠른: PowerShell에서 `start docs/screens/index.html`
- 권장: VSCode Live Server 확장 (저장 시 자동 새로고침)

## 도메인 규칙 참조

화면 작성 시 항상 다음 메모리를 따른다:

- [[project-runmagotchi-concept]] — 핵심 컨셉
- [[project-runmagotchi-stack]] — 기술 스택
- [[project-runmagotchi-design]] — 캐릭터·성장 시스템 (사주 비공개 원칙 포함)
- [[feedback-wireframe-responsive]] — 반응형 강제
