// deno-lint-ignore-file no-explicit-any
import { supabase } from "./supabaseClient.ts";
import type {
  PlanItem,
  SolicitacaoStatus,
  ServicoItem,
  Diretoria,
} from "@/types/plan.ts";
import type { AdminBudgetConfig, RoutingRule } from "./adminBudgetConfig.ts";
import type {
  PostgrestSingleResponse,
} from "@supabase/supabase-js";

const SUPABASE_PAGE_SIZE = 1000;
const DIRETORIAS_CACHE_KEY = "pac2027:diretorias";
const DIRETORIAS_CACHE_TTL_MS = 10 * 60 * 1000;

interface DiretoriaRow {
  id: string;
  sigla: string;
  nome?: string;
  descricao?: string;
  ativa?: boolean;
}

interface CacheData<T> {
  updatedAt: number;
  data: T[];
}

function loadDiretoriasCache(): DiretoriaRow[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = globalThis.localStorage.getItem(DIRETORIAS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheData<DiretoriaRow>;
    if (!parsed?.updatedAt || !Array.isArray(parsed.data)) return null;

    const isFresh = Date.now() - parsed.updatedAt <= DIRETORIAS_CACHE_TTL_MS;
    return isFresh ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveDiretoriasCache(data: DiretoriaRow[]): void {
  if (typeof window === "undefined") return;

  try {
    globalThis.localStorage.setItem(
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
  ) => Promise<PostgrestSingleResponse<T[]>>
): Promise<T[]> {
  const CHUNK_SIZE = 5;
  const allRows: T[] = [];
  let currentFrom = 0;
  let hasMore = true;

  while (hasMore) {
    const promises = [];
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const start = currentFrom + i * SUPABASE_PAGE_SIZE;
      const end = start + SUPABASE_PAGE_SIZE - 1;
      promises.push(queryFactory(start, end, false).then(res => {
        if (res.error) throw res.error;
        return res.data || [];
      }));
    }
    
    const results = await Promise.all(promises);
    
    for (const rows of results) {
      allRows.push(...rows);
      if (rows.length < SUPABASE_PAGE_SIZE) {
        hasMore = false;
        break;
      }
    }
    
    // SAFETY LIMIT to prevent browser crashes (max ~2000 items)
    if (allRows.length >= 2000) {
      hasMore = false;
      break;
    }
    
    if (hasMore) {
      currentFrom += CHUNK_SIZE * SUPABASE_PAGE_SIZE;
    }
  }

  return allRows;
}

// ============ DIRETORIAS & GERÊNCIAS ============

export async function getDiretorias(): Promise<DiretoriaRow[]> {
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
    const hasAtivaFlag = normalized.some((dir) =>
      Object.prototype.hasOwnProperty.call(dir, "ativa")
    );
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

export async function getGerenciasByDiretoria(
  diretoriaId: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
    .eq("diretoria_id", diretoriaId)
    .eq("ativa", true)
    .order("sigla");

  if (error) throw error;
  return data || [];
}

export async function getTodasGerencias(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
    .order("sigla");

  if (error) throw error;
  return data || [];
}

export async function getDiretoriasComDetalhes(): Promise<
  (Diretoria & { totalGerencias: number; totalItens: number })[]
> {
  const { data: diretorias, error: errDir } = await supabase
    .from("diretorias")
    .select("*")
    .eq("ativa", true)
    .order("sigla");

  if (errDir) throw errDir;

  const diretoriasComDetalhes = await Promise.all(
    (diretorias || []).map(async (dir: unknown) => {
      const dirTyped = dir as Diretoria & { id: string };
      
      const { data: gerencias } = await supabase
        .from("gerencias")
        .select("*")
        .eq("diretoria_id", dirTyped.id)
        .eq("ativa", true);

      const { count: totalItens, error: errSolicitacoes } = await supabase
        .from("solicitacoes")
        .select("id", { count: "exact", head: true })
        .eq("diretoria_id", dirTyped.id)
        .gt("qtd_estimada", 0);

      if (errSolicitacoes) throw errSolicitacoes;

      return {
        ...dirTyped,
        totalGerencias: (gerencias || []).length,
        totalItens: totalItens || 0,
      };
    })
  );

  return diretoriasComDetalhes;
}

// ============ PERÍODOS ============

export async function getPeriodosAtivos(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .eq("ativo", true)
    .order("fim", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getTodosPeriodos(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createPeriodo(periodo: {
  nome: string;
  inicio: string;
  fim: string;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("periodos")
    .insert([{ ...periodo, ativo: false }])
    .select();

  if (error) throw error;
  return data?.[0] || {};
}

export async function updatePeriodo(
  periodoId: string,
  updates: {
    nome?: string;
    inicio?: string;
    fim?: string;
    ativo?: boolean;
  }
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("periodos")
    .update(updates)
    .eq("id", periodoId)
    .select("*");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    const msg =
      "Atualizacao bloqueada. Verifique RLS/policies na tabela periodos.";
    throw new Error(msg);
  }

  return data[0];
}

export async function cleanupDuplicatePeriodos(): Promise<boolean> {
  const { data: allPeriodos, error: fetchError } = await supabase
    .from("periodos")
    .select("*")
    .order("created_at", { ascending: true });

  if (fetchError) throw fetchError;
  if (!allPeriodos || allPeriodos.length <= 1) return true;

  const todosExcetoPrimeiro = allPeriodos.slice(1);

  for (const periodo of todosExcetoPrimeiro) {
    const periodoTyped = periodo as { id: string };
    const { error } = await supabase
      .from("periodos")
      .delete()
      .eq("id", periodoTyped.id);
    if (error) throw error;
  }

  const periodoFirst = allPeriodos[0] as { id: string };
  const { error: activateError } = await supabase
    .from("periodos")
    .update({ ativo: true })
    .eq("id", periodoFirst.id);

  if (activateError) throw activateError;
  return true;
}

// ============ SOLICITAÇÕES ============

export async function getSolicitacoesByGerencia(
  gerenciaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  const data = await fetchAllPages<PlanItem>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*")
      .eq("gerencia_id", gerenciaId)
      .eq("periodo_id", periodoId)
      .order("codigo")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<PlanItem[]>>
  );

  return data;
}

export async function deleteSolicitacao(itemId: string): Promise<boolean> {
  // Primeiro remove o histórico para evitar erros de restrição de chave estrangeira
  await supabase.from("solicitacao_historico").delete().eq("solicitacao_id", itemId);

  const { error } = await supabase
    .from("solicitacoes")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("Erro ao deletar solicitacao:", error);
    throw error;
  }
  return true;
}

export async function deleteSolicitacoesBulk(itemIds: string[]): Promise<boolean> {
  // Remove histórico em massa
  await supabase.from("solicitacao_historico").delete().in("solicitacao_id", itemIds);

  const { error } = await supabase
    .from("solicitacoes")
    .delete()
    .in("id", itemIds);

  if (error) {
    console.error("Erro ao deletar solicitacoes em massa:", error);
    throw error;
  }
  return true;
}

export async function getSolicitacoesByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  const data = await fetchAllPages<PlanItem>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*")
      .eq("diretoria_id", diretoriaId)
      .eq("periodo_id", periodoId)
      .in("status", [
        "rascunho",
        "enviado",
        "em_analise",
        "aprovado",
        "rejeitado",
        "em_compra",
        "concluido",
      ])
      .order("codigo")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<PlanItem[]>>
  );

  return data;
}

export async function getSolicitacoesByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<PlanItem[]> {
  const data = await fetchAllPages<PlanItem>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*")
      .eq("periodo_id", periodoId)
      .order("codigo")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<PlanItem[]>>
  );

  return data;
}

export async function getSolicitacoesCompras(
  periodoId: string
): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*, diretorias!fk_solicitacoes_diretoria(sigla), gerencias!fk_solicitacoes_gerencia(sigla)")
      .eq("periodo_id", periodoId)
      .in("status", ["em_compra", "concluido"])
      .order("codigo")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
  );
}

