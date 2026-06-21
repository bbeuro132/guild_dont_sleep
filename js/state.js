// ===== state.js: 게임 상태 관리 =====

const DEFAULT_STATE = {
  gold: 500,
  materials: { common: 5, advanced: 0, rare: 0, legendary: 0 },
  inventory: [],       // 장비 아이템 목록

  buildings: {
    headquarters: 1,
    lounge: 1,
    application: 1,
    warehouse: 1,
    workshop: 1,
  },

  adventurers: [],     // 보유 모험가 목록
  nextAdvId: 1,

  dispatches: [],      // 활성 파견 목록 [{areaId, team:[advId], startTime, accumulated:{gold,materials:{...}}, progress}]
  areaProgress: {},    // {areaId: maxProgressEver}

  applications: [],    // 현재 서류함 (최대 3장)
  lastRecruitTime: 0,  // 마지막 서류 갱신 시각 (ms)
  recruitInterval: 15 * 60 * 1000, // 15분
  recruitForceCount: 0, // 자동 갱신 이후 수동 갱신 횟수 (비용 계산용)

  tutorialStep: 0,
  tutorialDone: false,

  labQueue: null,       // {recipeId, name, icon, grade, expValue, startAt, finishAt, totalMs}
  buildingUpgrade: null, // {buildingId, targetLevel, startAt, finishAt, gold, materials}

  shopRotation: [],      // 로테이션 상점 현재 상품
  lastShopRefresh: 0,    // 마지막 상점 갱신 시각
  activeBuffs: [],       // [{id, name, effect, value, expiresAt}]

  lastSaveTime: 0,
  totalPlayTime: 0,

  // ===== 리빌딩(프레스티지) =====
  lifetimeGold: 0,         // 누적 획득 골드 (리빌딩 후에도 유지)
  prestigePoints: 0,       // 현재 사용 가능한 스킬포인트
  totalPrestigeEarned: 0,  // 지금까지 받은 총 스킬포인트 (중복 방지용)
  prestigeNodes: [],        // 개방한 노드 ID 목록 (취소 불가)
  rebuildCount: 0,          // 총 리빌딩 횟수
  permanentTraining: { hp: 0, atk: 0, def: 0 }, // 영구 단련 레벨 (리빌딩 후에도 유지)
};

let State = null;

// ===== 저장/불러오기 =====
function saveState() {
  try {
    State.lastSaveTime = Date.now();
    localStorage.setItem('guild_save', JSON.stringify(State));
  } catch (e) {
    console.warn('저장 실패:', e);
  }
}

function migrateGrades(state) {
  const map = { D: '일반', C: '마법', B: '희귀', A: '영웅', S: '전설' };
  const migrateEq = (eq) => { if (eq && map[eq.grade]) eq.grade = map[eq.grade]; };
  for (const adv of (state.adventurers || [])) {
    if (map[adv.grade]) adv.grade = map[adv.grade];
    for (const slot of ['weapon', 'armor', 'accessory']) migrateEq(adv.equipment?.[slot]);
  }
  for (const item of (state.inventory || [])) migrateEq(item);
  for (const app of (state.applications || [])) { if (app && map[app.grade]) app.grade = map[app.grade]; }
}

