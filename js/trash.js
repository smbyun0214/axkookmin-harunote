// =========================================================
// 휴지통 (E-5) — 지운 항목을 30일 동안 보관하고 복구할 수 있습니다.
// =========================================================
import * as store from './store.js';
import * as vcs from './vcs.js';
import { esc, icon, toast, emptyState } from './ui.js';
import { titleOf, TYPE_ICON } from './links.js';

function rowHtml(entry) {
  const { type, item } = entry;
  return `
    <div class="cell trash-cell">
      <span class="cell-icon">${icon(TYPE_ICON[type])}</span>
      <span class="cell-main">
        <span class="cell-title">${esc(titleOf(type, item))}</span>
        <span class="cell-sub">${store.TYPE_LABEL[type]} · ${store.trashDaysLeft(entry)}일 후 자동 삭제</span>
      </span>
      <span class="cell-actions">
        <button type="button" class="btn sm" data-restore="${item.id}">${icon('restore', 'sm')}복구</button>
        <button type="button" class="icon-btn sm danger" data-purge="${item.id}" aria-label="완전 삭제" title="완전 삭제">${icon('trash')}</button>
      </span>
    </div>`;
}

export function render(el) {
  const items = [...store.trashList()].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">휴지통</h1>
        <p class="page-sub">지운 항목은 30일 동안 보관된 뒤 자동으로 사라져요.</p>
      </div>
      ${items.length ? '<button type="button" class="btn danger" data-empty>모두 비우기</button>' : ''}
    </header>
    <div class="inset">${items.length ? items.map(rowHtml).join('') : emptyState('휴지통이 비어 있어요')}</div>`;

  el.addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('[data-restore]');
    const purgeBtn = e.target.closest('[data-purge]');
    if (restoreBtn) {
      const id = restoreBtn.dataset.restore;
      const entry = store.trashList().find((t) => t.item.id === id);
      if (entry && entry.type === 'todo') vcs.restoreTodo(id); // 할 일은 히스토리에 새 브랜치를 만듭니다
      else store.restore(id);
      toast('복구했어요');
    } else if (purgeBtn) {
      if (confirm('완전히 삭제할까요? 되돌릴 수 없어요.')) {
        store.purge(purgeBtn.dataset.purge);
        toast('완전히 삭제했어요');
      }
    } else if (e.target.closest('[data-empty]')) {
      if (confirm('휴지통을 비울까요? 안의 항목을 모두 되돌릴 수 없게 지워요.')) {
        store.emptyTrash();
        toast('휴지통을 비웠어요');
      }
    }
  });
}
