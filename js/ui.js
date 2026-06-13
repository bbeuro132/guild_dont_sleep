// ===== ui.js: UI 렌더링 =====

// ===== 토스트 알림 =====
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== 헤더 업데이트 =====
function renderHeader() {
  document.getElementById('gold-amount').textContent    = Math.floor(State.gold).toLocaleString();
  document.getElementById('material-amount').textContent = Math.floor(State.materials).toLocaleString();
}

// ===== 탭 전환 =====
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
  renderTab(tabId);
}

function renderTab(tabId) {
  switch (tabId) {
    case 'guild':       renderGuildTab();       break;
    case 'adventurer':  renderAdventurerTab();  break;
    case 'dispatch':    renderDispatchTab();    break;
    case 'recruit':     renderRecruitTab();     break;
    case 'shop':        renderShopTab();        break;
  }
}

function getCurrentTab() {
  const active = document.querySelector('.tab-btn.active');
  return active ? active.dataset.tab : 'guild';
}

// ===== 길드 탭 =====
function renderGuildTab() {
  const grid = document.getElementById('buildings-grid');
  grid.innerHTML = '';

  for (const building of BUILDINGS) {
    const lv   = getBuildingLevel(building.id);
    const cost = getBuildingUpgradeCost(building);
    const canAfford = State.gold >= cost.gold && State.materials >= cost.material;
    const maxed = building.maxLevel && lv >= building.maxLevel;

    const card = document.createElement('div');
    card.className = 'building-card';
    card.innerHTML = `
      <div class="building-header">
        <div class="building-name">${building.icon} ${building.name}</div>
        <div class="building-level">Lv.${lv}${maxed ? ' (MAX)' : ''}</div>
      </div>
      <div class="building-desc">${building.desc}</div>
      <div class="building-effect">✨ ${building.effectLabel(lv)}</div>
      ${maxed ? '<p style="color:#888;font-size:0.8rem;text-align:center">최대 레벨 달성</p>' : `
        <div class="building-cost">
          <span class="cost-chip"><img src="assets/items/E_Gold01.png" alt="골드"> ${cost.gold.toLocaleString()}</span>
          <span class="cost-chip"><img src="assets/items/I_Crystal01.png" alt="재료"> ${cost.material}</span>
        </div>
        <button class="btn ${canAfford ? 'btn-gold' : 'btn-outline'} btn-full"
          ${canAfford ? '' : 'disabled'}
          onclick="upgradeBuilding('${building.id}'); renderGuildTab(); renderHeader();">
          업그레이드 →
        </button>
      `}
    `;
    grid.appendChild(card);
  }
}

// ===== 모험가 탭 =====
let selectedAdvId = null;

function renderAdventurerTab() {
  const maxAdv = getBuildingLevel('lounge') + 2;
  document.getElementById('adv-count').textContent = `${State.adventurers.length} / ${maxAdv}`;

  const list = document.getElementById('adventurer-list');
  list.innerHTML = '';

  if (State.adventurers.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🗡️</div><p>아직 길드에 합류한 모험가가 없습니다.<br>모집 탭에서 모험가를 영입해 보세요!</p></div>';
    return;
  }

  const dispatched = getDispatchedAdvIds();

  for (const adv of State.adventurers) {
    const jobInfo = JOBS[adv.job];
    const stats   = getEffectiveStats(adv);
    const isDispatched = dispatched.has(adv.id);
    const isSelected   = selectedAdvId === adv.id;

    const card = document.createElement('div');
    card.className = `adventurer-card${isSelected ? ' selected' : ''}${isDispatched ? ' dispatched' : ''}`;
    card.onclick = () => {
      selectedAdvId = selectedAdvId === adv.id ? null : adv.id;
      renderAdventurerTab();
    };

    const traitBadges = adv.traits.map(tid => {
      const t = TRAITS.find(x => x.id === tid);
      return t ? `<span class="trait-badge" title="${t.desc}">${t.name}</span>` : '';
    }).join('');

    card.innerHTML = `
      <span class="adv-status-badge ${isDispatched ? 'status-dispatched' : 'status-idle'}">
        ${isDispatched ? '파견 중' : '대기'}
      </span>
      <div class="adv-card-header">
        <span class="adv-job-badge ${jobInfo.cssClass}">${jobInfo.name}</span>
        <span style="font-size:0.75rem;color:#888">Lv.${adv.level}</span>
      </div>
      <div class="adv-name">${adv.name}</div>
      <div class="adv-grade" style="font-size:0.75rem;margin-bottom:6px;color:${gradeColor(adv.grade)};font-weight:bold">${adv.grade}급</div>
      <div class="adv-stats-mini">
        <div class="stat-mini"><span>HP</span><span class="stat-val">${stats.hp}</span></div>
        <div class="stat-mini"><span>공격</span><span class="stat-val">${stats.atk}</span></div>
        <div class="stat-mini"><span>방어</span><span class="stat-val">${stats.def}</span></div>
        <div class="stat-mini"><span>속도</span><span class="stat-val">${stats.spd}</span></div>
      </div>
      <div class="adv-traits">${traitBadges}</div>
    `;
    list.appendChild(card);
  }

  // 상세 패널
  renderAdvDetail(selectedAdvId);
}

