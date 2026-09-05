/* ───────────────────────────────────────
   ⭐ 정답 공개 뒤 데이터 화면 — 렌더 헬퍼.

   독립된 "세션"이 아니라 quiz.js가 정답 공개 후 「데이터 보기」를 누르면
   불러 쓰는 함수 모음이다(탭바에서 직접 못 들어간다). 문항에 chart 필드가
   있을 때만 quiz.js가 이 모듈을 사용한다.

   고칠 때 ─ 그래프에 쓸 수치        → content/02-quiz.json의 각 문항 "chart"
             그래프를 그리는 방식     → 이 파일
             색·크기                 → css/sessions/chart.css
   라이브러리 없이 순수 SVG로 그린다. renderChart(chart) → HTML 문자열.
   ─────────────────────────────────────── */
import { esc } from '../../util.js';

export function renderChart(chart) {
  if (!chart) return '';
  const body = chart.type === 'bar' ? renderBar(chart)
    : chart.type === 'line' ? renderLine(chart)
    : chart.type === 'table' ? renderTable(chart)
    : '';
  return `<div class="chartwrap"><h3>${esc(chart.title)}</h3><div class="chartbox">${body}</div></div>`;
}

function renderBar(chart) {
  const W = 1000, H = 520, padL = 220, padR = 70, padT = 20, padB = 20;
  const rows = chart.rows;
  const max = Math.max(...rows.map(r => r.value)) * 1.08;
  const rowH = (H - padT - padB) / rows.length;
  const hi = new Set(chart.highlight || []);
  const bars = rows.map((r, i) => {
    const y = padT + i * rowH;
    const w = (r.value / max) * (W - padL - padR);
    const isHi = hi.has(r.label);
    return `
      <text x="${padL - 14}" y="${y + rowH * 0.62}" text-anchor="end" class="bar-label ${isHi ? 'hi' : ''}">${esc(r.label)}</text>
      <rect x="${padL}" y="${y + rowH * 0.18}" width="${Math.max(2, w)}" height="${rowH * 0.64}" rx="6" class="bar-rect ${isHi ? 'hi' : ''}"/>
      <text x="${padL + w + 12}" y="${y + rowH * 0.62}" class="bar-value ${isHi ? 'hi' : ''}">${r.value}${esc(chart.unit || '')}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

function renderLine(chart) {
  const W = 1000, H = 480, padL = 60, padR = 40, padT = 30, padB = 50;
  const rows = chart.rows;
  const max = Math.max(...rows.map(r => r.value)) * 1.12;
  const min = 0;
  const stepX = (W - padL - padR) / (rows.length - 1);
  const xy = rows.map((r, i) => {
    const x = padL + i * stepX;
    const y = padT + (H - padT - padB) * (1 - (r.value - min) / (max - min));
    return { x, y, ...r };
  });
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const dots = xy.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" class="line-dot"/>
    <text x="${p.x.toFixed(1)}" y="${p.y - 18}" text-anchor="middle" class="line-value">${p.value.toLocaleString()}</text>
    <text x="${p.x.toFixed(1)}" y="${H - padB + 28}" text-anchor="middle" class="line-tick">${esc(p.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
    <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="line-axis"/>
    <path d="${path}" class="line-path"/>${dots}
  </svg>`;
}

function renderTable(chart) {
  const hiRow = chart.highlightRow;
  const head = `<tr>${chart.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = chart.rows.map((r, i) => `<tr class="${i === hiRow ? 'hi' : ''}">${
    r.map((v, j) => `<td class="${j > 0 && chart.columns[j] !== '내용' ? 'num' : ''}">${esc(v)}</td>`).join('')
  }</tr>`).join('');
  return `<table class="dtable"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}
