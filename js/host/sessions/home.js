/* ───────────────────────────────────────
   홈 — 타이틀 화면 → 클릭/방향키 → 2×2(5개면 3줄) 진행순서 카드.
   카드를 누르면 해당 세션으로 이동한다(하단 탭바를 누른 것과 동일).

   고칠 때 ─ 행사명·세션 이름       → content/forum.json
             카드 배치·타이틀 화면  → 이 파일 + css/sessions/slides.css
             로고 이미지 파일        → assets/laain-logo-white.png (검정 배경용 흰색 버전)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';

export default {
  id: 'home',
  title: '홈',
  mount(ctx) {
    let showCards = false;

    function render() {
      if (!showCards) {
        ctx.root.innerHTML = `
          <div class="slide">
            <div class="homekicker">${esc(ctx.forum.date || '')}</div>
            <h2 class="hometitle">${esc(ctx.forum.title)}</h2>
            <p class="homesub">${esc(ctx.forum.subtitle || '')}</p>
          </div>
          <div class="homelogo">
            <img src="assets/laain-logo-white.png" alt="라인교육연구소"
              onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
            <span style="display:none">라인교육연구소</span>
          </div>`;
        ctx.root.onclick = () => { showCards = true; render(); };
      } else {
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
    }
    render();

    ctx.setControls([]);
    ctx.setKeys({
      ' ': () => { if (!showCards) { showCards = true; render(); } },
      ArrowRight: () => { if (!showCards) { showCards = true; render(); } },
      ArrowLeft: () => { if (showCards) { showCards = false; render(); } },
    });

    return { unmount() { ctx.root.onclick = null; } };
  },
};