function renderAdvDetail(advId) {
  const panel = document.getElementById('adv-detail-panel');
  if (!advId) { panel.classList.add('hidden'); return; }
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) { panel.classList.add('hidden'); return; }

  panel.classList.remove('hidden');
  const jobInfo = JOBS[adv.job];
  const stats   = getEffectiveStats(adv);
  const expNeed = expRequired(adv.level);
  const expPct  = Math.min(100, (adv.exp / expNeed * 100)).toFixed(1);

  const promoTargets = JOB_PROMOTIONS[adv.job] || [];
  const promoCostTier = jobInfo.tier === 1 ? 'tier2' : 'tier3';
  const promoCost = PROMOTION_COST[promoCostTier];

  const promoButtons = promoTargets.map(pJob => {
    const pInfo = JOBS[pJob];
    const canPromo = adv.level >= promoCost.level
      && State.gold >= promoCost.gold
      && State.materials >= promoCost.material;
    return `<button class="btn btn-primary" ${canPromo ? '' : 'disabled'}
      onclick="promoteAdventurer(${adv.id}, '${pJob}'); renderAdventurerTab()">
      → ${pInfo.name}
    </button>`;
  }).join('');

  const traitHtml = adv.traits.map(tid => {
    const t = TRAITS.find(x => x.id === tid);
    return t ? `<span class="trait-badge">${t.name}: ${t.desc}</span>` : '';
  }).join('');

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>
        <div style="font-size:1.2rem;font-weight:bold;color:var(--brown-dark)">${adv.name}</div>
        <div style="font-size:0.85rem;color:${gradeColor(adv.grade)};font-weight:bold">${adv.grade}급 · <span class="${jobInfo.cssClass}" style="padding:2px 8px;border-radius:6px;color:white;font-size:0.8rem">${jobInfo.name}</span></div>
      </div>
      <button class="btn btn-outline" style="font-size:0.8rem;padding:6px 12px"
        onclick="selectedAdvId=null;renderAdventurerTab()">✕ 닫기</button>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:0.8rem;color:#888;margin-bottom:3px">경험치 Lv.${adv.level} (${adv.exp}/${expNeed})</div>
      <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${expPct}%"></div></div>
    </div>
    <div class="detail-stats-grid">
      <div class="stat-block"><div class="stat-name">HP</div><div class="stat-value">${stats.hp}</div></div>
      <div class="stat-block"><div class="stat-name">공격력</div><div class="stat-value">${stats.atk}</div></div>
      <div class="stat-block"><div class="stat-name">방어력</div><div class="stat-value">${stats.def}</div></div>
      <div class="stat-block"><div class="stat-name">속도</div><div class="stat-value">${stats.spd}</div></div>
      <div class="stat-block"><div class="stat-name">치명타%</div><div class="stat-value">${stats.crit}%</div></div>
      <div class="stat-block"><div class="stat-name">치명타 배율</div><div class="stat-value">${stats.critDmg}%</div></div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">특성</div>
      <div class="adv-traits">${traitHtml || '<span style="color:#bbb;font-size:0.8rem">없음</span>'}</div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">장비 슬롯</div>
      <div class="equip-slots">
        ${renderEquipSlot(adv, 'weapon', '무기')}
        ${renderEquipSlot(adv, 'armor', '방어구')}
        ${renderEquipSlot(adv, 'accessory', '악세서리')}
      </div>
    </div>
    ${promoTargets.length > 0 ? `
    <div>
      <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">
        전직 (Lv.${promoCost.level} / 골드 ${promoCost.gold.toLocaleString()} / 재료 ${promoCost.material})
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${promoButtons}</div>
    </div>` : ''}
  `;
}

function renderEquipSlot(adv, slot, label) {
  const item = adv.equipment[slot];
  if (item) {
    return `<div class="equip-slot has-item">
      <img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none'">
      <div style="font-size:0.7rem;color:var(--brown-dark);font-weight:bold">${item.name}</div>
      <div style="font-size:0.65rem;color:${gradeColor(item.grade)}">${item.grade}급</div>
    </div>`;
  }
  return `<div class="equip-slot"><div style="font-size:1.2rem">＋</div><div>${label}</div></div>`;
}

function gradeColor(grade) {
  return { D: '#9e9e9e', C: '#388e3c', B: '#1976d2', A: '#7b1fa2', S: '#f57c00' }[grade] || '#9e9e9e';
}

function promoteAdventurer(advId, targetJob) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) return;
  const jobInfo = JOBS[adv.job];
  const tier = jobInfo.tier;
  const costKey = tier === 1 ? 'tier2' : 'tier3';
  const cost = PROMOTION_COST[costKey];
  if (adv.level < cost.level) { showToast(`레벨 ${cost.level} 이상 필요합니다.`, 'error'); return; }
  if (!spendGold(cost.gold)) { showToast('골드가 부족합니다.', 'error'); return; }
  if (!spendMaterial(cost.material)) { addGold(cost.gold); showToast('재료가 부족합니다.', 'error'); return; }
  adv.job = targetJob;
  showToast(`${adv.name} → ${JOBS[targetJob].name} 전직 완료!`, 'success');
}

// ===== 파견 탭 =====
let dispatchTeamBuffer = {};   // {areaId: [advId, ...]}

function renderDispatchTab() {
  const container = document.getElementById('dispatch-areas');
  container.innerHTML = '';

  const dispatched = getDispatchedAdvIds();
  const maxSlots = getMaxDispatchSlots();

  for (const area of AREAS) {
    const activeDispatch = State.dispatches.find(d => d.areaId === area.id);
    const isOpen = !!sessionStorage.getItem(`area_open_${area.id}`);

    const div = document.createElement('div');
    div.className = `dispatch-area${area.unlocked ? '' : ' locked'}`;

    const monsterIcons = area.monsters.slice(0, 5).map(m =>
      `<div class="monster-sprite-item">
        <img src="${m.sprite}" alt="${m.name}" onerror="this.src='assets/items/I_Chest01.png'" />
        <span>${m.name.replace(' (보스)', '')}</span>
      </div>`
    ).join('');

    const progressVal = State.areaProgress[area.id] || 0;
    const progressPct = (progressVal / area.maxProgress * 100).toFixed(1);

    let bodyHtml = '';
    if (area.unlocked) {
      if (activeDispatch) {
        const accGold = Math.floor(activeDispatch.accumulated.gold);
        const accMat  = activeDispatch.accumulated.material.toFixed(1);
        const prog    = Math.min(activeDispatch.progress, area.maxProgress).toFixed(0);
        const teamNames = activeDispatch.team.map(id => {
          const a = State.adventurers.find(x => x.id === id);
          return a ? a.name : '?';
        }).join(', ');

        bodyHtml = `
          <div class="dispatch-slot active-dispatch">
            <div class="slot-label">✅ 파견 중</div>
            <div style="font-size:0.85rem;margin-bottom:8px">👥 ${teamNames}</div>
            <div style="font-size:0.82rem;color:#6b4c30;margin-bottom:4px">
              누적: 💰 ${accGold.toLocaleString()} 골드 · 재료 ${accMat}
            </div>
            <div style="font-size:0.78rem;color:#888;margin-bottom:4px">진행도: ${prog} / ${area.maxProgress}</div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${(prog/area.maxProgress*100).toFixed(1)}%"></div></div>
            <div class="dispatch-actions">
              <button class="btn btn-gold" onclick="openSettlement('${area.id}')">📋 정산하기</button>
              <button class="btn btn-primary" onclick="openBattlePopup('${area.id}')">⚔️ 전투 관람</button>
            </div>
          </div>
        `;
      } else {
        if (!dispatchTeamBuffer[area.id]) dispatchTeamBuffer[area.id] = [];
        const teamBuf = dispatchTeamBuffer[area.id];

        const availAdv = State.adventurers.filter(a => !dispatched.has(a.id));
        const addOptions = availAdv
          .filter(a => !teamBuf.includes(a.id))
          .map(a => `<option value="${a.id}">${a.name} (${JOBS[a.job].name} Lv.${a.level})</option>`)
          .join('');

        const memberTags = teamBuf.map(id => {
          const a = State.adventurers.find(x => x.id === id);
          return a ? `<span class="slot-member">
            ${a.name}
            <button class="remove-member" onclick="removeFromTeamBuffer('${area.id}', ${id})">✕</button>
          </span>` : '';
        }).join('');

        bodyHtml = `
          <div class="dispatch-slot">
            <div class="slot-label">팀 구성 (최대 3명)</div>
            <div class="slot-team" id="team-buf-${area.id}">
              ${memberTags || '<span style="color:#bbb;font-size:0.82rem">모험가를 추가하세요</span>'}
            </div>
            ${availAdv.length > 0 && teamBuf.length < 3 ? `
            <select class="adv-select" style="margin-top:8px;width:100%;padding:6px;border-radius:6px;border:1px solid var(--brown);font-family:inherit"
              onchange="addToTeamBuffer('${area.id}', parseInt(this.value)); this.value=''; renderDispatchTab()">
              <option value="">+ 모험가 추가...</option>
              ${addOptions}
            </select>` : ''}
            <div class="dispatch-actions" style="margin-top:10px">
              <button class="btn btn-green" onclick="doDispatch('${area.id}')"
                ${teamBuf.length === 0 ? 'disabled' : ''}>
                🗺️ 파견 출발!
              </button>
            </div>
          </div>
        `;
      }

      bodyHtml += `
        <div class="area-monsters">
          <div class="area-monsters-title">출현 몬스터</div>
          <div class="monster-sprites">${monsterIcons}</div>
        </div>
        <div style="font-size:0.78rem;color:#888;margin-top:8px">
          💰 ${area.goldPerSec}/초 · 재료 ${area.materialPerMin}/분
        </div>
      `;
    }

    div.innerHTML = `
      <div class="area-header" onclick="toggleArea('${area.id}', this)">
        <div class="area-title">
          <span>${area.icon}</span>
          <span>${area.name}</span>
          <span class="area-stage-badge">${area.stage}단계</span>
          ${activeDispatch ? '<span style="font-size:0.7rem;background:#e8f5e9;color:#388e3c;border-radius:6px;padding:2px 7px;border:1px solid #388e3c">파견 중</span>' : ''}
        </div>
        <div>
          ${area.unlocked
            ? `<div class="area-progress">진행도 ${progressVal}/${area.maxProgress}</div>`
            : `<div class="area-lock-info">🔒 ${area.unlockDesc}</div>`}
          <div style="font-size:1rem;color:var(--cream-dark);text-align:right">${isOpen ? '▲' : '▼'}</div>
        </div>
      </div>
      <div class="area-body${isOpen ? ' open' : ''}" id="area-body-${area.id}">
        ${area.unlocked ? bodyHtml : `<div style="color:#888;text-align:center;padding:20px">🔒 ${area.unlockDesc}</div>`}
      </div>
    `;

    container.appendChild(div);
  }
}

function toggleArea(areaId, headerEl) {
  const body = document.getElementById(`area-body-${areaId}`);
  const isOpen = body.classList.toggle('open');
  if (isOpen) sessionStorage.setItem(`area_open_${areaId}`, '1');
  else         sessionStorage.removeItem(`area_open_${areaId}`);
  // 화살표 갱신
  const arrow = headerEl.querySelector('div:last-child div:last-child');
  if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
}

function addToTeamBuffer(areaId, advId) {
  if (!dispatchTeamBuffer[areaId]) dispatchTeamBuffer[areaId] = [];
  if (dispatchTeamBuffer[areaId].length >= 3) return;
  if (!dispatchTeamBuffer[areaId].includes(advId)) dispatchTeamBuffer[areaId].push(advId);
}

function removeFromTeamBuffer(areaId, advId) {
  if (!dispatchTeamBuffer[areaId]) return;
  dispatchTeamBuffer[areaId] = dispatchTeamBuffer[areaId].filter(id => id !== advId);
  renderDispatchTab();
}

function doDispatch(areaId) {
  const team = dispatchTeamBuffer[areaId] || [];
  if (startDispatch(areaId, team)) {
    dispatchTeamBuffer[areaId] = [];
    renderDispatchTab();
    renderHeader();
  }
}

function openSettlement(areaId) {
  const result = settleDispatch(areaId);
  if (!result) return;
  dispatchTeamBuffer[areaId] = [];

  document.getElementById('settlement-result').innerHTML = `
    <div class="settlement-row"><span class="settlement-label">💰 획득 골드</span><span class="settlement-value">${result.gold.toLocaleString()} G</span></div>
    <div class="settlement-row"><span class="settlement-label">💎 획득 재료</span><span class="settlement-value">${result.material}개</span></div>
    <div class="settlement-row"><span class="settlement-label">📍 도달 진행도</span><span class="settlement-value">${Math.min(result.progress, 200).toFixed(0)} / 200</span></div>
  `;

  openPopup('settlement-popup');
  document.getElementById('btn-confirm-settlement').onclick = () => {
    closePopup('settlement-popup');
    renderDispatchTab();
    renderHeader();
  };
}

// ===== 모집 탭 =====
function renderRecruitTab() {
  // 서류 없으면 초기화
  if (State.applications.length === 0) refreshApplications();

  // 카운트다운 업데이트
  updateRecruitCountdown();

  const container = document.getElementById('application-cards');
  container.innerHTML = '';

  const maxAdv = getBuildingLevel('lounge') + 2;

  for (let i = 0; i < State.applications.length; i++) {
    const app = State.applications[i];
    const jobInfo = JOBS[app.job];
    const stats   = getEffectiveStats(app);
    const isFull  = State.adventurers.length >= maxAdv;

    const traitHtml = app.traits.map(tid => {
      const t = TRAITS.find(x => x.id === tid);
      return t ? `<span class="trait-badge">${t.name}</span>` : '';
    }).join('');

    const card = document.createElement('div');
    card.className = 'application-card';
    card.innerHTML = `
      <div class="app-card-top">
        <div class="app-name">${app.name}</div>
        <span class="app-grade grade-${app.grade}">${app.grade}급</span>
      </div>
      <div style="margin-bottom:8px">
        <span class="adv-job-badge ${jobInfo.cssClass}">${jobInfo.name}</span>
      </div>
      <div class="app-stats">
        <div class="app-stat"><span>HP</span><span>${stats.hp}</span></div>
        <div class="app-stat"><span>공격력</span><span>${stats.atk}</span></div>
        <div class="app-stat"><span>방어력</span><span>${stats.def}</span></div>
        <div class="app-stat"><span>속도</span><span>${stats.spd}</span></div>
        <div class="app-stat"><span>치명타%</span><span>${stats.crit}%</span></div>
        <div class="app-stat"><span>치명타 배율</span><span>${stats.critDmg}%</span></div>
      </div>
      <div class="app-traits">${traitHtml}</div>
      <div class="app-actions">
        <button class="btn btn-green btn-full" ${isFull ? 'disabled' : ''}
          onclick="recruitAdventurer(${i}); renderRecruitTab(); renderAdventurerTab()">
          ${isFull ? '대기실 가득 참' : '✅ 길드 합류'}
        </button>
      </div>
    `;
    container.appendChild(card);
  }

  if (State.applications.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><p>지원서가 없습니다. 잠시 후 자동 갱신됩니다.</p></div>';
  }
}

function updateRecruitCountdown() {
  const el = document.getElementById('recruit-countdown');
  if (!el) return;
  const elapsed = Date.now() - State.lastRecruitTime;
  const remaining = Math.max(0, State.recruitInterval - elapsed);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  el.textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// ===== 상점 탭 =====
function renderShopTab() {
  const container = document.getElementById('shop-items');
  container.innerHTML = '';

  for (const item of SHOP_ITEMS) {
    const canAfford = State.gold >= item.price;
    const card = document.createElement('div');
    card.className = 'shop-item-card';
    card.innerHTML = `
      <img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none'">
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-desc">${item.desc}</div>
      <div class="shop-item-price">💰 ${item.price.toLocaleString()} G</div>
      <button class="btn btn-gold btn-full" ${canAfford ? '' : 'disabled'}
        onclick="buyShopItem('${item.id}'); renderShopTab(); renderHeader()">
        구매
      </button>
    `;
    container.appendChild(card);
  }
}

// ===== 팝업 =====
function openPopup(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function closePopup(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}

function openBattlePopup(areaId) {
  const dispatch = State.dispatches.find(d => d.areaId === areaId);
  if (!dispatch) return;
  const area = AREAS.find(a => a.id === areaId);
  if (!area) return;

  const allies = dispatch.team.map(id => State.adventurers.find(a => a.id === id)).filter(Boolean);
  const isBoss = Math.random() < 0.1;
  const monsterPool = area.monsters.filter(m => m.boss === isBoss || (!isBoss && !m.boss));
  const count = isBoss ? 1 : Math.min(3, 1 + Math.floor(Math.random() * 3));
  const monsters = Array.from({ length: count }, () => {
    const pick = monsterPool[Math.floor(Math.random() * monsterPool.length)];
    const stats = generateMonsterStats(area, dispatch.progress, isBoss);
    return { ...stats, name: pick.name, sprite: pick.sprite };
  });

  renderBattleUI(allies, monsters);
  openPopup('battle-popup');

  const battle = new LiveBattle(allies, monsters,
    (b) => updateBattleUI(b),
    (win) => {
      setTimeout(() => {
        document.getElementById('battle-log').innerHTML +=
          `<div class="log-entry log-system">${win ? '🏆 승리!' : '💀 전멸...'}</div>`;
      }, 500);
    }
  );
  window._currentBattle = battle;
  battle.start();

  document.getElementById('btn-close-battle').onclick = () => {
    if (window._currentBattle) window._currentBattle.stop();
    closePopup('battle-popup');
  };
}

function renderBattleUI(allies, monsters) {
  const allySide = document.getElementById('battle-allies');
  const enemySide = document.getElementById('battle-enemies');

  allySide.innerHTML = allies.map(a => {
    const st = getEffectiveStats(a);
    return `<div class="battle-unit" id="battle-ally-${a.id}">
      <div class="battle-unit-name">${a.name}</div>
      <div class="battle-hp-bar"><div class="battle-hp-fill" style="width:100%" id="hp-ally-${a.id}"></div></div>
      <div style="font-size:0.7rem;color:#888" id="hp-text-ally-${a.id}">${st.hp}/${st.hp}</div>
    </div>`;
  }).join('');

  enemySide.innerHTML = monsters.map((m, i) => `
    <div class="battle-unit" id="battle-enemy-${i}">
      <div class="battle-unit-name">${m.name}</div>
      <div class="battle-hp-bar"><div class="battle-hp-fill" style="width:100%;background:var(--red)" id="hp-enemy-${i}"></div></div>
      <div style="font-size:0.7rem;color:#888" id="hp-text-enemy-${i}">${m.hp}/${m.hp}</div>
    </div>`).join('');

  document.getElementById('battle-log').innerHTML = '<div class="log-entry log-system">— 전투 시작! —</div>';
}

function updateBattleUI(battle) {
  for (const unit of battle.allies) {
    const fill = document.getElementById(`hp-ally-${unit.id}`);
    const text = document.getElementById(`hp-text-ally-${unit.id}`);
    if (fill) fill.style.width = `${Math.max(0, unit.currentHp / unit.maxHp * 100).toFixed(1)}%`;
    if (text) text.textContent = `${Math.max(0, unit.currentHp)}/${unit.maxHp}`;
  }
  for (let i = 0; i < battle.enemies.length; i++) {
    const unit = battle.enemies[i];
    const fill = document.getElementById(`hp-enemy-${i}`);
    const text = document.getElementById(`hp-text-enemy-${i}`);
    if (fill) fill.style.width = `${Math.max(0, unit.currentHp / unit.maxHp * 100).toFixed(1)}%`;
    if (text) text.textContent = `${Math.max(0, unit.currentHp)}/${unit.maxHp}`;
  }
  const logEl = document.getElementById('battle-log');
  if (logEl) {
    logEl.innerHTML = battle.log.slice(-30).map(l => `<div class="log-entry">${l}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// ===== 튜토리얼 =====
