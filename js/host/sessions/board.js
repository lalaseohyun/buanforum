/* ───────────────────────────────────────
   4. 원탁토론 — 진행자 화면. 인트로(제목) → 화살표 → STEP1~3 → 참고자료 개요(5개 분야
   박스 1장) → 참고자료 P1~P5(분야별 상세, 5장). 총 8페이지.
   참고자료는 STEP 화면에서 버튼으로 접었다 펼 수 있는 요약 패널과는 별개로,
   화살표로 한 장씩 넘겨 보는 전용 페이지들이다. docs/청년정책_49개사업_분야별페이지_구상안.md의
   구성을 옮기되, 분야 상세 페이지 앞에 개요 페이지를 하나 더 두고 하단 인사이트 박스는 뺐다.

   사진 업로드·갤러리·하트("발표모드")는 이 세션이 아니라
   5. 대표정책(./policy.js)에서 다룬다 — 예전엔 이 세션 안의 모드였지만
   독립 탭으로 분리됐다.

   고칠 때 ─ 첫 화면 문구·STEP·요약 패널   → content/04-board.json
             분야별 참고자료 사업 목록      → src/data/policies-2026.json
             넘기는 방식·버튼               → 이 파일
             STEP 박스 레이아웃             → css/sessions/slides.css (.toppage/.boxrow/.qbox)
             참고자료 패널·페이지 스타일    → css/sessions/board.css
   쓰는 것 ─ js/content.js(로더) · js/db.js(slides/board.index 기록 — 팀 화면 동기화용)
   ─────────────────────────────────────── */
import { esc, nl2br, fitScale, refitOnFontsReady } from '../../util.js';
import { loadBoard, loadPolicies } from '../../content.js';
import { hostSet, path } from '../../db.js';

// opening.js와 같은 이유로, 화살표로 이어서 들어올 때만(ctx.resume) 마지막 페이지를 쓴다.
let lastIndex = 0;

