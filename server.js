'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function serve(req, res, file) {
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }

    const headers = {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=604800, immutable'
    };
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match && match[1] ? Number(match[1]) : 0;
      const end = match && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (!match || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': \`bytes */\${stat.size}\` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Content-Range': \`bytes \${start}-\${end}/\${stat.size}\`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\\/+/, '');
  // The media was uploaded flat to GitHub; preserve the existing page paths.
  relative = relative.replace(/^assets\\/(?:photos|video)\\//, '');
  const file = path.resolve(root, relative);

  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(file, (error, stat) => {
    if (!error && stat.isFile()) return serve(req, res, file);
    if (!error && stat.isDirectory()) return serve(req, res, path.join(file, 'index.html'));
    return serve(req, res, path.join(root, 'index.html'));
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(\`RES Experience running on port \${port}\`);
});
