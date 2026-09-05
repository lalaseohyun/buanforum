/* ───────────────────────────────────────
   content/*.json 로더 — 정적 파일을 fetch해서 캐싱한다.
   문항·문구를 고치는 사람은 이 파일을 열 필요가 없다(content/*.json만 고치면 됨).
   ─────────────────────────────────────── */

const cache = new Map();

async function load(name) {
  if (cache.has(name)) return cache.get(name);
  const p = fetch(`content/${name}.json?v=${Date.now()}`).then(r => {
    if (!r.ok) throw new Error(`content/${name}.json 로드 실패 (${r.status})`);
    return r.json();
  });
  cache.set(name, p);
  return p;
}

export const loadForum = () => load('forum');
export const loadOpening = () => load('01-opening');
export const loadQuiz = () => load('02-quiz');
export const loadTalk = () => load('03-talk');
export const loadBoard = () => load('04-board');