function loadState() {
  try {
    const raw = localStorage.getItem('guild_save');
    if (raw) {
      const saved = JSON.parse(raw);
      State = Object.assign({}, DEFAULT_STATE, saved);
      migrateGrades(State);
      // 자동 갱신 주기 5분 → 15분 마이그레이션
      if (State.recruitInterval === 5 * 60 * 1000) State.recruitInterval = 15 * 60 * 1000;
      // 재료 단일값 → 등급별 오브젝트 마이그레이션
      if (typeof State.materials === 'number') {
        State.materials = { common: State.materials, advanced: 0, rare: 0, legendary: 0 };
      }
      // laboratory → workshop 건물 ID 마이그레이션
      if (State.buildings.laboratory !== undefined && State.buildings.workshop === undefined) {
        State.buildings.workshop = State.buildings.laboratory;
        delete State.buildings.laboratory;
      }
      // 파견 accumulated 구조 마이그레이션
      for (const d of (State.dispatches || [])) {
        if (d.accumulated && typeof d.accumulated.material === 'number') {
          const old = d.accumulated.material || 0;
          d.accumulated.materials = { common: old, advanced: 0, rare: 0, legendary: 0 };
          delete d.accumulated.material;
        }
        if (d.accumulated && d.accumulated.items) delete d.accumulated.items;
        if (d.accumulated && !d.accumulated.materials) {
          d.accumulated.materials = { common: 0, advanced: 0, rare: 0, legendary: 0 };
        }
      }
      // 오프라인 누적 처리 — 결과를 init()에서 팝업으로 표시
      window._pendingOffline = processOfflineProgress();
      // 저장된 areaProgress 기반으로 지역 해금 복원 (토스트 없이)
      checkAreaUnlocks(true);
    } else {
      State = JSON.parse(JSON.stringify(DEFAULT_STATE));
      State.lastSaveTime = Date.now();
    }
  } catch (e) {
    console.warn('불러오기 실패, 새 게임 시작:', e);
    State = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function resetState() {
  if (!confirm('정말 처음부터 시작하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
  localStorage.removeItem('guild_save');
  State = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  window.location.reload();
}

// ===== 오프라인 승률 추정 (파티 전투력 vs 구역 난이도) =====
function estimateOfflineWinRate(dispatch, area) {
  const team = dispatch.team
    .map(id => State.adventurers.find(a => a.id === id))
    .filter(Boolean);
  if (team.length === 0) return 0;

  // 파티 전투력: 각 모험가의 atk + def×0.5 + hp×0.05 합산
  const partyPower = team.reduce((sum, adv) => {
    const s = getEffectiveStats(adv);
    return sum + s.atk + s.def * 0.5 + s.hp * 0.05;
  }, 0);

  // 현재 진행도 기준 몬스터 전투력 (평균 2마리 가정)
  const st = area.stage;
  const pm = 1 + (dispatch.progress / area.maxProgress) * 0.5;
  const eAtk = 8  * Math.pow(st, 0.65) * pm;
  const eDef = 2  * Math.pow(st, 0.8)  * pm;
  const eHp  = 80 * Math.pow(st, 1.15) * pm;
  const enemyPower = (eAtk + eDef * 0.5 + eHp * 0.05) * 2;

  const ratio = partyPower / Math.max(1, enemyPower);

  if (ratio >= 4)   return 0.97;
  if (ratio >= 3)   return 0.92;
  if (ratio >= 2)   return 0.82;
  if (ratio >= 1.5) return 0.70;
  if (ratio >= 1.0) return 0.55;
  if (ratio >= 0.7) return 0.38;
  if (ratio >= 0.5) return 0.22;
  return 0.10;
}

// ===== 오프라인 진행 계산 =====
function processOfflineProgress() {
  if (!State.lastSaveTime) return null;
  const now = Date.now();
  const elapsed = Math.min((now - State.lastSaveTime) / 1000, 3600 * 8); // 최대 8시간
  if (elapsed < 30) return null; // 30초 미만은 알림 불필요

  let totalGold = 0;
  let totalMat  = 0;
  const areaResults = [];

  for (const dispatch of State.dispatches) {
    const area = AREAS.find(a => a.id === dispatch.areaId);
    if (!area) continue;

    // 파견 accumulated 초기화 확인
    if (!dispatch.accumulated.materials) {
      dispatch.accumulated.materials = { common: 0, advanced: 0, rare: 0, legendary: 0 };
    }

    // 패시브 수입 (시간 비례)
    const gold   = area.goldPerSec * elapsed;
    const mat    = area.materialPerMin * (elapsed / 60);

    // 파티 전투력 기반 전투 결과 추정
    const totalBattles = Math.floor(elapsed / COMBAT_INTERVAL);
    const winRate      = estimateOfflineWinRate(dispatch, area);
    const wins         = Math.floor(totalBattles * winRate);

    const killGold = wins * area.stage * 2 * 1.5;
    const killMat  = wins * area.stage * 0.04;

    totalGold += gold + killGold;
    totalMat  += mat  + killMat;

    dispatch.accumulated.gold += gold + killGold;

    // 재료 등급별 분배
    const matTotal = mat + killMat;
    const ratios   = getMaterialGradeRatios(area.stage);
    for (const [grade, ratio] of Object.entries(ratios)) {
      dispatch.accumulated.materials[grade] = (dispatch.accumulated.materials[grade] || 0) + matTotal * ratio;
    }

    // 오프라인 경험치: 승리 횟수 기반, 보스전 비율 약 20% 가정
    const normalWins = Math.floor(wins * 0.8);
    const bossWins   = wins - normalWins;
    const battleExp  = normalWins * (area.stage * 2 + 3) + bossWins * (area.stage * 2 + 3) * 3;
    for (const advId of dispatch.team) {
      giveExp(advId, battleExp);
    }

    // 진행도: 승리 횟수 = 진행도 상승
    const prevProgress = Math.floor(dispatch.progress);
    dispatch.progress = Math.min(dispatch.progress + wins, area.maxProgress);
    if (dispatch.progress >= area.maxProgress) {
      State.areaProgress[area.id] = area.maxProgress;
    }

    areaResults.push({
      name: area.name,
      icon: area.icon,
      gold: Math.floor(gold + killGold),
      mat:  Math.floor(matTotal),
      progressFrom: prevProgress,
      progressTo:   Math.floor(dispatch.progress),
      maxProgress:  area.maxProgress,
      winRate:      Math.round(winRate * 100),
      wins,
      totalBattles,
    });
  }

  if (areaResults.length === 0) return null;

  return {
    elapsed:    Math.floor(elapsed),
    totalGold:  Math.floor(totalGold),
    totalMat:   Math.floor(totalMat),
    areas:      areaResults,
  };
}

// ===== 재화 조작 =====
function addGold(amount) {
  const positive = Math.floor(amount);
  State.gold = Math.max(0, State.gold + positive);
  if (positive > 0) State.lifetimeGold = (State.lifetimeGold || 0) + positive;
}

function spendGold(amount) {
  if (State.gold < amount) return false;
  State.gold -= amount;
  return true;
}

function refundGold(amount) {
  State.gold += Math.floor(amount);
}

// 재료 등급별 드롭 비율 (stage 기준)
function getMaterialGradeRatios(stage) {
  if (stage <= 10) return { common: 0.97, advanced: 0.03, rare: 0,    legendary: 0    };
  if (stage <= 20) return { common: 0.15, advanced: 0.83, rare: 0.02, legendary: 0    };
  if (stage <= 30) return { common: 0.03, advanced: 0.12, rare: 0.83, legendary: 0.02 };
  return             { common: 0.01, advanced: 0.02, rare: 0.10, legendary: 0.87 };
}

function addMaterial(grade, amount) {
  State.materials[grade] = (State.materials[grade] || 0) + Math.floor(amount);
}

function spendMaterials(cost) {
  for (const [grade, amt] of Object.entries(cost)) {
    if ((State.materials[grade] || 0) < amt) return false;
  }
  for (const [grade, amt] of Object.entries(cost)) {
    State.materials[grade] -= amt;
  }
  return true;
}

// ===== 건물 =====
const BUILDING_UPGRADE_TIMES = [15, 60, 180, 600, 1800, 5400, 14400, 36000, 86400, 172800];

function getBuildingUpgradeTime(lv) {
  const idx = Math.min(lv - 1, BUILDING_UPGRADE_TIMES.length - 1);
  return BUILDING_UPGRADE_TIMES[idx];
}

// lv = 현재 레벨 (업그레이드 시작 레벨)
function getBuildingUpgradeMats(building, lv) {
  const base = building.baseCost.material;
  if (lv <= 3) return { common: base * lv };
  if (lv <= 6) return { advanced: Math.max(1, Math.ceil(base * 0.4 * (lv - 3))) };
  if (lv <= 8) return { rare: Math.max(1, Math.ceil(base * 0.15 * (lv - 6))) };
  return {
    rare: Math.max(1, Math.ceil(base * 0.3)),
    legendary: Math.max(1, Math.ceil(base * 0.05 * (lv - 8))),
  };
}

function getBuildingLevel(id) {
  return State.buildings[id] || 1;
}

function getBuildingUpgradeCost(building) {
  const lv = getBuildingLevel(building.id);
  const goldCost = Math.floor(building.baseCost.gold * Math.pow(building.costMult, lv - 1));
  const materials = getBuildingUpgradeMats(building, lv);
  return { gold: goldCost, materials };
}

function upgradeBuilding(buildingId) {
  const building = BUILDINGS.find(b => b.id === buildingId);
  if (!building) return false;
  const lv = getBuildingLevel(buildingId);
  if (building.maxLevel && lv >= building.maxLevel) {
    showToast('이미 최대 레벨입니다.', 'error'); return false;
  }
  if (State.buildingUpgrade) {
    showToast('이미 업그레이드 중인 건물이 있습니다.', 'error'); return false;
  }
  const cost = getBuildingUpgradeCost(building);
  if (State.gold < cost.gold) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (!spendMaterials(cost.materials)) { showToast('재료가 부족합니다.', 'error'); return false; }
  State.gold -= cost.gold;

  const durationSec = getBuildingUpgradeTime(lv);
  const now = Date.now();
  State.buildingUpgrade = {
    buildingId,
    targetLevel: lv + 1,
    startAt: now,
    finishAt: now + durationSec * 1000,
    gold: cost.gold,
    materials: cost.materials,
  };
  saveState();
  showToast(`${building.name} 업그레이드 시작! (${formatUpgradeDuration(durationSec)})`, 'info');
  return true;
}

function checkBuildingUpgradeComplete() {
  if (!State.buildingUpgrade) return;
  if (Date.now() < State.buildingUpgrade.finishAt) return;

  const { buildingId, targetLevel } = State.buildingUpgrade;
  State.buildings[buildingId] = targetLevel;
  State.buildingUpgrade = null;
  saveState();

  const building = BUILDINGS.find(b => b.id === buildingId);
  showToast(`${building?.name ?? buildingId} 레벨 ${targetLevel} 업그레이드 완료!`, 'success');
  if (typeof renderGuildTab === 'function' && getCurrentTab() === 'guild') renderGuildTab();
}

function cancelBuildingUpgrade() {
  if (!State.buildingUpgrade) return false;
  const { gold, materials } = State.buildingUpgrade;
  refundGold(gold);
  for (const [grade, amt] of Object.entries(materials || {})) addMaterial(grade, amt);
  State.buildingUpgrade = null;
  saveState();
  showToast('업그레이드를 취소했습니다. 재료를 전액 환불받았습니다.', 'info');
  return true;
}

// ===== 모험가 생성 =====
function generateAdventurer(gradeOverride) {
  const appLv = getBuildingLevel('application');
  const gradePool = getGradePool(appLv, gradeOverride);
  const grade = pickGrade(gradePool);
  const job = pickJob();
  const jobInfo = JOBS[job];

  const baseMult = GRADE_STAT_MULT[grade];
  const name = ADVENTURER_NAMES[Math.floor(Math.random() * ADVENTURER_NAMES.length)];

  const traitRoll = Math.random();
  const traitCount = traitRoll < 0.5 ? 0 : traitRoll < 0.9 ? 1 : 2;
  const shuffledTraits = [...TRAITS].sort(() => Math.random() - 0.5);
  const traits = shuffledTraits.slice(0, traitCount).map(t => t.id);

  const branchStats = {
    warrior: { hp: 1.3, atk: 1.0, def: 1.3, spd: 0.8, crit: 0.8, critDmg: 1.0 },
    rogue:   { hp: 0.7, atk: 1.1, def: 0.6, spd: 1.4, crit: 1.4, critDmg: 1.2 },
    mage:    { hp: 0.6, atk: 1.3, def: 0.5, spd: 1.0, crit: 1.0, critDmg: 1.1 },
    healer:  { hp: 1.0, atk: 0.6, def: 0.9, spd: 0.5, crit: 0.7, critDmg: 0.8 },
  };
  const bm = branchStats[jobInfo.branch] || branchStats.warrior;

  const baseStats = {
    hp:      Math.floor((60 + Math.random() * 40) * baseMult * bm.hp),
    atk:     Math.floor((12 + Math.random() * 8)  * baseMult * bm.atk),
    def:     Math.floor((6  + Math.random() * 6)  * baseMult * bm.def),
    spd:     Math.floor((8  + Math.random() * 6)  * baseMult * bm.spd),
    crit:    Math.floor((5  + Math.random() * 10) * baseMult * bm.crit),
    critDmg: Math.floor((150 + Math.random() * 50) * bm.critDmg),
  };

  return {
    id: State.nextAdvId++,
    name,
    job,
    grade,
    level: 1,
    exp: 0,
    traits,
    equipment: { weapon: null, armor: null, accessory: null },
    baseStats,
  };
}

function getGradePool(appLevel, override) {
  if (override) return [override];
  const pools = [
    ['일반','일반','일반','일반','마법'],   // lv 1
    ['일반','일반','일반','마법','마법'],   // lv 2
    ['일반','일반','마법','마법','희귀'],   // lv 3-4
    ['일반','마법','마법','희귀','희귀'],   // lv 5-6
    ['마법','마법','희귀','희귀','영웅'],   // lv 7-8
    ['마법','희귀','희귀','영웅','전설'],   // lv max
  ];
  const idx = Math.min(Math.floor((appLevel - 1) / 1.5), pools.length - 1);
  return pools[idx];
}

function pickGrade(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickJob() {
  const tierOneJobs = ['warrior', 'rogue', 'mage', 'healer'];
  return tierOneJobs[Math.floor(Math.random() * tierOneJobs.length)];
}

// ===== 서류 갱신 =====
function refreshApplications(isAuto = false) {
  State.applications = [
    generateAdventurer(),
    generateAdventurer(),
    generateAdventurer(),
  ];
  State.lastRecruitTime = Date.now();
  if (isAuto) State.recruitForceCount = 0;
}

function getForceRefreshCost() {
  return Math.floor(500 * Math.pow(2, State.recruitForceCount ?? 0));
}

function forceRefreshApplications() {
  const cost = getForceRefreshCost();
  if (!spendGold(cost)) { showToast('골드가 부족합니다.', 'error'); return false; }
  refreshApplications(false);
  State.recruitForceCount = (State.recruitForceCount ?? 0) + 1;
  showToast(`서류 갱신 완료 (${cost.toLocaleString()} 골드 소비)`, 'success');
  return true;
}

function recruitAdventurer(appIndex) {
  const app = State.applications[appIndex];
  if (!app) return false;
  const maxAdv = getBuildingLevel('lounge') + 2;
  if (State.adventurers.length >= maxAdv) {
    showToast(`대기실이 가득 찼습니다. (최대 ${maxAdv}명)`, 'error'); return false;
  }
  State.adventurers.push(app);
  State.applications.splice(appIndex, 1);
  showToast(`${app.name}(이)가 길드에 합류했습니다!`, 'success');
  return true;
}

// ===== 파견 =====
function getMaxDispatchSlots() {
  return getBuildingLevel('headquarters');
}

function getInventoryCapacity() {
  return getBuildingLevel('warehouse') * 5 + 20;
}

function startDispatch(areaId, teamIds) {
  if (teamIds.length === 0) { showToast('팀원을 1명 이상 선택하세요.', 'error'); return false; }
  if (teamIds.length > 3)   { showToast('팀원은 최대 3명입니다.', 'error'); return false; }
  const area = AREAS.find(a => a.id === areaId);
  if (!area) { showToast('알 수 없는 지역입니다.', 'error'); return false; }
  if (State.dispatches.length >= getMaxDispatchSlots()) {
    showToast('파견 슬롯이 부족합니다. 지휘 본부를 업그레이드하세요.', 'error'); return false;
  }
  if (State.dispatches.find(d => d.areaId === areaId)) {
    showToast('이미 해당 지역에 파견 중입니다.', 'error'); return false;
  }
  // 이미 파견 중인 모험가 체크
  const allDispatched = State.dispatches.flatMap(d => d.team);
  for (const id of teamIds) {
    if (allDispatched.includes(id)) {
      const adv = State.adventurers.find(a => a.id === id);
      showToast(`${adv?.name ?? '모험가'}(은)는 이미 파견 중입니다.`, 'error'); return false;
    }
  }

  const startProg = Math.min(
    getPrestigeBonusTotal('startProgress'),
    Math.floor(area.maxProgress * 0.4)
  );
  const dispatch = {
    areaId,
    team: teamIds,
    startTime: Date.now(),
    accumulated: { gold: 0, materials: { common: 0, advanced: 0, rare: 0, legendary: 0 } },
    progress: startProg,
    partyHp: {},
    combatCooldown: 2,
    lastBattleLog: [],
    isBossEncounter: false,
  };
  State.dispatches.push(dispatch);
  showToast('파견 시작!', 'success');
  return true;
}

function settleDispatch(areaId) {
  const idx = State.dispatches.findIndex(d => d.areaId === areaId);
  if (idx === -1) return null;
  const dispatch = State.dispatches[idx];

  const goldEarned = Math.floor(dispatch.accumulated.gold);
  addGold(goldEarned);

  const matsEarned = {};
  for (const [grade, amt] of Object.entries(dispatch.accumulated.materials || {})) {
    matsEarned[grade] = Math.floor(amt);
    if (matsEarned[grade] > 0) addMaterial(grade, matsEarned[grade]);
  }

  // 최대 진행도 기록
  if (!State.areaProgress[areaId] || dispatch.progress > State.areaProgress[areaId]) {
    State.areaProgress[areaId] = dispatch.progress;
  }

  // 누적 재화만 초기화 — 파티는 귀환하지 않음
  dispatch.accumulated = { gold: 0, materials: { common: 0, advanced: 0, rare: 0, legendary: 0 } };

  return { gold: goldEarned, materials: matsEarned, progress: dispatch.progress };
}

function recallDispatch(areaId) {
  const idx = State.dispatches.findIndex(d => d.areaId === areaId);
  if (idx === -1) return false;
  // 잔여 누적 재화 지급 후 귀환
  const dispatch = State.dispatches[idx];
  addGold(Math.floor(dispatch.accumulated.gold));
  for (const [grade, amt] of Object.entries(dispatch.accumulated.materials || {})) {
    addMaterial(grade, Math.floor(amt));
  }
  State.dispatches.splice(idx, 1);
  showToast('파견 팀이 귀환했습니다.', 'info');
  return true;
}

// 파견 팀의 dispatch 효과 합산 헬퍼
function getTeamDispatchBonus(dispatch, effectId) {
  let bonus = 0;
  for (const advId of dispatch.team) {
    const adv = State.adventurers.find(a => a.id === advId);
    if (!adv) continue;
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const eq = adv.equipment[slot];
      if (!eq || !eq.options) continue;
      for (const opt of eq.options) {
        if (opt.type === 'dispatch' && opt.dispatchEffect === effectId) bonus += opt.value;
      }
    }
  }
  return bonus / 100;
}

function getTeamGoldBonus(dispatch)     { return getTeamDispatchBonus(dispatch, 'goldBonus'); }
function getTeamMaterialBonus(dispatch) { return getTeamDispatchBonus(dispatch, 'materialBonus'); }

// ===== 파견 누적 업데이트 (틱마다 호출) =====
function tickDispatches(deltaSeconds) {
  for (const dispatch of State.dispatches) {
    const area = AREAS.find(a => a.id === dispatch.areaId);
    if (!area) continue;

    // 재화 누적 (장비 옵션 + 프레스티지 성장 가지 반영)
    const goldMult    = (1 + getTeamGoldBonus(dispatch)) * (1 + getPrestigeBonusTotal('goldBonus') / 100) * (1 + getBuffBonus('goldBonus') / 100);
    const materialMult = (1 + getTeamMaterialBonus(dispatch)) * (1 + getPrestigeBonusTotal('materialBonus') / 100) * (1 + getBuffBonus('materialBonus') / 100);
    dispatch.accumulated.gold += area.goldPerSec * deltaSeconds * goldMult;
    const matPerTick = area.materialPerMin * (deltaSeconds / 60) * materialMult;
    const ratios = getMaterialGradeRatios(area.stage);
    for (const [grade, ratio] of Object.entries(ratios)) {
      dispatch.accumulated.materials[grade] = (dispatch.accumulated.materials[grade] || 0) + matPerTick * ratio;
    }

    // 전투 로직 (combat.js)
    initDispatchCombat(dispatch);
    tickDispatchCombat(dispatch, deltaSeconds);
  }
}

function checkAreaUnlocks(silent = false) {
  for (const area of AREAS) {
    if (area.unlocked) continue;
    const cond = area.unlockCondition;
    if (!cond) continue;
    if (cond.areaId) {
      const prog = State.areaProgress[cond.areaId] || 0;
      if (prog >= cond.progress) {
        area.unlocked = true;
        if (!silent) showToast(`새 지역 개방: ${area.name}!`, 'success');
      }
    } else if (cond.anyAreaId) {
      for (const aid of cond.anyAreaId) {
        const prog = State.areaProgress[aid] || 0;
        if (prog >= cond.progress) {
          area.unlocked = true;
          if (!silent) showToast(`새 지역 개방: ${area.name}!`, 'success');
          break;
        }
      }
    }
  }
}

// ===== 모험가 스탯 계산 (장비 포함) =====
function getEffectiveStats(adv) {
  const s = { ...adv.baseStats };
  // 레벨 보정
  const growthRate = 0.08;
  for (const k of Object.keys(s)) {
    s[k] = Math.floor(s[k] * (1 + growthRate * (adv.level - 1)));
  }
  // 특성 보정
  for (const tid of adv.traits) {
    const trait = TRAITS.find(t => t.id === tid);
    if (!trait) continue;
    if (trait.stat === 'multi') {
      for (const [key, val] of Object.entries(trait.effects)) {
        s[key] = Math.floor(s[key] * (1 + val));
      }
    } else {
      s[trait.stat] = Math.floor(s[trait.stat] * (1 + trait.mult));
    }
  }
  // 장비 보정 (기본 스탯)
  if (adv.equipment) {
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const item = adv.equipment[slot];
      if (!item || !item.stats) continue;
      for (const [key, val] of Object.entries(item.stats)) {
        s[key] = (s[key] || 0) + val;
      }
    }
  }
  // 장비 옵션 보정 (stat / stat_pct / stat_scale)
  if (adv.equipment) {
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const item = adv.equipment[slot];
      if (!item || !item.options) continue;
      for (const opt of item.options) {
        if (opt.type === 'stat') {
          s[opt.stat] = (s[opt.stat] || 0) + opt.value;
        } else if (opt.type === 'stat_pct') {
          if (opt.stat === 'all') {
            for (const k of Object.keys(s)) s[k] = Math.floor(s[k] * (1 + opt.value / 100));
          } else {
            s[opt.stat] = Math.floor((s[opt.stat] || 0) * (1 + opt.value / 100));
          }
        } else if (opt.type === 'stat_scale') {
          if (opt.scale === 'def_to_hp') {
            s.hp = (s.hp || 0) + Math.floor(s.def * opt.value);
          } else if (opt.scale === 'hp_to_def') {
            s.def = (s.def || 0) + Math.floor(s.hp / 100 * opt.value);
          }
        }
      }
    }
  }
  // 프레스티지 생존 가지 보정
  const hpBonus  = getPrestigeBonusTotal('hpBonus');
  const defBonus = getPrestigeBonusTotal('defBonus');
  if (hpBonus  > 0) s.hp  = Math.floor(s.hp  * (1 + hpBonus  / 100));
  if (defBonus > 0) s.def = Math.floor(s.def * (1 + defBonus / 100));
  // 리빌딩 횟수 자동 보너스 (매 리빌딩 +3%)
  const rc = State.rebuildCount || 0;
  if (rc > 0) {
    const rebuildMult = 1 + rc * 0.03;
    s.hp  = Math.floor(s.hp  * rebuildMult);
    s.atk = Math.floor(s.atk * rebuildMult);
    s.def = Math.floor(s.def * rebuildMult);
  }
  // 영구 단련 보정 (연구소 구매, 리빌딩 후에도 유지)
  const pt = State.permanentTraining || {};
  if (pt.hp  > 0) s.hp  = Math.floor(s.hp  * (1 + pt.hp  / 100));
  if (pt.atk > 0) s.atk = Math.floor(s.atk * (1 + pt.atk / 100));
  if (pt.def > 0) s.def = Math.floor(s.def * (1 + pt.def / 100));
  return s;
}

// ===== 경험치/레벨업 =====
function giveExp(advId, amount) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) return;
  const expMult = 1 + getPrestigeBonusTotal('expBonus') / 100 + getBuffBonus('expBonus') / 100;
  adv.exp += Math.floor(amount * expMult);
  let needed = expRequired(adv.level);
  const oldMaxHp = getEffectiveStats(adv).hp;
  let didLevelUp = false;
  while (adv.exp >= needed) {
    adv.exp -= needed;
    adv.level++;
    needed = expRequired(adv.level);
    for (const k of Object.keys(adv.baseStats)) {
      if (k !== 'crit' && k !== 'critDmg') adv.baseStats[k] = Math.floor(adv.baseStats[k] * 1.05);
    }
    showToast(`${adv.name} 레벨 업! (Lv.${adv.level})`, 'success');
    didLevelUp = true;
  }

  // 파견 중 레벨업: partyHp를 새 최대 HP에 비례해 갱신
  if (didLevelUp) {
    const newMaxHp = getEffectiveStats(adv).hp;
    if (newMaxHp > oldMaxHp) {
      const ratio = newMaxHp / oldMaxHp;
      for (const dispatch of State.dispatches) {
        if (dispatch.team.includes(advId) && dispatch.partyHp[advId] != null) {
          dispatch.partyHp[advId] = Math.min(newMaxHp, Math.floor(dispatch.partyHp[advId] * ratio));
        }
      }
    }
  }
}

