/* ───────────────────────────────────────
   채점 규칙 회귀 검증 — `npm test` 또는 `node tools/test-score.js`.
   js/score.js가 규칙을 어기면(공동 순위가 생긴다든지) 여기서 바로 잡힌다.
   ─────────────────────────────────────── */
import { computeRanking, allAnswered, isCorrect } from '../js/score.js';

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}\n      기대: ${e}\n      실제: ${a}`); }
}

const teams = [1, 2, 3, 4, 5, 6].map(no => ({ no, label: String(no) }));

const questions = [
  { id: 'P0', scored: false, answerIndex: 0 },
  { id: 'Q1', scored: true, answerIndex: 1 },
  { id: 'Q2', scored: true, answerIndex: 0 },
];

console.log('1) 연습문제는 집계 제외');
{
  const answers = { P0: { 1: { choice: 1, ms: 100 } }, Q1: { 1: { choice: 1, ms: 500 } } };
  const rows = computeRanking(questions, answers, teams);
  check('연습문제(P0) 오답이어도 점수에 안 들어감', rows.find(r => r.team === 1).score, 1);
}

console.log('2) 최종 순위는 등록된 팀 전체를 기준으로 한다(미접속 팀도 0점으로 포함)');
{
  const answers = { Q1: { 1: { choice: 1, ms: 100 } } };
  const rows = computeRanking(questions, answers, teams);
  check('6팀 전체가 순위표에 나온다', rows.length, 6);
  check('한 번도 안 들어온 팀은 0점', rows.find(r => r.team === 6).score, 0);
}

console.log('3) 동점이면 정답까지 걸린 시간이 짧은 팀이 앞선다 + 공동순위 없음');
{
  const answers = {
    Q1: { 1: { choice: 1, ms: 900 }, 2: { choice: 1, ms: 300 } },
    Q2: { 1: { choice: 0, ms: 200 }, 2: { choice: 0, ms: 200 } },
  };
  const rows = computeRanking(questions, answers, teams);
  const r1 = rows.find(r => r.team === 1), r2 = rows.find(r => r.team === 2);
  check('두 팀 다 2점(동점)', [r1.score, r2.score], [2, 2]);
  check('시간 합이 짧은 팀(2번)이 앞선다', r2.rank < r1.rank, true);
  check('전체 6팀이 1~6위로 공동 순위 없이 갈린다', rows.map(r => r.rank), [1, 2, 3, 4, 5, 6]);
}

console.log('4) 답을 안 낸 팀은 0점');
{
  const rows = computeRanking(questions, {}, teams);
  check('무응답 팀 전원 0점', rows.every(r => r.score === 0), true);
}

console.log('5) allAnswered — 참여 팀 전원 제출 여부(진행 중 카운터가 이 함수를 쓴다)');
{
  check('참여 0팀이면 false', allAnswered([], []), false);
  check('참여 2팀 중 1팀만 제출 → false', allAnswered([1, 2], [1]), false);
  check('참여 2팀 전원 제출 → true', allAnswered([1, 2], [2, 1]), true);
}

console.log('6) isCorrect — 정답 판정');
{
  const q = { answerIndex: 2 };
  check('답 없음 → null', isCorrect(q, null), null);
  check('정답', isCorrect(q, { choice: 2 }), true);
  check('오답', isCorrect(q, { choice: 0 }), false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
