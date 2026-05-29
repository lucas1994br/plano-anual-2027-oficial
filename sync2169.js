import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sync2169() {
  const { data: periodoAtivo } = await supabase.from("periodos").select("id").eq("ativo", true).single();
  const { data: gerencias } = await supabase.from("gerencias").select("id, diretoria_id, sigla").eq("ativa", true);
  const { data: cat } = await supabase.from("servicos_catalogo").select("*").eq("item", 2169).single();

  if (!cat || !gerencias || !periodoAtivo) return;

  const alvos = cat.gerencia_id ? gerencias.filter(g => g.id === cat.gerencia_id) : gerencias;
  const solicitacoes = alvos.map(g => ({
    periodo_id: periodoAtivo.id,
    diretoria_id: g.diretoria_id,
    gerencia_id: g.id,
    item: cat.item,
    tipo_contratacao: cat.tipo_contratacao,
    unidade_demandante: g.sigla || "N/A",
    objeto: cat.objeto,
    justificativa: cat.justificativa,
    estimativa_valor: cat.estimativa_valor,
    grau_prioridade: cat.grau_prioridade || "Médio",
    vinculacao: cat.vinculacao || "Não",
    status: "rascunho",
  }));

  // Delete any existing 2169 in servicos to avoid duplicates
  await supabase.from("servicos").delete().eq("item", 2169);

  // Insert
  await supabase.from("servicos").insert(solicitacoes);
  console.log("Item 2169 sincronizado!");
}

sync2169();
