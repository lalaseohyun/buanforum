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
import policySession from './sessions/policy.js';

const byId = { quiz: quizSession, board: boardSession, policy: policySession };

const root = document.getElementById('app');
const bar = { title: document.getElementById('ttl'), myteam: document.getElementById('mt'), foot: document.getElementById('foot') };

let forum = null;
let team = Number(localStorage.getItem('team')) || null;
let currentSessionId = null;
let mounted = null;

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
  const cards = forum.teams.map(t => `
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
  if (!team) { if (mounted?.unmount) mounted.unmount(); mounted = null; currentSessionId = null; renderJoin(); return; }
  const wantId = byId[currentSessionId] ? currentSessionId : 'wait';
  mountSession(wantId);
}

function mountSession(id) {
  const mod = id === 'wait' ? waitSession : byId[id];
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
    const sid = snap?.session || 'home';
    if (sid !== currentSessionId) {
      currentSessionId = sid;
      if (team) mountSession(byId[sid] ? sid : 'wait');
    }
  });

  route();
})();
