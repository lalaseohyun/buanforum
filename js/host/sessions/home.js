/* ───────────────────────────────────────
   홈 — 타이틀 화면(+ 오늘 진행할 조 수 선택) → 클릭/방향키 → 2×2(5개면 3줄) 진행순서 카드.
   카드를 누르면 해당 세션으로 이동한다(하단 탭바를 누른 것과 동일).
   화살표는 전체 세션을 한 줄로 잇는다 ─ 카드 화면에서 더 가면 1.오프닝으로 넘어가고,
   1.오프닝의 첫 페이지에서 뒤로 가면 다시 여기(카드 화면)로 돌아온다.

   타이틀 화면은 디자인 캔버스 목업에서 자유 배치한 좌표를 그대로 쓴다.
   1600×801 무대를 화면 크기에 맞춰 통째로 확대/축소하므로(js/util.js fitStage),
   어느 해상도에서 열어도 목업과 같은 그림이 나온다.

   오늘 몇 조로 진행할지는 여기서 딱 한 번 고르면 된다 — Firestore forum 문서의
   teamCount에 저장되고, 2.퀴즈 대기화면·5.대표정책 갤러리·공감투표가 전부 그 수를 따라간다.

   고칠 때 ─ 행사명·날짜·주제 문구   → content/forum.json
             요소 위치(left/top)     → 아래 STAGE의 숫자 (1600×801 기준 px)
             로고 이미지 파일         → assets/laain-logo-white-full.png
             조 수 선택 버튼 모양     → css/sessions/slides.css (.hometeams)
             카드 화면               → 아래 renderCards + css/sessions/slides.css
   ─────────────────────────────────────── */
import { esc, fitStage } from '../../util.js';
import { watch, hostSet, path } from '../../db.js';

// 다른 세션에서 화살표로 홈까지 되돌아왔을 때 타이틀부터 다시 보여주지 않도록,
// 마지막으로 보던 화면(타이틀/카드)을 모듈 스코프에 기억해 둔다.
let lastShowCards = false;

export default {
  id: 'home',
  title: '홈',
  mount(ctx) {
    let showCards = lastShowCards;
    let teamCount = ctx.forum.teamCount || ctx.forum.teams.length;
    let stopFit = null;
    const unsubs = [];

    function teamOptions() {
      return [3, 4, 5, 6, 7, 8].filter(n => n <= ctx.forum.teams.length);
    }

    function renderTitle() {
      const f = ctx.forum;
      const tcButtons = teamOptions().map(n =>
        `<button class="tcbtn ${n === teamCount ? 'on' : ''}" data-n="${n}">${n}</button>`).join('');
      ctx.root.innerHTML = `
        <div class="stagewrap">
          <div class="stage1600" id="homeStage">
            <h1 class="abs" style="left:542px;top:223px;font-size:56px;font-weight:800;letter-spacing:-.04em;line-height:1.2;color:var(--ink)">${esc(f.title)}</h1>
            <span class="abs" style="left:276px;top:306px;font-size:76px;font-weight:700;letter-spacing:-.02em;color:var(--yellow)">${esc(f.subtitle || '')}</span>
            <div class="abs" style="left:650px;top:471px;width:300px;text-align:center;font-size:25px;font-weight:800;letter-spacing:.14em;color:#D2D0CB">${esc(f.date || '')}</div>
            <div class="abs homelogo" style="left:615px;top:622px;width:383px;height:88px">
              <img src="assets/laain-logo-white-full.png" alt="라인교육연구소" style="width:383px;height:88px"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
              <span style="display:none">라인교육연구소</span>
            </div>
            <div class="abs hometeams" id="homeTeams" style="left:500px;top:548px;width:600px">
              <div class="httl">오늘 진행할 조 수</div>
              <div class="htbtns">${tcButtons}</div>
            </div>
          </div>
        </div>`;
      stopFit = fitStage(document.getElementById('homeStage'));
      // 조 수 버튼을 눌러도 화면 전체 클릭(다음으로 넘어가기)이 같이 발동하지 않게 막는다
      document.getElementById('homeTeams').onclick = e => e.stopPropagation();
      ctx.root.querySelectorAll('.tcbtn').forEach(b => {
        b.onclick = () => {
          teamCount = Number(b.dataset.n);
          hostSet(path(), { teamCount });
          render();
        };
      });
      ctx.root.onclick = goNext;
    }

    function renderCards() {
      ctx.root.onclick = null;
      const cards = ctx.forum.sessions.map(s => `
        <div class="homecard" data-s="${s.id}">
          <div class="n">${s.no}</div>
          <div class="t">${esc(s.title)}</div>
          <div class="s">${esc(s.subtitle || '')}</div>
        </div>`).join('');
      ctx.root.innerHTML = `<div class="homegrid">${cards}</div>`;
      ctx.root.querySelectorAll('.homecard').forEach(el => {
        el.onclick = () => ctx.goSession(el.dataset.s);
      });
    }

    function render() {
      if (stopFit) { stopFit(); stopFit = null; }
      lastShowCards = showCards;
      ctx.setControls(showCards
        ? [{ label: '◀ 처음 화면', onClick: goPrev }, { label: '1. 오프닝으로 ▶', variant: 'primary', onClick: () => ctx.goSession('opening') }]
        : []);
      showCards ? renderCards() : renderTitle();
    }
    function goNext() { if (!showCards) { showCards = true; render(); } else { ctx.goSession('opening'); } }
    function goPrev() { if (showCards) { showCards = false; render(); } }

    render();
    ctx.setKeys({ ' ': goNext, ArrowRight: goNext, ArrowLeft: goPrev });

    unsubs.push(watch(path(), snap => {
      const n = Number(snap?.teamCount);
      if (n && n !== teamCount) { teamCount = n; if (!showCards) render(); }
    }));

    return { unmount() { if (stopFit) stopFit(); ctx.root.onclick = null; unsubs.forEach(u => u && u()); } };
  },
};
