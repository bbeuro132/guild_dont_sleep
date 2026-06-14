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
    name: '베른 석재 광산',
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
    name: '베른 금광산',
    icon: '🪙',
    unlocked: false,
    unlockDesc: '2단계 진행도 200 달성',
    unlockCondition: { areaId: 'mine', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '광산 약탈자',   sprite: 'assets/monsters/animals/wolf.png',     boss: false },
      { name: '광산 사냥개',   sprite: 'assets/monsters/animals/warg.png',     boss: false },
      { name: '동굴 그리폰',   sprite: 'assets/monsters/hippogriff.png',       boss: false },
      { name: '만티코어',      sprite: 'assets/monsters/manticore.png',        boss: false },
      { name: '동굴 와이번',   sprite: 'assets/monsters/wyvern.png',           boss: false },
      { name: '동굴의 히포그리프 (보스)', sprite: 'assets/monsters/hippogriff.png', boss: true },
      { name: '황금 미노타우르 (보스)',   sprite: 'assets/monsters/minotaur.png',   boss: true },
    ],
    goldPerSec: 12,
    materialPerMin: 3,
  },
  {
    id: 'coast',
    stage: 4,
    name: '베른 변경 평원',
    icon: '🌾',
    unlocked: false,
    unlockDesc: '3단계 진행도 200 달성',
    unlockCondition: { areaId: 'mountain', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '평원 슬라임',       sprite: 'assets/monsters/animals/jellyfish.png',       boss: false },
      { name: '독 도마뱀',         sprite: 'assets/monsters/animals/electric_eel.png',    boss: false },
      { name: '평원 독사',         sprite: 'assets/monsters/animals/sea_snake.png',       boss: false },
      { name: '들소',              sprite: 'assets/monsters/animals/shark.png',           boss: false },
      { name: '초원 맹수',         sprite: 'assets/monsters/animals/big_fish.png',        boss: false },
      { name: '평원의 군주 (보스)', sprite: 'assets/monsters/animals/kraken_head.png',    boss: true },
      { name: '변경의 수호자 (보스)', sprite: 'assets/monsters/merfolk_impaler.png',      boss: true },
    ],
    goldPerSec: 18,
    materialPerMin: 4,
  },
  {
    id: 'etheria',
    stage: 5,
    name: '베른 국경 관문',
    icon: '🏰',
    unlocked: false,
    unlockDesc: '4단계 진행도 200 달성',
    unlockCondition: { areaId: 'coast', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '경계 도깨비',   sprite: 'assets/monsters/demons/imp.png',             boss: false },
      { name: '백색 도깨비',   sprite: 'assets/monsters/demons/white_imp.png',       boss: false },
      { name: '철제 골렘',     sprite: 'assets/monsters/demons/iron_imp.png',        boss: false },
      { name: '그림자 암살자', sprite: 'assets/monsters/demons/shadow_imp.png',      boss: false },
      { name: '관문 수호 거미', sprite: 'assets/monsters/demons/demonic_crawler.png', boss: false },
      { name: '관문 수장 (보스)',    sprite: 'assets/monsters/demons/efreet.png',    boss: true },
      { name: '변경의 성기사 (보스)', sprite: 'assets/monsters/holy/cherub.png',     boss: true },
    ],
    goldPerSec: 35,
    materialPerMin: 8,
  },
  {
    id: 'ordos',
    stage: 6,
    name: '칸 외곽 대장간 거리',
    icon: '🔥',
    unlocked: false,
    unlockDesc: '5단계 진행도 200 달성',
    unlockCondition: { areaId: 'etheria', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '화염 정령',      sprite: 'assets/monsters/demons/fiend.png',         boss: false },
      { name: '용광로 기사',    sprite: 'assets/monsters/demons/blue_devil.png',    boss: false },
      { name: '대장간 수호자',  sprite: 'assets/monsters/demons/executioner.png',   boss: false },
      { name: '불꽃 악마',      sprite: 'assets/monsters/demons/shadow_fiend.png',  boss: false },
      { name: '화염 악마',      sprite: 'assets/monsters/demons/green_death.png',   boss: false },
      { name: '화염의 군주 (보스)', sprite: 'assets/monsters/demons/pit_fiend.png', boss: true },
      { name: '대장간의 수호신 (보스)', sprite: 'assets/monsters/demons/balrug.png', boss: true },
    ],
    goldPerSec: 80,
    materialPerMin: 18,
  },
  {
    id: 'frostpeak',
    stage: 7,
    name: '칸 광산 깊은 곳',
    icon: '🐉',
    unlocked: false,
    unlockDesc: '6단계 진행도 200 달성',
    unlockCondition: { areaId: 'ordos', progress: 200 },
    maxProgress: 200,
    monsters: [
      { name: '고대 암석 뱀',    sprite: 'assets/monsters/animals/lava_snake.png',  boss: false },
      { name: '지하 용암어',     sprite: 'assets/monsters/animals/lava_fish.png',   boss: false },
      { name: '광맥 지렁이',     sprite: 'assets/monsters/animals/lava_worm.png',   boss: false },
      { name: '광산 드레이크',   sprite: 'assets/monsters/fire_drake.png',          boss: false },
      { name: '고대 드래곤',     sprite: 'assets/monsters/storm_dragon.png',        boss: false },
      { name: '황금 드래곤 (보스)', sprite: 'assets/monsters/golden_dragon.png',    boss: true },
      { name: '티아마트 (보스)',    sprite: 'assets/monsters/unique/tiamat.png',     boss: true },
    ],
    goldPerSec: 200,
    materialPerMin: 45,
  },
];

