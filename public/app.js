// ── Built-in preset definitions ─────────────────────────────────────────────
const PROMPT_PRESETS = {
  operator: { label: 'Operator brief' },
  analyst:  { label: 'Analyst breakdown' },
  builder:  { label: 'Builder handoff' },
};

const MEMORY_MODES = {
  none:    'No carryover. Treat this as a clean run.',
  session: 'Use short session continuity and preserve recent decisions.',
  project: 'Assume active project context and optimize for continuity.',
};

// provider:model → display config; provider 'mock' means no live call
const MODEL_PRESETS = {
  'mock':                   { label: 'Mock (no API key)',   latency: '<1ms', tokens: '—', cost: '$0' },
  'openai:gpt-4o-mini':     { label: 'GPT-4o mini',          latency: '~1s',  tokens: '—', cost: '$0.015' },
  'openai:gpt-4o':          { label: 'GPT-4o',               latency: '~2s',  tokens: '—', cost: '$0.09' },
  'anthropic:claude-sonnet-4': { label: 'Claude Sonnet 4',  latency: '~1s',  tokens: '—', cost: '$0.003' },
  'anthropic:claude-opus-4':    { label: 'Claude Opus 4',   latency: '~2s',  tokens: '—', cost: '$0.015' },
};

const STORAGE_KEY = 'llm-chat-lab-panels';

// Per-side results for the comparison bar
const results = { left: null, right: null };

// ── DOM refs ─────────────────────────────────────────────────────────────────
const panelEls    = [...document.querySelectorAll('.panel-card')];
const runButton   = document.getElementById('runButton');
const swapButton  = document.getElementById('swapButton');
const sharedInput = document.getElementById('sharedInput');
const saveNotice  = document.getElementById('saveNotice');
const exportBtn   = document.getElementById('exportBtn');
const importBtn   = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');

// ── Comparison bar ─────────────────────────────────────────────────────────────
function parseLatency(s) {
  if (!s || s === '…' || s === '—') return null;
  const m = s.match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}
function parseTokens(s) {
  if (!s || s === '…' || s === '—') return null;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}
