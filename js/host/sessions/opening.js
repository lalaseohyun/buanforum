/* ───────────────────────────────────────
   1. 오프닝 스몰토크 — 진행자 화면
   2단계뿐이다: 인트로(제목) → 화살표 → 질문 2개를 한 화면에 동시 노출.

   고칠 때 ─ 제목·질문 문구        → content/01-opening.json
             넘기는 방식·버튼      → 이 파일
             질문 박스 레이아웃    → css/sessions/slides.css (.toppage/.boxrow/.qbox)
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/opening.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc, nl2br, fitScale, refitOnFontsReady } from '../../util.js';
import { loadOpening } from '../../content.js';
import { hostSet, path } from '../../db.js';

// 화살표로 옆 세션에서 이어서 들어올 때만(ctx.resume) 마지막으로 보던 페이지를 이어서 보여준다.
// 탭바를 직접 눌러 들어오면 항상 처음(인트로)부터 — 모듈 스코프에는 "이어서 볼 때 쓸" 값만 둔다.
let lastIndex = 0;

export default {
  id: 'opening',
  title: '오프닝 스몰토크',
  mount(ctx) {
    let data = null, index = ctx.resume ? lastIndex : 0; // 0 = 인트로, 1 = 질문 2개

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
      // content/01-opening.json이 아직 안 왔는데 화살표를 빨리 누르면(느린 네트워크 등)
      // next()/prev()가 render()를 부르는데 data가 없어 죽는 문제 — 로드 전엔 조용히 무시.
      if (!data) return;
      lastIndex = index;
      index === 0 ? renderIntro() : renderQuestions();
      // 질문 박스 글자를 이 화면에 딱 맞게 (css/sessions/slides.css의 --bs).
      // ⚠ 그냥 이 자리에서 바로 부른다(setTimeout/rAF로 미루지 않는다) — innerHTML을 넣은
      // 직후에 scrollHeight를 읽으면 브라우저가 그 순간 레이아웃만 계산해 줄 뿐, 아직
      // 화면에 "그려서 보여주지"는 않는다(페인트는 이 함수가 다 끝나고 브라우저에
      // 제어권을 돌려준 다음에 한 번만 일어난다). 미루면 그 사이에 큰 크기로 한 번
      // 그려졌다가 줄어드는 게 눈에 보였다("화살표 누르면 글씨가 커졌다 작아졌다 해",
      // 2026-09-08) — 지금처럼 즉시 부르면 그 깜빡임이 아예 없다.
      if (index === 1) {
        const box = ctx.root.querySelector('.boxrow');
        const opts = { min: .5, max: 1, prop: '--bs' };
        fitScale(box, opts);
        refitOnFontsReady(box, () => fitScale(box, opts));
      }
      ctx.setControls([
        { label: index === 0 ? '◀ 홈으로' : '◀ 이전', onClick: prev },
        { label: index >= 1 ? '오프닝 끝' : '다음 ▶', onClick: next, variant: 'primary' },
      ]);
      hostSet(path('slides', 'opening'), { index });
    }
    // 퀴즈는 언제나 지금 Firestore에 있는 진짜 진행 상태를 그대로 보여준다(대기화면이면
    // 대기화면, 이미 진행 중이면 그 문제) — 탭바를 눌러 들어올 때와 똑같다(quiz.js 참고).
    function next() { if (index < 1) { index++; render(); } else ctx.goSession('quiz'); }
    function prev() { if (index > 0) { index--; render(); } else ctx.goSession('home', { resume: true }); }

    loadOpening().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/01-opening.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
