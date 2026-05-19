import { supabase } from "./supabaseClient.ts";
import { PlanItem, SolicitacaoStatus, ServicoItem, Diretoria } from "@/types/plan.ts";
import { AdminBudgetConfig, RoutingRule } from "./adminBudgetConfig.ts";

const SUPABASE_PAGE_SIZE = 1000;
const DIRETORIAS_CACHE_KEY = "pac2027:diretorias";
const DIRETORIAS_CACHE_TTL_MS = 10 * 60 * 1000;

type DiretoriaRow = {
  id: string;
  sigla: string;
  nome?: string;
  descricao?: string;
  ativa?: boolean;
};

function loadDiretoriasCache(): DiretoriaRow[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(DIRETORIAS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { updatedAt?: number; data?: DiretoriaRow[] };
    if (!parsed?.updatedAt || !Array.isArray(parsed.data)) return null;

    const isFresh = Date.now() - parsed.updatedAt <= DIRETORIAS_CACHE_TTL_MS;
    return isFresh ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveDiretoriasCache(data: DiretoriaRow[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      DIRETORIAS_CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now(), data })
    );
  } catch {
    // Ignora falhas de storage para não impactar o fluxo principal.
  }
}

function normalizeDiretorias(rows: DiretoriaRow[] | null | undefined): DiretoriaRow[] {
  return (rows || []).map((dir) => ({
    ...dir,
    sigla: String(dir.sigla || "").trim().toUpperCase(),
  }));
}

async function fetchAllPages<T>(
  queryFactory: (
    from: number,
    to: number,
    includeCount: boolean
  ) => Promise<{ data: T[] | null; error: unknown; count?: number | null }>
) {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to, false);

    if (error) throw error;

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < SUPABASE_PAGE_SIZE) {
      break;
    }

    from += SUPABASE_PAGE_SIZE;
  }

  return allRows;
}

// ============ DIRETORIAS & GERÊNCIAS ============

