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
  
  const bulletproofValidation = `
    // Validar Admin (Bulletproof)
    const { data: accessRows, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .or(\`codigo.eq.\${accessCode},codigo_hash.eq.\${accessCode},codigo_hash.eq.\${accessHash},codigo.eq.\${accessHash}\`)
      .limit(1);

    const accessRow = accessRows && accessRows.length > 0 ? accessRows[0] : null;
`;

  // Regex to match from `// Validar Admin` OR `// 1. Validar Admin` until `if (accessError)`
  content = content.replace(
    /\/\/\s*\d*\.?\s*Validar Admin[\s\S]*?(?=if\s*\(\s*accessError\s*\))/i,
    bulletproofValidation + '\n    '
  );

  // Also fix validation block in admin-create-servico-catalogo which is structured differently
  // It has: let { data: accessRow, error: accessError } = ...
  if (dir.includes('servico') && !content.includes('Bulletproof')) {
      // Manual fallback for servico files if regex missed
      content = content.replace(
        /\/\/\s*1\.\s*Validar Admin[\s\S]*?(?=if\s*\(\s*accessError\s*\))/i,
        bulletproofValidation + '\n    '
      );
  }
  
  fs.writeFileSync(file, content);
  console.log('Fixed bulletproof auth in', file);
});
