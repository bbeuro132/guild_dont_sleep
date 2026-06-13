// ===== data.js: 게임 정적 데이터 =====

// 직업 정의
const JOBS = {
  warrior:            { name: '전사',           tier: 1, branch: 'warrior', cssClass: 'job-warrior' },
  knight:             { name: '기사',           tier: 2, branch: 'warrior', cssClass: 'job-knight' },
  guardian_knight:    { name: '수호기사',       tier: 3, branch: 'warrior', cssClass: 'job-guardian-knight' },
  gladiator:          { name: '검투사',         tier: 2, branch: 'warrior', cssClass: 'job-gladiator' },
  champion:           { name: '챔피언',         tier: 3, branch: 'warrior', cssClass: 'job-champion' },

  rogue:              { name: '도적',           tier: 1, branch: 'rogue',   cssClass: 'job-rogue' },
  assassin:           { name: '암살자',         tier: 2, branch: 'rogue',   cssClass: 'job-assassin' },
  ninja:              { name: '닌자',           tier: 3, branch: 'rogue',   cssClass: 'job-ninja' },
  hunter:             { name: '사냥꾼',         tier: 2, branch: 'rogue',   cssClass: 'job-hunter' },
  bounty_hunter:      { name: '현상금 사냥꾼', tier: 3, branch: 'rogue',   cssClass: 'job-bounty-hunter' },

  mage:               { name: '마법사',         tier: 1, branch: 'mage',    cssClass: 'job-mage' },
  cathedral_sorcerer: { name: '대성당 술사',    tier: 2, branch: 'mage',    cssClass: 'job-cathedral-sorcerer' },
  cathedral_scholar:  { name: '대성당 학자',    tier: 3, branch: 'mage',    cssClass: 'job-cathedral-scholar' },
  ivory_sorcerer:     { name: '상아탑 술사',    tier: 2, branch: 'mage',    cssClass: 'job-ivory-sorcerer' },
  ivory_sage:         { name: '상아탑 현자',    tier: 3, branch: 'mage',    cssClass: 'job-ivory-sage' },
};

// 전직 트리 (jobKey → 가능한 2차 전직 목록)
const JOB_PROMOTIONS = {
  warrior:            ['knight', 'gladiator'],
  knight:             ['guardian_knight'],
  gladiator:          ['champion'],
  rogue:              ['assassin', 'hunter'],
  assassin:           ['ninja'],
  hunter:             ['bounty_hunter'],
  mage:               ['cathedral_sorcerer', 'ivory_sorcerer'],
  cathedral_sorcerer: ['cathedral_scholar'],
  ivory_sorcerer:     ['ivory_sage'],
};

// 전직 비용 (레벨, 골드, 재료)
const PROMOTION_COST = {
  tier2: { level: 10, gold: 2000, material: 10 },
  tier3: { level: 25, gold: 8000, material: 30 },
};

// 특성 목록
const TRAITS = [
  { id: 'iron_body',     name: '강철 몸', desc: '체력 +15%', stat: 'hp',       mult: 0.15 },
  { id: 'berserker',     name: '광전사', desc: '공격력 +15%', stat: 'atk',     mult: 0.15 },
  { id: 'fortress',      name: '요새',   desc: '방어력 +15%', stat: 'def',     mult: 0.15 },
  { id: 'swift',         name: '신속',   desc: '속도 +15%',  stat: 'spd',     mult: 0.15 },
  { id: 'lucky',         name: '행운아', desc: '치명타 확률 +8%', stat: 'crit', mult: 0.08 },
  { id: 'slayer',        name: '처형자', desc: '치명타 데미지 +20%', stat: 'critDmg', mult: 0.20 },
  { id: 'tough',         name: '강인함', desc: '체력 +10%, 방어력 +10%', stat: 'multi', effects: { hp: 0.10, def: 0.10 } },
  { id: 'predator',      name: '포식자', desc: '공격력 +10%, 속도 +10%', stat: 'multi', effects: { atk: 0.10, spd: 0.10 } },
];

