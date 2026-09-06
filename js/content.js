/* ───────────────────────────────────────
   content/*.json 로더 — 정적 파일을 fetch해서 캐싱한다.
   문항·문구를 고치는 사람은 이 파일을 열 필요가 없다(content/*.json만 고치면 됨).
   ─────────────────────────────────────── */

const cache = new Map();

async function loadPath(key, path) {
  if (cache.has(key)) return cache.get(key);
  const p = fetch(`${path}?v=${Date.now()}`).then(r => {
    if (!r.ok) throw new Error(`${path} 로드 실패 (${r.status})`);
    return r.json();
  });
  cache.set(key, p);
  return p;
}
const load = name => loadPath(name, `content/${name}.json`);

export const loadForum = () => load('forum');
export const loadOpening = () => load('01-opening');
export const loadQuiz = () => load('02-quiz');
export const loadTalk = () => load('03-talk');
export const loadBoard = () => load('04-board');
export const loadSurvey = () => load('07-survey');
// 원탁토론 참고자료(분야별 5페이지)의 사업 원자료 — 4번의 나머지 content/*.json과
// 달리 src/data/에 둔다(가공된 슬라이드 문구가 아니라 시행계획 원자료라 구분).
export const loadPolicies = () => loadPath('policies-2026', 'src/data/policies-2026.json');
