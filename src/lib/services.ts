// deno-lint-ignore-file no-explicit-any
import { supabase } from "./supabaseClient.ts";
import type {
  PlanItem,
  SolicitacaoStatus,
  ServicoItem,
  Diretoria,
} from "@/types/plan.ts";
import type {
  RestricaoAtividade,
  ActivityPermissionContext,
  PermissionCheckResult,
  ModuloTipo,
  AtividadeTipo,
  StatusRestricao,
  EscopoTipo,
} from "@/types/restricoes.ts";
import type { AdminBudgetConfig, RoutingRule } from "./adminBudgetConfig.ts";
import type {
  PostgrestSingleResponse,
} from "@supabase/supabase-js";

const SUPABASE_PAGE_SIZE = 1000;

export async function registrarLogAtividade(
  acao: string,
  tabelaAfetada: string,
  registroId: string,
  detalhes?: any
) {
  try {
    let accessCode = "";
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/admin")) {
        accessCode = sessionStorage.getItem("access-code:admin") || "";
      } else if (path.includes("/gerencia/")) {
        accessCode = sessionStorage.getItem("access-code:gerencia") || "";
      } else if (path.startsWith("/diretoria")) {
        accessCode = sessionStorage.getItem("access-code:diretoria") || "";
      } else if (path.startsWith("/compras")) {
        accessCode = sessionStorage.getItem("access-code:compras") || "";
      } else {
        accessCode = 
          sessionStorage.getItem("access-code:admin") || 
          sessionStorage.getItem("access-code:diretoria") || 
          sessionStorage.getItem("access-code:gerencia") || 
          sessionStorage.getItem("access-code:compras") || 
          "";
      }
    }

    const matricula = (accessCode.startsWith("admin") || accessCode.startsWith("compras"))
      ? accessCode 
      : (accessCode.replace(/\D/g, "") || "desconhecido");

    // Upsert to ensure FK constraint is satisfied without overwriting existing names
    await supabase.from("funcionarios").upsert([{
      matricula,
      nome: `Usuário ${matricula}`
    }], { onConflict: 'matricula', ignoreDuplicates: true });

    await supabase.from("logs_atividades").insert([{
      matricula,
      acao,
      tabela_afetada: tabelaAfetada,
      registro_id: registroId,
      detalhes: typeof detalhes === 'object' ? JSON.stringify(detalhes) : detalhes
    }]);
  } catch (error) {
    console.error("Falha ao registrar log de atividade:", error);
  }
}

export async function registrarLogAtividadeBulk(
  acao: string,
  tabelaAfetada: string,
  registrosIds: string[],
  detalhes?: any
) {
  if (registrosIds.length === 0) return;
  try {
    let accessCode = "";
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/admin")) {
        accessCode = sessionStorage.getItem("access-code:admin") || "";
      } else if (path.includes("/gerencia/")) {
        accessCode = sessionStorage.getItem("access-code:gerencia") || "";
      } else if (path.startsWith("/diretoria")) {
        accessCode = sessionStorage.getItem("access-code:diretoria") || "";
      } else if (path.startsWith("/compras")) {
        accessCode = sessionStorage.getItem("access-code:compras") || "";
      } else {
        accessCode = 
          sessionStorage.getItem("access-code:admin") || 
          sessionStorage.getItem("access-code:diretoria") || 
          sessionStorage.getItem("access-code:gerencia") || 
          sessionStorage.getItem("access-code:compras") || 
          "";
      }
    }
    const matricula = (accessCode.startsWith("admin") || accessCode.startsWith("compras"))
      ? accessCode 
      : (accessCode.replace(/\D/g, "") || "desconhecido");

    // Upsert to ensure FK constraint is satisfied without overwriting existing names
    await supabase.from("funcionarios").upsert([{
      matricula,
      nome: `Usuário ${matricula}`
    }], { onConflict: 'matricula', ignoreDuplicates: true });

    const payload = registrosIds.map(id => ({
      matricula,
      acao,
      tabela_afetada: tabelaAfetada,
      registro_id: id,
      detalhes: typeof detalhes === 'object' ? JSON.stringify(detalhes) : detalhes
    }));

    await supabase.from("logs_atividades").insert(payload);
  } catch (error) {
    console.error("Falha ao registrar logs de atividades em lote:", error);
  }
}
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
    
    // SAFETY LIMIT removido a pedido do usuário para carregar todos os itens
    // if (allRows.length >= 50000) {
    //   hasMore = false;
    //   break;
    // }
    
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

export async function getAllGerencias(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
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

  if (data && data[0]) {
    await registrarLogAtividade("CRIAR", "periodos", data[0].id, { periodo: periodo });
  }

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

  await registrarLogAtividade("EDITAR", "periodos", periodoId, { updates });

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
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*, item:itens_catalogo!solicitacoes_item_id_fkey(codigo, descricao, categoria, unidade, valor_unitario)")
      .eq("gerencia_id", gerenciaId)
      .eq("periodo_id", periodoId)
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<any[]>>
  );

  return data.map((s: any) => ({
    id: s.id,
    item_id: s.item_id,
    codigo: s.item?.codigo ?? (s.codigo ? Number(s.codigo) : 0),
    descricao: s.descricao || s.item?.descricao || "",
    categoria: s.categoria || s.item?.categoria || "diversos",
    unidade: s.unidade || s.item?.unidade || "un",
    valorUnitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    valor_unitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    qtdEstimada: s.qtd_estimada ?? 0,
    qtd_estimada: s.qtd_estimada ?? 0,
    prioridade: s.prioridade || "Baixa",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
    justificativaRejeicao: s.justificativa_rejeicao || "",
    justificativa_rejeicao: s.justificativa_rejeicao || "",
    gerencia: s.gerencias?.sigla || "",
    gerencia_id: s.gerencia_id,
    diretoria_id: s.diretoria_id,
    periodo_id: s.periodo_id,
    created_at: s.created_at,
    updated_at: s.updated_at,
  } as unknown as PlanItem));
}

export async function deleteSolicitacao(itemId: string | number): Promise<boolean> {
  if (!itemId) throw new Error("ID inválido para exclusão");

  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  const idStr = String(itemId);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

  let targetId = idStr;
  if (!isUuid) {
    const { data } = await supabase
      .from("solicitacoes")
      .select("id")
      .eq("codigo", Number(itemId))
      .maybeSingle();
    if (data?.id) {
      targetId = data.id;
    }
  }

  await supabase.from("solicitacao_historico").delete().eq("solicitacao_id", targetId);
  await supabase.from("aprovacao").delete().eq("referencia_id", targetId);
  await supabase.from("log_orcamentario").delete().eq("referencia_id", targetId);

  let { error } = await supabase
    .from("solicitacoes")
    .delete()
    .eq("id", targetId);

  if (error && !isUuid) {
    const res = await supabase.from("solicitacoes").delete().eq("codigo", Number(itemId));
    error = res.error;
  }

  if (error) {
    console.error("Erro ao deletar solicitacao:", error);
    throw error;
  }
  
  await registrarLogAtividade("EXCLUIR", "solicitacoes", targetId);
  
  return true;
}

export async function deleteSolicitacoesBulk(itemIds: (string | number)[]): Promise<boolean> {
  if (!itemIds || itemIds.length === 0) return false;

  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  const stringIds = itemIds.map(String);
  const uuidIds = stringIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const numericItems = itemIds.filter(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))).map(Number);

  if (numericItems.length > 0) {
    const { data } = await supabase
      .from("solicitacoes")
      .select("id")
      .in("codigo", numericItems);
    if (data) {
      data.forEach((r: any) => {
        if (r?.id && !uuidIds.includes(r.id)) {
          uuidIds.push(r.id);
        }
      });
    }
  }

  if (uuidIds.length > 0) {
    await supabase.from("solicitacao_historico").delete().in("solicitacao_id", uuidIds);
    await supabase.from("aprovacao").delete().in("referencia_id", uuidIds);
    await supabase.from("log_orcamentario").delete().in("referencia_id", uuidIds);

    const { error } = await supabase
      .from("solicitacoes")
      .delete()
      .in("id", uuidIds);

    if (error) {
      console.error("Erro ao deletar solicitacoes em massa:", error);
      throw error;
    }
  }

  if (numericItems.length > 0) {
    await supabase.from("solicitacoes").delete().in("codigo", numericItems);
  }
  
  await registrarLogAtividade("EXCLUIR", "solicitacoes", "BULK", { ids: itemIds });
  
  return true;
}

