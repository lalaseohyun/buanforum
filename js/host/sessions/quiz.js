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
     · 탭바에서 "2.퀴즈"를 직접 눌러 들어오면(이미 진행 중이었어도) 진행자 화면만
       QR 대기화면(연습문제 전 단계)부터 되돌아본다(previewIndex, -1=대기화면) —
       실제 진행 상황·참가자 화면·점수는 전혀 안 건드린다. 화살표로 계속 넘기면
       연습문제→1번→2번…으로 실제 진행 지점까지 따라잡고 자동으로 원래 흐름에
       합류한다. 화살표로 옆 세션에서 이어서 들어올 때(ctx.resume)는 이 되돌아보기
       없이 실제 상태를 바로 보여준다.
   ─────────────────────────────────────── */
import { esc, nl2br, sentences, fitInto, renderQr } from '../../util.js';
import { loadQuiz } from '../../content.js';
import { watch, watchCollection, hostSet, hostReset, path } from '../../db.js';
import { computeRanking, allAnswered } from '../../score.js';
import { renderChart } from './chart.js';

export default {
  id: 'quiz',
  title: '청년정책 퀴즈',
  mount(ctx) {
    // 오늘 진행할 조 수는 탭바 ☰ 메뉴에서 고른다(Firestore forum 문서의 teamCount) — 여기서는 읽기만 한다.
    let teamCount = ctx.forum.teamCount || ctx.forum.teams.length;
    const teams = () => ctx.forum.teams.slice(0, teamCount);
    let data = null, ITEMS = [];
    let state = { phase: 'lobby', index: -1, open: false, revealed: false, showChart: false, openedAt: null, asked: {} };
    let teamsMap = {};    // { [no]: {joinedAt} }
    let answersAll = {};  // { [qid]: { [no]: {choice, ms} } }
    let stage = 0;        // 0=문제만 1=+보기 2=+제출현황 — 진행자 화면 전용, Firestore에 안 남긴다
    // 탭바에서 "2.퀴즈"를 직접 눌러 들어왔는데(ctx.resume 아님) 이미 진행 중이었다면,
    // 실제 진행 상황(참가자 화면·점수)은 그대로 둔 채 진행자 화면만 QR 대기화면부터
    // 되돌아본다. -1=대기화면, 0 이상=ITEMS의 그 문제. null이면 "미리보기 아님,
    // 실제 state를 그대로 보여준다". Firestore에는 절대 안 쓴다.
    let previewIndex = null;
    let firstSync = true; // 이번 마운트에서 Firestore 값을 처음 받은 순간에만 미리보기 여부를 정한다
    const unsubs = [];

    const choicesFor = it => it.type === 'ox' ? ['O', 'X'] : it.choices;
    // "약 9,400명 — 100명 중 20명"처럼 " — "가 있으면 핵심 숫자(main)와 부연(sub)을 나눠
    // sub를 작고 노란 글자로 강조한다. 구분자가 없는 보기(OX, 짧은 보기)는 그대로 한 줄.
    const choiceHtml = c => {
      const i = c.indexOf(' — ');
      if (i === -1) return nl2br(c);
      return `${nl2br(c.slice(0, i))}<br><span class="sub">${nl2br(c.slice(i + 3))}</span>`;
    };
    const orderOf = it => it.scored ? ITEMS.filter(q => q.scored).indexOf(it) + 1 : 0;
    const joinedNos = () => Object.entries(teamsMap).filter(([, v]) => v && v.joinedAt).map(([k]) => Number(k));
    // 순위·시상 대상 — 한 번이라도 접속한 조만. 아무도 안 들어왔으면 전체를 그대로 쓴다(리허설용).
    const rankTeams = () => {
      const joined = joinedNos();
      const only = teams().filter(t => joined.includes(t.no));
      return only.length ? only : teams();
    };
    const displayIndex = () => (previewIndex !== null ? previewIndex : state.index);
    const currentItem = () => { const i = displayIndex(); return i >= 0 && i < ITEMS.length ? ITEMS[i] : null; };
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
      // chart는 안 실어 보낸다 — 팀 화면은 그래프/표를 아예 안 그리고(진행자 화면 전용 연출),
      // 표(table) 문항의 rows는 배열 안에 배열이 들어있는 모양이라 Firestore가 아예 거부한다
      // (nested arrays not supported) — 예전엔 이 필드 때문에 이 문서 쓰기 자체가 조용히 실패했다.
      const reveal = state.revealed && it ? {
        answerIndex: it.answerIndex, answerLabel: it.answerLabel,
        highlight: it.highlight, explanation: it.explanation, source: it.source,
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
        ranking: (state.revealed || state.phase === 'final') ? computeRanking(ITEMS, answersAll, rankTeams()) : null,
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
    // 진행자가 직접 누르는 진짜 진행 조작이라, 미리보기 중이었어도 여기서는 실제 흐름으로 돌아온다
    const toLobby = () => { previewIndex = null; stage = 0; writeState({ phase: 'lobby', open: false, revealed: false, showChart: false }); };

    /* ---- 한 문항 = 여러 페이지. 화살표 하나로 처음부터 끝까지 이어진다 ----
       0 문제만 · 1 +보기 · 2 +제출현황 · 3 정답공개(그 자리에서 정답만 노랗게 + 해설박스)
       4 데이터(차트가 있는 문항만). 하단 노란 점이 이 페이지 수를 보여준다. */
    const pagesOf = it => (it && it.chart ? 5 : 4);
    // 되돌아보는 지난 문제는 이미 다 지나간 게 확실하므로(순서대로만 진행되니까) 항상 정답 공개
    // 상태로 보여준다 — 데이터(차트) 단계는 건너뛰고 문제 단위로만 넘긴다.
    const pageNow = () => (previewIndex !== null ? 3 : state.showChart ? 4 : state.revealed ? 3 : stage);

    // 화살표는 세션 경계도 넘나든다 — 대기화면에서 더 뒤로 가면 1.오프닝으로,
    // 최종 순위에서 더 앞으로 가면 3.토크콘서트로 이어진다.
    function stepForward() {
      // 미리보기 중엔 실제 진행 상황을 절대 안 건드린다 — 화면만 다음 문제로 넘기다가
      // 실제 진행 지점(state.index)까지 따라잡으면 미리보기를 끝내고 원래 흐름으로 이어간다.
      if (previewIndex !== null) {
        previewIndex = previewIndex < state.index ? previewIndex + 1 : null;
        if (previewIndex === state.index) previewIndex = null;
        render();
        return;
      }
      if (state.phase === 'final') { ctx.goSession('talk', { resume: true }); return; }
      const it = currentItem();
      if (state.phase !== 'quiz' || !it) { selectIndex(state.index + 1); return; }
      const p = pageNow();
      if (p < 2) { stage = p + 1; render(); }
      else if (p === 2) reveal();
      else if (p === 3 && it.chart) showChart();
      else if (state.index >= ITEMS.length - 1) goFinal();
      else selectIndex(state.index + 1);
    }
    function stepBack() {
      if (previewIndex !== null) {
        if (previewIndex > -1) { previewIndex--; render(); }
        return;
      }
      if (state.phase === 'lobby') { ctx.goSession('opening', { resume: true }); return; }
      const it = currentItem();
      if (state.phase !== 'quiz' || !it) { selectIndex(state.index - 1); return; }
      const p = pageNow();
      if (p === 4) writeState({ showChart: false });
      else if (p === 3) { stage = 2; writeState({ revealed: false }); }
      else if (p > 0) { stage = p - 1; render(); }
      else selectIndex(state.index - 1);
    }

    function resetQuestion() {
      const it = currentItem();
      if (!it) return;
      if (previewIndex !== null) { alert('미리보기 중인 문제는 초기화할 수 없어요. 화살표로 실제 진행 중인 문제까지 이동한 뒤 눌러주세요.'); return; }
      if (!confirm('이 문제의 팀 답변을 모두 지웁니다. 진행할까요?')) return;
      hostReset(path('quizAnswers', it.id), {});
      stage = 0;
      writeState({ revealed: false, open: false, showChart: false });
    }
    function resetAll() {
      if (!confirm('답변·점수·접속한 팀까지 모두 지웁니다. 정말 초기화할까요?')) return;
      previewIndex = null;
      ITEMS.forEach(it => hostReset(path('quizAnswers', it.id), {}));
      ctx.forum.teams.forEach(t => hostReset(path('teams', String(t.no)), {}));
      stage = 0;
      writeState({ phase: 'lobby', index: -1, open: false, revealed: false, showChart: false, asked: {} });
    }

    /* ---- 렌더 ---- */
    // Firestore 구독 4개(quiz/state·forum teamCount·teams·quizAnswers)가 마운트 직후
    // 거의 동시에 각자 첫 스냅샷을 들고 도착한다. 각 콜백이 곧장 render()를 부르면
    // 같은 화면을 몇 분의 1초 사이에 3~4번 다시 그리게 되고, 특히 대기화면에서는
    // QR 코드를 그때마다 새로 그려서 눈에 띄게 버벅인다 — 한 프레임에 몰아서 한 번만 그린다.
    // setTimeout(0)을 쓴다 — requestAnimationFrame은 이 브라우저 탭이 안 보이는 동안
    // (다른 창에 가려짐 등) 완전히 멈춰버려서, 그 사이 화면이 계속 빈 채로 남는
    // 진짜 버그가 될 수 있다. setTimeout은 숨겨진 탭에서도 결국은 실행된다.
    let renderQueued = false;
    function scheduleRender() {
      if (renderQueued) return;
      renderQueued = true;
      setTimeout(() => { renderQueued = false; render(); }, 0);
    }
    function render() {
      if (!data) { ctx.root.innerHTML = `<div class="slide"><h2>불러오는 중…</h2></div>`; return; }
      const it = currentItem();
      const previewing = previewIndex !== null;
      // 미리보기 중엔 previewIndex 하나로만 판단한다(-1이면 대기화면, 0 이상이면 그 문제) —
      // 실제 phase가 무엇이든(최종순위 포함) 미리보기 중에는 그쪽을 안 본다.
      const showLobby = previewing ? previewIndex < 0 : (state.phase === 'lobby' || state.index < 0);
      if (showLobby) { ctx.root.innerHTML = viewLobby(); wireLobby(); }
      else if (!previewing && state.phase === 'final') ctx.root.innerHTML = viewFinal();
      else if (!previewing && state.showChart && it?.chart) ctx.root.innerHTML = viewChart(it);
      else ctx.root.innerHTML = viewQuestion(it); // 정답 공개도 같은 화면에서(정답만 노랗게 + 해설박스)
      // flex로 높이가 정해진 뒤에 재야 정확하다 — 한 프레임 뒤에 넘칠 때만 줄인다
      requestAnimationFrame(() => fitInto('.answerbox', 18));
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
      const chips = teams().map(t => chip(t, joined.includes(t.no) ? 'on' : '', null)).join('');
      const joinUrl = location.href.replace(/host\.html.*$/, '');
      return `<div class="lobby">
        <div class="qrbox"><div id="qrHolder"></div></div>
        <div>
          <h2>휴대폰으로 <span>QR</span>을 찍고<br>우리 조 번호를 눌러주세요</h2>
          <div class="lsub">조당 한 분만 접속하시면 됩니다</div>
          <div class="lsub">접속한 조 <b>${joined.length}</b> / ${teams().length}</div>
          <div class="chips">${chips}</div>
        </div>
      </div>`;
    }
    function wireLobby() {
      renderQr(document.getElementById('qrHolder'), location.href.replace(/host\.html.*$/, ''));
    }

    // 하단 노란 점 — 이 문항을 넘기는 데 몇 번 남았는지 한눈에 보여준다
    function dots(it) {
      const total = pagesOf(it), now = pageNow();
      return `<div class="pagedots">${Array.from({ length: total }, (_, i) =>
        `<i class="${i === now ? 'on' : ''}"></i>`).join('')}</div>`;
    }

    // 문제 → 보기 → 제출현황 → 정답까지 한 화면에서 이어진다.
    // 정답 페이지에서도 화면 구성은 그대로 두고, 정답 보기만 노랗게 바뀌고
    // 보기 아래에 연회색 해설 박스가 붙는다(문장마다 줄바꿈, 가운데 정렬).
    function viewQuestion(it) {
      const p = pageNow();
      const revealed = p >= 3;
      const n = it.type === 'ox' ? 2 : it.choices.length;
      const chArr = choicesFor(it);
      const ansForItem = answersForCurrent();
      const total = Math.max(1, Object.keys(ansForItem).length);
      const tally = chArr.map((_, i) => Object.values(ansForItem).filter(a => a.choice === i).length);

      // OX 문항은 번호(1·2)를 빼고 O/X 글자만 크게 보여준다
      const isOx = it.type === 'ox';
      const ch = chArr.map((c, i) => {
        const ok = revealed && i === it.answerIndex;
        const cls = revealed ? (ok ? 'correct' : 'dimmed') : '';
        return `<div class="ch ${cls}">
          ${isOx ? '' : `<div class="n">${i + 1}</div>`}
          <div class="t">${choiceHtml(c)}</div>
          ${revealed ? `<div class="tally">${tally[i]}조 · ${Math.round(tally[i] / total * 100)}%</div>` : ''}
          ${ok ? `<div class="hl-inline">${esc(it.highlight)}</div>` : ''}
        </div>`;
      }).join('');

      const chips = teams().map(t => {
        const a = t.no in ansForItem;
        return chip(t, a ? 'done' : joinedNos().includes(t.no) ? 'on' : '', a ? 'check' : null);
      }).join('');
      const cnt = answeredNos().length;
      const stat = cnt === 0 ? `<div class="tstat">답변을 기다리는 중</div>`
        : cnt === teams().length ? `<div class="tstat done">전체 제출 완료!</div>`
        : `<div class="tstat"><b>${cnt}</b>조 제출 완료${state.open ? '' : ' · 마감됨'}</div>`;

      // 미리보기 중임을 진행자가 헷갈리지 않게 위에 크게 표시한다 — 실제 진행은 안 멈춰 있다
      const previewNotice = previewIndex !== null
        ? `<div class="previewnotice"><span class="badge preview">◀▶ 되돌아보기 · 실제 진행 상황은 그대로예요</span></div>` : '';
      let body = `${previewNotice}${badges(it)}<div class="q">${nl2br(it.question)}</div>`;
      if (p >= 1) body += `<div class="choices ${isOx ? 'ox' : ''}" style="--n:${n}">${ch}</div>`;
      if (revealed) body += `<div class="answerbox">${sentences(it.explanation)}<div class="src">출처 · ${esc(it.source)}</div></div>`;
      const foot = p === 2 ? `<div class="foot"><div class="tmeta">${stat}</div><div class="chips">${chips}</div></div>` : '';
      return `<div class="qview ${p < 2 ? 'centered' : ''} ${revealed ? 'revealed' : ''}">${body}
        <div class="qbottom">${foot}${dots(it)}</div>
      </div>`;
    }

    function viewChart(it) {
      // 데이터 해설은 그래프 "위"에 붙는다. chart.note가 따로 있으면 그걸(데이터 전용 해설),
      // note 필드 자체가 없으면 정답 화면과 같은 explanation을 재사용한다.
      // note를 일부러 빈 문자열로 넣어두면(정답 화면과 중복이라 뺀 경우) 아무것도 안 붙는다.
      const chart = { ...it.chart, note: 'note' in it.chart ? it.chart.note : it.explanation };
      return `<div class="qview">${badges(it)}${renderChart(chart)}
        <div class="qbottom">${dots(it)}</div>
      </div>`;
    }

    // 최종 순위 — 한 번이라도 접속한 조만 올린다(안 온 조가 0점으로 자리를 채우면 시상에 방해).
    function viewFinal() {
      const rows = computeRanking(ITEMS, answersAll, rankTeams());
      const scoredTotal = ITEMS.filter(i => i.scored).length;
      const rowsHtml = rows.map(r => `
        <div class="row ${r.rank <= 3 ? 'p' + r.rank : ''}">
          <div class="r">${r.rank}위</div><div class="tm">${esc(r.name || r.label)}</div>
          <div class="sc">${r.score}<small> / ${scoredTotal}</small></div>
        </div>`).join('');
      // 팀이 하나뿐일 때만 1단 — 그 외엔 항상 2단(팀이 적으면 한 줄짜리 박스가
      // 가로로 화면 끝까지 늘어져 너무 길어 보였다).
      const cols = rows.length > 1 ? 2 : 1;
      return `<div class="finaltitle">최종 순위</div>
        <div class="rank" style="--cols:${cols};--rows:${Math.ceil(rows.length / cols)}">${rowsHtml}</div>`;
    }

    // 큰 버튼도 화살표(stepForward)와 똑같은 한 줄기 흐름을 따른다 — 라벨만 지금 페이지에 맞게 바뀐다
    function controlsFor() {
      const it = currentItem();

      // 미리보기 중엔 진짜 진행 조작 버튼(정답 공개·최종 순위 등)을 다 감추고,
      // "지난 문제 넘겨보기"용 버튼만 보여준다 — 실제 진행에는 손 못 대게 막는다.
      if (previewIndex !== null) {
        return [
          { label: '◀ 이전', onClick: stepBack, disabled: previewIndex <= -1 },
          { label: '다음 ▶', variant: 'primary', onClick: stepForward },
          { label: '대기화면', variant: 'ghost', onClick: toLobby },
        ];
      }

      const quizPhase = state.phase === 'quiz' && it;
      const p = quizPhase ? pageNow() : -1;
      const isLast = state.index >= ITEMS.length - 1;
      const btns = [
        // 대기화면·최종순위에서도 ◀는 살아있다 — 각각 오프닝 끝 페이지, 직전 문항으로 넘어간다
        { label: '◀', onClick: stepBack, disabled: quizPhase && p === 0 && state.index <= 0 },
      ];
      if (state.phase === 'final') {
        btns.push({ label: '토크콘서트로', variant: 'primary', onClick: () => ctx.goSession('talk', { resume: true }) });
      } else if (!quizPhase) {
        btns.push({ label: '퀴즈 시작', variant: 'primary', onClick: () => selectIndex(0) });
      } else {
        const label = p === 0 ? '보기 보여주기'
          : p === 1 ? '제출 현황'
          : p === 2 ? '정답 공개'
          : p === 3 && it.chart ? '데이터 보기'
          : isLast ? '최종 순위' : '다음 문제';
        btns.push({
          label, variant: 'primary',
          ready: p === 2 && allAnswered(joinedNos(), answeredNos()),
          onClick: stepForward,
        });
      }
      btns.push({ label: '▶', onClick: stepForward });
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
      // 여기서 바로 render()를 부르지 않는다 — 아직 Firestore 진짜 상태를 한 번도 못
      // 받아서(state는 기본값인 대기화면) 그걸로 한 번 그렸다가, 곧이어 진짜 상태가
      // 도착하면 또 그리는 이중 렌더(= QR 코드 두 번 그리기)가 됐었다. 아래 첫 구독
      // 콜백이 도착하는 순간이 곧 "믿을 수 있는 첫 렌더"다.
      unsubs.push(watch(path('quiz', 'state'), snap => {
        if (snap) state = { ...state, ...snap };
        // 탭바에서 직접 눌러 들어왔는데(ctx.resume 아님) 실제 진행 상황을 처음 받아보니
        // 이미 대기화면을 지나 있었다면 — 그 진행은 그대로 두고 화면만 1번 문제로 되돌린다.
        if (firstSync) {
          firstSync = false;
          // -1 = QR 대기화면(연습문제 전 단계)부터. 화살표로 계속 넘기면 연습문제→1번…
          // 순서로 실제 진행 지점까지 따라잡는다(stepForward의 캐치업 로직 참고).
          if (!ctx.resume && state.phase !== 'lobby' && ITEMS.length) previewIndex = -1;
        }
        scheduleRender();
      }));
      unsubs.push(watch(path(), snap => {
        const n = Number(snap?.teamCount);
        if (n && n !== teamCount) { teamCount = n; scheduleRender(); }
      }));
      unsubs.push(watchCollection(path('teams'), snap => { teamsMap = snap; scheduleRender(); }));
      unsubs.push(watchCollection(path('quizAnswers'), snap => { answersAll = snap; scheduleRender(); }));
    }).catch(e => {
      ctx.root.innerHTML = `<div class="slide"><h2>content/02-quiz.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`;
    });

    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
