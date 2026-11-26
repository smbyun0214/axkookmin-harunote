// =========================================================
// 연결 기능 (L-1 ~ L-5)
// 메모·일정·할 일을 서로 이어 주고, 🔗 버튼으로 원래 항목에 찾아가게 합니다.
// =========================================================
import * as store from './store.js';
import { esc, icon } from './ui.js';
import { parseDateText, todayYmd } from './dates.js';
import { addTodo } from './vcs.js';

// 각 항목 종류를 여는 "편집 창 함수"를 등록해 두는 곳
const editors = {};
export const TAB_OF = { memo: 'memo', event: 'calendar', todo: 'todo' };
export const TYPE_ICON = { memo: 'note', event: 'calendar', todo: 'check' };

export function registerEditor(type, fn) {
  editors[type] = fn;
}

// 연결된 항목으로 이동: 해당 탭으로 바꾸고 편집 창을 엽니다.
export function openItem(type, id) {
  window.dispatchEvent(new CustomEvent('harunote:navigate', { detail: { view: TAB_OF[type] } }));
  if (editors[type]) editors[type](id);
}

export function titleOf(type, item) {
  if (item.title) return item.title;
  if (type === 'memo') {
    const firstLine = (item.body || '').split('\n').find((l) => l.trim());
    if (firstLine) return firstLine.trim().slice(0, 40);
  }
  return '(제목 없음)';
}

// 휴지통에 있는 항목은 빼고 보여줍니다.
export function linkedItems(item) {
  return (item.links || [])
    .map((l) => ({ ...l, item: store.get(l.type, l.id) }))
    .filter((x) => x.item);
}

export function chipsHtml(item) {
  const items = linkedItems(item);
  if (!items.length) return '';
  return `<div class="chips">${items
    .map(
      (x) =>
        `<button type="button" class="chip link-chip" data-link-type="${x.type}" data-link-id="${x.id}" title="${store.TYPE_LABEL[x.type]}로 이동">${icon(TYPE_ICON[x.type], 'sm')}${esc(titleOf(x.type, x.item))}</button>`
    )
    .join('')}</div>`;
}

export function linkBadge(item) {
  const n = linkedItems(item).length;
  return n ? `<span class="badge" title="연결된 항목 ${n}개">${icon('link', 'sm')}${n}</span>` : '';
}

// L-2: 메모 문장 → 할 일 (문장에 날짜가 있으면 마감일로 넣습니다)
export function todoFromText(memoId, text) {
  const { date } = parseDateText(text);
  const todo = addTodo({ title: text, due: date || '' }); // 히스토리에 브랜치도 함께 생깁니다
  store.link('memo', memoId, 'todo', todo.id);
  return todo;
}

// L-3: 메모 문장 → 일정 (날짜·시간을 미리 채운 일정 입력 창을 엽니다)
export function eventFromText(memoId, text) {
  const { date, time } = parseDateText(text);
  if (editors.event) {
    editors.event(null, {
      title: text,
      date: date || todayYmd(),
      startTime: time || '',
      linkTo: { type: 'memo', id: memoId },
    });
  }
}
