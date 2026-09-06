/* ───────────────────────────────────────
   홈 — 타이틀 화면 → 클릭/방향키 → 2×2(5개면 3줄) 진행순서 카드.
   카드를 누르면 해당 세션으로 이동한다(하단 탭바를 누른 것과 동일).

   타이틀 화면은 디자인 캔버스 목업에서 자유 배치한 좌표를 그대로 쓴다.
   1600×801 무대를 화면 크기에 맞춰 통째로 확대/축소하므로(js/util.js fitStage),
   어느 해상도에서 열어도 목업과 같은 그림이 나온다.

   고칠 때 ─ 행사명·날짜·주제 문구   → content/forum.json
             요소 위치(left/top)     → 아래 STAGE의 숫자 (1600×801 기준 px)
             로고 이미지 파일         → assets/laain-logo-white-full.png
             카드 화면               → 아래 renderCards + css/sessions/slides.css
   ─────────────────────────────────────── */
import { esc, fitStage } from '../../util.js';

export default {
  id: 'home',
  title: '홈',
  mount(ctx) {
    let showCards = false;
    let stopFit = null;

    function renderTitle() {
      const f = ctx.forum;
      ctx.root.innerHTML = `
        <div class="stagewrap">
          <div class="stage1600" id="homeStage">
            <h1 class="abs" style="left:542px;top:223px;font-size:56px;font-weight:800;letter-spacing:-.04em;line-height:1.2;color:var(--ink)">${esc(f.title)}</h1>
            <span class="abs" style="left:276px;top:306px;font-size:76px;font-weight:700;letter-spacing:-.02em;color:var(--yellow)">${esc(f.subtitle || '')}</span>
            <div class="abs" style="left:650px;top:471px;width:300px;text-align:center;font-size:25px;font-weight:800;letter-spacing:.14em;color:#D2D0CB">${esc(f.date || '')}</div>
            <div class="abs homelogo" style="left:615px;top:622px;width:383px;height:88px">
              <img src="assets/laain-logo-white-full.png" alt="라인교육연구소" style="width:383px;height:88px"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
              <span style="display:none">라인교육연구소</span>
            </div>
          </div>
        </div>`;
      stopFit = fitStage(document.getElementById('homeStage'));
      ctx.root.onclick = () => { showCards = true; render(); };
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
      showCards ? renderCards() : renderTitle();
    }
    render();

    ctx.setControls([]);
    ctx.setKeys({
      ' ': () => { if (!showCards) { showCards = true; render(); } },
      ArrowRight: () => { if (!showCards) { showCards = true; render(); } },
      ArrowLeft: () => { if (showCards) { showCards = false; render(); } },
    });

    return { unmount() { if (stopFit) stopFit(); ctx.root.onclick = null; } };
  },
};