export async function getServicosCompras(periodoId: string): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>
    supabase
      .from("servicos")
      .select("*, diretorias!fk_servicos_diretoria(sigla), gerencias!fk_servicos_gerencia(sigla)")
      .eq("periodo_id", periodoId)
      .in("status", ["em_compra", "concluido"])
      .order("item")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
  );
}

export async function createSolicitacao(solicitacao: Partial<PlanItem> & {
  periodo_id: string;
  diretoria_id: string;
  gerencia_id: string;
}): Promise<PlanItem> {
  const payload: Record<string, unknown> = {
    periodo_id: solicitacao.periodo_id,
    diretoria_id: solicitacao.diretoria_id,
    gerencia_id: solicitacao.gerencia_id,
    codigo: solicitacao.codigo,
    descricao: solicitacao.descricao,
    categoria: solicitacao.categoria,
    unidade: solicitacao.unidade,
    valor_unitario:
      solicitacao.valorUnitario ??
      (solicitacao as unknown as { valor_unitario: number }).valor_unitario,
    qtd_estimada:
      solicitacao.qtdEstimada ??
      (solicitacao as unknown as { qtd_estimada: number }).qtd_estimada,
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

export async function updateSolicitacao(
  id: string,
  updates: Partial<PlanItem> | any
): Promise<PlanItem> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.qtdEstimada !== undefined) dbUpdates.qtd_estimada = updates.qtdEstimada;
  if (updates.unidade !== undefined) dbUpdates.unidade = updates.unidade;
  if (updates.observacao !== undefined) dbUpdates.observacao = updates.observacao;
  if (updates.prioridade !== undefined) dbUpdates.prioridade = updates.prioridade;
  if (updates.valorUnitario !== undefined)
    dbUpdates.valor_unitario = updates.valorUnitario;
  if (updates.categoria !== undefined) dbUpdates.categoria = updates.categoria;
  if (updates.descricao !== undefined) dbUpdates.descricao = updates.descricao;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.justificativa_rejeicao !== undefined) dbUpdates.justificativa_rejeicao = updates.justificativa_rejeicao;

  if (Object.keys(dbUpdates).length === 0) {
    return {} as PlanItem;
  }

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
): Promise<PlanItem> {
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

  if (data) {
    await logHistorico(id, status, justificativa);
  }

  return data as PlanItem;
}

