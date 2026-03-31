const promptPresets = {
  operator: {
    label: 'Operator brief',
    style: 'Direct, compressed, next-step oriented.',
  },
  analyst: {
    label: 'Analyst breakdown',
    style: 'Structured, comparison-heavy, tradeoff aware.',
  },
  builder: {
    label: 'Builder handoff',
    style: 'Implementation-facing, concrete, delivery-minded.',
  },
};

const modelPresets = {
  gpt54: { label: 'GPT-5.4 balanced', latency: '1.8s', tokenBias: 1.0, cost: '$0.012' },
  fast: { label: 'Fast local mock', latency: '0.8s', tokenBias: 0.7, cost: '$0.004' },
  deep: { label: 'Deep reasoning mock', latency: '3.1s', tokenBias: 1.35, cost: '$0.021' },
};

const memoryModes = {
  none: 'No carryover. Treat this as a clean run.',
  session: 'Use short session continuity and preserve recent decisions.',
  project: 'Assume active project context and optimize for continuity.',
};

const panelEls = [...document.querySelectorAll('.panel-card')];
const runButton = document.getElementById('runButton');
const swapButton = document.getElementById('swapButton');
const sharedInput = document.getElementById('sharedInput');

function buildResponse({ prompt, promptPreset, modelPreset, memoryMode, side }) {
  const preset = promptPresets[promptPreset];
  const model = modelPresets[modelPreset];
  const memory = memoryModes[memoryMode];

  const opening = {
    left: 'This setup optimizes for speed and operator clarity.',
    right: 'This setup optimizes for inspection and structured tradeoffs.',
  }[side];

  const recommendation = {
    operator:
      'Recommendation: turn the request into a tight execution path with named steps, owner boundaries, and one obvious next move.',
    analyst:
      'Recommendation: separate scope, decision criteria, and rollout risks so the comparison is visible instead of implied.',
    builder:
      'Recommendation: shape the output as a handoff artifact that engineering or ops can run with immediately.',
  }[promptPreset];

  return [
    opening,
    '',
    `Prompt preset: ${preset.label} — ${preset.style}`,
    `Model preset: ${model.label}`,
    `Memory mode: ${memory}`,
    '',
    `Input under test: "${prompt.trim()}"`,
    '',
    recommendation,
    '',
    'Likely output shape:',
    '- a short framing line',
    '- 3 to 5 practical bullets or sections',
    '- an explicit next action rather than a vague summary',
  ].join('\n');
}

function estimateTokens(prompt, promptPreset, modelPreset) {
  const base = Math.max(48, Math.round(prompt.trim().length * 0.55));
  const promptWeight = promptPreset === 'analyst' ? 1.25 : promptPreset === 'builder' ? 1.1 : 0.9;
  const modelWeight = modelPresets[modelPreset].tokenBias;
  return Math.round(base * promptWeight * modelWeight);
}

function renderPanel(panelEl, side) {
  const promptPreset = panelEl.querySelector('[data-role="promptPreset"]').value;
  const modelPreset = panelEl.querySelector('[data-role="modelPreset"]').value;
  const memoryMode = panelEl.querySelector('[data-role="memoryMode"]').value;
  const prompt = sharedInput.value;
  const tokens = estimateTokens(prompt, promptPreset, modelPreset);

  panelEl.querySelector('[data-role="latency"]').textContent = modelPresets[modelPreset].latency;
  panelEl.querySelector('[data-role="tokens"]').textContent = `${tokens} tok`;
  panelEl.querySelector('[data-role="cost"]').textContent = modelPresets[modelPreset].cost;
  panelEl.querySelector('[data-role="response"]').textContent = buildResponse({
    prompt,
    promptPreset,
    modelPreset,
    memoryMode,
    side,
  });
}

function runCompare() {
  renderPanel(panelEls[0], 'left');
  renderPanel(panelEls[1], 'right');
}

function swapPanels() {
  const left = panelEls[0];
  const right = panelEls[1];

  ['promptPreset', 'modelPreset', 'memoryMode'].forEach((role) => {
    const leftSelect = left.querySelector(`[data-role="${role}"]`);
    const rightSelect = right.querySelector(`[data-role="${role}"]`);
    const temp = leftSelect.value;
    leftSelect.value = rightSelect.value;
    rightSelect.value = temp;
  });

  runCompare();
}

runButton.addEventListener('click', runCompare);
swapButton.addEventListener('click', swapPanels);
sharedInput.addEventListener('input', runCompare);
panelEls.forEach((panel) => {
  panel.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', runCompare);
  });
});

runCompare();