// ===== 모험가 해고 =====
function dismissAdventurer(advId) {
  const idx = State.adventurers.findIndex(a => a.id === advId);
  if (idx === -1) return false;
  const adv = State.adventurers[idx];

  if (getDispatchedAdvIds().has(advId)) {
    showToast('파견 중인 모험가는 해고할 수 없습니다.', 'error');
    return false;
  }

  // 장착 장비 인벤토리로 반환
  for (const slot of ['weapon', 'armor', 'accessory']) {
    if (adv.equipment[slot]) State.inventory.push(adv.equipment[slot]);
  }

  State.adventurers.splice(idx, 1);
  showToast(`${adv.name}을(를) 해고했습니다.`, 'info');
  return true;
}

// ===== 장비 장착/해제 =====
function equipItem(advId, inventoryIdx) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) return;
  const item = State.inventory[inventoryIdx];
  if (!item || !item.slot) return;

  // 무기 직업 제한 검사 (mage와 healer는 지팡이 공유)
  if (item.slot === 'weapon' && item.jobClass) {
    const advBranch = JOBS[adv.job]?.branch;
    const compatible = item.jobClass === advBranch
      || (item.jobClass === 'mage' && advBranch === 'healer')
      || (item.jobClass === 'healer' && advBranch === 'mage');
    if (!compatible) {
      const branchLabel = { warrior: '전사', rogue: '도적', mage: '마법사/치유사' }[item.jobClass] || item.jobClass;
      showToast(`이 무기는 ${branchLabel} 계열 전용입니다.`, 'error');
      return;
    }
  }

  if (adv.equipment[item.slot]) {
    State.inventory.push(adv.equipment[item.slot]);
  }
  adv.equipment[item.slot] = item;
  State.inventory.splice(inventoryIdx, 1);
  showToast(`${item.name} 장착!`, 'success');
}

