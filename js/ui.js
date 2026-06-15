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
    case 'lab':         renderLabTab();         break;
    case 'prestige':    renderPrestigeTab();    break;
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
  updateInvBadge();

  const list = document.getElementById('adventurer-list');
  list.innerHTML = '';

  if (State.adventurers.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🗡️</div><p>아직 길드에 합류한 모험가가 없습니다.<br>모집 탭에서 모험가를 영입해 보세요!</p></div>';
    renderAdvDetail(null);
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
      return t ? `<span class="trait-badge" data-tooltip="${t.name}: ${t.desc}">${t.name}</span>` : '';
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
    return t ? `<span class="trait-badge" data-tooltip="${t.name}: ${t.desc}">${t.name}</span>` : '';
  }).join('');

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>
        <div style="font-size:1.2rem;font-weight:bold;color:var(--brown-dark)">${adv.name}</div>
        <div style="font-size:0.85rem;color:${gradeColor(adv.grade)};font-weight:bold">${adv.grade}급 · <span class="${jobInfo.cssClass}" style="padding:2px 8px;border-radius:6px;color:white;font-size:0.8rem">${jobInfo.name}</span></div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-danger" style="font-size:0.8rem;padding:6px 12px"
          onclick="if(confirm('정말 ${adv.name}을(를) 해고하시겠습니까?\\n장착 중인 장비는 인벤토리로 반환됩니다.')){if(dismissAdventurer(${adv.id})){selectedAdvId=null;renderAdventurerTab();renderHeader()}}">
          🚪 해고
        </button>
        <button class="btn btn-outline" style="font-size:0.8rem;padding:6px 12px"
          onclick="selectedAdvId=null;renderAdventurerTab()">✕ 닫기</button>
      </div>
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
    ${(() => {
      const bookCount = State.inventory.filter(i => i.type === 'exp_book').length;
      if (bookCount === 0) return '';
      const bookMap = {};
      State.inventory.forEach((item, idx) => {
        if (item.type !== 'exp_book') return;
        if (!bookMap[item.name]) bookMap[item.name] = { item, count: 0 };
        bookMap[item.name].count++;
      });
      const btnHtml = Object.values(bookMap).map(({ item, count }) =>
        `<button class="btn btn-gold" style="font-size:0.75rem;padding:4px 10px"
          onclick="useExpBookByName(${adv.id}, '${item.name}')">
          📚 ${item.name}${count > 1 ? ` ×${count}` : ''} (+${item.expValue.toLocaleString()} XP)
        </button>`
      ).join('');
      return `<div style="margin-bottom:10px">
        <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">경험치 서 사용</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${btnHtml}</div>
      </div>`;
    })()}
    ${promoTargets.length > 0 ? `
    <div>
      <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">
        전직 (Lv.${promoCost.level} / 골드 ${promoCost.gold.toLocaleString()} / 재료 ${promoCost.material})
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${promoButtons}</div>
    </div>` : ''}
  `;
}

function formatEquipStats(stats) {
  const labels = { atk: '공격', def: '방어', hp: 'HP', spd: '속도', crit: '치명타%', critDmg: '치명타배율' };
  return Object.entries(stats).map(([k, v]) => `${labels[k] || k}+${v}`).join(' / ');
}

function formatEquipOptions(options) {
  if (!options || options.length === 0) return '';
  return options.map(opt =>
    `<span class="equip-option">${opt.display || opt.name}</span>`
  ).join('');
}

function gradeOptionColor(grade) {
  return { '마법': '#388e3c', '희귀': '#1565c0', '영웅': '#6a1b9a', '전설': '#e65100', '신화': '#c62828' }[grade] || '#888';
}

function renderEquipSlot(adv, slot, label) {
  const item = adv.equipment[slot];
  const dispatched = getDispatchedAdvIds().has(adv.id);

  if (item) {
    const optHtml = formatEquipOptions(item.options);
    const jobClassTag = item.slot === 'weapon' && item.jobClass
      ? `<div style="font-size:0.58rem;color:var(--brown);margin-bottom:1px">${{ warrior:'전사', rogue:'도적', mage:'마법사' }[item.jobClass]}계</div>`
      : '';
    return `<div class="equip-slot has-item">
      <img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none'">
      ${jobClassTag}
      <div style="font-size:0.7rem;color:var(--brown-dark);font-weight:bold">${item.name}</div>
      <div style="font-size:0.65rem;color:${gradeColor(item.grade)};font-weight:bold">${item.grade}급</div>
      <div style="font-size:0.6rem;color:#888;line-height:1.4;margin:2px 0">${formatEquipStats(item.stats)}</div>
      ${optHtml ? `<div class="equip-options-wrap">${optHtml}</div>` : ''}
      ${dispatched ? '' : `<button class="btn btn-outline" style="font-size:0.6rem;padding:2px 6px;margin-top:4px;width:100%"
        onclick="event.stopPropagation();unequipItem(${adv.id},'${slot}');renderAdventurerTab()">해제</button>`}
    </div>`;
  }

  if (dispatched) {
    return `<div class="equip-slot">
      <div style="font-size:1.2rem">＋</div>
      <div style="font-size:0.75rem">${label}</div>
      <div style="font-size:0.6rem;color:#bbb">파견 중</div>
    </div>`;
  }

  // 인벤토리에서 해당 슬롯 + 직업 호환 장비 수 계산
  const advBranch = JOBS[adv.job]?.branch;
  const weaponBranch = advBranch === 'healer' ? 'mage' : advBranch; // 치유사는 마법사 무기 사용
  const avail = State.inventory.filter(it => {
    if (it.slot !== slot) return false;
    if (slot === 'weapon' && it.jobClass && it.jobClass !== weaponBranch) return false;
    return true;
  });

  // 빈 슬롯: 장착 가능 여부와 무관하게 인벤토리 팝업으로 연결
  const countLabel = avail.length > 0
    ? `<div style="font-size:0.62rem;color:var(--green-dark);margin-top:2px">장착 가능 ${avail.length}개</div>`
    : `<div style="font-size:0.6rem;color:#bbb">없음</div>`;

  return `<div class="equip-slot" style="cursor:pointer" onclick="openInventoryPopup()">
    <div style="font-size:1.2rem">＋</div>
    <div style="font-size:0.75rem">${label}</div>
    ${countLabel}
    <div style="font-size:0.55rem;color:var(--brown);margin-top:2px">🎒 인벤토리</div>
  </div>`;
}

function gradeColor(grade) {
  return { '일반': '#9e9e9e', '마법': '#388e3c', '희귀': '#1976d2', '영웅': '#7b1fa2', '전설': '#f57c00', '신화': '#e53935' }[grade] || '#9e9e9e';
}

function promoteAdventurer(advId, targetJob) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) return;
  const jobInfo = JOBS[adv.job];
  const tier = jobInfo.tier;
  if (JOBS[targetJob]?.tier === 3 && !hasPrestigeEffect('tier3unlock')) {
    showToast('3차 전직은 경지 개방 Ⅱ가 필요합니다. (경지 탭 → 경지 가지 노드 개방)', 'error');
    return;
  }
  const costKey = tier === 1 ? 'tier2' : 'tier3';
  const cost = PROMOTION_COST[costKey];
  if (adv.level < cost.level) { showToast(`레벨 ${cost.level} 이상 필요합니다.`, 'error'); return; }
  if (!spendGold(cost.gold)) { showToast('골드가 부족합니다.', 'error'); return; }
  if (!spendMaterial(cost.material)) { addGold(cost.gold); showToast('재료가 부족합니다.', 'error'); return; }
  adv.job = targetJob;
  showToast(`${adv.name} → ${JOBS[targetJob].name} 전직 완료!`, 'success');
}

function useExpBook(advId, itemIdx) {
  const item = State.inventory[itemIdx];
  if (!item || item.type !== 'exp_book') { showToast('아이템을 찾을 수 없습니다.', 'error'); return; }
  State.inventory.splice(itemIdx, 1);
  giveExp(advId, item.expValue);
}

// ===== 파견 탭 =====
let dispatchTeamBuffer = {};   // {areaId: [advId, ...]}

const NATION_META = {
  '베른':         { icon: '🏰', stages: '1~5단계' },
  '칸':           { icon: '⚒️', stages: '6~10단계' },
  '솔':           { icon: '🌊', stages: '11~15단계' },
  '에테리아':     { icon: '✨', stages: '16~20단계' },
  '오르도스':     { icon: '🏜️', stages: '21~25단계' },
  '아이언피스트': { icon: '⚙️', stages: '26~30단계' },
  '드래곤 왕국':  { icon: '🐉', stages: '31~35단계' },
  '미지의 영역':  { icon: '🌌', stages: '36~40단계' },
};

function renderDispatchTab() {
  const container = document.getElementById('dispatch-areas');
  container.innerHTML = '';

  const dispatched = getDispatchedAdvIds();
  const maxSlots   = getMaxDispatchSlots();

  for (const [country, meta] of Object.entries(NATION_META)) {
    const nationAreas       = AREAS.filter(a => a.country === country);
    if (nationAreas.length === 0) continue;

    const unlockedCount     = nationAreas.filter(a => a.unlocked).length;
    const hasActiveDispatch = nationAreas.some(a => State.dispatches.find(d => d.areaId === a.id));
    const nationId          = country.replace(/\s/g, '_');
    const nationKey         = `nation_open_${country}`;

    const stored       = sessionStorage.getItem(nationKey);
    const isNationOpen = stored !== null ? stored === '1'
                       : (hasActiveDispatch || country === '베른');

    const nationDiv = document.createElement('div');
    nationDiv.className = 'nation-section';
    nationDiv.innerHTML = `
      <div class="nation-header" onclick="toggleNation('${country}')">
        <div class="nation-title">
          <span>${meta.icon}</span>
          <strong>${country}</strong>
          <span class="nation-stages">${meta.stages}</span>
          ${hasActiveDispatch ? '<span class="nation-dispatch-badge">파견 중</span>' : ''}
        </div>
        <div class="nation-right">
          <span class="nation-unlock-info">${unlockedCount === 0 ? '🔒 미개방' : `${unlockedCount}/${nationAreas.length} 지역`}</span>
          <span class="nation-arrow" id="nation-arrow-${nationId}">${isNationOpen ? '▲' : '▼'}</span>
        </div>
      </div>
      <div class="nation-body${isNationOpen ? ' open' : ''}" id="nation-body-${nationId}"></div>
    `;
    container.appendChild(nationDiv);

    const nationBody = nationDiv.querySelector('.nation-body');

    for (const area of nationAreas) {
      const activeDispatch = State.dispatches.find(d => d.areaId === area.id);
      const isAreaOpen     = !!sessionStorage.getItem(`area_open_${area.id}`);

      const monsterIcons = area.monsters.slice(0, 5).map(m =>
        `<div class="monster-sprite-item">
          <img src="${m.sprite}" alt="${m.name}" onerror="this.src='assets/items/I_Chest01.png'" />
          <span>${m.name.replace(' (보스)', '')}</span>
        </div>`
      ).join('');

      const bestProgress = State.areaProgress[area.id] || 0;
      const progressSpan = area.unlocked
        ? (activeDispatch
            ? `<span class="area-progress">진행도 ${Math.floor(activeDispatch.progress)}/${area.maxProgress}</span>`
            : bestProgress > 0
              ? `<span class="area-progress" style="opacity:0.6">최고 ${bestProgress}/${area.maxProgress}</span>`
              : `<span class="area-progress" style="opacity:0.35">-/${area.maxProgress}</span>`)
        : `<span class="area-lock-info">🔒 ${area.unlockDesc}</span>`;

      let bodyHtml = '';
      if (area.unlocked) {
        if (activeDispatch) {
          const accGold = Math.floor(activeDispatch.accumulated.gold);
          const accMat  = activeDispatch.accumulated.material.toFixed(1);
          const prog    = Math.min(activeDispatch.progress, area.maxProgress).toFixed(0);

          const partyHpHtml = activeDispatch.team.map(id => {
            const adv = State.adventurers.find(a => a.id === id);
            if (!adv) return '';
            const stats = getEffectiveStats(adv);
            const curHp = (activeDispatch.partyHp && activeDispatch.partyHp[id] !== undefined)
              ? activeDispatch.partyHp[id] : stats.hp;
            const hpPct   = Math.max(0, Math.min(100, curHp / stats.hp * 100)).toFixed(0);
            const hpColor = hpPct > 60 ? 'var(--green)' : hpPct > 30 ? 'var(--gold-dark)' : 'var(--red)';
            const jobInfo = JOBS[adv.job];
            return `<div style="flex:1;min-width:80px">
              <div style="font-size:0.72rem;color:var(--brown-dark);margin-bottom:2px;display:flex;justify-content:space-between">
                <span class="adv-job-badge ${jobInfo.cssClass}" style="font-size:0.6rem;padding:1px 5px">${jobInfo.name}</span>
                <span style="font-weight:bold">${adv.name}</span>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div>
              </div>
              <div style="font-size:0.65rem;color:#888;text-align:right">${Math.max(0,Math.floor(curHp))}/${stats.hp}</div>
            </div>`;
          }).join('');

          const bossTag = activeDispatch.isBossEncounter
            ? '<span style="font-size:0.68rem;background:#fff3e0;color:var(--orange);border:1px solid var(--orange);border-radius:6px;padding:2px 7px">⚠️ 보스</span>' : '';

          bodyHtml = `
            <div class="dispatch-slot active-dispatch">
              <div class="slot-label">✅ 파견 중 ${bossTag}</div>
              <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">${partyHpHtml}</div>
              <div style="font-size:0.82rem;color:#6b4c30;margin-bottom:4px">
                누적: 💰 ${accGold.toLocaleString()} 골드 · 재료 ${accMat}
              </div>
              <div style="font-size:0.78rem;color:#888;margin-bottom:4px">진행도: ${prog} / ${area.maxProgress}</div>
              <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${(prog/area.maxProgress*100).toFixed(1)}%"></div></div>
              <div class="dispatch-actions">
                <button class="btn btn-gold" onclick="openSettlement('${area.id}')">📋 정산하기</button>
                <button class="btn btn-primary" onclick="openBattlePopup('${area.id}')">⚔️ 전투 관람</button>
                <button class="btn btn-outline" onclick="if(confirm('파견 팀을 귀환시키겠습니까?\\n잔여 누적 재화도 함께 수령합니다.')){recallDispatch('${area.id}');renderDispatchTab();renderHeader()}">🏠 귀환 명령</button>
              </div>
            </div>
          `;
        } else {
          if (!dispatchTeamBuffer[area.id]) dispatchTeamBuffer[area.id] = [];
          const teamBuf  = dispatchTeamBuffer[area.id];
          const availAdv = State.adventurers.filter(a => !dispatched.has(a.id));
          const addOptions = availAdv
            .filter(a => !teamBuf.includes(a.id))
            .map(a => `<option value="${a.id}">${a.name} (${JOBS[a.job].name} Lv.${a.level})</option>`)
            .join('');
          const memberTags = teamBuf.map(id => {
            const a = State.adventurers.find(x => x.id === id);
            return a ? `<span class="slot-member">${a.name}<button class="remove-member" onclick="removeFromTeamBuffer('${area.id}', ${id})">✕</button></span>` : '';
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
                <button class="btn btn-green" onclick="doDispatch('${area.id}')" ${teamBuf.length === 0 ? 'disabled' : ''}>
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

      const areaDiv = document.createElement('div');
      areaDiv.className = `dispatch-area${area.unlocked ? '' : ' locked'}`;
      areaDiv.innerHTML = `
        <div class="area-header" onclick="toggleArea('${area.id}')">
          <div class="area-title">
            <span>${area.icon}</span>
            <span>${area.name}</span>
            <span class="area-stage-badge">${area.stage}단계</span>
            ${activeDispatch ? '<span style="font-size:0.7rem;background:#e8f5e9;color:#388e3c;border-radius:6px;padding:2px 7px;border:1px solid #388e3c">파견 중</span>' : ''}
          </div>
          <div class="area-header-right">
            ${progressSpan}
            <span class="area-arrow" id="area-arrow-${area.id}">${isAreaOpen ? '▲' : '▼'}</span>
          </div>
        </div>
        <div class="area-body${isAreaOpen ? ' open' : ''}" id="area-body-${area.id}">
          ${area.unlocked ? bodyHtml : `<div style="color:#888;text-align:center;padding:20px">🔒 ${area.unlockDesc}</div>`}
        </div>
      `;
      nationBody.appendChild(areaDiv);
    }
  }
}

function toggleNation(country) {
  const nationId = country.replace(/\s/g, '_');
  const body  = document.getElementById(`nation-body-${nationId}`);
  const arrow = document.getElementById(`nation-arrow-${nationId}`);
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (isOpen) sessionStorage.setItem(`nation_open_${country}`, '1');
  else         sessionStorage.removeItem(`nation_open_${country}`);
  if (arrow) arrow.textContent = isOpen ? '▲' : '▼';
}

function toggleArea(areaId) {
  const body  = document.getElementById(`area-body-${areaId}`);
  const arrow = document.getElementById(`area-arrow-${areaId}`);
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (isOpen) sessionStorage.setItem(`area_open_${areaId}`, '1');
  else         sessionStorage.removeItem(`area_open_${areaId}`);
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

  document.getElementById('btn-confirm-settlement').textContent = '✅ 수령하기 (파견 유지)';
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
      return t ? `<span class="trait-badge" data-tooltip="${t.name}: ${t.desc}">${t.name}</span>` : '';
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

  // 즉시 갱신 버튼 비용 실시간 반영
  const btn = document.getElementById('btn-refresh-recruit');
  if (btn) {
    const cost = getForceRefreshCost();
    const count = State.recruitForceCount ?? 0;
    const label = count > 0 ? ` (${count}회 추가)` : '';
    btn.textContent = `💰 즉시 갱신 (${cost.toLocaleString()} 골드${label})`;
  }
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
  const area = AREAS.find(a => a.id === areaId);
  if (!area) return;
  if (window._currentBattle) window._currentBattle.stop();

  // 전투 1회를 시작하는 내부 함수 — 승패 후 2초 뒤 자동으로 재호출됨
  function startBattle(allies) {
    const dispatch = State.dispatches.find(d => d.areaId === areaId);
    if (!dispatch) return; // 파견이 정산되면 중단

    const enemies = generateEnemyGroup(area, Math.floor(dispatch.progress));
    renderBattleUI(allies, enemies);

    const battle = new LiveBattle(
      allies, enemies,
      (b) => updateBattleUI(b),
      (win) => {
        // 팝업이 닫혔으면 중단
        const popup = document.getElementById('battle-popup');
        if (!popup || popup.classList.contains('hidden')) return;

        // 2초 후 다음 전투 자동 시작
        setTimeout(() => {
          const popup2 = document.getElementById('battle-popup');
          if (!popup2 || popup2.classList.contains('hidden')) return;

          const d = State.dispatches.find(d => d.areaId === areaId);
          if (!d) return;

          // 승리: 현재 HP 이어받기 / 패배: 풀 HP 회복
          const nextAllies = d.team
            .map(id => State.adventurers.find(a => a.id === id))
            .filter(Boolean)
            .map(adv => {
              const prevUnit = battle.allies.find(u => u.id === adv.id);
              const hp = win && prevUnit ? Math.max(1, prevUnit.currentHp) : undefined;
              return new CombatUnit({ ...adv, _dispatchHp: hp }, true);
            });

          startBattle(nextAllies);
        }, 2000);
      }
    );
    window._currentBattle = battle;
    battle.start();
  }

  const dispatch = State.dispatches.find(d => d.areaId === areaId);
  if (!dispatch) return;

  // 파티 CombatUnit 생성 (저장된 HP 반영)
  const allies = dispatch.team
    .map(id => State.adventurers.find(a => a.id === id))
    .filter(Boolean)
    .map(adv => new CombatUnit(
      { ...adv, _dispatchHp: dispatch.partyHp?.[adv.id] },
      true
    ));

  openPopup('battle-popup');
  startBattle(allies);

  document.getElementById('btn-close-battle').onclick = () => {
    window._currentBattle?.stop();
    closePopup('battle-popup');
  };
}

function renderBattleUI(allies, enemies) {
  const allySide  = document.getElementById('battle-allies');
  const enemySide = document.getElementById('battle-enemies');

  allySide.innerHTML = allies.map(u => {
    const jobInfo = JOBS[u.job] || {};
    return `<div class="battle-unit" id="bu-ally-${u.id}">
      <div class="battle-unit-name">
        <span class="adv-job-badge ${jobInfo.cssClass || ''}" style="font-size:0.58rem;padding:1px 5px">${jobInfo.name || ''}</span>
        ${u.name}
      </div>
      <div class="battle-hp-bar">
        <div class="battle-hp-fill" id="hp-ally-${u.id}" style="width:${(u.currentHp/u.maxHp*100).toFixed(0)}%"></div>
      </div>
      <div class="battle-unit-info" id="info-ally-${u.id}" style="font-size:0.65rem;color:#888">
        ${Math.floor(u.currentHp)}/${u.maxHp} HP
      </div>
    </div>`;
  }).join('');

  enemySide.innerHTML = enemies.map((u, i) => `
    <div class="battle-unit" id="bu-enemy-${i}">
      <div class="battle-unit-name">
        ${u.isBoss ? '<span style="color:var(--orange);font-weight:bold">[BOSS] </span>' : ''}${u.name}
      </div>
      ${u.sprite ? `<img src="${u.sprite}" alt="${u.name}" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated;display:block;margin:2px 0">` : ''}
      <div class="battle-hp-bar">
        <div class="battle-hp-fill" id="hp-enemy-${i}" style="width:100%;background:var(--red)"></div>
      </div>
      <div class="battle-unit-info" id="info-enemy-${i}" style="font-size:0.65rem;color:#888">
        ${u.maxHp}/${u.maxHp} HP
      </div>
    </div>`).join('');

  document.getElementById('battle-log').innerHTML =
    '<div class="log-entry log-system">⚔️ — 전투 시작! —</div>';
}

function updateBattleUI(battle) {
  // 아군 HP 갱신
  battle.allies.forEach(u => {
    const fill = document.getElementById(`hp-ally-${u.id}`);
    const info = document.getElementById(`info-ally-${u.id}`);
    if (fill) {
      const pct = Math.max(0, u.currentHp / u.maxHp * 100).toFixed(1);
      fill.style.width = pct + '%';
      fill.style.background = pct > 60 ? 'var(--green)' : pct > 30 ? 'var(--gold-dark)' : 'var(--red)';
    }
    if (info) {
      const statusIcons = [
        u.hasStatus('stun')    ? '😵기절' : '',
        u.hasStatus('poison')  ? '☠️독' : '',
        u.shield > 0           ? `🛡️${u.shield}` : '',
        u.taunting > 0         ? '🎯도발' : '',
      ].filter(Boolean).join(' ');
      info.innerHTML = `${Math.max(0, Math.floor(u.currentHp))}/${u.maxHp} HP${statusIcons ? ' · ' + statusIcons : ''}`;
    }
  });

  // 적 HP 갱신
  battle.enemies.forEach((u, i) => {
    const fill = document.getElementById(`hp-enemy-${i}`);
    const info = document.getElementById(`info-enemy-${i}`);
    if (fill) fill.style.width = Math.max(0, u.currentHp / u.maxHp * 100).toFixed(1) + '%';
    if (info) {
      const statusIcons = [
        u.hasStatus('stun')    ? '😵기절' : '',
        u.hasStatus('poison')  ? '☠️독' : '',
        u.marked               ? '🏹표식' : '',
      ].filter(Boolean).join(' ');
      info.innerHTML = `${Math.max(0, Math.floor(u.currentHp))}/${u.maxHp} HP${statusIcons ? ' · ' + statusIcons : ''}`;
    }
  });

  // 로그 갱신
  const logEl = document.getElementById('battle-log');
  if (logEl) {
    logEl.innerHTML = battle.log.slice(-35).map(l => `<div class="log-entry">${l}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// ===== 오프라인 복귀 알림 =====