// 건물 정의
const BUILDINGS = [
  {
    id: 'headquarters',
    name: '지휘 본부',
    icon: '🏯',
    desc: '길드의 중심. 레벨에 따라 동시 파견 가능한 팀 수가 결정됩니다.',
    effectLabel: (lv) => `파견 슬롯: ${lv}팀`,
    baseCost: { gold: 5000, material: 20 },
    costMult: 2.0,
  },
  {
    id: 'lounge',
    name: '대기실',
    icon: '🛋️',
    desc: '모험가들이 쉬는 공간. 레벨당 보유 가능한 모험가 수가 늘어납니다.',
    effectLabel: (lv) => `최대 모험가: ${lv + 2}명`,
    baseCost: { gold: 2000, material: 8 },
    costMult: 1.7,
  },
  {
    id: 'application',
    name: '모집 서류',
    icon: '📋',
    desc: '서류 질이 높아질수록 더 우수한 모험가가 찾아옵니다.',
    effectLabel: (lv) => `서류 등급: ${['D','D','C','C','B','B','A','A','S'][Math.min(lv, 8)]}급 이상 출현`,
    baseCost: { gold: 1500, material: 5 },
    costMult: 1.8,
    maxLevel: 8,
  },
  {
    id: 'warehouse',
    name: '창고',
    icon: '📦',
    desc: '장비와 아이템을 보관합니다. 레벨당 보관 칸이 늘어납니다.',
    effectLabel: (lv) => `보관 칸: ${lv * 5 + 10}칸`,
    baseCost: { gold: 800, material: 4 },
    costMult: 1.5,
  },
  {
    id: 'laboratory',
    name: '연구소',
    icon: '⚗️',
    desc: '경험치 책을 제작하고 재료를 합성합니다. 레벨이 높을수록 더 좋은 책과 빠른 제작이 가능합니다.',
    effectLabel: (lv) => `제작 속도: ${100 + lv * 10}%, 최고 책 등급: ${'DCBAS'[Math.min(Math.floor(lv / 2), 4)]}`,
    baseCost: { gold: 1200, material: 6 },
    costMult: 1.6,
  },
];

