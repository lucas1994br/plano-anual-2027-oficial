const fs = require('fs');
const content = fs.readFileSync('src/lib/services.ts', 'utf8');

const regex = /export\s+(async\s+)?function\s+([a-zA-Z0-9_]+)/g;
const funcs = [];
let m;
while ((m = regex.exec(content)) !== null) {
  funcs.push(m[2]);
}

console.log(`Total exported functions in services.ts: ${funcs.length}`);
console.log(funcs);
