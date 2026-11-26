// =========================================================
// 캘린더 화면 (C-1 ~ C-4) + 일정 편집, 일정 → 메모 (L-4)
// Apple "캘린더" 스타일: 오늘은 빨간 숫자, 선택한 날은 동그라미
// =========================================================
import * as store from './store.js';
import { esc, icon, openModal, toast, val, options, emptyState } from './ui.js';
import { chipsHtml, linkBadge, registerEditor, openItem } from './links.js';
import {
  todayYmd, parseYmd, ymd, addDays, addMonths, weekStart, weekday, weekdayName,
  fmtDate, fmtShort, fmtTime, eventsOn, isoToYmd, REPEAT_LABEL,
} from './dates.js';
import { rowsHtml as todoRowsHtml } from './todo.js';
import { miniHtml as memoMiniHtml } from './memo.js';
import { REMIND_OPTIONS, askIfNeeded } from './notify.js';
import { extrasHtml, bindExtras, readExtras, extrasBadges } from './extras.js';

// 일정의 메모는 예전부터 쓰던 desc 칸에, 리스트·체크리스트는 list·checklist 칸에 저장합니다.
function eventExtras(form) {
  const { note, list, checklist } = readExtras(form);
  return { desc: note, list, checklist };
}

let mode = 'month'; // 'month' = 월간, 'week' = 주간
let cursor = todayYmd(); // 지금 보고 있는 달/주의 기준 날짜
let selected = todayYmd(); // 선택한 날짜

// 그날의 일정·할 일 (C-3, L-1: 마감일이 있는 할 일이 자동으로 들어옵니다)
// 메모는 사이드바 보기에서 뺐으므로 캘린더에도 보여주지 않습니다. (다시 보이려면 아래 memos 줄을 바꾸세요)
export function itemsOn(day) {
  return {
    events: eventsOn(store.list('event'), day),
    todos: store.list('todo').filter((t) => t.due === day),
    memos: [], // store.list('memo').filter((m) => isoToYmd(m.createdAt) === day),
  };
}

export function eventRowHtml(ev, day) {
  const time = ev.startTime ? fmtTime(ev.startTime) : '하루 종일';
  const sub = [
    ev.endTime ? `~ ${fmtTime(ev.endTime)}` : '',
    ev.repeat && ev.repeat !== 'none' ? `<span title="${REPEAT_LABEL[ev.repeat]} 반복">${icon('repeat', 'sm')}</span>` : '',
    ev.remind !== '' && ev.remind != null ? `<span title="알림">${icon('bell', 'sm')}</span>` : '',
    extrasBadges({ ...ev, note: ev.desc }),
  ].join('');
  return `
    <button type="button" class="cell event-cell" data-edit-event="${ev.id}" data-date="${day}">
      <span class="bar"></span>
      <span class="cell-main">
        <span class="cell-title">${esc(ev.title)}</span>
        <span class="cell-sub">${sub}</span>
      </span>
      <span class="time">${time}</span>
      <span class="cell-meta">${linkBadge(ev)}</span>
    </button>`;
}

function dayItemsHtml(day, emptyText) {
  const { events, todos, memos } = itemsOn(day);
  if (!events.length && !todos.length && !memos.length) return emptyText ? emptyState(emptyText) : '';
  return `
    ${events.length ? `<p class="sub-label">일정</p>${events.map((ev) => eventRowHtml(ev, day)).join('')}` : ''}
    ${todos.length ? `<p class="sub-label">할 일</p>${todoRowsHtml(todos)}` : ''}
    ${memos.length ? `<p class="sub-label">이날 쓴 메모</p>${memos.map(memoMiniHtml).join('')}` : ''}`;
}