function unequipItem(advId, slot) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv || !adv.equipment[slot]) return;
  State.inventory.push(adv.equipment[slot]);
  adv.equipment[slot] = null;
  showToast('장비 해제됨', 'info');
}

// ===== 상점 =====
function checkShopRefresh() {
  if (!State.lastShopRefresh || Date.now() - State.lastShopRefresh >= SHOP_REFRESH_INTERVAL) {
    refreshShopRotation();
  }
}

function refreshShopRotation() {
  const pool = [...SHOP_ROTATION_POOL];
  const selected = [];
  const SLOT_LABELS = { weapon: '무기', armor: '방어구', accessory: '악세서리' };
  for (let i = 0; i < 4 && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) { picked = j; break; }
    }
    const raw = pool.splice(picked, 1)[0];
    const entry = { ...raw, sold: false };
    if (raw.type === 'equipment') {
      const eq = generateEquipment(raw.slot, raw.grade);
      entry.equipment = eq;
      entry.name = eq.name;
      entry.icon = eq.icon;
      entry.desc = `${raw.grade}급 ${SLOT_LABELS[raw.slot] || raw.slot}`;
    }
    selected.push(entry);
  }
  State.shopRotation = selected;
  State.lastShopRefresh = Date.now();
  saveState();
}

function forceRefreshShop() {
  const cost = 2000;
  if (!spendGold(cost)) { showToast('골드가 부족합니다.', 'error'); return false; }
  refreshShopRotation();
  showToast('상점 갱신 완료!', 'success');
  return true;
}

