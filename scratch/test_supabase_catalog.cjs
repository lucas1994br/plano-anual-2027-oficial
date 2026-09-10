const https = require('https');

const supabaseUrl = "https://icyawlvdmlcndsjpudle.supabase.co";
const anonKey = "sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN";

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, supabaseUrl);
    const options = {
      headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("Checking Supabase itens_catalogo by target item_id...");
  const targetId = '10ccd787-2ee7-4ae5-9419-583e1a9be856';
  const res = await get(`/rest/v1/itens_catalogo?id=eq.${targetId}&select=*`);
  console.log("Target item response:", res);

  console.log("\nChecking Supabase funcionarios...");
  const funcRes = await get(`/rest/v1/funcionarios?select=*&limit=10`);
  console.log("Funcionarios response:", funcRes);
}

main();
