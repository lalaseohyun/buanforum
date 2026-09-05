/* ───────────────────────────────────────
   5. 대표정책 — 참여자(모바일) 화면. 우리 조 정책 사진 업로드 + 전체 갤러리 + 하트투표.
   (예전 원탁토론의 "발표모드"가 독립 탭으로 옮겨온 것)

   고칠 때 ─ 업로드·투표 로직   → 이 파일
             리사이즈 크기       → js/storage.js
             색·크기            → css/sessions/policy.css
   쓰는 것 ─ js/db.js(boardPhotos, 하트) · js/storage.js(사진 업로드)

   신원 ─ 사진은 조 번호(ctx.team)로 묶인다. 하트는 "각자"이므로 조 번호와
   무관한 voterId(기기별 uuid, localStorage)로 누가 눌렀는지 구분한다.
   ─────────────────────────────────────── */
import { watchCollection, toggleHeart, saveMainPhoto, addExtraPhoto, path } from '../../db.js';
import { uploadPhoto } from '../../storage.js';
import { esc } from '../../util.js';

function getVoterId() {
  let id = localStorage.getItem('voterId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('voterId', id); }
  return id;
}

export default {
  id: 'policy',
  mount(ctx) {
    const voterId = getVoterId();
    let photos = {}, uploading = false;
    const unsubs = [];

    function photosByTeam(no) { return Object.entries(photos).filter(([, p]) => p.teamNo === no).map(([id, p]) => ({ id, ...p })); }
    function heartsOf(p) { return Object.keys(p.voters || {}).length; }
    function iVoted(p) { return !!(p.voters || {})[voterId]; }

    function render() {
      const mine = photosByTeam(ctx.team);
      const uploadBox = `
        <div class="upload" id="up1">
          <input type="file" accept="image/*" capture="environment" id="fileMain">
          <div class="ic">📷</div>
          <div class="t">${mine[0] ? '다시 찍어서 교체하기' : '우리 조 정책을 촬영해서 올려주세요'}</div>
        </div>
        ${mine[0] ? `<div class="myphotos"><div class="ph"><img src="${esc(mine[0].url)}"></div></div>` : ''}
        <button class="ghost addmore" id="addMore">+ 사진 추가</button>
        <input type="file" accept="image/*" capture="environment" id="fileExtra" style="display:none">
        ${mine.slice(1).length ? `<div class="myphotos">${mine.slice(1).map(p => `<div class="ph"><img src="${esc(p.url)}"></div>`).join('')}</div>` : ''}
        ${uploading ? `<div class="status">업로드 중…</div>` : ''}
      `;
      const gallery = ctx.forum.teams.map(t => {
        const ps = photosByTeam(t.no);
        return ps.map(p => `
          <div class="gcard">
            <div class="ph"><img src="${esc(p.url)}"></div>
            <div class="meta"><span class="tm">${esc(t.label)}조</span>
              <span class="heartbtn ${iVoted(p) ? 'on' : ''}" data-p="${p.id}">♥ ${heartsOf(p)}</span>
            </div>
          </div>`).join('');
      }).join('');
      ctx.root.innerHTML = `<div class="h">우리 조 대표정책 올리기</div>${uploadBox}
        <div class="h" style="margin-top:28px">전체 정책 갤러리 · 마음에 드는 정책에 하트를 눌러주세요</div>
        <div class="gallery" style="grid-template-columns:repeat(2,1fr)">${gallery || '<div class="sub">아직 업로드된 사진이 없어요</div>'}</div>`;
      wire();
    }

    function wire() {
      const fMain = document.getElementById('fileMain');
      if (fMain) fMain.onchange = () => upload(fMain.files[0], saveMainPhoto);
      const addBtn = document.getElementById('addMore');
      const fExtra = document.getElementById('fileExtra');
      if (addBtn && fExtra) {
        addBtn.onclick = () => fExtra.click();
        fExtra.onchange = () => upload(fExtra.files[0], addExtraPhoto);
      }
      ctx.root.querySelectorAll('.heartbtn').forEach(el => {
        el.onclick = () => {
          const p = photos[el.dataset.p];
          toggleHeart(el.dataset.p, voterId, !iVoted(p));
        };
      });
    }

    async function upload(file, saveFn) {
      if (!file || uploading) return;
      uploading = true; render();
      try {
        const photo = await uploadPhoto(file, ctx.team);
        await saveFn(ctx.team, photo);
      } catch (e) {
        alert('업로드에 실패했습니다: ' + e.message);
      } finally {
        uploading = false; render();
      }
    }

    unsubs.push(watchCollection(path('boardPhotos'), snap => {
      photos = Object.fromEntries(Object.entries(snap).filter(([, v]) => v && v.url));
      render();
    }));

    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
