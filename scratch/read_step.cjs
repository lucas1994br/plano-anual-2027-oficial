const fs = require('fs');
const transcriptPath = 'C:/Users/noell/.gemini/antigravity-ide/brain/a72b4817-3785-4b64-8d2a-6c522674c89d/.system_generated/logs/transcript.jsonl';
const s = fs.readFileSync(transcriptPath, 'utf8');
const lines = s.split('\n');
const line521 = lines.find(x => x.includes('"step_index":521'));
if (line521) {
  console.log(JSON.parse(line521).content);
} else {
  console.log('Line 521 not found');
}
