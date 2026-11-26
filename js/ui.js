// =========================================================
// 공통 화면 도구: 입력 창(모달), 짧은 안내(토스트), 글자 안전 처리
// =========================================================

// 사용자가 입력한 글자를 화면에 넣을 때 HTML로 해석되지 않도록 바꿉니다. (보안)
export function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- 선 아이콘 (Apple SF Symbols 느낌) ----------
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.6 5.6L7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  note: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  branch: '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 8.2v7.6M18 9.2c0 4.5-5 4.3-10.5 7.3"/>',
  merge: '<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="15" r="2.2"/><path d="M6 7.2v9.6M6 7.2c0 5 6 7.8 9.8 7.8"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 21H19"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  open: '<path d="M7 17L17 7M9 7h8v8"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const dialog = () => document.getElementById('modal');
let modalSeq = 0;

/**
 * 입력 창을 엽니다.
 * actions: [{ label, kind, primary, onClick(form) }]
 *   onClick이 true를 돌려주면 창을 닫지 않습니다. (예: 필수 입력이 비었을 때)
 */
export function openModal({ title, body, actions = [], onOpen, wide = false }) {
  const my = ++modalSeq;
  const dlg = dialog();
  dlg.classList.toggle('wide', wide); // wide: 오른쪽에 그래프가 붙는 넓은 창
  dlg.innerHTML = `
    <form class="modal" novalidate>
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="닫기"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">
        ${actions
          .map((a, i) => `<button type="${a.primary ? 'submit' : 'button'}" class="btn ${a.primary ? 'primary' : ''} ${a.kind || ''}" data-act="${i}">${esc(a.label)}</button>`)
          .join('')}
      </footer>
    </form>`;

  const form = dlg.querySelector('form');
  const run = (action) => {
    const keepOpen = action.onClick(form);
    // 버튼이 다른 창을 새로 열었다면(modalSeq가 바뀜) 그 창은 닫지 않습니다.
    if (keepOpen !== true && modalSeq === my) closeModal();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const primary = actions.find((a) => a.primary);
    if (primary) run(primary);
  });
  form.querySelectorAll('[data-act]').forEach((btn) => {
    const action = actions[Number(btn.dataset.act)];
    if (!action.primary) btn.addEventListener('click', () => run(action));
  });
  form.querySelector('[data-close]').addEventListener('click', closeModal);

  if (!dlg.open) dlg.showModal();
  if (onOpen) onOpen(form);
  const first = form.querySelector('input:not([type=checkbox]), textarea');
  if (first) first.focus();
}

export function closeModal() {
  const dlg = dialog();
  if (dlg.open) dlg.close();
}

// 창 바깥(어두운 배경)을 누르면 닫힙니다.
export function setupModal() {
  const dlg = dialog();
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) closeModal();
  });
}

export function toast(message) {
  const box = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// ---------- 입력값 읽기 도우미 ----------
export function val(form, name) {
  const el = form.elements[name];
  return el ? el.value.trim() : '';
}

export function checked(form, name) {
  return Boolean(form.elements[name] && form.elements[name].checked);
}

// map: { 값: 글자 } 또는 [[값, 글자], ...]
export function options(map, selected) {
  const entries = Array.isArray(map) ? map : Object.entries(map);
  return entries
    .map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`)
    .join('');
}

export function emptyState(text) {
  return `<p class="empty">${esc(text)}</p>`;
}
