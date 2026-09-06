/* ───────────────────────────────────────
   만족도조사 5-2 실시간 오픈엔디드 화면의 카드 애니메이션 — 문서 원안(하이브리드 C안) 그대로:

     새 응답 도착 → ① 화면 중앙에 크게 3초 단독 하이라이트
                 → ② 줄어들면서 목록 맨 위로 합류
                 → ③ 4초마다 한 칸씩 위로 이동, 대기열 끝까지 가면 셔플 후 재순환
                 → (전체 5개 미만이면 안 움직이고 있는 그대로 배치)

   독립된 세션이 아니라 survey.js(host)가 좌/우 두 칸에 하나씩 만들어 쓰는
   컨트롤러다(탭바에서 직접 못 들어간다). 좌우가 서로 완전히 독립적으로 돈다.

   고칠 때 ─ 타이밍(3초·4초)·개수(3~4장)·글자수(70자) → 아래 CONFIG
             카드 모양·색                              → css/sessions/survey.css
   ─────────────────────────────────────── */
const CONFIG = {
  highlightMs: 3000,   // 중앙 하이라이트 노출 시간
  cycleMs: 4000,        // 한 칸씩 올라가는 간격
  visibleCount: 4,      // 한 번에 보이는 카드 수
  minToScroll: 5,       // 이 개수 미만이면 안 움직임
  maxChars: 70,          // 이 글자 수 넘으면 말줄임
};

function truncate(text) {
  const s = String(text || '').trim();
  return s.length > CONFIG.maxChars ? s.slice(0, CONFIG.maxChars) + '…' : s;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {HTMLElement} root  이 칸 전체를 그릴 컨테이너(이미 열의 절반 폭을 차지하고 있다고 가정)
 * @param {{title:string}} opts
 * @returns {{ update:(items:{id:string,text:string}[])=>void, destroy:()=>void }}
 */
export function createWallColumn(root, opts) {
  let byId = new Map();      // id -> text, 지금 보여줘도 되는(숨김 아님·빈 값 아님) 응답 전체
  const seen = new Set();     // 한 번이라도 하이라이트를 거친 id
  let order = [];             // 순환 순서(셔플됨)
  let windowStart = 0;
  const highlightQueue = [];
  let highlighting = false;
  let cycleTimer = null;

  root.innerHTML = `
    <div class="wallhead"><span>${opts.title}</span><b class="wallcount">0</b></div>
    <div class="walllist"></div>
    <div class="wallhighlight" hidden></div>`;
  const listEl = root.querySelector('.walllist');
  const countEl = root.querySelector('.wallcount');
  const hiEl = root.querySelector('.wallhighlight');

  function renderList() {
    const ids = order.length
      ? Array.from({ length: Math.min(CONFIG.visibleCount, order.length) }, (_, i) => order[(windowStart + i) % order.length])
      : [...byId.keys()];
    listEl.innerHTML = ids.map((id, i) => `
      <div class="wallcard" style="animation-delay:${i * 60}ms">${escapeHtml(truncate(byId.get(id)))}</div>`).join('');
  }

  function processQueue() {
    if (highlighting || !highlightQueue.length) return;
    const id = highlightQueue.shift();
    const text = byId.get(id);
    if (text === undefined) { processQueue(); return; } // 그 사이 지워짐/숨겨짐
    highlighting = true;
    hiEl.hidden = false;
    hiEl.textContent = truncate(text);
    setTimeout(() => {
      hiEl.hidden = true;
      // 순환 목록 맨 앞으로 합류 — 지금 보이는 창이 그대로 한 칸 밀리는 것처럼 보인다
      order = [id, ...order.filter(x => x !== id)];
      windowStart = 0;
      renderList();
      highlighting = false;
      processQueue();
    }, CONFIG.highlightMs);
  }

  function tick() {
    if (highlighting) return;               // 하이라이트 도는 중엔 순환을 잠깐 쉰다
    if (byId.size < CONFIG.minToScroll) return; // 5개 미만이면 안 움직임
    windowStart++;
    if (windowStart >= order.length) {
      order = shuffle(order);               // 한 바퀴 다 돌면 섞어서 재순환(같은 순서 반복 방지)
      windowStart = 0;
    }
    renderList();
  }
  cycleTimer = setInterval(tick, CONFIG.cycleMs);

  function update(items) {
    const cleaned = items.filter(it => it.text && it.text.trim());
    const newIds = new Set(cleaned.map(it => it.id));
    byId = new Map(cleaned.map(it => [it.id, it.text]));
    countEl.textContent = String(byId.size);

    // 목록에서 없어진(숨겨졌거나 삭제된) id는 순환 순서·대기열에서도 뺀다
    order = order.filter(id => newIds.has(id));
    for (let i = highlightQueue.length - 1; i >= 0; i--) {
      if (!newIds.has(highlightQueue[i])) highlightQueue.splice(i, 1);
    }

    // "5개 미만이면 안 움직인다"는 순환(tick)에만 적용된다 — 새 응답이 왔을 때
    // 화면 중앙에 한 번 크게 떠 주는 하이라이트는 전체 개수와 상관없이 항상 한다.
    // 처음 보는 응답은 하이라이트 대기열로(먼저 order에 안 넣는다 — 하이라이트가 끝나야 합류)
    cleaned.forEach(it => {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        if (order.includes(it.id)) return; // 이미 순환 중이면(예: 재구독) 중복 큐잉 방지
        highlightQueue.push(it.id);
      } else if (!order.includes(it.id) && !highlightQueue.includes(it.id)) {
        // 하이라이트를 이미 거쳤는데 순환 목록엔 없는 경우(최초 진입 등) — 바로 합류
        order.push(it.id);
      }
    });
    if (!highlighting && !highlightQueue.length) renderList();
    processQueue();
  }

  function destroy() { clearInterval(cycleTimer); }

  return { update, destroy };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