export async function getDiretorias() {
  const cached = loadDiretoriasCache();
  if (cached && cached.length > 0) {
    return cached;
  }

  const query = await supabase
    .from("diretorias")
    .select("*")
    .order("sigla");

  if (!query.error) {
    const normalized = normalizeDiretorias(query.data as DiretoriaRow[]);
    const hasAtivaFlag = normalized.some((dir) => Object.prototype.hasOwnProperty.call(dir, "ativa"));
    const filtered = hasAtivaFlag
      ? normalized.filter((dir) => dir.ativa !== false)
      : normalized;

    saveDiretoriasCache(filtered);
    return filtered;
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  throw query.error;
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

export async function getDiretoriasComDetalhes() {
  const { data: diretorias, error: errDir } = await supabase
    .from("diretorias")
    .select("*")
    .eq("ativa", true)
    .order("sigla");

  if (errDir) throw errDir;

  // Para cada diretoria, buscar gerências e contar itens
  const diretoriasComDetalhes = await Promise.all(
    (diretorias || []).map(async (dir: unknown) => {
      const { data: gerencias } = await supabase
        .from("gerencias")
        .select("*")
        .eq("diretoria_id", (dir as { id: string }).id)
        .eq("ativa", true);

      const { count: totalItens, error: errSolicitacoes } = await supabase
        .from("solicitacoes")
        .select("id", { count: "exact", head: true })
        .eq("diretoria_id", (dir as { id: string }).id)
        .gt("qtd_estimada", 0);

      if (errSolicitacoes) throw errSolicitacoes;

      return {
        ...(dir as Diretoria),
        totalGerencias: (gerencias || []).length,
        totalItens: totalItens || 0,
      };
    })
  );

  return diretoriasComDetalhes;
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

export async function getTodosPeriodos() {
  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPeriodo(periodo: { nome: string; inicio: string; fim: string }) {
  const { data, error } = await supabase
    .from("periodos")
    .insert([{ ...periodo, ativo: false }])
    .select();

  if (error) throw error;
  return data?.[0];
}

export async function updatePeriodo(periodoId: string, updates: { nome?: string; inicio?: string; fim?: string; ativo?: boolean }) {
  const { data, error } = await supabase
    .from("periodos")
    .update(updates)
    .eq("id", periodoId)
    .select("*");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    const msg = "Atualizacao bloqueada. Verifique RLS/policies na tabela periodos.";
    throw new Error(msg);
  }

  return data[0];
}

export async function cleanupDuplicatePeriodos() {
  // Busca todos os períodos
  const { data: allPeriodos, error: fetchError } = await supabase
    .from("periodos")
    .select("*")
    .order("created_at", { ascending: true });

  if (fetchError) throw fetchError;
  if (!allPeriodos || allPeriodos.length <= 1) return true;

  // DELETA todos exceto o primeiro (o mais antigo)
  const todosExcetoPrimeiro = allPeriodos.slice(1);
  
  for (const periodo of todosExcetoPrimeiro) {
    const { error } = await supabase
      .from("periodos")
      .delete()
      .eq("id", periodo.id);
    if (error) throw error;
  }

  // Garante que o primeiro está ativo
  const { error: activateError } = await supabase
    .from("periodos")
    .update({ ativo: true })
    .eq("id", allPeriodos[0].id);

  if (activateError) throw activateError;
  return true;
}

// ============ SOLICITAÇÕES ============

export async function getSolicitacoesByGerencia(gerenciaId: string, periodoId: string) {
  const data = await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("solicitacoes")
      .select("*", includeCount ? { count: "exact" } : undefined)
      .eq("gerencia_id", gerenciaId)
      .eq("periodo_id", periodoId)
      .order("codigo")
      .range(from, to)
  );

  return data as PlanItem[];
}

export async function deleteSolicitacao(itemId: string) {
  const { error } = await supabase
    .from("solicitacoes")
    .delete()
    .eq("id", itemId);

  if (error) throw error;
  return true;
}

export async function deleteSolicitacoesBulk(itemIds: string[]) {
  const { error } = await supabase
    .from("solicitacoes")
    .delete()
    .in("id", itemIds);

  if (error) throw error;
  return true;
}

export async function getSolicitacoesByDiretoria(diretoriaId: string, periodoId: string) {
  const data = await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("solicitacoes")
      .select("*", includeCount ? { count: "exact" } : undefined)
      .eq("diretoria_id", diretoriaId)
      .eq("periodo_id", periodoId)
      .in("status", ["rascunho", "enviado", "em_analise", "aprovado", "rejeitado", "em_compra", "concluido"])
      .order("codigo")
      .range(from, to)
  );

  return data as PlanItem[];
}

export async function getSolicitacoesByPeriodo({ periodoId }: { periodoId: string; }) {
  const data = await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("solicitacoes")
      .select("*", includeCount ? { count: "exact" } : undefined)
      .eq("periodo_id", periodoId)
      .order("codigo")
      .range(from, to)
  );

  return data as PlanItem[];
}

export async function getSolicitacoesCompras(periodoId: string) {
  return await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("solicitacoes")
      .select("*, diretorias(sigla), gerencias(sigla)", includeCount ? { count: "exact" } : undefined)
      .eq("periodo_id", periodoId)
      .in("status", ["em_compra", "concluido"])
      .order("codigo")
      .range(from, to)
  );
}

export async function getServicosCompras(periodoId: string) {
  return await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("servicos")
      .select("*, diretorias(sigla), gerencias(sigla)", includeCount ? { count: "exact" } : undefined)
      .eq("periodo_id", periodoId)
      .in("status", ["em_compra", "concluido"])
      .order("item")
      .range(from, to)
  );
}

