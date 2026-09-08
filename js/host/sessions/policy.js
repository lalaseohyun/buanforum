/* ───────────────────────────────────────
   5. 대표정책 — 진행자 화면. 화살표로 세 페이지가 이어진다.
     0) 메인페이지 — 1.오프닝·3.토크콘서트 첫 화면과 같은 모양(kicker+제목+부제 한 장짜리 슬라이드)
     1) 정책 갤러리 — 진행자가 자기 컴퓨터에서 조별 사진을 올리는 칸(참여자도 허브에서 직접 올릴 수 있음).
        사진을 누르면 전체화면으로 크게 띄우고, 거기서 "사진 바꾸기"로 다시 올릴 수 있다.
     2) 공감투표 — 참여자 허브 안내 QR + 조별 정책명(진행자가 직접 기입) + 실시간 집계.
        표 수만큼 동그란 점이 박스 안에 콕콕 찍히는 방식(멘티미터 스타일, 막대 아님).
        조가 적을수록(예: 3개) 한 줄이 세로로 더 크게 — 화면을 항상 채우도록
        css/sessions/policy.css의 .voterow가 flex:1로 남는 세로 공간을 나눠 가진다.

   고칠 때 ─ 메인페이지 문구           → 아래 renderIntro()
             조 수                  → 퀴즈 대기화면에서 고른 값(Firestore forum 문서)
             투표 규칙(순위별 표수) → js/db.js의 voteWeights
             색·크기·점 애니메이션  → css/sessions/policy.css
   쓰는 것 ─ js/db.js(boardPhotos·policy/live·policyVotes) · js/storage.js(사진 업로드)
   ─────────────────────────────────────── */
import { esc, renderQr } from '../../util.js';
import { watch, watchCollection, hostSet, hostReset, path, tallyVotes, voteWeights } from '../../db.js';
import { uploadPhoto } from '../../storage.js';

const LAST_PAGE = 2;   // 0 메인페이지 · 1 갤러리 · 2 공감투표

// opening.js·talk.js·board.js와 같은 이유로, 화살표로 이어서 들어올 때만(ctx.resume)
// 마지막 페이지를 쓴다(award.js에서 ◀로 돌아오면 방금 보던 공감투표 페이지부터).
let lastPage = 0;