export async function getSolicitacoesByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*, item:itens_catalogo!solicitacoes_item_id_fkey(codigo, descricao, categoria, unidade, valor_unitario), gerencias!fk_solicitacoes_gerencia(sigla, nome), diretorias!fk_solicitacoes_diretoria(sigla, nome)")
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
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<PlanItem[]>>
  );

  return data.map((s: any) => ({
    id: s.id,
    item_id: s.item_id,
    codigo: s.item?.codigo ?? (s.codigo ? Number(s.codigo) : 0),
    descricao: s.descricao || s.item?.descricao || "",
    categoria: s.categoria || s.item?.categoria || "diversos",
    unidade: s.unidade || s.item?.unidade || "un",
    valorUnitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    valor_unitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    qtdEstimada: s.qtd_estimada ?? 0,
    qtd_estimada: s.qtd_estimada ?? 0,
    prioridade: s.prioridade || "Média",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
    justificativaRejeicao: s.justificativa_rejeicao || "",
    justificativa_rejeicao: s.justificativa_rejeicao || "",
    gerencia: s.gerencias?.sigla || "N/A",
    gerencia_id: s.gerencia_id,
    diretoria_id: s.diretoria_id,
    diretoriaSigla: s.diretorias?.sigla,
    periodo_id: s.periodo_id,
    created_at: s.created_at,
    updated_at: s.updated_at,
  } as PlanItem));
}

export async function getSolicitacoesByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<PlanItem[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*, item:itens_catalogo!solicitacoes_item_id_fkey(codigo, descricao, categoria, unidade, valor_unitario), gerencias!fk_solicitacoes_gerencia(sigla, nome), diretorias!fk_solicitacoes_diretoria(sigla, nome)")
      .eq("periodo_id", periodoId)
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<PlanItem[]>>
  );

  return data.map((s: any) => ({
    id: s.id,
    item_id: s.item_id,
    codigo: s.item?.codigo ?? (s.codigo ? Number(s.codigo) : 0),
    descricao: s.descricao || s.item?.descricao || "",
    categoria: s.categoria || s.item?.categoria || "diversos",
    unidade: s.unidade || s.item?.unidade || "un",
    valorUnitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    valor_unitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    qtdEstimada: s.qtd_estimada ?? 0,
    qtd_estimada: s.qtd_estimada ?? 0,
    prioridade: s.prioridade || "Média",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
    justificativaRejeicao: s.justificativa_rejeicao || "",
    justificativa_rejeicao: s.justificativa_rejeicao || "",
    gerencia: s.gerencias?.sigla || "N/A",
    gerencia_id: s.gerencia_id,
    diretoria_id: s.diretoria_id,
    diretoriaSigla: s.diretorias?.sigla,
    periodo_id: s.periodo_id,
    created_at: s.created_at,
    updated_at: s.updated_at,
  } as PlanItem));
}

export async function getServicosByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("servicos")
      .select("*")
      .eq("periodo_id", periodoId)
      .order("item")
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<any[]>>
  );

  return data;
}

export async function getSolicitacoesResumoByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("id, status, gerencia_id, diretoria_id, valor_unitario, qtd_estimada, categoria, created_at")
      .eq("periodo_id", periodoId)
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<any[]>>
  );

  return data;
}

export async function getServicosResumoByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("servicos")
      .select("id, status, gerencia_id, diretoria_id, tipo_contratacao, estimativa_valor, categoria, created_at")
      .eq("periodo_id", periodoId)
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<any[]>>
  );

  return data;
}


export async function getSolicitacoesCompras(
  periodoId: string
): Promise<unknown[]> {
  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*, item:itens_catalogo!solicitacoes_item_id_fkey(codigo, descricao, categoria, unidade, valor_unitario), diretorias!fk_solicitacoes_diretoria(sigla), gerencias!fk_solicitacoes_gerencia(sigla)")
      .eq("periodo_id", periodoId)
      .in("status", ["aprovado", "em_compra", "concluido"])
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
  );

  return data.map((s: any) => ({
    id: s.id,
    item_id: s.item_id,
    codigo: s.item?.codigo ?? (s.codigo ? Number(s.codigo) : 0),
    descricao: s.descricao || s.item?.descricao || "",
    categoria: s.categoria || s.item?.categoria || "diversos",
    unidade: s.unidade || s.item?.unidade || "un",
    valor_unitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    valorUnitario: s.valor_unitario ?? s.item?.valor_unitario ?? 0,
    qtd_estimada: s.qtd_estimada ?? 0,
    qtdEstimada: s.qtd_estimada ?? 0,
    prioridade: s.prioridade || "Média",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
    justificativa_rejeicao: s.justificativa_rejeicao || "",
    justificativaRejeicao: s.justificativa_rejeicao || "",
    gerencia_id: s.gerencia_id,
    diretoria_id: s.diretoria_id,
    periodo_id: s.periodo_id,
    gerencias: s.gerencias,
    diretorias: s.diretorias,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
}

export async function getServicosCompras(periodoId: string): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>
    supabase
      .from("servicos")
      .select("*, diretorias!fk_servicos_diretoria(sigla), gerencias!fk_servicos_gerencia(sigla)")
      .eq("periodo_id", periodoId)
      .in("status", ["aprovado", "em_compra", "concluido"])
      .order("item")
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
  );
}

export async function createSolicitacao(solicitacao: Partial<PlanItem> & {
  periodo_id: string;
  diretoria_id: string;
  gerencia_id: string;
  item_id?: string;
}): Promise<PlanItem> {
  await assertActivityAllowed({
    periodoId: solicitacao.periodo_id,
    gerenciaId: solicitacao.gerencia_id,
    diretoriaId: solicitacao.diretoria_id,
    modulo: "aquisicao",
    atividade: "adicionar_item",
  });

  let itemId = solicitacao.item_id;
  if (!itemId && solicitacao.codigo) {
    const { data: itemData } = await supabase
      .from("itens_catalogo")
      .select("id, valor_unitario")
      .eq("codigo", solicitacao.codigo)
      .maybeSingle();
    if (itemData) {
      itemId = itemData.id;
    }
  }

  const payload: Record<string, unknown> = {
    periodo_id: solicitacao.periodo_id,
    diretoria_id: solicitacao.diretoria_id,
    gerencia_id: solicitacao.gerencia_id,
    item_id: itemId,
    valor_unitario:
      solicitacao.valorUnitario ??
      (solicitacao as unknown as { valor_unitario: number }).valor_unitario ?? 0,
    qtd_estimada:
      solicitacao.qtdEstimada ??
      (solicitacao as unknown as { qtd_estimada: number }).qtd_estimada ?? 0,
    prioridade: solicitacao.prioridade || "Baixa",
    observacao: solicitacao.observacao || null,
    status: solicitacao.status || "rascunho",
  };

  const { data, error } = await supabase
    .from("solicitacoes")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  
  await registrarLogAtividade("CRIAR", "solicitacoes", data.id, payload);

  return {
    id: data.id,
    item_id: data.item_id,
    codigo: solicitacao.codigo ? Number(solicitacao.codigo) : 0,
    descricao: solicitacao.descricao || "",
    categoria: solicitacao.categoria || "diversos",
    unidade: solicitacao.unidade || "un",
    valorUnitario: data.valor_unitario ?? (solicitacao.valorUnitario || 0),
    qtdEstimada: data.qtd_estimada,
    prioridade: data.prioridade,
    observacao: data.observacao,
    status: data.status,
    gerencia: "",
    gerencia_id: data.gerencia_id,
    diretoria_id: data.diretoria_id,
    periodo_id: data.periodo_id,
  } as unknown as PlanItem;
}

export async function updateSolicitacao(
  id: string,
  updates: Partial<PlanItem> | any
): Promise<PlanItem> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.qtdEstimada !== undefined) dbUpdates.qtd_estimada = updates.qtdEstimada;
  if (updates.qtd_estimada !== undefined) dbUpdates.qtd_estimada = updates.qtd_estimada;
  if (updates.observacao !== undefined) dbUpdates.observacao = updates.observacao;
  if (updates.prioridade !== undefined) dbUpdates.prioridade = updates.prioridade;
  if (updates.valorUnitario !== undefined) dbUpdates.valor_unitario = updates.valorUnitario;
  if (updates.valor_unitario !== undefined) dbUpdates.valor_unitario = updates.valor_unitario;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.justificativa_rejeicao !== undefined) dbUpdates.justificativa_rejeicao = updates.justificativa_rejeicao;
  if (updates.justificativaRejeicao !== undefined) dbUpdates.justificativa_rejeicao = updates.justificativaRejeicao;
  if (updates.item_id !== undefined) dbUpdates.item_id = updates.item_id;

  if (Object.keys(dbUpdates).length === 0 && updates.descricao === undefined && updates.unidade === undefined) {
    return {} as PlanItem;
  }

  // Validação de restrição para campos específicos se informados
  if (dbUpdates.qtd_estimada !== undefined) {
    await assertActivityAllowed({ modulo: "aquisicao", atividade: "alterar_quantidade" });
  }
  if (dbUpdates.prioridade !== undefined) {
    await assertActivityAllowed({ modulo: "aquisicao", atividade: "alterar_prioridade" });
  }
  if (dbUpdates.observacao !== undefined) {
    await assertActivityAllowed({ modulo: "aquisicao", atividade: "adicionar_observacao" });
  }

  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("solicitacoes")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  if (updates.descricao !== undefined || updates.unidade !== undefined) {
    try {
      const catUpdates: Record<string, unknown> = {};
      if (updates.descricao !== undefined) catUpdates.descricao = updates.descricao;
      if (updates.unidade !== undefined) catUpdates.unidade = updates.unidade;

      if (data.item_id) {
        await supabase.from("itens_catalogo").update(catUpdates).eq("id", data.item_id);
      } else if (updates.codigo) {
        await supabase.from("itens_catalogo").update(catUpdates).eq("codigo", updates.codigo);
      }
    } catch (e) {
      console.warn("Não foi possível atualizar itens_catalogo:", e);
    }
  }
  
  await registrarLogAtividade("EDITAR", "solicitacoes", id, dbUpdates);
  
  return {
    id: data.id,
    item_id: data.item_id,
    codigo: updates.codigo ? Number(updates.codigo) : 0,
    descricao: updates.descricao || "",
    categoria: updates.categoria || "diversos",
    unidade: updates.unidade || "un",
    valorUnitario: data.valor_unitario ?? 0,
    qtdEstimada: data.qtd_estimada,
    prioridade: data.prioridade,
    observacao: data.observacao,
    status: data.status,
    justificativaRejeicao: data.justificativa_rejeicao,
    gerencia: "",
    gerencia_id: data.gerencia_id,
    diretoria_id: data.diretoria_id,
    periodo_id: data.periodo_id,
  } as unknown as PlanItem;
}

