/* ───────────────────────────────────────
   7. 만족도조사 — 진행자 화면. 화살표로 두 페이지가 이어진다.
     0) QR + 실시간 응답 수 카운터 — 참여자는 survey.html(별도 페이지, 모바일 전용)로 들어온다
     1) 실시간 오픈엔디드 2분할 — 왼쪽 Q3(기억에 남는 것) · 오른쪽 Q5(하고 싶은 말)
        카드 애니메이션(하이라이트→합류→순환→셔플)은 ./surveyWall.js가 맡는다.

   진행자 전용 관리 화면(응답 숨김·전체 일시정지·엑셀 다운로드)은 이 탭 안이 아니라
   별도 페이지 admin.html에 있다 — 참가자에게 보이면 안 되는 조작이라 아예 다른
   URL로 뺐다(문서 원안 그대로).

   고칠 때 ─ 문항·안내 문구            → content/07-survey.json
             카드 애니메이션 타이밍     → ./surveyWall.js
             응답 저장·구독 방식        → js/survey.js(Realtime Database)
             색·크기                   → css/sessions/survey.css
   ─────────────────────────────────────── */
import { esc } from '../../util.js';
import { loadSurvey } from '../../content.js';
import { watchResponses, watchPaused } from '../../survey.js';
import { createWallColumn } from './surveyWall.js';

// opening.js와 같은 이유로, 화살표로 이어서 들어올 때만(ctx.resume) 마지막 페이지를 쓴다.
let lastIndex = 0;

export default {
  id: 'survey',
  title: '만족도조사',
  mount(ctx) {
    let data = null, index = ctx.resume ? lastIndex : 0; // 0 = QR·카운터, 1 = 실시간 오픈엔디드
    let responses = {};
    let paused = false;
    let col3 = null, col5 = null;
    const unsubs = [];

    const dots = () => `<div class="pagedots">${[0, 1].map(i =>
      `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>`;
    // 참여자 화면은 이 탭 안이 아니라 별도 정적 페이지(survey.html)다
    const surveyUrl = () => location.href.replace(/host\.html.*$/, '') + 'survey.html';

    // 응답 문서의 실제 필드명(js/surveyForm.js·admin.html과 반드시 맞춰야 함): q3_memorable / q5_free
    const RESPONSE_FIELD = { q3: 'q3_memorable', q5: 'q5_free' };
    function visibleItems(field) {
      const key = RESPONSE_FIELD[field];
      return Object.entries(responses)
        .filter(([, r]) => r && !r[`hidden_${field}`])
        .map(([id, r]) => ({ id, text: r[key] }))
        .filter(it => it.text);
    }

    function renderIntro() {
      ctx.root.innerHTML = `<div class="slide surveyintro">
        <h2>${esc(data.intro.title)}</h2>
        <div class="qrbox"><div id="surveyQr"></div></div>
        <p class="sub">${esc(data.intro.sub)}</p>
        <div class="surveycount">응답 <b id="surveyCountNum">${Object.keys(responses).length}</b>명</div>
      </div>${dots()}`;
      const holder = document.getElementById('surveyQr');
      if (holder && window.QRCode) {
        holder.innerHTML = '';
        new QRCode(holder, { text: surveyUrl(), width: 300, height: 300, colorDark: '#2c2c2a', colorLight: '#ffffff' });
      }
    }

    function renderWall() {
      ctx.root.innerHTML = `<div class="wallwrap">
        <div class="wallcol" id="wallQ3"></div>
        <div class="wallcol" id="wallQ5"></div>
      </div>${dots()}
      ${paused ? `<div class="wallpaused">⏸ 진행자가 화면을 잠시 멈췄습니다</div>` : ''}`;
      col3 = createWallColumn(document.getElementById('wallQ3'), { title: data.q3.wallTitle });
      col5 = createWallColumn(document.getElementById('wallQ5'), { title: data.q5.wallTitle });
      if (!paused) { col3.update(visibleItems('q3')); col5.update(visibleItems('q5')); }
    }

    function destroyWall() {
      col3?.destroy(); col5?.destroy(); col3 = null; col5 = null;
    }

    function render() {
      lastIndex = index;
      destroyWall();
      index === 0 ? renderIntro() : renderWall();
      ctx.setControls([
        { label: index === 0 ? '◀ 우수정책으로' : '◀ 이전', onClick: prev },
        { label: index >= 1 ? '만족도조사 끝' : '실시간 화면 보기 ▶', onClick: next, variant: 'primary' },
      ]);
    }
    // 마지막 세션이라 더 다음이 없다 — 화살표를 계속 눌러도 마지막 페이지에 머문다
    function next() { if (index < 1) { index++; render(); } }
    function prev() { if (index > 0) { index--; render(); } else ctx.goSession('award', { resume: true }); }

    loadSurvey().then(d => { data = d; render(); })
      .catch(e => { ctx.root.innerHTML = `<div class="slide"><h2>content/07-survey.json 로드 실패</h2><p class="sub">${esc(e.message)}</p></div>`; });

    unsubs.push(watchResponses(r => {
      responses = r;
      const cnt = document.getElementById('surveyCountNum');
      if (cnt) cnt.textContent = String(Object.keys(responses).length);
      if (index === 1 && !paused) { col3?.update(visibleItems('q3')); col5?.update(visibleItems('q5')); }
    }));
    unsubs.push(watchPaused(p => {
      const changed = p !== paused;
      paused = p;
      if (index === 1 && changed) render();
    }));

    ctx.setKeys({ ArrowRight: next, ArrowLeft: prev, ' ': next });
    return { unmount() { destroyWall(); unsubs.forEach(u => u && u()); } };
  },
};
