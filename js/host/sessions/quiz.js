/* ───────────────────────────────────────
   2. 청년정책 퀴즈 — 진행자 화면

   고칠 때 ─ 문항·정답·해설                → content/02-quiz.json
             팀 수·팀 이름                  → content/forum.json
             화면 색·글자 크기               → css/sessions/quiz.css
             진행 흐름·버튼(이 파일)         → 아래
   ⚠ 정답 공개 뒤 그래프/표를 보여주는 "데이터 보기" 단계가 있었는데 2026-09-08
     요청으로 완전히 없앴다(js/host/sessions/chart.js·css/sessions/chart.css는
     이제 아무 데서도 안 부른다 — 지우지 않고 남겨는 뒀다. content/02-quiz.json의
     각 문항 "chart" 필드도 이제 안 읽는다). 정답 공개 화면 하나로 끝난다.
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
     · 탭바를 누르거나 3.토크콘서트에서 화살표로 되돌아오는 경우(ctx.resume이
       아닌 모든 입장)에는, 실제 진행이 얼마나 됐든 일단 QR 대기화면부터 보여준다
       (coverMode) — 참가자에게 "여기로 접속하세요"를 언제든 다시 보여줄 수 있어야
       하기 때문. 화살표를 한 번만 누르면 실제 진행 상태로 곧장 넘어간다(중간에
       지나간 문제들을 하나씩 훑어 보여주지 않는다 — 예전엔 그렇게 했었는데,
       지나간 문제를 전부 "정답 공개"로 그려버리는 방식이라 테스트로 진행 상태가
       꼬였을 때 아직 안 연 새 문제까지 정답으로 보여버리는 사고로 이어졌다.
       2026-09-08에 "한 번에 진짜 상태로 전환"하는 지금 방식으로 다시 바꿨다).
       1.오프닝 → 화살표로 처음 들어올 때, 최종 순위에서 화살표로 3.토크콘서트로
       넘어갈 때도 마찬가지로 coverMode를 거친다. 반대로 3.토크콘서트 첫 페이지에서
       ◀로 다시 돌아올 때(ctx.resume)는 진짜 진행 중이던 화면을 곧장 보여준다.
   ─────────────────────────────────────── */
import { esc, nl2br, sentences, fitInto, renderQr, refitOnFontsReady } from '../../util.js';
import { loadQuiz } from '../../content.js';
import { watch, watchCollection, hostSet, hostReset, path } from '../../db.js';
import { computeRanking, allAnswered } from '../../score.js';

