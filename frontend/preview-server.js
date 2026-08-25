const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const types = {'.css': 'text/css', '.gif': 'image/gif', '.html': 'text/html', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml'};

http.createServer((request, response) => {
  const requested = request.url.split('?')[0];
  const relative = requested === '/' ? 'index.html' : decodeURIComponent(requested).replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (error, content) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`});
    response.end(content);
  });
}).listen(4173, '127.0.0.1', () => console.log('KONIPONI preview: http://127.0.0.1:4173'));