function buyShopPermanent(itemId) {
  const item = SHOP_PERMANENT.find(i => i.id === itemId);
  if (!item) return false;
  if (!spendGold(item.price)) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (item.type === 'material_pack') {
    for (const [grade, amt] of Object.entries(item.materials)) addMaterial(grade, amt);
    showToast(`${item.name} 구매 완료!`, 'success');
  } else if (item.type === 'consumable') {
    applyBuff(item);
    showToast(`${item.name} 사용!`, 'success');
  }
  saveState();
  return true;
}

function buyShopRotation(index) {
  const item = State.shopRotation[index];
  if (!item || item.sold) return false;
  if (!spendGold(item.price)) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (item.type === 'equipment') {
    if (State.inventory.length >= getInventoryCapacity()) {
      showToast('창고가 가득 찼습니다.', 'error');
      refundGold(item.price);
      return false;
    }
    State.inventory.push(item.equipment);
    showToast(`${item.name} 구매 완료!`, 'success');
  } else if (item.type === 'material_pack') {
    for (const [grade, amt] of Object.entries(item.materials)) addMaterial(grade, amt);
    showToast(`${item.name} 구매 완료!`, 'success');
  } else if (item.type === 'consumable') {
    applyBuff(item);
    showToast(`${item.name} 사용!`, 'success');
  }
  item.sold = true;
  saveState();
  return true;
}

