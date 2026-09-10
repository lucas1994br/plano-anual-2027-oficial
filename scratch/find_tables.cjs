const fs = require('fs');
const content = fs.readFileSync('src/lib/services.ts', 'utf8');
const regex = /\.from\(['"]([a-zA-Z0-9_-]+)['"]\)/g;
const matches = [];
let m;
while ((m = regex.exec(content)) !== null) {
  matches.push(m[1]);
}
console.log('Tables used in services.ts:');
console.log([...new Set(matches)]);