const TUTORIAL_STEPS = [
  { text: '안녕하세요 길드장님! 저는 클로에입니다. 베른 모험가 길드에 오신 걸 환영해요! 제가 길드 운영을 도와드릴게요.', highlight: null },
  { text: '우선 모집 탭을 확인해 볼까요? 저한테 오늘 지원서가 들어왔거든요. 마음에 드는 모험가를 골라 길드에 합류시켜 주세요!', highlight: '#tab-bar .tab-btn:nth-child(4)' },
  { text: '길드에 합류한 모험가는 모험가 탭에서 확인할 수 있어요. 장비도 장착하고, 레벨업도 시킬 수 있답니다!', highlight: '#tab-bar .tab-btn:nth-child(2)' },
  { text: '파견 탭에서 팀을 꾸려 지역으로 파견을 보내세요. 파견 중인 모험가들은 알아서 싸우고 골드와 재료를 모아온답니다!', highlight: '#tab-bar .tab-btn:nth-child(3)' },
  { text: '모험가들이 돌아오면 정산 버튼으로 성과물을 회수하세요. 골드와 재료로 길드 건물을 업그레이드할 수 있어요!', highlight: '#tab-bar .tab-btn:nth-child(1)' },
  { text: '이제 길드장님 혼자서도 잘 하실 수 있겠죠? 궁금한 게 있으면 언제든 클로에를 찾아주세요! 화이팅! 💪', highlight: null },
];