// ===== 소모품 버프 =====
function applyBuff(item) {
  if (!State.activeBuffs) State.activeBuffs = [];
  State.activeBuffs = State.activeBuffs.filter(b => b.effect !== item.effect);
  State.activeBuffs.push({
    id: item.id || item.effect,
    name: item.name,
    effect: item.effect,
    value: item.value,
    expiresAt: Date.now() + item.duration * 1000,
  });
}

function tickBuffs() {
  if (!State.activeBuffs || State.activeBuffs.length === 0) return;
  const now = Date.now();
  const before = State.activeBuffs.length;
  State.activeBuffs = State.activeBuffs.filter(b => b.expiresAt > now);
  if (State.activeBuffs.length < before) {
    showToast('부스트 효과가 만료되었습니다.', 'info');
  }
}

function getBuffBonus(effectType) {
  let total = 0;
  for (const b of (State.activeBuffs || [])) {
    if (b.effect === effectType && b.expiresAt > Date.now()) total += b.value;
  }
  return total;
}

// ===== 장비 판매 / 분해 =====
const SELL_PRICES    = { '일반': 80, '마법': 350, '희귀': 1500, '영웅': 6000, '전설': 25000, '신화': 100000 };
const DISMANTLE_MATS = { '일반': 1,  '마법': 3,   '희귀': 10,   '영웅': 30,   '전설': 100,   '신화': 350 };

