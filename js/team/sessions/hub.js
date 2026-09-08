/* ───────────────────────────────────────
   참여자 허브 — 루트 주소(index.html)의 첫 화면이자 "허브로 돌아가기"의 목적지.
   docs/참여자용페이지_구상안.md 기준. 2×2 타일(퀴즈·시행계획·대표정책·만족도조사)을
   Firestore forum 문서의 activeSession 값(진행자 탭바 "▶ 진행상태" 메뉴)에 따라
   진행 중(●)/완료(✓)/대기(🔒)로 보여준다.

   타일 하나 = 세션 하나가 아니라, 여기서 조 선택·확인까지 다 처리한 뒤
   ctx.enterTile(id, opts)로 실제 화면(js/team/main.js가 고름)에 넘긴다 —
   그래서 이 파일이 다른 세션보다 좀 크다.

   시행계획 타일은 always-on(잠금 없음), 만족도조사는 survey.html로 그냥 이동,
   퀴즈·대표정책은 조 번호가 필요해서 먼저 고르게 한다(대표정책은 이미 고른 조가
   있으면 다시 안 물어본다 — js/team/teamId.js가 기억한다).

   고칠 때 ─ 타일 문구·상태 규칙   → 이 파일 위쪽 RANGE/statusOf, tileHtml
             타일·확인화면 모양    → css/sessions/hub.css
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { watch, path, getOnce, claimTeam } from '../../db.js';
import { loadPolicies } from '../../content.js';
import { getMyTeam, setMyTeam, getDeviceId } from '../teamId.js';

// ACTIVE_SESSIONS(js/db.js)와 같은 순서 — 값 자체를 import해서 써도 되지만, 타일별로
// "어느 구간에서 활성인가"만 필요해서 여기 별도로 둔다(호스트 메뉴 순서와는 독립적).
const ORDER = ['waiting', 'quiz', 'proposal_submit', 'proposal_vote', 'survey', 'ended'];
const RANGE = {
  quiz: ['quiz', 'quiz'],
  policy: ['proposal_submit', 'proposal_vote'],
  survey: ['survey', 'ended'],   // 포럼이 끝나도(ended) 만족도조사는 계속 연다
};
// ⚠ 2026-09-08 요청으로 잠금을 껐다 — 네 타일 다 항상 "진행 중"으로 열어둔다(테스트 편의).
// 원래대로 activeSession 값에 따라 잠그고 싶으면 아래 주석을 풀고 이 줄만 지우면 된다.
function statusOf(/* tileId, activeSession */) { return 'active'; }
// function statusOf(tileId, activeSession) {
//   if (!RANGE[tileId]) return 'active';   // 시행계획 — 항상 활성
//   const cur = ORDER.indexOf(activeSession);
//   const [a, b] = RANGE[tileId].map(x => ORDER.indexOf(x));
//   if (cur < 0 || cur < a) return 'locked';
//   if (cur > b) return 'done';
//   return 'active';
// }

