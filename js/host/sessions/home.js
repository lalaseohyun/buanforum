/* ───────────────────────────────────────
   홈 — 타이틀 화면 → 클릭/방향키 → 2×2(5개면 3줄) 진행순서 카드.
   카드를 누르면 해당 세션으로 이동한다(하단 탭바를 누른 것과 동일).
   화살표는 전체 세션을 한 줄로 잇는다 ─ 카드 화면에서 더 가면 1.오프닝으로 넘어가고,
   1.오프닝의 첫 페이지에서 뒤로 가면 다시 여기(카드 화면)로 돌아온다.
   단, 하단 탭바의 "홈"을 직접 누르면 화살표로 어디까지 갔었든 항상 타이틀 화면부터 보여준다
   (ctx.resume이 false일 때 — js/host/main.js goSession 참고).

   타이틀 화면은 디자인 캔버스 목업에서 자유 배치한 좌표를 그대로 쓴다.
   1600×801 무대를 화면 크기에 맞춰 통째로 확대/축소하므로(js/util.js fitStage),
   어느 해상도에서 열어도 목업과 같은 그림이 나온다.

   오늘 몇 조로 진행할지는 여기가 아니라 탭바 ☰ 메뉴(js/host/main.js)에서 고른다 —
   빔프로젝터에 그대로 뜨는 타이틀 화면에 조작 버튼을 안 두려고 일부러 뺐다.

   타이틀 화면 네 줄(제목·부제·날짜·로고)은 모두 가로 가운데 정렬이다 —
   left:50%+transform:translateX(-50%)로 폭이 얼마든 항상 무대 중앙에 온다.
   top만 조절하면 세로 위치가 바뀐다.

   고칠 때 ─ 행사명·날짜·주제 문구   → content/forum.json
             요소 위치(top, 세로만)  → 아래 STAGE의 숫자 (1600×801 기준 px)
             로고 이미지 파일         → assets/laain-logo-white-full.png
             카드 화면               → 아래 renderCards + css/sessions/slides.css
   ─────────────────────────────────────── */
import { esc, fitStage } from '../../util.js';

// 화살표로 옆 세션에서 이어서 들어올 때만(ctx.resume) 마지막으로 보던 화면(타이틀/카드)을 쓴다.
// 탭바의 "홈" 버튼을 직접 누르면 항상 타이틀 화면부터 — 모듈 스코프에는 "이어서 볼 때 쓸" 값만 둔다.
let lastShowCards = false;

export default {
  id: 'home',
  title: '홈',
  mount(ctx) {
    let showCards = ctx.resume ? lastShowCards : false;
    let stopFit = null;

    function renderTitle() {
      const f = ctx.forum;
      ctx.root.innerHTML = `
        <div class="stagewrap">
          <div class="stage1600" id="homeStage">
            <h1 class="abs" style="left:50%;top:223px;transform:translateX(-50%);white-space:nowrap;font-size:56px;font-weight:800;letter-spacing:-.04em;line-height:1.2;color:var(--ink)">${esc(f.title)}</h1>
            <span class="abs" style="left:50%;top:306px;transform:translateX(-50%);white-space:nowrap;font-size:76px;font-weight:700;letter-spacing:-.02em;color:var(--yellow)">${esc(f.subtitle || '')}</span>
            <div class="abs" style="left:50%;top:471px;width:300px;transform:translateX(-50%);text-align:center;font-size:25px;font-weight:800;letter-spacing:.14em;color:#D2D0CB">${esc(f.date || '')}</div>
            <div class="abs homelogo" style="left:50%;top:622px;width:383px;height:88px;transform:translateX(-50%)">
              <img src="assets/laain-logo-white-full.png" alt="라인교육연구소" style="width:383px;height:88px"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
              <span style="display:none">라인교육연구소</span>
            </div>
          </div>
        </div>`;
      stopFit = fitStage(document.getElementById('homeStage'));
      ctx.root.onclick = goNext;
    }

    function renderCards() {
      ctx.root.onclick = null;
      const cards = ctx.forum.sessions.map(s => `
        <div class="homecard" data-s="${s.id}">
          <div class="n">${s.no}</div>
          <div class="t">${esc(s.title)}</div>
          <div class="s">${esc(s.subtitle || '')}</div>
        </div>`).join('');
      ctx.root.innerHTML = `<div class="homegrid">${cards}</div>`;
      ctx.root.querySelectorAll('.homecard').forEach(el => {
        el.onclick = () => ctx.goSession(el.dataset.s);
      });
    }

    function render() {
      if (stopFit) { stopFit(); stopFit = null; }
      lastShowCards = showCards;
      ctx.setControls(showCards
        ? [{ label: '◀ 처음 화면', onClick: goPrev }, { label: '1. 오프닝으로 ▶', variant: 'primary', onClick: () => ctx.goSession('opening', { resume: true }) }]
        : []);
      showCards ? renderCards() : renderTitle();
    }
    function goNext() { if (!showCards) { showCards = true; render(); } else { ctx.goSession('opening', { resume: true }); } }
    function goPrev() { if (showCards) { showCards = false; render(); } }

    render();
    ctx.setKeys({ ' ': goNext, ArrowRight: goNext, ArrowLeft: goPrev });

    return { unmount() { if (stopFit) stopFit(); ctx.root.onclick = null; } };
  },
};
