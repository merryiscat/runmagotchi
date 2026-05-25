/**
 * 동물+품종 풀 — 캐릭터 생성 다양성 확보용
 *
 * 사주 분석 시 이 풀에서 랜덤 후보를 뽑아 LLM에 제시하면
 * 매번 다른 동물이 추천되어 결과가 다양해진다.
 *
 * 카테고리별로 분류해서 고르게 뽑히도록 한다.
 * tag: 성격/기질 키워드 (LLM이 사주와 매칭할 때 참고)
 */

/* ─── 타입 ─── */

export interface AnimalEntry {
  /** 한국어 이름 (예: "시바견") */
  name: string;
  /** 영어 이름 — 이미지 프롬프트용 (예: "Shiba Inu") */
  en: string;
  /** 상위 분류 (예: "개") */
  species: string;
  /** 성격/기질 태그 */
  tags: string[];
}

export interface AnimalCategory {
  /** 카테고리명 */
  category: string;
  /** 소속 동물 목록 */
  animals: AnimalEntry[];
}

/* ─── 동물 풀 ─── */

export const ANIMAL_POOL: AnimalCategory[] = [
  /* ── 개 ── */
  {
    category: '개',
    animals: [
      { name: '시바견', en: 'Shiba Inu', species: '개', tags: ['독립적', '고집', '충성'] },
      { name: '웰시코기', en: 'Welsh Corgi', species: '개', tags: ['활발', '사교적', '귀여움'] },
      { name: '골든 리트리버', en: 'Golden Retriever', species: '개', tags: ['온순', '충성', '낙천적'] },
      { name: '보더콜리', en: 'Border Collie', species: '개', tags: ['똑똑', '에너지', '집중력'] },
      { name: '포메라니안', en: 'Pomeranian', species: '개', tags: ['활발', '경계', '자신감'] },
      { name: '허스키', en: 'Siberian Husky', species: '개', tags: ['자유로움', '고집', '사회적'] },
      { name: '비글', en: 'Beagle', species: '개', tags: ['호기심', '사교적', '탐험'] },
      { name: '사모예드', en: 'Samoyed', species: '개', tags: ['온순', '밝음', '친화력'] },
      { name: '진돗개', en: 'Jindo Dog', species: '개', tags: ['충성', '독립적', '용감'] },
      { name: '치와와', en: 'Chihuahua', species: '개', tags: ['당당', '경계', '애교'] },
      { name: '달마시안', en: 'Dalmatian', species: '개', tags: ['활력', '호기심', '독특함'] },
      { name: '닥스훈트', en: 'Dachshund', species: '개', tags: ['용감', '고집', '장난기'] },
    ],
  },

  /* ── 고양이 ── */
  {
    category: '고양이',
    animals: [
      { name: '러시안 블루', en: 'Russian Blue Cat', species: '고양이', tags: ['내성적', '우아', '섬세'] },
      { name: '스코티시 폴드', en: 'Scottish Fold Cat', species: '고양이', tags: ['온순', '애교', '느긋'] },
      { name: '브리티시 숏헤어', en: 'British Shorthair Cat', species: '고양이', tags: ['독립적', '침착', '관찰'] },
      { name: '페르시안', en: 'Persian Cat', species: '고양이', tags: ['고급', '느긋', '조용'] },
      { name: '벵갈', en: 'Bengal Cat', species: '고양이', tags: ['야생적', '에너지', '호기심'] },
      { name: '샴', en: 'Siamese Cat', species: '고양이', tags: ['수다', '사교적', '감정적'] },
      { name: '먼치킨', en: 'Munchkin Cat', species: '고양이', tags: ['장난기', '애교', '활발'] },
      { name: '아비시니안', en: 'Abyssinian Cat', species: '고양이', tags: ['호기심', '활동적', '영리'] },
      { name: '코리안 숏헤어', en: 'Korean Shorthair Cat', species: '고양이', tags: ['자유로움', '독립적', '적응력'] },
      { name: '노르웨이 숲', en: 'Norwegian Forest Cat', species: '고양이', tags: ['온화', '인내', '자연친화'] },
      { name: '메인쿤', en: 'Maine Coon Cat', species: '고양이', tags: ['거대', '온순', '사회적'] },
      { name: '터키시 앙고라', en: 'Turkish Angora Cat', species: '고양이', tags: ['우아', '활발', '독립적'] },
    ],
  },

  /* ── 토끼 / 설치류 ── */
  {
    category: '토끼·설치류',
    animals: [
      { name: '네덜란드 드워프 토끼', en: 'Netherland Dwarf Rabbit', species: '토끼', tags: ['소심', '귀여움', '섬세'] },
      { name: '롭이어 토끼', en: 'Lop-eared Rabbit', species: '토끼', tags: ['온순', '느긋', '애교'] },
      { name: '렉스 토끼', en: 'Rex Rabbit', species: '토끼', tags: ['침착', '관찰', '부드러움'] },
      { name: '햄스터', en: 'Hamster', species: '햄스터', tags: ['부지런', '수집', '독립적'] },
      { name: '친칠라', en: 'Chinchilla', species: '친칠라', tags: ['야행성', '부드러움', '조용'] },
      { name: '기니피그', en: 'Guinea Pig', species: '기니피그', tags: ['사교적', '소심', '온순'] },
      { name: '다람쥐', en: 'Chipmunk', species: '다람쥐', tags: ['민첩', '수집', '경계'] },
      { name: '날다람쥐', en: 'Flying Squirrel', species: '다람쥐', tags: ['야행성', '모험', '민첩'] },
    ],
  },

  /* ── 조류 ── */
  {
    category: '새',
    animals: [
      { name: '잉꼬', en: 'Budgerigar', species: '앵무', tags: ['수다', '사교적', '밝음'] },
      { name: '코카틸', en: 'Cockatiel', species: '앵무', tags: ['애교', '노래', '감정적'] },
      { name: '올빼미', en: 'Owl', species: '맹금', tags: ['지혜', '야행성', '직관'] },
      { name: '수리부엉이', en: 'Eagle Owl', species: '맹금', tags: ['위엄', '고독', '통찰'] },
      { name: '참새', en: 'Sparrow', species: '소형조', tags: ['사교적', '근면', '소박'] },
      { name: '직박구리', en: 'Brown-eared Bulbul', species: '소형조', tags: ['활기', '시끄러움', '호기심'] },
      { name: '앵무새', en: 'Parrot', species: '앵무', tags: ['영리', '모방', '사교적'] },
      { name: '펭귄', en: 'Penguin', species: '펭귄', tags: ['사회적', '인내', '단체행동'] },
      { name: '플라밍고', en: 'Flamingo', species: '플라밍고', tags: ['우아', '화려', '군집'] },
      { name: '까마귀', en: 'Crow', species: '까마귀', tags: ['영리', '장난기', '신비'] },
      { name: '두루미', en: 'Crane', species: '두루미', tags: ['고결', '인내', '장수'] },
      { name: '벌새', en: 'Hummingbird', species: '벌새', tags: ['민첩', '에너지', '작음'] },
    ],
  },

  /* ── 수중 / 반수생 ── */
  {
    category: '수중·반수생',
    animals: [
      { name: '수달', en: 'Otter', species: '수달', tags: ['장난기', '관계지향', '물기운'] },
      { name: '해달', en: 'Sea Otter', species: '수달', tags: ['느긋', '애교', '유대'] },
      { name: '아홀로틀', en: 'Axolotl', species: '도롱뇽', tags: ['재생', '신비', '느긋'] },
      { name: '해파리', en: 'Jellyfish', species: '해파리', tags: ['유유자적', '신비', '투명'] },
      { name: '거북이', en: 'Turtle', species: '거북', tags: ['느림', '인내', '장수'] },
      { name: '돌고래', en: 'Dolphin', species: '돌고래', tags: ['영리', '사교적', '즐거움'] },
      { name: '흰동가리', en: 'Clownfish', species: '열대어', tags: ['용감', '공생', '화려'] },
      { name: '물개', en: 'Seal', species: '물개', tags: ['느긋', '호기심', '사교적'] },
    ],
  },

  /* ── 파충류 / 양서류 ── */
  {
    category: '파충류·양서류',
    animals: [
      { name: '레오파드 게코', en: 'Leopard Gecko', species: '도마뱀', tags: ['온순', '야행성', '독립적'] },
      { name: '카멜레온', en: 'Chameleon', species: '도마뱀', tags: ['적응', '관찰', '변화'] },
      { name: '크레스티드 게코', en: 'Crested Gecko', species: '도마뱀', tags: ['야행성', '온순', '조용'] },
      { name: '청개구리', en: 'Tree Frog', species: '개구리', tags: ['민첩', '변화', '자연친화'] },
      { name: '비어디 드래곤', en: 'Bearded Dragon', species: '도마뱀', tags: ['느긋', '친화적', '호기심'] },
      { name: '이구아나', en: 'Iguana', species: '도마뱀', tags: ['위엄', '독립적', '냉정'] },
    ],
  },

  /* ── 야생 포유류 ── */
  {
    category: '야생 포유류',
    animals: [
      { name: '여우', en: 'Fox', species: '여우', tags: ['영리', '독립적', '감성적'] },
      { name: '북극여우', en: 'Arctic Fox', species: '여우', tags: ['적응', '인내', '변신'] },
      { name: '사막여우', en: 'Fennec Fox', species: '여우', tags: ['귀여움', '경계', '야행성'] },
      { name: '너구리', en: 'Raccoon Dog', species: '너구리', tags: ['적응', '재치', '변장'] },
      { name: '라쿤', en: 'Raccoon', species: '라쿤', tags: ['호기심', '손재주', '장난기'] },
      { name: '레서판다', en: 'Red Panda', species: '판다', tags: ['온순', '느긋', '귀여움'] },
      { name: '판다', en: 'Giant Panda', species: '판다', tags: ['느긋', '먹보', '평화'] },
      { name: '고슴도치', en: 'Hedgehog', species: '고슴도치', tags: ['내성적', '방어', '야행성'] },
      { name: '미어캣', en: 'Meerkat', species: '미어캣', tags: ['경계', '사회적', '협동'] },
      { name: '오소리', en: 'Badger', species: '오소리', tags: ['고집', '근면', '용감'] },
      { name: '사슴', en: 'Deer', species: '사슴', tags: ['순수', '경계', '우아'] },
      { name: '늑대', en: 'Wolf', species: '늑대', tags: ['충성', '리더십', '본능'] },
      { name: '코알라', en: 'Koala', species: '코알라', tags: ['느긋', '수면', '평화'] },
      { name: '알파카', en: 'Alpaca', species: '알파카', tags: ['온순', '부드러움', '유순'] },
      { name: '카피바라', en: 'Capybara', species: '카피바라', tags: ['평화', '사교적', '느긋'] },
      { name: '오리너구리', en: 'Platypus', species: '오리너구리', tags: ['독특', '신비', '관찰'] },
      { name: '웜뱃', en: 'Wombat', species: '웜뱃', tags: ['고집', '튼튼', '땅속'] },
      { name: '슈가글라이더', en: 'Sugar Glider', species: '슈가글라이더', tags: ['야행성', '사교적', '비행'] },
    ],
  },

  /* ── 대형 야생 ── */
  {
    category: '대형 야생',
    animals: [
      { name: '호랑이', en: 'Tiger', species: '호랑이', tags: ['위엄', '독립적', '힘'] },
      { name: '백호', en: 'White Tiger', species: '호랑이', tags: ['신비', '고귀', '희귀'] },
      { name: '눈표범', en: 'Snow Leopard', species: '표범', tags: ['고독', '우아', '은둔'] },
      { name: '치타', en: 'Cheetah', species: '치타', tags: ['속도', '집중', '민첩'] },
      { name: '사자', en: 'Lion', species: '사자', tags: ['리더십', '카리스마', '보호'] },
      { name: '북극곰', en: 'Polar Bear', species: '곰', tags: ['인내', '강인', '고독'] },
      { name: '반달곰', en: 'Asiatic Black Bear', species: '곰', tags: ['호기심', '힘', '자연친화'] },
      { name: '코끼리', en: 'Elephant', species: '코끼리', tags: ['지혜', '기억력', '가족'] },
    ],
  },

  /* ── 곤충 / 절지 ── */
  {
    category: '곤충·절지',
    animals: [
      { name: '나비', en: 'Butterfly', species: '나비', tags: ['변화', '아름다움', '자유'] },
      { name: '반딧불이', en: 'Firefly', species: '반딧불이', tags: ['빛', '야행성', '신비'] },
      { name: '무당벌레', en: 'Ladybug', species: '무당벌레', tags: ['행운', '귀여움', '보호'] },
      { name: '꿀벌', en: 'Honeybee', species: '꿀벌', tags: ['근면', '협동', '질서'] },
      { name: '장수풍뎅이', en: 'Rhinoceros Beetle', species: '풍뎅이', tags: ['힘', '인내', '강인'] },
      { name: '사슴벌레', en: 'Stag Beetle', species: '사슴벌레', tags: ['위엄', '경쟁', '용감'] },
    ],
  },

  /* ── 판타지 / 전설 ── */
  {
    category: '판타지·전설',
    animals: [
      { name: '용', en: 'Dragon', species: '용', tags: ['힘', '지혜', '신비'] },
      { name: '봉황', en: 'Phoenix', species: '봉황', tags: ['재생', '고귀', '불'] },
      { name: '유니콘', en: 'Unicorn', species: '유니콘', tags: ['순수', '치유', '희귀'] },
      { name: '구미호', en: 'Nine-tailed Fox', species: '구미호', tags: ['매력', '변신', '영리'] },
      { name: '기린(상서)', en: 'Qilin', species: '기린', tags: ['상서', '평화', '고귀'] },
      { name: '해태', en: 'Haetae', species: '해태', tags: ['정의', '수호', '불'] },
      { name: '그리핀', en: 'Griffin', species: '그리핀', tags: ['용감', '수호', '힘'] },
      { name: '페가수스', en: 'Pegasus', species: '페가수스', tags: ['자유', '비행', '순수'] },
      { name: '삼족오', en: 'Three-legged Crow', species: '삼족오', tags: ['태양', '신비', '영리'] },
      { name: '불사조', en: 'Phoenix Bird', species: '불사조', tags: ['재생', '불굴', '빛'] },
      { name: '켈피', en: 'Kelpie', species: '켈피', tags: ['물', '변신', '신비'] },
      { name: '바실리스크', en: 'Basilisk', species: '바실리스크', tags: ['위엄', '공포', '고독'] },
    ],
  },
];

