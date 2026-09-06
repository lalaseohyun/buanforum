/* ───────────────────────────────────────
   3. 토크콘서트 — 진행자 화면. 딱 2페이지다: 패널 소개 → 화살표 →
   ROUND 1~4를 원탁토론 STEP 화면과 같은 모양(4단 박스)으로 한 화면에 동시 노출.
   (예전엔 오프닝·라운드 4개·클로징을 한 장씩 넘겨 봤지만, 오프닝·클로징 슬라이드는
   빼고 라운드 4개만 한 화면에 모아 보여주는 지금 구조로 바꿨다.)

   고칠 때 ─ 큐시트·패널 소개      → content/03-talk.json
             넘기는 방식·버튼      → 이 파일
             박스 레이아웃         → css/sessions/slides.css (.toppage/.boxrow.cols-4/.qbox,
                                     opening.js·board.js와 공용)
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/talk.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadTalk } from '../../content.js';
import { hostSet, path } from '../../db.js';

// opening.js와 같은 이유로, 화살표로 이어서 들어올 때만(ctx.resume) 마지막 페이지를 쓴다.
let lastIndex = 0;

export default {
  id: 'talk',
  title: '토크콘서트',
  mount(ctx) {
    let data = null, index = ctx.resume ? lastIndex : 0; // 0 = 패널 소개, 1 = ROUND 1~4

    const dots = () => `<div class="pagedots">${[0, 1].map(i =>
      `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>`;

    function renderPanels() {
      const cards = data.panels.map(p => `
        <div class="panel"><div class="name">${esc(p.name)}</div><div class="role">${esc(p.role)}</div></div>`).join('');
      ctx.root.innerHTML = `<div class="slide">
        <div class="kicker">토크콘서트</div><h2>농촌에서 청년으로 살아간다는 것</h2>
        <div class="panels">${cards}</div></div>${dots()}`;
    }
    function renderRounds() {
      const boxes = data.rounds.map(r => `
        <div class="qbox">
          <div class="badge-step">${esc(r.kicker)}</div>
          <div class="qt">${esc(r.title)}</div>
          ${(r.lines || []).filter(Boolean).map(l => `<div class="qs">${esc(l)}</div>`).join('')}
        </div>`).join('');
      // 제목(토크콘서트)은 kicker 클래스라 자동으로 노란색이다(opening.js와 같은 스타일)
      ctx.root.innerHTML = `<div class="toppage">
        <div class="toppage-head"><div class="kicker">토크콘서트</div><h2>농촌에서 청년으로 살아간다는 것</h2></div>
        <div class="boxrow cols-4">${boxes}</div>
      </div>${dots()}`;
    }
    function render() {
      lastIndex = index;
      index === 0 ? renderPanels() : renderRounds();
      ctx.setControls([
        { label: index === 0 ? '◀ 퀴즈로' : '◀ 이전', onClick: prev },
        { label: index >= 1 ? '토크콘서트 끝' : '다음 ▶', onClick: next, variant: 'primary' },
      ]);
      hostSet(path('slides', 'talk'), { index });
    }
    function next() { if (index < 1) { index++; render(); } else ctx.goSession('board', { resume: true }); }
    function prev() { if (index > 0) { index--; render(); } else ctx.goSession('quiz', { resume: true }); }

    loadTalk().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/03-talk.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
