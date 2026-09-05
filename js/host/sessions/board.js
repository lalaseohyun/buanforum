/* ───────────────────────────────────────
   4. 원탁토론 — 진행자 화면. 토론모드(작성양식 + 참고자료) ↔ 발표모드(사진 갤러리) 전환.

   고칠 때 ─ 작성양식 문구·참고자료(예산표)   → content/04-board.json
             모드 전환·갤러리 로직            → 이 파일
             색·레이아웃                      → css/sessions/board.css
   쓰는 것 ─ js/content.js(로더) · js/db.js(board/state, boardPhotos 구독)
   참고 ─ 사진 업로드·리사이즈·하트 자체는 팀(모바일) 쪽에서 일어난다
         (js/team/sessions/board.js). 여기는 결과를 보여주기만 한다.
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadBoard } from '../../content.js';
import { watch, watchCollection, hostSet, hostReset, path } from '../../db.js';

export default {
  id: 'board',
  title: '원탁토론',
  mount(ctx) {
    const teams = ctx.forum.teams;
    let data = null;
    let mode = 'write'; // 'write' | 'present'
    let photos = {};     // { photoId: {teamNo, url, path, at, voters} }
    let refOpen = true;
    let zoomId = null;
    const unsubs = [];

    function photosByTeam(no) {
      return Object.entries(photos).filter(([, p]) => p.teamNo === no).map(([id, p]) => ({ id, ...p }));
    }
    function heartsOf(p) { return Object.keys(p.voters || {}).length; }

    function render() {
      if (!data) { ctx.root.innerHTML = `<div class="slide"><h2>불러오는 중…</h2></div>`; return; }
      ctx.root.innerHTML = mode === 'write' ? viewWrite() : viewPresent();
      if (mode === 'write') wireWrite();
      ctx.setControls(controlsFor());
    }

    function viewWrite() {
      const p = data.prompt;
      const ref = data.reference;
      return `<div class="boardwrite">
        <div class="prompt">
          <div class="line">${esc(p.lines[0])} <span class="blank"></span> 입니다.</div>
          <div class="line">${esc(p.lines[1])} <span class="blank"></span> ${esc(p.lines[2] || '')}</div>
          <div class="reasons">${p.reasons.map(r => `<div>${esc(r)} <span class="blank" style="min-width:2.2em"></span></div>`).join('')}</div>
        </div>
        <div class="refbox" id="refbox" style="${refOpen ? '' : 'display:none'}">
          <h4>${esc(ref.title)}</h4>
          ${ref.summary.map(s => `<div class="stat"><span>${esc(s.k)}</span><b>${esc(s.v)}</b></div>`).join('')}
          <table>${ref.byField.map(f => `<tr><td>${esc(f.field)}</td><td class="num">${esc(f.amount)} (${esc(f.pct)})</td></tr>`).join('')}</table>
        </div>
      </div>`;
    }
    function wireWrite() {}

    function viewPresent() {
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
      return `<div class="gallery">${cards}</div>${zoom}`;
    }

    function controlsFor() {
      const btns = [
        { label: mode === 'write' ? '발표모드로' : '토론모드로', variant: 'primary', onClick: toggleMode },
      ];
      if (mode === 'write') btns.push({ label: refOpen ? '참고자료 접기' : '참고자료 펼치기', variant: 'ghost', onClick: () => { refOpen = !refOpen; render(); } });
      btns.push({ label: '전체 초기화(사진·하트)', variant: 'danger', onClick: resetAll });
      return btns;
    }

    function toggleMode() {
      mode = mode === 'write' ? 'present' : 'write';
      hostSet(path('board', 'state'), { mode });
      render();
    }
    function resetAll() {
      if (!confirm('업로드된 사진과 하트를 모두 지웁니다. 정말 초기화할까요?')) return;
      Object.keys(photos).forEach(id => hostReset(path('boardPhotos', id), {}));
    }

    ctx.setKeys({});

    loadBoard().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/04-board.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    unsubs.push(watch(path('board', 'state'), snap => { mode = snap?.mode || 'write'; render(); }));
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
      if (card && mode === 'present') {
        const ps = photosByTeam(Number(card.dataset.t));
        if (ps[0]) { zoomId = ps[0].id; render(); }
      }
    });

    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
