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
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const actions = [
    'ping',
    'getDiretorias',
    'getGerencias',
    'getPeriodos',
    'getCodigosAcesso',
    'getSolicitacoesCountByDiretoria',
    'getSolicitacoes',
    'getServicos',
    'getServicosCatalogo',
    'getItensCatalogo',
    'getFuncionarios',
    'getLogsAtividades',
    'getLogsOrcamentarios',
    'getAdminConfig'
  ];

  for (const a of actions) {
    try {
      const res = await fetchUrl(scriptUrl + "?action=" + a);
      const isError = res.includes('"success":false');
      console.log(a, '=>', isError ? 'ERROR: ' + res.substring(0, 80) : 'OK: ' + res.substring(0, 80));
    } catch (e) {
      console.log(a, '=> EXCEPTION:', e.message);
    }
  }
}

main();
