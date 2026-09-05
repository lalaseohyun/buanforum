/* ───────────────────────────────────────
   5. 대표정책 — 진행자 화면. 각 조가 올린 정책 사진을 갤러리로 보여준다.
   (예전 원탁토론의 "발표모드"가 독립 탭으로 옮겨온 것)

   고칠 때 ─ 갤러리·투표 로직   → 이 파일
             사진 리사이즈       → js/storage.js
             색·크기            → css/sessions/policy.css
   쓰는 것 ─ js/db.js(boardPhotos 구독) — 업로드·하트는 팀 쪽(./policy.js의 team 버전)에서 일어난다.
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { watchCollection, hostReset, path } from '../../db.js';

export default {
  id: 'policy',
  title: '대표정책',
  mount(ctx) {
    const teams = ctx.forum.teams;
    let photos = {};   // { photoId: {teamNo, url, path, at, voters} }
    let zoomId = null;
    const unsubs = [];

    function photosByTeam(no) {
      return Object.entries(photos).filter(([, p]) => p.teamNo === no).map(([id, p]) => ({ id, ...p }));
    }
    function heartsOf(p) { return Object.keys(p.voters || {}).length; }

    function render() {
      const cards = teams.map(t => {
        const ps = photosByTeam(t.no);
        const main = ps[0];
        const totalHearts = ps.reduce((s, p) => s + heartsOf(p), 0);
        return `<div class="gcard" data-t="${t.no}">
          <div class="ph ${main ? '' : 'empty'}">${main ? `<img src="${esc(main.url)}">` : '아직 업로드 전'}</div>
          <div class="meta"><span class="tm">${esc(t.label)}조</span><span class="hearts">♥ ${totalHearts}</span></div>
        </div>`;
      }).join('');
      const zoom = zoomId && photos[zoomId] ? `
        <div class="zoom" id="zoomLayer">
          <button class="close ghost" id="zoomClose">✕ 닫기</button>
          <img src="${esc(photos[zoomId].url)}">
          <div class="cap">♥ ${heartsOf(photos[zoomId])}</div>
        </div>` : '';
      ctx.root.innerHTML = `<div class="gallery">${cards}</div>${zoom}`;
      ctx.setControls([
        { label: '전체 초기화(사진·하트)', variant: 'danger', onClick: resetAll },
      ]);
    }

    function resetAll() {
      if (!confirm('업로드된 사진과 하트를 모두 지웁니다. 정말 초기화할까요?')) return;
      Object.keys(photos).forEach(id => hostReset(path('boardPhotos', id), {}));
    }

    ctx.setKeys({});

    unsubs.push(watchCollection(path('boardPhotos'), snap => {
      // 초기화로 비운 문서({})는 갤러리에서 제외
      photos = Object.fromEntries(Object.entries(snap).filter(([, v]) => v && v.url));
      render();
    }));

    // 갤러리 클릭 → 확대, 확대 화면 닫기는 이벤트 위임으로 처리(리렌더마다 다시 그려지므로)
    ctx.root.addEventListener('click', e => {
      const card = e.target.closest('.gcard');
      const closeBtn = e.target.closest('#zoomClose');
      if (closeBtn) { zoomId = null; render(); return; }
      if (card) {
        const ps = photosByTeam(Number(card.dataset.t));
        if (ps[0]) { zoomId = ps[0].id; render(); }
      }
    });

    render();
    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
