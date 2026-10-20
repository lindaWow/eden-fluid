#!/bin/bash
cd "$(dirname "$0")"
echo "Starting server at http://localhost:8080/伊甸流体.html"
echo "Press Ctrl+C to stop"
node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.slice(1));
  if (urlPath === '') urlPath = '伊甸流体.html';
  const filePath = path.join(__dirname, urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const types = {'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm'};
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});
server.listen(8080, () => console.log('✓ Server running at http://localhost:8080/伊甸流体.html'));
"
