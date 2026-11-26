// =========================================================
// 할 일 히스토리 (git 방식)
//
// 앱 전체에 main 줄기가 하나 있습니다.
//  - 할 일을 추가하면  → main에서 그 할 일의 브랜치(가지)가 생깁니다
//  - 할 일을 수정하면  → 그 브랜치에 기록(커밋)이 쌓입니다
//  - 할 일을 완료하면  → 브랜치가 main에 합쳐지고(merge) 브랜치는 사라집니다
//  - 할 일을 삭제하면  → 브랜치가 합쳐지지 않고 그대로 끝납니다
//  - 완료를 취소하거나 휴지통에서 복구하면 → main에서 새 브랜치가 다시 생깁니다
//
// 저장 모양 (store의 repo)
//  repo = {
//    seq: 마지막 기록 번호,
//    commits:  { 기록ID: { id, seq, branch, parents, kind, taskId, label, message, changes, at } },
//    branches: { main: 기록ID, 'br-xxxx': 기록ID }   // 지금 열려 있는 가지들의 끝
//  }
// =========================================================
import * as store from './store.js';
import { fmtShort, REPEAT_LABEL } from './dates.js';

export const MAIN = 'main';
const PRIORITY = { high: '높음', mid: '보통', low: '낮음' };

export const short = (id) => id.slice(-6);

function commit(repo, fields) {
  const c = { id: store.uid(), seq: ++repo.seq, changes: null, taskId: null, ...fields, at: fields.at || store.nowIso() };
  repo.commits[c.id] = c;
  return c;
}

function freshRepo(at) {
  const repo = { seq: 0, commits: {}, branches: {} };
  const first = commit(repo, { branch: MAIN, parents: [], kind: 'init', label: '하루노트', message: '히스토리 시작', at });
  repo.branches[MAIN] = first.id;
  return repo;
}

function openBranch(repo, todo) {
  return todo.branch && repo.branches[todo.branch] ? todo.branch : null;
}

// main에 바로 남기는 기록 (브랜치가 없는 할 일의 수정·삭제·복구 등)
function onMain(repo, todo, kind, message, at, changes = null) {
  const c = commit(repo, { branch: MAIN, parents: [repo.branches[MAIN]], kind, taskId: todo.id, label: todo.title, message, changes, at });
  repo.branches[MAIN] = c.id;
  return c;
}

// ---------- 기본 동작 (repo와 할 일 객체를 직접 바꿉니다) ----------
const START_MESSAGE = { create: '할 일 추가', reopen: '다시 열기', restore: '휴지통에서 복구' };

export function opCreate(repo, todo, at, kind = 'create') {
  const key = `br-${store.uid()}`;
  const c = commit(repo, { branch: key, parents: [repo.branches[MAIN]], kind, taskId: todo.id, label: todo.title, message: START_MESSAGE[kind], at });
  repo.branches[key] = c.id;
  todo.branch = key;
  return c;
}

export function opEdit(repo, todo, changes, at) {
  const key = openBranch(repo, todo);
  const message = changes.map((ch) => `${ch.label} ${ch.from} → ${ch.to}`).join(' · ');
  if (!key) return onMain(repo, todo, 'edit', message, at, changes);
  const c = commit(repo, { branch: key, parents: [repo.branches[key]], kind: 'edit', taskId: todo.id, label: todo.title, message, changes, at });
  repo.branches[key] = c.id;
  return c;
}

export function opDone(repo, todo, at) {
  const key = openBranch(repo, todo);
  if (!key) return onMain(repo, todo, 'merge', '완료', at);
  const c = commit(repo, {
    branch: MAIN,
    parents: [repo.branches[MAIN], repo.branches[key]],
    kind: 'merge',
    taskId: todo.id,
    label: todo.title,
    message: '완료 · main에 합침',
    at,
  });
  repo.branches[MAIN] = c.id;
  delete repo.branches[key];
  return c;
}

export function opRemove(repo, todo, at) {
  const key = openBranch(repo, todo);
  if (!key) return onMain(repo, todo, 'remove', '삭제 · 휴지통으로', at);
  const c = commit(repo, { branch: key, parents: [repo.branches[key]], kind: 'remove', taskId: todo.id, label: todo.title, message: '삭제 · 휴지통으로', at });
  delete repo.branches[key];
  return c;
}

// ---------- 무엇이 바뀌었는지 ----------
const FIELDS = [
  ['title', '제목', (v) => v || '(없음)'],
  ['due', '마감일', (v) => (v ? fmtShort(v) : '없음')],
  ['priority', '우선순위', (v) => PRIORITY[v || 'mid']],
  ['repeat', '반복', (v) => REPEAT_LABEL[v || 'none']],
  ['remind', '알림', (v) => (v ? '켬' : '끔')],
];

export function diffTodo(before, after) {
  return FIELDS.filter(([key]) => (key === 'remind' ? !!before[key] !== !!after[key] : (before[key] || '') !== (after[key] || ''))).map(
    ([key, label, fmt]) => ({ label, from: fmt(before[key]), to: fmt(after[key]) })
  );
}

