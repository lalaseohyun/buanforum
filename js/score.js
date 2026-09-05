/* ───────────────────────────────────────
   채점 규칙 — 순수 함수만 담는다. DOM·Firebase에 의존하지 않아
   `node tools/test-score.js`로 브라우저 없이 회귀 검증할 수 있다.

   고칠 때 ─ 이 파일이 유일하게 "점수를 어떻게 매기는가"를 정의한다.
             UI에서 아무리 다르게 보여도 순위 계산은 항상 여기를 거친다.
   규칙(정읍에서 검증됨) ─
     · scored:false 문항(연습문제)은 집계 제외
     · 최종 순위표는 "등록된 팀 전체"를 기준으로 한다(끝까지 한 번도 안 들어온 팀은
       0점으로 맨 아래에 깔린다) — "접속한 팀만 분모"는 진행 중 제출 현황
       카운터(예: 3/6팀 제출)에만 적용되는 별개 규칙이다. 혼동 주의.
     · 동점이면 정답까지 걸린 시간 합(ms)이 짧은 팀이 앞선다
     · 공동 순위 없음 — rank는 정렬된 배열의 인덱스+1
   ─────────────────────────────────────── */

/**
 * @param {Array} questions   전체 문항(연습 포함). 각 {id, scored, answerIndex}
 * @param {Object} answers    { [questionId]: { [teamNo]: {choice, ms} } }
 * @param {Array} teams       [{no, label, ...}] — 등록된 팀 전체
 * @returns {Array} rank 오름차순으로 정렬된 [{team, label, score, answered, ms, rank}]
 */
export function computeRanking(questions, answers, teams) {
  const scored = questions.filter(q => q.scored);
  const rows = teams.map(t => {
    let correct = 0, ms = 0, answered = 0;
    for (const q of scored) {
      const a = answers[q.id] && answers[q.id][t.no];
      if (!a) continue;
      answered++;
      if (a.choice === q.answerIndex) { correct++; ms += a.ms; }
    }
    return { team: t.no, label: t.label, score: correct, answered, ms };
  });
  rows.sort((a, b) => b.score - a.score || a.ms - b.ms);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** 참여한 팀 전원이 지금 문항에 답했는지. 참여 팀이 0이면 false(기다릴 필요는 없지만 "완료"로 보이면 안 됨). */
export function allAnswered(joinedTeamNos, answeredTeamNos) {
  if (!joinedTeamNos.length) return false;
  return joinedTeamNos.every(no => answeredTeamNos.includes(no));
}

/** 이 팀의 답이 정답인지. 답이 없으면 null. */
export function isCorrect(question, answer) {
  if (!answer) return null;
  return answer.choice === question.answerIndex;
}
