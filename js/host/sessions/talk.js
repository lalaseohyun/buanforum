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
import { esc, nl2br, fitScale, refitOnFontsReady } from '../../util.js';
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
      // slide-panels ─ 이 화면만 제목을 한 단계 작게 쓴다. 기본 .slide h2(164px)로는
      // "농촌에서 청년으로 살아간다는 것"이 두 줄로 꺾여 407px를 먹고, 그만큼 아래 패널
      // 카드가 납작해졌다(1920에서 235px밖에 안 남았다 — 2026-09-08 실측).
      ctx.root.innerHTML = `<div class="slide slide-panels">
        <div class="kicker">토크콘서트</div><h2>농촌에서 청년으로 살아간다는 것</h2>
        <div class="panels">${cards}</div></div>${dots()}`;
    }
    function renderRounds() {
      const boxes = data.rounds.map(r => `
        <div class="qbox">
          <div class="badge-step">${esc(r.kicker)}</div>
          <div class="qt">${nl2br(r.title)}</div>
          ${(r.lines || []).filter(Boolean).map(l => `<div class="qs">${esc(l)}</div>`).join('')}
        </div>`).join('');
      // 제목(토크콘서트)은 kicker 클래스라 자동으로 노란색이다(opening.js와 같은 스타일)
      ctx.root.innerHTML = `<div class="toppage">
        <div class="toppage-head"><div class="kicker">토크콘서트</div><h2>농촌에서 청년으로 살아간다는 것</h2></div>
        <div class="boxrow cols-4">${boxes}</div>
      </div>${dots()}`;
    }
    function render() {
      // content/03-talk.json이 아직 안 왔는데 화살표를 빨리 누르면(느린 네트워크 등)
      // next()/prev()가 render()를 부르는데 data가 없어 죽는 문제 — 로드 전엔 조용히 무시.
      if (!data) return;
      lastIndex = index;
      index === 0 ? renderPanels() : renderRounds();
      // ROUND 박스 4개 글자를 이 화면에 딱 맞게 (css/sessions/slides.css의 --bs).
      // ⚠ 미루지 않고 바로 부른다 — opening.js의 같은 자리 설명 참고
      // ("화살표 누르면 글씨가 커졌다 작아졌다 해" 깜빡임의 원인이었다, 2026-09-08).
      if (index === 1) {
        const box = ctx.root.querySelector('.boxrow');
        const opts = { min: .5, max: 1, prop: '--bs' };
        fitScale(box, opts);
        refitOnFontsReady(box, () => fitScale(box, opts));
      }
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
