const https = require('https');

const scriptUrl = "https://script.google.com/macros/s/AKfycbxoNkRj9R_iwwuu-JEIEFPpTCB4GV0qkau3YVaz19jH9BwExvGWn38SSFNuEiu8eEfJIg/exec";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("Fetching solicitacoes for DG...");
  const dirs = await fetchUrl(scriptUrl + "?action=getDiretorias");
  const dg = dirs.data?.find(d => d.sigla === 'DG');
  console.log("DG id:", dg?.id);

  const pers = await fetchUrl(scriptUrl + "?action=getPeriodos");
  console.log("Periodos:", pers.data);

  if (dg) {
    const sol = await fetchUrl(scriptUrl + "?action=getSolicitacoes&diretoria_id=" + dg.id);
    console.log("Total solicitacoes for DG:", sol.data?.length);
    if (sol.data?.length > 0) {
      console.log("First 3 solicitacoes sample:", sol.data.slice(0, 3));
      const withZeroCode = sol.data.filter(s => !s.codigo || s.codigo === 0 || s.codigo === '0');
      console.log("Count with zero/missing codigo:", withZeroCode.length);
      if (withZeroCode.length > 0) {
        console.log("Sample zero code item:", withZeroCode[0]);
      }
    }
  }
}

main();
