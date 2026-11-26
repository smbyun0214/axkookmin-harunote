// =========================================================
// 하루 기록 (E-4) — 날짜별로 "그날 한 일"을 모아 보여줍니다.
// 완료한 할 일, 쓴 메모, 지나간 (반복 아닌) 일정이 들어갑니다.
// =========================================================
import * as store from './store.js';
import { esc, icon, emptyState } from './ui.js';
import { isoToYmd, fmtDate, relativeDay, todayYmd, fmtTime } from './dates.js';
import { titleOf } from './links.js';

const MAX_DAYS = 60; // 최근 며칠까지 보여줄지

function collect() {
  const days = new Map();
  const push = (day, entry) => {
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(entry);
  };
  const today = todayYmd();

  store.list('todo').forEach((t) => {
    if (t.done && t.doneAt) push(isoToYmd(t.doneAt), { kind: 'todo', item: t, sortKey: t.doneAt });
  });
  store.list('memo').forEach((m) => push(isoToYmd(m.createdAt), { kind: 'memo', item: m, sortKey: m.createdAt }));
  store.list('event').forEach((ev) => {
    if ((!ev.repeat || ev.repeat === 'none') && ev.date <= today) push(ev.date, { kind: 'event', item: ev, sortKey: ev.startTime || '' });
  });

  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, MAX_DAYS);
}

const KIND = {
  todo: { icon: 'check', color: 'var(--orange)', label: '완료한 할 일', attr: 'data-edit-todo' },
  memo: { icon: 'note', color: 'var(--yellow)', label: '쓴 메모', attr: 'data-edit-memo' },
  event: { icon: 'calendar', color: 'var(--red)', label: '일정', attr: 'data-edit-event' },
};

function entryHtml({ kind, item }) {
  const k = KIND[kind];
  const title = kind === 'memo' ? titleOf('memo', item) : item.title;
  const sub = kind === 'event' ? fmtTime(item.startTime) : k.label;
  const dateAttr = kind === 'event' ? ` data-date="${item.date}"` : '';
  return `
    <button type="button" class="cell" ${k.attr}="${item.id}"${dateAttr}>
      <span class="cell-icon" style="color:${k.color}">${icon(k.icon)}</span>
      <span class="cell-main"><span class="cell-title">${esc(title)}</span><span class="cell-sub">${sub}</span></span>
    </button>`;
}

export function render(el) {
  const days = collect();
  const order = { event: 0, todo: 1, memo: 2 };
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">하루 기록</h1>
        <p class="page-sub">완료한 할 일, 쓴 메모, 지나간 일정을 날짜별로 모아 보여줘요.</p>
      </div>
    </header>
    ${
      days.length
        ? days
            .map(([day, entries]) => {
              const rel = relativeDay(day);
              const label = rel === '오늘' || rel === '어제' ? `${rel} · ${fmtDate(day)}` : fmtDate(day, { year: true });
              entries.sort((a, b) => order[a.kind] - order[b.kind] || a.sortKey.localeCompare(b.sortKey));
              return `
                <section class="section">
                  <div class="section-head"><h2 class="section-title sm">${label} · ${entries.length}개</h2></div>
                  <div class="inset">${entries.map(entryHtml).join('')}</div>
                </section>`;
            })
            .join('')
        : `<div class="inset">${emptyState('아직 기록이 없어요. 할 일을 완료하거나 메모를 쓰면 여기에 쌓여요.')}</div>`
    }`;
}
