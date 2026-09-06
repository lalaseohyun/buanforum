/* ───────────────────────────────────────
   6. 우수정책 — 시상 타이틀 화면.
   행사명(가장 작게) → 주제 문구 → 「우수정책팀 시상」(가장 크게) 순으로 커진다.

   고칠 때 ─ 행사명·주제 문구  → content/forum.json
             문구·크기        → 이 파일 + css/sessions/slides.css (.awardtitle)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';

export default {
  id: 'award',
  title: '우수정책',
  mount(ctx) {
    const f = ctx.forum;
    ctx.root.innerHTML = `
      <div class="slide awardslide">
        <div class="awardsmall">${esc(f.title)}</div>
        <div class="awardmid">${esc(f.subtitle || '')}</div>
        <div class="awardbig">우수정책팀 시상</div>
      </div>`;

    ctx.setControls([
      { label: '◀ 대표정책', onClick: () => ctx.goSession('policy') },
    ]);
    ctx.setKeys({ ArrowLeft: () => ctx.goSession('policy') });
    return { unmount() {} };
  },
};
