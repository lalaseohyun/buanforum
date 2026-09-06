/* ───────────────────────────────────────
   3. 토크콘서트 — 진행자 화면. opening.js와 같은 렌더 구조를 쓰되
   패널 소개 카드가 맨 앞에 하나 더 붙는다.

   고칠 때 ─ 큐시트·패널 소개      → content/03-talk.json
             넘기는 방식·버튼      → 이 파일
             색·레이아웃           → css/sessions/slides.css (opening.js와 공용)
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/talk.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadTalk } from '../../content.js';
import { hostSet, path } from '../../db.js';

export default {
  id: 'talk',
  title: '토크콘서트',
  mount(ctx) {
    let data = null, index = -1; // -1 = 패널 소개, 0.. = rounds

    // 화살표로 넘기는 페이지 수를 하단 노란 점으로 (패널 소개 1 + 라운드 수)
    const dots = () => `<div class="pagedots">${Array.from({ length: data.rounds.length + 1 }, (_, i) =>
      `<i class="${i === index + 1 ? 'on' : ''}"></i>`).join('')}</div>`;

    function renderPanels() {
      const cards = data.panels.map(p => `
        <div class="panel"><div class="name">${esc(p.name)}</div><div class="role">${esc(p.role)}</div></div>`).join('');
      ctx.root.innerHTML = `<div class="slide">
        <div class="kicker">토크콘서트</div><h2>농촌에서 청년으로 살아간다는 것</h2>
        <div class="panels">${cards}</div></div>${dots()}`;
    }
    function renderRound() {
      const r = data.rounds[index];
      ctx.root.innerHTML = `<div class="slide">
        <span class="round">${esc(r.kicker)}</span>
        <h2>${esc(r.title)}</h2>
        ${r.lines.filter(Boolean).map(l => `<p class="sub">${esc(l)}</p>`).join('')}
      </div>${dots()}`;
    }
    function render() {
      index < 0 ? renderPanels() : renderRound();
      ctx.setControls([
        { label: '◀ 이전', onClick: prev, disabled: index <= -1 },
        { label: index >= data.rounds.length - 1 ? '토크콘서트 끝' : '다음 ▶', onClick: next, variant: 'primary' },
      ]);
      hostSet(path('slides', 'talk'), { index });
    }
    function next() { if (index < data.rounds.length - 1) { index++; render(); } else ctx.goSession('board'); }
    function prev() { if (index > -1) { index--; render(); } }

    loadTalk().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/03-talk.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
