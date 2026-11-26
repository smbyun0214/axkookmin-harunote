// =========================================================
// 데이터 저장소
// 메모·일정·할 일·휴지통을 브라우저 저장소(localStorage)에 보관합니다.
// 다른 파일은 모두 이 파일의 함수로만 데이터를 읽고 씁니다.
// =========================================================

const KEY = 'harunote-data-v1'; // 브라우저에 저장되는 이름
const TRASH_DAYS = 30; // 휴지통 보관 기간(일) — 바꾸고 싶으면 이 숫자를 고치세요

const COLLECTION = { memo: 'memos', event: 'events', todo: 'todos' };
export const TYPE_LABEL = { memo: '메모', event: '일정', todo: '할 일' };
// repo = 할 일 히스토리(git 방식, vcs.js), meta = 샘플을 넣었는지 등 앱 상태
function emptyData() {
  return { memos: [], events: [], todos: [], trash: [], repo: null, meta: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData();
  } catch (err) {
    console.warn('저장된 데이터를 읽지 못했어요.', err);
    return emptyData();
  }
}

let data = load();
const listeners = new Set();

// 데이터가 바뀔 때마다 저장하고, 화면에 "다시 그려 줘"라고 알립니다.
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('데이터를 저장하지 못했어요.', err);
  }
  listeners.forEach((fn) => fn());
}

// 항목 안의 내용을 직접 고친 뒤 저장만 할 때 씁니다. (히스토리 등)
export function save() {
  persist();
}

// 저장소 전체 (히스토리·샘플 만들기처럼 여러 곳을 한 번에 고칠 때만 씁니다)
export function raw() {
  return data;
}

export function subscribe(fn) {
  listeners.add(fn);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function nowIso() {
  return new Date().toISOString();
}

// ---------- 읽기 ----------
export function list(type) {
  return data[COLLECTION[type]];
}

export function get(type, id) {
  return list(type).find((x) => x.id === id) || null;
}

// ---------- 쓰기 ----------
export function add(type, fields) {
  const item = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), links: [], ...fields };
  list(type).push(item);
  persist();
  return item;
}

// 여러 개를 한 번에 추가 (샘플 데이터용). 저장·화면 갱신은 한 번만 합니다.
export function addMany(type, items) {
  list(type).push(...items.map((fields) => ({ id: uid(), createdAt: nowIso(), updatedAt: nowIso(), links: [], ...fields })));
  persist();
}

// 조건에 맞는 항목을 휴지통을 거치지 않고 바로 지웁니다. (샘플 지우기용)
export function removeWhere(type, test) {
  const key = COLLECTION[type];
  data[key] = data[key].filter((x) => !test(x));
  persist();
}

export function update(type, id, patch) {
  const item = get(type, id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: nowIso() });
  persist();
  return item;
}

// 삭제하면 바로 지우지 않고 휴지통으로 옮깁니다. (E-5)
export function remove(type, id) {
  const arr = list(type);
  const idx = arr.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const [item] = arr.splice(idx, 1);
  data.trash.push({ type, item, deletedAt: nowIso() });
  persist();
}

// ---------- 연결 (L-1 ~ L-5) ----------
// 두 항목을 서로 연결합니다. 양쪽 모두에 기록해서 어느 쪽에서든 찾아갈 수 있습니다.
export function link(aType, aId, bType, bId) {
  const a = get(aType, aId);
  const b = get(bType, bId);
  if (!a || !b) return;
  if (!a.links.some((l) => l.type === bType && l.id === bId)) a.links.push({ type: bType, id: bId });
  if (!b.links.some((l) => l.type === aType && l.id === aId)) b.links.push({ type: aType, id: aId });
  persist();
}

// ---------- 휴지통 ----------
export function trashList() {
  return data.trash;
}

export function restore(id) {
  const idx = data.trash.findIndex((t) => t.item.id === id);
  if (idx < 0) return;
  const [entry] = data.trash.splice(idx, 1);
  list(entry.type).push(entry.item);
  persist();
}

export function purge(id) {
  data.trash = data.trash.filter((t) => t.item.id !== id);
  persist();
}

export function emptyTrash() {
  data.trash = [];
  persist();
}

export function trashDaysLeft(entry) {
  const passed = (Date.now() - new Date(entry.deletedAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(TRASH_DAYS - passed));
}

// 앱을 열 때 30일이 지난 항목을 정리합니다.
export function cleanupTrash() {
  const limit = Date.now() - TRASH_DAYS * 86400000;
  const before = data.trash.length;
  data.trash = data.trash.filter((t) => new Date(t.deletedAt).getTime() > limit);
  if (data.trash.length !== before) persist();
}