export async function updateSolicitacaoStatusBulk(
  ids: string[],
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status };

  if (status === "enviado") {
    updates.enviado_em = new Date().toISOString();
  } else if (status === "aprovado") {
    updates.aprovado_em = new Date().toISOString();
  } else if (status === "rejeitado" && justificativa) {
    updates.justificativa_rejeicao = justificativa;
  }

  const { error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .in("id", ids);

  if (error) throw error;

  const historicoRecords = ids.map((id) => ({
    solicitacao_id: id,
    status_novo: status,
    acao: `Status alterado para ${status}`,
    autor_tipo: "sistema",
    justificativa: justificativa || null,
  }));

  const { error: histError } = await supabase
    .from("solicitacao_historico")
    .insert(historicoRecords);

  if (histError) console.error("Erro ao registrar histórico em lote:", histError);
}

export async function updateServicoStatusBulk(
  ids: string[],
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

  if (status === "rejeitado" && justificativa) {
    updates.justificativa_rejeicao = justificativa;
  }

  const { error } = await supabase
    .from("servicos")
    .update(updates)
    .in("id", ids);

  if (error) throw error;
}

// ============ HISTÓRICO ============

async function logHistorico(
  solicitacaoId: string,
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<void> {
  await supabase.from("solicitacao_historico").insert([
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

interface AccessCodeResponse {
  scope: string;
  diretoria_id?: string;
  gerencia_id?: string;
  expired_at?: string;
}

export async function validateAccessCode(
  code: string,
  scope: "diretoria" | "gerencia" | "admin" | "compras"
): Promise<AccessCodeResponse> {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error("Código de acesso vazio");
  }

  try {
    // Busca direta no banco de dados (ignorando a Edge Function)
    const { data, error } = await supabase
      .from("codigos_acesso")
      .select("*")
      .eq("ativo", true)
      .eq("scope", scope)
      .ilike("codigo_hash", normalizedCode)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      const match = data[0];
      
      // Verifica se expirou
      if (match.expira_em && new Date(match.expira_em) < new Date()) {
        throw new Error("Código de acesso expirado");
      }

      return {
        scope: match.scope,
        diretoria_id: match.diretoria_id,
        gerencia_id: match.gerencia_id,
        expired_at: match.expira_em,
      };
    }

    throw new Error("Invalid access code");
  } catch (err: any) {
    console.error("Erro ao validar código:", err);
    throw new Error(err.message || "Invalid access code");
  }
}

// ============ ITENS CATÁLOGO ============

export default async function getItensCatalogo(): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>
    supabase
      .from("itens_catalogo")
      .select("*")
      .order("codigo")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
  );
}

export async function getCategoryBudgetOwnerRules(): Promise<
  Record<string, string>
