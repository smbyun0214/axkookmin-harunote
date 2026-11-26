// =========================================================
// 오늘 화면 (E-1) — 앱을 열면 가장 먼저 보이는 화면
// =========================================================
import * as store from './store.js';
import { icon, emptyState } from './ui.js';
import { todayYmd, fmtDate, eventsOn, isoToYmd } from './dates.js';
import { eventRowHtml } from './calendar.js';
import { rowsHtml } from './todo.js';
import { miniHtml } from './memo.js';
import { permission } from './notify.js';

const RECENT_MEMO_COUNT = 3; // 최근 메모를 몇 개 보여줄지

export function render(el) {
  const today = todayYmd();
  const events = eventsOn(store.list('event'), today);
  const todos = store.list('todo');
  const openToday = todos.filter((t) => !t.done && t.due && t.due <= today);
  const doneToday = todos.filter((t) => t.done && t.doneAt && isoToYmd(t.doneAt) === today);
  const memos = [...store.list('memo')].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_MEMO_COUNT);

  const notifyBanner =
    permission() === 'default'
      ? `<div class="banner">${icon('bell')}<span>일정과 할 일 알림을 받으려면 알림을 켜 주세요</span><button type="button" class="btn sm primary" data-action="enable-notify">알림 켜기</button></div>`
      : '';

  const stat = (goto, color, iconName, num, label) => `
    <button type="button" class="stat" data-goto="${goto}" style="--tile:var(--${color})">
      <span class="tile">${icon(iconName)}</span>
      <span class="stat-num">${num}</span>
      <span class="stat-label">${label}</span>
    </button>`;

  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">오늘</h1>
        <p class="page-sub">${fmtDate(today, { year: true })}</p>
      </div>
    </header>
    ${notifyBanner}

    <div class="stats">
      ${stat('calendar', 'red', 'calendar', events.length, '오늘 일정')}
      ${stat('todo', 'orange', 'check', openToday.length, '남은 할 일')}
      ${stat('history', 'green', 'done', doneToday.length, '오늘 완료')}
    </div>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">일정</h2>
        <button type="button" class="btn plain sm" data-new="event" data-date="${today}">${icon('plus', 'sm')}일정</button>
      </div>
      <div class="inset">${events.length ? events.map((ev) => eventRowHtml(ev, today)).join('') : emptyState('오늘은 일정이 없어요')}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">할 일</h2>
        <button type="button" class="btn plain sm" data-new="todo" data-date="${today}">${icon('plus', 'sm')}할 일</button>
      </div>
      <div class="inset">${openToday.length || doneToday.length ? rowsHtml([...openToday, ...doneToday]) : emptyState('오늘 할 일이 없어요')}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">최근 메모</h2>
        <button type="button" class="btn plain sm" data-new="memo">${icon('plus', 'sm')}메모</button>
      </div>
      <div class="inset">${memos.length ? memos.map(miniHtml).join('') : emptyState('아직 메모가 없어요')}</div>
    </section>`;
}
