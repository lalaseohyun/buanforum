/* ───────────────────────────────────────
   공용 대기 화면 — 진행자가 오프닝·토크콘서트 등 "참가자가 스스로 진행하지
   않는" 세션을 띄우고 있을 때 팀 화면에 나온다.

   고칠 때 ─ 문구                → 이 파일
             어떤 세션이 대기 대상인지 → js/team/main.js의 byId 목록(quiz/board만 제외하고 전부 대기)
   ─────────────────────────────────────── */
import { watch, path } from '../../db.js';
import { esc } from '../../util.js';

export default {
  id: 'wait',
  mount(ctx) {
    function render(title) {
      ctx.root.innerHTML = `<div class="center"><div class="pulse"></div>
        <div class="big">${esc(title || '곧 시작합니다')}</div>
        <div class="sub">진행자 화면을 봐주세요</div></div>`;
    }
    render();
    const unsub = watch(path(), snap => {
      const s = ctx.forum.sessions.find(x => x.id === snap?.session);
      render(s ? s.title : '곧 시작합니다');
    });
    return { unmount() { unsub && unsub(); } };
  },
};
