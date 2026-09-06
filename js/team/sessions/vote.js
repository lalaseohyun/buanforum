/* ───────────────────────────────────────
   공감투표 — 참여자(모바일) 화면.
   조 대표가 아니라 "참가자 전원"이 투표 전용 QR(주소 끝에 ?vote=1)로 들어온다.
   그래서 조 선택을 거치지 않는다.

   투표 규칙(js/db.js voteWeights) ─
     3팀 이하   1순위만        (1표)
     4팀 이상   1순위 2표 · 2순위 1표

   1인 1표 제한은 없다(진행자 요청으로 뺐다 — 같은 기기로 몇 번이든 다시 투표할
   수 있다). 다만 기기별 voterId는 그대로라, 같은 기기가 다시 내면 그 기기의
   "이전 표"가 새 표로 교체될 뿐 중복으로 더해지지는 않는다(js/db.js submitVote가
   voterId 문서를 덮어쓰기 때문 — merge:false).

   고칠 때 ─ 규칙        → js/db.js voteWeights
             화면·문구   → 이 파일 + css/sessions/policy.css
   ─────────────────────────────────────── */
import { watch, submitVote, path, voteWeights } from '../../db.js';
import { esc } from '../../util.js';

function getVoterId() {
  let id = localStorage.getItem('voterId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('voterId', id); }
  return id;
}

export default {
  id: 'vote',
  mount(ctx) {
    const voterId = getVoterId();
    let live = null;                 // policy/live { open, names }
    let teamCount = ctx.forum.teamCount || ctx.forum.teams.length;
    let picks = [];                  // 1순위부터 순서대로 담긴 조 번호
    // 새로고침하면 다시 투표할 수 있다(버튼은 일부러 안 둔다 — 실제 참가자에게
    // "또 눌러도 된다"는 티를 안 내려고) — 이 세션이 떠 있는 동안만 기억하는
    // 값이라 새로고침하면 자동으로 false로 돌아온다.
    let done = false;
    let sending = false;
    const unsubs = [];

    const teams = () => ctx.forum.teams.slice(0, teamCount);
    const weights = () => voteWeights(teamCount);

    function render() {
      if (done) {
        ctx.root.innerHTML = `<div class="center">
          <div class="big">투표해 주셔서 고맙습니다</div>
          <div class="sub">결과는 앞 화면에서 함께 확인해요.</div>
        </div>`;
        return;
      }
      if (!live || !live.open) {
        ctx.root.innerHTML = `<div class="center"><div class="pulse"></div>
          <div class="big">곧 투표가 열립니다</div>
          <div class="sub">진행자 화면을 봐주세요</div></div>`;
        return;
      }
      const w = weights();
      // 골랐다는 표시를 글자 배지 대신, 진행자 화면과 같은 노란 점으로 보여준다 —
      // 1순위를 고르면 그 자리에서 점 2개가(2순위면 1개가) 바로 찍혀서,
      // "1순위=2표"라는 게 숫자를 안 읽어도 한눈에 보인다.
      const cards = teams().map(t => {
        const rank = picks.indexOf(t.no);          // -1이면 아직 안 고름
        const name = (live.names || {})[t.no] || '';
        const rankMark = rank >= 0 ? `<span class="rankmark">
          <span class="dots">${'<i></i>'.repeat(w[rank])}</span>
          <b>${rank + 1}순위</b>
        </span>` : '';
        return `<button class="votecard ${rank >= 0 ? 'picked' : ''}" data-t="${t.no}">
          ${rankMark}
          <span class="tm">${esc(t.label)}조</span>
          <span class="nm">${name ? esc(name) : '정책명 준비 중'}</span>
        </button>`;
      }).join('');
      const guide = w.length === 1
        ? '가장 마음에 드는 정책 <b>1팀</b>을 골라주세요'
        : `마음에 드는 순서대로 <b>${w.length}팀</b>을 골라주세요 (${w.map((v, i) => `${i + 1}순위 ${v}표`).join(' · ')})`;
      ctx.root.innerHTML = `
        <div class="h">공감투표</div>
        <div class="sub">${guide}</div>
        <div class="votelist">${cards}</div>
        <div class="votebar">
          <button class="ghost" id="clr" ${picks.length ? '' : 'disabled'}>다시 고르기</button>
          <button class="primary" id="send" ${picks.length === w.length && !sending ? '' : 'disabled'}>
            ${sending ? '보내는 중…' : `투표하기 (${picks.length}/${w.length})`}
          </button>
        </div>`;
      ctx.root.querySelectorAll('.votecard').forEach(b => {
        b.onclick = () => {
          const no = Number(b.dataset.t);
          const at = picks.indexOf(no);
          if (at >= 0) picks.splice(at, 1);              // 다시 누르면 취소
          else if (picks.length < w.length) picks.push(no);
          render();
        };
      });
      document.getElementById('clr').onclick = () => { picks = []; render(); };
      document.getElementById('send').onclick = send;
    }

    async function send() {
      if (sending || picks.length !== weights().length) return;
      sending = true; render();
      try {
        await submitVote(voterId, picks);
        done = true;
      } catch (e) {
        alert('투표를 보내지 못했습니다: ' + e.message);
      } finally { sending = false; render(); }
    }

    unsubs.push(watch(path(), snap => {
      const n = Number(snap?.teamCount) || ctx.forum.teamCount || ctx.forum.teams.length;
      if (n !== teamCount) { teamCount = n; picks = []; render(); }
    }));
    unsubs.push(watch(path('policy', 'live'), snap => { live = snap; render(); }));

    render();
    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
