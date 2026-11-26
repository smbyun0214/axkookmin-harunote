// =========================================================
// 예약 알림 (E-2)
// 앱이 열려 있는 동안 30초마다 알림 보낼 일정·할 일이 있는지 확인합니다.
// ⚠️ 한계: 브라우저 탭을 닫으면 알림이 오지 않습니다.
// =========================================================
import * as store from './store.js';
import { eventsOn, todayYmd, addDays, parseYmd, fmtTime, relativeDay } from './dates.js';
import { toast } from './ui.js';

const FIRED_KEY = 'harunote-fired-v1'; // 이미 보낸 알림 기록 (같은 알림을 두 번 보내지 않으려고)
const CHECK_EVERY = 30 * 1000; // 30초마다 확인
const LATE_LIMIT = 10 * 60 * 1000; // 알림 시각이 10분 넘게 지났으면 보내지 않음
export const TODO_REMIND_TIME = '09:00'; // 할 일 알림 시각

// [저장값, 화면에 보이는 글자] — 순서대로 선택 목록에 나옵니다
export const REMIND_OPTIONS = [
  ['', '알림 없음'],
  ['0', '시작할 때'],
  ['10', '10분 전'],
  ['30', '30분 전'],
  ['60', '1시간 전'],
  ['1440', '하루 전'],
];

export function supported() {
  return 'Notification' in window;
}

export function permission() {
  return supported() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!supported()) {
    toast('이 브라우저는 알림을 지원하지 않아요');
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  toast(result === 'granted' ? '알림을 켰어요' : '알림이 허용되지 않아 앱 안에서만 알려 드려요');
  return result;
}

// 알림을 설정했는데 아직 권한을 묻지 않았다면 물어봅니다.
export function askIfNeeded() {
  if (permission() === 'default') requestPermission();
}

function loadFired() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveFired(set) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-300)));
  } catch {
    /* 저장 실패는 무시 */
  }
}

function fire(title, body) {
  if (permission() === 'granted') {
    try {
      new Notification(title, { body });
      return;
    } catch {
      /* 알림 실패 시 아래 토스트로 대신 알림 */
    }
  }
  toast(`🔔 ${title} · ${body}`);
}

function timeOf(day, hhmm) {
  const d = parseYmd(day);
  const [h, m] = (hhmm || TODO_REMIND_TIME).split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function check() {
  const now = Date.now();
  const fired = loadFired();
  const today = todayYmd();
  let changed = false;

  const tryFire = (key, when, title, body) => {
    if (now >= when && now - when < LATE_LIMIT && !fired.has(key)) {
      fired.add(key);
      changed = true;
      fire(title, body);
    }
  };

  // 일정: 오늘·내일 일정 중 알림 시각이 된 것 ('하루 전' 알림 때문에 내일도 확인)
  for (const day of [today, addDays(today, 1)]) {
    for (const ev of eventsOn(store.list('event'), day)) {
      if (ev.remind === '' || ev.remind == null) continue;
      const when = timeOf(day, ev.startTime) - Number(ev.remind) * 60000;
      tryFire(`event|${ev.id}|${day}`, when, `📅 ${ev.title}`, `${relativeDay(day)} ${fmtTime(ev.startTime)} 일정이에요`);
    }
  }

  // 할 일: 마감일 오전 9시
  for (const t of store.list('todo')) {
    if (!t.remind || t.done || !t.due) continue;
    tryFire(`todo|${t.id}|${t.due}`, timeOf(t.due, TODO_REMIND_TIME), `✅ ${t.title}`, `${relativeDay(t.due)} 마감인 할 일이에요`);
  }

  if (changed) saveFired(fired);
}

export function start() {
  check();
  setInterval(check, CHECK_EVERY);
}