> {
  const { data, error } = await supabase
    .from("categoria_diretoria_orcamentaria")
    .select("categoria, diretoria_orcamentaria_id")
    .eq("ativo", true);

  if (error) throw error;

  const rules: Record<string, string> = {};
  (data || []).forEach(
    (row: { categoria: string; diretoria_orcamentaria_id: string }) => {
      rules[row.categoria] = row.diretoria_orcamentaria_id;
    }
  );

  return rules;
}

export async function getAdminMiniErpConfigDb() {
  const { data: orcamentos } = await supabase
    .from("admin_orcamento_config")
    .select("escopo, referencia_id, tipo, valor");

  const { data: fluxos } = await supabase
    .from("admin_fluxo_config")
    .select("gerencia_id, destino_tipo, destino_id");

  const { data: diretorias } = await supabase.from("diretorias").select("id");
  const { data: gerencias } = await supabase.from("gerencias").select("id");
  
  const validDiretoriaIds = new Set((diretorias || []).map(d => d.id));
  const validGerenciaIds = new Set((gerencias || []).map(g => g.id));

  const diretoriaBudgetsAquisicao: Record<string, number> = {};
  const diretoriaBudgetsServicos: Record<string, number> = {};
  const diretoriaBudgetsServicosNovos: Record<string, number> = {};
  const diretoriaBudgetsServicosExistentes: Record<string, number> = {};

  const gerenciaBudgetsAquisicao: Record<string, number> = {};
  const gerenciaBudgetsServicos: Record<string, number> = {};
  const gerenciaBudgetsServicosNovos: Record<string, number> = {};
  const gerenciaBudgetsServicosExistentes: Record<string, number> = {};

  (orcamentos || []).forEach(
    (row: {
      escopo: string;
      referencia_id: string;
      tipo: string;
      valor: number;
    }) => {
      const tipo = row.tipo;
      const escopo = row.escopo as "diretoria" | "gerencia";
      const valor = Number(row.valor || 0);

      if (escopo === "diretoria") {
        if (tipo === "aquisicao") diretoriaBudgetsAquisicao[row.referencia_id] = valor;
        if (tipo === "servicos") {
          // As servicos_novos uses the real UUID, and servicos_existentes uses the faked UUID
          // We will resolve this after gathering all rows because we need the list of real UUIDs.
          // For now we just put them all in servicosNovos, and later we'll move the fake ones.
          diretoriaBudgetsServicosNovos[row.referencia_id] = valor;
        }
      }

      if (escopo === "gerencia") {
        if (tipo === "aquisicao") gerenciaBudgetsAquisicao[row.referencia_id] = valor;
        if (tipo === "servicos") {
          gerenciaBudgetsServicosNovos[row.referencia_id] = valor;
        }
      }
    }
  );

  const getExistentesId = (id: string) => {
    const char = id.charAt(0);
    const replacements: Record<string, string> = {
      '0': 'f', '1': 'e', '2': 'd', '3': 'c', '4': 'b', '5': 'a', '6': '9', '7': '8',
      '8': '7', '9': '6', 'a': '5', 'b': '4', 'c': '3', 'd': '2', 'e': '1', 'f': '0'
    };
    return replacements[char] + id.slice(1);
  };

  // Move fake UUIDs to Existentes
  const allRealIds = new Set([
    ...Object.keys(diretoriaBudgetsAquisicao),
    ...Object.keys(gerenciaBudgetsAquisicao),
    // Or we could just iterate over what's currently in Novos
  ]);
  
  // A better way: iterate all keys in Novos. If getExistentesId(key) is also in Novos, or if the key itself looks like a fake of an existing real ID.
  // Actually, we can just compute the fake ID for every key. If we find it, we move it to Existentes.
  
  Object.keys(diretoriaBudgetsServicosNovos).forEach(id => {
    if (!validDiretoriaIds.has(id)) {
      // É um ID falso (Existentes)
      const realId = getExistentesId(id);
      diretoriaBudgetsServicosExistentes[realId] = diretoriaBudgetsServicosNovos[id];
      delete diretoriaBudgetsServicosNovos[id];
    }
  });

  Object.keys(gerenciaBudgetsServicosNovos).forEach(id => {
    if (!validGerenciaIds.has(id)) {
      // É um ID falso (Existentes)
      const realId = getExistentesId(id);
      gerenciaBudgetsServicosExistentes[realId] = gerenciaBudgetsServicosNovos[id];
      delete gerenciaBudgetsServicosNovos[id];
    }
  });

  const routingRules: Record<string, RoutingRule> = {};
  (fluxos || []).forEach(
    (row: { gerencia_id: string; destino_tipo: string; destino_id: string }) => {
      routingRules[row.gerencia_id] = {
        destinoTipo: row.destino_tipo as any,
        destinoId: row.destino_id,
      };
    }
  );

  const config: Partial<AdminBudgetConfig> = {
    diretoriaBudgetsAquisicao,
    diretoriaBudgetsServicos,
    diretoriaBudgetsServicosNovos,
    diretoriaBudgetsServicosExistentes,
    gerenciaBudgetsAquisicao,
    gerenciaBudgetsServicos,
    gerenciaBudgetsServicosNovos,
    gerenciaBudgetsServicosExistentes,
    routingRules,
    updatedAt: new Date().toISOString(),
  };

  return config;
}

