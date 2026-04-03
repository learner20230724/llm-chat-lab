import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'path';

const port = Number(process.env.PORT || 4173);
const root = new URL('.', import.meta.url).pathname;
const publicDir = join(root, 'public');
const apiKey = process.env.OPENAI_API_KEY || '';
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// ── Prompt presets ────────────────────────────────────────────────────────────
const promptPresets = {
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

const memoryModes = {
  none: 'No carryover. Treat this as a clean run.',
  session: 'Use short session continuity and preserve recent decisions.',
  project: 'Assume active project context and optimize for continuity.',
};

// ── Mock response generator ──────────────────────────────────────────────────
function mockResponse({ preset, modelLabel, memoryMode, prompt }) {
  const p = promptPresets[preset];
  const openings = {
    left: 'This setup optimizes for speed and operator clarity.',
    right: 'This setup optimizes for inspection and structured tradeoffs.',
  };
  const recommendations = {
    operator: 'Recommendation: turn the request into a tight execution path with named steps, owner boundaries, and one obvious next move.',
    analyst: 'Recommendation: separate scope, decision criteria, and rollout risks so the comparison is visible instead of implied.',
    builder: 'Recommendation: shape the output as a handoff artifact that engineering or ops can run with immediately.',
  };
  return [
    openings[Math.random() > 0.5 ? 'left' : 'right'],
    '',
    `Prompt preset: ${p.label}`,
    `Memory mode: ${memoryModes[memoryMode]}`,
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
  const p = promptPresets[preset];
  const mem = memoryModes[memoryMode];
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${p.system}\n\nMemory policy: ${mem}` },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `OpenAI error ${res.status}`);
    const text = json.choices?.[0]?.message?.content || '';
    const latency = `${((Date.now() - start) / 1000).toFixed(1)}s`;
    const tokens = json.usage?.total_tokens || 0;
    const cost = `~$${(tokens * 0.15 / 1000).toFixed(4)}`;
    return { text, latency, tokens, cost };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { text: '[timeout] Request exceeded 60s', latency: '60.0s', tokens: 0, cost: '$0' };
    throw err;
  }
}

// ── Serve static files ────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // API proxy
  if (url.pathname === '/api/compare' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON' }));
      return;
    }
    const { preset = 'operator', model: _m, memoryMode = 'none', prompt = '' } = parsed;

    // If no API key, fall back to mock
    if (!apiKey) {
      const text = mockResponse({ preset, modelLabel: 'mock', memoryMode, prompt });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ text, latency: '<1ms', tokens: 0, cost: '$0', mock: true }));
      return;
    }

    try {
      const result = await openaiReply({ preset, memoryMode, prompt });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...result, mock: false }));
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Readiness check
  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, hasApiKey: !!apiKey, model }));
    return;
  }

  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const filePath = join(publicDir, path);
    const body = await readFile(filePath);
    const type = contentTypes[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  const mode = apiKey ? `live (${model})` : 'mock-only';
  console.log(`llm-chat-lab [${mode}] running at http://localhost:${port}`);
});
