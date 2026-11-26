// =========================================================
// 히스토리 화면 — 앱 전체 main 줄기와 할 일 브랜치를 git 그래프로 보여줍니다.
//  · 할 일 추가 = main에서 가지가 갈라짐
//  · 할 일 완료 = 가지가 main에 합쳐지고 사라짐
// =========================================================
import * as store from './store.js';
import * as vcs from './vcs.js';
import { esc, icon } from './ui.js';
import { openItem } from './links.js';
import { fmtAgo, isoToYmd, fmtDate, pad, todayYmd, relativeDay } from './dates.js';

// 그래프 크기 — 줄 높이(ROW), 가지 사이 간격(LANE)을 바꾸면 그래프 모양이 바뀝니다
const ROW = 52;
const LANE = 16;
const PAD = 18;
const PAGE = 60; // 한 번에 보여줄 줄 수
const MAIN_COLOR = 'var(--blue)';
const BRANCH_COLORS = ['var(--orange)', 'var(--green)', 'var(--purple)', 'var(--pink)', 'var(--teal)', 'var(--indigo)', 'var(--yellow)', 'var(--red)'];

// 기록 종류별 아이콘·설명
const KIND = {
  init: { icon: 'branch', text: '히스토리 시작' },
  create: { icon: 'plus', text: '할 일 추가 · 브랜치 생성' },
  edit: { icon: 'pencil', text: '수정' },
  reopen: { icon: 'undo', text: '다시 열기 · 브랜치 생성' },
  restore: { icon: 'restore', text: '휴지통에서 복구' },
};

let selectedId = null;
let limit = PAGE;

const laneColor = (lane) => (lane === 0 ? MAIN_COLOR : BRANCH_COLORS[(lane - 1) % BRANCH_COLORS.length]);

export function branchColorOf(key) {
  const { laneOf } = vcs.layout();
  return laneColor(laneOf.get(key) ?? 0);
}

// 다른 화면에서 히스토리로 올 때 특정 기록을 선택해 둡니다. (그 기록이 보이도록 목록 길이도 늘림)
export function focusCommit(id) {
  const repo = vcs.getRepo();
  const c = repo.commits[id];
  if (!c) return;
  selectedId = id;
  const rowFromTop = Object.keys(repo.commits).length - c.seq;
  limit = Math.max(limit, Math.ceil((rowFromTop + 1) / PAGE) * PAGE);
}

// 할 일 편집 창의 "전체 보기 >" 버튼: 그 할 일의 마지막 기록을 선택해 둡니다.
export function focusTask(taskId) {
  const commits = vcs.taskCommits(taskId);
  if (commits.length) focusCommit(commits[commits.length - 1].id);
}

// ---------- 할 일 하나의 작은 그래프 (할 일 편집 창 오른쪽) ----------
// 이 할 일의 기록을 브랜치 줄(오른쪽)에, 맨 아래에 main에서 갈라진 지점을 그립니다.
export function miniGraphHtml(taskId) {
  const own = vcs.taskCommits(taskId).reverse(); // 최신이 위
  if (!own.length) return '';
  const { laneOf } = vcs.layout();
  const R = 50;
  const XM = 16; // main 줄
  const XB = 38; // 브랜치 줄
  const W = 54;
  const color = laneColor(laneOf.get(own[0].branch) ?? 1);
  const y = (i) => i * R + R / 2;
  const anchorY = y(own.length); // 맨 아래 "main" 줄

  let paths = `<path d="M${XM} 0V${anchorY}" style="stroke:${MAIN_COLOR}"/>`; // main 줄기
  own.forEach((c, i) => {
    if (vcs.START_KINDS.includes(c.kind)) {
      paths += `<path d="M${XB} ${y(i)}C${XB} ${y(i) + R / 2} ${XM} ${y(i) + R / 2} ${XM} ${y(i) + R}" style="stroke:${color}"/>`;
    } else if (i + 1 < own.length) {
      paths += `<path d="M${XB} ${y(i)}V${y(i + 1)}" style="stroke:${color}"/>`;
    }
  });
  const nodes =
    own.map((c, i) => `<circle class="node" cx="${XB}" cy="${y(i)}" r="5" style="--c:${color}"/>`).join('') +
    `<circle class="node" cx="${XM}" cy="${anchorY}" r="5" style="--c:${MAIN_COLOR}"/>`;
  const rows =
    own
      .map(
        (c) => `
        <button type="button" class="vc-row" data-history-commit="${c.id}" style="height:${R}px" title="히스토리에서 보기">
          <span class="vc-gutter" style="width:${W}px"></span>
          <span class="vc-text">
            <span class="vc-msg-text">${esc(c.kind === 'edit' ? c.message : KIND[c.kind].text)}</span>
            <span class="vc-meta">${fmtAgo(c.at)}</span>
          </span>
        </button>`
      )
      .join('') +
    `<div class="vc-row" style="height:${R}px"><span class="vc-gutter" style="width:${W}px"></span>
      <span class="vc-text"><span class="vc-msg-text muted">main · 여기서 갈라짐</span></span></div>`;

  return `
    <div class="mini-graph">
      <svg class="vc-svg" width="${W}" height="${(own.length + 1) * R}" aria-hidden="true">${paths}${nodes}</svg>
      <div class="vc-rows">${rows}</div>
    </div>`;
}

