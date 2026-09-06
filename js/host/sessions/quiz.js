/* ───────────────────────────────────────
   2. 청년정책 퀴즈 — 진행자 화면

   고칠 때 ─ 문항·정답·해설·그래프 데이터   → content/02-quiz.json
             팀 수·팀 이름                  → content/forum.json
             화면 색·글자 크기               → css/sessions/quiz.css
             정답 뒤 그래프를 그리는 방식     → ./chart.js
             진행 흐름·버튼(이 파일)         → 아래
   쓰는 것 ─ js/db.js(Firestore) · js/score.js(채점, 규칙은 여기서 절대 다시 안 만든다)

   정읍 프로젝트에서 검증된 규칙을 그대로 따른다 ─
     · 문항 선택 = 즉시 출제(타이머 없음) · 「정답 공개」를 누르는 순간 마감
     · 제출 현황의 분모는 "실제 접속한 팀"만(미접속 팀은 기다리지 않음)
     · 접속 표시는 "한 번이라도 들어온 적 있음" 기준
     · 최종 순위는 공동 순위 없이 1~N위로 전부 갈린다 (js/score.js)
   정읍과 다른 점 ─
     · 정답(quiz/live의 reveal)은 「정답 공개」를 누르는 순간에만 써진다.
       팀 화면은 그 전까지 정답을 알 방법이 없다(개발자도구로도 못 봄).
     · 보기 개수가 문항마다 다르다(OX 2개 / 4지선다 4개) → --n으로 그리드 조정
     · ⭐ 문항은 정답 공개 뒤 「데이터 보기」 단계가 하나 더 있다(해설이 데이터 아래 붙는다)
     · 문항이 열려 있는 동안(정답 공개 전)에는 문제 → 보기 → 제출현황 순으로
       화살표를 누를 때마다 한 단계씩 더 보여준다(stage 0/1/2). Firestore에는
       안 남기는 진행자 화면만의 연출이라 팀 화면과는 무관하다.
   ─────────────────────────────────────── */
import { esc, nl2br, sentences, fitInto } from '../../util.js';
import { loadQuiz } from '../../content.js';
import { watch, watchCollection, hostSet, hostReset, path } from '../../db.js';
import { computeRanking, allAnswered } from '../../score.js';
import { renderChart } from './chart.js';

