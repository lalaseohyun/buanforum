/* ───────────────────────────────────────
   진행자(빔프로젝터) 셸 — 세션 라우팅 · 탭바 · 전체화면(무대모드) · 단축키 · 연결 상태.

   고칠 때 ─ 세션 하나의 내용/흐름   → js/host/sessions/<해당 세션>.js
             셸 자체(탭바 위치 등)   → 이 파일 + css/host.css
             오늘 진행할 조 수 선택  → 탭바 ☰ 메뉴(renderTeamsMenu/toggleTeamsMenu, 이 파일 안)
             참여자 허브 진행 단계   → 탭바 ▶ 진행상태 메뉴(renderPhaseMenu/togglePhaseMenu, 이 파일 안) —
                                      루트 주소(js/team/sessions/hub.js)의 타일 잠금/진행/완료를 정한다
   세션 모듈 계약(모든 세션이 이 모양을 따른다) ─
     default export = {
       id, title,
       mount(ctx) → { unmount() }   // 이 세션으로 들어올 때 1회 호출
     }
     ctx로 넘겨주는 것:
       root          — <main id="stage"> 엘리먼트. 여기 안에서만 그린다.
       forum         — content/forum.json
       hostKey       — URL의 ?k=
       setControls(buttons)  — 하단 조작바를 갱신 (buttons: [{label,onClick,variant,ready,disabled}])
       setKeys(map)  — 이 세션이 떠 있는 동안의 단축키 (map: {' ':fn, 'ArrowRight':fn, ...})
       goSession(id) — 다른 세션으로 전환 (탭바를 직접 누른 것과 동일)

   무대(#stage) 빈 공간을 클릭해도 ArrowRight와 똑같이 다음으로 넘어간다(무선 포인터 지원 —
   맨 아래 root.addEventListener('click', ...) 참고). 세션 안에 자기만의 클릭 동작이 있는
   요소(카드, 사진 확대 등)를 새로 만들 때는 그 요소의 onclick에서 꼭
   e.stopPropagation()을 불러야 한다 — 안 그러면 그 클릭이 여기까지 버블링돼서
   "다음으로 넘기기"가 같이 발동한다(home.js .homecard, policy.js .gcard 참고).
   ─────────────────────────────────────── */

import { ensureAuth, getHostKey, hostSet, path, watch, ACTIVE_SESSIONS } from '../db.js';
import { loadForum } from '../content.js';
import { esc } from '../util.js';
import { renderControls } from './controls.js';

import homeSession from './sessions/home.js';
import openingSession from './sessions/opening.js';
import quizSession from './sessions/quiz.js';
import talkSession from './sessions/talk.js';
import boardSession from './sessions/board.js';
import policySession from './sessions/policy.js';
import awardSession from './sessions/award.js';
import surveySession from './sessions/survey.js';

// 배포할 때마다 올리는 표식. 탭바 오른쪽에 작게 보인다 —
// 브라우저가 예전 파일을 캐시해서 보여주고 있는지 이 숫자로 바로 알 수 있다.
// (GitHub Pages는 정적 파일을 10분간 캐시한다. 강력 새로고침은 Ctrl+Shift+R)
const BUILD = 'v33';

const SESSIONS = [homeSession, openingSession, quizSession, talkSession, boardSession, policySession, awardSession, surveySession];
const byId = Object.fromEntries(SESSIONS.map(s => [s.id, s]));

const root = document.getElementById('stage');
const tabbar = document.getElementById('tabbar');
const ctl = document.getElementById('ctl');
const row1 = document.getElementById('row1');
const alertEl = document.getElementById('alert');

let forum = null;
let hostKey = getHostKey();
let current = null;        // 현재 마운트된 세션의 { unmount } 핸들
let currentKeys = {};
let stageMode = false;

// 오늘 진행할 조 수 — 탭바 ☰ 메뉴에서 고른다(세션이 아니라 셸이 갖고 있어야
// 어느 화면에 있든 항상 조작할 수 있다). 값 자체는 Firestore forum 문서에 저장되고,
// 퀴즈·대표정책·공감투표 세션은 각자 이 문서를 구독해서 따라간다.
let teamCount = 0;
let teamsMenuOpen = false;

// 참여자 허브(루트 주소)의 타일 잠금/진행/완료를 정하는 값 — 탭바 "▶ 진행상태" 메뉴에서
// 바꾼다. 이것도 조 수와 같은 이유로 셸이 갖고, Firestore forum 문서에 저장된다.
const PHASE_LABEL = {
  waiting: '대기', quiz: '퀴즈', proposal_submit: '정책 제출',
  proposal_vote: '정책 투표', survey: '만족도조사', ended: '행사 종료',
};
let activeSession = 'waiting';
let phaseMenuOpen = false;

