'use strict';

// ─── Tabs (landing page) ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// Nav "↑ Upload" scrolls to hero upload zone
document.getElementById('nav-upload-btn').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('upload-zone').scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => document.getElementById('upload-zone').focus(), 400);
});

// ─── Context Preview toggle (landing page) ───────────────────────────────────
const wygToggle = document.getElementById('wyg-toggle');
if (wygToggle) {
  wygToggle.addEventListener('click', () => {
    const wrap = wygToggle.closest('.wyg-preview-wrap');
    wrap.dataset.preview = wrap.dataset.preview === '1' ? '2' : '1';
  });
}

// ─── Visibility tab toggle ────────────────────────────────────────────────────
const visToggle = document.getElementById('vis-toggle');
if (visToggle) {
  visToggle.addEventListener('click', () => {
    const wrap = visToggle.closest('.vis-preview-wrap');
    wrap.dataset.vis = wrap.dataset.vis === '1' ? '2' : '1';
  });
}

// ─── Technical Readiness tab toggle ──────────────────────────────────────────
const techToggle = document.getElementById('tech-toggle');
if (techToggle) {
  techToggle.addEventListener('click', () => {
    const wrap = techToggle.closest('.tech-preview-wrap');
    wrap.dataset.tech = wrap.dataset.tech === '1' ? '2' : '1';
  });
}

// ─── Summary tab toggle ───────────────────────────────────────────────────────
const sumToggle = document.getElementById('sum-toggle');
if (sumToggle) {
  sumToggle.addEventListener('click', () => {
    const wrap = sumToggle.closest('.sum-preview-wrap');
    wrap.dataset.sum = wrap.dataset.sum === '1' ? '2' : '1';
  });
}

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  iconFilename: null,
  iconUrl:      null,
  analysis:     null,
  competitors:  [],   // [{ filename, url }]
};

// ─── System icons (shown when no competitors) ─────────────────────────────────
const SYSTEM_ICONS = Array.from({length: 15}, (_, i) =>
  `/static/img/system-icons/${i + 1}.png`
);

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const uploadZone      = $('upload-zone');
const fileInput       = $('file-input');
const uploadProgress  = $('upload-progress');
const uploadError     = $('upload-error');
const resultsPage     = $('results-page');
const competitorZone  = $('competitor-zone');
const competitorInput = $('competitor-input');
const competitorGrid  = $('competitor-grid');
const genSummaryBtn   = $('generate-summary-btn');

// ─── Competitor upload button ─────────────────────────────────────────────────
document.getElementById('comp-upload-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (state.competitors.length < 16) competitorInput.click();
});

// ─── Upload — main icon ───────────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('dragging');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleMainUpload(file);
});

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleMainUpload(e.target.files[0]);
  fileInput.value = '';
});

async function handleMainUpload(file) {
  uploadZone.classList.add('hidden');
  uploadProgress.classList.remove('hidden');
  uploadError.classList.add('hidden');
  uploadError.textContent = '';

  const fd = new FormData();
  fd.append('file', file);

  try {
    const res  = await fetch('/upload', { method: 'POST', body: fd });
    const data = await res.json();

    if (data.error) {
      showUploadError(data.error);
      return;
    }

    state.iconFilename = data.filename;
    state.iconUrl      = data.url;
    state.analysis     = data.analysis;

    showAnalysis(data);
  } catch {
    showUploadError('Upload failed — please try again.');
  }
}

function showUploadError(msg) {
  uploadProgress.classList.add('hidden');
  uploadZone.classList.remove('hidden');
  uploadError.classList.remove('hidden');
  uploadError.textContent = msg;
}

