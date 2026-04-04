// ── Built-in preset definitions ─────────────────────────────────────────────
const PROMPT_PRESETS = {
  operator: { label: 'Operator brief',  system: 'You are a concise operator. Give direct, compressed, next-step oriented advice. Prefer short sentences and actionable bullets.' },
  analyst:  { label: 'Analyst breakdown', system: 'You are a structured analyst. Break things down, compare tradeoffs explicitly, and be explicit about assumptions and risks.' },
  builder:  { label: 'Builder handoff',  system: 'You are a builder-oriented advisor. Shape output as a concrete handoff artifact that engineering or ops can run with immediately. Prioritize specificity over abstraction.' },
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

const STORAGE_KEY      = 'llm-chat-lab-panels';
const CUSTOM_PRESETS_KEY = 'llm-chat-lab-custom-presets';

// ── Custom preset helpers ──────────────────────────────────────────────────────
function getCustomPresets() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY)) || []; }
  catch { return []; }
}

function saveCustomPreset(name, system) {
  const id   = `custom_${Date.now()}`;
  const list = getCustomPresets();
  list.push({ id, label: name.trim(), system: system.trim() });
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
  return id;
}

function deleteCustomPreset(id) {
  const list = getCustomPresets().filter((p) => p.id !== id);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
}

function mergePresets() {
  const merged = { ...PROMPT_PRESETS };
  getCustomPresets().forEach((p) => { merged[p.id] = { label: p.label, system: p.system }; });
  return merged;
}

// Build the <select> options for all promptPreset selectors (built-in + custom)
function buildPresetOptions() {
  const customList = getCustomPresets();
  document.querySelectorAll('select[data-role="promptPreset"]').forEach((sel) => {
    // Remember current value
    const prev = sel.value;
    // Remove all options below the divider comment node
    const toRemove = [];
    let hitDivider = false;
    for (const child of sel.childNodes) {
      if (child.nodeType === Node.COMMENT_NODE && child.textContent.includes('── custom')) { hitDivider = true; continue; }
      if (hitDivider) toRemove.push(child);
    }
    toRemove.forEach((n) => sel.removeChild(n));

    // Remove existing custom options (check by data attribute)
    sel.querySelectorAll('option[data-custom]').forEach((o) => o.remove());

    // Add custom preset options before the last built-in (or at end)
    if (customList.length > 0) {
      const divider = document.createComment('── custom presets ──');
      sel.appendChild(divider);
      customList.forEach((p) => {
        const opt = document.createElement('option');
        opt.value          = p.id;
        opt.textContent    = p.label;
        opt.dataset.custom = '1';
        sel.appendChild(opt);
      });
    }

    // Restore previous selection if still valid, else fall back
    if ([...sel.options].some((o) => o.value === prev)) {
      sel.value = prev;
    } else if (sel.options.length > 0) {
      sel.value = sel.options[0].value;
    }
  });
}

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
  return panelEls.map((el) => {
    const presetId = el.querySelector('[data-role="promptPreset"]').value;
    // For custom presets, embed the system text so the snapshot is self-contained
    const isCustom = presetId.startsWith('custom_');
    const system   = isCustom ? (mergePresets()[presetId]?.system || '') : undefined;
    return {
      promptPreset: presetId,
      promptSystem: system || undefined,
      modelPreset:  el.querySelector('[data-role="modelPreset"]').value,
      memoryMode:   el.querySelector('[data-role="memoryMode"]').value,
    };
  });
}

