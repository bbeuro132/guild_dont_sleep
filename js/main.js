// ===== main.js: 진입점 및 게임 루프 =====

let lastTick = 0;
let _dispatchRenderTimer = 0; // 파견 탭 렌더 쓰로틀 (초)

function gameLoop(timestamp) {
  const delta = (timestamp - lastTick) / 1000; // 초 단위
  lastTick = timestamp;

  if (delta > 0 && delta < 60) {
    tickDispatches(delta);
  }

  // 헤더 항상 갱신
  renderHeader();

  // 현재 탭 실시간 갱신이 필요한 것들
  const tab = getCurrentTab();
  if (tab === 'dispatch') {
    // 1초에 1번만 전체 재렌더 — 매 프레임 DOM을 교체하면
    // mousedown·mouseup 사이에 요소가 바뀌어 클릭 이벤트가 소실됨
    _dispatchRenderTimer -= delta;
    if (_dispatchRenderTimer <= 0) {
      // 드롭다운(select)이 포커스 중이면 DOM 재구성 스킵 — 강제 닫힘 방지
      const focused = document.activeElement;
      const selectOpen = focused && focused.tagName === 'SELECT'
        && focused.closest('#dispatch-areas');
      if (!selectOpen) renderDispatchTab();
      _dispatchRenderTimer = 1;
    }
  } else if (tab === 'recruit') {
    updateRecruitCountdown();
  }

  // 자동 서류 갱신 체크
  checkAutoRecruitRefresh();

  requestAnimationFrame(gameLoop);
}

function checkAutoRecruitRefresh() {
  const elapsed = Date.now() - State.lastRecruitTime;
  if (elapsed >= State.recruitInterval) {
    refreshApplications();
    if (getCurrentTab() === 'recruit') renderRecruitTab();
  }
}

// ===== 세션 경과 시간 표시 =====
const _sessionStart = Date.now();

function updateClock() {
  const elapsed = Math.floor((Date.now() - _sessionStart) / 1000);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  const el = document.getElementById('time-display');
  if (el) el.textContent = `${h}:${m}:${s}`;
}

// ===== 자동 저장 =====
function autoSave() {
  saveState();
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
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
  document.getElementById('btn-close-battle').addEventListener('click', () => {
    if (window._currentBattle) window._currentBattle.stop();
    closePopup('battle-popup');
  });

  // 인벤토리 팝업 닫기
  document.getElementById('btn-close-inventory').addEventListener('click', () => closePopup('inventory-popup'));

  // 오버레이 클릭 시 팝업 닫기
  document.getElementById('overlay').addEventListener('click', () => {
    closePopup('settlement-popup');
    closePopup('battle-popup');
    closePopup('inventory-popup');
    if (window._currentBattle) window._currentBattle.stop();
  });

  // 튜토리얼 다음 버튼
  document.getElementById('btn-tutorial-next').addEventListener('click', nextTutorialStep);

  // 페이지 숨김 시 저장
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoSave();
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

  // 시계 (1초마다)
  setInterval(updateClock, 1000);
  updateClock();

  // 게임 루프 시작
  lastTick = performance.now();
  requestAnimationFrame(gameLoop);

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