export async function updateSolicitacaoStatus(
  id: string,
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<PlanItem> {
  let atividade: AtividadeTipo = "editar_item";
  if (status === "enviado") atividade = "enviar_solicitacao";
  else if (status === "aprovado") atividade = "aprovar";
  else if (status === "rejeitado") atividade = "reprovar";
  else if (status === "rascunho") atividade = "devolver_solicitacao";
  else if (status === "em_compra") atividade = "enviar_compras";

  const { data: solData } = await supabase
    .from("solicitacoes")
    .select("periodo_id, gerencia_id, diretoria_id")
    .eq("id", id)
    .maybeSingle();

  if (solData) {
    await assertActivityAllowed({
      periodoId: solData.periodo_id,
      gerenciaId: solData.gerencia_id,
      diretoriaId: solData.diretoria_id,
      modulo: "aquisicao",
      atividade,
    });
  }

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

    const valorTotal = (data.qtd_estimada || 0) * (data.valor_unitario || 0);
    if (status === "enviado") {
      await registrarLogOrcamentario(id, data.diretoria_id, 'reservar', valorTotal);
    } else if (status === "aprovado") {
      await registrarLogOrcamentario(id, data.diretoria_id, 'estornar_reserva', valorTotal);
      await registrarLogOrcamentario(id, data.diretoria_id, 'executar', valorTotal);
    } else if (status === "rejeitado") {
      await registrarLogOrcamentario(id, data.diretoria_id, 'estornar_reserva', valorTotal);
    }
  }

  await registrarLogAtividade("EDITAR", "solicitacoes", id, { acao: "updateSolicitacaoStatus", status_novo: status, justificativa });

  return data as PlanItem;
}

export async function updateSolicitacaoStatusBulk(
  ids: string[],
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<void> {
  let atividade: AtividadeTipo = "edicao_em_lote";
  if (status === "enviado") atividade = "enviar_solicitacao";
  else if (status === "aprovado") atividade = "aprovar";
  else if (status === "rejeitado") atividade = "reprovar";
  else if (status === "rascunho") atividade = "devolver_solicitacao";
  else if (status === "em_compra") atividade = "enviar_compras";

  // Pega dados originais para o log orçamentário e checagem de permissão
  const { data: originais } = await supabase
    .from("solicitacoes")
    .select("id, periodo_id, gerencia_id, diretoria_id, qtd_estimada, valor_unitario")
    .in("id", ids);

  if (originais && originais[0]) {
    await assertActivityAllowed({
      periodoId: originais[0].periodo_id,
      gerenciaId: originais[0].gerencia_id,
      diretoriaId: originais[0].diretoria_id,
      modulo: "aquisicao",
      atividade,
    });
  }

  const updates: Record<string, unknown> = { 
    status,
    updated_at: new Date().toISOString()
  };

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

  // Registrar histórico e logs orçamentários em lote de forma resiliente
  if (originais) {
    const logsToInsert: {
      solicitacaoId: string;
      diretoriaId: string;
      acao: 'reservar' | 'estornar_reserva' | 'executar' | 'estornar_execucao';
      valor: number;
    }[] = [];

    for (const item of originais) {
      const valorTotal = (item.qtd_estimada || 0) * (item.valor_unitario || 0);
      if (status === "enviado") {
        logsToInsert.push({ solicitacaoId: item.id, diretoriaId: item.diretoria_id, acao: 'reservar', valor: valorTotal });
      } else if (status === "aprovado") {
        logsToInsert.push({ solicitacaoId: item.id, diretoriaId: item.diretoria_id, acao: 'estornar_reserva', valor: valorTotal });
        logsToInsert.push({ solicitacaoId: item.id, diretoriaId: item.diretoria_id, acao: 'executar', valor: valorTotal });
      } else if (status === "rejeitado") {
        logsToInsert.push({ solicitacaoId: item.id, diretoriaId: item.diretoria_id, acao: 'estornar_reserva', valor: valorTotal });
      }
    }

    if (logsToInsert.length > 0) {
      try {
        await registrarLogsOrcamentariosBulk(logsToInsert);
      } catch (logErr) {
        console.warn("Aviso ao registrar logs orçamentários em lote:", logErr);
      }
    }
  }

  try {
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

    if (histError) console.warn("Aviso ao registrar histórico em lote:", histError);
  } catch (histErr) {
    console.warn("Aviso ao registrar histórico:", histErr);
  }

  try {
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacaoStatusBulk", status_novo: status, justificativa });
  } catch (actErr) {
    console.warn("Aviso ao registrar log de atividade:", actErr);
  }
}

export async function updateServicoStatusBulk(
  ids: string[],
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<void> {
  let atividade: AtividadeTipo = "edicao_em_lote";
  if (status === "enviado") atividade = "enviar_solicitacao";
  else if (status === "aprovado") atividade = "aprovar";
  else if (status === "rejeitado") atividade = "reprovar";
  else if (status === "rascunho") atividade = "devolver_solicitacao";
  else if (status === "em_compra") atividade = "enviar_compras";

  const { data: originais } = await supabase
    .from("servicos")
    .select("id, periodo_id, gerencia_id, diretoria_id, tipo_contratacao")
    .in("id", ids);

  if (originais && originais[0]) {
    const isNovo = originais[0].tipo_contratacao === "Novo";
    await assertActivityAllowed({
      periodoId: originais[0].periodo_id,
      gerenciaId: originais[0].gerencia_id,
      diretoriaId: originais[0].diretoria_id,
      modulo: isNovo ? "servicos_novos" : "servicos_existentes",
      atividade,
    });
  }

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };

  if (status === "rejeitado" && justificativa) {
    updates.justificativa_rejeicao = justificativa;
  }

  const { error } = await supabase
    .from("servicos")
    .update(updates)
    .in("id", ids);

  if (error) throw error;

  await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicoStatusBulk", status_novo: status, justificativa });
}

// ============ HISTÓRICO ============

async function logHistorico(
  solicitacaoId: string,
  status: SolicitacaoStatus,
  justificativa?: string
): Promise<void> {
  try {
    const { error } = await supabase.from("solicitacao_historico").insert([
      {
        solicitacao_id: solicitacaoId,
        status_novo: status,
        acao: `Status alterado para ${status}`,
        autor_tipo: "sistema",
        justificativa: justificativa,
      },
    ]);
    if (error) console.warn("Aviso ao registrar histórico:", error);
  } catch (err) {
    console.warn("Falha ao registrar histórico:", err);
  }
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
  const diretoriaBudgetsOrcamentoGeral: Record<string, number> = {};
  const gerenciaBudgetsOrcamentoGeral: Record<string, number> = {};

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
        if (tipo === "orcamento_geral") diretoriaBudgetsOrcamentoGeral[row.referencia_id] = valor;
        if (tipo === "servicos") {
          // As servicos_novos uses the real UUID, and servicos_existentes uses the faked UUID
          // We will resolve this after gathering all rows because we need the list of real UUIDs.
          // For now we just put them all in servicosNovos, and later we'll move the fake ones.
          diretoriaBudgetsServicosNovos[row.referencia_id] = valor;
        }
      }

      if (escopo === "gerencia") {
        if (tipo === "aquisicao") gerenciaBudgetsAquisicao[row.referencia_id] = valor;
        if (tipo === "orcamento_geral") gerenciaBudgetsOrcamentoGeral[row.referencia_id] = valor;
        if (tipo === "servicos") {
          gerenciaBudgetsServicosNovos[row.referencia_id] = valor;
        }
      }
    }
  );

  const invertChar = (c: string) => {
    const map: Record<string, string> = {
      '0': 'f', '1': 'e', '2': 'd', '3': 'c', '4': 'b', '5': 'a', '6': '9', '7': '8',
      '8': '7', '9': '6', 'a': '5', 'b': '4', 'c': '3', 'd': '2', 'e': '1', 'f': '0'
    };
    return map[c] || c;
  };

  const getExistentesId = (id: string) => invertChar(id.charAt(0)) + id.slice(1);
  const getGeralId = (id: string) => id.charAt(0) + invertChar(id.charAt(1)) + id.slice(2);

  // Move fake UUIDs to Existentes and Geral
  Object.keys(diretoriaBudgetsServicosNovos).forEach(id => {
    if (!validDiretoriaIds.has(id)) {
      const realId = getExistentesId(id);
      diretoriaBudgetsServicosExistentes[realId] = diretoriaBudgetsServicosNovos[id];
      delete diretoriaBudgetsServicosNovos[id];
    }
  });

  Object.keys(gerenciaBudgetsServicosNovos).forEach(id => {
    if (!validGerenciaIds.has(id)) {
      const realId = getExistentesId(id);
      gerenciaBudgetsServicosExistentes[realId] = gerenciaBudgetsServicosNovos[id];
      delete gerenciaBudgetsServicosNovos[id];
    }
  });

  Object.keys(diretoriaBudgetsAquisicao).forEach(id => {
    if (!validDiretoriaIds.has(id)) {
      const realId = getGeralId(id);
      diretoriaBudgetsOrcamentoGeral[realId] = diretoriaBudgetsAquisicao[id];
      delete diretoriaBudgetsAquisicao[id];
    }
  });

  Object.keys(gerenciaBudgetsAquisicao).forEach(id => {
    if (!validGerenciaIds.has(id)) {
      const realId = getGeralId(id);
      gerenciaBudgetsOrcamentoGeral[realId] = gerenciaBudgetsAquisicao[id];
      delete gerenciaBudgetsAquisicao[id];
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
    diretoriaBudgetsOrcamentoGeral,
    gerenciaBudgetsAquisicao,
    gerenciaBudgetsServicos,
    gerenciaBudgetsServicosNovos,
    gerenciaBudgetsServicosExistentes,
    gerenciaBudgetsOrcamentoGeral,
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
  diretoriaBudgetsOrcamentoGeral?: Record<string, number>;
  gerenciaBudgetsAquisicao: Record<string, number>;
  gerenciaBudgetsServicos: Record<string, number>;
  gerenciaBudgetsServicosNovos: Record<string, number>;
  gerenciaBudgetsServicosExistentes: Record<string, number>;
  gerenciaBudgetsOrcamentoGeral?: Record<string, number>;
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

  
  await registrarLogAtividade("EDITAR", "configuracoes", "admin-mini-erp-config", { acao: "saveAdminMiniErpConfigDb" });

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
  contrato?: string | null;
  contratada?: string | null;
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
            contrato: servico.contrato || null,
            contratada: servico.contratada || null,
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
    contrato?: string | null;
    contratada?: string | null;
    dependencia_descricao: string | null;
    diretoria_id: string;
    gerencia_id: string;
    item?: number;
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

  
  await registrarLogAtividade("EDITAR", "servicos_catalogo", servicoId, { acao: "updateServicoCatalogoAdmin", updates });

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

  await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId, { acao: "deleteServicoCatalogoAdmin" });

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

  await registrarLogAtividade("EDITAR", "configuracoes", "category_budget_owner_rules", { acao: "saveCategoryBudgetOwnerRules" });

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
    contrato: row.contrato,
    contratada: row.contratada,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } as ServicoItem;
}

