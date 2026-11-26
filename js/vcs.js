// =========================================================
// 할 일 히스토리 (git 방식)
//
// 앱 전체에 main 줄기가 하나 있습니다.
//  - 할 일을 추가하면  → main에서 그 할 일의 브랜치(가지)가 생깁니다
//  - 할 일을 수정하면  → 그 브랜치에 기록(커밋)이 쌓입니다
//  - 할 일을 완료하면  → 그 브랜치와 기록을 히스토리에서 완전히 지웁니다
//  - 할 일을 삭제하면  → 마찬가지로 브랜치와 기록을 지웁니다
//  - 완료를 취소하거나 휴지통에서 복구하면 → main에서 새 브랜치가 다시 생깁니다
// 그래서 히스토리에는 "지금 진행 중인 할 일"만 남습니다.
//
// 저장 모양 (store의 repo)
//  repo = {
//    version: 2,
//    seq: 마지막 기록 번호,
//    commits:  { 기록ID: { id, seq, branch, parents, kind, taskId, label, message, changes, at } },
//    branches: { main: 시작 기록ID, 'br-xxxx': 그 브랜치의 마지막 기록ID }
//  }
//  브랜치의 첫 기록(추가·다시 열기·복구)은 parents가 비어 있고, 화면에서 main 줄기에서 갈라지게 그립니다.
// =========================================================
import * as store from './store.js';
import { fmtShort, REPEAT_LABEL } from './dates.js';

export const MAIN = 'main';
const REPO_VERSION = 2;
const PRIORITY = { high: '높음', mid: '보통', low: '낮음' };
export const START_KINDS = ['create', 'reopen', 'restore']; // 브랜치를 시작하는 기록

export const short = (id) => id.slice(-6);

function commit(repo, fields) {
  const c = { id: store.uid(), seq: ++repo.seq, changes: null, taskId: null, parents: [], ...fields, at: fields.at || store.nowIso() };
  repo.commits[c.id] = c;
  return c;
}

function freshRepo(at) {
  const repo = { version: REPO_VERSION, seq: 0, commits: {}, branches: {} };
  const first = commit(repo, { branch: MAIN, kind: 'init', label: '하루노트', message: '히스토리 시작', at });
  repo.branches[MAIN] = first.id;
  return repo;
}

function openBranch(repo, todo) {
  return todo.branch && repo.branches[todo.branch] ? todo.branch : null;
}

// 브랜치와 그 브랜치의 기록을 모두 지웁니다.
function prune(repo, key) {
  Object.values(repo.commits).forEach((c) => {
    if (c.branch === key) delete repo.commits[c.id];
  });
  delete repo.branches[key];
}

// ---------- 기본 동작 (repo와 할 일 객체를 직접 바꿉니다) ----------
const START_MESSAGE = { create: '할 일 추가', reopen: '다시 열기', restore: '휴지통에서 복구' };

export function opCreate(repo, todo, at, kind = 'create') {
  const key = `br-${store.uid()}`;
  const c = commit(repo, { branch: key, kind, taskId: todo.id, label: todo.title, message: START_MESSAGE[kind], at });
  repo.branches[key] = c.id;
  todo.branch = key;
  return c;
}

// 진행 중인 할 일만 기록합니다. (완료·삭제된 할 일은 히스토리에 없으므로 기록하지 않음)
export function opEdit(repo, todo, changes, at) {
  const key = openBranch(repo, todo);
  if (!key) return null;
  const message = changes.map((ch) => (ch.from ? `${ch.label} ${ch.from} → ${ch.to}` : `${ch.label} ${ch.to}`)).join(' · ');
  const c = commit(repo, { branch: key, parents: [repo.branches[key]], kind: 'edit', taskId: todo.id, label: todo.title, message, changes, at });
  repo.branches[key] = c.id;
  return c;
}

export function opDone(repo, todo) {
  const key = openBranch(repo, todo);
  if (key) prune(repo, key);
}

export function opRemove(repo, todo) {
  const key = openBranch(repo, todo);
  if (key) prune(repo, key);
}

// ---------- 무엇이 바뀌었는지 ----------
const countLines = (v) => (v ? `${v.split('\n').filter((l) => l.trim()).length || 1}줄` : '없음');
const countList = (v) => (v && v.length ? `${v.length}개` : '없음');
const countCheck = (v) => (v && v.length ? `${v.filter((i) => i.done).length}/${v.length} 완료` : '없음');

