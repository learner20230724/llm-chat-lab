// ── Preset definitions (shared with server) ──────────────────────────────────
const promptPresets = {
  operator: { label: 'Operator brief' },
  analyst:  { label: 'Analyst breakdown' },
  builder:  { label: 'Builder handoff' },
};

const modelPresets = {
  gpt54: { label: 'GPT-5.4 balanced', latency: '1.8s', tokenBias: 1.0, cost: '$0.012' },
  fast:  { label: 'Fast local mock',   latency: '0.8s', tokenBias: 0.7, cost: '$0.004' },
  deep:  { label: 'Deep reasoning',    latency: '3.1s', tokenBias: 1.35, cost: '$0.021' },
};

const memoryModes = {
  none:    'No carryover. Treat this as a clean run.',
  session: 'Use short session continuity and preserve recent decisions.',
  project: 'Assume active project context and optimize for continuity.',
};

// ── DOM refs ───────────────────────────────────────────────────────────────────
const panelEls  = [...document.querySelectorAll('.panel-card')];
const runButton  = document.getElementById('runButton');
const swapButton = document.getElementById('swapButton');
const sharedInput = document.getElementById('sharedInput');

// ── Render panel (local mock fallback) ───────────────────────────────────────
function buildMockResponse({ prompt, promptPreset, memoryMode, side }) {
  const preset = promptPresets[promptPreset];
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
    `Memory mode: ${memoryModes[memoryMode]}`, '',
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
  const model        = modelPresets[modelPreset];

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

// ── Actions ────────────────────────────────────────────────────────────────────
async function runCompare() {
  // Check if live backend is available
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

// ── Init ──────────────────────────────────────────────────────────────────────
runButton.addEventListener('click', runCompare);
swapButton.addEventListener('click', swapPanels);
sharedInput.addEventListener('input', runCompare);
panelEls.forEach((panel) => {
  panel.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', runCompare));
});

// Probe live backend; if unreachable stay in mock mode
fetch('/api/status').then((r) => {
  if (!r.ok) runCompare();
}).catch(() => runCompare());
