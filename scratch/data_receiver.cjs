const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.csvFunc) {
          fs.writeFileSync('public/data/funcionarios.csv', json.csvFunc, 'utf8');
          console.log("Saved public/data/funcionarios.csv (bytes: " + json.csvFunc.length + ")");
        }
        if (json.csvCat) {
          fs.writeFileSync('public/data/itens_catalogo.csv', json.csvCat, 'utf8');
          console.log("Saved public/data/itens_catalogo.csv (bytes: " + json.csvCat.length + ")");
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => process.exit(0), 1000);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3333, () => {
  console.log("Data receiver listening on http://localhost:3333/save");
});