export async function saveAdminMiniErpConfigDb(config: {
  diretoriaBudgetsAquisicao: Record<string, number>;
  diretoriaBudgetsServicos: Record<string, number>;
  diretoriaBudgetsServicosNovos: Record<string, number>;
  diretoriaBudgetsServicosExistentes: Record<string, number>;
  gerenciaBudgetsAquisicao: Record<string, number>;
  gerenciaBudgetsServicos: Record<string, number>;
  gerenciaBudgetsServicosNovos: Record<string, number>;
  gerenciaBudgetsServicosExistentes: Record<string, number>;
  routingRules: Record<string, RoutingRule>;
}): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error(
      "Sessão admin não encontrada. Entre novamente no painel admin."
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "admin-upsert-mini-erp-config",
    {
      body: {
        accessCode: adminAccessCode,
        config,
      },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

// ============ SERVIÇOS CATÁLOGO ============

export async function getServicosCatalogo(): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>
    supabase
      .from("servicos_catalogo")
      .select("*")
      .order("item")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
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
}): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error(
      "Sessão admin não encontrada. Faça login novamente no painel admin."
    );
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "admin-create-servico-catalogo",
      {
        body: {
          accessCode: adminAccessCode,
          servico: {
            tipo_contratacao: servico.tipo_contratacao,
            objeto: servico.objeto,
            justificativa: servico.justificativa,
            grau_prioridade: servico.grau_prioridade,
            estimativa_valor: Number(servico.estimativa_valor),
            vinculacao: servico.vinculacao,
            dependencia_descricao: servico.dependencia_descricao || null,
            diretoria_id: servico.diretoria_id,
            gerencia_id: servico.gerencia_id,
          },
        },
      }
    );

    if (error) {
      console.error("Erro na Edge Function:", error);
      const errorMessage = error.message || "Erro desconhecido na Edge Function";
      throw new Error(`Erro ao criar serviço: ${errorMessage}`);
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (!data?.success) {
      throw new Error(
        data?.message || "Falha ao criar serviço. Verifique os logs da Edge Function."
      );
    }

    return data;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("createServicoCatalogoAndDistribuir error:", errorMessage);
    throw new Error(`Falha ao criar serviço: ${errorMessage}`);
  }
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
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke(
    "admin-update-servico-catalogo",
    {
      body: {
        accessCode: adminAccessCode,
        servicoId,
        updates,
      },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function deleteServicoCatalogoAdmin(
  servicoId: string
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke(
    "admin-delete-servico-catalogo",
    {
      body: {
        accessCode: adminAccessCode,
        servicoId,
      },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function saveCategoryBudgetOwnerRules(
  rules: Record<string, string>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error(
      "Sessão admin não encontrada. Entre novamente no painel admin."
    );
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const filteredRules = Object.fromEntries(
    Object.entries(rules).filter(([, v]) => uuidPattern.test(v))
  );

  const { data, error } = await supabase.functions.invoke(
    "admin-upsert-category-budget-owners",
    {
      body: {
        accessCode: adminAccessCode,
        rules: filteredRules,
      },
    }
  );

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
}): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error(
      "Sessão admin não encontrada. Entre novamente no painel admin."
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "admin-create-catalog-item",
    {
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
    }
  );

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
): Promise<unknown[]> {
  const itens = await supabase
    .from("itens_catalogo")
    .select("*")
    .in("codigo", codigosCatalogo);

  if (itens.error) throw itens.error;

  const solicitacoes = (itens.data || []).map((item: unknown) => {
    const itemTyped = item as Record<string, unknown>;
    return {
      periodo_id: periodoId,
      diretoria_id: diretoriaId,
      gerencia_id: gerenciaId,
      codigo: itemTyped.codigo,
      descricao: itemTyped.descricao,
      categoria: itemTyped.categoria,
      unidade: itemTyped.unidade,
      valor_unitario: itemTyped.valor_unitario,
      qtd_estimada: 0,
      prioridade: "Média",
      status: "rascunho",
    };
  });

  const { data, error } = await supabase
    .from("solicitacoes")
    .insert(solicitacoes)
    .select();

  if (error) throw error;
  return data || [];
}

// ============ SERVIÇOS ============

function mapDbToServicoItem(row: any): ServicoItem {
  if (!row) return row;
  return {
    id: row.id,
    item: row.item,
    tipoContratacao: row.tipo_contratacao ?? row.tipoContratacao,
    unidadeDemandante: row.unidade_demandante ?? row.unidadeDemandante,
    objeto: row.objeto,
    justificativa: row.justificativa,
    previsaoInicio: row.previsao_inicio ?? row.previsaoInicio,
    estimativaValor: row.estimativa_valor ?? row.estimativaValor,
    dotacaoOrcamentaria: row.dotacao_orcamentaria ?? row.dotacaoOrcamentaria,
    grauPrioridade: row.grau_prioridade ?? row.grauPrioridade,
    vinculacao: row.vinculacao,
    dependenciaDescricao: row.dependencia_descricao ?? row.dependenciaDescricao,
    gerencia: row.gerencias?.sigla ?? row.gerencia ?? row.gerencia_id,
    diretoriaSigla: row.diretorias?.sigla ?? row.diretoriaSigla ?? row.diretoria_id,
    status: row.status,
    observacao: row.observacao,
    justificativaRejeicao: row.justificativa_rejeicao ?? row.justificativaRejeicao,
    justificativa_rejeicao: row.justificativa_rejeicao ?? row.justificativaRejeicao,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as ServicoItem;
}

function mapServicoItemToDb(item: any): any {
  if (!item) return item;
  const dbRow: any = {};
  
  if (item.id !== undefined) dbRow.id = item.id;
  if (item.item !== undefined) dbRow.item = item.item;
  
  const tipoContratacao = item.tipo_contratacao ?? item.tipoContratacao;
  if (tipoContratacao !== undefined) dbRow.tipo_contratacao = tipoContratacao;
  
  const unidadeDemandante = item.unidade_demandante ?? item.unidadeDemandante;
  if (unidadeDemandante !== undefined) dbRow.unidade_demandante = unidadeDemandante;
  
  if (item.objeto !== undefined) dbRow.objeto = item.objeto;
  if (item.justificativa !== undefined) dbRow.justificativa = item.justificativa;
  
  const previsaoInicio = item.previsao_inicio ?? item.previsaoInicio;
  if (previsaoInicio !== undefined) dbRow.previsao_inicio = previsaoInicio;
  
  const estimativaValor = item.estimativa_valor ?? item.estimativaValor;
  if (estimativaValor !== undefined) dbRow.estimativa_valor = estimativaValor;
  
  const dotacaoOrcamentaria = item.dotacao_orcamentaria ?? item.dotacaoOrcamentaria;
  if (dotacaoOrcamentaria !== undefined) dbRow.dotacao_orcamentaria = dotacaoOrcamentaria;
  
  const grauPrioridade = item.grau_prioridade ?? item.grauPrioridade;
  if (grauPrioridade !== undefined) dbRow.grau_prioridade = grauPrioridade;
  
  if (item.vinculacao !== undefined) dbRow.vinculacao = item.vinculacao;
  
  const dependenciaDescricao = item.dependencia_descricao ?? item.dependenciaDescricao;
  if (dependenciaDescricao !== undefined) dbRow.dependencia_descricao = dependenciaDescricao;
  
  if (item.gerencia_id !== undefined) dbRow.gerencia_id = item.gerencia_id;
  if (item.diretoria_id !== undefined) dbRow.diretoria_id = item.diretoria_id;
  if (item.periodo_id !== undefined) dbRow.periodo_id = item.periodo_id;
  if (item.status !== undefined) dbRow.status = item.status;
  if (item.observacao !== undefined) dbRow.observacao = item.observacao;
  
  if (item.created_at !== undefined) dbRow.created_at = item.created_at;
  if (item.updated_at !== undefined) dbRow.updated_at = item.updated_at;
  
  return dbRow;
}

export async function getServicosByGerencia(
  gerenciaId: string,
  periodoId: string
): Promise<ServicoItem[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("gerencia_id", gerenciaId)
    .eq("periodo_id", periodoId)
    .order("item");

  if (error) throw error;
  return (data || []).map(mapDbToServicoItem);
}

export async function getServicosCatalogoByGerencia(
  gerenciaId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("servicos_catalogo")
    .select("*")
    .or(`gerencia_id.eq.${gerenciaId},gerencia_id.is.null`);

  if (error) throw error;
  return data || [];
}

export async function getServicosByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<ServicoItem[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("servicos")
      .select(
        "*, gerencias!fk_servicos_gerencia(sigla, nome), diretorias!fk_servicos_diretoria(sigla, nome)"
      )
      .eq("diretoria_id", diretoriaId)
      .eq("periodo_id", periodoId)
      .order("item")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<any[]>>
  );
  return data.map(mapDbToServicoItem);
}

export async function updateServico(
  servicoId: string,
  updates: Partial<ServicoItem> | any
): Promise<ServicoItem | undefined> {
  const dbUpdates = mapServicoItemToDb(updates);
  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("servicos")
    .update(dbUpdates)
    .eq("id", servicoId)
    .select()
    .single();

  if (error) throw error;
  return data ? mapDbToServicoItem(data) : undefined;
}

export async function createServico(
  servico: Omit<ServicoItem, "id" | "created_at" | "updated_at"> | any
): Promise<ServicoItem | undefined> {
  const dbRow = mapServicoItemToDb(servico);
  const { data, error } = await supabase
    .from("servicos")
    .insert([dbRow])
    .select()
    .single();

  if (error) throw error;
  return data ? mapDbToServicoItem(data) : undefined;
}

export const deleteServico = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from("servicos").delete().eq("id", id);

  if (error) throw error;
  return true;
};

export async function deleteServicosBulk(itemIds: string[]): Promise<boolean> {
  const { error } = await supabase
    .from("servicos")
    .delete()
    .in("id", itemIds);

  if (error) {
    console.error("Erro ao deletar servicos em massa:", error);
    throw error;
  }
  return true;
}

export async function updateSolicitacoesBulkData(
  ids: string[],
  updates: Partial<PlanItem>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.qtdEstimada !== undefined) dbUpdates.qtd_estimada = updates.qtdEstimada;
  if (updates.unidade !== undefined) dbUpdates.unidade = updates.unidade;
  if (updates.observacao !== undefined) dbUpdates.observacao = updates.observacao;
  if (updates.prioridade !== undefined) dbUpdates.prioridade = updates.prioridade;
  if (updates.valorUnitario !== undefined) dbUpdates.valor_unitario = updates.valorUnitario;
  if (updates.categoria !== undefined) dbUpdates.categoria = updates.categoria;
  if (updates.descricao !== undefined) dbUpdates.descricao = updates.descricao;

  if (Object.keys(dbUpdates).length === 0) return;

  const { error } = await supabase
    .from("solicitacoes")
    .update(dbUpdates)
    .in("id", ids);

  if (error) throw error;
}

export async function updateServicosBulkData(
  ids: string[],
  updates: Partial<ServicoItem> | any
): Promise<void> {
  const dbUpdates = mapServicoItemToDb(updates);
  dbUpdates.updated_at = new Date().toISOString();
  delete dbUpdates.id;

  if (Object.keys(dbUpdates).length <= 1) return; 

  const { error } = await supabase
    .from("servicos")
    .update(dbUpdates)
    .in("id", ids);

  if (error) throw error;
}

// ============ ADMIN SERVIÇOS ============

/**
 * Função auxiliar para invocar funções admin com tratamento de erro padronizado
 */
async function invokeAdminFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<unknown> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      const errorMsg = (error as { message?: string }).message || "";
      if (errorMsg.includes("404")) {
        throw new Error(
          `A função '${functionName}' não foi encontrada. Verifique o deploy no Supabase.`
        );
      }
      throw error;
    }

    if (data?.error) throw new Error(data.error as string);
    return data;
  } catch (err: unknown) {
    const error = err as { message?: string };
    const msg = error.message || "";
    if (
      msg.toLowerCase().includes("failed to fetch") ||
      msg.toLowerCase().includes("network")
    ) {
      throw new Error(
        `Erro de rede ao tentar acessar a função '${functionName}'. Verifique sua conexão ou se a função está publicada.`
      );
    }
    throw err;
  }
}