// ===== 장비 템플릿 =====
const EQUIPMENT_TEMPLATES = {
  weapon: {
    names:  { D: '낡은 검',   C: '강철 검',     B: '은빛 검',       A: '성검',         S: '전설의 검'   },
    icons:  { D: 'assets/items/W_Sword001.png', C: 'assets/items/W_Sword003.png',
              B: 'assets/items/W_Sword006.png', A: 'assets/items/W_Sword009.png',
              S: 'assets/items/W_Sword013.png' },
    stats:  { D: { atk: 8 }, C: { atk: 18 }, B: { atk: 40 }, A: { atk: 80 }, S: { atk: 160 } },
  },
  armor: {
    names:  { D: '낡은 갑옷', C: '강철 갑옷',   B: '미스릴 갑옷',   A: '성기사 갑옷',  S: '전설의 갑옷' },
    icons:  { D: 'assets/items/A_Clothing01.png', C: 'assets/items/A_Armour01.png',
              B: 'assets/items/A_Armour02.png',   A: 'assets/items/A_Armour03.png',
              S: 'assets/items/A_Armor05.png' },
    stats:  { D: { hp: 30, def: 5 }, C: { hp: 70, def: 12 }, B: { hp: 150, def: 25 },
              A: { hp: 300, def: 50 }, S: { hp: 600, def: 100 } },
  },
  accessory: {
    names:  { D: '낡은 반지', C: '은 목걸이',   B: '마법 반지',     A: '성기사 훈장',  S: '전설의 보석' },
    icons:  { D: 'assets/items/Ac_Necklace01.png', C: 'assets/items/Ac_Ring01.png',
              B: 'assets/items/Ac_Necklace03.png',  A: 'assets/items/Ac_Medal02.png',
              S: 'assets/items/Ac_Ring02.png' },
    stats:  { D: { spd: 3, crit: 3 }, C: { spd: 6, crit: 6 }, B: { spd: 12, crit: 10 },
              A: { spd: 25, crit: 15 }, S: { spd: 50, crit: 25 } },
  },
};

// ===== 장비 추가 옵션 풀 =====
const GRADE_IDX = { D: 0, C: 1, B: 2, A: 3, S: 4 };
const OPTION_COUNT = { D: 0, C: 1, B: 1, A: 2, S: 3 };