function showOfflinePopup(result) {
  const h = Math.floor(result.elapsed / 3600);
  const m = Math.floor((result.elapsed % 3600) / 60);
  const s = result.elapsed % 60;
  const timeStr = h > 0 ? `${h}시간 ${m}분` : m > 0 ? `${m}분 ${s}초` : `${s}초`;

  const areaHtml = result.areas.map(a => `
    <div class="offline-area-row">
      <div class="offline-area-name">${a.icon} ${a.name}</div>
      <div class="offline-area-gains">
        <span style="color:var(--gold-dark);font-weight:bold">💰 ${a.gold.toLocaleString()} G</span>
        <span style="color:var(--blue);font-weight:bold">💎 재료 ${a.mat}개</span>
        <span class="offline-progress">진행도 ${a.progressFrom}→${a.progressTo}/${a.maxProgress}</span>
      </div>
    </div>`).join('');

  let popup = document.getElementById('offline-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'offline-popup';
    popup.className = 'popup';
    document.body.appendChild(popup);
  }

  popup.innerHTML = `
    <div class="popup-inner">
      <div id="offline-header">
        <img src="assets/characters/클로에 스탠딩.png" alt="클로에" id="offline-chloe-img"
             onerror="this.style.display='none'" />
        <div>
          <h3 class="popup-title" style="margin:0 0 4px">⏰ 오프라인 보상</h3>
          <div style="font-size:0.82rem;color:#666">
            <strong style="color:var(--orange);font-size:1rem">${timeStr}</strong> 동안 자리를 비우셨네요!
          </div>
        </div>
      </div>
      <div id="offline-areas">${areaHtml}</div>
      <div id="offline-total">
        <span style="color:#666;font-size:0.82rem">총 누적</span>
        <span>
          <span style="color:var(--gold-dark);font-weight:bold">💰 ${result.totalGold.toLocaleString()} G</span>
          <span style="color:#555"> &nbsp;·&nbsp; </span>
          <span style="color:var(--blue);font-weight:bold">💎 ${result.totalMat}개</span>
        </span>
      </div>
      <p style="font-size:0.75rem;color:#888;margin:10px 0 14px;text-align:center">
        누적 재화는 파견 탭 → 정산하기로 수령하세요.
      </p>
      <button class="btn btn-gold btn-full"
        onclick="document.getElementById('offline-popup').classList.add('hidden');document.getElementById('overlay').classList.add('hidden')">
        ✅ 확인했습니다
      </button>
    </div>`;

  popup.classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

// ===== 인벤토리 팝업 =====
let _invFilter = 'all';

function openInventoryPopup() {
  _invFilter = 'all';
  renderInventoryPopup();
  openPopup('inventory-popup');
}

function renderInventoryPopup(filter) {
  if (filter) _invFilter = filter;
  const items = State.inventory;
  const eqCount   = items.filter(i => i.slot).length;
  const bookCount = items.filter(i => i.type === 'exp_book').length;

  const filtered = _invFilter === 'equipment' ? items.filter(i => i.slot)
    : _invFilter === 'exp_book'               ? items.filter(i => i.type === 'exp_book')
    : items;

  const dispatched = getDispatchedAdvIds();
  const idleAdv = State.adventurers.filter(a => !dispatched.has(a.id));

  // 장비 행 렌더
  const BRANCH_LABEL = { warrior: '전사', rogue: '도적', mage: '마법사/치유사' };
  const eqRows = filtered.filter(i => i.slot).map(item => {
    const realIdx = items.indexOf(item);
    // 무기는 직업 계열이 일치하는 모험가만 선택 가능 (치유사는 mage 무기 공유)
    const compatAdv = idleAdv.filter(a => {
      if (item.slot !== 'weapon' || !item.jobClass) return true;
      const branch = JOBS[a.job]?.branch;
      const effectiveBranch = branch === 'healer' ? 'mage' : branch;
      return effectiveBranch === item.jobClass;
    });
    const advOpts = compatAdv.map(a =>
      `<option value="${a.id}">${a.name} (${JOBS[a.job].name})</option>`
    ).join('');
    const jobClassTag = item.slot === 'weapon' && item.jobClass
      ? `<span class="inv-item-slot-tag" style="color:#8b5e3c">${BRANCH_LABEL[item.jobClass]}계 전용</span>`
      : '';
    const optHtml = formatEquipOptions(item.options);
    const sellGold = (SELL_PRICES    && SELL_PRICES[item.grade])    || 80;
    const dismMat  = (DISMANTLE_MATS && DISMANTLE_MATS[item.grade]) || 1;
    return `
      <div class="inv-item-row">
        <img src="${item.icon}" alt="${item.name}" class="inv-item-icon" onerror="this.style.display='none'">
        <div class="inv-item-info">
          <div class="inv-item-name">
            ${item.name}
            <span style="color:${gradeColor(item.grade)};font-weight:bold;margin-left:4px">${item.grade}급</span>
          </div>
          <div class="inv-item-stats">${formatEquipStats(item.stats)}</div>
          ${optHtml ? `<div class="equip-options-wrap" style="margin-top:3px">${optHtml}</div>` : ''}
          <div class="inv-item-slot-tag">${slotLabel(item.slot)}</div>
          ${jobClassTag}
        </div>
        <div class="inv-item-action">
          ${compatAdv.length > 0 ? `
            <select id="inv-sel-${realIdx}" class="inv-adv-select">
              <option value="">모험가 선택</option>
              ${advOpts}
            </select>
            <button class="btn btn-primary inv-action-btn"
              onclick="equipFromInventory(${realIdx}, document.getElementById('inv-sel-${realIdx}').value)">
              장착
            </button>
          ` : idleAdv.length > 0
            ? `<span class="inv-no-action">호환 모험가<br>없음</span>`
            : `<span class="inv-no-action">대기 중<br>모험가 없음</span>`}
          <div class="inv-sell-row">
            <button class="inv-sell-btn inv-sell-gold" onclick="sellEquipment(${realIdx});renderInventoryPopup()">
              💰 ${sellGold.toLocaleString()}
            </button>
            <button class="inv-sell-btn inv-sell-mat" onclick="dismantleEquipment(${realIdx});renderInventoryPopup()">
              🔧+${dismMat}
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // 경험치 서 — 같은 이름끼리 묶어서 스택 표시
  const bookMap = {};
  filtered.filter(i => i.type === 'exp_book').forEach(item => {
    if (!bookMap[item.name]) bookMap[item.name] = { item, count: 0 };
    bookMap[item.name].count++;
  });
  const bookRows = Object.values(bookMap).map(({ item, count }) => {
    const advOpts = State.adventurers.map(a =>
      `<option value="${a.id}">${a.name} Lv.${a.level}</option>`
    ).join('');
    const safeKey = item.name.replace(/[\[\] ]/g, '_');
    return `
      <div class="inv-item-row">
        <div style="position:relative;flex-shrink:0">
          <img src="${item.icon}" alt="${item.name}" class="inv-item-icon" onerror="this.style.display='none'">
          ${count > 1 ? `<span class="inv-stack-badge">${count}</span>` : ''}
        </div>
        <div class="inv-item-info">
          <div class="inv-item-name">${item.name}</div>
          <div class="inv-item-stats" style="color:var(--green-dark)">경험치 +${item.expValue.toLocaleString()}</div>
        </div>
        <div class="inv-item-action">
          ${State.adventurers.length > 0 ? `
            <select id="inv-bsel-${safeKey}" class="inv-adv-select">
              <option value="">모험가 선택</option>
              ${advOpts}
            </select>
            <button class="btn btn-gold inv-action-btn"
              onclick="useBookByName('${item.name}', document.getElementById('inv-bsel-${safeKey}').value)">
              사용 (${count}개)
            </button>
          ` : `<span class="inv-no-action">모험가 없음</span>`}
        </div>
      </div>`;
  }).join('');

  const itemsHtml = (eqRows + bookRows) || `<div class="empty-state" style="padding:24px 0">
      <div class="empty-icon">📦</div>
      <p>아이템이 없습니다.</p>
     </div>`;

  document.getElementById('inventory-content').innerHTML = `
    <div class="inv-filter-tabs">
      <button class="inv-filter-btn${_invFilter==='all'?' active':''}"
        onclick="renderInventoryPopup('all')">전체 (${items.length})</button>
      <button class="inv-filter-btn${_invFilter==='equipment'?' active':''}"
        onclick="renderInventoryPopup('equipment')">장비 (${eqCount})</button>
      <button class="inv-filter-btn${_invFilter==='exp_book'?' active':''}"
        onclick="renderInventoryPopup('exp_book')">경험치 서 (${bookCount})</button>
    </div>
    <div class="inv-items-list">${itemsHtml}</div>
  `;
}

function slotLabel(slot) {
  return { weapon: '⚔️ 무기', armor: '🛡️ 방어구', accessory: '💍 악세서리' }[slot] || slot;
}

function equipFromInventory(inventoryIdx, advIdStr) {
  if (!advIdStr) { showToast('모험가를 선택하세요.', 'error'); return; }
  equipItem(parseInt(advIdStr), inventoryIdx);
  updateInvBadge();
  renderInventoryPopup();
}

function useBookFromInventory(inventoryIdx, advIdStr) {
  if (!advIdStr) { showToast('모험가를 선택하세요.', 'error'); return; }
  useExpBook(parseInt(advIdStr), inventoryIdx);
  updateInvBadge();
  renderInventoryPopup();
}

function useBookByName(bookName, advIdStr) {
  if (!advIdStr) { showToast('모험가를 선택하세요.', 'error'); return; }
  const idx = State.inventory.findIndex(i => i.type === 'exp_book' && i.name === bookName);
  if (idx === -1) { showToast('해당 경험치 서를 찾을 수 없습니다.', 'error'); return; }
  useExpBook(parseInt(advIdStr), idx);
  updateInvBadge();
  renderInventoryPopup();
}

function useExpBookByName(advId, bookName) {
  const idx = State.inventory.findIndex(i => i.type === 'exp_book' && i.name === bookName);
  if (idx === -1) { showToast('해당 경험치 서를 찾을 수 없습니다.', 'error'); return; }
  useExpBook(advId, idx);
  renderAdventurerTab();
}

function updateInvBadge() {
  const badge = document.getElementById('inv-count-badge');
  if (badge) badge.textContent = State.inventory.length > 0 ? `(${State.inventory.length})` : '';
}

// ===== 튜토리얼 =====
const TUTORIAL_STEPS = [
  { text: '안녕하세요 길드장님! 저는 클로에입니다. 베른 모험가 길드에 오신 걸 환영해요! 제가 길드 운영을 도와드릴게요.', highlight: null },
  { text: '우선 모집 탭을 확인해 볼까요? 저한테 오늘 지원서가 들어왔거든요. 마음에 드는 모험가를 골라 길드에 합류시켜 주세요!', highlight: '#tab-bar .tab-btn:nth-child(4)' },
  { text: '길드에 합류한 모험가는 모험가 탭에서 확인할 수 있어요. 장비도 장착하고, 레벨업도 시킬 수 있답니다!', highlight: '#tab-bar .tab-btn:nth-child(2)' },
  { text: '파견 탭에서 팀을 꾸려 지역으로 파견을 보내세요. 파견 중인 모험가들은 알아서 싸우고 골드와 재료를 모아온답니다!', highlight: '#tab-bar .tab-btn:nth-child(3)' },
  { text: '모험가들이 돌아오면 정산 버튼으로 성과물을 회수하세요. 골드와 재료로 길드 건물을 업그레이드할 수 있어요!', highlight: '#tab-bar .tab-btn:nth-child(1)' },
  { text: '연구소에서는 경험치 책을 제작해 모험가를 빠르게 성장시킬 수 있어요. 골드가 많이 모이면 영구 단련도 해보세요. 리빌딩 후에도 효과가 사라지지 않는 강력한 강화랍니다!', highlight: '#tab-bar .tab-btn:nth-child(6)' },
  { text: '경지 탭은 고급 기능이에요. 길드를 충분히 키웠다면 리빌딩으로 새 출발을 할 수 있어요. 누적 골드로 스킬포인트를 얻고, 경지 트리를 해금하면 길드 전체가 영구적으로 강해진답니다!', highlight: '#tab-bar .tab-btn:nth-child(7)' },
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

// ===== 연구소 탭 =====
function formatCraftTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return sec > 0 ? `${m}분 ${sec}초` : `${m}분`;
  const h = Math.floor(m / 60), min = m % 60;
  return min > 0 ? `${h}시간 ${min}분` : `${h}시간`;
}

// ===== 경지 탭 =====
function renderPrestigeTab() {
  const el = document.getElementById('prestige-content');
  if (!el) return;

  const pts       = State.prestigePoints || 0;
  const earned    = State.totalPrestigeEarned || 0;
  const lifetime  = State.lifetimeGold || 0;
  const totalCan  = calcTotalEarnablePoints();
  const pending   = Math.max(0, totalCan - earned);   // 지금 리빌딩 시 획득 포인트
  const rebuilds  = State.rebuildCount || 0;
  const allMet    = canRebuild();

  // ── 리빌딩 패널 ──
  const condHtml = REBUILD_CONDITIONS.map(c => {
    const ok = c.check();
    return `<div class="rebuild-cond ${ok ? 'ok' : 'nok'}">
      <span>${ok ? '✅' : '❌'}</span> ${c.label}
    </div>`;
  }).join('');

  const rebuildBtn = `
    <button class="btn ${allMet ? 'btn-danger' : 'btn-outline'} btn-full"
      onclick="openRebuildDialog()" style="margin-top:14px">
      ${allMet ? '🔄 리빌딩 실행' : '🔒 조건 미달성'}
    </button>`;

  // ── 트리 브랜치 렌더 ──
  const BRANCH_META = {
    growth:   { label: '🌱 성장 가지',   color: '#4caf50' },
    venture:  { label: '🗺️ 모험 가지',   color: '#1976d2' },
    survival: { label: '🛡️ 생존 가지',   color: '#f57c00' },
    realm:    { label: '⭐ 경지 가지',   color: '#7b1fa2' },
  };

  const unlocked = new Set(State.prestigeNodes || []);

  function nodeCard(node) {
    const isUnlocked  = unlocked.has(node.id);
    const reqOk       = !node.requires || unlocked.has(node.requires);
    const canAfford   = pts >= node.cost;
    const canBuy      = reqOk && !isUnlocked && canAfford;
    const locked      = !reqOk;

    let cls = 'prestige-node';
    if (isUnlocked) cls += ' node-done';
    else if (locked) cls += ' node-locked';
    else if (canAfford) cls += ' node-ready';
    else cls += ' node-poor';

    const btn = isUnlocked
      ? `<span class="node-status">✓ 개방됨</span>`
      : locked
        ? `<span class="node-status locked-txt">🔒 이전 노드 필요</span>`
        : `<button class="btn btn-sm ${canBuy ? 'btn-primary' : 'btn-outline'}"
            ${canBuy ? '' : 'disabled'}
            onclick="if(spendPrestigeNode('${node.id}')) renderPrestigeTab()">
            ${node.cost}pt 개방
           </button>`;

    return `<div class="${cls}">
      <div class="node-name">${node.name}</div>
      <div class="node-desc">${node.desc}</div>
      ${btn}
    </div>`;
  }

  // 중심 노드
  const genesisNode = PRESTIGE_NODES.find(n => n.id === 'genesis');
  const genesisHtml = nodeCard(genesisNode);

  // 브랜치별
  const branchesHtml = Object.entries(BRANCH_META).map(([branch, meta]) => {
    const nodes = PRESTIGE_NODES.filter(n => n.branch === branch).sort((a, b) => a.depth - b.depth);
    if (!nodes.length) return '';
    return `<div class="prestige-branch">
      <div class="branch-title" style="color:${meta.color}">${meta.label}</div>
      ${nodes.map(nodeCard).join('')}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="prestige-header">
      <div class="prestige-stat-row">
        <div class="prestige-stat"><span class="pstat-label">보유 스킬포인트</span><span class="pstat-val gold-text">${pts}pt</span></div>
        <div class="prestige-stat"><span class="pstat-label">리빌딩 횟수</span><span class="pstat-val">${rebuilds}회</span></div>
        <div class="prestige-stat"><span class="pstat-label">누적 골드</span><span class="pstat-val">${lifetime.toLocaleString()}G</span></div>
        <div class="prestige-stat"><span class="pstat-label">다음 리빌딩 획득</span><span class="pstat-val ${pending > 0 ? 'gold-text' : ''}">+${pending}pt</span></div>
      </div>
    </div>

    <div class="rebuild-panel">
      <div class="rebuild-panel-title">🔄 리빌딩 조건</div>
      <div class="rebuild-cond-list">${condHtml}</div>
      ${rebuildBtn}
    </div>

    <div class="prestige-tree-title">경지 트리</div>
    <div class="prestige-center-wrap">${genesisHtml}</div>
    <div class="prestige-branches">${branchesHtml}</div>`;
}

function openRebuildDialog() {
  const popup = document.getElementById('rebuild-popup');
  const allMet = canRebuild();
  const pending = Math.max(0, calcTotalEarnablePoints() - (State.totalPrestigeEarned || 0));

  const condHtml = REBUILD_CONDITIONS.map(c => {
    const ok = c.check();
    return `<div class="rebuild-cond ${ok ? 'ok' : 'nok'}"><span>${ok ? '✅' : '❌'}</span> ${c.label}</div>`;
  }).join('');

  const bodyEl = document.getElementById('rebuild-popup-body');
  if (allMet) {
    bodyEl.innerHTML = `
      <p class="rebuild-chloe-speech">길드장님, 지금까지 정말 고생 많으셨어요. 베른 전역을 평정하셨으니, 이제 새 출발을 하실 수 있어요. 리빌딩을 하시면 처음부터 다시 시작하지만… 길드장님이 쌓아온 경험만큼은 절대 사라지지 않아요!</p>
      <div class="rebuild-cond-list">${condHtml}</div>
      <div class="rebuild-gain-box">이번 리빌딩 획득: <b class="gold-text">+${pending}pt</b></div>
      <div style="color:#c62828;font-size:0.82rem;margin-top:8px">⚠️ 모험가·장비·건물·골드가 모두 초기화됩니다. 스킬포인트와 경지 트리는 유지됩니다.</div>
      <button class="btn btn-danger btn-full" style="margin-top:14px" onclick="confirmRebuild()">🔄 리빌딩 실행</button>`;
  } else {
    bodyEl.innerHTML = `
      <p class="rebuild-chloe-speech">아직 조건이 충족되지 않았어요, 길드장님. 베른 전역을 완전히 평정하고, 길드도 좀 더 키워주세요!</p>
      <div class="rebuild-cond-list">${condHtml}</div>`;
  }

  popup.classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function confirmRebuild() {
  closePopup('rebuild-popup');
  doRebuild();
  switchTab('prestige');
}

function renderLabTab() {
  const el = document.getElementById('lab-content');
  if (!el) return;

  const labLv = getBuildingLevel('laboratory');
  const q = State.labQueue;
  const now = Date.now();

  // 현재 제작 현황
  let queueHtml;
  if (q) {
    const remaining = Math.max(0, q.finishAt - now);
    const pct = Math.min(100, ((q.totalMs - remaining) / q.totalMs) * 100).toFixed(1);
    const col = gradeColor(q.grade);
    queueHtml = `
      <div class="lab-queue-card active">
        <div class="lab-queue-item">
          <img src="${q.icon}" class="lab-queue-icon" onerror="this.style.display='none'" />
          <div class="lab-queue-info">
            <div class="lab-queue-name" style="color:${col}">${q.name}</div>
            <div class="progress-bar-wrap" style="margin:6px 0">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="lab-queue-time">남은 시간: <strong>${formatCraftTime(remaining)}</strong></div>
          </div>
        </div>
        <button class="btn btn-danger" style="margin-top:10px;width:100%"
          onclick="if(cancelCraft()) renderLabTab()">취소 (재료 전액 환불)</button>
      </div>`;
  } else {
    queueHtml = `<div class="lab-queue-card empty">⚗️ 제작 슬롯이 비어 있습니다.</div>`;
  }

  // 레시피 목록
  const recipesHtml = LAB_RECIPES.map(recipe => {
    const labLvOk  = labLv >= recipe.reqLabLv;
    const canAfford = State.gold >= recipe.cost.gold && State.materials >= recipe.cost.material;
    const busy      = !!q;
    const disabled  = busy || !labLvOk;
    const speedMult = (100 + labLv * 10) / 100;
    const actualMs  = Math.floor(recipe.craftTime / speedMult) * 1000;
    const col       = gradeColor(recipe.grade);
    const btnLabel  = busy ? '제작 중...' : !labLvOk ? `🔒 Lv.${recipe.reqLabLv} 필요` : '제작 시작';
    const costStyle = canAfford ? '' : 'color:#e57373';

    return `
      <div class="lab-recipe-card${disabled ? ' disabled' : ''}">
        <div class="lab-recipe-header">
          <img src="${recipe.icon}" class="lab-recipe-icon" onerror="this.style.display='none'" />
          <div>
            <div class="lab-recipe-name" style="color:${col}">${recipe.name}</div>
            <div class="lab-recipe-exp">EXP <strong>+${recipe.expValue.toLocaleString()}</strong></div>
          </div>
        </div>
        <div class="lab-recipe-cost" style="${costStyle}">
          💰 ${recipe.cost.gold.toLocaleString()} &nbsp;|&nbsp;
          💎 ${recipe.cost.material} &nbsp;|&nbsp;
          ⏱ ${formatCraftTime(actualMs)}
        </div>
        <button class="btn ${disabled ? 'btn-outline' : 'btn-primary'} btn-full"
          onclick="if(startCraft('${recipe.id}')) renderLabTab()"
          ${disabled ? 'disabled' : ''}>${btnLabel}</button>
      </div>`;
  }).join('');

  // 영구 단련 섹션
  const permHtml = PERMANENT_TRAINING.map(tr => {
    const lv   = (State.permanentTraining || {})[tr.id] || 0;
    const cost = getPermanentTrainingCost(tr.id);
    const can  = State.gold >= cost;
    return `
      <div class="lab-recipe-card">
        <div class="lab-recipe-header">
          <span style="font-size:28px;line-height:1">${tr.icon}</span>
          <div style="margin-left:10px">
            <div class="lab-recipe-name">${tr.name}</div>
            <div class="lab-recipe-exp">현재 <strong>Lv.${lv}</strong> &nbsp;(${tr.desc} × ${lv})</div>
          </div>
        </div>
        <div class="lab-recipe-cost" style="${can ? '' : 'color:#e57373'}">
          💰 ${cost.toLocaleString()} G
        </div>
        <button class="btn ${can ? 'btn-primary' : 'btn-outline'} btn-full"
          onclick="if(buyPermanentTraining('${tr.id}')) renderLabTab()"
          ${can ? '' : 'disabled'}>
          ${can ? '단련하기' : '골드 부족'}
        </button>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="lab-section-title">현재 제작</div>
    ${queueHtml}
    <div class="lab-section-title" style="margin-top:20px">경험치 책 제작</div>
    <div class="lab-recipes-grid">${recipesHtml}</div>
    <div class="lab-section-title" style="margin-top:20px">영구 단련
      <span style="font-size:11px;font-weight:normal;color:#aaa;margin-left:8px">리빌딩 후에도 유지됩니다</span>
    </div>
    <div class="lab-recipes-grid">${permHtml}</div>`;
}