// ---------- 월간 보기 (C-1) ----------
function monthHtml() {
  const base = parseYmd(cursor);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const start = addDays(ymd(first), -first.getDay());
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const today = todayYmd();

  const head = ['일', '월', '화', '수', '목', '금', '토'].map((w, i) => `<div class="wd ${i === 0 ? 'sun' : ''}">${w}</div>`).join('');

  let cells = '';
  for (let i = 0; i < cellCount; i++) {
    const day = addDays(start, i);
    const d = parseYmd(day);
    const { events, todos, memos } = itemsOn(day);
    const cls = [
      'day',
      d.getMonth() !== base.getMonth() ? 'out' : '',
      day === today ? 'today' : '',
      day === selected ? 'selected' : '',
      d.getDay() === 0 ? 'sun' : '',
    ].join(' ');
    const label = `${fmtDate(day)} 일정 ${events.length}개, 할 일 ${todos.length}개`;
    cells += `
      <button type="button" class="${cls}" data-day="${day}" aria-label="${label}">
        <span class="num">${d.getDate()}</span>
        <span class="dots">${events.length ? '<i class="dot d-ev"></i>' : ''}${todos.length ? '<i class="dot d-todo"></i>' : ''}${memos.length ? '<i class="dot d-memo"></i>' : ''}</span>
      </button>`;
  }

  return `
    <div class="inset month">${head}${cells}</div>
    <section class="section">
      <div class="section-head">
        <h2 class="section-title">${fmtDate(selected)}</h2>
        <button type="button" class="btn plain sm" data-new="event" data-date="${selected}">${icon('plus', 'sm')}일정</button>
      </div>
      <div class="inset">${dayItemsHtml(selected, '이날은 아직 아무것도 없어요')}</div>
    </section>`;
}

// ---------- 주간 보기 (C-4) ----------
function weekHtml() {
  const start = weekStart(cursor);
  const today = todayYmd();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const items = dayItemsHtml(day, '');
    html += `
      <section class="section week-day ${day === today ? 'today' : ''}">
        <div class="section-head">
          <h2 class="section-title sm" style="${weekday(day) === 0 ? 'color:var(--red)' : ''}">${fmtShort(day)} ${weekdayName(day)}요일${day === today ? ' · 오늘' : ''}</h2>
          <button type="button" class="icon-btn sm" data-new="event" data-date="${day}" aria-label="${fmtDate(day)} 일정 추가">${icon('plus')}</button>
        </div>
        ${items ? `<div class="inset">${items}</div>` : ''}
      </section>`;
  }
  return html;
}

function titleText() {
  if (mode === 'month') {
    const d = parseYmd(cursor);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }
  const start = weekStart(cursor);
  return `${fmtShort(start)} – ${fmtShort(addDays(start, 6))}`;
}

export function render(el) {
  // 클릭 처리는 한 번만 연결하고, 날짜를 바꿀 때는 draw()로 내용만 다시 그립니다.
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode],[data-nav],[data-day]');
    if (!btn) return;
    if (btn.dataset.mode) {
      mode = btn.dataset.mode;
      cursor = selected;
    } else if (btn.dataset.nav) {
      const n = Number(btn.dataset.nav);
      if (n === 0) cursor = selected = todayYmd();
      else cursor = mode === 'month' ? addMonths(cursor, n) : addDays(cursor, 7 * n);
    } else if (btn.dataset.day) {
      selected = btn.dataset.day;
      cursor = selected;
    }
    draw(el);
  });
  draw(el);
}

