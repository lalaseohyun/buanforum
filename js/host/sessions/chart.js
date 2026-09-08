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
import { esc, sentences } from '../../util.js';

export function renderChart(chart) {
  if (!chart) return '';
  const body = chart.type === 'bar' ? renderBar(chart)
    : chart.type === 'line' ? renderLine(chart)
    : chart.type === 'table' ? renderTable(chart)
    : '';
  const note = chart.note ? `<div class="chartnote">${sentences(chart.note)}</div>` : '';
  // 막대·꺾은선 그래프는 왼쪽에 그래프를 꽉 채우고 오른쪽에 해설을 두는 좌우 2단 구성.
  // 표(table)는 이미 글자 위주라 예전처럼 위(해설)·아래(표) 구성을 그대로 쓴다.
  if (chart.type === 'bar' || chart.type === 'line') {
    return `<div class="chartwrap chartwrap-split">
      <div class="chartleft"><h3>${esc(chart.title)}</h3><div class="chartbox">${body}</div></div>
      <div class="chartright">${note}</div>
    </div>`;
  }
  return `<div class="chartwrap"><h3>${esc(chart.title)}</h3>${note}<div class="chartbox">${body}</div></div>`;
}

function renderBar(chart) {
  // 글자를 2배로 키운 만큼(css/sessions/chart.css) 왼쪽 라벨 자리와 막대 두께도 같이 키웠다.
  // ⚠ 아래 숫자들은 화면 px이 아니라 viewBox 안의 좌표 단위다(SVG가 통째로 화면에 맞게
  //    확대·축소된다). 그래서 글자 크기도 여기서 좌표 단위로 정해야 줄 간격과 비례가 맞는다 —
  //    CSS에 vw로 적어 두면 화면이 넓어질수록 글자만 커지고 줄 간격은 그대로라 겹친다
  //    (문제 1은 15줄이라 1920 화면에서 글자 38 > 줄 간격 32로 실제로 겹쳤다, 2026-09-08).
  const W = 1000, H = 700, padL = 270, padR = 90, padT = 20, padB = 20;
  const rows = chart.rows;
  const max = Math.max(...rows.map(r => r.value)) * 1.08;
  const rowH = (H - padT - padB) / rows.length;
  // 줄 간격의 62% — 줄이 몇 개든 절대 안 겹치는 크기로 자동으로 정해진다
  const fs = (rowH * 0.62).toFixed(1);
  const hi = new Set(chart.highlight || []);
  // 막대 두께를 rowH의 64%로(예전엔 82%) 줄여서, 그만큼 막대 사이 세로 간격이
  // 2배로 넓어진다(막대가 많은 문항일수록 다닥다닥 붙어 보이던 문제).
  // 위아래로 남는 18%씩을 띄우는 것이라 막대 중심은 그대로라(0.18+0.32=0.5)
  // 라벨·수치 글자의 y좌표(0.62, 아래)는 안 건드려도 된다.
  const bars = rows.map((r, i) => {
    const y = padT + i * rowH;
    const w = (r.value / max) * (W - padL - padR);
    const isHi = hi.has(r.label);
    return `
      <text x="${padL - 14}" y="${y + rowH * 0.62}" font-size="${fs}" text-anchor="end" class="bar-label ${isHi ? 'hi' : ''}">${esc(r.label)}</text>
      <rect x="${padL}" y="${y + rowH * 0.18}" width="${Math.max(2, w)}" height="${rowH * 0.64}" rx="6" class="bar-rect ${isHi ? 'hi' : ''}"/>
      <text x="${padL + w + 12}" y="${y + rowH * 0.62}" font-size="${fs}" class="bar-value ${isHi ? 'hi' : ''}">${r.value}${esc(chart.unit || '')}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

function renderLine(chart) {
  // renderBar와 같은 이유로 글자 크기를 여기(viewBox 좌표 단위)에서 정한다 —
  // CSS에 vw로 두면 점 사이 간격(stepX)과 비례가 안 맞아 "11,227" 같은 수치가 옆 점 것과
  // 가로로 겹친다(2026-09-08). 점 간격에 맞춰 자동으로 정해지게 한다.
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
  // 가장 긴 수치가 점 간격 안에 들어가는 크기(한 글자 폭 ≈ 0.58em으로 잡음), 최대 42
  const longest = Math.max(...rows.map(r => r.value.toLocaleString().length), 4);
  const fs = Math.min(42, (stepX - 12) / (longest * 0.58)).toFixed(1);
  const dots = xy.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" class="line-dot"/>
    <text x="${p.x.toFixed(1)}" y="${(p.y - fs * 0.55).toFixed(1)}" font-size="${fs}" text-anchor="middle" class="line-value">${p.value.toLocaleString()}</text>
    <text x="${p.x.toFixed(1)}" y="${(H - padB + fs * 0.9).toFixed(1)}" font-size="${fs}" text-anchor="middle" class="line-tick">${esc(p.label)}</text>`).join('');
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