function mapServicoItemToDb(item: any): any {
  if (!item) return item;
  const dbRow: any = {};
  
  if (item.id !== undefined) dbRow.id = item.id;
  if (item.item !== undefined) dbRow.item = item.item;
  if (item.item_id !== undefined) dbRow.item_id = item.item_id;
  
  const tipoContratacao = item.tipo_contratacao ?? item.tipoContratacao;
  if (tipoContratacao !== undefined) dbRow.tipo_contratacao = tipoContratacao;
  
  const unidadeDemandante = item.unidade_demandante ?? item.unidadeDemandante;
  if (unidadeDemandante !== undefined) dbRow.unidade_demandante = unidadeDemandante;
  
  if (item.objeto !== undefined) dbRow.objeto = item.objeto;
  if (item.justificativa !== undefined) dbRow.justificativa = item.justificativa;
  
  const previsaoInicio = item.previsao_inicio ?? item.previsaoInicio;
  if (previsaoInicio !== undefined) {
    dbRow.previsao_inicio = previsaoInicio === "" ? null : previsaoInicio;
  }
  
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
  if (item.contrato !== undefined) dbRow.contrato = item.contrato;
  if (item.contratada !== undefined) dbRow.contratada = item.contratada;
  
  const justificativaRejeicao = item.justificativa_rejeicao ?? item.justificativaRejeicao;
  if (justificativaRejeicao !== undefined) dbRow.justificativa_rejeicao = justificativaRejeicao;
  
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
  const isNovo = (updates.tipo_contratacao || updates.tipoContratacao) === "Novo";
  const modulo: ModuloTipo = isNovo ? "servicos_novos" : "servicos_existentes";

  if (updates.dotacao_orcamentaria !== undefined || updates.dotacaoOrcamentaria !== undefined || updates.estimativa_valor !== undefined || updates.estimativaValor !== undefined) {
    await assertActivityAllowed({ modulo, atividade: "alterar_valor" });
  }
  if (updates.grau_prioridade !== undefined || updates.grauPrioridade !== undefined) {
    await assertActivityAllowed({ modulo, atividade: "alterar_prioridade" });
  }
  if (updates.observacao !== undefined) {
    await assertActivityAllowed({ modulo, atividade: "adicionar_observacao" });
  }

  const dbUpdates = mapServicoItemToDb(updates);
  dbUpdates.updated_at = new Date().toISOString();
  delete dbUpdates.id;

  const { data, error } = await supabase
    .from("servicos")
    .update(dbUpdates)
    .eq("id", servicoId)
    .select()
    .single();

  if (error) throw error;
  
  await registrarLogAtividade("EDITAR", "servicos", servicoId, dbUpdates);
  
  return data ? mapDbToServicoItem(data) : undefined;
}

export async function createServico(
  servico: Omit<ServicoItem, "id" | "created_at" | "updated_at"> | any
): Promise<ServicoItem | undefined> {
  const isNovo = (servico.tipo_contratacao || servico.tipoContratacao) === "Novo";
  const modulo: ModuloTipo = isNovo ? "servicos_novos" : "servicos_existentes";
  const atividade: AtividadeTipo = isNovo ? "adicionar_novo_servico" : "adicionar_servico";

  await assertActivityAllowed({
    periodoId: servico.periodo_id || servico.periodoId,
    gerenciaId: servico.gerencia_id || servico.gerenciaId,
    diretoriaId: servico.diretoria_id || servico.diretoriaId,
    modulo,
    atividade,
  });

  const dbRow = mapServicoItemToDb(servico);
  const { data, error } = await supabase
    .from("servicos")
    .insert([dbRow])
    .select()
    .single();

  if (error) throw error;
  
  await registrarLogAtividade("CRIAR", "servicos", data.id, dbRow);
  
  return data ? mapDbToServicoItem(data) : undefined;
}

export const deleteServico = async (idOrItem: string | number): Promise<boolean> => {
  if (!idOrItem) throw new Error("ID inválido para exclusão");

  const idStr = String(idOrItem);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);

  let targetId = idStr;
  if (!isUuid) {
    const { data } = await supabase
      .from("servicos")
      .select("id, tipo_contratacao, gerencia_id, diretoria_id, periodo_id")
      .eq("item", Number(idOrItem))
      .maybeSingle();
    if (data?.id) {
      targetId = data.id;
      const isNovo = data.tipo_contratacao === "Novo";
      await assertActivityAllowed({
        periodoId: data.periodo_id,
        gerenciaId: data.gerencia_id,
        diretoriaId: data.diretoria_id,
        modulo: isNovo ? "servicos_novos" : "servicos_existentes",
        atividade: "excluir_servico",
      });
    }
  } else {
    await assertActivityAllowed({
      modulo: "servicos_existentes",
      atividade: "excluir_servico",
    });
  }

  await supabase.from("solicitacao_historico").delete().eq("solicitacao_id", targetId);
  await supabase.from("log_orcamentario").delete().eq("referencia_id", targetId);
  await supabase.from("aprovacao").delete().eq("referencia_id", targetId);

  let { error } = await supabase.from("servicos").delete().eq("id", targetId);
  if (error && !isUuid) {
    const res = await supabase.from("servicos").delete().eq("item", Number(idOrItem));
    error = res.error;
  }

  if (error) throw error;
  
  await registrarLogAtividade("EXCLUIR", "servicos", targetId);
  
  return true;
};