// 파견 지역 정의
const AREAS = [
  {
    id: 'forest',
    stage: 1,
    name: '베른 근교 숲',
    icon: '🌲',
    unlocked: true,
    unlockDesc: '처음부터 개방',
    maxProgress: 200,
    monsters: [
      { name: '늑대',      sprite: 'assets/monsters/animals/wolf.png',          boss: false },
      { name: '멧돼지',    sprite: 'assets/monsters/animals/death_yak.png',     boss: false },
      { name: '쥐',        sprite: 'assets/monsters/animals/giant_gecko.png',   boss: false },
      { name: '거대 거미', sprite: 'assets/monsters/animals/wolf_spider.png',   boss: false },
      { name: '독사',      sprite: 'assets/monsters/animals/snake.png',         boss: false },
      { name: '곰 (보스)', sprite: 'assets/monsters/animals/bear.png',          boss: true },
      { name: '와르그 (보스)', sprite: 'assets/monsters/animals/warg.png',      boss: true },
    ],
    goldPerSec: 2,
    materialPerMin: 0.5,
  },
  {
    id: 'mine',
    stage: 2,
    name: '베른 석재/금 광산',
    icon: '⛏️',
    unlocked: false,
    unlockDesc: '1단계 진행도 200 달성',
    unlockCondition: { areaId: 'forest', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '거대 딱정벌레', sprite: 'assets/monsters/animals/giant_beetle.png',    boss: false },
      { name: '거대 지네',     sprite: 'assets/monsters/animals/giant_centipede.png', boss: false },
      { name: '바위 지렁이',   sprite: 'assets/monsters/animals/brain_worm.png',      boss: false },
      { name: '거대 두꺼비',   sprite: 'assets/monsters/animals/giant_toad.png',      boss: false },
      { name: '전갈',          sprite: 'assets/monsters/animals/scorpion.png',        boss: false },
      { name: '거대 전갈 (보스)', sprite: 'assets/monsters/animals/giant_scorpion.png', boss: true },
      { name: '암석 지렁이 (보스)', sprite: 'assets/monsters/animals/lava_worm.png', boss: true },
    ],
    goldPerSec: 5,
    materialPerMin: 1.5,
  },
  {
    id: 'mountain',
    stage: 3,
    name: '칸 방면 산악지대',
    icon: '🏔️',
    unlocked: false,
    unlockDesc: '2단계 진행도 200 달성',
    unlockCondition: { areaId: 'mine', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '재칼',      sprite: 'assets/monsters/animals/wolf.png',     boss: false },
      { name: '하운드',    sprite: 'assets/monsters/animals/warg.png',     boss: false },
      { name: '그리폰',    sprite: 'assets/monsters/hippogriff.png',       boss: false },
      { name: '만티코어',  sprite: 'assets/monsters/manticore.png',        boss: false },
      { name: '와이번',    sprite: 'assets/monsters/wyvern.png',           boss: false },
      { name: '히포그리프 (보스)', sprite: 'assets/monsters/hippogriff.png', boss: true },
      { name: '미노타우르 (보스)', sprite: 'assets/monsters/minotaur.png', boss: true },
    ],
    goldPerSec: 12,
    materialPerMin: 3,
  },
  {
    id: 'coast',
    stage: 4,
    name: '솔 방면 해안가',
    icon: '🌊',
    unlocked: false,
    unlockDesc: '2단계 진행도 200 달성 (3단계와 동시 개방)',
    unlockCondition: { areaId: 'mine', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '해파리',        sprite: 'assets/monsters/animals/jellyfish.png',          boss: false },
      { name: '전기뱀장어',    sprite: 'assets/monsters/animals/electric_eel.png',       boss: false },
      { name: '바다뱀',        sprite: 'assets/monsters/animals/sea_snake.png',          boss: false },
      { name: '상어',          sprite: 'assets/monsters/animals/shark.png',              boss: false },
      { name: '대형 물고기',   sprite: 'assets/monsters/animals/big_fish.png',           boss: false },
      { name: '크라켄 (보스)', sprite: 'assets/monsters/animals/kraken_head.png',        boss: true },
      { name: '인어전사 (보스)', sprite: 'assets/monsters/merfolk_impaler.png',          boss: true },
    ],
    goldPerSec: 14,
    materialPerMin: 3.5,
  },
  {
    id: 'etheria',
    stage: 5,
    name: '교국 에테리아 인근',
    icon: '✨',
    unlocked: false,
    unlockDesc: '3단계 또는 4단계 진행도 200 달성',
    unlockCondition: { anyAreaId: ['mountain', 'coast'], progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '임프',       sprite: 'assets/monsters/demons/imp.png',         boss: false },
      { name: '백색 임프',  sprite: 'assets/monsters/demons/white_imp.png',   boss: false },
      { name: '철제 임프',  sprite: 'assets/monsters/demons/iron_imp.png',    boss: false },
      { name: '그림자 임프', sprite: 'assets/monsters/demons/shadow_imp.png', boss: false },
      { name: '악마 거미',  sprite: 'assets/monsters/demons/demonic_crawler.png', boss: false },
      { name: '이프리트 (보스)', sprite: 'assets/monsters/demons/efreet.png', boss: true },
      { name: '케럽 (보스)',     sprite: 'assets/monsters/holy/cherub.png',   boss: true },
    ],
    goldPerSec: 30,
    materialPerMin: 7,
  },
  {
    id: 'ordos',
    stage: 6,
    name: '오르도스 국경지대',
    icon: '💀',
    unlocked: false,
    unlockDesc: '5단계 진행도 200 달성',
    unlockCondition: { areaId: 'etheria', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '악마',       sprite: 'assets/monsters/demons/fiend.png',         boss: false },
      { name: '지옥 기사',  sprite: 'assets/monsters/demons/blue_devil.png',    boss: false },
      { name: '처형자',     sprite: 'assets/monsters/demons/executioner.png',   boss: false },
      { name: '그림자 악마', sprite: 'assets/monsters/demons/shadow_fiend.png', boss: false },
      { name: '연기 악마',  sprite: 'assets/monsters/demons/green_death.png',   boss: false },
      { name: '핏 피엔드 (보스)', sprite: 'assets/monsters/demons/pit_fiend.png', boss: true },
      { name: '발룩 (보스)',      sprite: 'assets/monsters/demons/balrug.png',   boss: true },
    ],
    goldPerSec: 70,
    materialPerMin: 15,
  },
  {
    id: 'frostpeak',
    stage: 7,
    name: '서리 산맥 기슭',
    icon: '🐉',
    unlocked: false,
    unlockDesc: '6단계 진행도 200 달성',
    unlockCondition: { areaId: 'ordos', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '용암 뱀',    sprite: 'assets/monsters/animals/lava_snake.png',  boss: false },
      { name: '용암 물고기', sprite: 'assets/monsters/animals/lava_fish.png',  boss: false },
      { name: '용암 지렁이', sprite: 'assets/monsters/animals/lava_worm.png',  boss: false },
      { name: '불의 드레이크', sprite: 'assets/monsters/fire_drake.png',       boss: false },
      { name: '폭풍 드래곤', sprite: 'assets/monsters/storm_dragon.png',       boss: false },
      { name: '황금 드래곤 (보스)', sprite: 'assets/monsters/golden_dragon.png', boss: true },
      { name: '티아마트 (보스)',    sprite: 'assets/monsters/unique/tiamat.png', boss: true },
    ],
    goldPerSec: 180,
    materialPerMin: 40,
  },
];