function startTutorial() {
  if (State.tutorialDone) return;
  State.tutorialStep = 0;
  showTutorialStep(0);
}

function showTutorialStep(step) {
  if (step >= TUTORIAL_STEPS.length) {
    endTutorial(); return;
  }
  const overlay = document.getElementById('tutorial-overlay');
  overlay.classList.remove('hidden');
  const s = TUTORIAL_STEPS[step];
  document.getElementById('tutorial-text').textContent = s.text;

  const highlight = document.getElementById('tutorial-highlight');
  if (s.highlight) {
    const el = document.querySelector(s.highlight);
    if (el) {
      const rect = el.getBoundingClientRect();
      highlight.style.cssText = `top:${rect.top - 4}px;left:${rect.left - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px;display:block`;
    }
  } else {
    highlight.style.display = 'none';
  }

  document.getElementById('btn-tutorial-next').textContent =
    step === TUTORIAL_STEPS.length - 1 ? '시작하기! 🎮' : '다음 →';
}

function nextTutorialStep() {
  State.tutorialStep++;
  if (State.tutorialStep >= TUTORIAL_STEPS.length) { endTutorial(); return; }
  showTutorialStep(State.tutorialStep);
}

function endTutorial() {
  document.getElementById('tutorial-overlay').classList.add('hidden');
  State.tutorialDone = true;
  saveState();
}