const EQUIPMENT_OPTIONS = {
  weapon: [
    { id: 'w_crit_rate',    name: '치명타 확률',   type: 'stat',     stat: 'crit',            values: [3,4,6,9,13],      desc: v => `치명타 +${v}%` },
    { id: 'w_crit_dmg',     name: '치명타 데미지', type: 'stat',     stat: 'critDmg',         values: [10,15,22,32,45],  desc: v => `치명타 배율 +${v}%` },
    { id: 'w_atk_pct',      name: '공격력 강화',   type: 'stat_pct', stat: 'atk',             values: [5,7,10,15,22],    desc: v => `공격력 +${v}%` },
    { id: 'w_armor_pierce', name: '방어력 무시',   type: 'battle',   effect: 'armorPierce',   values: [10,15,20,30,42],  desc: v => `방어 무시 ${v}%` },
    { id: 'w_bleed',        name: '출혈',          type: 'battle',   effect: 'bleed',         values: [15,20,25,32,40],  desc: v => `출혈 부여 ${v}%` },
    { id: 'w_first_crit',   name: '선제 치명타',   type: 'battle',   effect: 'firstStrikeCrit', values: [1,1,1,1,1],    desc: () => `첫 공격 치명타 확정` },
    { id: 'w_double_atk',   name: '연속 공격',     type: 'battle',   effect: 'doubleAttack',  values: [10,12,16,22,30],  desc: v => `연속공격 ${v}%` },
    { id: 'w_hp_scale',     name: '체력 비례 피해', type: 'battle',  effect: 'hpScaleDmg',    values: [3,4,6,9,13],      desc: v => `HP비례 추가피해 +${v}%` },
    { id: 'w_def_break',    name: '방어 감소',     type: 'battle',   effect: 'defBreak',      values: [20,25,30,40,50],  desc: v => `방어 감소 ${v}%` },
    { id: 'w_all_pct',      name: '전능력치 강화', type: 'stat_pct', stat: 'all',             values: [2,3,5,7,10],      desc: v => `전능력치 +${v}%` },
  ],
  armor: [
    { id: 'a_dmg_reduce',  name: '피해 감소',    type: 'battle',   effect: 'damageReduction', values: [5,7,10,14,20],   desc: v => `피해 감소 ${v}%` },
    { id: 'a_hp_pct',      name: '체력 강화',    type: 'stat_pct', stat: 'hp',                values: [8,12,17,24,35],  desc: v => `체력 +${v}%` },
    { id: 'a_crit_resist', name: '치명타 저항',  type: 'battle',   effect: 'critResist',      values: [10,15,20,30,42], desc: v => `치명타 피해 감소 ${v}%` },
    { id: 'a_def_pct',     name: '방어력 강화',  type: 'stat_pct', stat: 'def',               values: [8,12,17,24,35],  desc: v => `방어력 +${v}%` },
    { id: 'a_shield',      name: '전투 보호막',  type: 'battle',   effect: 'startShield',     values: [30,50,80,130,200], desc: v => `전투보호막 ${v}` },
    { id: 'a_spd',         name: '속도 강화',    type: 'stat',     stat: 'spd',               values: [2,4,6,9,13],     desc: v => `속도 +${v}` },
    { id: 'a_low_hp',      name: '위기 방어',    type: 'battle',   effect: 'lowHpDmgReduce',  values: [10,15,20,28,38], desc: v => `HP 40% 이하 피해 감소 +${v}%` },
    { id: 'a_def_to_hp',   name: '철벽 체력',    type: 'stat_scale', scale: 'def_to_hp',      values: [2,3,4,6,8],      desc: v => `방어력×${v} HP 추가` },
    { id: 'a_evasion',     name: '회피율',       type: 'battle',   effect: 'evasion',         values: [5,7,10,14,20],   desc: v => `회피 ${v}%` },
    { id: 'a_hp_to_def',   name: '체력 방어',    type: 'stat_scale', scale: 'hp_to_def',      values: [1,2,2,3,4],      desc: v => `HP/100×${v} 방어력` },
  ],
  accessory: [
    { id: 'ac_spd',        name: '속도 강화',       type: 'stat',     stat: 'spd',             values: [3,5,7,10,15],    desc: v => `속도 +${v}` },
    { id: 'ac_atk_pct',    name: '공격력 강화',     type: 'stat_pct', stat: 'atk',             values: [5,7,10,15,22],   desc: v => `공격력 +${v}%` },
    { id: 'ac_def_pct',    name: '방어력 강화',     type: 'stat_pct', stat: 'def',             values: [5,7,10,15,22],   desc: v => `방어력 +${v}%` },
    { id: 'ac_hp_pct',     name: '체력 강화',       type: 'stat_pct', stat: 'hp',              values: [5,7,10,15,22],   desc: v => `체력 +${v}%` },
    { id: 'ac_crit',       name: '치명타 확률',     type: 'stat',     stat: 'crit',            values: [3,5,7,10,15],    desc: v => `치명타 +${v}%` },
    { id: 'ac_dmg_reduce', name: '피해 감소',       type: 'battle',   effect: 'damageReduction', values: [3,5,7,10,15],  desc: v => `피해 감소 ${v}%` },
    { id: 'ac_gold',       name: '재화 획득 증가',  type: 'dispatch', dispatchEffect: 'goldBonus', values: [5,8,12,18,25], desc: v => `골드 +${v}%` },
    { id: 'ac_crit_dmg',   name: '치명타 데미지',   type: 'stat',     stat: 'critDmg',         values: [10,15,22,32,45], desc: v => `치명타 배율 +${v}%` },
    { id: 'ac_heal',       name: '전투 후 회복',    type: 'battle',   effect: 'healAfterBattle', values: [5,8,10,15,20],  desc: v => `전투 후 HP ${v}% 회복` },
    { id: 'ac_all',        name: '전능력치 강화',   type: 'stat_pct', stat: 'all',             values: [3,4,6,8,12],     desc: v => `전능력치 +${v}%` },
  ],
};

