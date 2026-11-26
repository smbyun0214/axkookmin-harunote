// =========================================================
// 히스토리 화면 — 앱 전체 main 줄기와 할 일 브랜치를 git 그래프로 보여줍니다.
//  · 할 일 추가 = main에서 가지가 갈라짐
//  · 할 일 완료 = 가지가 main에 합쳐지고 사라짐
// =========================================================
import * as store from './store.js';
import * as vcs from './vcs.js';
import { esc, icon } from './ui.js';
import { openItem } from './links.js';
import { fmtAgo, isoToYmd, fmtDate, pad } from './dates.js';

// 그래프 크기 — 줄 높이(ROW), 가지 사이 간격(LANE)을 바꾸면 그래프 모양이 바뀝니다
const ROW = 52;
const LANE = 16;
const PAD = 18;
const PAGE = 60; // 한 번에 보여줄 기록 수
const MAIN_COLOR = 'var(--blue)';
const BRANCH_COLORS = ['var(--orange)', 'var(--green)', 'var(--purple)', 'var(--pink)', 'var(--teal)', 'var(--indigo)', 'var(--yellow)', 'var(--red)'];

// 기록 종류별 아이콘·설명
const KIND = {
  init: { icon: 'branch', text: '히스토리 시작' },
  create: { icon: 'plus', text: '할 일 추가 · 브랜치 생성' },
  edit: { icon: 'pencil', text: '수정' },
  merge: { icon: 'merge', text: '완료 · main에 합침' },
  remove: { icon: 'trash', text: '삭제 · 브랜치 종료' },
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
// 이 할 일의 기록 + main에서 갈라진 지점만 골라, main(왼쪽)과 브랜치(오른쪽) 두 줄로 그립니다.
export function miniGraphHtml(taskId) {
  const repo = vcs.getRepo();
  const own = vcs.taskCommits(taskId);
  if (!own.length) return '';
  const { laneOf } = vcs.layout();
  const ids = new Set(own.map((c) => c.id));
  own.forEach((c) => {
    const p = c.parents[0] && repo.commits[c.parents[0]];
    if (c.branch !== vcs.MAIN && p && p.branch === vcs.MAIN) ids.add(p.id); // 갈라진 지점
  });
  const list = [...ids].map((id) => repo.commits[id]).sort((a, b) => b.seq - a.seq); // 최신이 위

  const R = 50;
  const XM = 16; // main 줄
  const XB = 38; // 브랜치 줄
  const W = 54;
  const row = new Map(list.map((c, i) => [c.id, i]));
  const x = (c) => (c.branch === vcs.MAIN ? XM : XB);
  const y = (c) => row.get(c.id) * R + R / 2;
  const colorOf = (c) => laneColor(laneOf.get(c.branch) ?? 0);

  // main 줄: 중간에 다른 할 일 기록이 있어 생략된 구간은 점선으로
  const mains = list.filter((c) => c.branch === vcs.MAIN);
  let paths = mains.length > 1 ? `<path class="gap" d="M${XM} ${y(mains[0])}V${y(mains[mains.length - 1])}" style="stroke:${MAIN_COLOR}"/>` : '';
  list.forEach((c) => {
    c.parents.forEach((pid, k) => {
      const p = repo.commits[pid];
      if (!p || !row.has(pid)) return;
      const [x1, y1, x2, y2] = [x(c), y(c), x(p), y(p)];
      let d;
      if (x1 === x2) d = `M${x1} ${y1}V${y2}`;
      else if (k === 0) d = `M${x1} ${y1}V${y2 - R}C${x1} ${y2 - R / 2} ${x2} ${y2 - R / 2} ${x2} ${y2}`;
      else d = `M${x1} ${y1}C${x1} ${y1 + R / 2} ${x2} ${y1 + R / 2} ${x2} ${y1 + R}V${y2}`;
      paths += `<path d="${d}" style="stroke:${colorOf(k === 0 ? c : p)}"/>`;
    });
  });
  const nodes = list
    .map((c) => {
      const cls = c.kind === 'remove' ? 'ended' : c.kind === 'merge' && c.parents.length > 1 ? 'merge' : '';
      return `<circle class="node ${cls}" cx="${x(c)}" cy="${y(c)}" r="${cls === 'merge' ? 6 : 5}" style="--c:${colorOf(c)}"/>`;
    })
    .join('');
  const rows = list
    .map((c) => {
      const isOwn = c.taskId === taskId;
      const text = !isOwn ? 'main · 여기서 갈라짐' : c.kind === 'edit' ? c.message : KIND[c.kind].text;
      return `
        <button type="button" class="vc-row" data-history-commit="${c.id}" style="height:${R}px" title="히스토리에서 보기">
          <span class="vc-gutter" style="width:${W}px"></span>
          <span class="vc-text">
            <span class="vc-msg-text ${isOwn ? '' : 'muted'}">${esc(text)}</span>
            <span class="vc-meta">${fmtAgo(c.at)}</span>
          </span>
        </button>`;
    })
    .join('');

  return `
    <div class="mini-graph">
      <svg class="vc-svg" width="${W}" height="${list.length * R}" aria-hidden="true">${paths}${nodes}</svg>
      <div class="vc-rows">${rows}</div>
    </div>`;
}

export function render(el) {
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-commit],[data-more],[data-open-task]');
    if (!t) return;
    if (t.dataset.commit) {
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
        <p class="page-sub">할 일을 추가하면 main에서 브랜치가 갈라지고, 완료하면 main에 합쳐지며 브랜치가 사라져요.</p>
      </div>
    </header>

    <div class="stats">
      ${stat('purple', 'branch', s.open, '진행 중 브랜치')}
      ${stat('green', 'merge', s.merged, 'main에 합친 일')}
      ${stat('blue', 'clock', s.commits, '전체 기록')}
    </div>

    <div class="graph-layout">
      <section class="section graph-col">
        <div class="section-head">
          <h2 class="section-title">그래프</h2>
          <span class="legend"><span><i class="dot" style="background:${MAIN_COLOR}"></i>main</span><span><i class="dot" style="background:${BRANCH_COLORS[0]}"></i>할 일 브랜치</span></span>
        </div>
        <div class="inset vc-graph">${graphHtml(L, desc)}</div>
        ${desc.length > limit ? `<button type="button" class="btn more-btn" data-more="1">이전 기록 ${Math.min(PAGE, desc.length - limit)}개 더 보기</button>` : ''}
      </section>
      <aside class="section detail-col">
        <div class="section-head"><h2 class="section-title">선택한 기록</h2></div>
        ${detailHtml(L, L.repo.commits[selectedId])}
      </aside>
    </div>`;
}

// ---------- git 그래프 그리기 ----------
// 기록 하나가 한 줄(ROW). 브랜치마다 정해진 세로 칸(LANE)에 점을 찍고, 부모 기록과 선으로 잇습니다.
function graphHtml(L, desc) {
  const { repo, index, laneOf, maxLane } = L;
  const total = desc.length;
  const visible = desc.slice(0, limit);
  const width = PAD * 2 + maxLane * LANE;
  const rowOf = (c) => total - 1 - index.get(c.id);
  const x = (c) => PAD + (laneOf.get(c.branch) ?? 0) * LANE;
  const y = (c) => rowOf(c) * ROW + ROW / 2;

  let paths = '';
  visible.forEach((c) => {
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
      const cls = c.id === mainHead ? 'head' : c.kind === 'remove' ? 'ended' : c.kind === 'merge' && c.parents.length > 1 ? 'merge' : '';
      const r = cls === 'head' || cls === 'merge' ? 6.5 : 5;
      return `<circle class="node ${cls}" cx="${x(c)}" cy="${y(c)}" r="${r}" style="--c:${laneColor(laneOf.get(c.branch) ?? 0)}"/>`;
    })
    .join('');

  const rows = visible
    .map((c) => {
      const isBranchHead = c.branch !== vcs.MAIN && repo.branches[c.branch] === c.id;
      const pills = [
        c.id === mainHead ? `<span class="ref current" style="--c:${MAIN_COLOR}">${icon('branch')}main</span>` : '',
        isBranchHead ? `<span class="ref" style="--c:${laneColor(laneOf.get(c.branch))}">진행 중</span>` : '',
      ].join('');
      const action = c.kind === 'edit' ? c.message : KIND[c.kind].text;
      return `
        <button type="button" class="vc-row ${c.id === selectedId ? 'sel' : ''}" data-commit="${c.id}" style="height:${ROW}px;min-width:${width + 200}px">
          <span class="vc-gutter" style="width:${width}px"></span>
          <span class="vc-text">
            <span class="vc-msg">${pills}<span class="vc-msg-text">${esc(c.kind === 'init' ? '히스토리 시작' : c.label)}</span></span>
            <span class="vc-meta">${esc(action)} · ${fmtAgo(c.at)}</span>
          </span>
        </button>`;
    })
    .join('');

  return `
    <svg class="vc-svg" width="${width}" height="${visible.length * ROW}" aria-hidden="true">${paths}${nodes}</svg>
    <div class="vc-rows">${rows}</div>`;
}

// ---------- 선택한 기록의 자세한 내용 ----------
function fullTime(iso) {
  const d = new Date(iso);
  return `${fmtDate(isoToYmd(iso))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function detailHtml(L, c) {
  const { repo, laneOf } = L;
  const kind = KIND[c.kind];
  const color = laneColor(laneOf.get(c.branch) ?? 0);
  const task = c.taskId ? store.get('todo', c.taskId) : null;
  const inTrash = c.taskId && !task && store.trashList().some((t) => t.item.id === c.taskId);
  const branchOpen = c.branch !== vcs.MAIN && repo.branches[c.branch];

  let branchText = 'main 줄기';
  if (c.branch !== vcs.MAIN) {
    if (branchOpen) branchText = '진행 중';
    else {
      const merged = Object.values(repo.commits).some((m) => m.parents[1] && repo.commits[m.parents[1]]?.branch === c.branch);
      branchText = merged ? 'main에 합쳐짐' : '합치지 않고 종료됨';
    }
  }

  const kv = (label, value) => `<div class="cell"><span class="kv-label">${label}</span><span class="kv-value">${value}</span></div>`;
  const changes = (c.changes || []).map((ch) => kv(esc(ch.label), `${esc(ch.from)} <span class="muted">→</span> <strong>${esc(ch.to)}</strong>`)).join('');
  const timeline = c.taskId
    ? vcs
        .taskCommits(c.taskId)
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
    ${
      task
        ? `<button type="button" class="btn primary more-btn" data-open-task="${task.id}">${icon('check', 'sm')}할 일 열기</button>`
        : inTrash
          ? `<p class="muted small detail-note">이 할 일은 휴지통에 있어요.</p>`
          : c.taskId
            ? `<p class="muted small detail-note">이 할 일은 완전히 삭제됐어요.</p>`
            : ''
    }`;
}