function sellEquipment(idx) {
  const item = State.inventory[idx];
  if (!item || !item.slot) return;
  const gold = SELL_PRICES[item.grade] || 80;
  State.inventory.splice(idx, 1);
  addGold(gold);
  saveState();
  showToast(`${item.name} 판매 → 💰 ${gold.toLocaleString()} 골드`, 'success');
}

function dismantleEquipment(idx) {
  const item = State.inventory[idx];
  if (!item || !item.slot) return;
  const mat = DISMANTLE_MATS[item.grade] || 1;
  State.inventory.splice(idx, 1);
  addMaterial('common', mat);
  saveState();
  showToast(`${item.name} 분해 → 💎 일반 재료 ${mat}`, 'success');
}

// ===== 현재 파견 중인 모험가 ID 집합 =====
function getDispatchedAdvIds() {
  return new Set(State.dispatches.flatMap(d => d.team));
}

// ===== 연구소 =====
function startCraft(recipeId, qty = 1) {
  if (State.labQueue) { showToast('이미 제작 중입니다.', 'error'); return false; }
  const recipe = LAB_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return false;
  const labLv = getBuildingLevel('workshop');
  if (labLv < recipe.reqLabLv) { showToast(`공방 레벨 ${recipe.reqLabLv} 이상 필요합니다.`, 'error'); return false; }
  const totalGold = recipe.cost.gold * qty;
  const totalMats = {};
  for (const [g, n] of Object.entries(recipe.cost.materials)) totalMats[g] = n * qty;
  if (!spendGold(totalGold)) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (!spendMaterials(totalMats)) {
    refundGold(totalGold);
    showToast('재료가 부족합니다.', 'error'); return false;
  }
  const speedMult = (100 + labLv * 10) / 100;
  const totalMs = Math.floor(recipe.craftTime * qty / speedMult) * 1000;
  State.labQueue = {
    recipeId,
    quantity: qty,
    name: recipe.name + (qty > 1 ? ` ×${qty}` : ''),
    icon: recipe.icon,
    grade: recipe.grade,
    expValue: recipe.expValue,
    startAt: Date.now(),
    finishAt: Date.now() + totalMs,
    totalMs,
  };
  saveState();
  showToast(`${recipe.name} ×${qty} 제작 시작!`, 'success');
  return true;
}

function cancelCraft() {
  if (!State.labQueue) return false;
  const q = State.labQueue;
  const qty = q.quantity || 1;
  if (q.type === 'synthesis') {
    for (const [grade, amt] of Object.entries(q.refundMaterials || {})) addMaterial(grade, amt);
  } else {
    const recipe = LAB_RECIPES.find(r => r.id === q.recipeId);
    if (recipe) {
      refundGold(recipe.cost.gold * qty);
      for (const [grade, amt] of Object.entries(recipe.cost.materials || {})) addMaterial(grade, amt * qty);
    }
  }
  State.labQueue = null;
  saveState();
  showToast('제작을 취소했습니다. 재료를 전액 환불받았습니다.', 'info');
  return true;
}

function tickLab() {
  if (!State.labQueue) return;
  if (Date.now() >= State.labQueue.finishAt) {
    const q = State.labQueue;
    const qty = q.quantity || 1;
    if (q.type === 'synthesis') {
      for (const [grade, amt] of Object.entries(q.output)) addMaterial(grade, amt);
      showToast(`${q.name} 완료! 재료를 획득했습니다.`, 'success');
    } else {
      for (let i = 0; i < qty; i++) {
        State.inventory.push({ type: 'exp_book', name: q.name.replace(/ ×\d+$/, ''), icon: q.icon, grade: q.grade, expValue: q.expValue });
      }
      showToast(`${q.name} 제작 완료! ${qty > 1 ? qty + '개 ' : ''}인벤토리에 추가됐습니다.`, 'success');
    }
    State.labQueue = null;
    saveState();
    if (typeof renderLabTab === 'function' && getCurrentTab() === 'lab') renderLabTab();
  }
}