const FIELDS = [
  ['title', '제목', (v) => v || '(없음)'],
  ['due', '마감일', (v) => (v ? fmtShort(v) : '없음')],
  ['priority', '우선순위', (v) => PRIORITY[v || 'mid']],
  ['repeat', '반복', (v) => REPEAT_LABEL[v || 'none']],
  ['remind', '알림', (v) => (v ? '켬' : '끔')],
  ['note', '메모', countLines],
  ['list', '리스트', countList],
  ['checklist', '체크리스트', countCheck],
];

function same(key, a, b) {
  if (key === 'remind') return !!a === !!b;
  if (key === 'list' || key === 'checklist') return JSON.stringify(a || []) === JSON.stringify(b || []);
  return (a || '') === (b || '');
}

export function diffTodo(before, after) {
  return FIELDS.filter(([key]) => !same(key, before[key], after[key])).map(([key, label, fmt]) => {
    let from = fmt(before[key]);
    let to = fmt(after[key]);
    if (from === to) [from, to] = ['', '수정']; // 개수는 같고 내용만 바뀐 경우
    return { label, from, to };
  });
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
    else if (e.type === 'done') opDone(repo, e.todo);
    else if (e.type === 'remove') opRemove(repo, e.todo);
  });
  return repo;
}

// 이미 있는 할 일들로 기록을 만들 때 쓰는 사건 목록 (진행 중인 할 일만 남게 됩니다)
export function eventsFromTodos(todos) {
  return todos.filter((t) => !t.done).map((t) => ({ at: t.createdAt, type: 'create', todo: t }));
}

export function getRepo() {
  return store.raw().repo;
}

// 예전 방식(완료한 기록도 남기던 히스토리)을 "진행 중만 남기는" 방식으로 정리합니다.
function compact(repo) {
  const open = new Set(Object.keys(repo.branches).filter((k) => k !== MAIN));
  const init = Object.values(repo.commits).find((c) => c.kind === 'init');
  Object.values(repo.commits).forEach((c) => {
    if (!open.has(c.branch) && c !== init) delete repo.commits[c.id];
  });
  Object.values(repo.commits).forEach((c) => {
    c.parents = (c.parents || []).filter((p) => repo.commits[p] && repo.commits[p].branch === c.branch);
  });
  repo.branches[MAIN] = init.id;
  repo.version = REPO_VERSION;
}

// 히스토리가 없으면 지금 있는 할 일로 만들고, 예전 방식이면 정리합니다.
export function ensureRepo() {
  const data = store.raw();
  if (!data.repo) data.repo = replay(eventsFromTodos(data.todos));
  else if (data.repo.version !== REPO_VERSION) compact(data.repo);
  else return;
  store.save();
}

// ---------- 화면에서 쓰는 할 일 동작 (저장까지 해 줍니다) ----------
export function addTodo(fields) {
  const todo = store.add('todo', { priority: 'mid', repeat: 'none', remind: false, done: false, doneAt: null, ...fields });
  opCreate(getRepo(), todo);
  store.save();
  return todo;
}

// 돌려주는 값: { changed: 바뀐 게 있는지, recorded: 히스토리에 기록했는지 }
export function updateTodo(id, fields) {
  const todo = store.get('todo', id);
  if (!todo) return { changed: false, recorded: false };
  const before = { ...todo };
  Object.assign(todo, fields, { updatedAt: store.nowIso() });
  const changes = diffTodo(before, todo);
  const c = changes.length ? opEdit(getRepo(), todo, changes) : null;
  store.save();
  return { changed: changes.length > 0, recorded: Boolean(c) };
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
  if (!todo || todo.done) return; // 완료된 할 일은 히스토리에 다시 넣지 않음
  opCreate(getRepo(), todo, undefined, 'restore');
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
  return {
    open: Object.keys(repo.branches).length - 1,
    commits: Object.values(repo.commits).filter((c) => c.kind !== 'init').length,
  };
}

// ---------- 그래프 배치 ----------
// 브랜치마다 세로 칸(lane)을 정합니다. main은 0번.
// 브랜치는 첫 기록 바로 아래 줄부터 칸을 쓰고, 지워지면 다른 브랜치가 그 칸을 다시 씁니다.
export function layout() {
  const repo = getRepo();
  const commits = Object.values(repo.commits).sort((a, b) => a.seq - b.seq); // 오래된 순
  const index = new Map(commits.map((c, i) => [c.id, i]));
  const spans = new Map();

  commits.forEach((c, i) => {
    if (c.branch === MAIN) return;
    let s = spans.get(c.branch);
    if (!s) {
      s = { key: c.branch, start: i - 1, first: i, end: repo.branches[c.branch] ? Infinity : i };
      spans.set(c.branch, s);
    }
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