// ─── Render analysis ──────────────────────────────────────────────────────────
function showAnalysis({ url, analysis }) {
  uploadProgress.classList.add('hidden');

  $('icon-preview').src = url;

  // Technical
  const tech = analysis.technical;
  renderTechChecks(tech);

  // Visibility
  const vis = analysis.visibility;
  renderVisMetrics(vis);

  // Recommendations (legacy, kept for PDF)
  renderRecommendations(analysis.recommendations);

  // Summary cards (auto, no competitors yet)
  renderSummary();

  // Render home screen immediately
  renderHomeScreen();

  // Reveal results page
  resultsPage.classList.remove('hidden');

  setTimeout(() => {
    resultsPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function gradeLabel(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs improvement';
  return 'Significant issues';
}

// ─── SVG ring animation ───────────────────────────────────────────────────────
function animateRing(id, circumference, score) {
  const el = $(id);
  if (!el) return;

  // Color coding
  el.classList.remove('ring-fill--amber', 'ring-fill--red');
  if (score < 40) el.classList.add('ring-fill--red');
  else if (score < 70) el.classList.add('ring-fill--amber');

  el.style.strokeDasharray  = circumference;
  el.style.strokeDashoffset = circumference; // start empty

  // Double rAF so browser paints the initial state before transitioning
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.strokeDashoffset = circumference * (1 - score / 100);
    });
  });
}

// ─── Counter animation ────────────────────────────────────────────────────────
function animateCounter(id, target) {
  const el = $(id);
  if (!el) return;
  let current = 0;
  const increment = target / 45;
  const timer = setInterval(() => {
    current = Math.min(current + increment, target);
    el.textContent = Math.round(current);
    if (current >= target) clearInterval(timer);
  }, 22);
}

// ─── Technical checks ─────────────────────────────────────────────────────────
function renderTechChecks(tech) {
  const [w, h] = tech.dimensions;
  const issues = tech.issues || [];

  const metrics = [
    {
      label: 'Canvas Shape',
      problem: issues.includes('shape'),
      value: issues.includes('shape') ? 'Not 1:1' : 'Square (1:1)',
      description: 'Square (1:1) is required for app icons. Please upload a square image.',
    },
    {
      label: 'Resolution',
      problem: issues.includes('resolution'),
      value: `${w} × ${h}`,
      description: '1024 × 1024 is required. Please upload a higher resolution image.',
    },
    {
      label: 'Format',
      problem: issues.includes('format'),
      value: tech.format.toUpperCase(),
      description: 'PNG is recommended for app icons. Upload a PNG file for best compatibility.',
    },
    {
      label: 'Background',
      problem: issues.includes('background'),
      value: issues.includes('background') ? 'Transparent' : 'Solid',
      description: 'Transparent background detected. Some platforms may render it differently.',
    },
    {
      label: 'File Size',
      problem: issues.includes('file_size_large') || issues.includes('file_size_small'),
      value: tech.file_size_display || `${tech.file_size_kb} KB`,
      description: issues.includes('file_size_large')
        ? 'File size is large. Consider compressing the image.'
        : 'File size is unusually small. Image quality may be reduced.',
    },
  ];

  const problems = metrics.filter(m => m.problem);
  const okCards  = metrics.filter(m => !m.problem);

  let html = '';

  // Problem cards — full width, orange border
  problems.forEach(m => {
    html += `<div class="tr-card tr-card--problem">
      <span class="tr-label">${m.label}</span>
      <span class="tr-value">${m.value}</span>
      <p class="tr-desc">${m.description}</p>
    </div>`;
  });

  // OK cards — 2-column grid
  if (okCards.length) {
    html += '<div class="tr-ok-grid">';
    okCards.forEach(m => {
      html += `<div class="tr-card tr-card--ok">
        <img src="/static/img/Icon_ok.svg" class="tr-check-mark" alt="ok" />
        <span class="tr-label">${m.label}</span>
        <span class="tr-value">${m.value}</span>
      </div>`;
    });
    html += '</div>';
  }

  // Summary block
  const issueTexts = {
    shape:           'The canvas is not square (1:1).',
    resolution:      'The resolution is below 1024 × 1024.',
    format:          'PNG format is recommended for app icons.',
    background:      'Transparent background may render inconsistently across platforms.',
    file_size_large: 'The file size is larger than recommended.',
    file_size_small: 'The file size is unusually small and may affect quality.',
  };

  if (issues.length === 0) {
    html += `<div class="tr-summary tr-summary--ok">
      <span class="tr-summary-tag">Summary</span>
      <p class="tr-summary-title">Ready</p>
      <p class="tr-summary-text">All technical checks passed.<br>No issues detected.</p>
    </div>`;
  } else {
    const shown = issues.slice(0, 3);
    const extra = issues.length - shown.length;
    const bullets = shown.map(k => `<li>${issueTexts[k] || k}</li>`).join('');
    const moreItem = extra > 0 ? `<li>and ${extra} more</li>` : '';
    html += `<div class="tr-summary tr-summary--warn">
      <span class="tr-summary-tag">Summary</span>
      <p class="tr-summary-title">Needs Attention</p>
      <p class="tr-summary-text">Some technical requirements are not met. Fix the issues below to ensure proper store compatibility.</p>
      <ul class="tr-summary-issues">${bullets}${moreItem}</ul>
    </div>`;
  }

  $('tech-checks').innerHTML = html;
}

