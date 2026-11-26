// =========================================================
// 앱 시작점: 화면 전환, 사이드바, 공통 버튼 처리를 담당합니다.
// =========================================================
import * as store from './store.js';
import * as vcs from './vcs.js';
import { setupModal } from './ui.js';
import { openItem } from './links.js';
import { todayYmd, eventsOn } from './dates.js';
import * as notify from './notify.js';
import { applyTheme, getTheme, cycleTheme } from './theme.js';
import { seedIfNeeded } from './samples.js';
import * as today from './today.js';
import * as memo from './memo.js';
import * as calendar from './calendar.js';
import * as todo from './todo.js';
import * as versions from './versions.js';
import * as historyView from './history.js';
import * as trash from './trash.js';

const VIEWS = { today, memo, calendar, todo, versions, history: historyView, trash };
const DEFAULT_VIEW = 'today'; // 첫 화면 — 'calendar'로 바꾸면 캘린더가 첫 화면이 됩니다

let current = DEFAULT_VIEW;

function viewFromHash() {
  const name = location.hash.slice(1);
  return VIEWS[name] ? name : DEFAULT_VIEW;
}

// 사이드바 오른쪽 숫자
function updateCounts() {
  const day = todayYmd();
  const todos = store.list('todo');
  const counts = {
    today: todos.filter((t) => !t.done && t.due && t.due <= day).length,
    memo: store.list('memo').length,
    calendar: eventsOn(store.list('event'), day).length,
    todo: todos.filter((t) => !t.done).length,
    versions: vcs.getRepo() ? vcs.stats().open : 0, // 진행 중 브랜치 수
    trash: store.trashList().length,
  };
  document.querySelectorAll('[data-count]').forEach((el) => {
    const n = counts[el.dataset.count];
    el.textContent = n ? n : '';
  });
}

// 현재 화면을 새로 그립니다.
function render() {
  const main = document.getElementById('view');
  const section = document.createElement('div');
  section.className = `view view-${current}`;
  main.replaceChildren(section);
  VIEWS[current].render(section);

  document.querySelectorAll('.sidebar [data-goto]').forEach((btn) => {
    const on = btn.dataset.goto === current;
    btn.classList.toggle('on', on);
    if (on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  updateCounts();
}

// 화면 이동은 주소 끝(#memo 등)을 바꾸는 방식이라 새로고침해도 같은 화면이 유지됩니다.
function go(view) {
  if (location.hash === `#${view}`) render();
  else location.hash = view;
}

window.addEventListener('hashchange', () => {
  current = viewFromHash();
  render();
  window.scrollTo(0, 0);
});

// 연결된 항목으로 이동하거나 다른 화면에서 이동을 요청할 때
window.addEventListener('harunote:navigate', (e) => go(e.detail.view));

// 여러 화면에 공통으로 있는 버튼을 한 곳에서 처리합니다.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-link-type],[data-edit-todo],[data-edit-memo],[data-edit-event],[data-new],[data-goto],[data-action]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.linkType) openItem(ds.linkType, ds.linkId);
  else if (ds.editTodo) todo.openEditor(ds.editTodo);
  else if (ds.editMemo) memo.openEditor(ds.editMemo);
  else if (ds.editEvent) calendar.openEditor(ds.editEvent, { date: ds.date });
  else if (ds.new === 'memo') memo.openEditor(null);
  else if (ds.new === 'todo') todo.openEditor(null, { due: ds.date || '' });
  else if (ds.new === 'event') calendar.openEditor(null, { date: ds.date });
  else if (ds.goto) go(ds.goto);
  else if (ds.action === 'enable-notify') notify.requestPermission().then(render);
  else if (ds.action === 'theme') cycleTheme();
});

// 할 일 체크박스
document.addEventListener('change', (e) => {
  const id = e.target.dataset && e.target.dataset.toggle;
  if (id) todo.toggleDone(id);
});

// ---------- 시작 ----------
applyTheme(getTheme()); // 배경 버튼 글자·아이콘 맞추기
setupModal();
store.cleanupTrash();
seedIfNeeded(); // 처음 열 때 샘플 할 일 100개와 히스토리를 만듭니다
vcs.ensureRepo(); // 히스토리가 없으면 지금 있는 할 일로 만듭니다
store.subscribe(render); // 데이터가 바뀌면 화면을 다시 그립니다
current = viewFromHash();
render();
notify.start();
