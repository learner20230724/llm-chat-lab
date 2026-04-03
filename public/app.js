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

const MODEL_PRESETS = {
  gpt54: { label: 'GPT-5.4 balanced', latency: '1.8s', tokenBias: 1.0, cost: '$0.012' },
  fast:  { label: 'Fast local mock',   latency: '0.8s', tokenBias: 0.7, cost: '$0.004' },
  deep:  { label: 'Deep reasoning',    latency: '3.1s', tokenBias: 1.35, cost: '$0.021' },
};

const STORAGE_KEY = 'llm-chat-lab-panels';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const panelEls    = [...document.querySelectorAll('.panel-card')];
const runButton   = document.getElementById('runButton');
const swapButton  = document.getElementById('swapButton');
const sharedInput = document.getElementById('sharedInput');
const saveNotice  = document.getElementById('saveNotice');
const exportBtn   = document.getElementById('exportBtn');
const importBtn   = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');

// ── Persist / restore ─────────────────────────────────────────────────────────
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
      el.querySelector('[data-role="modelPreset"]').value  = snap[i].modelPreset  || 'gpt54';
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
  const model        = MODEL_PRESETS[modelPreset];

  panelEl.querySelector('[data-role="latency"]').textContent = model.latency;
  panelEl.querySelector('[data-role="tokens"]').textContent  = '—';
  panelEl.querySelector('[data-role="cost"]').textContent    = model.cost;
  panelEl.querySelector('[data-role="response"]').textContent = buildMockResponse({
    prompt, promptPreset, memoryMode, side,
  });
}

// ── Call backend API ───────────────────────────────────────────────────────────
async function fetchReply(panelEl, side) {
  const promptPreset = panelEl.querySelector('[data-role="promptPreset"]').value;
  const memoryMode   = panelEl.querySelector('[data-role="memoryMode"]').value;
  const prompt       = sharedInput.value;

  panelEl.querySelector('[data-role="response"]').textContent = '…';
  panelEl.querySelector('[data-role="latency"]').textContent  = '…';
  panelEl.querySelector('[data-role="tokens"]').textContent   = '…';
  panelEl.querySelector('[data-role="cost"]').textContent     = '…';

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: promptPreset, memoryMode, prompt }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    panelEl.querySelector('[data-role="latency"]').textContent = json.latency;
    panelEl.querySelector('[data-role="tokens"]').textContent  = json.tokens ? `${json.tokens} tok` : '—';
    panelEl.querySelector('[data-role="cost"]').textContent    = json.cost || '—';
    panelEl.querySelector('[data-role="response"]').textContent = json.text;
  } catch (err) {
    panelEl.querySelector('[data-role="response"]').textContent = `[error] ${err.message}\n\nFalling back to mock.`;
    renderPanelMock(panelEl, side);
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
