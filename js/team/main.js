/* ───────────────────────────────────────
   참여자(모바일) 셸 — 루트 주소는 이제 "허브"다(hub.js). 예전처럼 진행자가 지금
   띄운 세션을 그대로 따라가는 방식이 아니라, 참여자가 직접 타일을 눌러 들어간다
   (docs/참여자용페이지_구상안.md). 이 파일은 그 사이를 잇는 얇은 라우터일 뿐이고,
   조 상태·진행 단계 판단은 전부 hub.js 안에 있다.

   고칠 때 ─ 허브 화면(타일·조 확인)   → js/team/sessions/hub.js
             타일 하나의 내용/흐름     → js/team/sessions/<해당 화면>.js
             셸 자체(상단바 등)        → 이 파일 + css/team.css
   세션 모듈 계약 ─
     default export = { id, mount(ctx) → { unmount() } }
     ctx로 넘겨주는 것: root, forum, team(조 번호, 없으면 null), backToHub(), leaveTeam(),
                        enterTile(id, opts) — hub.js만 쓴다(다른 타일 화면에서 부를 일 없음)
   라우팅 규칙 ─ hub.js가 조 선택·확인까지 끝내고 enterTile(id)을 부르면
   그 id에 맞는 화면을 마운트한다. 'policy'는 그 순간의 진행 단계(opts.mode)에 따라
   제출/투표 중 하나로 갈린다. 'survey'는 화면이 아니라 별도 페이지(survey.html) 이동이다.
   ─────────────────────────────────────── */
import { ensureAuth, watch, path } from '../db.js';
import { loadForum } from '../content.js';
import { esc } from '../util.js';
import { getMyTeam, clearMyTeam } from './teamId.js';

import hubSession from './sessions/hub.js';
import quizSession from './sessions/quiz.js';
import policyBrowseSession from './sessions/policyBrowse.js';
import proposalSubmitSession from './sessions/proposalSubmit.js';
import voteSession from './sessions/vote.js';

const root = document.getElementById('app');
const bar = { title: document.getElementById('ttl'), myteam: document.getElementById('mt'), foot: document.getElementById('foot') };

let forum = null;
let mounted = null;
let policyMode = null;   // 'proposal_submit' | 'proposal_vote' — 대표정책 타일에 들어간 순간의 진행 단계

function renderBar() {
  bar.title.textContent = forum.title;
  const no = getMyTeam();
  const me = no && forum.teams.find(t => t.no === no);
  if (no) { bar.myteam.hidden = false; bar.myteam.textContent = (me ? me.label : String(no)) + '조'; }
  else bar.myteam.hidden = true;
  bar.foot.innerHTML = no
    ? `${esc(forum.subtitle || '')} · <span class="link" id="leave">조 다시 선택</span>`
    : esc(forum.subtitle || '');
  const leave = document.getElementById('leave');
  if (leave) leave.onclick = () => {
    if (!confirm('조 선택을 다시 하시겠어요?')) return;
    clearMyTeam();
    renderBar();
  };
}

function backToHub() { mountScreen('hub'); }
function leaveTeam() { clearMyTeam(); backToHub(); }

function ctxFor() {
  return { root, forum, team: getMyTeam(), backToHub, leaveTeam, enterTile };
}

function mountScreen(id) {
  if (mounted?.unmount) { try { mounted.unmount(); } catch (e) { console.error(e); } }
  root.innerHTML = '';
  const mod = id === 'hub' ? hubSession
    : id === 'quiz' ? quizSession
    : id === 'board' ? policyBrowseSession
    : id === 'policy' ? (policyMode === 'proposal_submit' ? proposalSubmitSession : voteSession)
    : null;
  if (!mod) { mountScreen('hub'); return; }
  mounted = mod.mount(ctxFor()) || {};
  renderBar();
}

function enterTile(id, opts = {}) {
  if (id === 'survey') { location.href = 'survey.html'; return; }   // 별도 페이지 — 화면 전환이 아니라 이동
  if (id === 'policy') policyMode = opts.mode || policyMode;
  mountScreen(id);
}

(async function start() {
  try {
    forum = await loadForum();
    document.title = forum.title;
  } catch (e) {
    root.innerHTML = `<div class="center"><div class="big">content/forum.json 로드 실패</div><div class="sub">${esc(e.message)}</div></div>`;
    return;
  }
  await ensureAuth();
  mountScreen('hub');

  // 진행자가 퀴즈 "전체 초기화"를 누르면(js/host/sessions/quiz.js resetAll) forum
  // 문서의 quizResetAt이 바뀐다 — 지금 이 폰이 어느 화면에 있든(허브든 퀴즈 문제
  // 화면이든) 감지해서 기억해 둔 "우리 조"를 지우고 허브로 돌려보낸다. 페이지를
  // 막 열어서 받는 첫 값은 "방금 일어난 초기화"가 아니라 "예전에 언젠가 있었던
  // 초기화 시각"일 뿐이므로 무시한다 — 그 값 하나만으로 매번 새로고침할 때마다
  // 조가 풀리면 안 되기 때문.
  let lastResetAt = undefined;
  watch(path(), snap => {
    const t = snap?.quizResetAt || null;
    if (lastResetAt === undefined) { lastResetAt = t; return; }
    if (t && t !== lastResetAt) {
      lastResetAt = t;
      clearMyTeam();
      mountScreen('hub');
    }
  });
})();
