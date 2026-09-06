/* ───────────────────────────────────────
   공통 순수 함수 — 이스케이프 · 문장 분리 · 카드 글자 맞춤(fit).
   브라우저에서만 쓰인다 (score.js와 달리 Node 테스트 대상 아님).
   ─────────────────────────────────────── */

export const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// content/*.json 문구 안에 \n으로 강제 줄바꿈, **글자**로 강조를 쓸 수 있게 한다.
// esc()로 이스케이프부터 한 뒤에 무늬만 바꾸는 거라 안전하다(진짜 HTML은 못 심는다).
export const nl2br = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

// 해설을 문장 단위로 끊어 한 줄씩 보여준다(문장에 \n이 있으면 그 안에서도 줄바꿈).
// 따옴표 안의 마침표는 문장 끝으로 보지 않는다 (정읍에서 검증된 정규식).
export const sentences = t => String(t ?? '').split(/(?<=[.?!])\s+(?=[^\s])/)
  .filter(Boolean).map(x => `<p>${nl2br(x)}</p>`).join('');

// 카드 안에 텍스트가 넘치면(scrollHeight > clientHeight) 글자 크기를 0.5px씩 줄여 잘리지 않게 한다.
export function fitInto(selector, minPx = 14) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize);
  for (let px = base; px >= minPx && el.scrollHeight > el.clientHeight; px -= 0.5) {
    el.style.fontSize = px + 'px';
  }
}

// 두 JSON 값을 "의미 있게 같은지"만 비교할 때 쓰는 안정적 시그니처.
// serverNow처럼 매번 바뀌는 필드는 무시하도록 replacer를 넘긴다.
export function sig(value, ignoreKeys = []) {
  return JSON.stringify(value, (k, v) => (ignoreKeys.includes(k) ? 0 : v));
}
