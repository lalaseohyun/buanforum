/* ───────────────────────────────────────
   대표정책 · 제출 단계 — 참여자(모바일) 화면.
   허브의 "대표정책" 타일에서, 진행자가 진행 단계를 proposal_submit으로
   바꿔 뒀을 때 들어오는 화면(js/team/main.js가 고른다).

   조당 사진 한 장 — js/db.js saveMainPhoto가 문서 ID를 조 번호로 고정해서
   다시 올리면 그 자리를 그대로 덮어쓴다(다시 올리기 = 사진 교체).

   고칠 때 ─ 안내 문구   → 이 파일
             화면 모양    → css/sessions/hub.css(.uploadbox/.photopreview 등)
   쓰는 것 ─ js/storage.js(리사이즈·업로드) · js/db.js(saveMainPhoto)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { watch, saveMainPhoto, path } from '../../db.js';
import { uploadPhoto } from '../../storage.js';

export default {
  id: 'proposalSubmit',
  mount(ctx) {
    if (!ctx.team) {
      ctx.root.innerHTML = `<div class="center"><div class="big">조를 먼저 선택해주세요</div></div>`;
      return { unmount() {} };
    }
    let photo = null;      // { url, path, at } — 우리 조 사진(없으면 null)
    let uploading = false;
    const docId = `${ctx.team}-main`;

    function render() {
      ctx.root.innerHTML = `
        <div class="subhead"><span class="backlink" id="back">← 허브로</span></div>
        <div class="h">대표정책 제출</div>
        <div class="sub">논의결과 종이를 사진찍어서 올려주세요!</div>
        <input type="file" accept="image/*" id="fileUp" hidden>
        ${uploading ? `<div class="uploadbox busy"><div class="pulse"></div>사진 올리는 중…</div>`
          : photo
            ? `<div class="photopreview"><img src="${esc(photo.url)}"></div>
               <button class="ghost" id="replaceBtn">🔄 다시 올리기</button>
               <div class="donenote">제출 완료 · 언제든 다시 올려 바꿀 수 있어요</div>`
            : `<div class="uploadbox" id="uploadBox"><div class="ic">📷</div>클릭해서 사진 올리기</div>`}`;
      document.getElementById('back').onclick = ctx.backToHub;
      const f = document.getElementById('fileUp');
      f.onchange = () => { const file = f.files[0]; f.value = ''; if (file) upload(file); };
      const box = document.getElementById('uploadBox');
      if (box) box.onclick = () => f.click();
      const replace = document.getElementById('replaceBtn');
      if (replace) replace.onclick = () => f.click();
    }

    async function upload(file) {
      uploading = true; render();
      try {
        const up = await uploadPhoto(file, ctx.team);
        await saveMainPhoto(ctx.team, up);
      } catch (e) {
        alert('업로드에 실패했습니다: ' + e.message);
      } finally { uploading = false; render(); }
    }

    const unsub = watch(path('boardPhotos', docId), snap => { photo = snap; render(); });
    render();
    return { unmount() { unsub && unsub(); } };
  },
};
