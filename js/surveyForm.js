/* ───────────────────────────────────────
   만족도조사 — 참여자 설문 폼(survey.html 전용, 모바일).
   조 선택 없이 QR로 바로 들어와서 낸다. 완전 익명 — 어떤 식별값도 안 남긴다.

   고칠 때 ─ 문항 문구        → content/07-survey.json
             저장 방식        → js/survey.js(Realtime Database)
             화면·색          → 이 파일의 렌더 + css/sessions/survey.css
   ─────────────────────────────────────── */
import { loadSurvey } from './content.js';
import { submitSurvey } from './survey.js';
import { esc } from './util.js';

const app = document.getElementById('app');

function radioGroup(name, options, required) {
  return `<div class="optgrid">${options.map((label, i) => `
    <label class="optcard">
      <input type="radio" name="${name}" value="${i + 1}" ${required ? 'required' : ''}>
      <span>${esc(label)}</span>
    </label>`).join('')}</div>`;
}

function checkGroup(name, options, max) {
  return `<div class="optgrid" data-max="${max}">${options.map(o => `
    <label class="optcard">
      <input type="checkbox" name="${name}" value="${esc(o.key)}">
      <span>${esc(o.label)}</span>
    </label>`).join('')}</div>`;
}

function render(data) {
  app.innerHTML = `
    <form id="surveyForm">
      <div class="q">
        <div class="qtitle">Q1. ${esc(data.q1.question)}</div>
        ${radioGroup('q1', data.q1.options, true)}
      </div>
      <div class="q">
        <div class="qtitle">Q2. ${esc(data.q2.question)}</div>
        <div class="qnote">${esc(data.q2.note)}</div>
        ${checkGroup('q2', data.q2.options, data.q2.max)}
      </div>
      <div class="q">
        <div class="qtitle">Q3. ${esc(data.q3.question)}</div>
        <textarea name="q3" maxlength="300" placeholder="${esc(data.q3.placeholder)}"></textarea>
      </div>
      <div class="q">
        <div class="qtitle">Q4. ${esc(data.q4.question)}</div>
        ${radioGroup('q4', data.q4.options, true)}
        <div class="qnote" style="margin-top:14px">${esc(data.q4.reasonLabel)}</div>
        <textarea name="q4_reason" maxlength="200" placeholder="${esc(data.q4.reasonPlaceholder)}"></textarea>
      </div>
      <div class="q">
        <div class="qtitle">Q5. ${esc(data.q5.question)}</div>
        <textarea name="q5" maxlength="300" placeholder="${esc(data.q5.placeholder)}"></textarea>
      </div>
      <button type="submit" class="primary" id="submitBtn" style="width:100%;margin-top:8px">${esc(data.submit.button)}</button>
    </form>`;

  // Q2 — 최대 개수(max) 넘게 못 고르게 막는다
  const q2Grid = app.querySelector('[name="q2"]')?.closest('.optgrid');
  if (q2Grid) {
    const max = Number(q2Grid.dataset.max) || 2;
    q2Grid.addEventListener('change', () => {
      const boxes = [...q2Grid.querySelectorAll('input[type=checkbox]')];
      const checked = boxes.filter(b => b.checked);
      boxes.forEach(b => { b.disabled = !b.checked && checked.length >= max; });
    });
  }

  document.getElementById('surveyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    const fd = new FormData(e.target);
    const payload = {
      q1_satisfaction: Number(fd.get('q1')) || null,
      q2_programs: fd.getAll('q2'),
      q3_memorable: (fd.get('q3') || '').trim(),
      q4_timing: Number(fd.get('q4')) || null,
      q4_reason: (fd.get('q4_reason') || '').trim(),
      q5_free: (fd.get('q5') || '').trim(),
    };
    try {
      await submitSurvey(payload);
      renderThanks(data);
    } catch (err) {
      alert('제출에 실패했습니다: ' + err.message);
      btn.disabled = false;
      btn.textContent = data.submit.button;
    }
  });
}

function renderThanks(data) {
  app.innerHTML = `<div class="center">
    <div class="big">${esc(data.submit.thanks)}</div>
    <div class="sub">${esc(data.submit.thanksSub)}</div>
  </div>`;
}

loadSurvey().then(render).catch(e => {
  app.innerHTML = `<div class="center"><div class="big">문항을 불러오지 못했습니다</div><div class="sub">${esc(e.message)}</div></div>`;
});
