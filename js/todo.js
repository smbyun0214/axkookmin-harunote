// =========================================================
// 할 일 화면 (T-1 ~ T-5) — Apple "미리 알림" 스타일
// =========================================================
// 할 일을 추가·수정·완료·삭제하면 히스토리(vcs.js)에 기록이 남습니다.
import * as store from './store.js';
import * as vcs from './vcs.js';
import { esc, icon, openModal, closeModal, toast, val, checked, options, emptyState } from './ui.js';
import { chipsHtml, linkBadge, registerEditor } from './links.js';
import { todayYmd, relativeDay, nextDate, fmtShort, REPEAT_LABEL } from './dates.js';
import { askIfNeeded } from './notify.js';
import { focusTask, focusCommit, branchColorOf, miniGraphHtml } from './versions.js';

export const PRIORITY = { high: '높음', mid: '보통', low: '낮음' };
const P_ORDER = { high: 0, mid: 1, low: 2 };

let refocusQuickAdd = false;
let doneOpen = false;

const byPriority = (a, b) => P_ORDER[a.priority || 'mid'] - P_ORDER[b.priority || 'mid'];
const byDue = (a, b) => (a.due || '').localeCompare(b.due || '') || byPriority(a, b);

// 할 일 한 줄 (오늘·캘린더 화면에서도 같이 씁니다)
export function rowHtml(t) {
  const today = todayYmd();
  const overdue = !t.done && t.due && t.due < today;
  const sub = [
    t.due ? `<span class="due ${overdue ? 'overdue' : ''}">${overdue ? '지남 · ' : ''}${relativeDay(t.due)}</span>` : '',
    t.repeat && t.repeat !== 'none' ? `<span title="${REPEAT_LABEL[t.repeat]} 반복">${icon('repeat', 'sm')}</span>` : '',
    t.remind ? `<span title="마감일 알림">${icon('bell', 'sm')}</span>` : '',
    linkBadge(t),
  ].join('');
  return `
    <div class="cell todo ${t.done ? 'done' : ''}">
      <input type="checkbox" class="check" data-toggle="${t.id}" ${t.done ? 'checked' : ''} aria-label="완료 표시" />
      <button type="button" class="todo-body" data-edit-todo="${t.id}">
        <span class="cell-title">${t.priority === 'high' ? '<span class="prio" title="우선순위 높음">!!</span>' : ''}${esc(t.title)}</span>
        <span class="cell-sub">${sub}</span>
      </button>
    </div>`;
}

export function rowsHtml(todos) {
  return todos.map(rowHtml).join('');
}

export function listHtml(todos, emptyText) {
  if (!todos.length) return emptyText ? `<div class="inset">${emptyState(emptyText)}</div>` : '';
  return `<div class="inset">${rowsHtml(todos)}</div>`;
}

// 완료 체크 (T-2). 반복 할 일이면 다음 회차를 만듭니다. (E-3)
export function toggleDone(id) {
  const t = store.get('todo', id);
  if (!t) return;
  const done = !t.done;
  vcs.setDone(id, done); // 완료: 브랜치를 main에 합침 / 취소: 브랜치를 다시 만듦
  if (done) toast('완료했어요 · 브랜치를 main에 합쳤어요');
  if (done && t.repeat && t.repeat !== 'none' && t.due && !t.spawnedNext) {
    const next = nextDate(t.due, t.repeat);
    vcs.addTodo({ title: t.title, due: next, priority: t.priority, repeat: t.repeat, remind: t.remind });
    store.update('todo', id, { spawnedNext: true });
    toast(`다음 할 일을 ${fmtShort(next)}에 만들었어요`);
  }
}