function generateEquipment(slot, grade) {
  const tmpl  = EQUIPMENT_TEMPLATES[slot];
  const gIdx  = GRADE_IDX[grade];
  const count = OPTION_COUNT[grade];

  // 랜덤 옵션 추출
  const pool    = [...EQUIPMENT_OPTIONS[slot]].sort(() => Math.random() - 0.5);
  const options = pool.slice(0, count).map(opt => ({
    id:             opt.id,
    name:           opt.name,
    type:           opt.type,
    stat:           opt.stat,
    scale:          opt.scale,
    effect:         opt.effect,
    dispatchEffect: opt.dispatchEffect,
    value:          opt.values[gIdx],
    display:        opt.desc(opt.values[gIdx]),
  }));

  return {
    id:      `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name:    tmpl.names[grade],
    slot,
    grade,
    icon:    tmpl.icons[grade],
    stats:   { ...tmpl.stats[grade] },
    options,
  };
}

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
  {
    id: 'shop_weapon_d',
    name: '낡은 검 (D급)',
    icon: 'assets/items/W_Sword001.png',
    desc: '공격력 +8. 모험가 상세에서 무기 슬롯에 장착.',
    price: 800,
    type: 'equipment',
    slot: 'weapon',
    grade: 'D',
  },
  {
    id: 'shop_armor_d',
    name: '낡은 갑옷 (D급)',
    icon: 'assets/items/A_Clothing01.png',
    desc: 'HP +30, 방어력 +5. 방어구 슬롯에 장착.',
    price: 600,
    type: 'equipment',
    slot: 'armor',
    grade: 'D',
  },
  {
    id: 'shop_accessory_d',
    name: '낡은 반지 (D급)',
    icon: 'assets/items/Ac_Necklace01.png',
    desc: '속도 +3, 치명타 +3%. 악세서리 슬롯에 장착.',
    price: 500,
    type: 'equipment',
    slot: 'accessory',
    grade: 'D',
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
