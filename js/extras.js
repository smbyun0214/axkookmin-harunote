// =========================================================
// 추가 내용: 메모 · 리스트 · 체크리스트
// 할 일과 일정 편집 창에서 필요한 것만 골라 붙여 쓰는 부품입니다.
//
// 저장 모양 (할 일·일정 항목 안)
//   note:      '자유롭게 쓴 글'
//   list:      ['항목1', '항목2']
//   checklist: [{ text: '항목1', done: true }, { text: '항목2', done: false }]
// 비어 있으면 저장하지 않습니다.
//
// 사용법
//   extrasHtml(item)  → 편집 창에 넣을 HTML
//   bindExtras(form)  → 버튼·키보드 동작 연결 (창을 연 뒤 한 번)
//   readExtras(form)  → 저장할 값 { note, list, checklist }
//   extrasBadges(item)→ 목록 줄에 붙일 작은 표시 (메모 있음, 체크 2/5 등)
// =========================================================
import { esc, icon } from './ui.js';

const LABEL = { note: '메모', list: '리스트', checklist: '체크리스트' };

function itemHtml(type, value = '', done = false) {
  if (type === 'checklist') {
    return `<li class="extra-item"><input type="checkbox" class="check sm" ${done ? 'checked' : ''} aria-label="완료" /><input class="extra-input ${done ? 'done' : ''}" value="${esc(value)}" placeholder="할 일 항목" /></li>`;
  }
  return `<li class="extra-item"><span class="bullet"></span><input class="extra-input" value="${esc(value)}" placeholder="항목" /></li>`;
}

function progressText(items) {
  return items.length ? `${items.filter((i) => i.done).length}/${items.length}` : '';
}

export function extrasHtml(item = {}) {
  const note = item.note || '';
  const list = item.list || [];
  const checklist = item.checklist || [];
  const shown = { note: Boolean(note), list: list.length > 0, checklist: checklist.length > 0 };

  const head = (type, extra = '') => `
    <div class="extra-head">
      <span class="extra-title">${icon(type === 'note' ? 'note' : type === 'list' ? 'list' : 'check', 'sm')}${LABEL[type]}${extra}</span>
      <button type="button" class="icon-btn sm" data-remove-block="${type}" aria-label="${LABEL[type]} 빼기" title="${LABEL[type]} 빼기">${icon('close')}</button>
    </div>`;

  return `
    <div class="extras">
      <div class="extra-block" data-block="note" ${shown.note ? '' : 'hidden'}>
        ${head('note')}
        <textarea class="extra-note" rows="3" placeholder="자세한 내용을 적어 보세요">${esc(note)}</textarea>
      </div>
      <div class="extra-block" data-block="list" ${shown.list ? '' : 'hidden'}>
        ${head('list')}
        <ul class="extra-items" data-items="list">${list.map((v) => itemHtml('list', v)).join('')}</ul>
        <button type="button" class="btn plain sm" data-add-item="list">${icon('plus', 'sm')}항목 추가</button>
      </div>
      <div class="extra-block" data-block="checklist" ${shown.checklist ? '' : 'hidden'}>
        ${head('checklist', ` <span class="extra-progress" data-progress>${progressText(checklist)}</span>`)}
        <ul class="extra-items" data-items="checklist">${checklist.map((c) => itemHtml('checklist', c.text, c.done)).join('')}</ul>
        <button type="button" class="btn plain sm" data-add-item="checklist">${icon('plus', 'sm')}항목 추가</button>
      </div>
      <div class="extra-add">
        ${['note', 'list', 'checklist']
          .map((t) => `<button type="button" class="btn sm" data-show-block="${t}" ${shown[t] ? 'hidden' : ''}>${icon('plus', 'sm')}${LABEL[t]}</button>`)
          .join('')}
      </div>
    </div>`;
}

