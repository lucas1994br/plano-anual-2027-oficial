import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncCatalogo() {
  console.log("Iniciando sincronização do catálogo para serviços...");

  // 1. Pegar o período ativo
  const { data: periodoAtivo } = await supabase
    .from("periodos")
    .select("id")
    .eq("ativo", true)
    .maybeSingle();

  if (!periodoAtivo) {
    console.log("Nenhum período ativo encontrado.");
    return;
  }

  // 2. Pegar todas as gerências
  const { data: gerencias } = await supabase
    .from("gerencias")
    .select("id, diretoria_id, sigla")
    .eq("ativa", true);

  if (!gerencias || gerencias.length === 0) {
    console.log("Nenhuma gerência ativa encontrada.");
    return;
  }

  // 3. Pegar todos os itens do catálogo
  const { data: catalogoItens, error: errCat } = await supabase
    .from("servicos_catalogo")
    .select("*");

  if (errCat || !catalogoItens || catalogoItens.length === 0) {
    console.log("Nenhum item no catálogo ou erro ao buscar:", errCat);
    return;
  }

  console.log(`Sincronizando ${catalogoItens.length} itens do catálogo...`);

  // 4. Limpar fantasmas anteriores (para evitar duplicatas)
  await supabase.from("servicos").delete().neq("tipo_contratacao", "Novo");

  // 5. Inserir para cada gerência
  const solicitacoes = [];
  for (const cat of catalogoItens) {
    // Se o item do catálogo tem gerencia_id, só insere pra ela.
    // Se não tiver (for global), insere pra todas.
    const alvos = cat.gerencia_id 
      ? gerencias.filter(g => g.id === cat.gerencia_id)
      : gerencias;

    for (const g of alvos) {
      solicitacoes.push({
        periodo_id: periodoAtivo.id,
        diretoria_id: g.diretoria_id,
        gerencia_id: g.id,
        item: cat.item,
        tipo_contratacao: cat.tipo_contratacao || "Renovação",
        unidade_demandante: g.sigla || "N/A",
        objeto: cat.objeto,
        justificativa: cat.justificativa,
        estimativa_valor: cat.estimativa_valor,
        grau_prioridade: cat.grau_prioridade || "Médio",
        vinculacao: cat.vinculacao || "Não",
        status: "rascunho",
      });
    }
  }

  const { error: insertError } = await supabase.from("servicos").insert(solicitacoes);
  
  if (insertError) {
    console.error("Erro na sincronização:", insertError);
  } else {
    console.log(`Sincronização concluída com sucesso! ${solicitacoes.length} serviços inseridos.`);
  }
}

syncCatalogo();