function draw(el) {
  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">캘린더</h1>
        <p class="page-sub">${monthSummary()}</p>
      </div>
      <div class="seg" role="group" aria-label="보기 방식">
        <button type="button" data-mode="month" class="${mode === 'month' ? 'on' : ''}">월</button>
        <button type="button" data-mode="week" class="${mode === 'week' ? 'on' : ''}">주</button>
      </div>
    </header>
    <div class="cal-bar">
      <strong>${titleText()}</strong>
      <button type="button" class="icon-btn" data-nav="-1" aria-label="이전">${icon('chevL')}</button>
      <button type="button" class="btn sm" data-nav="0">오늘</button>
      <button type="button" class="icon-btn" data-nav="1" aria-label="다음">${icon('chevR')}</button>
    </div>
    ${mode === 'month' ? monthHtml() : weekHtml()}
    <div class="legend"><span><i class="dot d-ev"></i>일정</span><span><i class="dot d-todo"></i>할 일</span></div>`;
}

// 제목 아래 설명: 보고 있는 달의 일정·할 일 수
function monthSummary() {
  const month = cursor.slice(0, 7);
  const todos = store.list('todo').filter((t) => (t.due || '').startsWith(month)).length;
  const first = `${month}-01`;
  let events = 0;
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) events += eventsOn(store.list('event'), day).length;
  return `${Number(month.slice(5))}월 일정 ${events}개 · 할 일 ${todos}개`;
}

// 일정 편집 창. preset.date는 새 일정의 날짜, 또는 기존 일정을 연 날짜입니다.
export function openEditor(id, preset = {}) {
  const ev = id ? store.get('event', id) : null;
  if (id && !ev) return toast('일정을 찾을 수 없어요');
  const d = ev || {
    title: preset.title || '',
    date: preset.date || selected,
    startTime: preset.startTime || '',
    endTime: '',
    repeat: 'none',
    remind: '',
    desc: '',
  };
  // 캘린더도 그 날짜로 이동해 둡니다.
  selected = cursor = ev ? preset.date || ev.date : d.date;

  const body = `
    <input name="title" class="title-input" value="${esc(d.title)}" placeholder="일정 제목" aria-label="일정 제목" />
    <div class="grid-2">
      <label class="field"><span>날짜</span><input type="date" name="date" value="${d.date}" /></label>
      <label class="field"><span>시작 (비우면 하루 종일)</span><input type="time" name="startTime" value="${d.startTime || ''}" /></label>
      <label class="field"><span>종료</span><input type="time" name="endTime" value="${d.endTime || ''}" /></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>반복</span><select name="repeat">${options(REPEAT_LABEL, d.repeat || 'none')}</select></label>
      <label class="field"><span>알림</span><select name="remind">${options(REMIND_OPTIONS, String(d.remind ?? ''))}</select></label>
    </div>
    ${extrasHtml({ ...d, note: d.desc })}
    ${ev && ev.repeat && ev.repeat !== 'none' ? '<p class="muted small">반복 일정을 고치면 모든 회차가 함께 바뀌어요.</p>' : ''}
    ${ev ? `<div class="linked">${chipsHtml(ev)}</div>` : ''}`;

  const actions = [];
  if (ev) {
    actions.push({
      label: '삭제',
      kind: 'danger',
      onClick: () => {
        store.remove('event', ev.id);
        toast('휴지통으로 옮겼어요');
      },
    });
    actions.push({
      label: '메모 쓰기',
      onClick: () => {
        const memo = store.add('memo', { title: `${ev.title} 메모`, body: '', tags: [], pinned: false });
        store.link('event', ev.id, 'memo', memo.id);
        openItem('memo', memo.id);
      },
    });
  }
  actions.push({
    label: '저장',
    primary: true,
    onClick: (form) => {
      const fields = {
        title: val(form, 'title'),
        date: val(form, 'date'),
        startTime: val(form, 'startTime'),
        endTime: val(form, 'endTime'),
        repeat: form.elements.repeat.value,
        remind: form.elements.remind.value,
        ...eventExtras(form),
      };
      if (!fields.title) {
        toast('일정 제목을 입력해 주세요');
        return true;
      }
      if (!fields.date) {
        toast('날짜를 선택해 주세요');
        return true;
      }
      if (fields.startTime && fields.endTime && fields.endTime < fields.startTime) {
        toast('종료 시간이 시작 시간보다 빨라요');
        return true;
      }
      if (ev) {
        store.update('event', ev.id, fields);
      } else {
        const created = store.add('event', fields);
        if (preset.linkTo) store.link(preset.linkTo.type, preset.linkTo.id, 'event', created.id);
      }
      selected = cursor = fields.date;
      if (fields.remind !== '') askIfNeeded();
      toast(ev ? '저장했어요' : `${fmtShort(fields.date)} 일정을 만들었어요`);
    },
  });

  openModal({ title: ev ? '일정 수정' : '새 일정', body, actions, onOpen: bindExtras });
}

registerEditor('event', openEditor);