function offline(bad) {
  document.body.classList.toggle('offline', bad);
}

function setControls(buttons) { renderControls(row1, buttons); }

function setKeys(map) { currentKeys = map || {}; }

function renderTabbar() {
  const buttons = [
    `<button data-s="home" class="${current?.id === 'home' ? 'active' : ''}">홈</button>`,
    ...forum.sessions.map(s => `<button data-s="${s.id}" class="${current?.id === s.id ? 'active' : ''}">${s.no}. ${esc(s.short)}</button>`),
  ];
  tabbar.innerHTML = buttons.join('') + '<div class="sp"></div>' +
    `<span class="build">${BUILD}</span>` +
    `<span class="pill"><span class="dot" id="dot"></span><span id="connTxt">연결 중</span></span>` +
    `<span class="teammenu"><button id="bPhase" title="참여자 허브 진행 단계">▶ 진행상태</button>
      <div class="teammenu-panel" id="phasePanel"></div></span>` +
    `<span class="teammenu"><button id="bTeams" title="오늘 진행할 조 수">☰</button>
      <div class="teammenu-panel" id="teamsPanel"></div></span>` +
    `<button id="bFs">⛶ 전체화면</button>`;
  tabbar.querySelectorAll('button[data-s]').forEach(b => {
    b.onclick = () => goSession(b.dataset.s);
  });
  document.getElementById('bFs').onclick = toggleStage;
  // renderTabbar()가 세션을 넘어갈 때마다 이 안쪽을 통째로 새로 그리므로, ☰·▶ 메뉴는
  // 세션이 바뀌면 자동으로 닫힌 채 다시 생긴다(의도된 동작) — 같은 세션 안에서
  // 화살표로만 움직일 때는 탭바가 다시 그려지지 않아 열림 상태가 그대로 유지된다.
  document.getElementById('bTeams').onclick = () => toggleTeamsMenu();
  document.getElementById('bPhase').onclick = () => togglePhaseMenu();
  renderTeamsMenu();
  renderPhaseMenu();
}

// 참여자 허브 진행 단계 — ▶ 패널 안의 버튼 목록을 그린다(값이 바뀔 때마다 다시 호출)
function renderPhaseMenu() {
  const panel = document.getElementById('phasePanel');
  if (!panel) return;
  panel.innerHTML = `<div class="httl">참여자 허브 진행 단계</div>
    <div class="htbtns">${ACTIVE_SESSIONS.map(id =>
      `<button class="tcbtn ${id === activeSession ? 'on' : ''}" data-p="${id}">${PHASE_LABEL[id]}</button>`).join('')}</div>`;
  panel.querySelectorAll('.tcbtn').forEach(b => {
    b.onclick = e => {
      e.stopPropagation(); // renderTeamsMenu()와 같은 이유(버블링 시 바깥 클릭으로 오인돼 곧장 닫힘)
      activeSession = b.dataset.p;
      hostSet(path(), { activeSession });
      renderPhaseMenu();
    };
  });
}
function togglePhaseMenu(force) {
  phaseMenuOpen = force !== undefined ? force : !phaseMenuOpen;
  document.getElementById('phasePanel')?.classList.toggle('open', phaseMenuOpen);
  document.getElementById('bPhase')?.classList.toggle('active', phaseMenuOpen);
}

// 오늘 진행할 조 수 — ☰ 패널 안의 버튼 목록을 그린다(값이 바뀔 때마다 다시 호출)
function renderTeamsMenu() {
  const panel = document.getElementById('teamsPanel');
  if (!panel || !forum) return;
  const opts = [3, 4, 5, 6, 7, 8].filter(n => n <= forum.teams.length);
  panel.innerHTML = `<div class="httl">오늘 진행할 조 수</div>
    <div class="htbtns">${opts.map(n =>
      `<button class="tcbtn ${n === teamCount ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>`;
  panel.querySelectorAll('.tcbtn').forEach(b => {
    b.onclick = e => {
      // renderTeamsMenu()가 패널 안쪽을 통째로 새로 그리면서 지금 누른 버튼을 DOM에서 떼어내므로,
      // 이 클릭이 document까지 버블링되면 "바깥 클릭"으로 오인돼 패널이 곧장 닫혀버린다 — 막는다.
      e.stopPropagation();
      teamCount = Number(b.dataset.n);
      hostSet(path(), { teamCount });
      renderTeamsMenu();
    };
  });
}
function toggleTeamsMenu(force) {
  teamsMenuOpen = force !== undefined ? force : !teamsMenuOpen;
  document.getElementById('teamsPanel')?.classList.toggle('open', teamsMenuOpen);
  document.getElementById('bTeams')?.classList.toggle('active', teamsMenuOpen);
}