export async function createSolicitacao(solicitacao: Partial<PlanItem> & {
  periodo_id: string;
  diretoria_id: string;
  gerencia_id: string;
}) {
  const payload: Record<string, unknown> = {
    periodo_id: solicitacao.periodo_id,
    diretoria_id: solicitacao.diretoria_id,
    gerencia_id: solicitacao.gerencia_id,
    codigo: solicitacao.codigo,
    descricao: solicitacao.descricao,
    categoria: solicitacao.categoria,
    unidade: solicitacao.unidade,
    valor_unitario: solicitacao.valorUnitario ?? (solicitacao as unknown as { valor_unitario: number }).valor_unitario,
    qtd_estimada: solicitacao.qtdEstimada ?? (solicitacao as unknown as { qtd_estimada: number }).qtd_estimada,
    prioridade: solicitacao.prioridade,
    observacao: solicitacao.observacao,
    status: solicitacao.status,
  };

  const { data, error } = await supabase
    .from("solicitacoes")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data as PlanItem;
}

export async function updateSolicitacao(id: string, updates: Partial<PlanItem>) {
  // Converter camelCase para snake_case para o banco de dados
  const dbUpdates: Record<string, unknown> = {};
  
  if (updates.qtdEstimada !== undefined) dbUpdates.qtd_estimada = updates.qtdEstimada;
  if (updates.unidade !== undefined) dbUpdates.unidade = updates.unidade;
  if (updates.observacao !== undefined) dbUpdates.observacao = updates.observacao;
  if (updates.prioridade !== undefined) dbUpdates.prioridade = updates.prioridade;
  if (updates.valorUnitario !== undefined) dbUpdates.valor_unitario = updates.valorUnitario;
  if (updates.categoria !== undefined) dbUpdates.categoria = updates.categoria;
  if (updates.descricao !== undefined) dbUpdates.descricao = updates.descricao;
  
  const { data, error } = await supabase
    .from("solicitacoes")
    .update(dbUpdates)
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
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error("Código de acesso vazio");
  }

  // Segurança: validação ocorre somente na Edge Function.
  try {
    const { data, error } = await supabase.functions.invoke("validate-access-code", {
      body: { code: normalizedCode, scope },
    });

    if (error) {
      throw error;
    }

    if (data?.success && data?.access) {
      return {
        scope: data.access.scope,
        diretoria_id: data.access.diretoria_id,
        gerencia_id: data.access.gerencia_id,
        expired_at: data.access.expired_at,
      };
    }

    throw new Error(data?.error || "Invalid access code");
  } catch (edgeErr) {
    const fallbackMessage = String((edgeErr as unknown as { message?: string })?.message || "").toLowerCase();
    const fallbackName = String((edgeErr as unknown as { name?: string })?.name || "").toLowerCase();
    const isConnectivityIssue =
      fallbackName.includes("functionsfetcherror") ||
      fallbackName.includes("functionsfetch") ||
      fallbackMessage.includes("failed to fetch") ||
      fallbackMessage.includes("failed to send a request to the edge function") ||
      fallbackMessage.includes("function not found") ||
      fallbackMessage.includes("functions invoke") ||
      fallbackMessage.includes("network");

    if (!isConnectivityIssue) {
      console.error("Erro ao validar código via Edge Function:", edgeErr);
      throw edgeErr;
    }

    throw new Error(
      "Falha ao validar código com o servidor de autenticação. Verifique se a Edge Function validate-access-code está publicada."
    );
  }
}

// ============ ITENS CATÁLOGO ============

export default async function getItensCatalogo() {
  return await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("itens_catalogo")
      .select("*", includeCount ? { count: "exact" } : undefined)
      .order("codigo")
      .range(from, to)
  );
}

export async function getCategoryBudgetOwnerRules() {
  const { data, error } = await supabase
    .from("categoria_diretoria_orcamentaria")
    .select("categoria, diretoria_orcamentaria_id")
    .eq("ativo", true);

  if (error) throw error;

  const rules: Record<string, string> = {};
  (data || []).forEach((row: { categoria: string; diretoria_orcamentaria_id: string }) => {
    rules[row.categoria] = row.diretoria_orcamentaria_id;
  });

  return rules;
}