export function render(el) {
  const today = todayYmd();
  const todos = store.list('todo');
  const open = todos.filter((t) => !t.done);
  const todayList = open.filter((t) => t.due && t.due <= today).sort(byDue);
  const upcoming = open.filter((t) => t.due && t.due > today).sort(byDue);
  const noDate = open.filter((t) => !t.due).sort(byPriority);
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">할 일</h1>
        <p class="page-sub">남은 할 일 ${open.length}개</p>
      </div>
    </header>

    <form class="inset quick-add">
      <span class="plus">${icon('plus')}</span>
      <input name="title" placeholder="새로운 할 일" autocomplete="off" aria-label="새 할 일" />
      <input type="date" name="due" value="${today}" aria-label="마감일" />
    </form>

    <section class="section">
      <div class="section-head"><h2 class="section-title">오늘<span class="count">${todayList.length}</span></h2></div>
      ${listHtml(todayList, '오늘 할 일을 모두 끝냈어요')}
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">예정<span class="count">${upcoming.length + noDate.length}</span></h2></div>
      ${
        upcoming.length || noDate.length
          ? `<div class="inset">${rowsHtml(upcoming)}${noDate.length ? `<p class="sub-label">날짜 없음</p>${rowsHtml(noDate)}` : ''}</div>`
          : `<div class="inset">${emptyState('예정된 할 일이 없어요')}</div>`
      }
    </section>

    <details class="section" ${doneOpen ? 'open' : ''}>
      <summary class="section-head">
        <h2 class="section-title">완료됨<span class="count">${done.length}</span></h2>
        <span class="chev">${icon('chevR')}</span>
      </summary>
      ${listHtml(done, '완료한 할 일이 없어요')}
    </details>`;

  const form = el.querySelector('.quick-add');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = val(form, 'title');
    if (!title) return toast('할 일을 입력해 주세요');
    refocusQuickAdd = true;
    vcs.addTodo({ title, due: val(form, 'due') });
  });
  el.querySelector('details').addEventListener('toggle', (e) => {
    doneOpen = e.target.open;
  });

  if (refocusQuickAdd) {
    refocusQuickAdd = false;
    form.elements.title.focus();
  }
}

// 할 일 편집 창
export function openEditor(id, preset = {}) {
  const todo = id ? store.get('todo', id) : null;
  if (id && !todo) return toast('할 일을 찾을 수 없어요');
  const d = todo || { title: preset.title || '', due: preset.due || '', priority: 'mid', repeat: 'none', remind: false };

  const fieldsHtml = `
    <input name="title" class="title-input" value="${esc(d.title)}" placeholder="할 일" aria-label="할 일" />
    <div class="grid-2">
      <label class="field"><span>마감일</span><input type="date" name="due" value="${d.due || ''}" /></label>
      <label class="field"><span>우선순위</span><select name="priority">${options(PRIORITY, d.priority || 'mid')}</select></label>
      <label class="field"><span>반복</span><select name="repeat">${options(REPEAT_LABEL, d.repeat || 'none')}</select></label>
    </div>
    <label class="toggle-row"><span>마감일 오전 9시에 알림</span><input type="checkbox" class="switch" name="remind" ${d.remind ? 'checked' : ''} /></label>
    ${todo ? `<div class="linked">${chipsHtml(todo)}</div>` : ''}`;

  // 이미 있는 할 일이면 오른쪽에 이 할 일의 git 그래프를 붙입니다.
  const body = todo
    ? `<div class="sheet-split">
        <div class="sheet-main">${fieldsHtml}</div>
        <aside class="sheet-side">${historyPanel(todo)}</aside>
      </div>`
    : fieldsHtml;

  const actions = [];
  if (todo) {
    actions.push({
      label: '삭제',
      kind: 'danger',
      onClick: () => {
        vcs.removeTodo(todo.id);
        toast('휴지통으로 옮겼어요');
      },
    });
  }
  actions.push({
    label: '저장',
    primary: true,
    onClick: (form) => {
      const fields = {
        title: val(form, 'title'),
        due: val(form, 'due'),
        priority: form.elements.priority.value,
        repeat: form.elements.repeat.value,
        remind: checked(form, 'remind'),
      };
      if (!fields.title) {
        toast('할 일을 입력해 주세요');
        return true;
      }
      if (fields.repeat !== 'none' && !fields.due) fields.due = todayYmd(); // 반복하려면 시작 날짜가 필요
      if (fields.remind && !fields.due) {
        toast('알림을 받으려면 마감일을 정해 주세요');
        return true;
      }
      if (todo) {
        const c = vcs.updateTodo(todo.id, fields);
        toast(c ? '저장했어요 · 히스토리에 기록했어요' : '저장했어요 (바뀐 내용 없음)');
      } else {
        vcs.addTodo(fields);
        toast('할 일을 추가했어요 · main에서 브랜치를 만들었어요');
      }
      if (fields.remind) askIfNeeded();
    },
  });

  const goHistory = (focus) => {
    focus();
    closeModal();
    window.dispatchEvent(new CustomEvent('harunote:navigate', { detail: { view: 'versions' } }));
  };

  openModal({
    title: todo ? '할 일' : '새 할 일',
    body,
    actions,
    wide: Boolean(todo),
    onOpen: (form) => {
      const all = form.querySelector('[data-open-history]');
      if (all) all.addEventListener('click', () => goHistory(() => focusTask(todo.id)));
      form.querySelectorAll('[data-history-commit]').forEach((row) =>
        row.addEventListener('click', () => goHistory(() => focusCommit(row.dataset.historyCommit)))
      );
    },
  });
}

// 편집 창 오른쪽: 이 할 일의 브랜치 상태 + 작은 git 그래프
function historyPanel(todo) {
  const open = vcs.isOpen(todo);
  const count = vcs.taskCommits(todo.id).length;
  const color = open ? branchColorOf(todo.branch) : 'var(--green)';
  return `
    <div class="side-head">
      <h3 class="section-title sm">히스토리</h3>
      <button type="button" class="btn plain sm" data-open-history="1">전체 보기 ${icon('chevR', 'sm')}</button>
    </div>
    <div class="side-status">
      <span class="ref current" style="--c:${color}">${icon(open ? 'branch' : 'merge')}${open ? '진행 중 브랜치' : 'main에 합쳐짐'}</span>
      <span class="muted small">기록 ${count}개</span>
    </div>
    ${miniGraphHtml(todo.id)}`;
}

registerEditor('todo', openEditor);
