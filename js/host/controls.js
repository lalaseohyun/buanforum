/* ───────────────────────────────────────
   하단 조작바 렌더러 — 세션이 setControls()로 준 버튼 배열을 그린다.
   버튼 자체의 문구·활성 조건은 각 세션 파일(js/host/sessions/*.js)이 정한다.
   여기서는 "어떻게 그리는가"만 담당한다.
   ─────────────────────────────────────── */
import { esc } from '../util.js';

/**
 * @param {HTMLElement} row1El
 * @param {Array<{label:string, onClick:Function, variant?:'primary'|'ghost'|'danger', ready?:boolean, disabled?:boolean}>} buttons
 */
export function renderControls(row1El, buttons) {
  row1El.innerHTML = buttons.map((b, i) => `
    <button data-i="${i}" class="${b.variant || ''} ${b.ready ? 'ready' : ''}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>
  `).join('');
  [...row1El.querySelectorAll('button')].forEach((btn, i) => { btn.onclick = buttons[i].onClick; });
}
