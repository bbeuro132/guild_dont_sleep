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

// 재료 등급 한글 레이블
const MAT_GRADE_LABELS = { common: '일반', advanced: '고급', rare: '희귀', legendary: '전설' };

function formatUpgradeDuration(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return h > 0 ? `${d}일 ${h}시간` : `${d}일`;
}

// ===== 헤더 업데이트 =====
function renderHeader() {
  updateTabVisibility();
  document.getElementById('gold-amount').textContent = Math.floor(State.gold).toLocaleString();
  const m = State.materials || {};
  document.getElementById('mat-common').textContent    = Math.floor(m.common    || 0).toLocaleString();
  document.getElementById('mat-advanced').textContent  = Math.floor(m.advanced  || 0).toLocaleString();
  document.getElementById('mat-rare').textContent      = Math.floor(m.rare      || 0).toLocaleString();
  document.getElementById('mat-legendary').textContent = Math.floor(m.legendary || 0).toLocaleString();
}

// ===== 탭 해금 상태 =====
function getUnlockedTabs() {
  const hqLv = getBuildingLevel('headquarters');
  return {
    guild: true, adventurer: true, dispatch: true, recruit: true,
    lab: hqLv >= 2,
    shop: hqLv >= 4,
    prestige: hqLv >= 5,
  };
}

function updateTabVisibility() {
  const unlocked = getUnlockedTabs();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab;
    if (unlocked[tab] === false) {
      btn.classList.add('tab-locked');
      btn.setAttribute('disabled', 'true');
    } else {
      btn.classList.remove('tab-locked');
      btn.removeAttribute('disabled');
    }
  });
}

