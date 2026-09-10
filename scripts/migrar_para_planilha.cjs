const fs = require('fs');
const path = require('path');

const SCRIPT_URL = process.env.VITE_GOOGLE_SCRIPT_URL || 
  "https://script.google.com/macros/s/AKfycbxoNkRj9R_iwwuu-JEIEFPpTCB4GV0qkau3YVaz19jH9BwExvGWn38SSFNuEiu8eEfJIg/exec";

async function postAction(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body
  });
  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

async function getAction(action, params = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

async function main() {
  console.log("=================================================");
  console.log("MIGRAÇÃO DE DADOS PARA GOOGLE PLANILHAS (PAC 2027)");
  console.log("URL:", SCRIPT_URL);
  console.log("=================================================");

  // 1. Inicializar estrutura da planilha
  console.log("\n1. Inicializando abas e cabeçalhos na planilha...");
  try {
    const initRes = await postAction("initSpreadsheet");
    console.log("Resultado da inicialização:", initRes);
  } catch (e) {
    console.warn("Aviso ao inicializar:", e.message);
  }

  // Obter mapas de IDs reais da planilha
  console.log("\nObtendo mapeamento de IDs de Diretorias, Gerências e Períodos...");
  const diretorias = await getAction("getDiretorias");
  const gerencias = await getAction("getGerencias");
  const periodos = await getAction("getPeriodos");

  const dirMap = {};
  (diretorias || []).forEach(d => {
    if (d.sigla) dirMap[d.sigla.toUpperCase().trim()] = d.id;
  });

  const gerMap = {};
  (gerencias || []).forEach(g => {
    if (g.sigla) gerMap[g.sigla.toUpperCase().trim()] = g.id;
  });

  const activePeriod = (periodos || []).find(p => p.ativo) || (periodos || [])[0] || { id: "1d7edd8a-f895-4835-8139-8e53dbbf73b7" };
  console.log("Período Ativo:", activePeriod.id, activePeriod.nome);
  console.log("Diretorias carregadas:", Object.keys(dirMap).length);
  console.log("Gerências carregadas:", Object.keys(gerMap).length);

  // 2. Extrair e migrar Catálogo de Materiais (itens_catalogo)
  console.log("\n2. Processando Catálogo de Materiais de seed.sql...");
  const seedSql = fs.readFileSync(path.resolve('supabase/seeds/seed.sql'), 'utf8');
  const catIdx = seedSql.indexOf('INSERT INTO itens_catalogo (codigo, descricao, categoria, unidade, valor_unitario) VALUES');
  const catEnd = seedSql.indexOf(';', catIdx);
  const catBlock = seedSql.substring(catIdx, catEnd);

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
  console.log(`Encontrados ${catalogItems.length} itens de catálogo.`);

  // Inserir itens de catálogo em lotes de 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < catalogItems.length; i += BATCH_SIZE) {
    const batch = catalogItems.slice(i, i + BATCH_SIZE);
    console.log(`Enviando lote de itens ${i + 1} a ${Math.min(i + BATCH_SIZE, catalogItems.length)}...`);
    try {
      const res = await postAction("bulkInsert", { sheet: "itens_catalogo", items: batch });
      console.log(`Lote inserido com sucesso (${res.count || batch.length} registros).`);
    } catch (err) {
      console.error(`Erro ao inserir lote:`, err.message);
    }
  }

  // 3. Extrair e migrar Serviços de seed_servicos_planilha.sql
  console.log("\n3. Processando Serviços Existentes de seed_servicos_planilha.sql...");
  const servSql = fs.readFileSync(path.resolve('supabase/seeds/seed_servicos_planilha.sql'), 'utf8');
  const servStatements = servSql.split('INSERT INTO servicos').slice(1);
  const services = [];

  servStatements.forEach((stmt, idx) => {
    try {
      const dirMatch = stmt.match(/WHERE sigla = '([^']+)'/);
      const gerMatch = stmt.match(/WHERE sigla = '([^']+)'\s+AND diretoria_id/);
      const dirSigla = dirMatch ? dirMatch[1].toUpperCase() : 'DC';
      const gerSigla = gerMatch ? gerMatch[1].toUpperCase() : '';

      const dirId = dirMap[dirSigla] || (dirMap['DG'] || '36180ff2-6ce5-435c-8da4-c282315a9283');
      const gerId = gerMap[gerSigla] || '';

      // Match item number and values
      const valMatch = stmt.match(/SELECT[\s\S]*?\b(\d+),\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',([\s\S]*?)WHERE/);
      if (valMatch) {
        const itemNum = Number(valMatch[1]);
        const tipo = valMatch[2];
        const demandante = valMatch[3];
        const objeto = valMatch[4];
        const justificativa = valMatch[5];
        const rest = valMatch[6];

        const dateMatch = rest.match(/'(\d{4}-\d{2}-\d{2})'/);
        const previsao = dateMatch ? dateMatch[1] : '';

        const nums = rest.match(/\b\d+(\.\d+)?\b/g) || [];
        const valor = nums.length > 0 ? Number(nums[0]) : 0;
        const dotacao = nums.length > 1 ? Number(nums[1]) : 0;

        const prioridadeMatch = rest.match(/'(Muito Alto|Alto|Médio|Medio|Baixo|Baixa|Muito Baixo)'/i);
        const prioridade = prioridadeMatch ? prioridadeMatch[1] : 'Médio';

        services.push({
          id: 'serv-' + (idx + 1),
          periodo_id: activePeriod.id,
          diretoria_id: dirId,
          gerencia_id: gerId,
          item: itemNum || (idx + 1),
          tipo_contratacao: tipo,
          unidade_demandante: demandante,
          objeto,
          justificativa,
          previsao_inicio: previsao,
          estimativa_valor: valor,
          dotacao_orcamentaria: dotacao,
          grau_prioridade: prioridade,
          vinculacao: 'Não',
          dependencia_descricao: '',
          status: 'rascunho',
          observacao: '',
          contrato: '',
          contratada: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      // ignore parsing error for individual block
    }
  });

  console.log(`Encontrados ${services.length} serviços estruturados.`);
  if (services.length > 0) {
    console.log("Enviando serviços para a planilha...");
    const resServ = await postAction("bulkInsert", { sheet: "servicos", items: services });
    console.log("Serviços inseridos:", resServ);
  }

  // 4. Configurações Iniciais do Admin Mini ERP
  console.log("\n4. Configurando limites orçamentários iniciais (admin_config)...");
  const miniErpConfig = {
    diretoriaBudgetsServicosNovos: {
      [dirMap["DG"] || "36180ff2-6ce5-435c-8da4-c282315a9283"]: 5000000,
      [dirMap["DC"] || "684972d4-a9ef-4f8e-b849-4576e5c0d8c9"]: 8000000,
      [dirMap["DE"] || "56768808-d2ef-4ee8-80e9-743e98898a95"]: 15000000,
      [dirMap["DO"] || "842c2695-a38b-4ffa-aeb7-0f9d5753fb34"]: 20000000,
      [dirMap["PR"] || "cbe634cd-7c90-400e-babe-b51402d57a50"]: 2000000
    },
    diretoriaBudgetsServicosExistentes: {
      [dirMap["DG"] || "36180ff2-6ce5-435c-8da4-c282315a9283"]: 12000000,
      [dirMap["DC"] || "684972d4-a9ef-4f8e-b849-4576e5c0d8c9"]: 25000000,
      [dirMap["DE"] || "56768808-d2ef-4ee8-80e9-743e98898a95"]: 40000000,
      [dirMap["DO"] || "842c2695-a38b-4ffa-aeb7-0f9d5753fb34"]: 80000000,
      [dirMap["PR"] || "cbe634cd-7c90-400e-babe-b51402d57a50"]: 5000000
    }
  };
  await postAction("saveAdminConfig", {
    chave: "admin_mini_erp_config",
    valor: miniErpConfig
  });
  console.log("Configurações do Mini ERP salvas com sucesso!");

  console.log("\n=================================================");
  console.log("MIGRAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log("=================================================");
}

main().catch(err => {
  console.error("Erro fatal na migração:", err);
  process.exit(1);
});