export async function deleteServicosBulk(itemIds: (string | number)[]): Promise<boolean> {
  if (!itemIds || itemIds.length === 0) return false;

  await assertActivityAllowed({
    modulo: "servicos_existentes",
    atividade: "excluir_servico",
  });

  const stringIds = itemIds.map(String);
  const uuidIds = stringIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  const numericItems = itemIds.filter(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))).map(Number);

  if (numericItems.length > 0) {
    const { data } = await supabase
      .from("servicos")
      .select("id")
      .in("item", numericItems);
    if (data) {
      data.forEach((r: any) => {
        if (r?.id && !uuidIds.includes(r.id)) {
          uuidIds.push(r.id);
        }
      });
    }
  }

  if (uuidIds.length > 0) {
    await supabase.from("solicitacao_historico").delete().in("solicitacao_id", uuidIds);
    await supabase.from("log_orcamentario").delete().in("referencia_id", uuidIds);
    await supabase.from("aprovacao").delete().in("referencia_id", uuidIds);

    const { error } = await supabase
      .from("servicos")
      .delete()
      .in("id", uuidIds);

    if (error) {
      console.error("Erro ao deletar servicos em massa:", error);
      throw error;
    }
  }

  if (numericItems.length > 0) {
    await supabase.from("servicos").delete().in("item", numericItems);
  }
  
  await registrarLogAtividade("EXCLUIR", "servicos", "BULK", { ids: itemIds });
  
  return true;
}

export async function updateSolicitacoesBulkData(
  ids: string[],
  updates: Partial<PlanItem> | any
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.qtdEstimada !== undefined) dbUpdates.qtd_estimada = updates.qtdEstimada;
  if (updates.qtd_estimada !== undefined) dbUpdates.qtd_estimada = updates.qtd_estimada;
  if (updates.observacao !== undefined) dbUpdates.observacao = updates.observacao;
  if (updates.prioridade !== undefined) dbUpdates.prioridade = updates.prioridade;
  if (updates.valorUnitario !== undefined) dbUpdates.valor_unitario = updates.valorUnitario;
  if (updates.valor_unitario !== undefined) dbUpdates.valor_unitario = updates.valor_unitario;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.justificativa_rejeicao !== undefined) dbUpdates.justificativa_rejeicao = updates.justificativa_rejeicao;
  if (updates.justificativaRejeicao !== undefined) dbUpdates.justificativa_rejeicao = updates.justificativaRejeicao;

  if (Object.keys(dbUpdates).length === 0) return;

  dbUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("solicitacoes")
    .update(dbUpdates)
    .in("id", ids);

  if (error) {
    console.error("Erro ao atualizar solicitacoes em massa:", error);
    throw error;
  }

  await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacoesBulkData", updates: dbUpdates });
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

  await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicosBulkData", updates: dbUpdates });
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

  
  await registrarLogAtividade("EDITAR", "itens_catalogo", itemId, { acao: "updateItemCatalogoAdmin", updates });

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

  await registrarLogAtividade("EXCLUIR", "itens_catalogo", itemId, { acao: "deleteItemCatalogoAdmin" });

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
  
  await registrarLogAtividade("CRIAR", "admin_orcamento_config", diretoriaId, { acao: "criarOrcamento", tipo, retidoDiretoria });

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
  
  await registrarLogAtividade("EDITAR", "admin_orcamento_config", diretoriaId, { acao: "enviarOrcamento", tipo, retidoDiretoria });

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
  
  await registrarLogAtividade("EXCLUIR", "admin_orcamento_config", diretoriaId, { acao: "deletarOrcamento", tipo, gerenciasIds });

  return data;
}

