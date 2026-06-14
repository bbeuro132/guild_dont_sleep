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
  recruitInterval: 5 * 60 * 1000, // 5분

  tutorialStep: 0,
  tutorialDone: false,

  lastSaveTime: 0,
  totalPlayTime: 0,
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

    const gold = area.goldPerSec * elapsed;
    const mat  = area.materialPerMin * (elapsed / 60);
    totalGold += gold;
    totalMat  += mat;

    dispatch.accumulated.gold     += gold;
    dispatch.accumulated.material += mat;

    // 진행도 누적 (대략 4초당 1진행도)
    const progressGain = Math.floor(elapsed / 4);
    const prevProgress = Math.floor(dispatch.progress);
    dispatch.progress += progressGain;
    if (dispatch.progress >= area.maxProgress) {
      dispatch.progress = area.maxProgress;
      State.areaProgress[area.id] = area.maxProgress;
    }

    areaResults.push({
      name: area.name,
      icon: area.icon,
      gold: Math.floor(gold),
      mat:  Math.floor(mat),
      progressFrom: prevProgress,
      progressTo:   Math.floor(dispatch.progress),
      maxProgress:  area.maxProgress,
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
  State.gold = Math.max(0, State.gold + Math.floor(amount));
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

  return {
    id: State.nextAdvId++,
    name,
    job,
    grade,
    level: 1,
    exp: 0,
    traits,
    equipment: { weapon: null, armor: null, accessory: null },
    baseStats: {
      hp:      Math.floor((60 + Math.random() * 40) * baseMult),
      atk:     Math.floor((12 + Math.random() * 8)  * baseMult),
      def:     Math.floor((6  + Math.random() * 6)  * baseMult),
      spd:     Math.floor((8  + Math.random() * 6)  * baseMult),
      crit:    Math.floor((5  + Math.random() * 10) * baseMult),
      critDmg: Math.floor((150 + Math.random() * 50)),
    },
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
  const tierOneJobs = ['warrior', 'rogue', 'mage'];
  return tierOneJobs[Math.floor(Math.random() * tierOneJobs.length)];
}

// ===== 서류 갱신 =====
function refreshApplications() {
  State.applications = [
    generateAdventurer(),
    generateAdventurer(),
    generateAdventurer(),
  ];
  State.lastRecruitTime = Date.now();
}

function forceRefreshApplications() {
  const cost = 500;
  if (!spendGold(cost)) { showToast('골드가 부족합니다.', 'error'); return false; }
  refreshApplications();
  showToast('서류가 갱신되었습니다.', 'success');
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

function startDispatch(areaId, teamIds) {
  if (teamIds.length === 0) { showToast('팀원을 1명 이상 선택하세요.', 'error'); return false; }
  if (teamIds.length > 3)   { showToast('팀원은 최대 3명입니다.', 'error'); return false; }
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

  const dispatch = {
    areaId,
    team: teamIds,
    startTime: Date.now(),
    accumulated: { gold: 0, material: 0, items: [] },
    progress: 0,
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

// 파견 팀의 골드 보너스 합산 (악세서리 옵션 ac_gold)
function getTeamGoldBonus(dispatch) {
  let bonus = 0;
  for (const advId of dispatch.team) {
    const adv = State.adventurers.find(a => a.id === advId);
    if (!adv) continue;
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const eq = adv.equipment[slot];
      if (!eq || !eq.options) continue;
      for (const opt of eq.options) {
        if (opt.type === 'dispatch' && opt.dispatchEffect === 'goldBonus') bonus += opt.value;
      }
    }
  }
  return bonus / 100;
}

// ===== 파견 누적 업데이트 (틱마다 호출) =====
function tickDispatches(deltaSeconds) {
  for (const dispatch of State.dispatches) {
    const area = AREAS.find(a => a.id === dispatch.areaId);
    if (!area) continue;

    // 재화 누적 (골드 보너스 옵션 반영)
    const goldMult = 1 + getTeamGoldBonus(dispatch);
    dispatch.accumulated.gold     += area.goldPerSec * deltaSeconds * goldMult;
    dispatch.accumulated.material += area.materialPerMin * (deltaSeconds / 60);

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
  return s;
}

// ===== 경험치/레벨업 =====
function giveExp(advId, amount) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) return;
  adv.exp += amount;
  let needed = expRequired(adv.level);
  while (adv.exp >= needed) {
    adv.exp -= needed;
    adv.level++;
    needed = expRequired(adv.level);
    // 레벨업 스탯 성장
    for (const k of Object.keys(adv.baseStats)) {
      if (k !== 'crit' && k !== 'critDmg') adv.baseStats[k] = Math.floor(adv.baseStats[k] * 1.05);
    }
    showToast(`${adv.name} 레벨 업! (Lv.${adv.level})`, 'success');
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
    const eq = generateEquipment(item.slot, item.grade);
    State.inventory.push(eq);
    showToast(`${eq.name} 구매 완료! (모험가 상세에서 장착)`, 'success');
  }
  return true;
}

// ===== 현재 파견 중인 모험가 ID 집합 =====
function getDispatchedAdvIds() {
  return new Set(State.dispatches.flatMap(d => d.team));
}
