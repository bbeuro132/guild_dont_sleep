// ===== state.js: 게임 상태 관리 =====

const DEFAULT_STATE = {
  gold: 500,
  materials: 5,
  inventory: [],       // 장비 아이템 목록

  buildings: {
    headquarters: 1,
    lounge: 1,
    application: 1,
    warehouse: 1,
    laboratory: 1,
  },

  adventurers: [],     // 보유 모험가 목록
  nextAdvId: 1,

  dispatches: [],      // 활성 파견 목록 [{areaId, team:[advId], startTime, accumulated:{gold,material,items}, progress}]
  areaProgress: {},    // {areaId: maxProgressEver}

  applications: [],    // 현재 서류함 (최대 3장)
  lastRecruitTime: 0,  // 마지막 서류 갱신 시각 (ms)
  recruitInterval: 15 * 60 * 1000, // 15분
  recruitForceCount: 0, // 자동 갱신 이후 수동 갱신 횟수 (비용 계산용)

  tutorialStep: 0,
  tutorialDone: false,

  labQueue: null,       // {recipeId, name, icon, grade, expValue, startAt, finishAt, totalMs}

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

    // 패시브 수입 (시간 비례)
    const gold = area.goldPerSec * elapsed;
    const mat  = area.materialPerMin * (elapsed / 60);

    // 파티 전투력 기반 전투 결과 추정
    const totalBattles = Math.floor(elapsed / COMBAT_INTERVAL);
    const winRate      = estimateOfflineWinRate(dispatch, area);
    const wins         = Math.floor(totalBattles * winRate);
    const bossBattles  = Math.floor(wins * 0.05); // 승리 중 ~5%가 보스
    const normWins     = wins - bossBattles;

    const killGold = wins * area.stage * 2 * 1.5;
    const killMat  = wins * area.stage * 0.04;

    totalGold += gold + killGold;
    totalMat  += mat  + killMat;

    dispatch.accumulated.gold     += gold + killGold;
    dispatch.accumulated.material += mat  + killMat;

    // 장비 드롭 (승리 횟수 기준)
    const expectedDrops = normWins * EQUIP_DROP_CHANCE + bossBattles * EQUIP_BOSS_DROP_CHANCE;
    const dropCount = Math.floor(expectedDrops) + (Math.random() < (expectedDrops % 1) ? 1 : 0);

    const droppedItems = [];
    const pool = EQUIP_GRADE_POOLS[getEquipGradePoolIdx(area.stage)];
    for (let i = 0; i < dropCount; i++) {
      const slot  = EQUIP_SLOTS[Math.floor(Math.random() * EQUIP_SLOTS.length)];
      const grade = pool[Math.floor(Math.random() * pool.length)];
      const eq    = generateEquipment(slot, grade);
      if (State.inventory.length < getInventoryCapacity()) {
        State.inventory.push(eq);
        droppedItems.push(eq);
      } else {
        const sellGold = EQUIP_SELL_GOLD[grade] || 50;
        totalGold += sellGold;
        dispatch.accumulated.gold += sellGold;
        droppedItems.push({ ...eq, autoSold: true, sellGold });
      }
    }

    // 진행도: 승리 횟수 = 진행도 상승 (온라인과 동일 기준)
    const prevProgress = Math.floor(dispatch.progress);
    dispatch.progress = Math.min(dispatch.progress + wins, area.maxProgress);
    if (dispatch.progress >= area.maxProgress) {
      State.areaProgress[area.id] = area.maxProgress;
    }

    areaResults.push({
      name: area.name,
      icon: area.icon,
      gold: Math.floor(gold + killGold),
      mat:  Math.floor(mat  + killMat),
      progressFrom: prevProgress,
      progressTo:   Math.floor(dispatch.progress),
      maxProgress:  area.maxProgress,
      winRate:      Math.round(winRate * 100),
      wins,
      totalBattles,
      items: droppedItems,
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

function addMaterial(amount) {
  State.materials += amount;
}

function spendMaterial(amount) {
  if (State.materials < amount) return false;
  State.materials -= amount;
  return true;
}

// ===== 건물 =====
function getBuildingLevel(id) {
  return State.buildings[id] || 1;
}

function getBuildingUpgradeCost(building) {
  const lv = getBuildingLevel(building.id);
  const goldCost  = Math.floor(building.baseCost.gold * Math.pow(building.costMult, lv - 1));
  const matCost   = Math.floor(building.baseCost.material * Math.pow(building.costMult, lv - 1));
  return { gold: goldCost, material: matCost };
}

function upgradeBuilding(buildingId) {
  const building = BUILDINGS.find(b => b.id === buildingId);
  if (!building) return false;
  const lv = getBuildingLevel(buildingId);
  if (building.maxLevel && lv >= building.maxLevel) {
    showToast('이미 최대 레벨입니다.', 'error'); return false;
  }
  const cost = getBuildingUpgradeCost(building);
  if (State.gold < cost.gold) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (State.materials < cost.material) { showToast('재료가 부족합니다.', 'error'); return false; }
  State.gold -= cost.gold;
  State.materials -= cost.material;
  State.buildings[buildingId] = lv + 1;
  showToast(`${building.name} 레벨 ${lv + 1} 업그레이드!`, 'success');
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

  const traitCount = Math.random() < 0.4 ? 2 : 1;
  const shuffledTraits = [...TRAITS].sort(() => Math.random() - 0.5);
  const traits = shuffledTraits.slice(0, traitCount).map(t => t.id);

  const baseStats = {
    hp:      Math.floor((60 + Math.random() * 40) * baseMult),
    atk:     Math.floor((12 + Math.random() * 8)  * baseMult),
    def:     Math.floor((6  + Math.random() * 6)  * baseMult),
    spd:     Math.floor((8  + Math.random() * 6)  * baseMult),
    crit:    Math.floor((5  + Math.random() * 10) * baseMult),
    critDmg: Math.floor((150 + Math.random() * 50)),
  };

  // 치유사 계열: 속도 절반, HP 소폭 증가 (항상 후순위 행동)
  if (jobInfo.branch === 'healer') {
    baseStats.spd = Math.floor(baseStats.spd * 0.5);
    baseStats.hp  = Math.floor(baseStats.hp  * 1.2);
  }

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
  return getBuildingLevel('warehouse') * 5 + 10;
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
    accumulated: { gold: 0, material: 0, items: [] },
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
  const matEarned  = Math.floor(dispatch.accumulated.material);

  addGold(goldEarned);
  addMaterial(matEarned);

  // 최대 진행도 기록
  if (!State.areaProgress[areaId] || dispatch.progress > State.areaProgress[areaId]) {
    State.areaProgress[areaId] = dispatch.progress;
  }

  // 누적 재화만 초기화 — 파티는 귀환하지 않음
  dispatch.accumulated = { gold: 0, material: 0, items: [] };

  return { gold: goldEarned, material: matEarned, items: [], progress: dispatch.progress };
}

function recallDispatch(areaId) {
  const idx = State.dispatches.findIndex(d => d.areaId === areaId);
  if (idx === -1) return false;
  // 잔여 누적 재화 지급 후 귀환
  const dispatch = State.dispatches[idx];
  addGold(Math.floor(dispatch.accumulated.gold));
  addMaterial(Math.floor(dispatch.accumulated.material));
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
    const goldMult    = (1 + getTeamGoldBonus(dispatch)) * (1 + getPrestigeBonusTotal('goldBonus') / 100);
    const materialMult = (1 + getTeamMaterialBonus(dispatch)) * (1 + getPrestigeBonusTotal('materialBonus') / 100);
    dispatch.accumulated.gold     += area.goldPerSec * deltaSeconds * goldMult;
    dispatch.accumulated.material += area.materialPerMin * (deltaSeconds / 60) * materialMult;

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
  const expMult = 1 + getPrestigeBonusTotal('expBonus') / 100;
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

  // 무기 직업 제한 검사
  if (item.slot === 'weapon' && item.jobClass) {
    const advBranch = JOBS[adv.job]?.branch;
    if (item.jobClass !== advBranch) {
      const branchLabel = { warrior: '전사', rogue: '도적', mage: '마법사' }[item.jobClass] || item.jobClass;
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

// ===== 상점 구매 =====
function buyShopItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return false;
  if (!spendGold(item.price)) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (item.type === 'material') {
    addMaterial(item.amount);
    showToast(`${item.name} 구매 완료!`, 'success');
  } else if (item.type === 'exp_book') {
    State.inventory.push({ type: 'exp_book', expValue: item.expValue, name: item.name, icon: item.icon });
    showToast(`${item.name} 구매 완료!`, 'success');
  } else if (item.type === 'equipment') {
    if (State.inventory.length >= getInventoryCapacity()) {
      showToast('창고가 가득 찼습니다. 창고를 업그레이드하거나 아이템을 정리하세요.', 'error');
      addGold(item.price); // 골드 환불
      return false;
    }
    const eq = generateEquipment(item.slot, item.grade, item.branch || null);
    State.inventory.push(eq);
    showToast(`${eq.name} 구매 완료! (모험가 상세에서 장착)`, 'success');
  }
  return true;
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
  addMaterial(mat);
  saveState();
  showToast(`${item.name} 분해 → 💎 재료 ${mat}`, 'success');
}

// ===== 현재 파견 중인 모험가 ID 집합 =====
function getDispatchedAdvIds() {
  return new Set(State.dispatches.flatMap(d => d.team));
}

// ===== 연구소 =====
function startCraft(recipeId) {
  if (State.labQueue) { showToast('이미 제작 중입니다.', 'error'); return false; }
  const recipe = LAB_RECIPES.find(r => r.id === recipeId);
  if (!recipe) return false;
  const labLv = getBuildingLevel('laboratory');
  if (labLv < recipe.reqLabLv) { showToast(`연구소 레벨 ${recipe.reqLabLv} 이상 필요합니다.`, 'error'); return false; }
  if (!spendGold(recipe.cost.gold)) { showToast('골드가 부족합니다.', 'error'); return false; }
  if (!spendMaterial(recipe.cost.material)) {
    addGold(recipe.cost.gold);
    showToast('재료가 부족합니다.', 'error'); return false;
  }
  const speedMult = (100 + labLv * 10) / 100;
  const totalMs = Math.floor(recipe.craftTime / speedMult) * 1000;
  State.labQueue = {
    recipeId,
    name: recipe.name,
    icon: recipe.icon,
    grade: recipe.grade,
    expValue: recipe.expValue,
    startAt: Date.now(),
    finishAt: Date.now() + totalMs,
    totalMs,
  };
  saveState();
  showToast(`${recipe.name} 제작 시작!`, 'success');
  return true;
}

function cancelCraft() {
  if (!State.labQueue) return false;
  const recipe = LAB_RECIPES.find(r => r.id === State.labQueue.recipeId);
  if (recipe) {
    addGold(recipe.cost.gold);
    addMaterial(recipe.cost.material);
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
    State.inventory.push({ type: 'exp_book', name: q.name, icon: q.icon, grade: q.grade, expValue: q.expValue });
    State.labQueue = null;
    saveState();
    showToast(`${q.name} 제작 완료! 인벤토리에 추가됐습니다.`, 'success');
    if (typeof renderLabTab === 'function' && getCurrentTab() === 'lab') renderLabTab();
  }
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