// ─── Visibility metrics ───────────────────────────────────────────────────────
function renderVisMetrics(vis) {
  const contrast   = vis.contrast;
  const simplicity = vis.simplicity;

  function contrastState(s) {
    if (s >= 67) return 'green';
    if (s >= 34) return 'orange';
    return 'red';
  }

  function simplicityState(s) {
    if (s >= 67) return 'green';
    if (s >= 34) return 'orange';
    return 'red';
  }

  const cState = contrastState(contrast);
  const sState = simplicityState(simplicity);

  const contrastDesc = {
    green:  'Strong tonal range.<br>Icon stands out on any background.',
    orange: 'Flat contrast.<br>May blend into the background.',
    red:    'Too low.<br>Icon will disappear on most backgrounds.',
  };

  const simplicityDesc = {
    green:  'Clean and focused.<br>The main shape reads instantly.',
    orange: 'Some complexity.<br>Fine details may get lost.',
    red:    'Too complex.<br>The icon loses its shape when scaled.',
  };

  const checkSvg = `<img src="/static/img/Icon_ok.svg" class="vis-check-icon" alt="ok" />`;

  function buildCard(label, score, state, descMap) {
    const borderClass = state !== 'green' ? ` vis-card--${state}` : '';
    const icon = state === 'green' ? checkSvg : '';
    return `<div class="vis-card${borderClass}">
      <div class="vis-card-header">
        <span class="vis-card-label">${label}</span>
        ${icon}
      </div>
      <div class="vis-bar-track">
        <div class="vis-bar-fill vis-bar-fill--${state}" style="width:0%" data-target="${score}">
          <span class="vis-bar-score">${score}</span>
        </div>
      </div>
      <p class="vis-card-desc">${descMap[state]}</p>
    </div>`;
  }

  const summaryTitleMap = {
    green_green:   'Highly Visible',
    green_orange:  'Good Contrast',
    green_red:     'Too Complex',
    orange_green:  'Low Contrast',
    orange_orange: 'Needs Improvement',
    orange_red:    'Needs Work',
    red_green:     'Low Contrast',
    red_orange:    'Low Visibility',
    red_red:       'High Risk',
  };

  const summaryMap = {
    green_green:   'Your icon is highly visible. Strong contrast and clean composition work together.',
    green_orange:  'Good contrast, but some details may get lost. Simplify the composition.',
    green_red:     'Strong contrast, but the icon is too complex. Strip it down.',
    orange_green:  'Clean shape, but contrast needs improvement. The icon may blend into backgrounds.',
    orange_orange: 'Visibility needs work. Both contrast and complexity could be improved.',
    orange_red:    'Two issues at once — limited contrast and too much detail. Both need attention.',
    red_green:     'Simple and clean, but critically low contrast. The icon will disappear on most backgrounds.',
    red_orange:    'Contrast is the main problem here. Fix it first — the icon is barely visible.',
    red_red:       'High risk. The icon is hard to read — low contrast and too much detail combined.',
  };

  const summaryKey  = `${cState}_${sState}`;
  const summaryMod  = (cState === 'green' && sState === 'green') ? 'tr-summary--ok' : 'tr-summary--warn';

  let html = `<div class="vis-grid">
    ${buildCard('Contrast',   contrast,   cState, contrastDesc)}
    ${buildCard('Simplicity', simplicity, sState, simplicityDesc)}
  </div>`;

  html += `<div class="tr-summary ${summaryMod}">
    <span class="tr-summary-tag">Summary</span>
    <p class="tr-summary-title">${summaryTitleMap[summaryKey]}</p>
    <p class="tr-summary-text">${summaryMap[summaryKey]}</p>
  </div>`;

  $('vis-metrics').innerHTML = html;

  // Animate bars
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('#vis-metrics .vis-bar-fill[data-target]').forEach(el => {
        el.style.width = el.dataset.target + '%';
      });
    });
  });
}