export default {
  id: 'board',
  title: '원탁토론',
  mount(ctx) {
    // 0 = 인트로, 1 = STEP1~3, 2 = 참고자료 개요(5개 분야 박스), 3~7 = 참고자료 P1~P5(분야별).
    // 분야 수는 policies.fields.length로 정해진다.
    let data = null, policies = null, index = ctx.resume ? lastIndex : 0;
    let refOpen = false;

    const fieldCount = () => policies?.fields.length || 0;
    const totalPages = () => 3 + fieldCount();
    const fieldOf = () => policies.fields[index - 3];

    // 화살표로 넘기는 페이지 수를 하단 노란 점으로
    const dots = () => `<div class="pagedots">${Array.from({ length: totalPages() }, (_, i) =>
      `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>`;

    function renderIntro() {
      // 1.오프닝 메인페이지와 같은 레이아웃 — 작은 노란 kicker(세션 이름) 위에,
      // 큰 흰 제목(테마 문구), 그 아래 회색 한 줄(질문)
      const c = data.intro;
      ctx.root.innerHTML = `<div class="slide">
        <div class="kicker">${esc(c.title)}</div>
        <h2>${esc(c.subtitle)}</h2>
        <p class="sub">${esc(c.question)}</p>
      </div>${dots()}`;
    }
    function renderSteps() {
      const c = data.intro;
      const boxes = data.steps.map(s => `
        <div class="qbox">
          <div class="badge-step">STEP ${s.no}</div>
          <div class="qt">${nl2br(s.text)}</div>
          ${s.note ? `<div class="qnote">${esc(s.note)}</div>` : ''}
        </div>`).join('');
      const ref = data.reference;
      const refPanel = refOpen ? `<div class="refbox" style="margin-top:clamp(16px,2.4vh,32px)">
        <h4>${esc(ref.title)}</h4>
        ${ref.summary.map(s => `<div class="stat"><span>${esc(s.k)}</span><b>${esc(s.v)}</b></div>`).join('')}
        <table>${ref.byField.map(f => `<tr><td>${esc(f.field)}</td><td class="num">${esc(f.amount)} (${esc(f.pct)})</td></tr>`).join('')}</table>
      </div>` : '';
      ctx.root.innerHTML = `<div class="toppage">
        <div class="toppage-head"><h2 class="boardtitle">${esc(c.title)}</h2><p>${esc(c.subtitle)}</p></div>
        <div class="boxrow cols-3">${boxes}</div>
        ${refPanel}
      </div>${dots()}`;
    }
    // 참고자료 개요 — P1~P5로 들어가기 전, 5개 분야를 한 화면에 박스로 보여준다
    function renderOverview() {
      const boxes = policies.fields.map(f => `
        <div class="qbox">
          <div class="qt">${esc(f.name)}</div>
          <div class="qs">${esc(f.subtitle)}</div>
          <div class="qnote">(${f.count}개 사업)</div>
        </div>`).join('');
      // 이 페이지만 제목을 가운데 정렬한다(다른 toppage-head는 왼쪽 정렬 그대로)
      ctx.root.innerHTML = `<div class="toppage">
        <div class="toppage-head center"><h2>2026 부안군 청년정책 시행계획</h2></div>
        <div class="boxrow cols-5">${boxes}</div>
      </div>${dots()}`;
    }
    // 참고자료 P1~P5 — 분야당 한 페이지: 헤더(노란 타원 안에 분야명 + 큰 제목은 소제목) + 사업 표
    function renderField() {
      const f = fieldOf();
      const rows = f.items.map(it => `
        <tr class="${it.highlight ? 'hi' : ''}">
          <td class="num">${it.no}</td>
          <td class="name">${esc(it.name)}${it.isNew ? '<span class="tag-new">신규</span>' : ''}${it.note ? `<span class="tag-note">${esc(it.note)}</span>` : ''}</td>
          <td class="num">${esc(it.amount)}</td>
          <td>${esc(it.dept)}</td>
        </tr>`).join('');
      ctx.root.innerHTML = `<div class="refpage">
        <div class="refpage-head">
          <div class="rf-no">${esc(f.name)}</div>
          <div class="rf-name">${esc(f.subtitle)}</div>
          <div class="rf-stats"><b>${f.count}개 사업</b><span>${esc(f.amount)}</span><span>${esc(f.pct)}</span></div>
        </div>
        <div class="reftable-wrap">
          <table class="reftable">
            <thead><tr><th>#</th><th>사업명</th><th>예산</th><th>담당부서</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>${dots()}`;
    }
    function render() {
      // content/04-board.json·policies-2026.json이 아직 안 왔는데 화살표를 빨리 누르면
      // next()/prev()가 render()를 부르는데 data가 없어 죽는 문제 — 로드 전엔 조용히 무시.
      if (!data || !policies) return;
      lastIndex = index;
      if (index === 0) renderIntro();
      else if (index === 1) renderSteps();
      else if (index === 2) renderOverview();
      // STEP 3개(1페이지)·분야 5개(2페이지) 박스 글자를 그 화면에 딱 맞게 (slides.css의 --bs).
      // ⚠ 미루지 않고 바로 부른다 — 미루면(예전엔 setTimeout) 큰 크기로 한 번 그려졌다가
      // 줄어드는 게 눈에 보였다("화살표 누르면 글씨가 커졌다 작아졌다 해", 2026-09-08).
      if (index === 1 || index === 2) {
        const box = ctx.root.querySelector('.boxrow');
        const opts = { min: .5, max: 1, prop: '--bs' };
        fitScale(box, opts);
        refitOnFontsReady(box, () => fitScale(box, opts));
      }
      if (index >= 3) {
        renderField();
        // 사업 수가 분야마다 3~15개로 달라서 표 글자 크기를 페이지마다 맞춘다. 같은 이유로 바로 부른다.
        const wrap = ctx.root.querySelector('.reftable-wrap');
        const opts = { min: 0.32, max: 1.15, prop: '--rs' };
        fitScale(wrap, opts);
        refitOnFontsReady(wrap, () => fitScale(wrap, opts));
      }
      const btns = [
        { label: index === 0 ? '◀ 토크콘서트로' : '◀ 이전', onClick: prev },
        { label: index >= totalPages() - 1 ? '대표정책으로' : (index === 1 ? '참고자료 보기 ▶' : '다음 ▶'), onClick: next, variant: 'primary' },
      ];
      if (index === 1) btns.push({ label: refOpen ? '참고자료 접기' : '요약 보기', variant: 'ghost', onClick: () => { refOpen = !refOpen; render(); } });
      ctx.setControls(btns);
      hostSet(path('slides', 'board'), { index });
    }
    function next() { if (index < totalPages() - 1) { index++; render(); } else ctx.goSession('policy', { resume: true }); }
    function prev() { if (index > 0) { index--; render(); } else ctx.goSession('talk', { resume: true }); }

    Promise.all([loadBoard(), loadPolicies()]).then(([d, p]) => { data = d; policies = p; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>원탁토론 자료 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() {} };
  },
};