export default {
  id: 'quiz',
  title: '청년정책 퀴즈',
  mount(ctx) {
    const teams = ctx.forum.teams; // [{no,label,name}]
    let data = null, ITEMS = [];
    let state = { phase: 'lobby', index: -1, open: false, revealed: false, showChart: false, openedAt: null, asked: {} };
    let teamsMap = {};    // { [no]: {joinedAt} }
    let answersAll = {};  // { [qid]: { [no]: {choice, ms} } }
    let stage = 0;        // 0=문제만 1=+보기 2=+제출현황 — 진행자 화면 전용, Firestore에 안 남긴다
    const unsubs = [];

    const choicesFor = it => it.type === 'ox' ? ['O', 'X'] : it.choices;
    // "약 9,400명 — 100명 중 20명"처럼 " — "가 있으면 핵심 숫자(main)와 부연(sub)을 나눠
    // sub를 작고 노란 글자로 강조한다. 구분자가 없는 보기(OX, 짧은 보기)는 그대로 한 줄.
    const choiceHtml = c => {
      const i = c.indexOf(' — ');
      if (i === -1) return esc(c);
      return `${esc(c.slice(0, i))}<br><span class="sub">${esc(c.slice(i + 3))}</span>`;
    };
    const orderOf = it => it.scored ? ITEMS.filter(q => q.scored).indexOf(it) + 1 : 0;
    const joinedNos = () => Object.entries(teamsMap).filter(([, v]) => v && v.joinedAt).map(([k]) => Number(k));
    const currentItem = () => (state.index >= 0 && state.index < ITEMS.length ? ITEMS[state.index] : null);
    const answersForCurrent = () => { const it = currentItem(); return it ? (answersAll[it.id] || {}) : {}; };
    const answeredNos = () => Object.keys(answersForCurrent()).map(Number);

    /* ---- 쓰기 ---- */
    function writeState(patch) {
      state = { ...state, ...patch };
      hostSet(path('quiz', 'state'), state);
      writeLive();
    }
    function writeLive() {
      const it = currentItem();
      const reveal = state.revealed && it ? {
        answerIndex: it.answerIndex, answerLabel: it.answerLabel,
        highlight: it.highlight, explanation: it.explanation, source: it.source,
        chart: state.showChart ? (it.chart || null) : null,
      } : null;
      hostSet(path('quiz', 'live'), {
        phase: state.phase, index: state.index, open: state.open, revealed: state.revealed,
        scoredTotal: ITEMS.filter(i => i.scored).length,
        qid: it ? it.id : null, // 팀 화면이 "새 문항이 열렸다"를 감지하는 키
        item: it ? {
          id: it.id, question: it.question, type: it.type, choices: choicesFor(it),
          scored: it.scored, order: orderOf(it), note: it.note || null,
        } : null,
        reveal,
        ranking: (state.revealed || state.phase === 'final') ? computeRanking(ITEMS, answersAll, teams) : null,
      });
    }

    /* ---- 진행 액션 ---- */
    function selectIndex(i) {
      i = Math.max(0, Math.min(ITEMS.length - 1, i));
      const it = ITEMS[i];
      stage = 0;
      writeState({
        phase: 'quiz', index: i, open: true, revealed: false, showChart: false,
        openedAt: Date.now(), asked: { ...state.asked, [it.id]: true },
      });
    }
    const reveal = () => writeState({ open: false, revealed: true });
    const showChart = () => writeState({ showChart: true });
    const goFinal = () => { stage = 0; writeState({ phase: 'final', open: false, revealed: false, showChart: false }); };
    const toLobby = () => { stage = 0; writeState({ phase: 'lobby', open: false, revealed: false, showChart: false }); };

    // 문항이 열려 있는 동안(정답 공개 전)에는 화살표가 문제→보기→제출현황 단계부터 채운 뒤,
    // 다 채워진 다음에야 실제로 다른 문항으로 넘어간다.
    function stepForward() {
      const it = currentItem();
      if (state.phase === 'quiz' && it && !state.revealed && stage < 2) { stage++; render(); }
      else selectIndex(state.index + 1);
    }
    function stepBack() {
      const it = currentItem();
      if (state.phase === 'quiz' && it && !state.revealed && stage > 0) { stage--; render(); }
      else selectIndex(state.index - 1);
    }

    function resetQuestion() {
      const it = currentItem();
      if (!it) return;
      if (!confirm('이 문제의 팀 답변을 모두 지웁니다. 진행할까요?')) return;
      hostReset(path('quizAnswers', it.id), {});
      stage = 0;
      writeState({ revealed: false, open: false, showChart: false });
    }
    function resetAll() {
      if (!confirm('답변·점수·접속한 팀까지 모두 지웁니다. 정말 초기화할까요?')) return;
      ITEMS.forEach(it => hostReset(path('quizAnswers', it.id), {}));
      teams.forEach(t => hostReset(path('teams', String(t.no)), {}));
      stage = 0;
      writeState({ phase: 'lobby', index: -1, open: false, revealed: false, showChart: false, asked: {} });
    }

    /* ---- 렌더 ---- */
    function render() {
      if (!data) { ctx.root.innerHTML = `<div class="slide"><h2>불러오는 중…</h2></div>`; return; }
      const it = currentItem();
      if (state.phase === 'lobby' || state.index < 0) { ctx.root.innerHTML = viewLobby(); wireLobby(); }
      else if (state.phase === 'final') ctx.root.innerHTML = viewFinal();
      else if (state.revealed && state.showChart && it?.chart) ctx.root.innerHTML = viewChart(it);
      else if (state.revealed) ctx.root.innerHTML = viewReveal(it);
      else ctx.root.innerHTML = viewQuestion(it);
      fitInto('.why');
      ctx.setControls(controlsFor());
    }

    function chip(t, cls, mark) {
      const mk = mark === 'check' ? `<span class="mk">✓</span>`
        : mark === 'O' ? `<span class="mk">O</span>`
        : mark === 'X' ? `<span class="mk x">X</span>`
        : mark === '–' ? `<span class="mk none">–</span>` : '';
      return `<div class="chip ${cls}">${esc(t.label)}${mk}</div>`;
    }
    function badges(it) {
      return `<div class="badges">
        ${it.scored ? `<span class="badge num">문제 ${orderOf(it)} / ${ITEMS.filter(q => q.scored).length}</span>` : `<span class="badge num">연습문제</span>`}
        ${it.theme ? `<span class="badge">${esc(it.theme)}</span>` : ''}
      </div>`;
    }

    function viewLobby() {
      const joined = joinedNos();
      const chips = teams.map(t => chip(t, joined.includes(t.no) ? 'on' : '', null)).join('');
      const joinUrl = location.href.replace(/host\.html.*$/, '');
      return `<div class="lobby">
        <div class="qrbox"><div id="qrHolder"></div></div>
        <div>
          <h2>휴대폰으로 <span>QR</span>을 찍고<br>우리 조 번호를 눌러주세요</h2>
          <div class="lsub">조당 한 분만 접속하시면 됩니다</div>
          <div class="lsub">접속한 조 <b>${joined.length}</b> / ${teams.length}</div>
          <div class="chips">${chips}</div>
        </div>
      </div>`;
    }
    function wireLobby() {
      const holder = document.getElementById('qrHolder');
      if (holder && window.QRCode) {
        holder.innerHTML = '';
        new QRCode(holder, { text: location.href.replace(/host\.html.*$/, ''), width: 300, height: 300, colorDark: '#2c2c2a', colorLight: '#ffffff' });
      }
    }

    function viewQuestion(it) {
      const n = it.type === 'ox' ? 2 : it.choices.length;
      const chArr = choicesFor(it);
      const ch = chArr.map((c, i) => `<div class="ch"><div class="n">${i + 1}</div><div class="t">${choiceHtml(c)}</div></div>`).join('');
      const ansForItem = answersForCurrent();
      const chips = teams.map(t => {
        const a = t.no in ansForItem;
        return chip(t, a ? 'done' : joinedNos().includes(t.no) ? 'on' : '', a ? 'check' : null);
      }).join('');
      const cnt = answeredNos().length;
      const stat = cnt === 0 ? `<div class="tstat">답변을 기다리는 중</div>`
        : cnt === teams.length ? `<div class="tstat done">전체 제출 완료!</div>`
        : `<div class="tstat"><b>${cnt}</b>조 제출 완료${state.open ? '' : ' · 마감됨'}</div>`;
      // 문제 → (화살표) 보기 → (화살표) 제출현황, 세 단계로 나눠 보여준다
      let body = `${badges(it)}<div class="q">${nl2br(it.question)}</div>`;
      if (stage >= 1) body += `<div class="choices" style="--n:${n}">${ch}</div>`;
      if (stage >= 2) body += `<div class="foot"><div class="tmeta">${stat}</div><div class="chips">${chips}</div></div>`;
      return `<div class="qview ${stage < 2 ? 'centered' : ''}">${body}</div>`;
    }

    function viewReveal(it) {
      const chArr = choicesFor(it);
      const n = it.type === 'ox' ? 2 : chArr.length;
      const ansForItem = answersForCurrent();
      const total = Math.max(1, Object.keys(ansForItem).length);
      const tally = chArr.map((_, i) => Object.values(ansForItem).filter(a => a.choice === i).length);
      const ch = chArr.map((c, i) => {
        const ok = i === it.answerIndex;
        return `<div class="ch ${ok ? 'correct' : 'dimmed'}"><div class="n">${i + 1}</div><div class="t">${choiceHtml(c)}</div>
          <div class="tally">${tally[i]}조 · ${Math.round(tally[i] / total * 100)}%</div>
          ${ok ? `<div class="hl-inline">${esc(it.highlight)}</div>` : ''}</div>`;
      }).join('');
      const chips = teams.map(t => {
        const a = ansForItem[t.no];
        if (!a) return chip(t, '', '–');
        return chip(t, a.choice === it.answerIndex ? 'done' : 'wrong', a.choice === it.answerIndex ? 'O' : 'X');
      }).join('');
      const okCount = Object.values(ansForItem).filter(a => a.choice === it.answerIndex).length;
      return `${badges(it)}
        <div class="rbottom">
          <div class="rleft">
            <div class="choices compact" style="--n:${n}">${ch}</div>
            <div class="rtitle">조별 결과 · 정답 ${okCount}조</div>
            <div class="chips">${chips}</div>
          </div>
          <div class="rright">
            <div class="why">${sentences(it.explanation)}<div class="src">출처 · ${esc(it.source)}</div></div>
          </div>
        </div>`;
    }

    function viewChart(it) {
      // 데이터 해설은 그래프 "위"에 붙는다. chart.note가 따로 있으면 그걸(데이터 전용 해설),
      // 없으면 정답 화면과 같은 explanation을 그대로 재사용한다.
      const chart = { ...it.chart, note: it.chart.note || it.explanation };
      return `${badges(it)}${renderChart(chart)}`;
    }

    function viewFinal() {
      const rows = computeRanking(ITEMS, answersAll, teams);
      const scoredTotal = ITEMS.filter(i => i.scored).length;
      const rowsHtml = rows.map(r => `
        <div class="row ${r.rank <= 3 ? 'p' + r.rank : ''}">
          <div class="r">${r.rank}위</div><div class="tm">${esc(r.label)}</div>
          <div class="sc">${r.score}<small> / ${scoredTotal}</small></div>
        </div>`).join('');
      return `<div class="badges"><span class="badge num">최종 순위</span><span class="badge">${scoredTotal}문제 기준</span></div>
        <div class="rank">${rowsHtml}</div>`;
    }

    function controlsFor() {
      const it = currentItem();
      const quizPhase = state.phase === 'quiz' && it;
      const midStage = quizPhase && !state.revealed; // 문제/보기/제출현황 단계 중
      const btns = [
        { label: '◀', onClick: stepBack, disabled: midStage ? (stage === 0 && state.index <= 0) : state.index <= 0 },
      ];
      if (state.phase === 'final') {
        btns.push({ label: '토크콘서트로', variant: 'primary', onClick: () => ctx.goSession('talk') });
      } else if (!quizPhase) {
        btns.push({ label: '퀴즈 시작', variant: 'primary', onClick: () => selectIndex(0) });
      } else if (!state.revealed) {
        btns.push({ label: '정답 공개', variant: 'primary', ready: allAnswered(joinedNos(), answeredNos()), onClick: reveal });
      } else if (it.chart && !state.showChart) {
        btns.push({ label: '데이터 보기', variant: 'primary', onClick: showChart });
      } else {
        const isLast = state.index >= ITEMS.length - 1;
        btns.push({ label: isLast ? '최종 순위' : '다음 문제', variant: 'primary', onClick: () => (isLast ? goFinal() : selectIndex(state.index + 1)) });
      }
      btns.push({ label: '▶', onClick: stepForward, disabled: state.phase === 'final' || (!midStage && state.index >= ITEMS.length - 1) });
      btns.push({ label: '대기화면', variant: 'ghost', onClick: toLobby });
      btns.push({ label: '이 문제 답 초기화', variant: 'danger', onClick: resetQuestion, disabled: !it });
      btns.push({ label: '전체 초기화', variant: 'danger', onClick: resetAll });
      return btns;
    }

    /* ---- 단축키 ---- */
    ctx.setKeys({
      ' ': () => controlsFor().find(b => b.variant === 'primary')?.onClick(),
      ArrowRight: stepForward,
      ArrowLeft: stepBack,
    });

    /* ---- 구독 시작 ---- */
    loadQuiz().then(d => {
      data = d;
      ITEMS = [data.practice, ...data.questions];
      render();
      unsubs.push(watch(path('quiz', 'state'), snap => { if (snap) state = { ...state, ...snap }; render(); }));
      unsubs.push(watchCollection(path('teams'), snap => { teamsMap = snap; render(); }));
      unsubs.push(watchCollection(path('quizAnswers'), snap => { answersAll = snap; render(); }));
    }).catch(e => {
      ctx.root.innerHTML = `<div class="slide"><h2>content/02-quiz.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`;
    });

    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