export function bindExtras(form) {
  const box = form.querySelector('.extras');
  if (!box) return;
  const block = (type) => box.querySelector(`[data-block="${type}"]`);
  const showBtn = (type) => box.querySelector(`[data-show-block="${type}"]`);

  const updateProgress = () => {
    const items = readItems(box, 'checklist');
    const el = box.querySelector('[data-progress]');
    if (el) el.textContent = progressText(items);
  };

  const addItem = (type, after = null, focus = true) => {
    const ul = box.querySelector(`[data-items="${type}"]`);
    const tmp = document.createElement('ul');
    tmp.innerHTML = itemHtml(type);
    const li = tmp.firstElementChild;
    if (after) after.after(li);
    else ul.appendChild(li);
    if (focus) li.querySelector('.extra-input').focus();
    updateProgress();
  };

  box.addEventListener('click', (e) => {
    const show = e.target.closest('[data-show-block]');
    const remove = e.target.closest('[data-remove-block]');
    const add = e.target.closest('[data-add-item]');
    if (show) {
      const type = show.dataset.showBlock;
      block(type).hidden = false;
      show.hidden = true;
      if (type === 'note') block(type).querySelector('textarea').focus();
      else if (!box.querySelector(`[data-items="${type}"] li`)) addItem(type);
    } else if (remove) {
      const type = remove.dataset.removeBlock;
      const b = block(type);
      b.hidden = true;
      if (type === 'note') b.querySelector('textarea').value = '';
      else b.querySelector('.extra-items').innerHTML = '';
      showBtn(type).hidden = false;
      updateProgress();
    } else if (add) {
      addItem(add.dataset.addItem);
    }
  });

  // Enter: 아래에 새 항목 / 빈 항목에서 Backspace: 항목 지우기
  box.addEventListener('keydown', (e) => {
    const input = e.target.closest('.extra-input');
    if (!input || e.isComposing) return; // 한글 입력 중에는 건드리지 않음
    const li = input.closest('li');
    const type = input.closest('[data-items]').dataset.items;
    if (e.key === 'Enter') {
      e.preventDefault(); // 창 전체가 저장되지 않게
      addItem(type, li);
    } else if (e.key === 'Backspace' && !input.value && li.parentElement.children.length > 1) {
      e.preventDefault();
      const prev = li.previousElementSibling || li.nextElementSibling;
      li.remove();
      prev.querySelector('.extra-input').focus();
      updateProgress();
    }
  });

  box.addEventListener('change', (e) => {
    if (!e.target.matches('.extra-item .check')) return;
    e.target.nextElementSibling.classList.toggle('done', e.target.checked);
    updateProgress();
  });
}

function readItems(box, type) {
  return [...box.querySelectorAll(`[data-items="${type}"] li`)]
    .map((li) => {
      const text = li.querySelector('.extra-input').value.trim();
      return type === 'checklist' ? { text, done: li.querySelector('.check').checked } : text;
    })
    .filter((v) => (type === 'checklist' ? v.text : v));
}

export function readExtras(form) {
  const box = form.querySelector('.extras');
  if (!box) return {};
  const visible = (type) => !box.querySelector(`[data-block="${type}"]`).hidden;
  return {
    note: visible('note') ? box.querySelector('.extra-note').value.trim() : '',
    list: visible('list') ? readItems(box, 'list') : [],
    checklist: visible('checklist') ? readItems(box, 'checklist') : [],
  };
}

// 목록 줄에 붙이는 작은 표시
export function extrasBadges(item) {
  const out = [];
  if (item.checklist && item.checklist.length) {
    const done = item.checklist.filter((c) => c.done).length;
    out.push(`<span class="badge ${done === item.checklist.length ? 'all-done' : ''}" title="체크리스트">${icon('done', 'sm')}${done}/${item.checklist.length}</span>`);
  }
  if (item.list && item.list.length) out.push(`<span title="리스트 ${item.list.length}개">${icon('list', 'sm')}</span>`);
  if (item.note) out.push(`<span title="메모 있음">${icon('note', 'sm')}</span>`);
  return out.join('');
}