export default {
  id: 'quiz',
  title: '청년정책 퀴즈',
  mount(ctx) {
    // 오늘 진행할 조 수는 탭바 ☰ 메뉴에서 고른다(Firestore forum 문서의 teamCount) — 여기서는 읽기만 한다.
    let teamCount = ctx.forum.teamCount || ctx.forum.teams.length;
    const teams = () => ctx.forum.teams.slice(0, teamCount);
    let data = null, ITEMS = [];
    let state = { phase: 'lobby', index: -1, open: false, revealed: false, openedAt: null, asked: {} };
    let teamsMap = {};    // { [no]: {joinedAt} }
    let answersAll = {};  // { [qid]: { [no]: {choice, ms} } }
    let stage = 0;        // 0=문제만 1=+보기 2=+제출현황 — 진행자 화면 전용, Firestore에 안 남긴다
    // 탭바로 들어오거나 토크콘서트에서 돌아올 때(ctx.resume 아닐 때) 실제 진행이 얼마나
    // 됐든 일단 QR 대기화면부터 보여준다 — 화면에만 쓰는 값, Firestore에는 안 남긴다.
    // 화살표를 누르면 exitCover()가 한 번에 진짜 상태로 바꾼다(단계별 훑어보기 없음).
    let coverMode = !ctx.resume;
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
    const currentItem = () => { const i = state.index; return i >= 0 && i < ITEMS.length ? ITEMS[i] : null; };
    // ⚠ 답변 문서에는 조 번호("1","2",…) 말고도 규칙 검사용 hostKey와 updatedAt이 같이 들어 있고,
    // 초기화(hostReset)를 해도 문서 자체는 남아서 그 두 칸만 있는 빈 문서가 된다. 그래서 키 개수를
    // 그대로 세면 아무도 안 냈는데 "2조 제출 완료"로 나왔다(2026-09-08). 진짜 답변만 남긴다 —
    // 키가 조 번호이고 choice가 들어 있는 것. 제출 수·조 원 표시·보기별 득표수가 모두 이걸 쓴다.
    const realAnswers = obj => Object.fromEntries(Object.entries(obj || {})
      .filter(([k, v]) => /^\d+$/.test(k) && v && typeof v.choice === 'number'));
    const answersForCurrent = () => { const it = currentItem(); return it ? realAnswers(answersAll[it.id]) : {}; };
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
        phase: 'quiz', index: i, open: true, revealed: false,
        openedAt: Date.now(), asked: { ...state.asked, [it.id]: true },
      });
    }
    const reveal = () => writeState({ open: false, revealed: true });
    const goFinal = () => { stage = 0; writeState({ phase: 'final', open: false, revealed: false }); };
    const toLobby = () => { coverMode = false; stage = 0; writeState({ phase: 'lobby', open: false, revealed: false }); };
    // QR 대기화면(coverMode)에서 화살표를 누르면 — 지나간 문제를 훑지 않고 실제 진행
    // 상태로 한 번에 넘어간다. Firestore는 전혀 안 건드린다(화면 표시만 바꾼다).
    const exitCover = () => { coverMode = false; render(); };

    /* ---- 한 문항 = 여러 페이지. 화살표 하나로 처음부터 끝까지 이어진다 ----
       0 문제만 · 1 +보기 · 2 +제출현황 · 3 정답공개(그 자리에서 정답만 노랗게 + 해설박스).
       하단 노란 점이 이 페이지 수를 보여준다. */
    const pagesOf = () => 4;
    const pageNow = () => (state.revealed ? 3 : stage);

    // 화살표는 세션 경계도 넘나든다 — 대기화면에서 더 뒤로 가면 1.오프닝으로,
    // 최종 순위에서 더 앞으로 가면 3.토크콘서트로 이어진다.
    function stepForward() {
      if (coverMode) { exitCover(); return; }
      if (state.phase === 'final') { ctx.goSession('talk', { resume: true }); return; }
      const it = currentItem();
      if (state.phase !== 'quiz' || !it) { selectIndex(state.index + 1); return; }
      const p = pageNow();
      if (p < 2) { stage = p + 1; render(); }
      else if (p === 2) reveal();
      else if (state.index >= ITEMS.length - 1) goFinal();
      else selectIndex(state.index + 1);
    }
    function stepBack() {
      // coverMode에서 ◀는 실제 진행 상태로 들어가지 않고 그냥 1.오프닝으로 나간다 —
      // 화면에 QR이 떠 있는 동안은 "아직 대기화면을 보고 있는 것"과 같기 때문.
      if (coverMode || state.phase === 'lobby') { ctx.goSession('opening', { resume: true }); return; }
      const it = currentItem();
      if (state.phase !== 'quiz' || !it) { selectIndex(state.index - 1); return; }
      const p = pageNow();
      if (p === 3) { stage = 2; writeState({ revealed: false }); }
      else if (p > 0) { stage = p - 1; render(); }
      else selectIndex(state.index - 1);
    }

    function resetQuestion() {
      const it = currentItem();
      if (!it) return;
      if (!confirm('이 문제의 팀 답변을 모두 지웁니다. 진행할까요?')) return;
      hostReset(path('quizAnswers', it.id), {});
      stage = 0;
      writeState({ revealed: false, open: false });
    }
    function resetAll() {
      if (!confirm('답변·점수·접속한 팀까지 모두 지웁니다. 정말 초기화할까요?')) return;
      coverMode = false;
      ITEMS.forEach(it => hostReset(path('quizAnswers', it.id), {}));
      ctx.forum.teams.forEach(t => hostReset(path('teams', String(t.no)), {}));
      stage = 0;
      writeState({ phase: 'lobby', index: -1, open: false, revealed: false, asked: {} });
      // 참여자 화면도 같이 초기화 — 이 값이 바뀌는 걸 js/team/main.js가 지켜보고 있다가
      // 감지하면 그 폰이 지금 뭘 보고 있든 기억해 둔 "우리 조"를 지우고 허브로 돌려보낸다
      // (2026-09-08 요청 — 안 그러면 실제로는 다 지워졌는데 폰에는 예전 조·예전 문제
      // 화면이 그대로 남아 헷갈린다).
      hostSet(path(), { quizResetAt: Date.now() });
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
      // coverMode면 실제 진행이 어디까지 갔든 QR 대기화면부터 보여준다(위 파일 설명 참고)
      const showLobby = coverMode || state.phase === 'lobby' || state.index < 0;
      if (showLobby) { ctx.root.innerHTML = viewLobby(); wireLobby(); }
      else if (state.phase === 'final') ctx.root.innerHTML = viewFinal();
      else ctx.root.innerHTML = viewQuestion(it); // 정답 공개도 같은 화면에서(정답만 노랗게 + 해설박스)
      // 순서 중요 — fitQuestion()이 문제·보기를 줄여 해설 자리를 먼저 만들고,
      // 그래도 모자라는 만큼만 fitInto()가 해설 글자를 줄인다.
      // ⚠ 미루지 않고 바로 부른다 — innerHTML을 넣은 직후 scrollHeight를 읽으면 그 순간
      // 레이아웃은 이미 계산되어 있다(페인트는 이 함수가 끝난 뒤에나 일어난다). 예전엔
      // setTimeout으로 미뤄서 큰 글자로 한 번 그려졌다 줄어드는 게 화살표 누를 때마다
      // 눈에 보였다("글씨가 커졌다 작아졌다 해", 2026-09-08).
      fitQuestion(); fitInto('.answerbox', 18);
      refitOnFontsReady(ctx.root.querySelector('.qview'), () => { fitQuestion(); fitInto('.answerbox', 18); });
      ctx.setControls(controlsFor());
    }

    // 문제 글자는 CSS에서 화면 폭에 맞춰 크게(최대 116px) 잡아두는데, 문항에 따라
    // 세 줄까지 늘어나면 보기·제출현황·페이지 점이 화면 아래로 밀려 잘린다
    // (1920×1080에서 최대 161px 초과 — 2026-09-08 실측). 넘칠 때만 이 문항의
    // 문제 글자를 1px씩 줄여 딱 맞춘다. 짧은 문제는 손대지 않으니 그대로 크게 나온다.
    // 보기·제출현황 자리를 항상 잡아두는 덕분에(viewQuestion의 veil 참고) 단계가
    // 바뀌어도 같은 크기가 나와서, 문제 글자 크기가 도중에 튀지 않는다.
    function fitQuestion() {
      const view = ctx.root.querySelector('.qview');
      if (!view) return;
      const set = (k, v) => view.style.setProperty(k, String(v));
      set('--qs', 1); set('--cs', 1);

      // 정답 페이지 — 해설 박스는 남는 자리를 다 쓰는 구조라 화면이 넘치는 대신
      // 해설 글자만 계속 작아진다(1920×1080에서 최저 18px까지 쪼그라들었다 —
      // 2026-09-08 실측, 빔프로젝터로는 못 읽는 크기). 그래서 여기서는 이미 읽고 지나간
      // 문제·보기를 먼저 줄여 해설이 들어갈 자리를 만들어 준 뒤, 나머지만 fitInto가 맡는다.
      const ab = view.querySelector('.answerbox');
      if (ab) {
        ab.style.fontSize = '';
        const tight = () => ab.scrollHeight - ab.clientHeight > 4;
        if (!tight()) return;
        // 0.45까지 — 조 원(O/X 표시)이 생기면서 해설에 남는 자리가 줄어, 보기 칸을
        // 예전 하한(0.55)까지만 줄여서는 부족한 문항이 나왔다(2줄짜리 보기 문항에서
        // 해설이 18px까지 떨어졌다, 2026-09-08 실측). 보기 번호·글자는 여전히 읽을 수
        // 있는 한도 안에서 조금 더 양보하고, 그만큼 해설 쪽에 자리를 더 준다.
        for (let cs = 1; cs >= 0.45 && tight(); cs -= 0.02) set('--cs', cs.toFixed(2));
        for (let qs = 1; qs >= 0.55 && tight(); qs -= 0.02) set('--qs', qs.toFixed(2));
        return;
      }

      const over = () => view.scrollHeight - view.clientHeight > 4; // 4px는 반올림 오차 여유
      if (!over()) return;
      // 1) 문제 글자를 조금(최대 20%) — 대개 여기서 줄바꿈이 한 줄 줄면서 바로 들어간다
      let qs = 1;
      for (; qs >= 0.8 && over(); qs -= 0.02) set('--qs', qs.toFixed(2));
      if (!over()) return;
      // 2) 그래도 넘치면 보기 칸을 줄인다 — 문제 글자를 더 줄이기 전에 여기부터
      for (let cs = 1; cs >= 0.72 && over(); cs -= 0.02) set('--cs', cs.toFixed(2));
      // 3) 마지막 수단 — 문제 글자를 절반까지
      for (; qs >= 0.5 && over(); qs -= 0.02) set('--qs', qs.toFixed(2));
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

      // 정답 공개 화면 전용 — 제출한 팀 중 누가 맞혔는지 조 원마다 O/X로 보여준다
      // (제출현황 단계의 ✓ 표시와 같은 자리, 같은 조 원 모양을 그대로 쓴다).
      // 제출을 안 한 팀은 "–"(접속은 했지만 답은 안 낸 경우) 또는 표식 없음(접속조차 안 함).
      const correctNos = teams().filter(t => ansForItem[t.no]?.choice === it.answerIndex).map(t => t.no);
      const revealChips = teams().map(t => {
        const a = ansForItem[t.no];
        if (a) return chip(t, correctNos.includes(t.no) ? 'done' : 'wrong', correctNos.includes(t.no) ? 'O' : 'X');
        return chip(t, joinedNos().includes(t.no) ? 'on' : '', joinedNos().includes(t.no) ? '–' : null);
      }).join('');
      const revealStat = `<div class="tstat"><b>${correctNos.length}</b>조 정답 · ${cnt}조 제출</div>`;

      // ⚠ 문제만(0) → 보기(1) → 제출현황(2) 세 단계에서 문제·보기는 1px도 움직이면 안 된다
      // (움직이면 보는 사람 시선이 흐트러진다 — 2026-09-08 요청). 그래서 아직 보여줄
      // 차례가 아닌 보기·제출현황도 자리는 처음부터 그대로 잡아두고, 보이지만 않게 한다
      // (display:none이 아니라 visibility:hidden — 자리는 차지한 채 안 보인다).
      const veil = show => (show ? '' : ' visibility:hidden;');
      let body = `${badges(it)}<div class="q">${nl2br(it.question)}</div>`;
      if (revealed) {
        body += `<div class="choices ${isOx ? 'ox' : ''}" style="--n:${n}">${ch}</div>`;
        body += `<div class="answerbox">${sentences(it.explanation)}<div class="src">출처 · ${esc(it.source)}</div></div>`;
      } else {
        body += `<div class="choices ${isOx ? 'ox' : ''}" style="--n:${n};${veil(p >= 1)}">${ch}</div>`;
      }
      const foot = revealed
        ? `<div class="foot revealfoot"><div class="tmeta">${revealStat}</div><div class="chips">${revealChips}</div></div>`
        : `<div class="foot" style="${veil(p >= 2)}"><div class="tmeta">${stat}</div><div class="chips">${chips}</div></div>`;
      return `<div class="qview ${revealed ? 'revealed' : ''}">${body}
        <div class="qbottom">${foot}${dots(it)}</div>
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
      // QR 대기화면(coverMode)에서는 조작을 최소로 — ◀는 1.오프닝으로, 다음은 실제
      // 진행 상태 공개(exitCover). "대기화면"·초기화 버튼은 실제 상태로 넘어간 뒤에만
      // 눌러야 진짜로 뭘 지우는지 헷갈리지 않는다.
      if (coverMode) {
        return [
          { label: '◀', onClick: stepBack },
          { label: '다음 ▶', variant: 'primary', onClick: exitCover },
        ];
      }
      const it = currentItem();
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
