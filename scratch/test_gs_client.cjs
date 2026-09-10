const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxoNkRj9R_iwwuu-JEIEFPpTCB4GV0qkau3YVaz19jH9BwExvGWn38SSFNuEiu8eEfJIg/exec";

async function test() {
  console.log("1. Testing ping...");
  const ping = await fetch(SCRIPT_URL + "?action=ping").then(r => r.json());
  console.log("Ping:", ping);

  console.log("2. Testing getDiretorias...");
  const dirs = await fetch(SCRIPT_URL + "?action=getDiretorias").then(r => r.json());
  console.log("Diretorias:", dirs.data?.length);

  console.log("3. Testing getGerencias...");
  const gers = await fetch(SCRIPT_URL + "?action=getGerencias").then(r => r.json());
  console.log("Gerencias:", gers.data?.length);

  console.log("4. Testing validateAccessCode for admin123...");
  const val = await fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action: "validateAccessCode", code: "admin123", scope: "admin" })
  }).then(r => r.json());
  console.log("Validation:", val);
}

test().catch(console.error);
