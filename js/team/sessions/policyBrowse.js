/* ───────────────────────────────────────
   시행계획 — 참여자(모바일) 화면. 허브의 "2026 부안군 청년정책 시행계획" 타일.
   진행자 화면(js/host/sessions/board.js P1~P5)과 같은 원자료(src/data/policies-2026.json)를
   쓰지만, 폰에서는 화살표로 넘기는 대신 [분야 목록] → [분야별 사업 카드 목록] 2단 구조로 보여준다.

     [허브] → [분야 목록 5줄] → [분야별 사업 카드(세로 스크롤)] → (뒤로)
   상세 화면에서는 좌우 스와이프로 인접 분야로 이동할 수 있다.

   항상 열려 있는 타일이라(activeSession과 무관) 조 선택이 필요 없다.

   고칠 때 ─ 사업 목록 자체     → src/data/policies-2026.json
             화면 모양          → css/sessions/policyref.css
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadPolicies } from '../../content.js';

const SWIPE_PX = 50;

export default {
  id: 'policyBrowse',
  mount(ctx) {
    let policies = null;
    let view = 'list';      // 'list' | 'detail'
    let fieldIndex = 0;
    let touchX = null;

    function renderList() {
      const rows = policies.fields.map((f, i) => `
        <button class="pfrow" data-i="${i}">
          <div class="pfrow-main">
            <div class="pfrow-name">${esc(f.name)}</div>
            <div class="pfrow-sub">${esc(f.subtitle)}</div>
          </div>
          <div class="pfrow-meta"><b>${f.count}개</b><span>${esc(f.amount)}</span></div>
          <div class="pfrow-arrow">›</div>
        </button>`).join('');
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 홈으로</span></div>
        <div class="h">${esc(policies.meta.title)}</div>
        <div class="sub">${policies.meta.totalCount}개 사업 · ${esc(policies.meta.totalAmount)}</div>
        <div class="pflist">${rows}</div>`;
      document.getElementById('back').onclick = ctx.backToHub;
      ctx.root.querySelectorAll('.pfrow').forEach(b => {
        b.onclick = () => { fieldIndex = Number(b.dataset.i); view = 'detail'; render(); };
      });
    }

    function renderDetail() {
      const f = policies.fields[fieldIndex];
      const cards = f.items.map(it => `
        <div class="pfcard ${it.highlight ? 'hi' : ''}">
          <div class="pfcard-head">
            <span class="pfcard-no">${it.no}</span>
            <span class="pfcard-name">${esc(it.name)}${it.isNew ? '<span class="tag-new">신규</span>' : ''}</span>
          </div>
          ${it.note ? `<div class="pfcard-note">${esc(it.note)}</div>` : ''}
          <div class="pfcard-meta"><span>${esc(it.amount)}</span><span>${esc(it.dept)}</span></div>
        </div>`).join('');
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 분야 목록</span></div>
        <div class="pfhead">
          <span class="pfhead-pill">${esc(f.name)}</span>
          <div class="pfhead-sub">${esc(f.subtitle)}</div>
          <div class="pfhead-stats"><b>${f.count}개 사업</b><span>${esc(f.amount)}</span><span>${esc(f.pct)}</span></div>
        </div>
        <div class="pfcards" id="pfcards">${cards}</div>
        <div class="pagedots">${policies.fields.map((_, i) => `<i class="${i === fieldIndex ? 'on' : ''}"></i>`).join('')}</div>`;
      document.getElementById('back').onclick = () => { view = 'list'; render(); };
      const wrap = document.getElementById('pfcards');
      wrap.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
      wrap.addEventListener('touchend', e => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) < SWIPE_PX) return;
        // 오른쪽으로 밀면(dx>0) 이전 분야, 왼쪽으로 밀면 다음 분야 — 끝에서는 그냥 멈춘다(순환 없음)
        const next = fieldIndex + (dx > 0 ? -1 : 1);
        if (next >= 0 && next < policies.fields.length) { fieldIndex = next; render(); }
      }, { passive: true });
    }

    function render() { view === 'list' ? renderList() : renderDetail(); }

    ctx.root.innerHTML = `<div class="center"><div class="pulse"></div></div>`;
    loadPolicies().then(p => { policies = p; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="center"><div class="big">자료 로드 실패</div><div class="sub">${esc(e.message)}</div></div>`; });

    return { unmount() {} };
  },
};
