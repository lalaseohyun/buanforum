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

// 목업(1600×801 무대)에서 좌표로 자유 배치한 화면을 그대로 옮겨 쓰기 위한 스케일러.
// 무대 크기는 CSS가 고정해 두고(.stage1600), 화면 크기에 맞춰 통째로 비율 유지한 채
// 확대/축소한다 — 글자·간격·좌표가 전부 같은 비율로 움직이므로 목업과 100% 같은 그림이 된다.
// 반환값은 정리 함수(unmount에서 호출).
export function fitStage(el) {
  if (!el || !el.parentElement) return () => {};
  const wrap = el.parentElement;
  const apply = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h || !el.offsetWidth || !el.offsetHeight) return;
    el.style.transform = `scale(${Math.min(w / el.offsetWidth, h / el.offsetHeight)})`;
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(wrap);
  return () => ro.disconnect();
}

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

// QR 생성 라이브러리(cdnjs, host.html에서 blocking <script>로 미리 불러둔다)는 보통
// 모듈보다 먼저 준비되지만, 네트워크가 느리거나 그 순간 막히면 window.QRCode가 아직
// 없을 수 있다 — 그때 그냥 건너뛰면(예전 방식) 그 뒤로 아무것도 다시 안 그려서
// QR이 영영 빈 채로 남는다("QR이 또 안 떠" 버그). 준비될 때까지 0.3초마다 재시도하고
// (최대 15초), 그래도 안 되면 눌러서 바로 열 수 있는 링크라도 남긴다.
export function renderQr(el, text, opts = {}) {
  if (!el) return;
  let tries = 0;
  const tick = () => {
    if (!document.body.contains(el)) return;   // 그 사이 다른 화면으로 넘어갔으면 그만둔다
    if (window.QRCode) {
      el.innerHTML = '';
      new window.QRCode(el, { text, width: 300, height: 300, colorDark: '#2c2c2a', colorLight: '#ffffff', ...opts });
      return;
    }
    if (++tries > 50) {
      el.innerHTML = `<a href="${esc(text)}" target="_blank" rel="noopener" style="font-size:13px;color:#2c2c2a;font-weight:700;display:block;padding:20px;text-align:center">QR 생성 실패<br>여기를 눌러 주소로 이동</a>`;
      return;
    }
    setTimeout(tick, 300);
  };
  tick();
}

// 두 JSON 값을 "의미 있게 같은지"만 비교할 때 쓰는 안정적 시그니처.
// serverNow처럼 매번 바뀌는 필드는 무시하도록 replacer를 넘긴다.
export function sig(value, ignoreKeys = []) {
  return JSON.stringify(value, (k, v) => (ignoreKeys.includes(k) ? 0 : v));
}