export async function getLogsAtividades() {
  const { data, error } = await supabase
    .from("logs_atividades")
    .select("*")
    .is("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLixeiraLogsAtividades() {
  const { data, error } = await supabase
    .from("logs_atividades")
    .select("*")
    .eq("is_deleted", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFuncionariosNomes() {
  const { data, error } = await supabase
    .from("funcionarios")
    .select("matricula, nome, diretoria_id, gerencia_id");

  if (error) {
    console.error("Erro ao buscar funcionários:", error);
    return [];
  }
  return data || [];
}

export async function registrarLogOrcamentario(
  solicitacaoId: string,
  diretoriaId: string,
  acao: 'reservar' | 'estornar_reserva' | 'executar' | 'estornar_execucao',
  valor: number
) {
  try {
    // 1. Achar o centro_custo da diretoria
    const { data: centros, error: centroError } = await supabase
      .from("centro_custo")
      .select("id")
      .eq("diretoria_id", diretoriaId)
      .eq("ativo", true)
      .limit(1);

    if (centroError) throw centroError;
    if (!centros || centros.length === 0) {
      console.warn(`Nenhum centro de custo ativo encontrado para a diretoria ${diretoriaId}`);
      return;
    }

    const centroCustoId = centros[0].id;
    const anoAtual = new Date().getFullYear();

    // 2. Inserir no log_orcamentario
    const { error: logError } = await supabase
      .from("log_orcamentario")
      .insert([{
        ano: 2026, // Forçando 2026 para os testes de PAC 2027 que ocorrem em 2026
        centro_custo_id: centroCustoId,
        referencia_tipo: 'solicitacao',
        referencia_id: solicitacaoId,
        acao,
        valor
      }]);

    if (logError) throw logError;
    
    console.log(`Log orçamentário registrado: ${acao} de R$ ${valor} na solicitação ${solicitacaoId}`);
  } catch (err) {
    console.error("Falha ao registrar log orçamentário:", err);
  }
}

export async function registrarLogsOrcamentariosBulk(
  logs: {
    solicitacaoId: string;
    diretoriaId: string;
    acao: 'reservar' | 'estornar_reserva' | 'executar' | 'estornar_execucao';
    valor: number;
  }[]
) {
  if (logs.length === 0) return;

  try {
    const uniqueDiretoriaIds = Array.from(new Set(logs.map(log => log.diretoriaId)));

    const { data: centros, error: centroError } = await supabase
      .from("centro_custo")
      .select("id, diretoria_id")
      .in("diretoria_id", uniqueDiretoriaIds)
      .eq("ativo", true);

    if (centroError) throw centroError;

    const centroMap = new Map<string, string>();
    if (centros) {
      for (const c of centros) {
        centroMap.set(c.diretoria_id, c.id);
      }
    }

    const recordsToInsert = [];
    for (const log of logs) {
      const centroCustoId = centroMap.get(log.diretoriaId);
      if (!centroCustoId) {
        console.warn(`Nenhum centro de custo ativo encontrado para a diretoria ${log.diretoriaId} (Item: ${log.solicitacaoId})`);
        continue;
      }

      recordsToInsert.push({
        ano: 2026, // Forçando 2026 para os testes de PAC 2027 que ocorrem em 2026
        centro_custo_id: centroCustoId,
        referencia_tipo: 'solicitacao',
        referencia_id: log.solicitacaoId,
        acao: log.acao,
        valor: log.valor
      });
    }

    if (recordsToInsert.length > 0) {
      const { error: logError } = await supabase
        .from("log_orcamentario")
        .insert(recordsToInsert);

      if (logError) {
        console.warn("Aviso ao inserir log_orcamentario:", logError);
      }
    }
  } catch (err) {
    console.warn("Falha ao registrar logs orçamentários em lote:", err);
  }
}

export async function deleteLogAtividade(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("logs_atividades")
    .update({ is_deleted: true })
    .eq("id", id);
  if (error) {
    console.error("Erro ao enviar log para lixeira:", error);
    throw error;
  }
  return true;
}

export async function deleteLogsAtividadeBulk(ids: string[]) {
  const { error } = await supabase
    .from("logs_atividades")
    .update({ is_deleted: true })
    .in("id", ids);

  if (error) {
    console.error("Erro ao enviar logs para lixeira em massa:", error);
    throw error;
  }
}

export async function restoreLogAtividade(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("logs_atividades")
    .update({ is_deleted: false })
    .eq("id", id);
  if (error) {
    console.error("Erro ao restaurar log:", error);
    throw error;
  }
  return true;
}

export async function restoreLogsAtividadeBulk(ids: string[]) {
  const { error } = await supabase
    .from("logs_atividades")
    .update({ is_deleted: false })
    .in("id", ids);

  if (error) {
    console.error("Erro ao restaurar logs em massa:", error);
    throw error;
  }
}

export async function hardDeleteLogAtividade(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("logs_atividades")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Erro ao deletar log permanentemente:", error);
    throw error;
  }
  return true;
}

export async function hardDeleteLogsAtividadeBulk(ids: string[]) {
  const { error } = await supabase
    .from("logs_atividades")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("Erro ao excluir logs permanentemente em massa:", error);
    throw error;
  }
}

export async function getRecordDetails(tableName: string, id: string) {
  if (!tableName || !id) return null;
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", id)
    .single();
    
  if (error) {
    console.error(`Erro ao buscar detalhes de ${tableName} com ID ${id}:`, error);
    return null;
  }
  return data;
}

export async function updateLogAtividade(id: string, updates: any): Promise<boolean> {
  const { error } = await supabase
    .from("logs_atividades")
    .update(updates)
    .eq("id", id);
  if (error) {
    console.error("Erro ao atualizar log:", error);
    throw error;
  }
  return true;
}

export async function updateLogsAtividadeBulk(ids: string[], updates: any): Promise<boolean> {
  const { error } = await supabase
    .from("logs_atividades")
    .update(updates)
    .in("id", ids);
  if (error) {
    console.error("Erro ao atualizar logs em massa:", error);
    throw error;
  }
  return true;
}

// --------------------------------------------------------------------------------
// LOGS ORÇAMENTÁRIOS (Admin CRUD)
// --------------------------------------------------------------------------------

export async function getLogsOrcamentarios(): Promise<any[]> {
  const { data, error } = await supabase
    .from("log_orcamentario")
    .select(`
      *,
      centro_custo:centro_custo_id(codigo, nome, diretoria_id)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar logs orçamentários:", error);
    throw error;
  }
  return data || [];
}

export async function deleteLogOrcamentario(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("log_orcamentario")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Erro ao deletar log orçamentário:", error);
    throw error;
  }
  return true;
}

export async function deleteLogsOrcamentarioBulk(ids: string[]): Promise<boolean> {
  const { error } = await supabase
    .from("log_orcamentario")
    .delete()
    .in("id", ids);
  if (error) {
    console.error("Erro ao deletar logs orçamentários em massa:", error);
    throw error;
  }
  return true;
}

export async function updateLogOrcamentario(id: string, updates: any): Promise<boolean> {
  const { error } = await supabase
  .from("log_orcamentario")
  .update(updates)
  .eq("id", id);
  if (error) {
    console.error("Erro ao atualizar log orçamentário:", error);
    throw error;
  }
  return true;
}

// --------------------------------------------------------------------------------
// RESTRIÇÕES DE ATIVIDADES (Admin & Motor de Permissões)
// --------------------------------------------------------------------------------

export async function getRestricoesAtividades(
  periodoId?: string
): Promise<RestricaoAtividade[]> {
  let query = supabase
    .from("restricoes_atividades")
    .select(`
      *,
      periodos:periodo_id(nome),
      diretorias:diretoria_id(sigla),
      gerencias:gerencia_id(sigla)
    `)
    .order("created_at", { ascending: false });

  if (periodoId) {
    query = query.eq("periodo_id", periodoId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar restrições de atividades:", error);
    throw error;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    periodo_id: r.periodo_id,
    escopo_tipo: r.escopo_tipo,
    diretoria_id: r.diretoria_id,
    gerencia_id: r.gerencia_id,
    perfil: r.perfil,
    modulo: r.modulo,
    atividade: r.atividade,
    status: r.status,
    ativo: r.ativo,
    observacao: r.observacao,
    criado_por: r.criado_por,
    created_at: r.created_at,
    updated_at: r.updated_at,
    periodo_nome: r.periodos?.nome || "",
    diretoria_sigla: r.diretorias?.sigla || "",
    gerencia_sigla: r.gerencias?.sigla || "",
  }));
}

export async function createRestricaoAtividade(
  payload: Omit<RestricaoAtividade, "id" | "created_at" | "updated_at" | "periodo_nome" | "diretoria_sigla" | "gerencia_sigla">
): Promise<RestricaoAtividade> {
  const insertPayload = {
    periodo_id: payload.periodo_id,
    escopo_tipo: payload.escopo_tipo,
    diretoria_id: payload.diretoria_id || null,
    gerencia_id: payload.gerencia_id || null,
    perfil: payload.perfil || null,
    modulo: payload.modulo,
    atividade: payload.atividade,
    status: payload.status,
    ativo: payload.ativo !== undefined ? payload.ativo : true,
    observacao: payload.observacao || null,
    criado_por: payload.criado_por || null,
  };

  const { data, error } = await supabase
    .from("restricoes_atividades")
    .insert([insertPayload])
    .select(`
      *,
      periodos:periodo_id(nome),
      diretorias:diretoria_id(sigla),
      gerencias:gerencia_id(sigla)
    `)
    .single();

  if (error) {
    console.error("Erro ao criar restrição de atividade:", error);
    throw error;
  }

  await registrarLogAtividade("CRIAR", "restricoes_atividades", data.id, {
    modulo: data.modulo,
    atividade: data.atividade,
    status: data.status,
    escopo_tipo: data.escopo_tipo,
    diretoria_sigla: data.diretorias?.sigla,
    gerencia_sigla: data.gerencias?.sigla,
    periodo_nome: data.periodos?.nome,
    observacao: data.observacao,
  });

  return {
    ...data,
    periodo_nome: data.periodos?.nome || "",
    diretoria_sigla: data.diretorias?.sigla || "",
    gerencia_sigla: data.gerencias?.sigla || "",
  };
}

export async function createRestricoesAtividadesBulk(
  items: Array<Omit<RestricaoAtividade, "id" | "created_at" | "updated_at" | "periodo_nome" | "diretoria_sigla" | "gerencia_sigla">>
): Promise<boolean> {
  if (!items || items.length === 0) return true;

  const insertPayloads = items.map((payload) => ({
    periodo_id: payload.periodo_id,
    escopo_tipo: payload.escopo_tipo,
    diretoria_id: payload.diretoria_id || null,
    gerencia_id: payload.gerencia_id || null,
    perfil: payload.perfil || null,
    modulo: payload.modulo,
    atividade: payload.atividade,
    status: payload.status,
    ativo: payload.ativo !== undefined ? payload.ativo : true,
    observacao: payload.observacao || null,
    criado_por: payload.criado_por || null,
  }));

  const { error } = await supabase
    .from("restricoes_atividades")
    .insert(insertPayloads);

  if (error) {
    console.error("Erro ao criar restrições em lote:", error);
    throw error;
  }

  return true;
}

export async function updateRestricaoAtividade(
  id: string,
  updates: Partial<RestricaoAtividade>
): Promise<RestricaoAtividade> {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.periodo_id !== undefined) updatePayload.periodo_id = updates.periodo_id;
  if (updates.escopo_tipo !== undefined) updatePayload.escopo_tipo = updates.escopo_tipo;
  if (updates.diretoria_id !== undefined) updatePayload.diretoria_id = updates.diretoria_id || null;
  if (updates.gerencia_id !== undefined) updatePayload.gerencia_id = updates.gerencia_id || null;
  if (updates.perfil !== undefined) updatePayload.perfil = updates.perfil || null;
  if (updates.modulo !== undefined) updatePayload.modulo = updates.modulo;
  if (updates.atividade !== undefined) updatePayload.atividade = updates.atividade;
  if (updates.status !== undefined) updatePayload.status = updates.status;
  if (updates.ativo !== undefined) updatePayload.ativo = updates.ativo;
  if (updates.observacao !== undefined) updatePayload.observacao = updates.observacao || null;

  const { data, error } = await supabase
    .from("restricoes_atividades")
    .update(updatePayload)
    .eq("id", id)
    .select(`
      *,
      periodos:periodo_id(nome),
      diretorias:diretoria_id(sigla),
      gerencias:gerencia_id(sigla)
    `)
    .single();

  if (error) {
    console.error("Erro ao atualizar restrição de atividade:", error);
    throw error;
  }

  await registrarLogAtividade("EDITAR", "restricoes_atividades", id, {
    modulo: data.modulo,
    atividade: data.atividade,
    status: data.status,
    ativo: data.ativo,
    escopo_tipo: data.escopo_tipo,
    diretoria_sigla: data.diretorias?.sigla,
    gerencia_sigla: data.gerencias?.sigla,
    periodo_nome: data.periodos?.nome,
    observacao: data.observacao,
  });

  return {
    ...data,
    periodo_nome: data.periodos?.nome || "",
    diretoria_sigla: data.diretorias?.sigla || "",
    gerencia_sigla: data.gerencias?.sigla || "",
  };
}

export async function toggleRestricaoAtividade(
  id: string,
  ativo: boolean
): Promise<boolean> {
  const { data, error } = await supabase
    .from("restricoes_atividades")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, periodos:periodo_id(nome)`)
    .single();

  if (error) {
    console.error("Erro ao alternar status da restrição:", error);
    throw error;
  }

  await registrarLogAtividade(
    ativo ? "ATIVAR" : "DESATIVAR",
    "restricoes_atividades",
    id,
    {
      ativo,
      modulo: data.modulo,
      atividade: data.atividade,
      status: data.status,
      periodo_nome: data.periodos?.nome,
    }
  );

  return true;
}

export async function deleteRestricaoAtividade(id: string): Promise<boolean> {
  const { data } = await supabase
    .from("restricoes_atividades")
    .select(`*, periodos:periodo_id(nome)`)
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("restricoes_atividades")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir restrição:", error);
    throw error;
  }

  if (data) {
    await registrarLogAtividade("EXCLUIR", "restricoes_atividades", id, {
      modulo: data.modulo,
      atividade: data.atividade,
      status: data.status,
      periodo_nome: data.periodos?.nome,
    });
  }

  return true;
}