export default {
  id: 'hub',
  mount(ctx) {
    let activeSession = 'waiting';
    let teamCount = ctx.forum.teamCount || ctx.forum.teams.length;
    let boardSub = '분야별 사업 목록';
    let view = 'grid';           // grid | pickQuiz | confirmQuiz | pickPolicy | policyClosed
    let pendingPolicyMode = null;
    let confirmTeam = null;
    let confirmWarn = false;
    const deviceId = getDeviceId();
    const unsubs = [];

    const teams = () => ctx.forum.teams.slice(0, teamCount);

    function toast(msg) {
      const el = document.createElement('div');
      el.className = 'hubtoast';
      el.textContent = msg;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1900);
    }

    function render() {
      if (view === 'pickQuiz') return renderPickQuiz();
      if (view === 'confirmQuiz') return renderConfirmQuiz();
      if (view === 'pickPolicy') return renderPickPolicy();
      if (view === 'policyClosed') return renderPolicyClosed();
      renderGrid();
    }

    function tileHtml(id, title, sub, status) {
      const icon = status === 'active' ? '●' : status === 'done' ? '✓' : '🔒';
      return `<button class="hubtile ${status}" data-id="${id}" data-status="${status}">
        <div class="hubtile-icon">${icon}</div>
        <div class="hubtile-title">${esc(title)}</div>
        <div class="hubtile-sub">${esc(sub)}</div>
      </button>`;
    }

    function renderGrid() {
      const tiles = [
        tileHtml('quiz', '청년정책 퀴즈', '조별 대표자 1명만 클릭', statusOf('quiz', activeSession)),
        tileHtml('board', '청년정책 시행계획', boardSub, 'active'),
        tileHtml('policy', '대표정책 제안', '우리 그룹이 제안하는 정책', statusOf('policy', activeSession)),
        tileHtml('survey', '청년포럼 만족도조사', '오늘 어떠셨나요?', statusOf('survey', activeSession)),
      ].join('');
      ctx.root.innerHTML = `
        <div class="hubhead">
          <div class="hubtitle">${esc(ctx.forum.title)}</div>
          <div class="hubsub">${esc(ctx.forum.subtitle || '')}</div>
        </div>
        <div class="hubgrid">${tiles}</div>
        <div class="hublegend"><span><i class="lg lg-on"></i>진행 중</span><span><i class="lg lg-done"></i>완료</span><span><i class="lg lg-lock"></i>대기</span></div>`;
      ctx.root.querySelectorAll('.hubtile').forEach(el => {
        el.onclick = () => onTileClick(el.dataset.id, el.dataset.status);
      });
    }

    function onTileClick(id, status) {
      if (status === 'locked') { toast('아직 열리지 않았어요 · 진행자 화면을 봐주세요'); return; }
      if (id === 'board') { ctx.enterTile('board'); return; }
      if (id === 'survey') { ctx.enterTile('survey'); return; }
      if (id === 'quiz') {
        if (getMyTeam()) { ctx.enterTile('quiz'); return; }
        view = 'pickQuiz'; render(); return;
      }
      if (id === 'policy') {
        if (status === 'done') { view = 'policyClosed'; render(); return; }
        // 잠금이 꺼져 있는 동안은(위 statusOf) activeSession이 proposal_submit/vote가
        // 아닌 값(예: waiting)일 수도 있다 — 그때는 투표 화면보다 제출 화면이 자연스러운
        // 기본값이라, 명시적으로 proposal_vote일 때만 투표로 보낸다.
        pendingPolicyMode = activeSession === 'proposal_vote' ? 'proposal_vote' : 'proposal_submit';
        if (getMyTeam()) { ctx.enterTile('policy', { mode: pendingPolicyMode }); return; }
        view = 'pickPolicy'; render(); return;
      }
    }

    function teamGrid(onPick) {
      const cards = teams().map(t => `
        <div class="tcard" data-no="${t.no}"><div class="n">${esc(t.label)}조</div><div class="a">${esc(t.name || '')}</div></div>`).join('');
      return { html: `<div class="grid">${cards}</div>`, wire: root => root.querySelectorAll('.tcard').forEach(el => { el.onclick = () => onPick(Number(el.dataset.no)); }) };
    }

    function renderPickQuiz() {
      const g = teamGrid(selectQuizTeam);
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 허브로</span></div>
        <div class="h">우리 조 번호를 눌러주세요</div>
        <div class="sub">퀴즈는 조당 대표 한 분만 참여해요</div>
        ${g.html}`;
      document.getElementById('back').onclick = () => { view = 'grid'; render(); };
      g.wire(ctx.root);
    }

    async function selectQuizTeam(no) {
      confirmTeam = no; confirmWarn = false; view = 'confirmQuiz'; render();
      try {
        const existing = await getOnce(path('teams', String(no)));
        if (existing?.activeDevice && existing.activeDevice !== deviceId && view === 'confirmQuiz') {
          confirmWarn = true; render();
        }
      } catch (e) { console.error(e); }
    }

    function renderConfirmQuiz() {
      const t = teams().find(x => x.no === confirmTeam);
      const label = esc(t?.label ?? confirmTeam);
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 다시 고르기</span></div>
        <div class="confirmcard">
          <div class="h">${label}조 대표로 참여합니다</div>
          <div class="sub">우리 조에서 한 명만 참여해요<br>이미 다른 분이 하고 있다면 뒤로 가주세요</div>
          ${confirmWarn ? `<div class="warnbox">${label}조는 이미 참여 중입니다. 그래도 계속하시겠어요?</div>` : ''}
          <button class="primary" id="go">${label}조 대표로 시작하기</button>
        </div>`;
      document.getElementById('back').onclick = () => { view = 'pickQuiz'; render(); };
      document.getElementById('go').onclick = async () => {
        setMyTeam(confirmTeam);
        try { await claimTeam(confirmTeam, deviceId); } catch (e) { console.error(e); }
        ctx.enterTile('quiz');
      };
    }

    function renderPickPolicy() {
      const g = teamGrid(no => { setMyTeam(no); ctx.enterTile('policy', { mode: pendingPolicyMode }); });
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 허브로</span></div>
        <div class="h">우리 조 번호를 눌러주세요</div>
        ${g.html}`;
      document.getElementById('back').onclick = () => { view = 'grid'; render(); };
      g.wire(ctx.root);
    }

    function renderPolicyClosed() {
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 허브로</span></div>
        <div class="center"><div class="big">공감투표가 마감됐어요</div><div class="sub">결과는 진행자 화면에서 확인해주세요</div></div>`;
      document.getElementById('back').onclick = () => { view = 'grid'; render(); };
    }

    render();
    unsubs.push(watch(path(), snap => {
      const a = snap?.activeSession;
      const n = Number(snap?.teamCount);
      let changed = false;
      if (a && a !== activeSession) { activeSession = a; changed = true; }
      if (n && n !== teamCount) { teamCount = n; changed = true; }
      if (changed && view === 'grid') render();
    }));
    loadPolicies().then(p => {
      boardSub = `${p.meta.totalCount}개 사업`;
      if (view === 'grid') render();
    }).catch(() => {});

    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
