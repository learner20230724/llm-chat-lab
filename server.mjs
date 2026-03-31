import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const port = Number(process.env.PORT || 4173);
const root = new URL('.', import.meta.url).pathname;
const publicDir = join(root, 'public');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
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
  console.log(`llm-chat-lab running at http://localhost:${port}`);
});
