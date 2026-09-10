const https = require('https');
const fs = require('fs');

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
  const targetId = '10ccd787-2ee7-4ae5-9419-583e1a9be856';
  console.log("Searching for target item_id:", targetId);

  console.log("Fetching itens_catalogo from Google Sheets...");
  const cat = await fetchUrl(scriptUrl + "?action=getItensCatalogo");
  console.log("Total catalog items in Sheets:", cat.data?.length);
  if (cat.data?.length > 0) {
    const found = cat.data.find(c => c.id === targetId || String(c.id).toLowerCase() === targetId.toLowerCase());
    console.log("Found in Google Sheets catalog?", found);
    if (!found) {
      console.log("Sample catalog item from Sheets:", cat.data[0]);
    }
  }

  // Check seedData.ts
  const seed = fs.readFileSync('src/data/seedData.ts', 'utf8');
  if (seed.includes(targetId)) {
    console.log("Found targetId in seedData.ts!");
    const lines = seed.split('\n');
    lines.forEach((l, i) => {
      if (l.includes(targetId)) {
        console.log(`seedData.ts:${i+1}:`, l);
      }
    });
  } else {
    console.log("targetId NOT found in seedData.ts");
  }

  // Check other seed / migration files
  const files = ['supabase/migrations/20260101000000_initial_schema.sql', 'src/data/mockData.ts'];
  for (const f of files) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes(targetId)) {
        console.log(`Found targetId in ${f}!`);
      }
    }
  }
}

main();
