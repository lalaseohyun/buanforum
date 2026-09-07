/* ───────────────────────────────────────
   5. 대표정책 — 진행자 화면. 화살표로 두 페이지가 이어진다.
     0) 정책 갤러리(메인페이지) — 위에 "대표정책" kicker + 제목 + 안내문이 있고,
        그 아래 진행자가 자기 컴퓨터에서 조별 사진을 올리는 칸이 있다.
        사진을 누르면 전체화면으로 크게 띄우고, 거기서 "사진 바꾸기"로 다시 올릴 수 있다.
     1) 공감투표 — 참여자 허브 안내 QR + 조별 정책명(진행자가 직접 기입) + 실시간 집계.
        표 수만큼 동그란 점이 박스 안에 콕콕 찍히는 방식(멘티미터 스타일, 막대 아님).
        조가 적을수록(예: 3개) 한 줄이 세로로 더 크게 — 화면을 항상 채우도록
        css/sessions/policy.css의 .voterow가 flex:1로 남는 세로 공간을 나눠 가진다.

   고칠 때 ─ 조 수                  → 퀴즈 대기화면에서 고른 값(Firestore forum 문서)
             투표 규칙(순위별 표수) → js/db.js의 voteWeights
             색·크기·점 애니메이션  → css/sessions/policy.css
   쓰는 것 ─ js/db.js(boardPhotos·policy/live·policyVotes) · js/storage.js(사진 업로드)
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { watch, watchCollection, hostSet, hostReset, path, tallyVotes, voteWeights } from '../../db.js';
import { uploadPhoto } from '../../storage.js';

export default {
  id: 'policy',
  title: '대표정책',
  mount(ctx) {
    let page = 0;                 // 0 갤러리 · 1 공감투표
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
      // 투표가 들어올 때마다 다시 그리는데, 그 순간 진행자가 정책명을 치고 있을 수 있다.
      // 치던 칸(값·커서)을 붙잡아 뒀다가 그린 뒤에 되돌려 준다.
      const act = document.activeElement;
      const typing = act && act.matches?.('.votetable input')
        ? { t: act.dataset.t, v: act.value, s: act.selectionStart } : null;

      ctx.root.innerHTML = page === 0 ? viewGallery() : viewVote();
      wire();
      ctx.setControls(controlsFor());

      if (typing) {
        const back = ctx.root.querySelector(`.votetable input[data-t="${typing.t}"]`);
        if (back) {
          back.value = typing.v;
          back.focus();
          try { back.setSelectionRange(typing.s, typing.s); } catch {}
        }
      }
    }

    /* ---- 0. 갤러리(메인페이지) ---- */
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
          <p>논의결과 종이를 사진찍어서 올려주세요!</p>
        </div>
        <div class="gallery" style="--cols:${teamCount <= 4 ? 2 : 3}">${cards}</div>
      </div>
        <input type="file" accept="image/*" id="fileUp" hidden>
        ${uploading ? `<div class="uploading">사진 올리는 중…</div>` : ''}${zoom}
        <div class="pagedots"><i class="on"></i><i></i></div>`;
    }

    /* ---- 1. 공감투표 ---- */
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
          <div class="name"><input data-t="${tm.no}" value="${esc(names[tm.no] || '')}" placeholder="정책명을 적어주세요"></div>
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
      <div class="pagedots"><i></i><i class="on"></i></div>`;
    }

    function wire() {
      if (page === 0) {
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
      } else {
        const holder = document.getElementById('voteQr');
        if (holder && window.QRCode) {
          holder.innerHTML = '';
          new QRCode(holder, { text: hubUrl(), width: 260, height: 260, colorDark: '#2c2c2a', colorLight: '#ffffff' });
        }
        // 정책명은 타이핑이 끝난 뒤(포커스가 빠질 때) 저장한다 — 글자마다 저장하면 커서가 튄다
        ctx.root.querySelectorAll('.votetable input').forEach(inp => {
          inp.onblur = () => saveName(Number(inp.dataset.t), inp.value);
          inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
        });
      }
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
      hostSet(path('policy', 'live'), { page, open: page === 1, names });
    }

    function goPage(p) {
      page = Math.max(0, Math.min(1, p));
      zoomId = null;
      hostSet(path('policy', 'live'), { page, open: page === 1, names });
      render();
    }

    function resetAll() {
      if (!confirm('올린 사진과 투표를 모두 지웁니다. 정말 초기화할까요?')) return;
      Object.keys(photos).forEach(id => hostReset(path('boardPhotos', id), {}));
      Object.keys(votes).forEach(id => hostReset(path('policyVotes', id), {}));
    }

    function controlsFor() {
      return [
        { label: '◀ 이전', onClick: () => (page === 0 ? ctx.goSession('board', { resume: true }) : goPage(0)) },
        page === 0
          ? { label: '공감투표 ▶', variant: 'primary', onClick: () => goPage(1) }
          : { label: '우수정책 시상 ▶', variant: 'primary', onClick: () => ctx.goSession('award', { resume: true }) },
        { label: '전체 초기화(사진·투표)', variant: 'danger', onClick: resetAll },
      ];
    }

    ctx.setKeys({
      ArrowRight: () => (page === 0 ? goPage(1) : ctx.goSession('award', { resume: true })),
      ArrowLeft: () => (page === 0 ? ctx.goSession('board', { resume: true }) : goPage(0)),
      ' ': () => (page === 0 ? goPage(1) : ctx.goSession('award', { resume: true })),
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
