const fs = require('fs');
const path = require('path');

const dirs = [
  'admin-create-catalog-item',
  'admin-update-catalog-item',
  'admin-delete-catalog-item',
  'admin-create-servico-catalogo',
  'admin-update-servico-catalogo',
  'admin-delete-servico-catalogo'
];

dirs.forEach(dir => {
  const file = path.join('supabase/functions', dir, 'index.ts');
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove `codigo.eq` from the `.or(...)` since the `codigo` column does not exist!
  content = content.replace(
    /\.or\(`codigo\.eq\.\$\{accessCode\},codigo_hash\.eq\.\$\{accessCode\},codigo_hash\.eq\.\$\{accessHash\},codigo\.eq\.\$\{accessHash\}`\)/g,
    '.or(`codigo_hash.eq.${accessCode},codigo_hash.eq.${accessHash}`)'
  );
  
  fs.writeFileSync(file, content);
  console.log('Fixed schema mismatch in', file);
});
