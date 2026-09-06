/* ───────────────────────────────────────
   2. 청년정책 퀴즈 — 참여자(모바일) 화면

   고칠 때 ─ 문항·정답 표시 방식      → 이 파일 + css/sessions/quiz.css
             문항 내용 자체           → content/02-quiz.json (호스트만 읽는다 — 여기선 안 씀)
   쓰는 것 ─ js/db.js(quiz/live 구독, 답 제출)

   시간 측정에 대한 참고 ─ 점수 동점자의 순위는 "정답까지 걸린 시간"으로 가른다.
   서버가 없어(Firestore만 사용) 진행자 기기와 참가자 기기의 시계가 서로 다를 수 있으므로,
   "호스트가 문제를 연 시각"이 아니라 "내 화면에 이 문제가 새로 뜬 시각"부터 재는
   방식을 쓴다 — 오직 이 기기 하나의 시계만 쓰기 때문에 기기 간 시계 오차 문제가 없다.
   (전파 지연만큼의 오차는 남지만 모든 팀에 비슷하게 적용되어 크게 불공정하지 않다.)
   ─────────────────────────────────────── */
import { watch, submitAnswer, path } from '../../db.js';
import { esc, sentences } from '../../util.js';

export default {
  id: 'quiz',
  mount(ctx) {
    let live = null;
    let myChoice = null;
    let pending = null;
    let lastQid = null;
    let openedAtLocal = null;

    function render() {
      if (!live || !live.item) {
        ctx.root.innerHTML = `<div class="center"><div class="pulse"></div><div class="sub">곧 시작합니다</div></div>`;
        return;
      }
      if (live.phase === 'final') { renderFinal(); return; }
      if (live.revealed) { renderReveal(); return; }
      renderQuestion();
    }

    function badges(it) {
      return `<div class="badges">
        ${it.scored ? `<span class="badge num">문제 ${it.order} / ${live.scoredTotal}</span>` : `<span class="badge num">연습문제</span>`}
      </div>`;
    }

    function renderQuestion() {
      const it = live.item;
      const choice = pending !== null ? pending : myChoice;
      const opts = it.choices.map((c, i) => `
        <button class="opt ${choice === i ? 'sel' : ''}" ${live.open ? '' : 'disabled'} data-i="${i}">
          <span class="n">${i + 1}</span><span class="t">${esc(c)}</span></button>`).join('');
      const st = !live.open
        ? `<div class="status">답변이 마감되었습니다${choice !== null ? ' · 제출 완료' : ''}</div>`
        : choice !== null
          ? `<div class="status ok">✓ ${choice + 1}번 제출 완료 · 마감 전까지 바꿀 수 있어요</div>`
          : `<div class="status">답을 골라주세요</div>`;
      ctx.root.innerHTML = `${badges(it)}
        <div style="text-align:center;font-size:13px;color:var(--ink3);font-weight:600;margin-bottom:8px">조당 대표 한 분만 눌러주세요</div>
        <div class="opts">${opts}</div>${st}`;
      ctx.root.querySelectorAll('.opt').forEach(btn => {
        btn.onclick = () => answer(Number(btn.dataset.i));
      });
    }

    async function answer(i) {
      if (!live.open) return;
      pending = i; render();
      const ms = Math.max(0, Date.now() - (openedAtLocal || Date.now()));
      try { await submitAnswer(live.item.id, ctx.team, i, ms); myChoice = i; }
      finally { pending = null; render(); }
    }

    function renderReveal() {
      const it = live.item, r = live.reveal;
      const my = myChoice;
      const ok = my !== null && my === r.answerIndex;
      const opts = it.choices.map((c, i) => {
        let cls = 'mute';
        if (i === r.answerIndex) cls = 'correct'; else if (i === my) cls = 'wrong';
        return `<button class="opt ${cls}" disabled><span class="n">${i + 1}</span><span class="t">${esc(c)}</span></button>`;
      }).join('');
      const mr = (r.ranking || []).find(x => x.team === ctx.team);
      ctx.root.innerHTML = `${badges(it)}
        <div class="verdict ${my === null ? '' : ok ? 'ok' : 'no'}">
          <div class="mk">${my === null ? '–' : ok ? 'O' : 'X'}</div>
          <div class="lb">${my === null ? '답을 제출하지 않았어요' : ok ? '정답입니다!' : '아쉬워요'}</div>
          <div class="an">정답 · ${esc(r.answerLabel)}</div>
        </div>
        <div class="opts">${opts}</div>
        <div class="card hl"><div class="lb">핵심 숫자</div><div class="v">${esc(r.highlight)}</div></div>
        <div class="card">${sentences(r.explanation)}<div class="src">출처 · ${esc(r.source)}</div></div>
        ${it.scored && mr ? `<div class="scorebar">
          <div class="sb"><div class="k">우리 조 점수</div><div class="v">${mr.score}</div></div>
          <div class="sb"><div class="k">현재 순위</div><div class="v">${mr.rank}위</div></div>
        </div>` : ''}`;
    }

    function renderFinal() {
      const mr = (live.ranking || []).find(x => x.team === ctx.team);
      if (!mr) { ctx.root.innerHTML = `<div class="center"><div class="pulse"></div><div class="sub">최종 순위 집계 중</div></div>`; return; }
      const medal = mr.rank === 1 ? '🥇' : mr.rank === 2 ? '🥈' : mr.rank === 3 ? '🥉' : '🎉';
      ctx.root.innerHTML = `<div class="center">
        <div class="medal">${medal}</div>
        <div class="sub">${esc(mr.label)}조 최종</div>
        <div class="rankbig">${mr.rank}위</div>
        <div class="big">${mr.score} / ${live.scoredTotal} 문제 정답</div>
      </div>`;
    }

    let unsubAnswer = null;
    function resubscribeAnswer(qid) {
      if (unsubAnswer) unsubAnswer();
      myChoice = null;
      // 새로고침해도 이미 낸 답이 사라지지 않도록, 이 문항의 답 문서에서 내 팀 번호 칸만 읽어온다.
      unsubAnswer = watch(path('quizAnswers', qid), snap => {
        const mine = snap && snap[String(ctx.team)];
        myChoice = mine ? mine.choice : null;
        render();
      });
    }

    const unsub = watch(path('quiz', 'live'), snap => {
      live = snap;
      if (live?.qid && live.qid !== lastQid) {
        lastQid = live.qid; openedAtLocal = Date.now();
        resubscribeAnswer(live.qid);
      }
      render();
    });

    return { unmount() { unsub && unsub(); unsubAnswer && unsubAnswer(); } };
  },
};
