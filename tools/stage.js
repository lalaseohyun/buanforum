/* ───────────────────────────────────────
   레이아웃 점검용 — 진행자 화면(host.html?k=...)을 열어둔 채 브라우저 개발자
   도구 콘솔에 아래 함수를 붙여넣고 실행하면, 실제로 문제를 누르지 않고도
   각 문항의 "정답 공개" 상태를 강제로 만들 수 있다. Firebase 프로젝트가
   연결되어 있어야 동작한다(로컬에서 firebaseConfig가 REPLACE_ME인 동안은 못 씀).

   쓰는 법 ─
   1. host.html?k=<진행자키> 를 열고 개발자 도구 콘솔을 연다
   2. 이 파일 내용 전체를 콘솔에 붙여넣는다(한 번만)
   3. stageQuestion(0)  ← 연습문제(P0)를 정답 공개 상태로
      stageQuestion(1, {chart:true})  ← Q1을 정답 공개 + 데이터 화면까지
      stageFinal()        ← 최종 순위 화면
   4. 해설 카드(.why)가 잘리는지 확인:
      document.querySelector('.why') &&
      (document.querySelector('.why').scrollHeight - document.querySelector('.why').clientHeight)
      → 0보다 크면 넘친다는 뜻 (정상이라면 js/util.js의 fitInto()가 알아서 글자를 줄인다)
   ─────────────────────────────────────── */

async function stageQuestion(index, opts = {}) {
  const { hostSet, path } = await import('./js/db.js');
  const { loadQuiz } = await import('./js/content.js');
  const data = await loadQuiz();
  const ITEMS = [data.practice, ...data.questions];
  const it = ITEMS[index];
  if (!it) return console.error('문항 없음:', index);
  await hostSet(path('quiz', 'state'), {
    phase: 'quiz', index, open: false, revealed: true, showChart: !!opts.chart,
  });
  await hostSet(path('quiz', 'live'), {
    phase: 'quiz', index, open: false, revealed: true,
    item: { id: it.id, question: it.question, type: it.type, choices: it.type === 'ox' ? ['O', 'X'] : it.choices, scored: it.scored },
    reveal: {
      answerIndex: it.answerIndex, answerLabel: it.answerLabel, highlight: it.highlight,
      explanation: it.explanation, source: it.source, chart: opts.chart ? it.chart : null,
    },
  });
  console.log('스테이징 완료 →', it.id, opts.chart ? '(차트 포함)' : '');
}

async function stageFinal() {
  const { hostSet, path } = await import('./js/db.js');
  await hostSet(path('quiz', 'state'), { phase: 'final' });
  await hostSet(path('quiz', 'live'), { phase: 'final' });
  console.log('최종 순위 화면으로 전환');
}

console.log('stage.js 로드됨 — stageQuestion(index, {chart:true}) / stageFinal() 사용 가능');