// ─── Recommendations ──────────────────────────────────────────────────────────
function renderRecommendations(recs) {
  const el = $('recommendations-list');
  if (!el) return;
  el.innerHTML = recs.map((rec, i) => `
    <li>
      <div class="rec-number">${i + 1}</div>
      <div>${rec}</div>
    </li>
  `).join('');
}

// ─── Home screen renderer ─────────────────────────────────────────────────────
function renderHomeScreen() {
  const hasComp = state.competitors.length > 0;
  let html = '';

  // Slot 0: user's icon (always)
  html += `<div class="app-icon yours">
    <img src="${state.iconUrl}" alt="Your icon" />
  </div>`;

  // Slots 1–15
  for (let i = 1; i <= 15; i++) {
    const comp = state.competitors[i - 1];
    if (comp) {
      html += `<div class="app-icon">
        <img src="${comp.url}" alt="Competitor ${i}" loading="lazy" />
      </div>`;
    } else if (!hasComp) {
      html += `<div class="app-icon">
        <img src="${SYSTEM_ICONS[i - 1]}" alt="" loading="lazy" />
      </div>`;
    } else {
      html += `<div class="app-icon">
        <div class="app-icon-placeholder"></div>
      </div>`;
    }
  }

  $('app-grid').innerHTML = html;
}

// ─── Competitors ──────────────────────────────────────────────────────────────
competitorZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    if (state.competitors.length < 16) competitorInput.click();
  }
});

competitorInput.addEventListener('change', async e => {
  const files     = Array.from(e.target.files);
  const remaining = 16 - state.competitors.length;
  for (const file of files.slice(0, remaining)) {
    await uploadCompetitor(file);
  }
  competitorInput.value = '';
});

async function uploadCompetitor(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res  = await fetch('/upload-competitor', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.error) {
      state.competitors.push({ filename: data.filename, url: data.url, scores: data.scores });
      renderCompetitorThumbs();
    }
  } catch {
    // silently skip failed competitor upload
  }
}

function renderCompetitorThumbs() {
  const count = state.competitors.length;
  const countEl = $('comp-count-text');
  if (countEl) {
    countEl.textContent = count === 0
      ? 'Add up to 16 competitor icons'
      : `${count} icon${count > 1 ? 's' : ''} added`;
  }

  const descEl = document.querySelector('.comp-form-desc');
  if (descEl) descEl.style.display = count > 0 ? 'none' : '';

  const zone = $('competitor-zone');
  if (zone) zone.classList.toggle('has-icons', count > 0);

  if (genSummaryBtn) {
    genSummaryBtn.disabled = count === 0;
    genSummaryBtn.textContent = genSummaryBtn.dataset.generated
      ? 'Regenerate Summary'
      : 'Generate Summary';
  }

  competitorGrid.innerHTML = state.competitors.map((c, i) => `
    <div class="comp-thumb">
      <img src="${c.url}" alt="Competitor ${i + 1}" loading="lazy" />
      <button class="comp-remove" data-index="${i}" aria-label="Remove competitor ${i + 1}">✕</button>
    </div>
  `).join('');

  competitorGrid.querySelectorAll('.comp-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.competitors.splice(parseInt(btn.dataset.index), 1);
      renderCompetitorThumbs();
      renderHomeScreen();
    });
  });

  renderHomeScreen();
}


