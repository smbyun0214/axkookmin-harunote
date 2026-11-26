// =========================================================
// 사이드바 "보기" 메뉴 순서 바꾸기
// 메뉴를 마우스로 끌어다 놓으면 순서가 바뀌고, 브라우저에 저장되어 새로고침해도 유지됩니다.
// =========================================================
const KEY = 'harunote-nav-order';

function group() {
  return document.querySelector('[data-nav-group="views"]');
}

function saveOrder() {
  const order = [...group().querySelectorAll('[data-goto]')].map((b) => b.dataset.goto);
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    /* 저장이 안 되면 이번 화면에서만 유지 */
  }
}

// 저장해 둔 순서대로 메뉴를 다시 놓습니다. (없는 메뉴는 무시, 새 메뉴는 뒤에 그대로)
function applyOrder() {
  let order = [];
  try {
    order = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    order = [];
  }
  const g = group();
  order.forEach((name) => {
    const btn = g.querySelector(`[data-goto="${name}"]`);
    if (btn) g.appendChild(btn);
  });
}

export function setupNavOrder() {
  const g = group();
  if (!g) return;
  applyOrder();
  let dragging = null;

  g.addEventListener('dragstart', (e) => {
    dragging = e.target.closest('[data-goto]');
    if (!dragging) return;
    dragging.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragging.dataset.goto); // 일부 브라우저는 이 값이 있어야 끌기가 시작됨
  });

  // 끌고 있는 위치에 따라 메뉴를 실시간으로 옮겨 보여줍니다.
  g.addEventListener('dragover', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const over = e.target.closest('[data-goto]');
    if (!over || over === dragging) return;
    const rect = over.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    over[after ? 'after' : 'before'](dragging);
  });

  const finish = () => {
    if (!dragging) return;
    dragging.classList.remove('dragging');
    dragging = null;
    saveOrder();
  };
  g.addEventListener('drop', (e) => {
    e.preventDefault();
    finish();
  });
  g.addEventListener('dragend', finish);
}
