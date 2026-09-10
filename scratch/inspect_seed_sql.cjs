const fs = require('fs');

const seedSql = fs.readFileSync('supabase/seeds/seed.sql', 'utf8');
console.log("Length:", seedSql.length);

const solIdx = seedSql.indexOf('INSERT INTO solicitacoes');
console.log("solicitacoes index in seed.sql:", solIdx);

if (solIdx !== -1) {
  console.log("Sample solicitacoes insert in seed.sql:");
  console.log(seedSql.substring(solIdx, solIdx + 1000));
}

// Check other files in supabase
const files = fs.readdirSync('supabase/seeds');
files.forEach(f => {
  if (f.endsWith('.sql')) {
    const c = fs.readFileSync('supabase/seeds/' + f, 'utf8');
    if (c.includes('INSERT INTO solicitacoes')) {
      console.log('Found INSERT INTO solicitacoes in:', f);
    }
  }
});
