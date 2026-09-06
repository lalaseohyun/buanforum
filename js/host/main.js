/* ───────────────────────────────────────
   진행자(빔프로젝터) 셸 — 세션 라우팅 · 탭바 · 전체화면(무대모드) · 단축키 · 연결 상태.

   고칠 때 ─ 세션 하나의 내용/흐름   → js/host/sessions/<해당 세션>.js
             셸 자체(탭바 위치 등)   → 이 파일 + css/host.css
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
   ─────────────────────────────────────── */

import { ensureAuth, getHostKey, hostSet, path } from '../db.js';
import { loadForum } from '../content.js';
import { esc } from '../util.js';
import { renderControls } from './controls.js';

import homeSession from './sessions/home.js';
import openingSession from './sessions/opening.js';
import quizSession from './sessions/quiz.js';
import talkSession from './sessions/talk.js';
import boardSession from './sessions/board.js';
import policySession from './sessions/policy.js';

// 배포할 때마다 올리는 표식. 탭바 오른쪽에 작게 보인다 —
// 브라우저가 예전 파일을 캐시해서 보여주고 있는지 이 숫자로 바로 알 수 있다.
// (GitHub Pages는 정적 파일을 10분간 캐시한다. 강력 새로고침은 Ctrl+Shift+R)
const BUILD = 'v7';

const SESSIONS = [homeSession, openingSession, quizSession, talkSession, boardSession, policySession];
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
    `<button id="bFs">⛶ 전체화면</button>`;
  tabbar.querySelectorAll('button[data-s]').forEach(b => {
    b.onclick = () => goSession(b.dataset.s);
  });
  document.getElementById('bFs').onclick = toggleStage;
}

const ctx = () => ({
  root, forum, hostKey,
  setControls, setKeys,
  goSession,
});

async function goSession(id) {
  const mod = byId[id];
  if (!mod) return console.error('알 수 없는 세션', id);
  if (current?.instance?.unmount) { try { current.instance.unmount(); } catch (e) { console.error(e); } }
  current = { id, instance: null };
  setControls([]); setKeys({});
  root.innerHTML = '';
  current.instance = mod.mount(ctx()) || {};
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
  if (e.key === 'Escape' && stageMode) { toggleStage(); return; }
  if (e.key === 'h' || e.key === 'H') { ctl.classList.toggle('hidden'); return; }
  const fn = currentKeys[e.key] || currentKeys[e.code];
  if (fn) { e.preventDefault(); fn(); }
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
  } catch (e) {
    root.innerHTML = `<div class="slide"><h2>content/forum.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`;
    return;
  }
  await ensureAuth();
  offline(false);
  goSession('home');
})();
