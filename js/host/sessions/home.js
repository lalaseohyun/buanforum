/* ───────────────────────────────────────
   홈 — 타이틀 화면 → 클릭/방향키 → 2×2 진행순서 카드.
   카드를 누르면 해당 세션으로 이동한다(하단 탭바를 누른 것과 동일).

   고칠 때 ─ 행사명·세션 이름       → content/forum.json
             카드 배치·타이틀 화면  → 이 파일 + css/sessions/slides.css
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
            <div class="kicker">${esc(ctx.forum.date || '')}</div>
            <h2>${esc(ctx.forum.title)}</h2>
            <p class="sub">${esc(ctx.forum.subtitle || '')}</p>
            <p class="sub" style="margin-top:24px">클릭하거나 방향키를 누르면 진행 순서로 이동합니다</p>
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