export async function createServicoAdmin(
  item: Record<string, unknown>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  return await invokeAdminFunction("admin-create-servico", {
    accessCode: adminAccessCode,
    item,
  });
}

export async function updateServicoAdmin(
  servicoId: string,
  item: Record<string, unknown>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  return await invokeAdminFunction("admin-update-servico", {
    accessCode: adminAccessCode,
    servicoId,
    item,
  });
}

export async function deleteServicoAdmin(servicoId: string): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  return await invokeAdminFunction("admin-delete-servico", {
    accessCode: adminAccessCode,
    servicoId,
  });
}

export async function updateItemCatalogoAdmin(
  itemId: string,
  updates: Partial<{
    codigo: number;
    descricao: string;
    categoria: string;
    unidade: string;
    valor_unitario: number;
  }>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke(
    "admin-update-catalog-item",
    {
      body: {
        accessCode: adminAccessCode,
        itemId,
        updates,
      },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function deleteItemCatalogoAdmin(
  itemId: string
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");

  if (!adminAccessCode) {
    throw new Error("Sessão admin não encontrada.");
  }

  const { data, error } = await supabase.functions.invoke(
    "admin-delete-catalog-item",
    {
      body: {
        accessCode: adminAccessCode,
        itemId,
      },
    }
  );

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function criarOrcamento(
  diretoriaId: string,
  tipo: "aquisicao" | "servicos",
  retidoDiretoria: number,
  repassesGerencias: Record<string, number>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  const { data, error } = await supabase.functions.invoke("criarOrcamento", {
    body: {
      accessCode: adminAccessCode,
      diretoriaId,
      tipo,
      retidoDiretoria,
      repassesGerencias,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function enviarOrcamento(
  diretoriaId: string,
  tipo: "aquisicao" | "servicos",
  retidoDiretoria: number,
  repassesGerencias: Record<string, number>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  const { data, error } = await supabase.functions.invoke("enviarOrcamento", {
    body: {
      accessCode: adminAccessCode,
      diretoriaId,
      tipo,
      retidoDiretoria,
      repassesGerencias,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function deletarOrcamento(
  diretoriaId: string,
  tipo: "aquisicao" | "servicos",
  gerenciasIds: string[]
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  const { data, error } = await supabase.functions.invoke("deletarOrcamento", {
    body: {
      accessCode: adminAccessCode,
      diretoriaId,
      tipo,
      gerenciasIds,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ============ DADOS 2026 (EXCEL via Edge Function c/ Fallback) ============
export async function getDadosExcel2026() {
  try {
    const { data, error } = await supabase.functions.invoke("get-excel-2026");
    if (!error && data && !data.error) {
      return {
        previstoData: data.previstoData || [],
        realizadoData: data.realizadoData || [],
        orcamentoData: data.orcamentoData || []
      };
    }
    console.warn("Edge Function falhou ou não foi implantada. Usando fallback no lado do cliente...");
  } catch (err) {
    console.warn("Erro ao invocar Edge Function, usando fallback no lado do cliente...", err);
  }

  // Fallback: faz o processamento no lado do cliente
  const XLSX = await import("xlsx-js-style");
  const res = await fetch("https://docs.google.com/spreadsheets/d/1seIaYVZ1D06jPZm9O7yzXbW8hi8tgV2OzBHguyNrfMY/export?format=xlsx");
  if (!res.ok) throw new Error("Erro ao baixar planilha do Google Sheets (2026) via cliente");
  
  const blob = await res.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const previstoData = workbook.Sheets['previsto'] ? XLSX.utils.sheet_to_json(workbook.Sheets['previsto']) : [];
  const realizadoData = workbook.Sheets['realizado'] ? XLSX.utils.sheet_to_json(workbook.Sheets['realizado']) : [];
  const orcamentoData = workbook.Sheets['orcamento'] ? XLSX.utils.sheet_to_json(workbook.Sheets['orcamento']) : [];
  
  return { previstoData, realizadoData, orcamentoData };
}