/* ───────────────────────────────────────
   참여자 허브 전역에서 함께 쓰는 "내 조" 식별자.
   퀴즈·대표정책(제출/투표) 화면이 전부 이 값을 공유한다 — 허브에서 한 번 고르면
   화면을 나갔다 들어와도, 다른 타일에 들어가도 다시 고를 필요가 없다.

   deviceId는 조 선택과 별개로 "이 폰"을 구분하는 값 — 퀴즈 입장 시 같은 조를
   다른 폰이 이미 대표로 쓰고 있는지 확인하는 데만 쓴다(js/db.js claimTeam 참고).
   ─────────────────────────────────────── */

export function getMyTeam() {
  const n = Number(localStorage.getItem('team'));
  return n || null;
}
export function setMyTeam(no) { localStorage.setItem('team', String(no)); }
export function clearMyTeam() { localStorage.removeItem('team'); }

export function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id); }
  return id;
}