const ctx = (opts = {}) => ({
  root, forum, hostKey,
  setControls, setKeys,
  goSession,
  // true면 "화살표로 옆 세션에서 이어서 넘어옴"(그 세션이 기억해 둔 마지막 페이지부터),
  // false/생략이면 "탭바를 직접 눌러 들어옴" — 이때는 그 세션의 첫 페이지부터 보여준다.
  // 어느 쪽을 볼지는 opening.js/talk.js/board.js/home.js가 각자 판단한다.
  resume: !!opts.resume,
});

async function goSession(id, opts = {}) {
  const mod = byId[id];
  if (!mod) return console.error('알 수 없는 세션', id);
  if (current?.instance?.unmount) { try { current.instance.unmount(); } catch (e) { console.error(e); } }
  current = { id, instance: null };
  setControls([]); setKeys({});
  root.innerHTML = '';
  current.instance = mod.mount(ctx(opts)) || {};
  current.id = mod.id;
  renderTabbar();
  // 팀 화면이 "지금 어느 세션인지"를 알 수 있도록 forum 문서 자체에 기록해 둔다
  // (forums/{FORUM_ID} 문서 필드 하나. 별도 컬렉션이 필요 없는 가장 단순한 경로).
  hostSet(path(), { session: id });
}

/* ---- 무대 모드 ---- */
function toggleStage() {
  stageMode = !stageMode;
  document.body.classList.toggle('fs', stageMode);
  const btn = document.getElementById('bFs');
  if (btn) btn.textContent = stageMode ? '⛶ 전체화면 끄기' : '⛶ 전체화면';
  if (stageMode) document.documentElement.requestFullscreen?.().catch(() => {});
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
  if (e.key === 'f' || e.key === 'F') { toggleStage(); return; }
  if (e.key === 'Escape' && (teamsMenuOpen || phaseMenuOpen)) { toggleTeamsMenu(false); togglePhaseMenu(false); return; }
  if (e.key === 'Escape' && stageMode) { toggleStage(); return; }
  if (e.key === 'h' || e.key === 'H') { ctl.classList.toggle('hidden'); return; }
  const fn = currentKeys[e.key] || currentKeys[e.code];
  if (fn) { e.preventDefault(); fn(); }
});

// ☰·▶ 메뉴 바깥을 클릭하면 닫는다. 여기서 한 번만 등록해 두면(renderTabbar가 아니라)
// 탭바가 몇 번을 다시 그려져도 리스너가 중복으로 쌓이지 않는다.
document.addEventListener('click', e => {
  if (teamsMenuOpen) {
    const panel = document.getElementById('teamsPanel'), btn = document.getElementById('bTeams');
    if (panel && !panel.contains(e.target) && e.target !== btn) toggleTeamsMenu(false);
  }
  if (phaseMenuOpen) {
    const panel = document.getElementById('phasePanel'), btn = document.getElementById('bPhase');
    if (panel && !panel.contains(e.target) && e.target !== btn) togglePhaseMenu(false);
  }
});

// 무대(#stage) 안의 빈 공간을 클릭해도 오른쪽 화살표와 똑같이 다음으로 넘어간다 —
// 프레젠테이션 클릭 넘김처럼, 무선 포인터(대부분 클릭이나 페이지다운을 보낸다)로도 진행할 수 있게.
// 세션이 자기만의 동작을 두는 요소(카드 클릭, 사진 확대 등)는 그 요소의 클릭 핸들러가
// stopPropagation()으로 여기까지 안 올라오게 막아 둔다.
root.addEventListener('click', e => {
  if (e.target.closest('button, a, input, textarea, select, [data-no-advance]')) return;
  currentKeys.ArrowRight?.();
});

/* ---- 시작 ---- */
(async function start() {
  if (!hostKey) {
    root.innerHTML = `<div class="slide"><h2>진행자 키가 필요합니다</h2>
      <p class="sub">host.html?k=진행자키 형식의 주소로 접속하세요.</p></div>`;
    return;
  }
  try {
    forum = await loadForum();
    document.title = forum.title + ' · 진행자';
    teamCount = forum.teamCount || forum.teams.length;
  } catch (e) {
    root.innerHTML = `<div class="slide"><h2>content/forum.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`;
    return;
  }
  await ensureAuth();
  offline(false);
  goSession('home');
  // 조 수·진행 단계가 다른 경로(예: 페이지를 새로고침해 다시 열었을 때 이전 값)로
  // 바뀌어도 ☰·▶ 메뉴가 항상 최신값을 보여주도록
  watch(path(), snap => {
    const n = Number(snap?.teamCount);
    if (n && n !== teamCount) { teamCount = n; renderTeamsMenu(); }
    const a = snap?.activeSession;
    if (a && a !== activeSession) { activeSession = a; renderPhaseMenu(); }
  });
})();
