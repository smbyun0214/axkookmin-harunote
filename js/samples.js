// =========================================================
// 샘플 할 일 100개 — 앱을 처음 열 때 자동으로 한 번 만들어집니다.
// 최근 약 6주 동안 할 일을 추가하고, 고치고, 완료한 것처럼 기록도 함께 만들어
// 히스토리 그래프에서 main과 브랜치가 갈라지고 합쳐지는 모습을 볼 수 있습니다.
//  · 약 90개: 완료 (브랜치가 main에 합쳐짐)
//  · 6개: 진행 중 (브랜치가 열려 있음)
//  · 4개: 휴지통 (브랜치가 합쳐지지 않고 끝남)
// 샘플에는 sample: true 표시가 있습니다.
// =========================================================
import * as store from './store.js';
import * as vcs from './vcs.js';
import { ymd } from './dates.js';

export const SAMPLE_COUNT = 100;
const SEED_VERSION = 4; // 샘플 구조가 바뀌면 숫자를 올려 다시 만들게 합니다
const OPEN_COUNT = 6; // 진행 중으로 남길 샘플 수
const REMOVED_COUNT = 4; // 휴지통에 넣을 샘플 수

// 주제 10개 × 할 일 10개 = 100개
const TOPICS = [
  ['지원동기 초안 쓰기', '성장 과정 문단 다듬기', '협업 경험 정리하기', '실패 경험 문단 쓰기', '입사 후 포부 정리', '직무 역량 키워드 뽑기', '자소서 맞춤법 검사', '자소서 피드백 요청', '자소서 글자 수 맞추기', '자소서 최종 제출'],
  ['1분 자기소개 연습', '예상 질문 20개 정리', '모의면접 참여', '역질문 3개 준비', '프로젝트 설명 스크립트 쓰기', '면접 복장 준비', '면접 장소 경로 확인', '압박 질문 답변 연습', '면접 후기 정리', '면접 감사 메일 보내기'],
  ['HTML 기초 강의 듣기', 'CSS 레이아웃 실습', 'JavaScript 함수 복습', '배열 메서드 정리', '이벤트 처리 예제 만들기', 'Git 명령어 연습', '브라우저 저장소 실습', '디버깅 방법 정리', 'API 개념 정리', '주간 복습 노트 쓰기'],
  ['기능 목록 정리', '화면 스케치 그리기', '사용자 시나리오 쓰기', 'MVP 범위 정하기', '데이터 구조 설계', '버그 3개 고치기', '디자인 개선하기', '사용자 테스트 진행', '발표 자료 만들기', 'README 작성'],
  ['주간 회고 쓰기', '팀 회고 진행', '한 달 돌아보기', '목표 다시 세우기', '잘한 점 3가지 적기', '개선할 점 정리', '다음 주 계획 세우기', '감사 메모 쓰기', '시간 기록 분석', '회고 공유하기'],
  ['멘토링 질문 정리', '커피챗 신청', '현직자 조언 정리', '밋업 참여', '링크드인 프로필 수정', '추천서 부탁 메일 쓰기', '동기 연락처 정리', '스터디 모임 만들기', '세미나 신청', '멘토께 감사 인사'],
  ['오리엔테이션 자료 읽기', '1주차 과제 제출', '2주차 과제 제출', '팀 회의록 정리', '발표 리허설', '데모데이 준비', '수료 요건 확인', '강의 질문 목록 정리', '출석 확인', '수료 후 계획 세우기'],
  ['장보기', '운동 30분', '방 청소', '병원 예약', '택배 반품 접수', '공과금 납부', '책상 정리', '빨래하기', '부모님께 전화', '일찍 자기'],
  ['읽을 책 고르기', '책 1장 읽기', '인상 깊은 문장 정리', '독서 노트 쓰기', '한 줄 서평 쓰기', '독서 모임 참여', '책 2장 읽기', '실천할 것 하나 정하기', '도서관 책 반납', '다음 책 예약'],
  ['포트폴리오 목차 짜기', '프로젝트 사진 정리', '프로젝트 설명 쓰기', '깃허브 정리', '포트폴리오 사이트 만들기', '이력서 업데이트', '경력 기술서 쓰기', '포트폴리오 피드백 받기', '포트폴리오 PDF 내보내기', '지원 회사 목록 정리'],
];

const PRIORITY_NEXT = { mid: 'high', high: 'mid', low: 'mid' };

// 추가 내용(체크리스트·메모·리스트) 샘플
const STEPS = [
  ['자료 찾아보기', '초안 만들기', '다시 읽고 다듬기'],
  ['할 일 쪼개기', '30분 집중해서 하기', '결과 정리하기'],
  ['준비물 챙기기', '실행하기', '느낀 점 적기'],
  ['예시 3개 찾기', '내 방식으로 써 보기', '피드백 받기'],
];
const NOTES = ['이번 주 안에 끝내기', '막히면 멘토에게 질문하기', '오전에 집중해서 하기', '완료 기준: 남에게 설명할 수 있을 정도'];
const LISTS = [['노트북', '충전기', '메모장'], ['참고 링크 정리', '관련 강의 2강'], ['질문 1: 팀 문화', '질문 2: 성장 지원']];