// ─── Generate Summary ─────────────────────────────────────────────────────────
genSummaryBtn.addEventListener('click', () => {
  genSummaryBtn.dataset.generated = '1';
  genSummaryBtn.textContent = 'Regenerate Summary';
  renderSummary(true); // with competitors
  document.getElementById('step-summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function renderSummary(withCompetitors = false) {
  const container = document.getElementById('summary-cards');
  if (!container || !state.analysis?.summary) return;
  const s = state.analysis.summary;

  const levelClass = { strong: 'summary-card--strong', medium: 'summary-card--medium', weak: 'summary-card--weak' }[s.verdict_level] || '';

  // Card 1: Verdict
  let html = `
    <div class="summary-card ${levelClass}">
      <h2 class="summary-verdict">${s.verdict}</h2>
    </div>`;

  // Card 2: Insight
  html += `
    <div class="summary-card">
      <h3 class="summary-card-title">Insight</h3>
      <p class="summary-card-body">${s.insight}</p>
    </div>`;

  // Card 3: Recommendations
  if (s.recommendations.length > 0) {
    html += `
    <div class="summary-card">
      <h3 class="summary-card-title">Recommendations</h3>
      ${s.recommendations.map(r => `
        <div class="summary-rec-item">
          <p class="summary-rec-title">${r.title}</p>
          <p class="summary-rec-desc">${r.description}</p>
        </div>`).join('')}
    </div>`;
  }

  // Card 4: vs Competitors (only when triggered with competitors)
  if (withCompetitors && state.competitors.length > 0 && state.competitors[0].scores) {
    const uOverall    = state.analysis.overall_score;
    const uContrast   = state.analysis.visibility.contrast;
    const uSimplicity = state.analysis.visibility.simplicity;

    const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    const compOverall    = state.competitors.map(c => c.scores.overall);
    const compContrast   = state.competitors.map(c => c.scores.contrast);
    const compSimplicity = state.competitors.map(c => c.scores.simplicity);

    const avgOverall    = avg(compOverall);
    const avgContrast   = avg(compContrast);
    const avgSimplicity = avg(compSimplicity);

    const diff = uOverall - avgOverall;
    const verdict = diff >= 15 ? `Your icon scores ${diff} points above the competitor average — it stands out in this set.` :
                    diff >= 1  ? `Your icon scores slightly above the competitor average — a solid result with room to grow.` :
                    diff === 0 ? `Your icon matches the competitor average exactly — improvements could push it ahead.` :
                                 `Your icon scores ${Math.abs(diff)} points below the competitor average — worth reviewing the recommendations above.`;

    const row = (label, yours, compAvg) => {
      const d = yours - compAvg;
      const sign = d > 0 ? '+' : '';
      const diffClass = d > 0 ? 'comp-diff--up' : d < 0 ? 'comp-diff--down' : 'comp-diff--neutral';
      return `
        <div class="summary-rank-row">
          <span class="summary-rank-label">${label}</span>
          <span class="summary-rank-scores">
            <span class="comp-your-score">${yours}</span>
            <span class="comp-avg-score">avg&nbsp;${compAvg}</span>
            <span class="comp-diff ${diffClass}">${sign}${d}</span>
          </span>
        </div>`;
    };

    html += `
    <div class="summary-card">
      <h3 class="summary-card-title">vs Competitors</h3>
      <p class="summary-card-body">${verdict}</p>
      <div class="summary-ranks">
        ${row('Overall',    uOverall,    avgOverall)}
        ${row('Contrast',   uContrast,   avgContrast)}
        ${row('Simplicity', uSimplicity, avgSimplicity)}
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

