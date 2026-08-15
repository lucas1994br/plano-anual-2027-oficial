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
  
  // Fix TypeScript error on error.message
  content = content.replace(
    /const message = error instanceof Error \? error\.message : \(error\?\.message \|\| "Internal server error"\);/g,
    'const message = error instanceof Error ? error.message : ((error as any)?.message || "Internal server error");'
  );
  
  fs.writeFileSync(file, content);
  console.log('Fixed TypeScript error in', file);
});
