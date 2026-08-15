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
  
  // Replace .select("*") with .select("id")
  content = content.replace(/\.select\("\*"\)/g, '.select("id")');
  content = content.replace(/\.select\('\*'\)/g, '.select("id")');
  
  // Remove ativo: true from inserts
  content = content.replace(/ativo:\s*true,?\n?/g, '');
  
  // Fix catch block error message
  content = content.replace(
    /const message = error instanceof Error \? error\.message : "Internal server error";/g,
    'const message = error instanceof Error ? error.message : (error?.message || "Internal server error");'
  );
  content = content.replace(
    /const errorMessage = error instanceof Error \? error\.message : String\(error\);/g,
    'const errorMessage = error instanceof Error ? error.message : (error?.message || String(error));'
  );
  
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
});