// 상점 아이템 정의
const SHOP_ITEMS = [
  {
    id: 'exp_book_d',
    name: '경험치 서 (D)',
    icon: 'assets/items/I_Book.png',
    desc: '모험가에게 사용하면 경험치 50 획득',
    price: 300,
    type: 'exp_book',
    expValue: 50,
  },
  {
    id: 'exp_book_c',
    name: '경험치 서 (C)',
    icon: 'assets/items/I_Book.png',
    desc: '모험가에게 사용하면 경험치 200 획득',
    price: 1000,
    type: 'exp_book',
    expValue: 200,
  },
  {
    id: 'exp_book_b',
    name: '경험치 서 (B)',
    icon: 'assets/items/I_Book.png',
    desc: '모험가에게 사용하면 경험치 800 획득',
    price: 3500,
    type: 'exp_book',
    expValue: 800,
  },
  {
    id: 'material_d',
    name: '재료 (일반)',
    icon: 'assets/items/I_Crystal01.png',
    desc: '건물 업그레이드 및 합성에 사용',
    price: 100,
    type: 'material',
    grade: 'D',
    amount: 1,
  },
  {
    id: 'material_c',
    name: '재료 (희귀)',
    icon: 'assets/items/I_Crystal02.png',
    desc: '고급 건물 업그레이드에 필요한 재료',
    price: 500,
    type: 'material',
    grade: 'C',
    amount: 1,
  },
  {
    id: 'material_rare',
    name: '희귀 재료',
    icon: 'assets/items/I_Crystal03.png',
    desc: '극히 드문 희귀 재료. 최고급 업그레이드에 필요.',
    price: 5000,
    type: 'material',
    grade: 'B',
    amount: 1,
  },
];

// 모험가 이름 풀
const ADVENTURER_NAMES = [
  '아리엘', '베른하르트', '클라우스', '도로테아', '에르빈',
  '프리다', '군터', '한나', '이고르', '야스민',
  '카를', '루이사', '마르쿠스', '노라', '오스카',
  '파울라', '퀸투스', '로사', '지그문트', '테레사',
  '울리히', '빌마', '크세르크세스', '이베트', '제노',
  '알베르트', '베아트리체', '코르넬리우스', '다이아나', '에마누엘',
  '펠리시타스', '고트프리트', '헬레나', '이사도라', '요한',
];

// 등급별 모험가 스탯 기준
const GRADE_STAT_MULT = {
  D: 1.0,
  C: 1.2,
  B: 1.45,
  A: 1.75,
  S: 2.1,
};

// 경험치 테이블 (레벨당 필요 경험치)
function expRequired(level) {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

// 레벨별 스탯 성장
function statGrowth(baseStat, level, growthRate) {
  return Math.floor(baseStat * (1 + growthRate * (level - 1)));
}