export async function deleteRestricoesAtividadesBulk(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;

  const { error } = await supabase
    .from("restricoes_atividades")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("Erro ao excluir restrições em massa:", error);
    throw error;
  }

  try {
    await registrarLogAtividadeBulk("EXCLUIR", "restricoes_atividades", ids, { total: ids.length });
  } catch (logErr) {
    console.warn("Aviso ao registrar log de exclusão em massa de restrições:", logErr);
  }

  return true;
}

export async function upsertPerfilRestricao(params: {
  periodo_id: string;
  perfil: "gerencia" | "diretoria" | "compras";
  modulo: ModuloTipo;
  atividade: AtividadeTipo | string;
  bloqueado: boolean;
  observacao?: string;
}): Promise<RestricaoAtividade> {
  const { data: existing } = await supabase
    .from("restricoes_atividades")
    .select(`*, periodos:periodo_id(nome)`)
    .eq("periodo_id", params.periodo_id)
    .eq("escopo_tipo", "perfil")
    .eq("perfil", params.perfil)
    .eq("modulo", params.modulo)
    .eq("atividade", params.atividade)
    .maybeSingle();

  if (existing) {
    return updateRestricaoAtividade(existing.id, {
      ativo: params.bloqueado,
      status: "bloqueado",
      observacao: params.observacao || null,
    });
  } else {
    return createRestricaoAtividade({
      periodo_id: params.periodo_id,
      escopo_tipo: "perfil",
      perfil: params.perfil,
      modulo: params.modulo,
      atividade: params.atividade,
      status: "bloqueado",
      ativo: params.bloqueado,
      observacao: params.observacao || null,
    });
  }
}

export async function upsertMultiplosEscoposRestricao(params: {
  periodo_id: string;
  escopo_tipo: "gerencia" | "diretoria" | "perfil";
  perfil?: "gerencia" | "diretoria" | "compras";
  target_ids?: string[];
  modulo: ModuloTipo;
  atividade: AtividadeTipo | string;
  bloqueado: boolean;
  observacao?: string;
}): Promise<boolean> {
  // Se for perfil ou sem target_ids específicos
  if (params.escopo_tipo === "perfil" || !params.target_ids || params.target_ids.length === 0) {
    if (params.perfil) {
      await upsertPerfilRestricao({
        periodo_id: params.periodo_id,
        perfil: params.perfil,
        modulo: params.modulo,
        atividade: params.atividade,
        bloqueado: params.bloqueado,
        observacao: params.observacao,
      });
    }
    return true;
  }

  // Se forem passados IDs específicos de gerência
  if (params.escopo_tipo === "gerencia") {
    await Promise.all(
      params.target_ids.map(async (gerencia_id) => {
        const { data: existing } = await supabase
          .from("restricoes_atividades")
          .select("id")
          .eq("periodo_id", params.periodo_id)
          .eq("escopo_tipo", "gerencia")
          .eq("gerencia_id", gerencia_id)
          .eq("modulo", params.modulo)
          .eq("atividade", params.atividade)
          .maybeSingle();

        if (existing) {
          await updateRestricaoAtividade(existing.id, {
            ativo: params.bloqueado,
            status: "bloqueado",
            observacao: params.observacao || null,
          });
        } else {
          await createRestricaoAtividade({
            periodo_id: params.periodo_id,
            escopo_tipo: "gerencia",
            gerencia_id,
            modulo: params.modulo,
            atividade: params.atividade,
            status: "bloqueado",
            ativo: params.bloqueado,
            observacao: params.observacao || null,
          });
        }
      })
    );
  }

  // Se forem passados IDs específicos de diretoria
  if (params.escopo_tipo === "diretoria") {
    await Promise.all(
      params.target_ids.map(async (diretoria_id) => {
        const { data: existing } = await supabase
          .from("restricoes_atividades")
          .select("id")
          .eq("periodo_id", params.periodo_id)
          .eq("escopo_tipo", "diretoria")
          .eq("diretoria_id", diretoria_id)
          .eq("modulo", params.modulo)
          .eq("atividade", params.atividade)
          .maybeSingle();

        if (existing) {
          await updateRestricaoAtividade(existing.id, {
            ativo: params.bloqueado,
            status: "bloqueado",
            observacao: params.observacao || null,
          });
        } else {
          await createRestricaoAtividade({
            periodo_id: params.periodo_id,
            escopo_tipo: "diretoria",
            diretoria_id,
            perfil: "diretoria",
            modulo: params.modulo,
            atividade: params.atividade,
            status: "bloqueado",
            ativo: params.bloqueado,
            observacao: params.observacao || null,
          });
        }
      })
    );
  }

  return true;
}

/**
 * Avalia permissão de uma atividade de acordo com a hierarquia de regras com
 * isolamento total entre Gerência e Diretoria:
 *
 * Se Perfil = Gerência:
 *   1. Regra específica da Gerência (por ID)
 *   2. Regra da Diretoria aplicável a Gerências
 *   3. Regra de Ação Individual da Gerência
 *   4. Regra de Módulo da Gerência
 *   5. Regra Geral da Gerência ("Restringir toda a Gerência")
 *   6. Regra Global (Todos os Setores)
 *   7. Padrão: Liberado
 *
 * Se Perfil = Diretoria:
 *   1. Regra específica da Diretoria (por ID)
 *   2. Regra de Ação Individual da Diretoria (Aprovar, Reprovar, Devolver, etc.)
 *   3. Regra de Módulo da Diretoria (Aprovação / Plano Próprio)
 *   4. Regra Geral da Diretoria ("Restringir toda a Diretoria")
 *   5. Regra Global (Todos os Setores)
 *   6. Padrão: Liberado
 *
 * Nenhuma restrição de Gerência afeta Diretoria e vice-versa.
 */
