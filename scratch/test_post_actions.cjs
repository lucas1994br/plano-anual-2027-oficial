const https = require('https');

const scriptUrl = "https://script.google.com/macros/s/AKfycbxoNkRj9R_iwwuu-JEIEFPpTCB4GV0qkau3YVaz19jH9BwExvGWn38SSFNuEiu8eEfJIg/exec";

function postUrl(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // For Google Apps Script, 302 redirects on POST to a GET url with response!
        return https.get(res.headers.location, (res2) => {
          let d = '';
          res2.on('data', chunk => d += chunk);
          res2.on('end', () => {
            try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
          });
        });
      }
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("Testing doPost validateAccessCode...");
  const res = await postUrl(scriptUrl, { action: "validateAccessCode", code: "admin123", scope: "admin" });
  console.log("validateAccessCode response:", res);

  console.log("Testing doPost with custom action listSheets if available...");
  const res2 = await postUrl(scriptUrl, { action: "listSheets" });
  console.log("listSheets response:", res2);
}

main();