function parseCost(s) {
  if (!s || s === '…' || s === '—') return null;
  const m = s.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function updateCompareBar() {
  const bar  = document.getElementById('compareBar');
  const rL   = results.left;
  const rR   = results.right;
  if (!rL || !rR) { bar.hidden = true; return; }

  // Populate labels and raw values
  document.getElementById('compareModelL').textContent = rL.model;
  document.getElementById('compareLatL').textContent  = rL.latency;
  document.getElementById('compareTokL').textContent  = rL.tokens;
  document.getElementById('compareCostL').textContent = rL.cost;
  document.getElementById('compareModelR').textContent = rR.model;
  document.getElementById('compareLatR').textContent  = rR.latency;
  document.getElementById('compareTokR').textContent  = rR.tokens;
  document.getElementById('compareCostR').textContent = rR.cost;

  // Latency diff
  const latL = parseLatency(rL.latency);
  const latR = parseLatency(rR.latency);
  const latTxt = document.getElementById('diffLatTxt');
  const latRow = document.getElementById('diffLat');
  if (latL !== null && latR !== null) {
    const faster = latL < latR ? 'A' : latR < latL ? 'B' : 'tie';
    const diff   = Math.abs(latL - latR).toFixed(1);
    latTxt.textContent = `${diff}s (${faster} faster)`;
    latRow.className = 'diff-row ' + (faster === 'A' ? 'diff-better' : faster === 'B' ? 'diff-worse' : '');
  } else {
    latTxt.textContent = '—';
    latRow.className = 'diff-row';
  }

  // Token diff
  const tokL = parseTokens(rL.tokens);
  const tokR = parseTokens(rR.tokens);
  const tokTxt = document.getElementById('diffTokTxt');
  const tokRow = document.getElementById('diffTok');
  if (tokL !== null && tokR !== null) {
    const more  = tokL > tokR ? 'A' : tokR > tokL ? 'B' : 'tie';
    const diff  = Math.abs(tokL - tokR);
    tokTxt.textContent = `${diff} tok (${more} more)`;
    tokRow.className = 'diff-row ' + (more === 'A' ? 'diff-worse' : more === 'B' ? 'diff-better' : '');
  } else {
    tokTxt.textContent = '—';
    tokRow.className = 'diff-row';
  }

  // Cost diff
  const costL = parseCost(rL.cost);
  const costR = parseCost(rR.cost);
  const costTxt = document.getElementById('diffCostTxt');
  const costRow = document.getElementById('diffCost');
  if (costL !== null && costR !== null) {
    if (costL === 0 && costR === 0) {
      costTxt.textContent = 'both $0';
    } else {
      const pricier = costL > costR ? 'A' : costR > costL ? 'B' : 'tie';
      const ratio   = (costL > 0 && costR > 0) ? Math.max(costL, costR) / Math.min(costL, costR) : null;
      const ratioStr = ratio ? ` (${ratio.toFixed(1)}×)` : '';
      costTxt.textContent = `${pricier} pricier${ratioStr}`;
      costRow.className = 'diff-row ' + (pricier === 'A' ? 'diff-worse' : pricier === 'B' ? 'diff-better' : '');
    }
  } else {
    costTxt.textContent = '—';
    costRow.className = 'diff-row';
  }

  bar.hidden = false;
}
function getStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function putStored(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  flashNotice('saved');
}

function flashNotice(type) {
  if (!saveNotice) return;
  saveNotice.textContent = type === 'saved' ? '✓ layout saved' : type === 'loaded' ? '✓ layout loaded' : '';
  saveNotice.style.opacity = '1';
  clearTimeout(saveNotice._t);
  saveNotice._t = setTimeout(() => { saveNotice.style.opacity = '0'; }, 1800);
}

function snapshotPanels() {
  return panelEls.map((el) => ({
    promptPreset: el.querySelector('[data-role="promptPreset"]').value,
    modelPreset:  el.querySelector('[data-role="modelPreset"]').value,
    memoryMode:   el.querySelector('[data-role="memoryMode"]').value,
  }));
}

function applySnapshot(snap) {
  if (!Array.isArray(snap) || snap.length < 2) return false;
  panelEls.forEach((el, i) => {
    if (snap[i]) {
      el.querySelector('[data-role="promptPreset"]').value = snap[i].promptPreset || 'operator';
      el.querySelector('[data-role="modelPreset"]').value  = snap[i].modelPreset  || 'mock';
      el.querySelector('[data-role="memoryMode"]').value   = snap[i].memoryMode   || 'none';
    }
  });
  return true;
}

function currentConfig() {
  return {
    version: 1,
    sharedInput: sharedInput.value,
    panels: snapshotPanels(),
  };
}

function loadConfig(cfg) {
  if (!cfg || cfg.version !== 1) return false;
  if (cfg.sharedInput !== undefined) sharedInput.value = cfg.sharedInput;
  if (cfg.panels) applySnapshot(cfg.panels);
  return true;
}

// ── Export / Import ───────────────────────────────────────────────────────────
function exportLayout() {
  // Suppress save-toast for the duration so exported screenshots stay clean
  let prev = saveNotice.textContent;
  saveNotice.style.opacity = '0';
  const cleanUp = () => { saveNotice.textContent = prev; saveNotice.style.opacity = '1'; };

  const cfg = currentConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'llm-chat-lab-layout.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Restore toast after a moment so user still gets feedback
  setTimeout(cleanUp, 400);
}

function importLayout(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const cfg = JSON.parse(e.target.result);
      if (loadConfig(cfg)) {
        flashNotice('loaded');
        runCompare();
      } else {
        alert('Unrecognized layout file format.');
      }
    } catch {
      alert('Failed to parse layout file.');
    }
  };
  reader.readAsText(file);
}

// ── Render mock response ───────────────────────────────────────────────────────
function buildMockResponse({ prompt, promptPreset, memoryMode, side }) {
  const preset = PROMPT_PRESETS[promptPreset];
  const opening = side === 'left'
    ? 'This setup optimizes for speed and operator clarity.'
    : 'This setup optimizes for inspection and structured tradeoffs.';
  const recommendation = {
    operator: 'Recommendation: turn the request into a tight execution path with named steps, owner boundaries, and one obvious next move.',
    analyst:  'Recommendation: separate scope, decision criteria, and rollout risks so the comparison is visible instead of implied.',
    builder:  'Recommendation: shape the output as a handoff artifact that engineering or ops can run with immediately.',
  }[promptPreset];
  return [
    opening, '',
    `Prompt preset: ${preset.label}`,
    `Memory mode: ${MEMORY_MODES[memoryMode]}`, '',
    `Input under test: "${prompt.trim()}"`, '',
    recommendation, '',
    'Likely output shape:',
    '- a short framing line',
    '- 3 to 5 practical bullets or sections',
    '- an explicit next action rather than a vague summary',
  ].join('\n');
}