// ===== 탭 전환 =====
function switchTab(tabId) {
  const unlocked = getUnlockedTabs();
  if (unlocked[tabId] === false) return;
  if (tabId === 'lab') unlockCharacter('aida');
  if (tabId === 'shop') unlockCharacter('sion');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
  updateTabVisibility();
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
  const upg = State.buildingUpgrade;

  for (const building of BUILDINGS) {
    const lv    = getBuildingLevel(building.id);
    const cost  = getBuildingUpgradeCost(building);
    const maxed = building.maxLevel && lv >= building.maxLevel;
    const isUpgrading     = upg && upg.buildingId === building.id;
    const anotherUpgrading = upg && upg.buildingId !== building.id;

    const canAfford = !maxed && !upg &&
      State.gold >= cost.gold &&
      Object.entries(cost.materials).every(([g, qty]) => (State.materials[g] || 0) >= qty);

    const matLabel = Object.entries(cost.materials)
      .map(([g, qty]) => `${MAT_GRADE_LABELS[g] ?? g} ${qty}`)
      .join(' + ');

    let actionHtml;
    if (isUpgrading) {
      const totalSec  = (upg.finishAt - upg.startAt) / 1000;
      const remaining = Math.max(0, (upg.finishAt - Date.now()) / 1000);
      const pct       = Math.min(100, Math.round((1 - remaining / totalSec) * 100));
      actionHtml = `
        <div style="margin:8px 0 4px">
          <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:8px;overflow:hidden">
            <div style="background:#f0c040;width:${pct}%;height:100%;transition:width 1s linear"></div>
          </div>
        </div>
        <div style="text-align:center;font-size:0.82rem;color:#ccc;margin-bottom:6px">
          ⏳ 완료까지 ${formatUpgradeDuration(remaining)}
        </div>
        <button class="btn btn-danger btn-full"
          onclick="cancelBuildingUpgrade(); renderGuildTab(); renderHeader();">
          ✕ 취소 (재료 전액 환불)
        </button>
      `;
    } else if (maxed) {
      actionHtml = '<p style="color:#888;font-size:0.8rem;text-align:center">최대 레벨 달성</p>';
    } else {
      const upgTime = getBuildingUpgradeTime(lv);
      actionHtml = `
        <div class="building-cost">
          <span class="cost-chip"><img src="assets/items/CoinsGold.PNG" alt="골드"> ${cost.gold.toLocaleString()}</span>
          <span class="cost-chip"><img src="assets/items/I_Crystal01.png" alt="재료"> ${matLabel}</span>
          <span class="cost-chip">⏱ ${formatUpgradeDuration(upgTime)}</span>
        </div>
        <button class="btn ${canAfford ? 'btn-gold' : 'btn-outline'} btn-full"
          ${(canAfford && !anotherUpgrading) ? '' : 'disabled'}
          onclick="upgradeBuilding('${building.id}'); renderGuildTab(); renderHeader();">
          ${anotherUpgrading ? '다른 건물 업그레이드 중...' : '업그레이드 →'}
        </button>
      `;
    }

    const card = document.createElement('div');
    card.className = `building-card${isUpgrading ? ' building-upgrading' : ''}`;
    card.innerHTML = `
      <div class="building-header">
        <div class="building-name">${building.icon} ${building.name}</div>
        <div class="building-level">Lv.${lv}${maxed ? ' (MAX)' : ''}${isUpgrading ? ' → ' + upg.targetLevel : ''}</div>
      </div>
      <div class="building-desc">${building.desc}</div>
      <div class="building-effect">✨ ${building.effectLabel(lv)}</div>
      ${actionHtml}
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
  const promoCostTier = jobInfo.tier === 1 ? 'tier2' : jobInfo.tier === 3 ? 'tier4' : 'tier3';
  const promoCost = PROMOTION_COST[promoCostTier];

  const promoButtons = promoTargets.map(pJob => {
    const pInfo = JOBS[pJob];
    const canPromo = adv.level >= promoCost.level
      && State.gold >= promoCost.gold
      && (State.materials.common || 0) >= promoCost.material;
    return `<button class="btn btn-primary" ${canPromo ? '' : 'disabled'}
      onclick="openPromoPreview(${adv.id}, '${pJob}')">
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
          onclick="gameConfirm('🚪 해고', '정말 ${adv.name}을(를) 해고하시겠습니까?\\n장착 중인 장비는 인벤토리로 반환됩니다.', () => {if(dismissAdventurer(${adv.id})){selectedAdvId=null;renderAdventurerTab();renderHeader()}})">
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
    ${_equipPickerAdvId === adv.id && _equipPickerSlot ? renderEquipPicker(adv, _equipPickerSlot) : ''}
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
    <div style="margin-bottom:10px">
      <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">스킬</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(JOB_SKILLS[adv.job] || []).map(sid => {
          const sk = SKILLS[sid];
          if (!sk) return '';
          const cdLabel = sk.type === 'passive' ? '패시브' : `쿨다운 ${sk.cooldown}턴`;
          return `<div style="background:var(--bg-light,#fdf6ec);border:1px solid var(--brown-light,#e0c89a);border-radius:8px;padding:7px 10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
              <span style="font-size:0.82rem;font-weight:bold;color:var(--brown-dark)">${sk.name}</span>
              <span style="font-size:0.7rem;color:#aaa">${cdLabel}</span>
            </div>
            <div style="font-size:0.75rem;color:#666;line-height:1.4">${sk.desc || ''}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ${promoTargets.length > 0 ? `
    <div>
      <div style="font-size:0.8rem;font-weight:bold;color:#888;margin-bottom:5px">
        ${jobInfo.tier + 1}차 전직 (Lv.${promoCost.level} / 골드 ${promoCost.gold.toLocaleString()} / 일반 재료 ${promoCost.material})
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
      ? `<div style="font-size:0.58rem;color:var(--brown);margin-bottom:1px">${{ warrior:'전사', rogue:'도적', mage:'마법사/치유사' }[item.jobClass]}계</div>`
      : `<div style="font-size:0.58rem;margin-bottom:1px">&nbsp;</div>`;
    return `<div class="equip-slot has-item">
      <img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none'">
      ${jobClassTag}
      <div style="font-size:0.7rem;color:var(--brown-dark);font-weight:bold">${item.name}</div>
      <div style="font-size:0.65rem;color:${gradeColor(item.grade)};font-weight:bold">${item.grade}급</div>
      <div style="font-size:0.6rem;color:#888;line-height:1.4;margin:2px 0">${formatEquipStats(item.stats)}</div>
      ${optHtml ? `<div class="equip-options-wrap">${optHtml}</div>` : ''}
      <div style="margin-top:4px">
        <button class="btn btn-outline" style="font-size:0.6rem;padding:2px 6px;width:100%"
          onclick="event.stopPropagation();unequipItem(${adv.id},'${slot}');renderAdventurerTab()">해제</button>
      </div>
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

  const countLabel = avail.length > 0
    ? `<div style="font-size:0.62rem;color:var(--green-dark);margin-top:2px">장착 가능 ${avail.length}개</div>`
    : `<div style="font-size:0.6rem;color:#bbb">없음</div>`;

  return `<div class="equip-slot" style="cursor:pointer" onclick="openEquipPicker(${adv.id},'${slot}')">
    <div style="font-size:1.2rem">＋</div>
    <div style="font-size:0.75rem">${label}</div>
    ${countLabel}
  </div>`;
}

let _equipPickerSlot = null;
let _equipPickerAdvId = null;

function openEquipPicker(advId, slot) {
  _equipPickerAdvId = advId;
  _equipPickerSlot = slot;
  renderAdvDetail(advId);
}

function closeEquipPicker() {
  _equipPickerAdvId = null;
  _equipPickerSlot = null;
  renderAdvDetail(selectedAdvId);
}

function quickEquip(advId, inventoryIdx) {
  equipItem(advId, inventoryIdx);
  _equipPickerAdvId = null;
  _equipPickerSlot = null;
  renderAdvDetail(advId);
  renderAdventurerTab();
}

function renderEquipPicker(adv, slot) {
  const advBranch = JOBS[adv.job]?.branch;
  const weaponBranch = advBranch === 'healer' ? 'mage' : advBranch;
  const avail = [];
  State.inventory.forEach((it, idx) => {
    if (it.slot !== slot) return;
    if (slot === 'weapon' && it.jobClass && it.jobClass !== weaponBranch) return;
    avail.push({ item: it, idx });
  });

  const slotLabels = { weapon: '무기', armor: '방어구', accessory: '악세서리' };
  if (avail.length === 0) {
    return `<div class="equip-picker">
      <div class="equip-picker-header">
        <strong>${slotLabels[slot]} 선택</strong>
        <button class="btn btn-outline" style="font-size:0.7rem;padding:2px 8px" onclick="closeEquipPicker()">닫기</button>
      </div>
      <p style="color:#888;font-size:0.82rem;text-align:center;padding:16px 0">장착 가능한 ${slotLabels[slot]}가 없습니다.</p>
    </div>`;
  }

  const rows = avail.map(({ item, idx }) => {
    const col = gradeColor(item.grade);
    const statsText = formatEquipStats(item.stats);
    const optHtml = formatEquipOptions(item.options);
    return `<div class="equip-picker-item" onclick="quickEquip(${adv.id},${idx})">
      <img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none'" />
      <div class="equip-picker-info">
        <div style="font-weight:bold;color:${col}">${item.name} <span style="font-size:0.75rem">${item.grade}급</span></div>
        <div style="font-size:0.75rem;color:#aaa">${statsText}</div>
        ${optHtml ? `<div class="equip-options-wrap" style="margin-top:2px">${optHtml}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `<div class="equip-picker">
    <div class="equip-picker-header">
      <strong>${slotLabels[slot]} 선택</strong>
      <span style="font-size:0.75rem;color:#aaa">${avail.length}개</span>
      <button class="btn btn-outline" style="font-size:0.7rem;padding:2px 8px;margin-left:auto" onclick="closeEquipPicker()">닫기</button>
    </div>
    <div class="equip-picker-list">${rows}</div>
  </div>`;
}

function gradeColor(grade) {
  return { '일반': '#9e9e9e', '마법': '#388e3c', '희귀': '#1976d2', '영웅': '#7b1fa2', '전설': '#f57c00', '신화': '#e53935' }[grade] || '#9e9e9e';
}

function openPromoPreview(advId, targetJob) {
  const pInfo = JOBS[targetJob];
  if (!pInfo) return;
  const skillIds = JOB_SKILLS[targetJob] || [];
  const skillHtml = skillIds.map(sid => {
    const sk = SKILLS[sid];
    if (!sk) return '';
    const typeLabel = sk.type === 'passive' ? '패시브' : `쿨다운 ${sk.cooldown}턴`;
    return `<div style="margin-bottom:8px;padding:8px;background:rgba(0,0,0,0.04);border-radius:6px">
      <div style="font-weight:bold;color:var(--brown-dark)">${sk.name} <span style="font-size:0.75rem;color:#888;font-weight:normal">${typeLabel}</span></div>
      <div style="font-size:0.82rem;color:#666;margin-top:2px">${sk.desc}</div>
    </div>`;
  }).join('');

  document.getElementById('promo-popup-title').innerHTML =
    `<span class="${pInfo.cssClass}" style="padding:3px 10px;border-radius:6px;color:white;font-size:0.9rem">${pInfo.name}</span> 전직 미리보기`;
  document.getElementById('promo-popup-body').innerHTML = `
    <div style="margin-bottom:12px;font-size:0.82rem;color:#888">이 직업의 스킬:</div>
    ${skillHtml || '<p style="color:#aaa">스킬 정보가 없습니다.</p>'}
  `;
  document.getElementById('promo-popup-confirm').onclick = () => {
    closePopup('promo-popup');
    promoteAdventurer(advId, targetJob);
    renderAdventurerTab();
  };
  openPopup('promo-popup');
}

function promoteAdventurer(advId, targetJob) {
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) return;
  const jobInfo = JOBS[adv.job];
  const tier = jobInfo.tier;
  if (JOBS[targetJob]?.tier === 3 && !hasPrestigeEffect('tier3unlock')) {
    showToast('3차 전직은 경지 개방 Ⅰ이 필요합니다. (경지 탭 → 경지 가지 노드 개방)', 'error');
    return;
  }
  if (JOBS[targetJob]?.tier === 4 && !hasPrestigeEffect('tier4unlock')) {
    showToast('4차 전직은 경지 개방 Ⅱ가 필요합니다. (경지 탭 → 경지 가지 노드 개방)', 'error');
    return;
  }
  const costKey = tier === 1 ? 'tier2' : tier === 3 ? 'tier4' : 'tier3';
  const cost = PROMOTION_COST[costKey];
  if (adv.level < cost.level) { showToast(`레벨 ${cost.level} 이상 필요합니다.`, 'error'); return; }
  if (!spendGold(cost.gold)) { showToast('골드가 부족합니다.', 'error'); return; }
  if (!spendMaterials({ common: cost.material })) { addGold(cost.gold); showToast('일반 재료가 부족합니다.', 'error'); return; }
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
    if (country === '미지의 영역' && !State.tiamatMet) continue;
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
          const accMatsObj = activeDispatch.accumulated.materials || {};
          const accMat = Object.entries(accMatsObj)
            .filter(([, v]) => v >= 0.1)
            .map(([g, v]) => `${MAT_GRADE_LABELS[g]}: ${v.toFixed(1)}`)
            .join(' / ') || '0';
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
                <button class="btn btn-outline" onclick="gameConfirm('🏠 귀환 명령', '파견 팀을 귀환시키겠습니까?\\n잔여 누적 재화도 함께 수령합니다.', () => {recallDispatch('${area.id}');renderDispatchTab();renderHeader()})">🏠 귀환 명령</button>
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
            ⚔️ 승리 시 💰${Math.max(1, Math.floor(0.5 * Math.pow(area.stage, 1.8)))} · 보스 ×5
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
  sessionStorage.setItem(`nation_open_${country}`, isOpen ? '1' : '0');
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
    <div class="settlement-row"><span class="settlement-label">💎 획득 재료</span><span class="settlement-value">${Object.entries(result.materials || {}).filter(([,v])=>v>0).map(([g,v])=>`${MAT_GRADE_LABELS[g]} ${v}`).join(', ') || '없음'}</span></div>
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
  const buffs = (State.activeBuffs || []).filter(b => b.expiresAt > Date.now());

  let buffHtml = '';
  if (buffs.length > 0) {
    buffHtml = `<div class="lab-section-title">활성 부스트</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${buffs.map(b => {
          const rem = Math.max(0, (b.expiresAt - Date.now()) / 1000);
          return `<div style="background:rgba(240,192,64,0.15);border:1px solid rgba(240,192,64,0.4);border-radius:6px;padding:6px 12px;font-size:0.8rem;color:#f0c040">
            ✨ ${b.name} +${b.value}% <span style="color:#aaa">(${formatUpgradeDuration(rem)})</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  const permHtml = SHOP_PERMANENT.map(item => {
    const canAfford = State.gold >= item.price;
    const isActive = item.type === 'consumable' && buffs.some(b => b.effect === item.effect);
    return `
      <div class="shop-item-card">
        <img src="${item.icon}" alt="${item.name}" onerror="this.style.display='none'">
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
        <div class="shop-item-price">💰 ${item.price.toLocaleString()} G</div>
        <button class="btn btn-gold btn-full" ${canAfford && !isActive ? '' : 'disabled'}
          onclick="buyShopPermanent('${item.id}'); renderShopTab(); renderHeader();">
          ${isActive ? '✨ 이미 활성 중' : '구매'}
        </button>
      </div>`;
  }).join('');

  const rotation = State.shopRotation || [];
  const remaining = Math.max(0, ((State.lastShopRefresh || 0) + SHOP_REFRESH_INTERVAL - Date.now()) / 1000);

  const rotHtml = rotation.map((item, i) => {
    if (item.sold) {
      return `<div class="shop-item-card" style="opacity:0.4">
        <div style="text-align:center;color:#666;padding:30px 0;font-size:0.85rem">판매 완료</div>
      </div>`;
    }
    const canAfford = State.gold >= item.price;
    const col = item.type === 'equipment' ? gradeColor(item.grade) : '';
    return `
      <div class="shop-item-card">
        <img src="${item.icon || 'assets/items/I_Crystal01.png'}" alt="${item.name || ''}" onerror="this.style.display='none'">
        <div class="shop-item-name" ${col ? `style="color:${col}"` : ''}>${item.name || '???'}</div>
        <div class="shop-item-desc">${item.desc || ''}</div>
        <div class="shop-item-price">💰 ${item.price.toLocaleString()} G</div>
        <button class="btn btn-gold btn-full" ${canAfford ? '' : 'disabled'}
          onclick="buyShopRotation(${i}); renderShopTab(); renderHeader();">
          구매
        </button>
      </div>`;
  }).join('');

  container.innerHTML = `
    ${buffHtml}
    <div class="lab-section-title">상시 판매</div>
    <div class="shop-grid">${permHtml}</div>
    <div class="lab-section-title" style="margin-top:20px">
      한정 판매
      <span style="font-size:11px;font-weight:normal;color:#aaa;margin-left:8px">갱신까지 ${formatUpgradeDuration(remaining)}</span>
    </div>
    <div style="margin-bottom:12px">
      <button class="btn btn-outline" style="font-size:0.8rem"
        onclick="if(forceRefreshShop()) { renderShopTab(); renderHeader(); }">
        💰 즉시 갱신 (200 골드)
      </button>
    </div>
    <div class="shop-grid">${rotHtml}</div>
  `;
}

// ===== 게임 내 확인 팝업 =====
function gameConfirm(title, message, onYes) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-yes').onclick = () => {
    closePopup('confirm-popup');
    onYes();
  };
  document.getElementById('confirm-no').onclick = () => {
    closePopup('confirm-popup');
  };
  openPopup('confirm-popup');
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

const CHLOE_HELP = {
  guild:      '건물을 업그레이드하면 길드가 성장해요! 업그레이드에는 자원과 시간이 필요하니 신중하게 선택해주세요.',
  adventurer: '모험가를 클릭 후 장비 슬롯을 통해 모험가에게 장비를 장착시키거나, 조건에 맞는다면 전직도 시켜줄 수 있답니다!',
  dispatch:   '팀을 꾸려 지역에 보내세요. 전투에서 승리해야 골드와 재료를 얻을 수 있어요. 정산 버튼으로 수령하세요!',
  recruit:    '마음에 드는 모험가를 영입하세요. 서류는 15분마다 자동 갱신돼요.',
  shop:       '유랑 상인 시온 씨가 준비한 재료 묶음이나 부스트 스크롤을 구매할 수 있어요. 한정 판매는 1시간마다 바뀌니 자주 확인해 주세요!',
  lab:        '경험치 서와 장비를 제작하고, 재료를 합성할 수 있어요. 담당관 에이다 씨의 솜씨가 뛰어나니 실패할 걱정도 없답니다!',
  prestige:   '길드가 충분히 성장한다면 리빌딩을 통해 길드를 영구적으로 성장시킬 수 있어요. 더 높은 곳을 노리신다면 반드시 목표로 해주세요!',
};

function openChloeHelp() {
  const tab = getCurrentTab();
  const text = CHLOE_HELP[tab] || '무엇이든 물어봐 주세요!';
  document.getElementById('chloe-help-text').textContent = text;
  openPopup('chloe-help-popup');
}

function openLorePopup() {
  document.querySelectorAll('#lore-content > div').forEach(d => d.classList.add('hidden'));
  document.getElementById('lore-world').classList.remove('hidden');
  document.querySelectorAll('.lore-tab').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.lore-tab').classList.add('active');
  document.querySelectorAll('.char-profile').forEach(d => d.classList.add('hidden'));
  document.getElementById('char-chloe').classList.remove('hidden');
  document.querySelectorAll('.char-subtab').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.char-subtab').classList.add('active');
  updateCharLock();
  openPopup('lore-popup');
}

function updateCharLock() {
  const met = State.metCharacters || ['chloe'];
  const chars = { chloe: '클로에', sion: '시온', aida: '에이다', tiamat: '티아마트' };
  document.querySelectorAll('.char-subtab').forEach(btn => {
    const charId = btn.getAttribute('onclick')?.match(/switchCharTab\('(\w+)'\)/)?.[1];
    if (!charId) return;
    if (met.includes(charId)) {
      btn.textContent = chars[charId];
      btn.disabled = false;
      btn.style.opacity = '';
    } else {
      btn.textContent = '???';
      btn.disabled = true;
      btn.style.opacity = '0.4';
    }
  });
  document.querySelectorAll('.char-profile').forEach(el => {
    const charId = el.id.replace('char-', '');
    if (!met.includes(charId)) {
      el.querySelectorAll('.char-profile-body, .char-title').forEach(c => c.style.display = 'none');
      let lock = el.querySelector('.char-lock-msg');
      if (!lock) {
        lock = document.createElement('p');
        lock.className = 'char-lock-msg';
        lock.style.cssText = 'color:#888;text-align:center;padding:30px 0;font-size:0.9rem';
        lock.textContent = '아직 만나지 못한 인물입니다.';
        el.appendChild(lock);
      }
      lock.style.display = '';
    } else {
      el.querySelectorAll('.char-profile-body, .char-title').forEach(c => c.style.display = '');
      const lock = el.querySelector('.char-lock-msg');
      if (lock) lock.style.display = 'none';
    }
  });
}

function switchLoreTab(tabId) {
  document.querySelectorAll('#lore-content > div').forEach(d => d.classList.add('hidden'));
  document.getElementById('lore-' + tabId).classList.remove('hidden');
  document.querySelectorAll('.lore-tab').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

function switchCharTab(charId) {
  document.querySelectorAll('.char-profile').forEach(d => d.classList.add('hidden'));
  document.getElementById('char-' + charId).classList.remove('hidden');
  document.querySelectorAll('.char-subtab').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

function openBattlePopup(areaId) {
  const area = AREAS.find(a => a.id === areaId);
  if (!area) return;
  if (window._currentBattle) window._currentBattle.stop();

  // 이전 팝업이 다른 지역을 보고 있었다면 viewerActive 해제
  if (window._battleAreaId && window._battleAreaId !== areaId) {
    const prev = State.dispatches.find(d => d.areaId === window._battleAreaId);
    if (prev) prev.viewerActive = false;
  }

  const dispatch = State.dispatches.find(d => d.areaId === areaId);
  if (!dispatch) return;

  // 백그라운드 전투 일시정지
  dispatch.viewerActive = true;
  window._battleAreaId = areaId;

  // 팝업 닫기 공통 처리 — HP 동기화 후 백그라운드 재개
  function closeBattleViewer() {
    const d = State.dispatches.find(d => d.areaId === areaId);
    if (d) {
      // 현재 진행 중인 전투의 HP를 dispatch에 반영
      if (window._currentBattle) {
        window._currentBattle.allies.forEach(u => {
          d.partyHp[u.id] = Math.max(0, u.currentHp);
        });
      }
      d.viewerActive = false;
      d.combatCooldown = COMBAT_INTERVAL; // 다음 백그라운드 전투를 즉시 시작하지 않도록 쿨다운 리셋
    }
    window._currentBattle?.stop();
    window._currentBattle = null;
    window._battleAreaId = null;
    closePopup('battle-popup');
  }

  // 전투 1회를 시작하는 내부 함수 — 승패 후 결과를 dispatch에 반영하고 2초 뒤 재호출
  function startBattle(allies, cachedEnemies) {
    const d = State.dispatches.find(dd => dd.areaId === areaId);
    if (!d) { closeBattleViewer(); return; }

    const enemies = cachedEnemies || generateEnemyGroup(area, Math.floor(d.progress));
    d._cachedEnemies = enemies;
    d._cachedProgress = Math.floor(d.progress);
    renderBattleUI(allies, enemies);

    const battle = new LiveBattle(
      allies, enemies,
      (b) => updateBattleUI(b),
      (win) => {
        // 전투 결과를 dispatch에 동기화
        const d2 = State.dispatches.find(dd => dd.areaId === areaId);
        if (d2) {
          if (win) {
            battle.allies.forEach(u => {
              let hp = Math.max(0, u.currentHp);
              if (u.healAfterBattle > 0 && hp > 0) hp = Math.min(u.maxHp, hp + Math.floor(u.maxHp * u.healAfterBattle / 100));
              d2.partyHp[u.id] = hp;
            });
            const isBoss = battle.enemies.some(e => e.isBoss);
            let progGain = 1 + getPrestigeBonusTotal('bonusProgress');
            if (isBoss) progGain += getPrestigeBonusTotal('bossProgress');
            d2.progress = Math.min(d2.progress + progGain, area.maxProgress);
            const lbBaseGold = Math.max(1, Math.floor(0.5 * Math.pow(area.stage, 1.8)));
            const killGold = battle.enemies.length * (isBoss ? lbBaseGold * 5 : lbBaseGold);
            const lbBaseMat = 0.03 * Math.pow(area.stage, 1.2);
            const killMat  = battle.enemies.length * (isBoss ? lbBaseMat * 5 : lbBaseMat);
            d2.accumulated.gold += killGold;
            const lbRatios = getMaterialGradeRatios(area.stage);
            for (const [grade, ratio] of Object.entries(lbRatios)) {
              d2.accumulated.materials[grade] = (d2.accumulated.materials[grade] || 0) + killMat * ratio;
            }
            handleProgressMax(d2, area);
          } else {
            d2.partyHp = {};
            const retainRate = 0.5 + getPrestigeBonusTotal('wipeRetain') / 100;
            d2.progress = Math.max(1, Math.floor(d2.progress * retainRate));
          }
        }

        // 팝업이 닫혔으면 중단
        const popup = document.getElementById('battle-popup');
        if (!popup || popup.classList.contains('hidden')) return;

        // 2초 후 다음 전투 자동 시작
        setTimeout(() => {
          const popup2 = document.getElementById('battle-popup');
          if (!popup2 || popup2.classList.contains('hidden')) return;

          const d3 = State.dispatches.find(dd => dd.areaId === areaId);
          if (!d3) return;

          const nextAllies = d3.team
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

  // 파티 CombatUnit 생성 (저장된 HP 반영)
  const allies = dispatch.team
    .map(id => State.adventurers.find(a => a.id === id))
    .filter(Boolean)
    .map(adv => new CombatUnit(
      { ...adv, _dispatchHp: dispatch.partyHp?.[adv.id] },
      true
    ));

  openPopup('battle-popup');
  // 진행도가 같으면 캐싱된 적 그룹 재사용
  const cachedEnemies = (dispatch._cachedProgress === Math.floor(dispatch.progress) && dispatch._cachedEnemies)
    ? dispatch._cachedEnemies : null;
  startBattle(allies, cachedEnemies);

  document.getElementById('btn-close-battle').onclick = closeBattleViewer;
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

  const areaHtml = result.areas.map(a => {
    return `
    <div class="offline-area-row">
      <div class="offline-area-name">${a.icon} ${a.name}</div>
      <div class="offline-area-gains">
        <span style="color:var(--gold-dark);font-weight:bold">💰 ${a.gold.toLocaleString()} G</span>
        <span style="color:var(--blue);font-weight:bold">💎 재료 ${a.mat}개</span>
        <span class="offline-progress">진행도 ${a.progressFrom}→${a.progressTo}/${a.maxProgress}</span>
      </div>
      ${a.totalBattles != null ? `<div style="font-size:0.72rem;color:#888;margin-top:2px">⚔️ ${a.totalBattles}전 ${a.wins}승 (승률 ${a.winRate}%)</div>` : ''}
    </div>`;
  }).join('');

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
          <span style="color:var(--blue);font-weight:bold">💎 재료 ${Math.floor(result.totalMat).toLocaleString()}개</span>
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
  renderAdvDetail(selectedAdvId);
  renderAdventurerTab();
}

function useBookFromInventory(inventoryIdx, advIdStr) {
  if (!advIdStr) { showToast('모험가를 선택하세요.', 'error'); return; }
  useExpBook(parseInt(advIdStr), inventoryIdx);
  updateInvBadge();
  renderInventoryPopup();
}

function useBookByName(bookName, advIdStr) {
  if (!advIdStr) { showToast('모험가를 선택하세요.', 'error'); return; }
  const advId = parseInt(advIdStr);
  const adv = State.adventurers.find(a => a.id === advId);
  if (!adv) { showToast('모험가를 선택하세요.', 'error'); return; }

  // 같은 이름의 책 전부 수거
  let totalExp = 0;
  let count = 0;
  State.inventory = State.inventory.filter(i => {
    if (i.type === 'exp_book' && i.name === bookName) {
      totalExp += i.expValue;
      count++;
      return false;
    }
    return true;
  });

  if (count === 0) { showToast('해당 경험치 서를 찾을 수 없습니다.', 'error'); return; }
  giveExp(advId, totalExp);
  showToast(`${adv.name}에게 ${bookName} ×${count} 사용 (총 경험치 +${totalExp.toLocaleString()})`, 'success');
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
  { text: '안녕하세요 길드장 님! 저는 비서인 클로에라고 해요. 베른 모험가 길드에 오신 걸 환영합니다! 제가 길드 운영을 도와드릴게요.', highlight: null },
  { text: '가장 먼저 보셔야 할 건 모집 탭이에요. 마침 지원서가 들어왔는데요, 첫 지원자로 전사, 마법사, 치유사 세 분이 오셨어요. 세 분 모두 영입하는 걸 추천드려요!', highlight: '#tab-bar .tab-btn:nth-child(4)' },
  { text: '길드에 합류한 모험가는 모험가 탭에서 확인할 수 있어요. 장비를 장착하면 더 강해진답니다!', highlight: '#tab-bar .tab-btn:nth-child(2)' },
  { text: '파견 탭에서 팀을 꾸려 지역으로 파견을 보내세요. 전투에서 승리할 때마다 골드와 재료를 획득할 수 있어요!', highlight: '#tab-bar .tab-btn:nth-child(3)' },
  { text: '정산 버튼을 누르면 모아둔 골드와 재료를 수령할 수 있어요. 이걸로 길드 건물을 업그레이드하세요!', highlight: '#tab-bar .tab-btn:nth-child(3)' },
  { text: '지휘 본부를 업그레이드하면 새로운 기능이 열려요. Lv.2에서 공방, Lv.4에서 상점, Lv.5에서 경지가 해금됩니다. 파견 슬롯도 늘어나니 본부 업그레이드를 우선하세요!', highlight: '#buildings-grid' },
  { text: '이제부턴 길드장 님 혼자서도 잘 하실 수 있겠죠? 궁금한 게 있으면 언제든 클로에를 찾아주세요! 화이팅!', highlight: null },
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
    step === TUTORIAL_STEPS.length - 1 ? '시작하기!' : '다음 →';
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
    const p  = c.progress();
    const pct = Math.min(100, Math.floor(p.cur / p.max * 100));
    return `<div class="rebuild-cond ${ok ? 'ok' : 'nok'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>${ok ? '✅' : '❌'} ${c.label}</span>
        <span style="font-size:0.78rem;color:${ok ? '#388e3c' : '#888'}">${p.cur}/${p.max}</span>
      </div>
      ${!ok ? `<div style="height:4px;background:#eee;border-radius:2px;margin-top:3px"><div style="height:4px;background:#f59e0b;border-radius:2px;width:${pct}%"></div></div>` : ''}
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

  // 티아마트 NPC (알현 후)
  const tiamatNpcHtml = State.tiamatMet ? `
    <div id="prestige-tiamat-npc" style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div style="flex-shrink:0;text-align:center">
        <img src="assets/characters/티아마트_스탠딩.png" alt="티아마트" class="npc-standing" style="width:110px;height:145px;object-fit:contain" onerror="this.style.display='none'" />
        <div class="npc-name" style="margin-top:4px">드래곤 여왕 티아마트</div>
      </div>
      <div id="tiamat-npc-bubble" style="background:white;border:2px solid var(--gold-dark);border-radius:12px;padding:12px 16px;position:relative;font-size:0.88rem;line-height:1.5;color:#3e2200;box-shadow:var(--shadow);flex:0 1 auto;cursor:pointer"
        onclick="this.querySelector('p').textContent = ['아직도 여기 있느냐. 뭘 꾸물거리는 것이냐.','미지의 영역 탐사는 잘 되고 있는 것이겠지?','이 몸이 허가를 내린 이상, 반드시 결과를 가져와야 할 것이다.'][Math.floor(Math.random()*3)]">
        <p>네 길드의 성장을 인정하마. 그러나 아직 갈 길이 멀다.</p>
      </div>
    </div>` : '';

  // 용의 가호 가지 (알현 후)
  const dragonBranchHtml = State.tiamatMet ? `
    <div class="prestige-branch">
      <div class="branch-title" style="color:#e53935">🐉 용의 가호</div>
      <div class="prestige-node node-done">
        <div class="node-name">🐉 티아마트의 축복</div>
        <div class="node-desc">건물 레벨에 따라 모험가 전체 능력치 강화</div>
        <div style="font-size:0.75rem;color:#888;margin-top:4px;line-height:1.5">
          본부 Lv×1% 치명타 · 서류 Lv×2% 속도<br>
          대기실 Lv×1% 공격력 · 공방 Lv×1% 방어력<br>
          창고 Lv×1% 체력
        </div>
        <span class="node-status">✓ 활성</span>
      </div>
    </div>` : '';

  el.innerHTML = `
    ${tiamatNpcHtml}
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
    <div class="prestige-branches">${branchesHtml}</div>
    ${dragonBranchHtml}`;
}

function openRebuildDialog() {
  const popup = document.getElementById('rebuild-popup');
  const allMet = canRebuild();
  const pending = Math.max(0, calcTotalEarnablePoints() - (State.totalPrestigeEarned || 0));

  const condHtml = REBUILD_CONDITIONS.map(c => {
    const ok = c.check();
    const p  = c.progress();
    const pct = Math.min(100, Math.floor(p.cur / p.max * 100));
    return `<div class="rebuild-cond ${ok ? 'ok' : 'nok'}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>${ok ? '✅' : '❌'} ${c.label}</span>
        <span style="font-size:0.78rem;color:${ok ? '#388e3c' : '#888'}">${p.cur}/${p.max}</span>
      </div>
      ${!ok ? `<div style="height:4px;background:#eee;border-radius:2px;margin-top:3px"><div style="height:4px;background:#f59e0b;border-radius:2px;width:${pct}%"></div></div>` : ''}
    </div>`;
  }).join('');

  const bodyEl = document.getElementById('rebuild-popup-body');
  if (allMet) {
    bodyEl.innerHTML = `
      <p class="rebuild-chloe-speech">길드장 님, 지금까지 정말 고생 많으셨어요. 베른 전역을 평정하셨으니, 이제 새 출발을 하실 수 있어요. 리빌딩을 하시면 처음부터 다시 시작하지만… 길드장 님이 쌓아온 경험만큼은 절대 사라지지 않아요!</p>
      <div class="rebuild-cond-list">${condHtml}</div>
      <div class="rebuild-gain-box">이번 리빌딩 획득: <b class="gold-text">+${pending}pt</b></div>
      <div style="color:#c62828;font-size:0.82rem;margin-top:8px">⚠️ 모험가·장비·골드·건물이 초기화됩니다. (공방·대기실 등 레벨 리셋)</div>
      <div style="color:#388e3c;font-size:0.82rem;margin-top:4px">✅ 유지: 스킬포인트, 경지 트리, 영구 단련, <b>지휘 본부 레벨</b></div>
      <button class="btn btn-danger btn-full" style="margin-top:14px" onclick="confirmRebuild()">🔄 리빌딩 실행</button>`;
  } else {
    bodyEl.innerHTML = `
      <p class="rebuild-chloe-speech">아직 조건이 충족되지 않았어요, 길드장 님. 베른 전역을 완전히 평정하고, 길드도 좀 더 키워주세요!</p>
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

let _craftSlot = null;
let _craftGrade = null;
const _labQty = {};

function setLabQty(key, delta) {
  _labQty[key] = Math.max(1, Math.min(99, (_labQty[key] || 1) + delta));
  renderLabTab();
}
function getLabQty(key) { return _labQty[key] || 1; }

function setCraftSlot(slot) { _craftSlot = slot; renderLabTab(); }
function setCraftMat(grade)  { _craftGrade = grade; renderLabTab(); }

function doCraftEquipment() {
  if (!_craftSlot || !_craftGrade) return;
  const qty = getLabQty('equip');
  const results = craftEquipment(_craftSlot, _craftGrade, qty);
  if (results) {
    const slotLabel = { weapon: '무기', armor: '방어구', accessory: '악세서리' }[_craftSlot];
    const listHtml = results.map(eq => {
      const col = gradeColor(eq.grade);
      const optHtml = eq.options && eq.options.length > 0
        ? eq.options.map(o => `<span style="font-size:0.75rem;color:#888">· ${o.display || o.name}</span>`).join('<br>')
        : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px;margin-bottom:6px;background:rgba(0,0,0,0.04);border-radius:6px;border-left:3px solid ${col}">
        <img src="${eq.icon}" style="width:36px;height:36px;object-fit:contain" onerror="this.style.display='none'" />
        <div>
          <div style="font-weight:bold;color:${col}">${eq.name} <span style="font-size:0.78rem">${eq.grade}급</span></div>
          ${optHtml ? `<div style="margin-top:2px">${optHtml}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    const summary = {};
    results.forEach(eq => { summary[eq.grade] = (summary[eq.grade] || 0) + 1; });
    const summaryHtml = Object.entries(summary)
      .map(([g, n]) => `<span style="color:${gradeColor(g)};font-weight:bold">${g}급 ${n}개</span>`)
      .join(' · ');

    document.getElementById('craft-result-body').innerHTML = `
      <div style="font-size:0.85rem;color:#888;margin-bottom:10px">${slotLabel} ${results.length}개 제작 완료 — ${summaryHtml}</div>
      ${listHtml}
    `;
    openPopup('craft-result-popup');
    renderLabTab();
    renderHeader();
  }
}

function renderLabTab() {
  const el = document.getElementById('lab-content');
  if (!el) return;

  const labLv = getBuildingLevel('workshop');
  const q = State.labQueue;
  const now = Date.now();

  // 현재 제작 현황
  let queueHtml;
  if (q) {
    const remaining = Math.max(0, q.finishAt - now);
    const pct = Math.min(100, ((q.totalMs - remaining) / q.totalMs) * 100).toFixed(1);
    const isSynth = q.type === 'synthesis';
    const col = isSynth ? '#8bc34a' : gradeColor(q.grade);
    const iconHtml = isSynth
      ? '<span style="font-size:28px;margin-right:10px">🔄</span>'
      : `<img src="${q.icon}" class="lab-queue-icon" onerror="this.style.display='none'" />`;
    queueHtml = `
      <div class="lab-queue-card active">
        <div class="lab-queue-item">
          ${iconHtml}
          <div class="lab-queue-info">
            <div class="lab-queue-name" style="color:${col}">${q.name}</div>
            <div class="progress-bar-wrap" style="margin:6px 0">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="lab-queue-time">남은 시간: <strong>${formatCraftTime(remaining)}</strong></div>
          </div>
        </div>
        <button class="btn btn-danger" style="margin-top:10px;width:100%"
          onclick="if(cancelCraft()) renderLabTab()">취소 (전액 환불)</button>
      </div>`;
  } else {
    queueHtml = `<div class="lab-queue-card empty">⚗️ 제작 슬롯이 비어 있습니다.</div>`;
  }

  // 레시피 목록
  const recipesHtml = LAB_RECIPES.map(recipe => {
    const labLvOk  = labLv >= recipe.reqLabLv;
    const rqty = getLabQty(recipe.id);
    const canAfford = State.gold >= recipe.cost.gold * rqty &&
      Object.entries(recipe.cost.materials || {}).every(([g, n]) => (State.materials[g] || 0) >= n * rqty);
    const busy      = !!q;
    const disabled  = busy || !labLvOk;
    const speedMult = (100 + labLv * 10) / 100;
    const actualMs  = Math.floor(recipe.craftTime * rqty / speedMult) * 1000;
    const col       = gradeColor(recipe.grade);
    const btnLabel  = busy ? '제작 중...' : !labLvOk ? `Lv.${recipe.reqLabLv} 필요` : `제작 ×${rqty}`;
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
          💰 ${(recipe.cost.gold * rqty).toLocaleString()} &nbsp;|&nbsp;
          💎 ${Object.entries(recipe.cost.materials||{}).map(([g,n])=>`${MAT_GRADE_LABELS[g]} ${n * rqty}`).join(' + ')} &nbsp;|&nbsp;
          ⏱ ${formatCraftTime(actualMs)}
        </div>
        <div class="qty-row">
          <button class="btn btn-outline qty-btn" onclick="setLabQty('${recipe.id}',-1)">−</button>
          <span class="qty-display">${rqty}</span>
          <button class="btn btn-outline qty-btn" onclick="setLabQty('${recipe.id}',1)">+</button>
          <button class="btn ${disabled || !canAfford ? 'btn-outline' : 'btn-primary'}" style="flex:1;margin-left:8px"
            onclick="if(startCraft('${recipe.id}',${rqty})) renderLabTab()"
            ${disabled || !canAfford ? 'disabled' : ''}>${btnLabel}</button>
        </div>
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

  // ===== 장비 제작 UI =====
  const m = State.materials || {};
  const slotLabels = { weapon: '⚔️ 무기', armor: '🛡 방어구', accessory: '💍 악세서리' };
  const slotBtns = Object.entries(slotLabels).map(([s, label]) =>
    `<button class="btn ${_craftSlot === s ? 'btn-primary' : 'btn-outline'}" style="font-size:0.82rem;padding:5px 10px"
      onclick="setCraftSlot('${s}')">${label}</button>`
  ).join('');

  const matBtns = CRAFT_RECIPES.map(r => {
    const have = Math.floor(m[r.materialGrade] || 0);
    const ok = have >= r.matCost;
    const isSelected = _craftGrade === r.materialGrade;
    return `<button class="btn ${isSelected ? 'btn-primary' : 'btn-outline'}" style="font-size:0.8rem;padding:5px 10px;${!ok ? 'opacity:0.6' : ''}"
      onclick="setCraftMat('${r.materialGrade}')">
      ${MAT_GRADE_LABELS[r.materialGrade]}<br>
      <span style="font-size:0.7rem">${r.matCost}개 (보유 ${have})</span>
    </button>`;
  }).join('');

  const eqty = getLabQty('equip');
  let craftSummary = '<span style="color:#aaa">슬롯과 재료 등급을 선택하세요.</span>';
  let craftBtnDisabled = true;
  if (_craftSlot && _craftGrade) {
    const r = CRAFT_RECIPES.find(x => x.materialGrade === _craftGrade);
    const have = Math.floor(m[_craftGrade] || 0);
    const canCraft = r && have >= r.matCost * eqty && State.gold >= r.gold * eqty
      && State.inventory.length + eqty <= getInventoryCapacity();
    const resultLabel = r ? r.grades.join(' 또는 ') : '-';
    const costColor = canCraft ? 'var(--cream)' : '#e57373';
    craftSummary = `<span style="color:${costColor}">
      ${slotLabels[_craftSlot]} ×${eqty} &nbsp;|&nbsp;
      ${MAT_GRADE_LABELS[_craftGrade]} ${(r?.matCost ?? 0) * eqty}개 &nbsp;|&nbsp;
      💰 ${((r?.gold ?? 0) * eqty).toLocaleString()} G &nbsp;|&nbsp;
      결과: <strong>${resultLabel}</strong>
    </span>`;
    craftBtnDisabled = !canCraft;
  }

  const craftEquipHtml = `
    <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px">
      <span style="font-size:0.8rem;color:#aaa;align-self:center;min-width:48px">슬롯</span>
      ${slotBtns}
    </div>
    <div style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px">
      <span style="font-size:0.8rem;color:#aaa;align-self:center;min-width:48px">재료</span>
      ${matBtns}
    </div>
    <div style="font-size:0.82rem;margin-bottom:10px;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px">
      ${craftSummary}
    </div>
    <div class="qty-row">
      <button class="btn btn-outline qty-btn" onclick="setLabQty('equip',-1)">−</button>
      <span class="qty-display">${eqty}</span>
      <button class="btn btn-outline qty-btn" onclick="setLabQty('equip',1)">+</button>
      <button class="btn btn-gold" style="flex:1;margin-left:8px" ${craftBtnDisabled ? 'disabled' : ''} onclick="doCraftEquipment()">
        🔨 즉시 제작 ×${eqty}
      </button>
    </div>`;

  // ===== 재료 합성 섹션 =====
  const speedMult2 = (100 + labLv * 10) / 100;
  const synthHtml = SYNTHESIS_RECIPES.map(recipe => {
    const sqty = getLabQty(recipe.id);
    const inputLabel = Object.entries(recipe.input)
      .map(([g, n]) => `${MAT_GRADE_LABELS[g]} ${n * sqty}`)
      .join(' + ');
    const outputLabel = Object.entries(recipe.output)
      .map(([g, n]) => `${MAT_GRADE_LABELS[g]} ${n * sqty}`)
      .join(' + ');
    const canAfford = State.gold >= (recipe.gold || 0) * sqty &&
      Object.entries(recipe.input).every(([g, n]) => (State.materials[g] || 0) >= n * sqty);
    const busy = !!q;
    const disabled = busy || !canAfford;
    const actualMs = Math.floor(recipe.craftTime * sqty / speedMult2) * 1000;
    const btnLabel = busy ? '제작 중...' : !canAfford ? '재료 부족' : `합성 ×${sqty}`;

    return `
      <div class="lab-recipe-card${disabled ? ' disabled' : ''}">
        <div class="lab-recipe-header">
          <span style="font-size:28px;line-height:1">🔄</span>
          <div style="margin-left:10px">
            <div class="lab-recipe-name">${recipe.name}</div>
            <div class="lab-recipe-exp">${inputLabel} → <strong style="color:#8bc34a">${outputLabel}</strong></div>
          </div>
        </div>
        <div class="lab-recipe-cost" style="${canAfford ? '' : 'color:#e57373'}">
          ${recipe.gold ? '💰 ' + (recipe.gold * sqty).toLocaleString() + ' &nbsp;|&nbsp; ' : ''}💎 ${inputLabel} &nbsp;|&nbsp; ⏱ ${formatCraftTime(actualMs)}
        </div>
        <div class="qty-row">
          <button class="btn btn-outline qty-btn" onclick="setLabQty('${recipe.id}',-1)">−</button>
          <span class="qty-display">${sqty}</span>
          <button class="btn btn-outline qty-btn" onclick="setLabQty('${recipe.id}',1)">+</button>
          <button class="btn ${disabled ? 'btn-outline' : 'btn-primary'}" style="flex:1;margin-left:8px"
            onclick="if(startSynthesis('${recipe.id}',${sqty})) renderLabTab()"
            ${disabled ? 'disabled' : ''}>${btnLabel}</button>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="lab-section-title">현재 제작</div>
    ${queueHtml}
    <div class="lab-section-title" style="margin-top:20px">경험치 책 제작</div>
    <div class="lab-recipes-grid">${recipesHtml}</div>
    <div class="lab-section-title" style="margin-top:20px">장비 즉시 제작
      <span style="font-size:11px;font-weight:normal;color:#aaa;margin-left:8px">시간 소요 없음 · 랜덤 옵션</span>
    </div>
    <div style="padding:4px 0">${craftEquipHtml}</div>
    <div class="lab-section-title" style="margin-top:20px">재료 합성
      <span style="font-size:11px;font-weight:normal;color:#aaa;margin-left:8px">10:1 비율 · 공방 속도 적용</span>
    </div>
    <div class="lab-recipes-grid">${synthHtml}</div>
    <div class="lab-section-title" style="margin-top:20px">영구 단련
      <span style="font-size:11px;font-weight:normal;color:#aaa;margin-left:8px">리빌딩 후에도 유지됩니다</span>
    </div>
    <div class="lab-recipes-grid">${permHtml}</div>`;
}
