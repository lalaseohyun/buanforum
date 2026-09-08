/* ───────────────────────────────────────
   만족도조사 5-2 실시간 오픈엔디드 화면의 카드 목록 — js/host/sessions/survey.js(host)가
   좌/우 두 칸에 하나씩 만들어 쓰는 컨트롤러다(탭바에서 직접 못 들어간다).
   좌우가 서로 완전히 독립적으로 돈다.

   ⚠ 예전엔 새 응답이 오면 화면 중앙에 3초간 크게 하이라이트했다가 목록에 합류하고,
   4장만 보이게 4초마다 한 칸씩 순환시키는 방식이었다. 2026-09-08 요청으로 걷어냈다 —
   "지금 인원이 많지 않으니 그냥 다 개별 텍스트박스로 띄워달라"는 요청. 이제 하이라이트도
   순환도 없이, 들어온 응답을 전부 최신순으로 그대로 나열한다. 나중에 응답이 아주 많아지면
   (한 화면에 다 안 들어갈 정도로) 다시 순환이나 스크롤 방식이 필요할 수 있다 —
   지금은 .walllist가 overflow:auto라 넘치면 그 칸만 스크롤된다.

   고칠 때 ─ 글자수 제한(70자)         → 아래 CONFIG
             카드 모양·색              → css/sessions/survey.css
   ─────────────────────────────────────── */
const CONFIG = {
  maxChars: 70,   // 이 글자 수 넘으면 말줄임
};

function truncate(text) {
  const s = String(text || '').trim();
  return s.length > CONFIG.maxChars ? s.slice(0, CONFIG.maxChars) + '…' : s;
}

/**
 * @param {HTMLElement} root  이 칸 전체를 그릴 컨테이너(이미 열의 절반 폭을 차지하고 있다고 가정)
 * @param {{title:string}} opts
 * @returns {{ update:(items:{id:string,text:string}[])=>void, destroy:()=>void }}
 */
export function createWallColumn(root, opts) {
  let ids = [];             // 화면에 보여줄 순서(최신 응답이 맨 앞)
  let byId = new Map();     // id -> text

  root.innerHTML = `
    <div class="wallhead"><span>${opts.title}</span><b class="wallcount">0</b></div>
    <div class="walllist"></div>`;
  const listEl = root.querySelector('.walllist');
  const countEl = root.querySelector('.wallcount');

  function renderList() {
    listEl.innerHTML = ids.map((id, i) => `
      <div class="wallcard" style="animation-delay:${Math.min(i, 8) * 60}ms">${escapeHtml(truncate(byId.get(id)))}</div>`).join('');
  }

  function update(items) {
    const cleaned = items.filter(it => it.text && it.text.trim());
    const newIds = new Set(cleaned.map(it => it.id));
    byId = new Map(cleaned.map(it => [it.id, it.text]));
    countEl.textContent = String(byId.size);

    // 기존에 보이던 순서는 그대로 유지하고(카드가 화면에서 갑자기 자리를 옮기지 않게),
    // 이번에 처음 보는 응답만 맨 앞에 새로 추가한다. 숨겨졌거나 지워진 건 목록에서 뺀다.
    const existing = ids.filter(id => newIds.has(id));
    const brandNew = cleaned.filter(it => !ids.includes(it.id)).map(it => it.id);
    ids = [...brandNew, ...existing];
    renderList();
  }

  function destroy() {}

  return { update, destroy };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