// ---------- 기록 한꺼번에 만들기 (처음 실행·샘플용) ----------
// events: [{ at, type: 'create' | 'edit' | 'done' | 'remove', todo, changes }]
export function replay(events) {
  events.sort((a, b) => a.at.localeCompare(b.at));
  const startAt = events.length ? new Date(new Date(events[0].at).getTime() - 3600000).toISOString() : store.nowIso();
  const repo = freshRepo(startAt);
  events.forEach((e) => {
    if (e.type === 'create') opCreate(repo, e.todo, e.at);
    else if (e.type === 'edit') opEdit(repo, e.todo, e.changes, e.at);
    else if (e.type === 'done') opDone(repo, e.todo, e.at);
    else if (e.type === 'remove') opRemove(repo, e.todo, e.at);
  });
  return repo;
}

// 이미 있는 할 일들로 기록을 만들 때 쓰는 사건 목록
export function eventsFromTodos(todos, trash = []) {
  const events = [];
  todos.forEach((t) => {
    events.push({ at: t.createdAt, type: 'create', todo: t });
    if (t.done && t.doneAt) events.push({ at: t.doneAt, type: 'done', todo: t });
  });
  trash
    .filter((e) => e.type === 'todo')
    .forEach((e) => {
      events.push({ at: e.item.createdAt, type: 'create', todo: e.item });
      events.push({ at: e.deletedAt, type: 'remove', todo: e.item });
    });
  return events;
}

export function getRepo() {
  return store.raw().repo;
}

// 히스토리가 없으면 지금 있는 할 일로 만들어 둡니다.
export function ensureRepo() {
  const data = store.raw();
  if (data.repo) return;
  data.repo = replay(eventsFromTodos(data.todos, data.trash));
  store.save();
}

// ---------- 화면에서 쓰는 할 일 동작 (저장까지 해 줍니다) ----------
export function addTodo(fields) {
  const todo = store.add('todo', { priority: 'mid', repeat: 'none', remind: false, done: false, doneAt: null, ...fields });
  opCreate(getRepo(), todo);
  store.save();
  return todo;
}

export function updateTodo(id, fields) {
  const todo = store.get('todo', id);
  if (!todo) return null;
  const before = { ...todo };
  Object.assign(todo, fields, { updatedAt: store.nowIso() });
  const changes = diffTodo(before, todo);
  const c = changes.length ? opEdit(getRepo(), todo, changes) : null;
  store.save();
  return c;
}

export function setDone(id, done) {
  const todo = store.get('todo', id);
  if (!todo) return;
  Object.assign(todo, { done, doneAt: done ? store.nowIso() : null, updatedAt: store.nowIso() });
  if (done) opDone(getRepo(), todo);
  else opCreate(getRepo(), todo, undefined, 'reopen');
  store.save();
}

export function removeTodo(id) {
  const todo = store.get('todo', id);
  if (!todo) return;
  opRemove(getRepo(), todo);
  store.remove('todo', id);
}

export function restoreTodo(id) {
  store.restore(id);
  const todo = store.get('todo', id);
  if (!todo) return;
  if (todo.done) onMain(getRepo(), todo, 'restore', '휴지통에서 복구');
  else opCreate(getRepo(), todo, undefined, 'restore');
  store.save();
}

// ---------- 조회 ----------
export function isOpen(todo) {
  return Boolean(openBranch(getRepo(), todo));
}

export function taskCommits(taskId) {
  return Object.values(getRepo().commits)
    .filter((c) => c.taskId === taskId)
    .sort((a, b) => a.seq - b.seq);
}

export function stats() {
  const repo = getRepo();
  const all = Object.values(repo.commits);
  return {
    open: Object.keys(repo.branches).length - 1,
    merged: all.filter((c) => c.kind === 'merge' && c.parents.length > 1).length,
    commits: all.length,
  };
}

// ---------- 그래프 배치 ----------
// 브랜치마다 세로 칸(lane)을 정합니다. main은 0번.
// 브랜치는 갈라진 곳부터 합쳐진(또는 끝난) 곳까지만 칸을 쓰고, 끝나면 다른 브랜치가 그 칸을 다시 씁니다.
export function layout() {
  const repo = getRepo();
  const commits = Object.values(repo.commits).sort((a, b) => a.seq - b.seq); // 오래된 순
  const index = new Map(commits.map((c, i) => [c.id, i]));
  const spans = new Map();

  commits.forEach((c, i) => {
    if (c.branch === MAIN) return;
    let s = spans.get(c.branch);
    if (!s) {
      // 브랜치 칸은 첫 기록 바로 아래 줄부터 씁니다. (그 아래는 main 줄을 타고 그립니다)
      s = { key: c.branch, start: i - 1, first: i, last: i, end: undefined };
      spans.set(c.branch, s);
    }
    s.last = i;
  });
  commits.forEach((c, i) => {
    if (c.parents.length < 2) return;
    const merged = repo.commits[c.parents[1]];
    const s = merged && spans.get(merged.branch);
    if (s) s.end = i;
  });
  spans.forEach((s) => {
    if (s.end === undefined) s.end = repo.branches[s.key] ? Infinity : s.last;
  });

  const laneEnd = [];
  const laneOf = new Map([[MAIN, 0]]);
  [...spans.values()]
    .sort((a, b) => a.first - b.first)
    .forEach((s) => {
      let lane = 1;
      while (laneEnd[lane] !== undefined && laneEnd[lane] > s.start) lane++;
      laneEnd[lane] = s.end;
      laneOf.set(s.key, lane);
    });

  return { repo, commits, index, laneOf, maxLane: Math.max(0, laneEnd.length - 1) };
}