export function render(el) {
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-focus-commit],[data-commit],[data-more],[data-open-task]');
    if (!t) return;
    if (t.dataset.focusCommit) {
      // 진행 중 브랜치 카드: 그 브랜치의 최신 기록을 선택하고 그래프에서 그 줄로 이동
      focusCommit(t.dataset.focusCommit);
      draw(el);
      const row = el.querySelector(`.vc-rows [data-commit="${t.dataset.focusCommit}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (t.dataset.commit) {
      selectedId = t.dataset.commit;
      draw(el);
      if (window.innerWidth <= 1000) el.querySelector('.detail-col').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (t.dataset.more) {
      limit += PAGE;
      draw(el);
    } else if (t.dataset.openTask) {
      openItem('todo', t.dataset.openTask);
    }
  });
  draw(el);
}

function draw(el) {
  const L = vcs.layout();
  const desc = [...L.commits].reverse(); // 최신이 위
  if (!selectedId || !L.repo.commits[selectedId]) selectedId = desc[0].id;
  const s = vcs.stats();
  const rows = groupRows(desc);

  const stat = (color, iconName, num, label) => `
    <div class="stat" style="--tile:var(--${color})">
      <span class="tile">${icon(iconName)}</span>
      <span class="stat-num">${num}</span>
      <span class="stat-label">${label}</span>
    </div>`;

  el.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">히스토리</h1>
        <p class="page-sub">할 일을 추가하면 main에서 브랜치가 갈라지고, 완료하면 그 브랜치는 히스토리에서 사라져요. 지금 진행 중인 일만 보여요.</p>
      </div>
    </header>

    <div class="stats">
      ${stat('purple', 'branch', s.open, '진행 중 브랜치')}
      ${stat('blue', 'clock', s.commits, '진행 중 기록')}
      <button type="button" class="stat" data-goto="history" style="--tile:var(--green)">
        <span class="tile">${icon('done')}</span>
        <span class="stat-num">${store.list('todo').filter((t) => t.done).length}</span>
        <span class="stat-label">완료해서 정리된 일</span>
      </button>
    </div>

    ${openBranchesHtml(L)}

    <div class="graph-layout">
      <section class="section graph-col">
        <div class="section-head">
          <h2 class="section-title">그래프</h2>
          <span class="legend"><span><i class="dot" style="background:${MAIN_COLOR}"></i>main</span><span><i class="dot" style="background:${BRANCH_COLORS[0]}"></i>할 일 브랜치</span></span>
        </div>
        <div class="inset vc-graph">${graphHtml(L, rows)}</div>
        ${rows.length > limit ? `<button type="button" class="btn more-btn" data-more="1">이전 기록 ${Math.min(PAGE, rows.length - limit)}줄 더 보기</button>` : ''}
      </section>
      <aside class="section detail-col">
        <div class="section-head"><h2 class="section-title">선택한 기록</h2></div>
        ${detailHtml(L, L.repo.commits[selectedId])}
      </aside>
    </div>`;
}

// ---------- git 그래프 그리기 ----------
// 기록 하나가 한 줄(ROW). 브랜치마다 정해진 세로 칸(LANE)에 점을 찍고, 부모 기록과 선으로 잇습니다.
// 단, 사이에 다른 기록 없이 연달아 "할 일 추가"한 기록들은 한 줄에 묶습니다. (각자 다른 칸이라 겹치지 않음)
function groupRows(desc) {
  const rows = [];
  desc.forEach((c) => {
    const last = rows[rows.length - 1];
    if (c.kind === 'create' && last && last.every((k) => k.kind === 'create')) last.push(c);
    else rows.push([c]);
  });
  return rows; // [[기록], [기록, 기록, 기록], ...] 최신 줄이 먼저
}

function graphHtml(L, allRows) {
  const { repo, laneOf, maxLane } = L;
  const rows = allRows.slice(0, limit);
  const visible = rows.flat();
  const width = PAD * 2 + maxLane * LANE;
  const rowIndex = new Map();
  allRows.forEach((row, r) => row.forEach((c) => rowIndex.set(c.id, r)));
  // 맨 위 "지금" 줄: 진행 중인 브랜치를 모두 한 줄에 모읍니다. (왼쪽 칸부터 차례로)
  const openHeads = Object.keys(repo.branches)
    .filter((k) => k !== vcs.MAIN)
    .map((k) => repo.commits[repo.branches[k]])
    .sort((a, b) => laneOf.get(a.branch) - laneOf.get(b.branch));
  const TOP = openHeads.length ? 1 : 0; // "지금" 줄이 있으면 아래 기록들을 한 줄씩 내림
  const nowY = ROW / 2;

  const x = (c) => PAD + (laneOf.get(c.branch) ?? 0) * LANE;
  const y = (c) => (rowIndex.get(c.id) + TOP) * ROW + ROW / 2;

  // main 줄기: 맨 위부터 "히스토리 시작"까지 한 줄로
  const init = repo.commits[repo.branches[vcs.MAIN]];
  let paths = `<path d="M${PAD} 0V${y(init)}" style="stroke:${MAIN_COLOR}"/>`;
  // 진행 중인 브랜치: 마지막 기록에서 "지금" 줄까지 선을 이어 올립니다.
  openHeads.forEach((h) => {
    paths += `<path d="M${x(h)} ${y(h)}V${nowY}" style="stroke:${laneColor(laneOf.get(h.branch))}"/>`;
  });
  visible.forEach((c) => {
    // 브랜치의 첫 기록: 한 줄 아래 main 줄기에서 갈라져 나옵니다.
    if (vcs.START_KINDS.includes(c.kind)) {
      const [x1, y1] = [x(c), y(c)];
      paths += `<path d="M${x1} ${y1}C${x1} ${y1 + ROW / 2} ${PAD} ${y1 + ROW / 2} ${PAD} ${y1 + ROW}" style="stroke:${laneColor(laneOf.get(c.branch))}"/>`;
    }
    c.parents.forEach((pid, k) => {
      const p = repo.commits[pid];
      if (!p) return;
      const [x1, y1, x2, y2] = [x(c), y(c), x(p), y(p)];
      let d;
      let color;
      if (x1 === x2) {
        d = `M${x1} ${y1}V${y2}`; // 같은 줄기: 곧은 선
        color = laneColor(laneOf.get(c.branch) ?? 0);
      } else if (k === 0) {
        // main에서 갈라지는 곳: main 줄을 타고 올라오다가 브랜치가 생기기 바로 아래에서 갈라집니다.
        // (main 줄 위를 지나는 부분은 main 색으로 그려 겹쳐도 티가 나지 않게)
        if (y2 > y1 + ROW) paths += `<path d="M${x2} ${y1 + ROW}V${y2}" style="stroke:${MAIN_COLOR}"/>`;
        d = `M${x1} ${y1}C${x1} ${y1 + ROW / 2} ${x2} ${y1 + ROW / 2} ${x2} ${y1 + ROW}`;
        color = laneColor(laneOf.get(c.branch));
      } else {
        d = `M${x1} ${y1}C${x1} ${y1 + ROW / 2} ${x2} ${y1 + ROW / 2} ${x2} ${y1 + ROW}V${y2}`; // main으로 합쳐지는 곳
        color = laneColor(laneOf.get(p.branch));
      }
      paths += `<path d="${d}" style="stroke:${color}"/>`;
    });
  });

  const mainHead = repo.branches[vcs.MAIN];
  const nodes = visible
    .map((c) => {
      const cls = c.id === mainHead ? 'head' : '';
      const r = cls === 'head' ? 6.5 : 5;
      return `<circle class="node ${cls}" cx="${x(c)}" cy="${y(c)}" r="${r}" style="--c:${laneColor(laneOf.get(c.branch) ?? 0)}"/>`;
    })
    .join('') +
    openHeads.map((h) => `<circle class="node now" cx="${x(h)}" cy="${nowY}" r="6.5" style="--c:${laneColor(laneOf.get(h.branch))}"/>`).join('');

  const isOpenHead = (c) => c.branch !== vcs.MAIN && repo.branches[c.branch] === c.id;
  const rowStyle = `height:${ROW}px;min-width:${width + 220}px`;
  const gutter = `<span class="vc-gutter" style="width:${width}px"></span>`;

  // 기록 하나짜리 줄
  const singleRow = (c) => {
    const pills = [
      c.id === mainHead ? `<span class="ref current" style="--c:${MAIN_COLOR}">${icon('branch')}main</span>` : '',
      isOpenHead(c) ? `<span class="ref" style="--c:${laneColor(laneOf.get(c.branch))}">진행 중</span>` : '',
    ].join('');
    const action = c.kind === 'edit' ? c.message : KIND[c.kind].text;
    return `
      <button type="button" class="vc-row ${c.id === selectedId ? 'sel' : ''}" data-commit="${c.id}" style="${rowStyle}">
        ${gutter}
        <span class="vc-text">
          <span class="vc-msg">${pills}<span class="vc-msg-text">${esc(c.kind === 'init' ? '히스토리 시작' : c.label)}</span></span>
          <span class="vc-meta">${esc(action)} · ${fmtAgo(c.at)}</span>
        </span>
      </button>`;
  };

  // 연달아 추가한 할 일 여러 개를 묶은 줄: 할 일마다 누를 수 있는 칩
  const groupRow = (group) => {
    const oldest = group[group.length - 1];
    const newest = group[0];
    const chips = [...group]
      .reverse() // 먼저 추가한 것이 왼쪽
      .map(
        (c) => `
        <button type="button" class="commit-chip ${c.id === selectedId ? 'sel' : ''} ${isOpenHead(c) ? 'open' : ''}" data-commit="${c.id}"
          style="--c:${laneColor(laneOf.get(c.branch))}" title="${esc(c.label)} · ${fullTime(c.at)}${isOpenHead(c) ? ' · 진행 중' : ''}">
          <i class="chip-dot"></i>${esc(c.label)}
        </button>`
      )
      .join('');
    return `
      <div class="vc-row group ${group.some((c) => c.id === selectedId) ? 'sel' : ''}" role="group" aria-label="할 일 ${group.length}개 추가" style="${rowStyle}">
        ${gutter}
        <span class="vc-text">
          <span class="chip-line">${chips}</span>
          <span class="vc-meta">할 일 ${group.length}개 추가 · ${fmtAgo(oldest.at)} ~ ${fmtAgo(newest.at)}</span>
        </span>
      </div>`;
  };

  // "지금" 줄: 진행 중인 할 일 전부 (칩 색·순서 = 그래프의 칸 색·순서)
  const nowRow = () => {
    const today = todayYmd();
    const chips = openHeads
      .map((h) => {
        const task = h.taskId ? store.get('todo', h.taskId) : null;
        const overdue = task && task.due && task.due < today;
        return `
        <button type="button" class="commit-chip open ${h.id === selectedId ? 'sel' : ''}" data-commit="${h.id}"
          style="--c:${laneColor(laneOf.get(h.branch))}" title="${esc(task ? task.title : h.label)}${task && task.due ? ` · 마감 ${relativeDay(task.due)}` : ''}">
          <i class="chip-dot"></i>${esc(task ? task.title : h.label)}${overdue ? '<span class="chip-warn">지남</span>' : ''}
        </button>`;
      })
      .join('');
    return `
      <div class="vc-row group now-row" role="group" aria-label="지금 진행 중인 할 일 ${openHeads.length}개" style="${rowStyle}">
        ${gutter}
        <span class="vc-text">
          <span class="chip-line">${chips}</span>
          <span class="vc-meta"><strong class="now-label">지금</strong> · 진행 중인 할 일 ${openHeads.length}개</span>
        </span>
      </div>`;
  };

  const rowsHtml = (TOP ? nowRow() : '') + rows.map((row) => (row.length > 1 ? groupRow(row) : singleRow(row[0]))).join('');

  return `
    <svg class="vc-svg" width="${width}" height="${(rows.length + TOP) * ROW}" aria-hidden="true">${paths}${nodes}</svg>
    <div class="vc-rows">${rowsHtml}</div>`;
}

// ---------- 진행 중인 브랜치 카드 (그래프 위) ----------
function openBranchesHtml(L) {
  const { repo, laneOf } = L;
  const keys = Object.keys(repo.branches).filter((k) => k !== vcs.MAIN);
  if (!keys.length) return '';
  const today = todayYmd();
  const all = Object.values(repo.commits);
  const cards = keys
    .map((key) => {
      const head = repo.commits[repo.branches[key]];
      const own = all.filter((c) => c.branch === key);
      const start = own.reduce((a, b) => (a.seq < b.seq ? a : b));
      return { key, head, start, count: own.length, task: head.taskId ? store.get('todo', head.taskId) : null };
    })
    .sort((a, b) => (a.task?.due || '9999').localeCompare(b.task?.due || '9999')) // 마감이 가까운 순
    .map(({ key, head, start, count, task }) => {
      const due = task && task.due;
      const overdue = due && due < today;
      return `
        <button type="button" class="branch-card" data-focus-commit="${head.id}" style="--c:${laneColor(laneOf.get(key) ?? 1)}">
          <span class="bc-title">${esc(task ? task.title : head.label)}</span>
          <span class="bc-meta">
            <span class="${overdue ? 'overdue' : ''}">${due ? `마감 ${overdue ? '지남 · ' : ''}${relativeDay(due)}` : '마감 없음'}</span>
            <span>${fmtAgo(start.at)} 시작 · 기록 ${count}개</span>
          </span>
        </button>`;
    })
    .join('');
  return `
    <section class="section">
      <div class="section-head">
        <h2 class="section-title">진행 중인 브랜치<span class="count">${keys.length}</span></h2>
        <span class="muted small">누르면 그래프에서 위치를 보여줘요</span>
      </div>
      <div class="branch-cards">${cards}</div>
    </section>`;
}

// ---------- 선택한 기록의 자세한 내용 ----------
function fullTime(iso) {
  const d = new Date(iso);
  return `${fmtDate(isoToYmd(iso))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function detailHtml(L, c) {
  const { laneOf } = L;
  const kind = KIND[c.kind];
  const color = laneColor(laneOf.get(c.branch) ?? 0);
  const task = c.taskId ? store.get('todo', c.taskId) : null;
  const branchText = c.branch === vcs.MAIN ? 'main 줄기' : '진행 중';

  const kv = (label, value) => `<div class="cell"><span class="kv-label">${label}</span><span class="kv-value">${value}</span></div>`;
  const changes = (c.changes || [])
    .map((ch) => kv(esc(ch.label), ch.from ? `${esc(ch.from)} <span class="muted">→</span> <strong>${esc(ch.to)}</strong>` : `<strong>${esc(ch.to)}</strong>`))
    .join('');
  const timeline = c.taskId
    ? vcs
        .taskCommits(c.taskId)
        .reverse() // 최신 기록이 위로
        .map(
          (t) => `
          <button type="button" class="cell ${t.id === c.id ? 'sel' : ''}" data-commit="${t.id}">
            <span class="cell-icon">${icon(KIND[t.kind].icon)}</span>
            <span class="cell-main"><span class="cell-title">${esc(t.kind === 'edit' ? t.message : KIND[t.kind].text)}</span><span class="cell-sub">${fmtAgo(t.at)}</span></span>
          </button>`
        )
        .join('')
    : '';

  return `
    <div class="inset">
      <div class="detail-head">
        <span class="cell-icon" style="color:${color}">${icon(kind.icon)}</span>
        <div class="cell-main">
          <p class="vc-detail-msg">${esc(c.kind === 'init' ? '히스토리 시작' : c.label)}</p>
          <p class="vc-detail-meta">${esc(c.kind === 'edit' ? `수정 · ${c.message}` : kind.text)}</p>
        </div>
      </div>
      ${kv('브랜치', `<span class="ref ${c.branch === vcs.MAIN ? 'current' : ''}" style="--c:${color}">${icon('branch')}${c.branch === vcs.MAIN ? 'main' : '할 일'}</span><span class="muted small">${branchText}</span>`)}
      ${kv('시각', fullTime(c.at))}
      ${kv('기록 ID', `<code class="mono">${vcs.short(c.id)}</code>${c.parents.length ? `<span class="muted small">부모 ${c.parents.map((p) => vcs.short(p)).join(', ')}</span>` : ''}`)}
      ${changes}
    </div>
    ${
      timeline
        ? `<div class="section-head sub-head"><h3 class="section-title sm">이 할 일의 기록</h3></div><div class="inset">${timeline}</div>`
        : ''
    }
    ${task ? `<button type="button" class="btn primary more-btn" data-open-task="${task.id}">${icon('check', 'sm')}할 일 열기</button>` : ''}`;
}
