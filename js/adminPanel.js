/* ───────────────────────────────────────
   만족도조사 진행자 관리 화면(admin.html 전용).

   신뢰 모델은 이 프로젝트 나머지와 같다(firebase/firestore.rules 위 설명 참고) —
   하룻밤 행사용 내부 도구라, 이 페이지는 host.html처럼 URL에 ?k=가 있어야만
   조작 버튼을 "보여준다". 실제 쓰기 권한은 Realtime Database 규칙
   (firebase/database.rules.json)이 "익명 인증만" 확인하는 수준이라, 이 링크를
   아는 사람이면 누구든 쓸 수 있다 — 그래서 이 URL을 참가자에게 공유하면 안 된다.

   고칠 때 ─ 문항 문구(엑셀 헤더용) → content/07-survey.json
             응답 저장·구독 방식     → js/survey.js
             화면·색                → 이 파일 렌더 + css/sessions/survey.css
   ─────────────────────────────────────── */
import { getHostKey } from './db.js';
import { loadSurvey } from './content.js';
import { watchResponses, watchPaused, setPaused, setHidden } from './survey.js';
import { esc } from './util.js';

const app = document.getElementById('app');
const hostKey = getHostKey();
let data = null;
let responses = {};
let paused = false;

function row(id, r) {
  return `<div class="adminrow">
    <div class="adminmeta">
      <span>${new Date(r.timestamp || 0).toLocaleTimeString('ko-KR')}</span>
      <span>Q1 ${r.q1_satisfaction ?? '–'}점</span>
      <span>Q4 ${r.q4_timing ?? '–'}</span>
    </div>
    <div class="admincell">
      <label class="hidetoggle"><input type="checkbox" data-id="${id}" data-field="hidden_q3" ${r.hidden_q3 ? 'checked' : ''}> Q3 숨김</label>
      <div class="admintext ${r.hidden_q3 ? 'ishidden' : ''}">${r.q3_memorable ? esc(r.q3_memorable) : '<i>(무응답)</i>'}</div>
    </div>
    <div class="admincell">
      <label class="hidetoggle"><input type="checkbox" data-id="${id}" data-field="hidden_q5" ${r.hidden_q5 ? 'checked' : ''}> Q5 숨김</label>
      <div class="admintext ${r.hidden_q5 ? 'ishidden' : ''}">${r.q5_free ? esc(r.q5_free) : '<i>(무응답)</i>'}</div>
    </div>
  </div>`;
}

function render() {
  const ids = Object.keys(responses).sort((a, b) => (responses[b].timestamp || 0) - (responses[a].timestamp || 0));
  app.innerHTML = `
    <div class="adminbar">
      <button id="btnPause" class="${paused ? 'primary' : 'ghost'}">${paused ? '▶ 다시 보이기' : '⏸ 전체 일시정지'}</button>
      <button id="btnXlsx" class="ghost">⬇ 엑셀 다운로드</button>
      <span class="admincount">응답 ${ids.length}명</span>
    </div>
    <div class="adminlist">${ids.map(id => row(id, responses[id])).join('') || '<p class="adminempty">아직 응답이 없습니다.</p>'}</div>`;

  document.getElementById('btnPause').onclick = () => setPaused(!paused);
  document.getElementById('btnXlsx').onclick = downloadXlsx;
  app.querySelectorAll('.hidetoggle input').forEach(inp => {
    inp.onchange = () => setHidden(inp.dataset.id, inp.dataset.field, inp.checked);
  });
}

function downloadXlsx() {
  if (!window.XLSX) { alert('엑셀 라이브러리를 아직 불러오는 중입니다. 잠시 후 다시 눌러주세요.'); return; }
  const ids = Object.keys(responses).sort((a, b) => (responses[a].timestamp || 0) - (responses[b].timestamp || 0));
  const q2Label = key => data.q2.options.find(o => o.key === key)?.label || key;
  const q1Label = n => data.q1.options[n - 1] || '';
  const q4Label = n => data.q4.options[n - 1] || '';

  const rows = ids.map((id, i) => {
    const r = responses[id];
    const q2 = r.q2_programs || [];
    return {
      '응답번호': i + 1,
      '응답시각': r.timestamp ? new Date(r.timestamp).toLocaleString('ko-KR') : '',
      'Q1 만족도(숫자)': r.q1_satisfaction ?? '',
      'Q1 응답값': r.q1_satisfaction ? q1Label(r.q1_satisfaction) : '',
      'Q2 선택1': q2[0] ? q2Label(q2[0]) : '',
      'Q2 선택2': q2[1] ? q2Label(q2[1]) : '',
      'Q3 기억에 남는 점': r.q3_memorable || '',
      'Q4 시간구성(숫자)': r.q4_timing ?? '',
      'Q4 시간구성': r.q4_timing ? q4Label(r.q4_timing) : '',
      'Q4 이유': r.q4_reason || '',
      'Q5 기타의견': r.q5_free || '',
    };
  });

  const satisfactionVals = ids.map(id => responses[id].q1_satisfaction).filter(Boolean);
  const avg = satisfactionVals.length ? (satisfactionVals.reduce((a, b) => a + b, 0) / satisfactionVals.length) : 0;
  const posRate = satisfactionVals.length ? (satisfactionVals.filter(v => v <= 2).length / satisfactionVals.length * 100) : 0;
  const summary = [
    { '항목': '응답자 수', '값': ids.length },
    { '항목': '평균 만족도(1=매우만족~5=매우불만족)', '값': avg ? avg.toFixed(2) : '' },
    { '항목': '긍정응답률(①+② 비율)', '값': satisfactionVals.length ? posRate.toFixed(1) + '%' : '' },
  ];
  data.q1.options.forEach((label, i) => {
    const n = satisfactionVals.filter(v => v === i + 1).length;
    summary.push({ '항목': `Q1 "${label}" 응답 수`, '값': n });
  });
  data.q2.options.forEach(o => {
    const n = ids.filter(id => (responses[id].q2_programs || []).includes(o.key)).length;
    summary.push({ '항목': `Q2 "${o.label}" 선택 수`, '값': n });
  });
  data.q4.options.forEach((label, i) => {
    const n = ids.filter(id => responses[id].q4_timing === i + 1).length;
    summary.push({ '항목': `Q4 "${label}" 응답 수`, '값': n });
  });

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), '원본 응답');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(summary), '집계');
  window.XLSX.writeFile(wb, `부안청년포럼_만족도조사_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

if (!hostKey) {
  app.innerHTML = `<p class="adminempty">진행자 키가 필요합니다. admin.html?k=진행자키 형식의 주소로 접속하세요.</p>`;
} else {
  loadSurvey().then(d => {
    data = d;
    watchResponses(r => { responses = r; render(); });
    watchPaused(p => { paused = p; render(); });
  }).catch(e => {
    app.innerHTML = `<p class="adminempty">content/07-survey.json 로드 실패: ${esc(e.message)}</p>`;
  });
}