export default {
  id: 'policy',
  title: '대표정책',
  mount(ctx) {
    let page = ctx.resume ? lastPage : 0;
    let teamCount = ctx.forum.teamCount || ctx.forum.teams.length;
    let photos = {};              // { photoId: {teamNo, url, path, at} }
    let names = {};               // { [teamNo]: 정책명 }
    let votes = {};               // { [voterId]: {ranks} }
    let zoomId = null;
    let uploading = 0;
    const unsubs = [];

    const teams = () => ctx.forum.teams.slice(0, teamCount);
    const photoOf = no => Object.entries(photos)
      .filter(([, p]) => p && p.teamNo === no && p.url)
      .map(([id, p]) => ({ id, ...p }))[0];

    // 예전엔 투표 전용 QR(?vote=1, 조 선택 없이 바로 투표 화면)이었지만, 지금은 참여자
    // 허브(루트 주소)의 "대표정책" 타일이 진행 단계(activeSession=proposal_vote)를 보고
    // 알아서 투표 화면을 띄운다 — 그래서 그냥 허브 주소를 가리키면 된다.
    const hubUrl = () => location.href.replace(/host\.html.*$/, '');

    function render() {
      lastPage = page;
      // 투표가 들어올 때마다 다시 그리는데, 그 순간 진행자가 정책명을 치고 있을 수 있다.
      // 치던 칸(값·커서)을 붙잡아 뒀다가 그린 뒤에 되돌려 준다.
      const act = document.activeElement;
      const typing = act && act.matches?.('.votetable .pname')
        ? { t: act.dataset.t, v: act.textContent } : null;

      ctx.root.innerHTML = page === 0 ? viewIntro() : page === 1 ? viewGallery() : viewVote();
      wire();
      ctx.setControls(controlsFor());

      if (typing) {
        const back = ctx.root.querySelector(`.votetable .pname[data-t="${typing.t}"]`);
        if (back) {
          back.textContent = typing.v;
          back.focus();
          caretToEnd(back);
        }
      }
    }

    // 화살표로 넘기는 페이지 점 — 지금이 3페이지 중 몇 번째인지
    const dots = () => `<div class="pagedots">${[0, 1, 2].map(i =>
      `<i class="${i === page ? 'on' : ''}"></i>`).join('')}</div>`;

    /* ---- 0. 메인페이지 — 1.오프닝·3.토크콘서트 첫 화면과 같은 슬라이드 ---- */
    function viewIntro() {
      return `<div class="slide">
        <div class="kicker">대표정책</div>
        <h2>대표정책 제안</h2>
        <p class="sub">논의결과 종이를 사진찍어서 올려주세요!</p>
      </div>${dots()}`;
    }

    /* ---- 1. 갤러리 ---- */
    function viewGallery() {
      const cards = teams().map(t => {
        const p = photoOf(t.no);
        return `<div class="gcard" data-t="${t.no}">
          <div class="ph ${p ? '' : 'empty'}">${p ? `<img src="${esc(p.url)}">` : '클릭해서 사진 올리기'}</div>
          <div class="meta"><span class="tm">${esc(t.label)}조</span>${names[t.no] ? `<span class="pn">${esc(names[t.no])}</span>` : ''}</div>
        </div>`;
      }).join('');
      // 사진이 이미 있으면 확대해서 보여주고, 옆에 "사진 바꾸기"를 같이 둔다 —
      // 진행자가 다시 눌러서 잘못 올라온 사진을 그 자리에서 바로 교체할 수 있게.
      const zoom = zoomId && photos[zoomId] ? `
        <div class="zoom" id="zoomLayer">
          <div class="zoomtools">
            <button class="ghost" id="zoomReplace">🔄 사진 바꾸기</button>
            <button class="close ghost" id="zoomClose">✕ 닫기</button>
          </div>
          <img src="${esc(photos[zoomId].url)}">
        </div>` : '';
      return `<div class="toppage">
        <div class="toppage-head">
          <div class="kicker">대표정책</div>
          <h2>대표정책 제안</h2>
        </div>
        <div class="gallery" style="--cols:${teamCount <= 4 ? 2 : 3}">${cards}</div>
      </div>
        <input type="file" accept="image/*" id="fileUp" hidden>
        ${uploading ? `<div class="uploading">사진 올리는 중…</div>` : ''}${zoom}
        ${dots()}`;
    }

    /* ---- 2. 공감투표 ---- */
    // 멘티미터의 객관식 투표처럼, 막대가 아니라 표 하나당 동그란 점 하나가 박스 안에
    // 콕콕 찍히는 걸로 보여준다. 매번 다시 그릴 때마다 점이 튀어 오르듯 애니메이션된다
    // (css/sessions/policy.css의 @keyframes dotpop).
    function viewVote() {
      const t = tallyVotes(votes, teamCount);
      const w = voteWeights(teamCount);
      const rows = teams().map(tm => {
        const n = t[tm.no] || 0;
        // 점이 한꺼번에 안 튀고 순서대로 톡톡 찍히는 느낌 — 점이 많아지면 지연을 너무
        // 길게 안 늘리려고 24개까지만 순서를 두고 그 뒤는 한꺼번에 나온다.
        const dots = Array.from({ length: n }, (_, i) =>
          `<span class="dot" style="animation-delay:${Math.min(i, 24) * 35}ms"></span>`).join('');
        return `<div class="voterow">
          <div class="no">${esc(tm.label)}조</div>
          <div class="name"><div class="pname" data-t="${tm.no}" contenteditable="plaintext-only"
            data-ph="정책명을 적어주세요">${esc(names[tm.no] || '')}</div></div>
          <div class="dotcell"><div class="dotbox">${dots}</div></div>
          <div class="cnt">${n}</div>
        </div>`;
      }).join('');
      return `<div class="votewrap">
        <div class="voteleft">
          <div class="votetitle">공감투표</div>
          <div class="qrbox"><div id="voteQr"></div></div>
          <div class="votesub">휴대폰 허브 화면에서<br>"대표정책"을 눌러 투표해주세요</div>
          <div class="voterule">${w.length === 1 ? '한 팀에 1표' : w.map((v, i) => `${i + 1}순위 ${v}표`).join(' · ')}</div>
          <div class="votecount">투표한 사람 <b>${Object.keys(votes).length}</b>명</div>
        </div>
        <div class="voteright">
          <div class="votetable">${rows}</div>
        </div>
      </div>
      ${dots()}`;
    }

    function wire() {
      if (page === 1) {
        const f = document.getElementById('fileUp');
        // 아래 셋 다 stopPropagation 필수 — 안 막으면 main.js의 전역 "빈 공간 클릭 = 다음"
        // 처리로 버블링돼서, 사진을 올리거나 확대/닫는 클릭이 동시에 다음 페이지로도 넘겨버린다.
        ctx.root.querySelectorAll('.gcard').forEach(card => {
          card.onclick = e => {
            e.stopPropagation();
            const no = Number(card.dataset.t);
            const p = photoOf(no);
            if (p) { zoomId = p.id; render(); return; }   // 이미 있으면 크게 보기
            f.onchange = () => { const file = f.files[0]; f.value = ''; if (file) upload(no, file); };
            f.click();                                     // 없으면 내 컴퓨터에서 고르기
          };
        });
        const close = document.getElementById('zoomClose');
        if (close) close.onclick = e => { e.stopPropagation(); zoomId = null; render(); };
        const replace = document.getElementById('zoomReplace');
        if (replace) replace.onclick = e => {
          e.stopPropagation();
          const no = photos[zoomId]?.teamNo;
          zoomId = null;
          if (!no) return;
          f.onchange = () => { const file = f.files[0]; f.value = ''; if (file) upload(no, file); };
          f.click();
        };
        const layer = document.getElementById('zoomLayer');
        if (layer) layer.onclick = e => { e.stopPropagation(); if (e.target === layer) { zoomId = null; render(); } };
      } else if (page === 2) {
        renderQr(document.getElementById('voteQr'), hubUrl(), { width: 260, height: 260 });
        // 정책명은 타이핑이 끝난 뒤(포커스가 빠질 때) 저장한다 — 글자마다 저장하면 커서가 튄다.
        // 한 줄 input이 아니라 textarea인 이유 ─ 정책명이 길면 가로로 잘려 안 보이던 걸,
        // 두 줄·세 줄로 자연스럽게 내려가게 하려고(2026-09-08 요청). 줄이 늘면 그만큼 칸이
        // 세로로 커진다(growName). Enter는 줄바꿈이 아니라 "입력 끝"으로 쓴다(=저장).
        ctx.root.querySelectorAll('.votetable .pname').forEach(inp => {
          inp.oninput = () => fitVoteTable();
          inp.onblur = () => saveName(Number(inp.dataset.t), inp.textContent.trim());
          inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
          // 다른 데서 복사해 온 서식·줄바꿈이 통째로 들어오지 않게 순수 텍스트만 받는다
          // (contenteditable="plaintext-only"를 모르는 브라우저 대비)
          inp.onpaste = e => {
            e.preventDefault();
            const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
            document.execCommand('insertText', false, t);
          };
        });
        // 줄 수가 정해진 뒤에 재야 하므로 한 박자 뒤에 (rAF가 아닌 이유는 board.js 참고)
        setTimeout(fitVoteTable, 0);
      }
    }

    // 정책명 칸(textarea)을 내용 줄 수에 맞춰 세로로 늘린다 — 먼저 높이를 비워야
    // scrollHeight가 "지금 내용에 필요한 높이"로 다시 계산된다(안 그러면 줄어들지 않는다).
    // 커서를 글자 맨 뒤로 (다시 그린 뒤 이어서 칠 수 있게)
    function caretToEnd(el) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
    }

    // 정책명이 길어 두세 줄이 되면 그 줄만 세로로 커지는데, 조가 많고 이름도 다들 길면
    // 표 전체가 화면 밖으로 넘친다. 넘칠 때만 표 글자를 조금씩 줄여 딱 맞춘다(--vs).
    // 짧은 이름만 있으면 손대지 않으니 원래 크기 그대로 크게 보인다.
    function fitVoteTable() {
      // ⚠ 넘쳤는지는 .votetable이 아니라 바깥 .votewrap에서 재야 한다 — .voteright가
      // height:100%라 안쪽은 항상 "딱 맞다"고 나오고, 실제로 밀려 나가는 건 바깥 그리드다.
      const wrap = ctx.root.querySelector('.votewrap');
      const tb = wrap && wrap.querySelector('.votetable');
      if (!tb) return;
      const over = () => wrap.scrollHeight - wrap.clientHeight > 0;
      // 0.34까지 — 조 6개 이름이 전부 길고 화면 세로까지 짧은(노트북 768px) 최악의 경우에도
      // 잘리지 않고 다 보이게. 그런 경우가 아니면 여기까지 내려갈 일이 없다.
      const apply = s => tb.style.setProperty('--vs', Math.max(0.34, s).toFixed(2));
      apply(1);
      for (let s = 1; s > 0.34 && over(); s -= 0.04) apply(s - 0.04);
    }

    async function upload(teamNo, file) {
      uploading++; render();
      try {
        const photo = await uploadPhoto(file, teamNo);
        await hostSet(path('boardPhotos', `${teamNo}-main`), { teamNo, ...photo, at: Date.now() });
      } catch (e) {
        alert('업로드에 실패했습니다: ' + e.message);
      } finally { uploading--; render(); }
    }

    function saveName(teamNo, value) {
      const v = String(value || '').trim();
      if ((names[teamNo] || '') === v) return;
      names = { ...names, [teamNo]: v };
      hostSet(path('policy', 'live'), { page, open: page === 2, names });
    }

    function goPage(p) {
      page = Math.max(0, Math.min(LAST_PAGE, p));
      zoomId = null;
      hostSet(path('policy', 'live'), { page, open: page === 2, names });
      render();
    }

    function resetAll() {
      if (!confirm('올린 사진과 투표를 모두 지웁니다. 정말 초기화할까요?')) return;
      Object.keys(photos).forEach(id => hostReset(path('boardPhotos', id), {}));
      Object.keys(votes).forEach(id => hostReset(path('policyVotes', id), {}));
      // 사진을 지우는데 정책명 입력칸에 이전 값이 그대로 남아있으면 헷갈린다 — 같이 비운다.
      // hostSet은 merge라서 names 필드만 빈 객체로 갈아끼우고 page/open은 안 건드린다.
      names = {};
      hostSet(path('policy', 'live'), { names: {} });
    }

    function controlsFor() {
      return [
        { label: page === 0 ? '◀ 원탁토론으로' : '◀ 이전', onClick: () => (page === 0 ? ctx.goSession('board', { resume: true }) : goPage(page - 1)) },
        page < LAST_PAGE
          ? { label: page === 0 ? '갤러리 ▶' : '공감투표 ▶', variant: 'primary', onClick: () => goPage(page + 1) }
          : { label: '우수정책 시상 ▶', variant: 'primary', onClick: () => ctx.goSession('award', { resume: true }) },
        { label: '전체 초기화(사진·투표)', variant: 'danger', onClick: resetAll },
      ];
    }

    const forward = () => (page < LAST_PAGE ? goPage(page + 1) : ctx.goSession('award', { resume: true }));
    const backward = () => (page > 0 ? goPage(page - 1) : ctx.goSession('board', { resume: true }));
    ctx.setKeys({
      ArrowRight: forward,
      ArrowLeft: backward,
      ' ': forward,
      Escape: () => { if (zoomId) { zoomId = null; render(); } },
    });

    unsubs.push(watch(path(), snap => {
      const n = Number(snap?.teamCount) || ctx.forum.teamCount || ctx.forum.teams.length;
      if (n !== teamCount) { teamCount = n; render(); }
    }));
    unsubs.push(watch(path('policy', 'live'), snap => {
      names = snap?.names || {};
      render();
    }));
    unsubs.push(watchCollection(path('boardPhotos'), snap => {
      photos = Object.fromEntries(Object.entries(snap).filter(([, v]) => v && v.url));
      render();
    }));
    unsubs.push(watchCollection(path('policyVotes'), snap => {
      votes = Object.fromEntries(Object.entries(snap).filter(([, v]) => v && v.ranks));
      render();
    }));

    render();
    return { unmount() { unsubs.forEach(u => u && u()); } };
  },
};