export async function getAdminMiniErpConfigDb() {
  const { data: orcamentos, error: orcamentosError } = await supabase
    .from("admin_orcamento_config")
    .select("escopo, referencia_id, tipo, valor");

  if (orcamentosError) throw orcamentosError;

  const { data: fluxos, error: fluxosError } = await supabase
    .from("admin_fluxo_config")
    .select("gerencia_id, destino_tipo, destino_id");

  if (fluxosError) throw fluxosError;

  const diretoriaBudgetsAquisicao: Record<string, number> = {};
  const diretoriaBudgetsServicos: Record<string, number> = {};
  const gerenciaBudgetsAquisicao: Record<string, number> = {};
  const gerenciaBudgetsServicos: Record<string, number> = {};

  (orcamentos || []).forEach((row: { escopo: string; referencia_id: string; tipo: string; valor: number }) => {
    const tipo = row.tipo as "aquisicao" | "servicos";
    const escopo = row.escopo as "diretoria" | "gerencia";
    const valor = Number(row.valor || 0);

    if (escopo === "diretoria" && tipo === "aquisicao") {
      diretoriaBudgetsAquisicao[row.referencia_id] = valor;
    }

    if (escopo === "diretoria" && tipo === "servicos") {
      diretoriaBudgetsServicos[row.referencia_id] = valor;
    }

    if (escopo === "gerencia" && tipo === "aquisicao") {
      gerenciaBudgetsAquisicao[row.referencia_id] = valor;
    }

    if (escopo === "gerencia" && tipo === "servicos") {
      gerenciaBudgetsServicos[row.referencia_id] = valor;
    }
  });

  const routingRules: Record<string, RoutingRule> = {};
  (fluxos || []).forEach((row: { gerencia_id: string; destino_tipo: string; destino_id: string }) => {
    routingRules[row.gerencia_id] = {
      destinoTipo: row.destino_tipo,
      destinoId: row.destino_id,
    };
  });

  const config: Partial<AdminBudgetConfig> = {
    diretoriaBudgetsAquisicao,
    diretoriaBudgetsServicos,
    gerenciaBudgetsAquisicao,
    gerenciaBudgetsServicos,
    routingRules,
    updatedAt: new Date().toISOString(),
  };

  return config;
}