export function evaluateActivityPermission(
  rules: RestricaoAtividade[],
  context: ActivityPermissionContext
): PermissionCheckResult {
  if (!rules || rules.length === 0) {
    return { blocked: false };
  }

  const activeRules = rules.filter((r) => {
    if (!r.ativo) return false;
    if (context.periodoId && r.periodo_id && r.periodo_id !== context.periodoId) {
      return false;
    }
    return true;
  });

  const matchesActivity = (r: RestricaoAtividade) => {
    const modMatch = r.modulo === "todos" || r.modulo === context.modulo;
    const actMatch = r.atividade === "todas" || r.atividade === context.atividade;
    return modMatch && actMatch;
  };

  // --------------------------------------------------------------------------
  // PERFIL: GERÊNCIA
  // --------------------------------------------------------------------------
  if (context.perfil === "gerencia") {
    // 1. Regra específica da Gerência (por ID)
    if (context.gerenciaId) {
      // 1.1 Específica por atividade
      const gerenciaExact = activeRules.find(
        (r) =>
          r.escopo_tipo === "gerencia" &&
          r.gerencia_id === context.gerenciaId &&
          (r.modulo === context.modulo || r.modulo === "todos") &&
          r.atividade === context.atividade
      );
      if (gerenciaExact) {
        return {
          blocked: gerenciaExact.status === "bloqueado",
          reason:
            gerenciaExact.observacao ||
            "Esta atividade está temporariamente bloqueada pelo administrador para a sua gerência no período atual.",
          matchedRule: gerenciaExact,
        };
      }

      // 1.2 Geral da gerência
      const gerenciaGeneral = activeRules.find(
        (r) =>
          r.escopo_tipo === "gerencia" &&
          r.gerencia_id === context.gerenciaId &&
          matchesActivity(r)
      );
      if (gerenciaGeneral) {
        return {
          blocked: gerenciaGeneral.status === "bloqueado",
          reason:
            gerenciaGeneral.observacao ||
            "Esta atividade está temporariamente bloqueada pelo administrador para a sua gerência no período atual.",
          matchedRule: gerenciaGeneral,
        };
      }
    }

    // 2. Regra da Diretoria aplicável às gerências
    if (context.diretoriaId) {
      const diretoriaRule = activeRules.find(
        (r) =>
          r.escopo_tipo === "diretoria" &&
          r.diretoria_id === context.diretoriaId &&
          (r.perfil === "gerencia" || r.perfil === "todos" || !r.perfil) &&
          matchesActivity(r)
      );
      if (diretoriaRule) {
        return {
          blocked: diretoriaRule.status === "bloqueado",
          reason:
            diretoriaRule.observacao ||
            "Esta atividade está temporariamente bloqueada pelo administrador para as gerências desta diretoria no período atual.",
          matchedRule: diretoriaRule,
        };
      }
    }

    // 3. Regras do Perfil GERÊNCIA
    // 3.1 Ação individual do perfil Gerência (ex: Enviar, Adicionar, Devolver, etc.)
    const perfilGerenciaExact = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "gerencia" &&
        (r.modulo === context.modulo || r.modulo === "todos") &&
        r.atividade === context.atividade
    );
    if (perfilGerenciaExact) {
      return {
        blocked: perfilGerenciaExact.status === "bloqueado",
        reason:
          perfilGerenciaExact.observacao ||
          "Esta atividade está temporariamente bloqueada pelo administrador para as gerências no período atual.",
        matchedRule: perfilGerenciaExact,
      };
    }

    // 3.2 Módulo do perfil Gerência (ex: Aquisição, Serviços)
    const perfilGerenciaModulo = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "gerencia" &&
        r.modulo === context.modulo &&
        r.atividade === "todas"
    );
    if (perfilGerenciaModulo) {
      return {
        blocked: perfilGerenciaModulo.status === "bloqueado",
        reason:
          perfilGerenciaModulo.observacao ||
          "Este módulo está temporariamente bloqueado pelo administrador para as gerências no período atual.",
        matchedRule: perfilGerenciaModulo,
      };
    }

    // 3.3 Geral do perfil Gerência ("Restringir toda a Gerência")
    const perfilGerenciaAll = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "gerencia" &&
        r.modulo === "todos" &&
        r.atividade === "todas"
    );
    if (perfilGerenciaAll) {
      return {
        blocked: perfilGerenciaAll.status === "bloqueado",
        reason:
          perfilGerenciaAll.observacao ||
          "Todas as atividades de gerência estão temporariamente bloqueadas pelo administrador para o período atual.",
        matchedRule: perfilGerenciaAll,
      };
    }
  }

  // --------------------------------------------------------------------------
  // PERFIL: DIRETORIA
  // --------------------------------------------------------------------------
  if (context.perfil === "diretoria") {
    // 1. Regra específica da Diretoria (por ID)
    if (context.diretoriaId) {
      const diretoriaExact = activeRules.find(
        (r) =>
          r.escopo_tipo === "diretoria" &&
          r.diretoria_id === context.diretoriaId &&
          (r.perfil === "diretoria" || r.perfil === "todos" || !r.perfil) &&
          matchesActivity(r)
      );
      if (diretoriaExact) {
        return {
          blocked: diretoriaExact.status === "bloqueado",
          reason:
            diretoriaExact.observacao ||
            "Esta atividade está temporariamente bloqueada pelo administrador para a sua diretoria no período atual.",
          matchedRule: diretoriaExact,
        };
      }
    }

    // 2. Regras do Perfil DIRETORIA
    // 2.1 Ação individual do perfil Diretoria (ex: Aprovar, Reprovar, Devolver, Enviar para Compras)
    const perfilDiretoriaExact = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "diretoria" &&
        (r.modulo === context.modulo || r.modulo === "todos" || r.modulo === "aprovacao") &&
        r.atividade === context.atividade
    );
    if (perfilDiretoriaExact) {
      return {
        blocked: perfilDiretoriaExact.status === "bloqueado",
        reason:
          perfilDiretoriaExact.observacao ||
          "Esta atividade de diretoria está temporariamente bloqueada pelo administrador para o período atual.",
        matchedRule: perfilDiretoriaExact,
      };
    }

    // 2.2 Módulo do perfil Diretoria (ex: Aprovação)
    const perfilDiretoriaModulo = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "diretoria" &&
        (r.modulo === context.modulo || r.modulo === "aprovacao") &&
        r.atividade === "todas"
    );
    if (perfilDiretoriaModulo) {
      return {
        blocked: perfilDiretoriaModulo.status === "bloqueado",
        reason:
          perfilDiretoriaModulo.observacao ||
          "Este módulo está temporariamente bloqueado pelo administrador para a diretoria no período atual.",
        matchedRule: perfilDiretoriaModulo,
      };
    }

    // 2.3 Geral do perfil Diretoria ("Restringir toda a Diretoria")
    const perfilDiretoriaAll = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "diretoria" &&
        (r.modulo === "todos" || r.modulo === "aprovacao") &&
        r.atividade === "todas"
    );
    if (perfilDiretoriaAll) {
      return {
        blocked: perfilDiretoriaAll.status === "bloqueado",
        reason:
          perfilDiretoriaAll.observacao ||
          "Todas as atividades de aprovação da diretoria estão temporariamente bloqueadas pelo administrador para o período atual.",
        matchedRule: perfilDiretoriaAll,
      };
    }
  }

  // --------------------------------------------------------------------------
  // PERFIL: COMPRAS
  // --------------------------------------------------------------------------
  if (context.perfil === "compras") {
    const perfilComprasExact = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "compras" &&
        (r.modulo === context.modulo || r.modulo === "todos" || r.modulo === "compras") &&
        r.atividade === context.atividade
    );
    if (perfilComprasExact) {
      return {
        blocked: perfilComprasExact.status === "bloqueado",
        reason:
          perfilComprasExact.observacao ||
          "Esta atividade de compras está temporariamente bloqueada pelo administrador para o período atual.",
        matchedRule: perfilComprasExact,
      };
    }

    const perfilComprasAll = activeRules.find(
      (r) =>
        r.escopo_tipo === "perfil" &&
        r.perfil === "compras" &&
        (r.modulo === "todos" || r.modulo === "compras") &&
        r.atividade === "todas"
    );
    if (perfilComprasAll) {
      return {
        blocked: perfilComprasAll.status === "bloqueado",
        reason:
          perfilComprasAll.observacao ||
          "Todas as atividades de compras estão temporariamente bloqueadas pelo administrador para o período atual.",
        matchedRule: perfilComprasAll,
      };
    }
  }

  // --------------------------------------------------------------------------
  // REGRA GLOBAL (Todos os Setores / Todos os Perfis)
  // --------------------------------------------------------------------------
  const globalExact = activeRules.find(
    (r) =>
      r.escopo_tipo === "todos" &&
      (r.modulo === context.modulo || r.modulo === "todos") &&
      r.atividade === context.atividade
  );
  if (globalExact) {
    return {
      blocked: globalExact.status === "bloqueado",
      reason:
        globalExact.observacao ||
        "Esta atividade está temporariamente bloqueada pelo administrador para o período atual.",
      matchedRule: globalExact,
    };
  }

  const globalAll = activeRules.find(
    (r) =>
      r.escopo_tipo === "todos" &&
      (r.modulo === "todos" || r.modulo === context.modulo) &&
      r.atividade === "todas"
  );
  if (globalAll) {
    return {
      blocked: globalAll.status === "bloqueado",
      reason:
        globalAll.observacao ||
        "Esta atividade está temporariamente bloqueada pelo administrador para o período atual.",
      matchedRule: globalAll,
    };
  }

  // Padrão: Liberado
  return { blocked: false };
}

/**
 * Assegura que uma atividade está liberada antes de executar mutação na camada de serviço.
 * Lança erro humanizado se estiver bloqueada.
 */
export async function assertActivityAllowed(
  context: ActivityPermissionContext
): Promise<void> {
  try {
    let periodoId = context.periodoId;
    if (!periodoId) {
      const periodosAtivos = await getPeriodosAtivos();
      if (periodosAtivos && periodosAtivos[0]) {
        periodoId = (periodosAtivos[0] as any).id;
      }
    }

    if (!periodoId) return; // Sem período, não aplica restrição

    const rules = await getRestricoesAtividades(periodoId);
    const result = evaluateActivityPermission(rules, {
      ...context,
      periodoId,
    });

    if (result.blocked) {
      throw new Error(
        result.reason ||
          "Ação bloqueada: Esta atividade está temporariamente bloqueada pelo administrador para o período atual."
      );
    }
  } catch (err: any) {
    if (err.message && err.message.includes("Ação bloqueada")) {
      throw err;
    }
    // Não interrompe em caso de erro desconhecido de consulta para evitar parada acidental
    console.warn("Aviso ao checar restrições de atividade:", err);
  }
}

export async function transferirSolicitacoesParaGerenciaBulk(
  ids: string[],
  targetGerenciaId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("solicitacoes")
    .update({
      status: "rascunho",
      gerencia_id: targetGerenciaId,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (error) {
    console.error("Erro ao transferir solicitacoes em massa:", error);
    throw error;
  }

  await registrarLogAtividadeBulk("TRANSFERIR", "solicitacoes", ids, {
    acao: "transferir_para_gerencia_bulk",
    gerencia_destino_id: targetGerenciaId,
  });
}

export async function transferirServicosParaGerenciaBulk(
  ids: string[],
  targetGerenciaId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("servicos")
    .update({
      status: "rascunho",
      gerencia_id: targetGerenciaId,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);

  if (error) {
    console.error("Erro ao transferir servicos em massa:", error);
    throw error;
  }

  await registrarLogAtividadeBulk("TRANSFERIR", "servicos", ids, {
    acao: "transferir_para_gerencia_bulk",
    gerencia_destino_id: targetGerenciaId,
  });
}

