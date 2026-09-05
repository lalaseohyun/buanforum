/* ───────────────────────────────────────
   1. 오프닝 스몰토크 — 진행자 화면

   고칠 때 ─ 카드 문구            → content/01-opening.json
             넘기는 방식·버튼     → 이 파일
             색·레이아웃          → css/sessions/slides.css (talk.js와 공용)
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/opening.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadOpening } from '../../content.js';
import { hostSet, path } from '../../db.js';

export default {
  id: 'opening',
  title: '오프닝 스몰토크',
  mount(ctx) {
    let data = null, index = 0;

    function render() {
      const c = data.cards[index];
      ctx.root.innerHTML = `
        <div class="slide">
          <div class="kicker">${esc(c.kicker)}</div>
          <h2>${esc(c.title)}</h2>
          ${c.lines.map(l => `<p class="sub">${esc(l)}</p>`).join('')}
          <div class="stepdots">${data.cards.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>
        </div>`;
      ctx.setControls([
        { label: '◀ 이전', onClick: prev, disabled: index === 0 },
        { label: index >= data.cards.length - 1 ? '오프닝 끝' : '다음 ▶', onClick: next, variant: 'primary' },
      ]);
      hostSet(path('slides', 'opening'), { index });
    }
    function next() { if (index < data.cards.length - 1) { index++; render(); } else ctx.goSession('quiz'); }
    function prev() { if (index > 0) { index--; render(); } }

    loadOpening().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/01-opening.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
