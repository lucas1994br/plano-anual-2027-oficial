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
  
  // Revert .select("id") to .select() when it's at the end of an insert or update query
  // Wait, I replaced .select("*") with .select("id") everywhere in the first step.
  // I will specifically fix the occurrences in the query chains.
  // For admin-create-catalog-item, the .select("id") was inserted after .insert([...])
  // We'll replace .select("id") with .select() for all functions.
  
  content = content.replace(/\.select\("id"\)\s*\n\s*\.single\(\)/g, '.select()\n      .single()');
  
  fs.writeFileSync(file, content);
  console.log('Reverted select("id") to select() in', file);
});
