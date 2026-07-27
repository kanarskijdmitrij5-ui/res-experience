'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);

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

function sendFile(req, res, file) {
  fs.stat(file, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const extension = path.extname(file).toLowerCase();
    const type = mime[extension] || 'application/octet-stream';
    const cache = extension === '.html' ? 'no-store, max-age=0' : 'public, max-age=604800';
    const range = req.headers.range;

    if (range && (extension === '.mp4' || extension === '.webm')) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match && match[1] ? Number(match[1]) : 0;
      const end = match && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;

      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
        res.end();
        return;
      }

      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache
      });

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cache
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(function (req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('{"status":"ok"}');
    return;
  }

  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  relative = relative.replace(/^assets\/(?:photos|video)\//, '');
  const file = path.resolve(root, relative);

  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  sendFile(req, res, file);
});

server.listen(port, '0.0.0.0', function () {
  console.log('RES Experience running on port ' + port);
});