function applySnapshot(snap) {
  if (!Array.isArray(snap) || snap.length < 2) return false;

  // Handle custom presets embedded in the snapshot (from imported layouts)
  const snapshotSystems = new Set(snap.filter((s) => s.promptSystem).map((s) => s.promptSystem));
  if (snapshotSystems.size > 0) {
    const existing    = getCustomPresets();
    const existingSys = new Set(existing.map((p) => p.system));
    const toAdd = [...snapshotSystems]
      .filter((sys) => !existingSys.has(sys))
      .map((system) => ({ id: `restored_${Date.now()}_${Math.random().toString(36).slice(2)}`, label: '(imported preset)', system }));
    if (toAdd.length > 0) {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify([...existing, ...toAdd]));
      buildPresetOptions();
    }
  }

  panelEls.forEach((el, i) => {
    if (!snap[i]) return;
    const presetSel = el.querySelector('[data-role="promptPreset"]');
    const snapPreset = snap[i].promptPreset;

    // Try to match by ID first, then by system text for custom presets
    const allOpts    = [...presetSel.options];
    const byId      = allOpts.find((o) => o.value === snapPreset);
    if (byId) {
      presetSel.value = snapPreset;
    } else if (snap[i].promptSystem) {
      // Find the restored preset that matches this system text
      const match = getCustomPresets().find((p) => p.system === snap[i].promptSystem);
      if (match) presetSel.value = match.id;
      else presetSel.value = allOpts[0]?.value || 'operator';
    } else {
      presetSel.value = allOpts[0]?.value || 'operator';
    }

    el.querySelector('[data-role="modelPreset"]').value = snap[i].modelPreset || 'mock';
    el.querySelector('[data-role="memoryMode"]').value  = snap[i].memoryMode  || 'none';
  });
  return true;
}

function currentConfig() {
  return {
    version: 1,
    sharedInput: sharedInput.value,
    panels: snapshotPanels(),
    // Include full custom preset definitions so the export is self-contained
    customPresets: getCustomPresets(),
  };
}

function loadConfig(cfg) {
  if (!cfg || cfg.version !== 1) return false;
  if (cfg.sharedInput !== undefined) sharedInput.value = cfg.sharedInput;

  // Merge imported custom presets into localStorage
  if (cfg.customPresets && Array.isArray(cfg.customPresets)) {
    const existing   = getCustomPresets();
    const existingIds = new Set(existing.map((p) => p.id));
    const toAdd = cfg.customPresets.filter((p) => !existingIds.has(p.id));
    if (toAdd.length > 0) {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify([...existing, ...toAdd]));
      buildPresetOptions();
    }
  }

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
  const preset = (mergePresets()[promptPreset] || PROMPT_PRESETS.operator);
  const opening = side === 'left'
    ? 'This setup optimizes for speed and operator clarity.'
    : 'This setup optimizes for inspection and structured tradeoffs.';
  const recommendation = {
    operator: 'Recommendation: turn the request into a tight execution path with named steps, owner boundaries, and one obvious next move.',
    analyst:  'Recommendation: separate scope, decision criteria, and rollout risks so the comparison is visible instead of implied.',
    builder:  'Recommendation: shape the output as a handoff artifact that engineering or ops can run with immediately.',
  }[promptPreset] || 'Recommendation: adapt the output format to best serve the user goal.';
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
// Populate preset selectors with built-in + any saved custom presets
buildPresetOptions();

// ── Save-preset modal ──────────────────────────────────────────────────────────
const modal         = document.getElementById('presetModal');
const nameInput     = document.getElementById('presetNameInput');
const systemInput   = document.getElementById('presetSystemInput');
const savePresetBtn = document.getElementById('savePresetBtn');

function openPresetModal() {
  nameInput.value   = '';
  systemInput.value = '';
  modal.hidden       = false;
  nameInput.focus();
}

function closePresetModal() {
  modal.hidden = true;
}

savePresetBtn.addEventListener('click', openPresetModal);
document.getElementById('presetModalClose').addEventListener('click', closePresetModal);
document.getElementById('presetModalCancel').addEventListener('click', closePresetModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closePresetModal(); });

document.getElementById('presetModalSave').addEventListener('click', () => {
  const name   = nameInput.value.trim();
  const system = systemInput.value.trim();
  if (!name)   { nameInput.focus(); return; }
  if (!system) { systemInput.focus(); return; }
  saveCustomPreset(name, system);
  buildPresetOptions();
  closePresetModal();
  flashNotice('saved');
});

// Allow Ctrl+Enter to save in modal
[nameInput, systemInput].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      document.getElementById('presetModalSave').click();
    }
    if (e.key === 'Escape') closePresetModal();
  });
});

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