export async function saveAdminMiniErpConfigDb(config: {
  diretoriaBudgetsAquisicao: Record<string, number>;
  diretoriaBudgetsServicos: Record<string, number>;
  gerenciaBudgetsAquisicao: Record<string, number>;
  gerenciaBudgetsServicos: Record<string, number>;
  routingRules: Record<string, RoutingRule>;
}) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada. Entre novamente no painel admin.");
  }

  const { data, error } = await supabase.functions.invoke("admin-upsert-mini-erp-config", {
    body: {
      accessCode: adminAccessCode,
      config,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

// ============ SERVIÇOS CATÁLOGO ============

export async function getServicosCatalogo() {
  return await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("servicos_catalogo")
      .select("*", includeCount ? { count: "exact" } : undefined)
      .order("item")
      .range(from, to)
  );
}

export async function createServicoCatalogoAndDistribuir(servico: {
  tipo_contratacao: string;
  objeto: string;
  justificativa: string;
  grau_prioridade: string;
  estimativa_valor: number;
  vinculacao: "Sim" | "Não";
  dependencia_descricao?: string;
  diretoria_id: string;
  gerencia_id: string;
  item: number;
}) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke("admin-create-servico-catalogo", {
    body: {
      accessCode: adminAccessCode,
      servico,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function updateServicoCatalogoAdmin(
  servicoId: string,
  updates: {
    tipo_contratacao: string;
    objeto: string;
    justificativa: string | null;
    grau_prioridade: string;
    estimativa_valor: number;
    vinculacao: "Sim" | "Não";
    dependencia_descricao: string | null;
    diretoria_id: string;
    gerencia_id: string;
  }
) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke("admin-update-servico-catalogo", {
    body: {
      accessCode: adminAccessCode,
      servicoId,
      updates,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function deleteServicoCatalogoAdmin(servicoId: string) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke("admin-delete-servico-catalogo", {
    body: {
      accessCode: adminAccessCode,
      servicoId,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function saveCategoryBudgetOwnerRules(rules: Record<string, string>) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada. Entre novamente no painel admin.");
  }

  // Filter out sentinel/default values like "__solicitante__" that are not real UUIDs
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const filteredRules = Object.fromEntries(
    Object.entries(rules).filter(([, v]) => uuidPattern.test(v))
  );

  const { data, error } = await supabase.functions.invoke("admin-upsert-category-budget-owners", {
    body: {
      accessCode: adminAccessCode,
      rules: filteredRules,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function createItemCatalogoAndDistribuir(item: {
  codigo: number;
  descricao: string;
  categoria: string;
  unidade: string;
  valorUnitario: number;
}) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada. Entre novamente no painel admin.");
  }

  const { data, error } = await supabase.functions.invoke("admin-create-catalog-item", {
    body: {
      accessCode: adminAccessCode,
      item: {
        codigo: item.codigo,
        descricao: item.descricao,
        categoria: item.categoria,
        unidade: item.unidade,
        valorUnitario: item.valorUnitario,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.item ?? data;
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

// ============ SERVIÇOS ============

export async function getServicosByGerencia(
  gerenciaId: string,
  periodoId: string
) {
  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("gerencia_id", gerenciaId)
    .eq("periodo_id", periodoId)
    .order("item");

  if (error) throw error;
  return data || [];
}

export async function getServicosByDiretoria(diretoriaId: string, periodoId: string) {
  return await fetchAllPages<unknown>((from, to, includeCount) =>
    supabase
      .from("servicos")
      .select(
        "*, gerencias(sigla, nome), diretorias(sigla, nome)",
        includeCount ? { count: "exact" } : undefined
      )
      .eq("diretoria_id", diretoriaId)
      .eq("periodo_id", periodoId)
      .order("item")
      .range(from, to)
  );
}

export async function updateServico(servicoId: string, updates: Partial<ServicoItem>) {
  const { data, error } = await supabase
    .from("servicos")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", servicoId)
    .select();

  if (error) throw error;
  return data?.[0];
}

export async function createServico(servico: Omit<ServicoItem, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from("servicos")
    .insert([servico])
    .select();

  if (error) throw error;
  return data?.[0];
}

export const deleteServico = async (id: string) => {
  const { error } = await supabase
    .from("servicos")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
};

// ============ ADMIN SERVIÇOS ============

/**
 * Função auxiliar para invocar funções admin com tratamento de erro padronizado
 */
async function invokeAdminFunction(functionName: string, body: any) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      const errorMsg = (error as any).message || "";
      if (errorMsg.includes("404")) {
        throw new Error(`A função '${functionName}' não foi encontrada. Verifique o deploy no Supabase.`);
      }
      throw error;
    }

    if (data?.error) throw new Error(data.error);
    return data;
  } catch (err: any) {
    const msg = err.message || "";
    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
      throw new Error(`Erro de rede ao tentar acessar a função '${functionName}'. Verifique sua conexão ou se a função está publicada.`);
    }
    throw err;
  }
}

export async function createServicoAdmin(item: Record<string, any>) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");
  
  // Envia o objeto dentro da chave 'item', idêntico ao fluxo de materiais
  return await invokeAdminFunction("admin-create-servico", { 
    accessCode: adminAccessCode, 
    item 
  });
}

export async function updateServicoAdmin(servicoId: string, item: Record<string, any>) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  return await invokeAdminFunction("admin-update-servico", { 
    accessCode: adminAccessCode, 
    servicoId, 
    item 
  });
}

export async function deleteServicoAdmin(servicoId: string) {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");
  return await invokeAdminFunction("admin-delete-servico", { 
    accessCode: adminAccessCode, 
    servicoId 
  });
}