/* ───────────────────────────────────────
   참여자(모바일) 셸 — 조 선택 · 진행자가 지금 띄운 세션을 그대로 따라간다.

   고칠 때 ─ 세션 하나의 내용/흐름   → js/team/sessions/<해당 세션>.js
             셸 자체(상단바 등)      → 이 파일 + css/team.css
   세션 모듈 계약 ─
     default export = { id, mount(ctx) → { unmount() } }
     ctx로 넘겨주는 것: root, forum, team(조 번호), leaveTeam()
   라우팅 규칙 ─ 진행자가 goSession()할 때마다 forum 문서의 session 필드가 바뀐다.
   그 값이 'quiz'|'board'|'policy'면 해당 팀 세션 모듈을, 그 외(home/opening/talk)는
   공용 대기화면(wait.js)을 띄운다 — 참가자는 스스로 진행하지 않는다.
   ─────────────────────────────────────── */
import { ensureAuth, watch, teamSet, path } from '../db.js';
import { loadForum } from '../content.js';
import { esc } from '../util.js';

import waitSession from './sessions/wait.js';
import quizSession from './sessions/quiz.js';
import boardSession from './sessions/board.js';
import voteSession from './sessions/vote.js';

// 대표정책(5번)은 진행자가 사진을 올리므로 참여자 화면은 공감투표만 담당한다
const byId = { quiz: quizSession, board: boardSession, policy: voteSession };

// 투표 전용 QR(주소 끝 ?vote=1)로 들어오면 조 선택을 건너뛰고 바로 투표 화면으로 간다
const VOTE_ONLY = new URLSearchParams(location.search).get('vote') === '1';

const root = document.getElementById('app');
const bar = { title: document.getElementById('ttl'), myteam: document.getElementById('mt'), foot: document.getElementById('foot') };

let forum = null;
let team = Number(localStorage.getItem('team')) || null;
let currentSessionId = null;
let mounted = null;
let liveTeamCount = null;   // 진행자가 정한 오늘의 조 수(Firestore forum 문서)
const teamCount = () => liveTeamCount || forum.teamCount || forum.teams.length;

function renderBar() {
  bar.title.textContent = forum.title;
  const me = forum.teams.find(t => t.no === team);
  if (team) { bar.myteam.hidden = false; bar.myteam.textContent = me ? me.label + '조' : String(team); }
  else bar.myteam.hidden = true;
  bar.foot.innerHTML = team
    ? `${esc(forum.subtitle || '')} · <span class="link" id="leave">조 다시 선택</span>`
    : esc(forum.subtitle || '');
  const leave = document.getElementById('leave');
  if (leave) leave.onclick = leaveTeam;
}

function leaveTeam() {
  if (!confirm('조 선택을 다시 하시겠어요?')) return;
  localStorage.removeItem('team');
  team = null;
  route();
}

function renderJoin() {
  // 오늘 진행하는 조 수만큼만 보여준다(진행자가 대기화면에서 고른 값)
  const cards = forum.teams.slice(0, teamCount()).map(t => `
    <div class="tcard" data-no="${t.no}"><div class="n">${esc(t.label)}조</div><div class="a">${esc(t.name || '')}</div></div>`).join('');
  root.innerHTML = `<div class="h">우리 조 번호를 눌러주세요</div>
    <div class="sub">테이블에 붙은 번호와 같은 것을 고르시면 됩니다</div>
    <div class="grid">${cards}</div>`;
  root.querySelectorAll('.tcard').forEach(el => {
    el.onclick = async () => {
      const no = Number(el.dataset.no);
      team = no; localStorage.setItem('team', no);
      await teamSet(path('teams', String(no)), { joinedAt: Date.now() });
      route();
    };
  });
}

function route() {
  renderBar();
  // 투표 전용 QR로 들어온 사람은 조와 상관이 없다 — 바로 투표 화면
  if (VOTE_ONLY) { mountSession('vote'); return; }
  if (!team) { if (mounted?.unmount) mounted.unmount(); mounted = null; currentSessionId = null; renderJoin(); return; }
  const wantId = byId[currentSessionId] ? currentSessionId : 'wait';
  mountSession(wantId);
}

function mountSession(id) {
  const mod = id === 'wait' ? waitSession : id === 'vote' ? voteSession : byId[id];
  if (mounted?.unmount) { try { mounted.unmount(); } catch (e) { console.error(e); } }
  root.innerHTML = '';
  mounted = mod.mount({ root, forum, team, leaveTeam }) || {};
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

  watch(path(), snap => {
    const n = Number(snap?.teamCount) || null;
    const countChanged = n && n !== liveTeamCount;
    liveTeamCount = n || liveTeamCount;
    const sid = snap?.session || 'home';
    if (VOTE_ONLY) return;                       // 투표 화면은 세션 전환을 따라가지 않는다
    if (sid !== currentSessionId) {
      currentSessionId = sid;
      if (team) mountSession(byId[sid] ? sid : 'wait');
    } else if (countChanged && !team) {
      renderJoin();                              // 조 선택 화면이면 조 수 변경을 바로 반영
    }
  });

  route();
})();
