/* ───────────────────────────────────────
   1. 오프닝 스몰토크 — 진행자 화면
   2단계뿐이다: 인트로(제목) → 화살표 → 질문 2개를 한 화면에 동시 노출.

   고칠 때 ─ 제목·질문 문구        → content/01-opening.json
             넘기는 방식·버튼      → 이 파일
             질문 박스 레이아웃    → css/sessions/slides.css (.toppage/.boxrow/.qbox)
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/opening.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc, nl2br } from '../../util.js';
import { loadOpening } from '../../content.js';
import { hostSet, path } from '../../db.js';

// 이 세션을 나갔다가(다른 탭 클릭 등) 화살표로 되돌아왔을 때 처음부터 다시 보여주지
// 않도록, 모듈 스코프에 마지막으로 보던 페이지를 기억해 둔다(진행자 브라우저 탭 하나 기준).
let lastIndex = 0;

export default {
  id: 'opening',
  title: '오프닝 스몰토크',
  mount(ctx) {
    let data = null, index = lastIndex; // 0 = 인트로, 1 = 질문 2개

    // 화살표로 넘기는 페이지 수를 하단 노란 점으로 (전체 2페이지)
    const dots = () => `<div class="pagedots">${[0, 1].map(i =>
      `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>`;

    function renderIntro() {
      const c = data.intro;
      ctx.root.innerHTML = `<div class="slide">
        <div class="kicker">${esc(c.kicker)}</div>
        <h2>${esc(c.title)}</h2>
        ${c.lines.map(l => `<p class="sub">${esc(l)}</p>`).join('')}
      </div>${dots()}`;
    }
    function renderQuestions() {
      const c = data.intro;
      const boxes = data.questions.map(q => `
        <div class="qbox">
          <div class="qt">${nl2br(q.title)}</div>
          ${q.lines.map(l => `<div class="qs">${esc(l)}</div>`).join('')}
        </div>`).join('');
      ctx.root.innerHTML = `<div class="toppage">
        <div class="toppage-head"><div class="kicker">${esc(c.kicker)}</div><h2>${esc(c.title)}</h2></div>
        <div class="boxrow cols-2">${boxes}</div>
      </div>${dots()}`;
    }
    function render() {
      lastIndex = index;
      index === 0 ? renderIntro() : renderQuestions();
      ctx.setControls([
        { label: index === 0 ? '◀ 홈으로' : '◀ 이전', onClick: prev },
        { label: index >= 1 ? '오프닝 끝' : '다음 ▶', onClick: next, variant: 'primary' },
      ]);
      hostSet(path('slides', 'opening'), { index });
    }
    function next() { if (index < 1) { index++; render(); } else ctx.goSession('quiz'); }
    function prev() { if (index > 0) { index--; render(); } else ctx.goSession('home'); }

    loadOpening().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/01-opening.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
