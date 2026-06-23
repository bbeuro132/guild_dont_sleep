// ===== main.js: 진입점 및 게임 루프 =====

let lastTick = Date.now();

// ===== 게임 로직 루프 (1초 간격, 백그라운드에서도 실행) =====
function gameTick() {
  const now = Date.now();
  const delta = (now - lastTick) / 1000;
  lastTick = now;

  if (delta > 0 && delta < 120) {
    tickDispatches(delta);
    tickLab();
    checkBuildingUpgradeComplete();
    tickBuffs();
    checkShopRefresh();
  }

  checkAutoRecruitRefresh();
}

// ===== UI 렌더 루프 (화면 보일 때만) =====
let _dispatchRenderTimer = 0;
let _dispatchInteracting = false;
let _labRenderTimer = 0;
let _guildRenderTimer = 0;
let _shopRenderTimer = 0;
let _lastRender = 0;

function renderLoop(timestamp) {
  const delta = (timestamp - _lastRender) / 1000;
  _lastRender = timestamp;

  renderHeader();

  const tab = getCurrentTab();
  if (tab === 'dispatch') {
    _dispatchRenderTimer -= delta;
    if (_dispatchRenderTimer <= 0) {
      if (!_dispatchInteracting) renderDispatchTab();
      _dispatchRenderTimer = 1;
    }
  } else if (tab === 'recruit') {
    updateRecruitCountdown();
  } else if (tab === 'lab') {
    _labRenderTimer -= delta;
    if (_labRenderTimer <= 0) {
      renderLabTab();
      _labRenderTimer = 1;
    }
  } else if (tab === 'guild' && State.buildingUpgrade) {
    _guildRenderTimer -= delta;
    if (_guildRenderTimer <= 0) {
      renderGuildTab();
      _guildRenderTimer = 1;
    }
  } else if (tab === 'shop') {
    _shopRenderTimer -= delta;
    if (_shopRenderTimer <= 0) {
      renderShopTab();
      _shopRenderTimer = 5;
    }
  }

  requestAnimationFrame(renderLoop);
}

function checkAutoRecruitRefresh() {
  const elapsed = Date.now() - State.lastRecruitTime;
  if (elapsed >= State.recruitInterval) {
    refreshApplications(true);
    if (getCurrentTab() === 'recruit') renderRecruitTab();
  }
}

// ===== 자동 저장 =====
function autoSave() {
  saveState();
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  // 파견 탭 SELECT 인터랙션 감지 — 재렌더링 방지
  document.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'SELECT' && e.target.closest('#dispatch-areas')) {
      _dispatchInteracting = true;
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT' && e.target.closest('#dispatch-areas')) {
      setTimeout(() => { _dispatchInteracting = false; }, 500);
    }
  });
  document.addEventListener('click', (e) => {
    if (_dispatchInteracting && e.target.tagName !== 'SELECT' && !e.target.closest('select')) {
      _dispatchInteracting = false;
    }
  });

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 모집 즉시 갱신
  document.getElementById('btn-refresh-recruit').addEventListener('click', () => {
    if (forceRefreshApplications()) {
      renderRecruitTab();
      renderHeader();
    }
  });

  // 정산 팝업 닫기
  document.getElementById('btn-close-settlement').addEventListener('click', () => closePopup('settlement-popup'));

  // 인벤토리 팝업 닫기
  document.getElementById('btn-close-inventory').addEventListener('click', () => closePopup('inventory-popup'));

  // 리빌딩 팝업 닫기
  document.getElementById('btn-close-rebuild').addEventListener('click', () => closePopup('rebuild-popup'));

  // 오버레이 클릭 시 팝업 닫기
  document.getElementById('overlay').addEventListener('click', () => {
    closePopup('settlement-popup');
    closePopup('battle-popup');
    closePopup('inventory-popup');
    closePopup('rebuild-popup');
    closePopup('lore-popup');
    closePopup('chloe-help-popup');
    closePopup('confirm-popup');
    closePopup('tiamat-popup');
    closePopup('promo-popup');
    closePopup('craft-result-popup');
    // 전투 관람 팝업 닫힐 때 viewerActive 해제 및 HP 동기화
    if (window._battleAreaId) {
      const d = State.dispatches.find(dd => dd.areaId === window._battleAreaId);
      if (d) {
        if (window._currentBattle) {
          window._currentBattle.allies.forEach(u => {
            d.partyHp[u.id] = Math.max(0, u.currentHp);
          });
        }
        d.viewerActive = false;
        d.combatCooldown = COMBAT_INTERVAL;
      }
      window._battleAreaId = null;
    }
    if (window._currentBattle) { window._currentBattle.stop(); window._currentBattle = null; }
  });

  // 튜토리얼 다음 버튼
  document.getElementById('btn-tutorial-next').addEventListener('click', nextTutorialStep);

  // 페이지 숨김 시 저장, 복귀 시 보정
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      autoSave();
    } else {
      processOfflineProgress();
      lastTick = Date.now();
      saveState();
    }
  });

  // 언로드 시 저장
  window.addEventListener('beforeunload', autoSave);
}

// ===== 초기화 =====
function init() {
  loadState();
  bindEvents();

  // 초기 렌더
  renderHeader();
  switchTab('guild');

  // 튜토리얼
  if (!State.tutorialDone) {
    setTimeout(() => startTutorial(), 500);
  }

  // 자동 저장 (30초마다)
  setInterval(autoSave, 30000);

  // 게임 로직 루프 (1초마다 — 백그라운드에서도 실행)
  lastTick = Date.now();
  setInterval(gameTick, 1000);

  // UI 렌더 루프 (화면 보일 때만)
  _lastRender = performance.now();
  requestAnimationFrame(renderLoop);

  // 오프라인 복귀 알림 (저장 데이터가 있을 때만)
  if (window._pendingOffline) {
    setTimeout(() => {
      showOfflinePopup(window._pendingOffline);
      window._pendingOffline = null;
    }, 600);
  }

  console.log('길드는 잠들지 않는다 — 초기화 완료');
}

// DOM 준비 완료 후 시작
document.addEventListener('DOMContentLoaded', init);
