// =========================================================
// 메모 화면 (M-1 ~ M-5) — Apple "메모" 앱 스타일
// =========================================================
import * as store from './store.js';
import { esc, icon, openModal, toast, val, checked, emptyState } from './ui.js';
import { chipsHtml, linkBadge, registerEditor, todoFromText, eventFromText, titleOf } from './links.js';
import { fmtShort, fmtStamp } from './dates.js';

let query = ''; // 검색어
let tagFilter = ''; // 선택한 태그 ('' = 전체)

// '#면접 공부, #포트폴리오' → ['면접', '공부', '포트폴리오']
export function parseTags(text) {
  return [...new Set(text.split(/[\s,]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean))];
}

function allTags() {
  const tags = new Set();
  store.list('memo').forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));
  return [...tags].sort();
}

function matches(m) {
  if (tagFilter && !(m.tags || []).includes(tagFilter)) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return [m.title, m.body, ...(m.tags || [])].some((s) => (s || '').toLowerCase().includes(q));
}

function cellHtml(m) {
  const lines = (m.body || '').split('\n').filter((l) => l.trim());
  const snippet = lines.slice(m.title ? 0 : 1).join(' ') || '추가 텍스트 없음';
  const tags = (m.tags || []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('');
  return `
    <button type="button" class="cell memo-cell" data-edit-memo="${m.id}">
      <span class="cell-main">
        <span class="cell-title">${esc(titleOf('memo', m))}</span>
        <span class="cell-sub"><span class="cell-date">${fmtStamp(m.updatedAt)}</span>${esc(snippet)}</span>
        <span class="cell-tags">${tags}</span>
      </span>
      <span class="cell-meta">${linkBadge(m)}</span>
    </button>`;
}

// 다른 화면(오늘·캘린더)에서 쓰는 한 줄짜리 메모 표시
export function miniHtml(m) {
  return `
    <button type="button" class="cell" data-edit-memo="${m.id}">
      <span class="cell-icon" style="color:var(--yellow)">${icon('note')}</span>
      <span class="cell-main">
        <span class="cell-title">${esc(titleOf('memo', m))}</span>
        <span class="cell-sub">${fmtStamp(m.updatedAt)}</span>
      </span>
      <span class="cell-meta">${linkBadge(m)}</span>
    </button>`;
}

export function render(el) {
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">메모</h1>
        <p class="page-sub">메모 ${store.list('memo').length}개</p>
      </div>
      <button type="button" class="btn primary" data-new="memo">${icon('plus', 'sm')}새 메모</button>
    </header>
    <div class="search-wrap">${icon('search')}<input type="search" class="search" placeholder="검색" value="${esc(query)}" aria-label="메모 검색" /></div>
    <div class="tag-filter chips"></div>
    <div class="memo-list"></div>`;

  el.querySelector('.search').addEventListener('input', (e) => {
    query = e.target.value;
    renderList(el);
  });
  el.querySelector('.tag-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag]');
    if (!btn) return;
    tagFilter = btn.dataset.tag;
    renderList(el);
  });
  renderList(el);
}

function renderList(el) {
  const tags = allTags();
  if (tagFilter && !tags.includes(tagFilter)) tagFilter = '';
  el.querySelector('.tag-filter').innerHTML = tags.length
    ? [`<button type="button" class="chip ${tagFilter === '' ? 'on' : ''}" data-tag="">전체</button>`]
        .concat(tags.map((t) => `<button type="button" class="chip ${tagFilter === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`))
        .join('')
    : '';

  const memos = store.list('memo').filter(matches).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pinned = memos.filter((m) => m.pinned);
  const others = memos.filter((m) => !m.pinned);
  const group = (title, list) =>
    list.length
      ? `<section class="section"><div class="section-head"><h2 class="section-title">${title}<span class="count">${list.length}</span></h2></div><div class="inset">${list.map(cellHtml).join('')}</div></section>`
      : '';

  el.querySelector('.memo-list').innerHTML = memos.length
    ? group('고정됨', pinned) + group('메모', others)
    : `<div class="inset">${emptyState(query || tagFilter ? '찾는 메모가 없어요' : '아직 메모가 없어요. "새 메모"를 눌러 시작해 보세요.')}</div>`;
}

// 선택한 글자를 가져오고, 선택이 없으면 커서가 있는 줄 전체를 가져옵니다.
function pickText(textarea) {
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  if (e > s) return value.slice(s, e).trim();
  const start = value.lastIndexOf('\n', s - 1) + 1;
  let end = value.indexOf('\n', s);
  if (end < 0) end = value.length;
  return value.slice(start, end).trim();
}

// 메모 편집 창
export function openEditor(id) {
  const memo = id ? store.get('memo', id) : null;
  if (id && !memo) return toast('메모를 찾을 수 없어요');
  const d = memo || { title: '', body: '', tags: [], pinned: false };
  let memoId = memo ? memo.id : null;

  const body = `
    <input name="title" class="title-input" value="${esc(d.title)}" placeholder="제목" aria-label="제목" />
    <label class="field"><span>내용</span>
      <textarea name="body" rows="9" placeholder="자유롭게 적어 보세요">${esc(d.body)}</textarea>
    </label>
    <div class="convert">
      <span class="muted small">문장을 드래그해 선택한 뒤 눌러 보세요. 선택하지 않으면 커서가 있는 줄을 씁니다.</span>
      <div class="row">
        <button type="button" class="btn sm" data-convert="todo">${icon('check', 'sm')}할 일로 만들기</button>
        <button type="button" class="btn sm" data-convert="event">${icon('calendar', 'sm')}일정으로 만들기</button>
      </div>
    </div>
    <label class="field"><span>태그</span>
      <input name="tags" value="${esc((d.tags || []).map((t) => '#' + t).join(' '))}" placeholder="#면접 #공부" />
    </label>
    <label class="toggle-row"><span>맨 위에 고정</span><input type="checkbox" class="switch" name="pinned" ${d.pinned ? 'checked' : ''} /></label>
    <div class="linked">${memo ? chipsHtml(memo) : ''}</div>`;

  // 저장하고 메모 ID를 돌려줍니다. 제목·내용이 모두 비었으면 null.
  const save = (form) => {
    const fields = {
      title: val(form, 'title'),
      body: form.elements.body.value,
      tags: parseTags(val(form, 'tags')),
      pinned: checked(form, 'pinned'),
    };
    if (!fields.title && !fields.body.trim()) return null;
    if (memoId) store.update('memo', memoId, fields);
    else memoId = store.add('memo', fields).id;
    return memoId;
  };

  const actions = [];
  if (memo) {
    actions.push({
      label: '삭제',
      kind: 'danger',
      onClick: () => {
        store.remove('memo', memo.id);
        toast('휴지통으로 옮겼어요');
      },
    });
  }
  actions.push({
    label: '저장',
    primary: true,
    onClick: (form) => {
      if (!save(form)) {
        toast('제목이나 내용을 입력해 주세요');
        return true;
      }
      toast('저장했어요');
    },
  });

  openModal({
    title: memo ? '메모 수정' : '새 메모',
    body,
    actions,
    onOpen: (form) => {
      form.querySelectorAll('[data-convert]').forEach((btn) =>
        btn.addEventListener('click', () => {
          const text = pickText(form.elements.body);
          if (!text) return toast('먼저 내용을 적고 문장을 선택해 주세요');
          const savedId = save(form); // 연결하려면 메모가 먼저 저장돼 있어야 합니다
          if (btn.dataset.convert === 'todo') {
            const todo = todoFromText(savedId, text);
            toast(todo.due ? `할 일을 만들었어요 (마감 ${fmtShort(todo.due)})` : '할 일을 만들었어요');
            form.querySelector('.linked').innerHTML = chipsHtml(store.get('memo', savedId));
          } else {
            eventFromText(savedId, text);
          }
        })
      );
    },
  });
}

registerEditor('memo', openEditor);
