/* ───────────────────────────────────────
   4. 원탁토론 — 참여자(모바일) 화면. STEP1~3 안내를 그대로 보여준다
   (참가자는 스스로 진행하지 않으므로 인트로/STEP 구분 없이 한 화면에 모아 보여준다).

   사진 업로드·하트는 이 세션이 아니라 5. 대표정책(./policy.js)에서 한다.

   고칠 때 ─ 문구           → content/04-board.json
             화면 구성       → 이 파일
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadBoard } from '../../content.js';

export default {
  id: 'board',
  mount(ctx) {
    function render(data) {
      const boxes = data.steps.map(s => `
        <div class="qbox">
          <div class="badge-step">STEP ${s.no}</div>
          <div class="qt">${esc(s.text)}</div>
          ${s.note ? `<div class="qnote">${esc(s.note)}</div>` : ''}
        </div>`).join('');
      ctx.root.innerHTML = `
        <div class="h">${esc(data.intro.title)}</div>
        <div class="sub">${esc(data.intro.question)}</div>
        <div class="boxrow" style="margin-top:22px">${boxes}</div>`;
    }
    ctx.root.innerHTML = `<div class="center"><div class="pulse"></div></div>`;
    loadBoard().then(render);
    return { unmount() {} };
  },
};