function renderPanelMock(panelEl, side) {
  const promptPreset = panelEl.querySelector('[data-role="promptPreset"]').value;
  const modelPreset  = panelEl.querySelector('[data-role="modelPreset"]').value;
  const memoryMode   = panelEl.querySelector('[data-role="memoryMode"]').value;
  const prompt       = sharedInput.value;
  const modelCfg     = MODEL_PRESETS[modelPreset] || MODEL_PRESETS['mock'];

  panelEl.querySelector('[data-role="latency"]').textContent = modelCfg.latency;
  panelEl.querySelector('[data-role="tokens"]').textContent  = modelCfg.tokens;
  panelEl.querySelector('[data-role="cost"]').textContent    = modelCfg.cost;
  panelEl.querySelector('[data-role="response"]').textContent = buildMockResponse({
    prompt, promptPreset, memoryMode, side,
  });
  results[side] = { latency: modelCfg.latency, tokens: modelCfg.tokens, cost: modelCfg.cost, model: modelCfg.label };
}

// ── Call backend API ───────────────────────────────────────────────────────────
async function fetchReply(panelEl, side) {
  const promptPreset = panelEl.querySelector('[data-role="promptPreset"]').value;
  const memoryMode   = panelEl.querySelector('[data-role="memoryMode"]').value;
  const modelPreset  = panelEl.querySelector('[data-role="modelPreset"]').value;
  const modelCfg     = MODEL_PRESETS[modelPreset] || MODEL_PRESETS['mock'];
  const prompt       = sharedInput.value;

  // Parse provider:model from preset value, e.g. "anthropic:claude-sonnet-4"
  const isMock = modelPreset === 'mock';
  const [provider] = modelPreset.split(':');

  panelEl.querySelector('[data-role="response"]').textContent = '…';
  panelEl.querySelector('[data-role="latency"]').textContent  = '…';
  panelEl.querySelector('[data-role="tokens"]').textContent   = '…';
  panelEl.querySelector('[data-role="cost"]').textContent     = '…';

  try {
    const body = { preset: promptPreset, memoryMode, prompt };
    if (!isMock) body.provider = provider;
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const lat   = json.latency || '—';
    const tok   = json.tokens ? `${json.tokens} tok` : '—';
    const cost  = json.cost || '—';
    const label = json.model || modelCfg.label;
    panelEl.querySelector('[data-role="latency"]').textContent = lat;
    panelEl.querySelector('[data-role="tokens"]').textContent  = tok;
    panelEl.querySelector('[data-role="cost"]').textContent    = cost;
    panelEl.querySelector('[data-role="response"]').textContent = json.text;
    results[side] = { latency: lat, tokens: tok, cost, model: label };
  } catch (err) {
    // Fall back to mock for this panel
    renderPanelMock(panelEl, side);
    panelEl.querySelector('[data-role="response"]').textContent =
      `[error] ${err.message}\n\nFell back to mock.`;
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function runCompare() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      await Promise.all([
        fetchReply(panelEls[0], 'left'),
        fetchReply(panelEls[1], 'right'),
      ]);
      return;
    }
  } catch { /* fall through to mock */ }
  renderPanelMock(panelEls[0], 'left');
  renderPanelMock(panelEls[1], 'right');
  updateCompareBar();
}

function swapPanels() {
  const left = panelEls[0], right = panelEls[1];
  ['promptPreset', 'modelPreset', 'memoryMode'].forEach((role) => {
    const l = left.querySelector(`[data-role="${role}"]`);
    const r = right.querySelector(`[data-role="${role}"]`);
    const tmp = l.value; l.value = r.value; r.value = tmp;
  });
  runCompare();
}

function autoSave() {
  putStored(currentConfig());
}

// ── Init ─────────────────────────────────────────────────────────────────────
runButton.addEventListener('click', runCompare);
swapButton.addEventListener('click', swapPanels);

sharedInput.addEventListener('input', () => { autoSave(); runCompare(); });

panelEls.forEach((panel) => {
  panel.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', () => { autoSave(); runCompare(); });
  });
});

if (exportBtn) exportBtn.addEventListener('click', exportLayout);
if (importBtn && importInput) {
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    if (importInput.files[0]) importLayout(importInput.files[0]);
    importInput.value = '';
  });
}

// Restore saved layout or run mock probe
const stored = getStored();
if (stored && loadConfig(stored)) {
  flashNotice('loaded');
}

fetch('/api/status').then((r) => {
  if (!r.ok) runCompare();
}).catch(() => runCompare());
