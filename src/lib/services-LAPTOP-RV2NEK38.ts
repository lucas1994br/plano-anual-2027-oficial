import { supabase } from "./supabaseClient.ts";
import { PlanItem, SolicitacaoStatus } from "@/types/plan.ts";

// ============ DIRETORIAS & GERÊNCIAS ============

export async function getDiretorias() {
  const { data, error } = await supabase
    .from("diretorias")
    .select("*")
    .eq("ativa", true)
    .order("sigla");

  if (error) throw error;
  return data || [];
}

export async function getGerenciasByDiretoria(diretoriaId: string) {
  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
    .eq("diretoria_id", diretoriaId)
    .eq("ativa", true)
    .order("sigla");

  if (error) throw error;
  return data || [];
}

// ============ PERÍODOS ============

export async function getPeriodosAtivos() {
  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .eq("ativo", true)
    .order("fim", { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============ SOLICITAÇÕES ============

export async function getSolicitacoesByGerencia(gerenciaId: string, periodoId: string) {
  const { data, error } = await supabase
    .from("solicitacoes")
    .select("*")
    .eq("gerencia_id", gerenciaId)
    .eq("periodo_id", periodoId)
    .order("codigo");

  if (error) throw error;
  return (data || []) as PlanItem[];
}

export async function getSolicitacoesByDiretoria(diretoriaId: string, periodoId: string) {
  const { data, error } = await supabase
    .from("solicitacoes")
    .select("*")
    .eq("diretoria_id", diretoriaId)
    .eq("periodo_id", periodoId)
    .order("gerencia_id, codigo");

  if (error) throw error;
  return (data || []) as PlanItem[];
}

export async function createSolicitacao(solicitacao: Partial<PlanItem> & {
  periodo_id: string;
  diretoria_id: string;
  gerencia_id: string;
}) {
  const { data, error } = await supabase
    .from("solicitacoes")
    .insert([solicitacao])
    .select()
    .single();

  if (error) throw error;
  return data as PlanItem;
}

export async function updateSolicitacao(id: string, updates: Partial<PlanItem>) {
  const { data, error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as PlanItem;
}

export async function updateSolicitacaoStatus(
  id: string,
  status: SolicitacaoStatus,
  justificativa?: string
) {
  const updates: Record<string, unknown> = { status };
  
  if (status === "enviado") {
    updates.enviado_em = new Date().toISOString();
  } else if (status === "aprovado") {
    updates.aprovado_em = new Date().toISOString();
  } else if (status === "rejeitado" && justificativa) {
    updates.justificativa_rejeicao = justificativa;
  }

  const { data, error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Log histórico
  if (data) {
    await logHistorico(id, status, justificativa);
  }

  return data as PlanItem;
}

// ============ HISTÓRICO ============

async function logHistorico(solicitacaoId: string, status: SolicitacaoStatus, justificativa?: string) {
  await supabase
    .from("solicitacao_historico")
    .insert([
      {
        solicitacao_id: solicitacaoId,
        status_novo: status,
        acao: `Status alterado para ${status}`,
        autor_tipo: "sistema",
        justificativa: justificativa,
      },
    ]);
}

// ============ VALIDAÇÃO DE CÓDIGO ============

export async function validateAccessCode(code: string, scope: "diretoria" | "gerencia" | "admin" | "compras") {
  try {
    // Query codigos_acesso directly from frontend (codes stored as plain text)
    const { data: accessCodes, error } = await supabase
      .from("codigos_acesso")
      .select("*")
      .eq("ativo", true)
      .eq("scope", scope);

    if (error) throw error;

    console.log("🔍 DEBUG - Buscando código:", code);
    console.log("📋 DEBUG - Scope:", scope);
    console.log("📊 DEBUG - Códigos encontrados:", accessCodes?.length || 0);
    accessCodes?.forEach((ac: unknown) => {
      console.log(`  - Código Hash: "${(ac as { codigo_hash: string }).codigo_hash}" | Diretoria: ${(ac as { diretoria_id: string }).diretoria_id} | Gerência: ${(ac as { gerencia_id: string }).gerencia_id}`);
    });

    // Find matching code
    const matchedCode = accessCodes?.find((ac: unknown) => (ac as { codigo_hash: string }).codigo_hash === code);

    if (!matchedCode) {
      console.log("❌ Código não encontrado");
      throw new Error("Invalid access code");
    }

    console.log("✅ Código válido encontrado!");

    // Check if expired
    if (matchedCode.expira_em && new Date(matchedCode.expira_em) < new Date()) {
      throw new Error("Access code has expired");
    }

    return {
      scope: matchedCode.scope,
      diretoria_id: matchedCode.diretoria_id,
      gerencia_id: matchedCode.gerencia_id,
      expired_at: matchedCode.expira_em,
    };
  } catch (err) {
    console.error("Erro ao validar código:", err);
    throw err;
  }
}

// ============ ITENS CATÁLOGO ============

export async function getItensCatalogo() {
  const { data, error } = await supabase
    .from("itens_catalogo")
    .select("*")
    .order("codigo");

  if (error) throw error;
  return data || [];
}

// ============ IMPORTAR ITENS DO CATÁLOGO PARA SOLICITAÇÃO ============

export async function createSolicitacoesFromCatalogo(
  diretoriaId: string,
  gerenciaId: string,
  periodoId: string,
  codigosCatalogo: number[]
) {
  const itens = await supabase
    .from("itens_catalogo")
    .select("*")
    .in("codigo", codigosCatalogo);

  if (itens.error) throw itens.error;

  const solicitacoes = itens.data?.map((item) => ({
    periodo_id: periodoId,
    diretoria_id: diretoriaId,
    gerencia_id: gerenciaId,
    codigo: item.codigo,
    descricao: item.descricao,
    categoria: item.categoria,
    unidade: item.unidade,
    valor_unitario: item.valor_unitario,
    qtd_estimada: 0,
    prioridade: "Média",
    status: "rascunho",
  })) || [];

  const { data, error } = await supabase
    .from("solicitacoes")
    .insert(solicitacoes)
    .select();

  if (error) throw error;
  return data;
}