// ===== 재료 합성 =====
function startSynthesis(recipeId, qty = 1) {
  if (State.labQueue) { showToast('이미 제작 중입니다.', 'error'); return false; }
  const recipe = SYNTHESIS_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return false;
  const totalInput = {};
  for (const [g, n] of Object.entries(recipe.input)) totalInput[g] = n * qty;
  if (!spendMaterials(totalInput)) { showToast('재료가 부족합니다.', 'error'); return false; }
  const labLv = getBuildingLevel('workshop');
  const speedMult = (100 + labLv * 10) / 100;
  const totalMs = Math.floor(recipe.craftTime * qty / speedMult) * 1000;
  const now = Date.now();
  const totalOutput = {};
  for (const [g, n] of Object.entries(recipe.output)) totalOutput[g] = n * qty;
  State.labQueue = {
    type: 'synthesis',
    recipeId,
    quantity: qty,
    name: recipe.name + (qty > 1 ? ` ×${qty}` : ''),
    startAt: now,
    finishAt: now + totalMs,
    totalMs,
    output: totalOutput,
    refundMaterials: totalInput,
  };
  saveState();
  showToast(`${recipe.name} ×${qty} 시작!`, 'success');
  return true;
}

// ===== 장비 즉시 제작 =====
function craftEquipment(slot, materialGrade, qty = 1) {
  const recipe = CRAFT_RECIPES.find(r => r.materialGrade === materialGrade);
  if (!recipe) return null;
  const totalMat = recipe.matCost * qty;
  const totalGold = recipe.gold * qty;
  if ((State.materials[materialGrade] || 0) < totalMat) {
    showToast('재료가 부족합니다.', 'error'); return null;
  }
  if (!spendGold(totalGold)) { showToast('골드가 부족합니다.', 'error'); return null; }
  if (State.inventory.length + qty > getInventoryCapacity()) {
    showToast('창고 공간이 부족합니다.', 'error');
    refundGold(totalGold);
    return null;
  }
  State.materials[materialGrade] -= totalMat;

  const results = [];
  for (let i = 0; i < qty; i++) {
    let roll = Math.random(), cum = 0, grade = recipe.grades[recipe.grades.length - 1];
    for (let j = 0; j < recipe.grades.length; j++) {
      cum += recipe.ratios[j];
      if (roll < cum) { grade = recipe.grades[j]; break; }
    }
    results.push(generateEquipment(slot, grade));
  }
  State.inventory.push(...results);
  saveState();
  return results;
}

// ===== 프레스티지(리빌딩) =====

function getPrestigeBonusTotal(key) {
  let total = 0;
  for (const nodeId of (State.prestigeNodes || [])) {
    const node = PRESTIGE_NODES.find(n => n.id === nodeId);
    if (node?.effect?.[key]) total += node.effect[key];
  }
  return total;
}

function hasPrestigeEffect(key) {
  for (const nodeId of (State.prestigeNodes || [])) {
    const node = PRESTIGE_NODES.find(n => n.id === nodeId);
    if (node?.effect?.[key]) return true;
  }
  return false;
}

function calcTotalEarnablePoints() {
  return Math.floor(Math.sqrt((State.lifetimeGold || 0) / 25000));
}

function canRebuild() {
  return REBUILD_CONDITIONS.every(c => c.check());
}

function doRebuild() {
  const totalEarnable = calcTotalEarnablePoints();
  const newPoints = Math.max(0, totalEarnable - (State.totalPrestigeEarned || 0));

  const keepData = {
    lifetimeGold:         State.lifetimeGold         || 0,
    prestigePoints:       (State.prestigePoints       || 0) + newPoints,
    totalPrestigeEarned:  totalEarnable,
    prestigeNodes:        [...(State.prestigeNodes    || [])],
    rebuildCount:         (State.rebuildCount         || 0) + 1,
    tutorialDone:         true,
    permanentTraining:    { ...(State.permanentTraining || { hp: 0, atk: 0, def: 0 }) },
  };

  State = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_STATE)), keepData);
  saveState();
  showToast(`리빌딩 완료! 스킬포인트 +${newPoints} 획득`, 'success');
  if (typeof renderTab === 'function') renderTab(getCurrentTab());
  if (typeof renderHeader === 'function') renderHeader();
}

function spendPrestigeNode(nodeId) {
  const node = PRESTIGE_NODES.find(n => n.id === nodeId);
  if (!node) return false;
  if ((State.prestigeNodes || []).includes(nodeId)) {
    showToast('이미 개방된 노드입니다.', 'error'); return false;
  }
  if (node.requires && !(State.prestigeNodes || []).includes(node.requires)) {
    showToast('이전 노드를 먼저 개방해야 합니다.', 'error'); return false;
  }
  if ((State.prestigePoints || 0) < node.cost) {
    showToast(`스킬포인트가 부족합니다. (필요: ${node.cost})`, 'error'); return false;
  }
  State.prestigePoints -= node.cost;
  State.prestigeNodes  = [...(State.prestigeNodes || []), nodeId];
  saveState();
  showToast(`[${node.name}] 개방!`, 'success');
  return true;
}

// ===== 영구 단련 =====
function getPermanentTrainingCost(statId) {
  const tr = PERMANENT_TRAINING.find(t => t.id === statId);
  if (!tr) return Infinity;
  const lv = (State.permanentTraining || {})[statId] || 0;
  return Math.floor(tr.baseCost * Math.pow(tr.costMult, lv));
}

function buyPermanentTraining(statId) {
  const tr = PERMANENT_TRAINING.find(t => t.id === statId);
  if (!tr) return false;
  const cost = getPermanentTrainingCost(statId);
  if ((State.gold || 0) < cost) {
    showToast('골드가 부족합니다.', 'error'); return false;
  }
  State.gold -= cost;
  if (!State.permanentTraining) State.permanentTraining = { hp: 0, atk: 0, def: 0 };
  State.permanentTraining[statId] = (State.permanentTraining[statId] || 0) + 1;
  saveState();
  showToast(`[${tr.name}] Lv.${State.permanentTraining[statId]} 달성!`, 'success');
  return true;
}