/* ─── 유틸 함수 ─── */

/**
 * 전체 풀에서 카테고리별 균등 랜덤 추출
 *
 * 각 카테고리에서 1~2마리씩 뽑아서 총 n마리를 반환한다.
 * 같은 species가 겹치지 않도록 한다.
 */
export function pickRandomCandidates(n: number = 15): AnimalEntry[] {
  const result: AnimalEntry[] = [];
  const usedSpecies = new Set<string>();

  /* 카테고리 순서 셔플 */
  const shuffledCats = [...ANIMAL_POOL].sort(() => Math.random() - 0.5);

  /* 1라운드: 각 카테고리에서 1마리씩 */
  for (const cat of shuffledCats) {
    if (result.length >= n) break;
    const shuffled = [...cat.animals].sort(() => Math.random() - 0.5);
    const pick = shuffled.find(a => !usedSpecies.has(a.species));
    if (pick) {
      result.push(pick);
      usedSpecies.add(pick.species);
    }
  }

  /* 2라운드: 아직 n에 못 미치면 남은 것에서 추가 */
  if (result.length < n) {
    const remaining = ANIMAL_POOL
      .flatMap(c => c.animals)
      .filter(a => !usedSpecies.has(a.species))
      .sort(() => Math.random() - 0.5);

    for (const a of remaining) {
      if (result.length >= n) break;
      result.push(a);
      usedSpecies.add(a.species);
    }
  }

  return result.sort(() => Math.random() - 0.5);
}

/**
 * 후보 목록을 LLM 프롬프트용 텍스트로 변환
 */
export function candidatesToPromptText(candidates: AnimalEntry[]): string {
  return candidates
    .map((a, i) => `${i + 1}. ${a.name} (${a.en}) — ${a.tags.join(', ')}`)
    .join('\n');
}
