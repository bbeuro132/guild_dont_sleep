// ===== main.js: 진입점 및 게임 루프 =====

let lastTick = 0;

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
    renderDispatchTab();
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

// ===== 시계 표시 =====
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
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

  // 오버레이 클릭 시 팝업 닫기
  document.getElementById('overlay').addEventListener('click', () => {
    closePopup('settlement-popup');
    closePopup('battle-popup');
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

  console.log('길드는 잠들지 않는다 — 초기화 완료');
}

// DOM 준비 완료 후 시작
document.addEventListener('DOMContentLoaded', init);
