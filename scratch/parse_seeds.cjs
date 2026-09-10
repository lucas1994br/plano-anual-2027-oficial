const fs = require('fs');

// 1. Test parsing itens_catalogo from seed.sql
const seedContent = fs.readFileSync('supabase/seeds/seed.sql', 'utf8');
const catIdx = seedContent.indexOf('INSERT INTO itens_catalogo (codigo, descricao, categoria, unidade, valor_unitario) VALUES');
const catEnd = seedContent.indexOf(';', catIdx);
const catBlock = seedContent.substring(catIdx, catEnd);

const regex = /\((\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*([0-9.]+)\)/g;
const catalogItems = [];
let m;
while ((m = regex.exec(catBlock)) !== null) {
  catalogItems.push({
    id: 'item-' + m[1],
    codigo: Number(m[1]),
    descricao: m[2],
    categoria: m[3],
    unidade: m[4],
    valor_unitario: Number(m[5]),
    created_at: new Date().toISOString()
  });
}
console.log('Parsed catalog items from seed.sql:', catalogItems.length);
if (catalogItems.length > 0) {
  console.log('Sample catalog item:', catalogItems[0]);
}

// 2. Test parsing servicos from seed_servicos_planilha.sql
const servContent = fs.readFileSync('supabase/seeds/seed_servicos_planilha.sql', 'utf8');
const servBlocks = servContent.split(/INSERT INTO servicos\s*\([^)]+\)\s*SELECT/gi).slice(1);
const services = [];

servBlocks.forEach((block, idx) => {
  const dirMatch = block.match(/WHERE sigla = '([^']+)'/);
  const gerMatch = block.match(/WHERE sigla = '([^']+)'\s+AND diretoria_id/);
  const itemMatch = block.match(/\b(\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',/);
  
  // Also try extracting values directly
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  // Look for the line with item number
  let itemNum = idx + 1;
  let tipo = 'Serviço';
  let demandante = '';
  let objeto = '';
  let justificativa = '';
  let valor = 0;
  let dotacao = 0;
  let prioridade = 'Médio';

  const dirSigla = dirMatch ? dirMatch[1] : '';
  const gerSigla = gerMatch ? gerMatch[1] : '';

  // Extract quoted strings
  const stringMatches = [...block.matchAll(/'([^']*)'/g)].map(x => x[1]);
  // Objeto is usually one of the long strings
  const longStrings = stringMatches.filter(s => s.length > 20 && !s.includes('SELECT') && !s.includes('%2027%'));
  if (longStrings.length >= 2) {
    objeto = longStrings[0];
    justificativa = longStrings[1];
  } else if (longStrings.length === 1) {
    objeto = longStrings[0];
  }

  // Extract numbers
  const numMatches = block.match(/\b\d+(\.\d+)?\b/g) || [];
  const numbers = numMatches.map(Number).filter(n => n > 100);
  if (numbers.length >= 1) valor = numbers[0];
  if (numbers.length >= 2) dotacao = numbers[1];

  if (objeto) {
    services.push({
      id: 'serv-' + (idx + 1),
      periodo_id: 'per-2027',
      diretoria_id: dirSigla ? 'dir-' + dirSigla.toLowerCase() : 'dir-dc',
      gerencia_id: gerSigla ? 'ger-' + gerSigla.toLowerCase() : '',
      item: idx + 1,
      tipo_contratacao: 'Serviço',
      unidade_demandante: gerSigla || dirSigla,
      objeto,
      justificativa,
      estimativa_valor: valor,
      dotacao_orcamentaria: dotacao,
      grau_prioridade: 'Médio',
      vinculacao: 'Não',
      dependencia_descricao: '',
      status: 'rascunho',
      observacao: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
});

console.log('Parsed services from seed_servicos_planilha.sql:', services.length);
if (services.length > 0) {
  console.log('Sample service:', services[0]);
}
