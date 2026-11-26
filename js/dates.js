// =========================================================
// 날짜 계산 도우미
// 날짜는 모두 'YYYY-MM-DD' 글자 형태(예: '2026-12-03')로 다룹니다.
// =========================================================

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const REPEAT_LABEL = { none: '반복 안 함', daily: '매일', weekly: '매주', monthly: '매월' };

export const pad = (n) => String(n).padStart(2, '0');

export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayYmd() {
  return ymd(new Date());
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoToYmd(iso) {
  return ymd(new Date(iso));
}

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function addMonths(s, n) {
  const d = parseYmd(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return ymd(d);
}

export function weekday(s) {
  return parseYmd(s).getDay();
}

export function weekStart(s) {
  return addDays(s, -weekday(s)); // 일요일부터 시작
}

// 화면 표시용: '12월 3일 (목)'
export function fmtDate(s, { year = false } = {}) {
  const d = parseYmd(s);
  return `${year ? d.getFullYear() + '년 ' : ''}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
}

export function fmtShort(s) {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function weekdayName(s) {
  return WEEK[weekday(s)];
}

// '14:30' → '오후 2:30'
export function fmtTime(hhmm) {
  if (!hhmm) return '종일';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hh}:${pad(m)}`;
}

// 오늘 기준으로 '오늘', '내일', '어제' 또는 '12/3'
export function relativeDay(s) {
  const diff = Math.round((parseYmd(s) - parseYmd(todayYmd())) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === -1) return '어제';
  return fmtShort(s);
}

// 저장 시각 표시: '방금', '5분 전', '3시간 전', '11/26 14:30'
export function fmtAgo(iso) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (isoToYmd(iso) === todayYmd()) return `${Math.floor(sec / 3600)}시간 전`;
  const d = new Date(iso);
  return `${fmtShort(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 오늘이면 '14:30', 아니면 '11/26' (메모 목록용)
export function fmtStamp(iso) {
  const d = new Date(iso);
  return isoToYmd(iso) === todayYmd() ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtShort(ymd(d));
}

// ---------- 반복 (E-3) ----------
// 일정은 1건만 저장하고, 화면에 그릴 때 "이 날짜에 해당하는지" 계산합니다.
export function occursOn(ev, day) {
  if (day < ev.date) return false;
  switch (ev.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return weekday(day) === weekday(ev.date);
    case 'monthly':
      return parseYmd(day).getDate() === parseYmd(ev.date).getDate();
    default:
      return day === ev.date;
  }
}

export function eventsOn(events, day) {
  return events
    .filter((ev) => occursOn(ev, day))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

export function nextDate(day, repeat) {
  if (repeat === 'daily') return addDays(day, 1);
  if (repeat === 'weekly') return addDays(day, 7);
  if (repeat === 'monthly') return addMonths(day, 1);
  return null;
}

// ---------- 문장 속 날짜·시간 찾기 ----------
// 규칙으로 찾습니다(AI 아님). 예: '12/3', '12월 3일', '내일', '오후 3시', '14:30'
export function parseDateText(text) {
  const today = todayYmd();
  let date = null;
  let time = null;

  if (/모레/.test(text)) date = addDays(today, 2);
  else if (/내일/.test(text)) date = addDays(today, 1);
  else if (/오늘/.test(text)) date = today;

  const md = text.match(/(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})\s*일?/);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      let candidate = ymd(new Date(year, month - 1, day));
      // 한 달 넘게 지난 날짜라면 내년으로 봅니다. (예: 11월에 '1/5'라고 쓰면 내년 1월 5일)
      if (candidate < addDays(today, -30)) candidate = ymd(new Date(year + 1, month - 1, day));
      date = candidate;
    }
  }

  const clock = text.match(/(\d{1,2}):(\d{2})/);
  const korean = text.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|(반))?/);
  if (clock) {
    time = `${pad(Number(clock[1]))}:${clock[2]}`;
  } else if (korean) {
    let h = Number(korean[2]);
    const min = korean[4] ? 30 : korean[3] ? Number(korean[3]) : 0;
    if (korean[1] === '오후' && h < 12) h += 12;
    if (korean[1] === '오전' && h === 12) h = 0;
    if (!korean[1] && h >= 1 && h <= 7) h += 12; // '3시'처럼 오전/오후가 없으면 1~7시는 오후로 봅니다
    if (h < 24 && min < 60) time = `${pad(h)}:${pad(min)}`;
  }

  return { date, time };
}
