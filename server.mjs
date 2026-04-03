import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'path';

const port = Number(process.env.PORT || 4173);
const root = new URL('.', import.meta.url).pathname;
const publicDir = join(root, 'public');

// ── Provider config ───────────────────────────────────────────────────────────
const openAiKey    = process.env.OPENAI_API_KEY    || '';
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
const openAiModel    = process.env.OPENAI_MODEL      || 'gpt-4o-mini';
const claudeModel    = process.env.CLAUDE_MODEL      || 'claude-sonnet-4-20250514';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
};

// ── Preset definitions ────────────────────────────────────────────────────────
const PROMPT_PRESETS = {
  operator: {
    label: 'Operator brief',
    system: 'You are a concise operator. Give direct, compressed, next-step oriented advice. Prefer short sentences and actionable bullets.',
  },
  analyst: {
    label: 'Analyst breakdown',
    system: 'You are a structured analyst. Break things down, compare tradeoffs explicitly, and be explicit about assumptions and risks.',
  },
  builder: {
    label: 'Builder handoff',
    system: 'You are a builder-oriented advisor. Shape output as a concrete handoff artifact that engineering or ops can run with immediately. Prioritize specificity over abstraction.',
  },
};

const MEMORY_MODES = {
  none:    'No carryover. Treat this as a clean run.',
  session: 'Use short session continuity and preserve recent decisions.',
  project: 'Assume active project context and optimize for continuity.',
};

// Which real providers are available
const PROVIDERS = [];
if (openAiKey)    PROVIDERS.push('openai');
if (anthropicKey) PROVIDERS.push('anthropic');

// ── Mock response generator ──────────────────────────────────────────────────
function mockResponse({ preset, memoryMode, prompt }) {
  const p = PROMPT_PRESETS[preset];
  const openings = {
    left:  'This setup optimizes for speed and operator clarity.',
    right: 'This setup optimizes for inspection and structured tradeoffs.',
  };
  const recommendations = {
    operator: 'Recommendation: turn the request into a tight execution path with named steps, owner boundaries, and one obvious next move.',
    analyst:  'Recommendation: separate scope, decision criteria, and rollout risks so the comparison is visible instead of implied.',
    builder:  'Recommendation: shape the output as a handoff artifact that engineering or ops can run with immediately.',
  };
  return [
    openings[Math.random() > 0.5 ? 'left' : 'right'],
    '',
    `Prompt preset: ${p.label}`,
    `Memory mode: ${MEMORY_MODES[memoryMode]}`,
    '',
    `Input: "${prompt.trim()}"`,
    '',
    recommendations[preset],
    '',
    'Likely output shape:',
    '- a short framing line',
    '- 3 to 5 practical bullets or sections',
    '- an explicit next action rather than a vague summary',
  ].join('\n');
}

// ── Real OpenAI call ─────────────────────────────────────────────────────────
async function openaiReply({ preset, memoryMode, prompt }) {
  const p   = PROMPT_PRESETS[preset];
  const mem = MEMORY_MODES[memoryMode];
  const start     = Date.now();
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: openAiModel,
        messages: [
          { role: 'system', content: `${p.system}\n\nMemory policy: ${mem}` },
          { role: 'user',   content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `OpenAI error ${res.status}`);
    const text    = json.choices?.[0]?.message?.content || '';
    const latency = `${((Date.now() - start) / 1000).toFixed(1)}s`;
    const tokens  = json.usage?.total_tokens || 0;
    const cost    = `~$${(tokens * 0.15 / 1000).toFixed(4)}`;
    return { text, latency, tokens, cost, model: openAiModel };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError')
      return { text: '[timeout] Request exceeded 60s', latency: '60.0s', tokens: 0, cost: '$0', model: openAiModel };
    throw err;
  }
}

// ── Real Anthropic (Claude) call ──────────────────────────────────────────────
async function anthropicReply({ preset, memoryMode, prompt }) {
  const p   = PROMPT_PRESETS[preset];
  const mem = MEMORY_MODES[memoryMode];
  const start      = Date.now();
  const controller = new AbortController();
  const timer       = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':                        anthropicKey,
        'anthropic-version':                '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type':                      'application/json',
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 1024,
        system: `${p.system}\n\nMemory policy: ${mem}`,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.error?.message || `Anthropic error ${res.status}`);
    const text    = json.content?.[0]?.text || '';
    const latency = `${((Date.now() - start) / 1000).toFixed(1)}s`;
    // Anthropic counts in tokens; approximate cost using sonnet rate
    const tokens  = json.usage?.output_tokens || 0;
    const cost    = `~$${(tokens * 3 / 1_000_000).toFixed(4)}`; // sonnet ≈ $3/M out
    return { text, latency, tokens, cost, model: claudeModel };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError')
      return { text: '[timeout] Request exceeded 60s', latency: '60.0s', tokens: 0, cost: '$0', model: claudeModel };
    throw err;
  }
}

// ── Serve static files ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // GET /api/presets — return built-in preset definitions + available providers
  if (url.pathname === '/api/presets' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      promptPresets: PROMPT_PRESETS,
      memoryModes:    MEMORY_MODES,
      providers:      PROVIDERS,
    }));
    return;
  }

  // POST /api/compare — run comparison for one side
  if (url.pathname === '/api/compare' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON' }));
      return;
    }
    const { preset = 'operator', memoryMode = 'none', prompt = '', provider: requestedProvider } = parsed;

    // Route: mock → requested provider → first available live → error
    if (!openAiKey && !anthropicKey) {
      const text = mockResponse({ preset, memoryMode, prompt });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ text, latency: '<1ms', tokens: 0, cost: '$0', mock: true, model: 'mock' }));
      return;
    }

    const provider = requestedProvider
      || (anthropicKey ? 'anthropic' : 'openai');

    try {
      let result;
      if (provider === 'anthropic' && anthropicKey) {
        result = await anthropicReply({ preset, memoryMode, prompt });
        result.mock = false;
      } else if (provider === 'openai' && openAiKey) {
        result = await openaiReply({ preset, memoryMode, prompt });
        result.mock = false;
      } else if (anthropicKey) {
        result = await anthropicReply({ preset, memoryMode, prompt });
        result.mock = false;
      } else if (openAiKey) {
        result = await openaiReply({ preset, memoryMode, prompt });
        result.mock = false;
      } else {
        throw new Error('No live provider available');
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // GET /api/status — readiness probe with available providers
  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      ok:        true,
      providers: PROVIDERS,
      openAiModel,
      claudeModel,
    }));
    return;
  }

  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const filePath = join(publicDir, path);
    const body     = await readFile(filePath);
    const type     = contentTypes[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

const liveProviders = PROVIDERS.length
  ? `live [${PROVIDERS.join(', ')}]`
  : 'mock-only';
console.log(`llm-chat-lab [${liveProviders}] running at http://localhost:${port}`);
server.listen(port);
