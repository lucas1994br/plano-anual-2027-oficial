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
  
  // Replace .eq("codigo_hash", accessCode) with .eq("codigo", accessCode)
  content = content.replace(/\.eq\("codigo_hash",\s*accessCode\)/g, '.eq("codigo", accessCode)');
  
  fs.writeFileSync(file, content);
  console.log('Fixed fallback accessCode in', file);
});
