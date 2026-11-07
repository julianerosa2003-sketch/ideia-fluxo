// Servidor estático mínimo, sem dependências.
// Em produção: GitHub Pages serve /docs direto (sem Node). Este servidor é para rodar local ou em Docker.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'docs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let filePath = path.normalize(path.join(ROOT, urlPath));

  // Bloqueia path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) filePath = path.join(ROOT, 'index.html'); // fallback SPA
    const ext = path.extname(filePath);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    };
    // sw.js nunca em cache, senão updates não chegam
    headers['Cache-Control'] = filePath.endsWith('sw.js') || ext === '.html'
      ? 'no-cache'
      : 'public, max-age=3600';
    const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzip) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
  });
});

server.listen(PORT, () => console.log(`Ideias PWA rodando em http://localhost:${PORT}`));