// 처음 열 때(또는 샘플 구조가 바뀌었을 때) 한 번만 실행됩니다.
export function seedIfNeeded() {
  const data = store.raw();
  data.meta = data.meta || {};
  if (data.meta.seeded >= SEED_VERSION) return false;

  // 예전 버전에서 만든 샘플(메모·할 일)과 메모별 버전 기록은 정리합니다. (직접 쓴 것은 남김)
  data.memos = data.memos.filter((m) => !m.sample);
  data.memos.forEach((m) => delete m.vc);
  data.todos = data.todos.filter((t) => !t.sample);
  data.trash = data.trash.filter((t) => !t.item.sample);

  const { todos, trash, events } = makeSamples();
  data.todos.push(...todos);
  data.trash.push(...trash);

  // 이미 있던 할 일 + 샘플 할 일로 히스토리를 처음부터 다시 만듭니다.
  const existing = vcs.eventsFromTodos(
    data.todos.filter((t) => !t.sample),
    data.trash.filter((t) => !t.item.sample)
  );
  data.repo = vcs.replay([...existing, ...events]);
  data.meta.seeded = SEED_VERSION;
  store.save();
  return true;
}

function makeSamples() {
  const now = Date.now();
  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const iso = (t) => new Date(t).toISOString();
  const rand = Math.random;
  const todos = [];
  const trash = [];
  const events = [];

  // 어떤 샘플을 진행 중·휴지통으로 둘지 무작위로 고릅니다.
  const order = [...Array(SAMPLE_COUNT).keys()].sort(() => rand() - 0.5);
  const openSet = new Set(order.slice(0, OPEN_COUNT));
  const removedSet = new Set(order.slice(OPEN_COUNT, OPEN_COUNT + REMOVED_COUNT));
  let doneIndex = 0;
  const doneTotal = SAMPLE_COUNT - OPEN_COUNT - REMOVED_COUNT;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const title = TOPICS[i % TOPICS.length][Math.floor(i / TOPICS.length)];
    const status = openSet.has(i) ? 'open' : removedSet.has(i) ? 'removed' : 'done';

    // 완료된 일은 최근 6주에 고르게 흩어 추가, 진행 중·삭제된 일은 최근 5일 안에 추가된 것으로
    const created =
      status === 'done'
        ? now - (1.5 + (40 * (doneTotal - doneIndex++)) / doneTotal + rand() * 0.4) * DAY
        : now - (0.3 + rand() * 4.5) * DAY;
    const life = (0.1 + rand() * 1.8) * DAY; // 추가 → 완료(또는 삭제)까지 걸린 시간
    const endAt = Math.min(now - HOUR, created + life);
    const priority = rand() < 0.2 ? 'high' : rand() < 0.2 ? 'low' : 'mid';
    let due = ymd(new Date(created + (1 + Math.floor(rand() * 6)) * DAY));

    const todo = {
      id: store.uid(),
      title,
      due,
      priority,
      repeat: 'none',
      remind: false,
      done: false,
      doneAt: null,
      links: [],
      sample: true,
      createdAt: iso(created),
      updatedAt: iso(created),
    };
    // 진행 중인 일은 모두, 나머지는 일부만 추가 내용을 붙입니다.
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    if (status === 'open' || rand() < 0.3) todo.checklist = pick(STEPS).map((text) => ({ text, done: false }));
    if (status === 'open' ? rand() < 0.6 : rand() < 0.2) todo.note = pick(NOTES);
    if (rand() < 0.15) todo.list = [...pick(LISTS)];
    events.push({ at: todo.createdAt, type: 'create', todo });

    // 약 40%는 중간에 마감일이나 우선순위를 고친 기록이 있습니다.
    const lastAt = status === 'open' ? now - HOUR : endAt;
    const edits = rand() < 0.4 ? 1 + Math.floor(rand() * 2) : 0;
    for (let e = 0; e < edits; e++) {
      const at = created + ((lastAt - created) * (e + 1)) / (edits + 1);
      const before = { ...todo };
      if (e === 0 && rand() < 0.65) {
        due = ymd(new Date(new Date(`${due}T12:00:00`).getTime() + (1 + Math.floor(rand() * 3)) * DAY));
        todo.due = due;
      } else {
        todo.priority = PRIORITY_NEXT[todo.priority];
      }
      events.push({ at: iso(at), type: 'edit', todo, changes: vcs.diffTodo(before, todo) });
      todo.updatedAt = iso(at);
    }

    // 체크리스트가 있으면 진행한 만큼 체크한 기록을 남깁니다. (완료한 일은 모두 체크)
    if (todo.checklist) {
      const target = status === 'done' ? todo.checklist.length : Math.floor(rand() * todo.checklist.length);
      if (target > 0) {
        const before = { ...todo, checklist: todo.checklist.map((c) => ({ ...c })) };
        todo.checklist = todo.checklist.map((c, k) => ({ ...c, done: k < target }));
        const at = created + (lastAt - created) * 0.9;
        events.push({ at: iso(at), type: 'edit', todo, changes: vcs.diffTodo(before, todo) });
      }
    }

    if (status === 'done') {
      todo.done = true;
      todo.doneAt = iso(endAt);
      todo.updatedAt = todo.doneAt;
      events.push({ at: todo.doneAt, type: 'done', todo });
      todos.push(todo);
    } else if (status === 'removed') {
      events.push({ at: iso(endAt), type: 'remove', todo });
      trash.push({ type: 'todo', item: todo, deletedAt: iso(endAt) });
    } else {
      todos.push(todo);
    }
  }
  return { todos, trash, events };
}
