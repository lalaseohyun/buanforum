/* ───────────────────────────────────────
   4. 원탁토론 — 진행자 화면. 인트로(제목) → 화살표 → STEP1~3.
   참고자료(예산표)는 STEP 화면에서 버튼으로 접었다 펼 수 있다.

   사진 업로드·갤러리·하트("발표모드")는 이 세션이 아니라
   5. 대표정책(./policy.js)에서 다룬다 — 예전엔 이 세션 안의 모드였지만
   독립 탭으로 분리됐다.

   고칠 때 ─ 첫 화면 문구·STEP·참고자료   → content/04-board.json
             넘기는 방식·버튼             → 이 파일
             STEP 박스 레이아웃           → css/sessions/slides.css (.toppage/.boxrow/.qbox)
             참고자료 패널 스타일         → css/sessions/board.css
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/board.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadBoard } from '../../content.js';
import { hostSet, path } from '../../db.js';

export default {
  id: 'board',
  title: '원탁토론',
  mount(ctx) {
    let data = null, index = 0; // 0 = 인트로, 1 = STEP1~3
    let refOpen = false;

    function renderIntro() {
      const c = data.intro;
      ctx.root.innerHTML = `<div class="slide">
        <h2>${esc(c.title)}</h2>
        <p class="sub">${esc(c.subtitle)}</p>
        <p>${esc(c.question)}</p>
      </div>`;
    }
    function renderSteps() {
      const c = data.intro;
      const boxes = data.steps.map(s => `
        <div class="qbox">
          <div class="badge-step">STEP ${s.no}</div>
          <div class="qt">${esc(s.text)}</div>
          ${s.note ? `<div class="qnote">${esc(s.note)}</div>` : ''}
        </div>`).join('');
      const ref = data.reference;
      const refPanel = refOpen ? `<div class="refbox" style="margin-top:clamp(16px,2.4vh,32px)">
        <h4>${esc(ref.title)}</h4>
        ${ref.summary.map(s => `<div class="stat"><span>${esc(s.k)}</span><b>${esc(s.v)}</b></div>`).join('')}
        <table>${ref.byField.map(f => `<tr><td>${esc(f.field)}</td><td class="num">${esc(f.amount)} (${esc(f.pct)})</td></tr>`).join('')}</table>
      </div>` : '';
      ctx.root.innerHTML = `<div class="toppage">
        <div class="toppage-head"><h2>${esc(c.title)}</h2><p>${esc(c.subtitle)}</p></div>
        <div class="boxrow cols-3">${boxes}</div>
        ${refPanel}
      </div>`;
    }
    function render() {
      index === 0 ? renderIntro() : renderSteps();
      const btns = [
        { label: '◀ 이전', onClick: prev, disabled: index === 0 },
        { label: index >= 1 ? '대표정책으로' : '다음 ▶', onClick: next, variant: 'primary' },
      ];
      if (index === 1) btns.push({ label: refOpen ? '참고자료 접기' : '참고자료 보기', variant: 'ghost', onClick: () => { refOpen = !refOpen; render(); } });
      ctx.setControls(btns);
      hostSet(path('slides', 'board'), { index });
    }
    function next() { if (index < 1) { index++; render(); } else ctx.goSession('policy'); }
    function prev() { if (index > 0) { index--; render(); } }

    loadBoard().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/04-board.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
