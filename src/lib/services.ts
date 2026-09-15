// deno-lint-ignore-file no-explicit-any
import { supabase } from "./supabaseClient.ts";
import * as gs from "./googleSheetsClient.ts";

function normalizePeriodo(p: any) {
  if (!p) return p;
  return {
    ...p,
    nome: p.nome || (p.ano ? `PAC ${p.ano}` : "Plano Anual 2027"),
    inicio: p.inicio ? String(p.inicio).split("T")[0] : "",
    fim: p.fim ? String(p.fim).split("T")[0] : "",
    ativo: p.ativo === true || p.ativo === "true" || p.ativo === 1,
  };
}

export function parseSafeNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    // Recupera datas geradas erroneamente pelo Excel/Sheets a partir de números (ex: "3329-10-01T03:00:00.000Z" -> 3329.10)
    if (trimmed.includes("T") && (trimmed.includes("Z") || trimmed.includes("+"))) {
      const match = trimmed.match(/^(\d{1,6})-(\d{2})/);
      if (match) {
        const recovered = parseFloat(`${match[1]}.${match[2]}`);
        if (!isNaN(recovered)) return recovered;
      }
      return fallback;
    }
    // Remove R$ e espaços
    const clean = trimmed.replace(/[R$\s]/g, "");
    if (!clean) return fallback;
    // Formato brasileiro "1.234,56" ou "88,51"
    if (clean.includes(",")) {
      const normalized = clean.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(normalized);
      return isNaN(num) ? fallback : num;
    }
    const num = parseFloat(clean);
    return isNaN(num) ? fallback : num;
  }
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

export function formatCurrency(value: any): string {
  const num = parseSafeNumber(value, 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

// Cache em memória do catálogo de materiais para hidratação defensiva instantânea
const memoryCatalogById = new Map<string, any>();
const memoryCatalogByCode = new Map<number, any>();

// Cache em memória de gerências para garantir sigla sempre resolvida (ex: 'GSAD', 'GESL', 'DG' em vez de UUID)
const memoryGerenciasById = new Map<string, string>();

export function updateGerenciasCache(gerencias: any[]) {
  if (!Array.isArray(gerencias)) return;
  gerencias.forEach(g => {
    if (g && g.id && g.sigla) {
      memoryGerenciasById.set(String(g.id).trim().toLowerCase(), String(g.sigla).trim());
    }
  });
}

export function updateCatalogCache(items: any[]) {
  if (!Array.isArray(items)) return;
  items.forEach(it => {
    if (it.id) memoryCatalogById.set(String(it.id).trim().toLowerCase(), it);
    const c = Number(it.codigo);
    if (!isNaN(c) && c > 0) memoryCatalogByCode.set(c, it);
  });
}

function mapDbToPlanItem(s: any): PlanItem {
  if (!s) return s;
  const unitVal = parseSafeNumber(s.valor_unitario ?? s.item?.valor_unitario, 0);
  const qtdVal = parseSafeNumber(s.qtd_estimada ?? s.qtdEstimada, 0);

  // Busca no cache em memória se codigo ou descricao estiverem faltando
  let catItem = null;
  if (s.item_id) {
    catItem = memoryCatalogById.get(String(s.item_id).trim().toLowerCase());
  }
  const rawCode = s.codigo ?? s.item?.codigo ?? (catItem ? catItem.codigo : 0);
  const code = Number(rawCode) || 0;
  if (!catItem && code > 0) {
    catItem = memoryCatalogByCode.get(code);
  }

  const rawDesc = s.descricao || s.item?.descricao || (catItem ? catItem.descricao : "");
  const isDescDefault = !rawDesc || rawDesc.toLowerCase() === "material não especificado" || rawDesc.toLowerCase() === "diversos";
  const desc = (!isDescDefault) ? rawDesc : ((catItem && catItem.descricao) ? catItem.descricao : rawDesc);

  const cat = (s.categoria && s.categoria !== "diversos")
    ? s.categoria
    : ((catItem && catItem.categoria) ? catItem.categoria : (s.item?.categoria || "MATERIAIS DE CUSTEIO"));
  const un = s.unidade || (catItem && catItem.unidade) || s.item?.unidade || "un";

  const resolvedGerencia = s.gerencias?.sigla 
    || (s.gerencia && !String(s.gerencia).includes("-") ? s.gerencia : undefined)
    || memoryGerenciasById.get(String(s.gerencia_id || s.gerencia || "").trim().toLowerCase()) 
    || s.gerencia 
    || "";

  return {
    id: s.id,
    item_id: s.item_id,
    codigo: code,
    descricao: desc,
    categoria: cat,
    unidade: un,
    valorUnitario: unitVal > 0 ? unitVal : (catItem?.valor_unitario || 0),
    valor_unitario: unitVal > 0 ? unitVal : (catItem?.valor_unitario || 0),
    qtdEstimada: qtdVal,
    qtd_estimada: qtdVal,
    prioridade: s.prioridade || s.grau_prioridade || "Baixa",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
    justificativaRejeicao: s.justificativa_rejeicao || "",
    justificativa_rejeicao: s.justificativa_rejeicao || "",
    gerencia: resolvedGerencia,
    gerencia_id: s.gerencia_id,
    diretoria_id: s.diretoria_id,
    diretoriaSigla: s.diretoriaSigla || s.diretorias?.sigla,
    periodo_id: s.periodo_id,
    created_at: s.created_at,
    updated_at: s.updated_at,
    item: {
      id: s.item_id || catItem?.id || s.item?.id || s.id,
      codigo: code,
      descricao: desc,
      categoria: cat,
      unidade: un,
      valor_unitario: unitVal > 0 ? unitVal : (catItem?.valor_unitario || 0),
    },
  } as unknown as PlanItem;
}
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

    if (gs.isGoogleSheetsActive()) {
      await gs.gsRegistrarLogAtividade(matricula, acao, tabelaAfetada, registroId, detalhes);
      return;
    }

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

    if (gs.isGoogleSheetsActive()) {
      for (const id of registrosIds) {
        await gs.gsRegistrarLogAtividade(matricula, acao, tabelaAfetada, id, detalhes);
      }
      return;
    }

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
    return isFresh ? normalizeDiretorias(parsed.data) : null;
  } catch {
    return null;
  }
}

function saveDiretoriasCache(data: DiretoriaRow[]): void {
  if (typeof window === "undefined") return;

  try {
    globalThis.localStorage.setItem(
      DIRETORIAS_CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now(), data: normalizeDiretorias(data) })
    );
  } catch {
    // Ignora falhas de storage para não impactar o fluxo principal.
  }
}

function normalizeDiretorias(rows: DiretoriaRow[] | null | undefined): DiretoriaRow[] {
  const seen = new Set<string>();
  const unique: DiretoriaRow[] = [];
  for (const dir of rows || []) {
    const sigla = String(dir.sigla || "").trim().toUpperCase();
    const key = sigla || String(dir.id || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...dir,
      sigla,
    });
  }
  return unique;
}

export function deduplicateGerencias<T extends Record<string, any>>(rows: T[] | null | undefined): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const g of rows || []) {
    const sigla = String(g.sigla || "").trim().toUpperCase();
    const dirId = String(g.diretoria_id || "").trim().toLowerCase();
    const key = (dirId && sigla) ? `${dirId}-${sigla}` : String(g.id || sigla).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(g);
  }
  return unique;
}

export function deduplicatePeriodos<T extends Record<string, any>>(rows: T[] | null | undefined): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const p of rows || []) {
    const key = String(p.id || p.nome || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique;
}

export function deduplicateById<T extends { id?: any }>(items: T[] | null | undefined): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const it of items || []) {
    const id = String(it?.id || "").trim().toLowerCase();
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    unique.push(it);
  }
  return unique;
}

export function deduplicateItensCatalogo<T extends Record<string, any>>(items: T[] | null | undefined): T[] {
  const seen = new Set<number>();
  const unique: T[] = [];
  for (const it of items || []) {
    const cod = Number(it?.codigo);
    if (!isNaN(cod) && cod > 0) {
      if (seen.has(cod)) continue;
      seen.add(cod);
    }
    unique.push(it);
  }
  return unique;
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

  if (gs.isGoogleSheetsActive()) {
    try {
      const data = await gs.gsGetDiretorias();
      if (data && data.length > 0) {
        const normalized = normalizeDiretorias(data as DiretoriaRow[]);
        const filtered = normalized.filter((dir) => dir.ativa !== false);
        saveDiretoriasCache(filtered);
        return filtered;
      }
    } catch (e) {
      console.warn("Erro ao buscar diretorias no Google Sheets:", e);
    }
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
  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias(diretoriaId);
    const filtered = (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
    const deduplicated = deduplicateGerencias(filtered);
    updateGerenciasCache(deduplicated);
    return deduplicated;
  }

  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
    .eq("diretoria_id", diretoriaId)
    .eq("ativa", true)
    .order("sigla");

  if (error) throw error;
  const deduplicated = deduplicateGerencias(data || []);
  updateGerenciasCache(deduplicated);
  return deduplicated;
}

export async function getAllGerencias(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias();
    const filtered = (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
    const deduplicated = deduplicateGerencias(filtered);
    updateGerenciasCache(deduplicated);
    return deduplicated;
  }

  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
    .order("sigla");

  if (error) throw error;
  const deduplicated = deduplicateGerencias(data || []);
  updateGerenciasCache(deduplicated);
  return deduplicated;
}

export async function getTodasGerencias(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias();
    const filtered = (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
    const deduplicated = deduplicateGerencias(filtered);
    updateGerenciasCache(deduplicated);
    return deduplicated;
  }

  const { data, error } = await supabase
    .from("gerencias")
    .select("*")
    .order("sigla");

  if (error) throw error;
  const deduplicated = deduplicateGerencias(data || []);
  updateGerenciasCache(deduplicated);
  return deduplicated;
}

export async function getDiretoriasComDetalhes(): Promise<
  (Diretoria & { totalGerencias: number; totalItens: number })[]
> {
  if (gs.isGoogleSheetsActive()) {
    const [diretorias, gerencias, solicitacoesCounts, servicos] = await Promise.all([
      gs.gsGetDiretorias(),
      gs.gsGetGerencias(),
      gs.gsGetSolicitacoesCountByDiretoria().catch(() => ({} as Record<string, number>)),
      gs.gsGetServicos()
    ]);
    const uniqueDirs = normalizeDiretorias(diretorias as any);
    const uniqueGers = deduplicateGerencias(gerencias as any);
    return uniqueDirs.map((dir: any) => {
      const gCount = uniqueGers.filter((g: any) => String(g.diretoria_id) === String(dir.id) && g.ativa !== false).length;
      const sCount = Number((solicitacoesCounts as Record<string, number>)?.[dir.id] || 0);
      const servCount = (servicos || []).filter((s: any) => String(s.diretoria_id) === String(dir.id)).length;
      return {
        id: dir.id,
        sigla: dir.sigla,
        nome: dir.nome,
        totalGerencias: gCount,
        totalItens: sCount + servCount,
      } as Diretoria & { totalGerencias: number; totalItens: number };
    });
  }

  const { data: diretorias, error: errDir } = await supabase
    .from("diretorias")
    .select("*")
    .eq("ativa", true)
    .order("sigla");

  if (errDir) throw errDir;
  const uniqueDirs = normalizeDiretorias(diretorias as any);

  const diretoriasComDetalhes = await Promise.all(
    uniqueDirs.map(async (dir: unknown) => {
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
        totalGerencias: deduplicateGerencias(gerencias || []).length,
        totalItens: totalItens || 0,
      };
    })
  );

  return diretoriasComDetalhes;
}

// ============ PERÍODOS ============

export async function getPeriodosAtivos(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const list = await gs.gsGetPeriodos();
    const periodos = (list || []).map(normalizePeriodo).filter((p: any) => p.ativo);
    return deduplicatePeriodos(periodos);
  }

  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .eq("ativo", true)
    .order("fim", { ascending: false });

  if (error) throw error;
  return deduplicatePeriodos(data || []);
}

export async function getTodosPeriodos(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const list = await gs.gsGetPeriodos();
    const periodos = (list || []).map(normalizePeriodo);
    return deduplicatePeriodos(periodos);
  }

  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return deduplicatePeriodos(data || []);
}

export async function createPeriodo(periodo: {
  nome: string;
  inicio: string;
  fim: string;
}): Promise<Record<string, unknown>> {
  if (gs.isGoogleSheetsActive()) {
    const saved = await gs.gsCreatePeriodo({ ...periodo, ativo: false });
    await registrarLogAtividade("CRIAR", "periodos", saved.id || "novo", { periodo });
    return saved || {};
  }

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
  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdatePeriodo(periodoId, updates);
    await registrarLogAtividade("EDITAR", "periodos", periodoId, { updates });
    return updated || {};
  }

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
  if (gs.isGoogleSheetsActive()) {
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ gerencia_id: gerenciaId, periodo_id: periodoId });
    return deduplicateById((rows || []).map(mapDbToPlanItem));
  }

  const data = await fetchAllPages<any>((from, to) =>
    supabase
      .from("solicitacoes")
      .select("*, item:itens_catalogo!solicitacoes_item_id_fkey(codigo, descricao, categoria, unidade, valor_unitario)")
      .eq("gerencia_id", gerenciaId)
      .eq("periodo_id", periodoId)
      .order("id")
      .range(from, to) as unknown as Promise<PostgrestSingleResponse<any[]>>
  );

  return deduplicateById(data.map((s: any) => ({
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
  } as unknown as PlanItem)));
}

export async function deleteSolicitacao(itemId: string | number): Promise<boolean> {
  if (!itemId) throw new Error("ID inválido para exclusão");

  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteSolicitacao(String(itemId));
    await registrarLogAtividade("EXCLUIR", "solicitacoes", String(itemId));
    return true;
  }

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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteSolicitacoesBulk(itemIds.map(String));
    await registrarLogAtividade("EXCLUIR", "solicitacoes", "BULK", { ids: itemIds });
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ diretoria_id: diretoriaId, periodo_id: periodoId });
    return deduplicateById((rows || []).map(mapDbToPlanItem));
  }

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

  return deduplicateById(data.map((s: any) => ({
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
  } as PlanItem)));
}

export async function getSolicitacoesByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<PlanItem[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ periodo_id: periodoId });
    return deduplicateById((rows || []).map(mapDbToPlanItem));
  }

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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }

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
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetSolicitacoes({ periodo_id: periodoId })) || [];
  }

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
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetServicos({ periodo_id: periodoId })) || [];
  }

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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({
      periodo_id: periodoId,
      status: "aprovado,em_compra,concluido",
    });
    return (rows || []).map(mapDbToPlanItem);
  }

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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({
      periodo_id: periodoId,
      status: "aprovado,em_compra,concluido",
    });
    return (rows || []).map(mapDbToServicoItem);
  }

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

  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateSolicitacao({ ...payload, codigo: solicitacao.codigo, descricao: solicitacao.descricao, categoria: solicitacao.categoria, unidade: solicitacao.unidade });
    await registrarLogAtividade("CRIAR", "solicitacoes", created.id, payload);
    return mapDbToPlanItem(created);
  }

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

  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateSolicitacao(id, dbUpdates);
    await registrarLogAtividade("EDITAR", "solicitacoes", id, dbUpdates);
    return mapDbToPlanItem(updated);
  }

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

  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateSolicitacaoStatus(id, status, justificativa);
    await registrarLogAtividade("STATUS", "solicitacoes", id, { acao: "updateSolicitacaoStatus", status_novo: status, justificativa });
    return mapDbToPlanItem(updated);
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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateSolicitacaoStatusBulk(ids, status, justificativa);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacaoStatusBulk", status_novo: status, justificativa });
    return;
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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateServicoStatusBulk(ids, status, justificativa);
    await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicoStatusBulk", status_novo: status, justificativa });
    return;
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
  scope: "diretoria" | "gerencia" | "admin" | "compras",
  diretoria_id?: string,
  gerencia_id?: string
): Promise<AccessCodeResponse> {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error("Código de acesso vazio");
  }

  if (gs.isGoogleSheetsActive()) {
    try {
      const res = await gs.gsValidateAccessCode(normalizedCode, scope, diretoria_id, gerencia_id);
      if (res && res.scope) {
        return res as AccessCodeResponse;
      }
      throw new Error("Código de acesso inválido ou inativo");
    } catch (err: any) {
      throw new Error(err?.message || "Código de acesso inválido ou inativo");
    }
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
  if (gs.isGoogleSheetsActive()) {
    try {
      const items = await gs.gsGetItensCatalogo();
      if (Array.isArray(items) && items.length > 0) {
        const uniqueItems = deduplicateItensCatalogo(items);
        updateCatalogCache(uniqueItems);
        return uniqueItems;
      }
    } catch (_err) {
      console.warn("Falha ao buscar catálogo da planilha, tentando Supabase...", _err);
    }

    // Fallback defensivo 1: Tentar carregar do Supabase se o Google Sheets falhar ou vier vazio
    try {
      const data = await fetchAllPages<unknown>((from, to) =>
        supabase
          .from("itens_catalogo")
          .select("*")
          .order("codigo")
          .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
      );
      if (Array.isArray(data) && data.length > 0) {
        const uniqueData = deduplicateItensCatalogo(data as any[]);
        updateCatalogCache(uniqueData);
        return uniqueData;
      }
    } catch (errDb) {
      console.warn("Falha ao buscar catálogo no Supabase após falha do Google Sheets:", errDb);
    }

    // Fallback defensivo 2: carrega itens a partir de materialDescriptionByCode.json caso nem Sheets nem Supabase respondam
    try {
      if (typeof window !== "undefined") {
        const res = await fetch("/data/materialDescriptionByCode.json");
        if (res.ok) {
          const dict = await res.json();
          const fallbackItems = Object.entries(dict).map(([code, desc]) => ({
            id: `item-${code}`,
            codigo: Number(code),
            descricao: String(desc),
            categoria: "MATERIAIS DE CUSTEIO",
            unidade: "UND",
            valor_unitario: 0,
          }));
          const uniqueFallback = deduplicateItensCatalogo(fallbackItems);
          updateCatalogCache(uniqueFallback);
          return uniqueFallback;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  try {
    const data = await fetchAllPages<unknown>((from, to) =>
      supabase
        .from("itens_catalogo")
        .select("*")
        .order("codigo")
        .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
    );
    if (Array.isArray(data)) {
      const uniqueData = deduplicateItensCatalogo(data as any[]);
      updateCatalogCache(uniqueData);
      return uniqueData;
    }
    return [];
  } catch (err) {
    console.warn("Falha ao buscar catálogo no Supabase:", err);
    return [];
  }
}

export async function getCategoryBudgetOwnerRules(): Promise<
  Record<string, string>
> {
  if (gs.isGoogleSheetsActive()) {
    try {
      const config = await gs.gsGetAdminConfig();
      if (config?.category_budget_owners) {
        return config.category_budget_owners as Record<string, string>;
      }
    } catch {
      // ignore
    }
    return {};
  }

  try {
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
  } catch (err) {
    console.warn("Falha ao buscar regras orçamentárias de categoria:", err);
    return {};
  }
}

export async function getAdminMiniErpConfigDb(): Promise<Partial<AdminBudgetConfig> | null> {
  if (gs.isGoogleSheetsActive()) {
    const config = await gs.gsGetAdminConfig();
    return (config?.admin_mini_erp_config as Partial<AdminBudgetConfig>) || null;
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsSaveAdminConfig("admin_mini_erp_config", config);
    await registrarLogAtividade("EDITAR", "configuracoes", "admin-mini-erp-config", { acao: "saveAdminMiniErpConfigDb" });
    return { success: true };
  }

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
  if (gs.isGoogleSheetsActive()) {
    try {
      const list = (await gs.gsGetServicosCatalogo()) || [];
      if (Array.isArray(list) && list.length > 0) {
        return deduplicateById(list as any[]);
      }
    } catch (_err) {
      console.warn("Falha ao buscar serviços da planilha, tentando Supabase...", _err);
    }
  }

  try {
    const list = await fetchAllPages<unknown>((from, to) =>
      supabase
        .from("servicos_catalogo")
        .select("*")
        .order("item")
        .range(from, to) as unknown as Promise<PostgrestSingleResponse<unknown[]>>
    );
    if (Array.isArray(list)) {
      return deduplicateById(list as any[]);
    }
    return [];
  } catch (errDb) {
    console.warn("Falha ao buscar serviços no Supabase:", errDb);
    return [];
  }
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
  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateServicoCatalogo(servico);
    await registrarLogAtividade("CRIAR", "servicos_catalogo", (created as any)?.id || "novo", servico);
    return { success: true, data: created };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateServicoCatalogo(servicoId, updates);
    await registrarLogAtividade("EDITAR", "servicos_catalogo", servicoId, updates);
    return { success: true, data: updated };
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicoCatalogo(servicoId);
    await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId);
    return { success: true };
  }

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

export async function deleteServicosCatalogoBulkAdmin(
  servicoIds: string[]
): Promise<unknown> {
  if (!servicoIds || servicoIds.length === 0) return { success: true };
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicosCatalogoBulk(servicoIds);
    await registrarLogAtividadeBulk("EXCLUIR", "servicos_catalogo", servicoIds, { acao: "deleteServicosCatalogoBulkAdmin" });
    return { success: true };
  }
  return Promise.all(servicoIds.map(id => deleteServicoCatalogoAdmin(id)));
}

export async function deleteServicoCatalogo(
  servicoId: string
): Promise<unknown> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicoCatalogo(servicoId);
    await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId);
    return { success: true };
  }

  const { error } = await supabase.from("servicos_catalogo").delete().eq("id", servicoId);
  if (error) throw error;
  await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId);
  return { success: true };
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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsSaveAdminConfig("category_budget_owners", filteredRules);
    await registrarLogAtividade("EDITAR", "configuracoes", "category_budget_owner_rules", { acao: "saveCategoryBudgetOwnerRules" });
    return { success: true };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateItemCatalogo({ ...item, valor_unitario: item.valorUnitario });
    await registrarLogAtividade("CRIAR", "itens_catalogo", (created as any)?.id || "novo", item);
    return { success: true, data: created };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const catalogo = await gs.gsGetItensCatalogo();
    const codigosSet = new Set(codigosCatalogo.map(Number));
    const itens = (catalogo || []).filter((c: any) => codigosSet.has(Number(c.codigo)));

    const solicitacoes = itens.map((itemTyped: any) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : "sol-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
      item_id: itemTyped.id || null,
      periodo_id: periodoId,
      diretoria_id: diretoriaId,
      gerencia_id: gerenciaId,
      codigo: Number(itemTyped.codigo),
      descricao: itemTyped.descricao,
      categoria: itemTyped.categoria,
      unidade: itemTyped.unidade,
      valor_unitario: Number(itemTyped.valor_unitario || 0),
      qtd_estimada: 0,
      prioridade: "Média",
      status: "rascunho",
      created_at: new Date().toISOString()
    }));

    if (solicitacoes.length > 0) {
      await gs.gsBulkInsert("solicitacoes", solicitacoes);
      await registrarLogAtividadeBulk("CRIAR", "solicitacoes", solicitacoes.map((s: any) => s.id), { origem: "catalogo" });
    }
    return solicitacoes;
  }

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
  const rawEstimativa = row.estimativa_valor ?? row.estimativaValor;
  const rawDotacao = row.dotacao_orcamentaria ?? row.dotacaoOrcamentaria;
  return {
    id: row.id,
    item: row.item !== undefined && row.item !== null && row.item !== "" ? Number(row.item) : row.item,
    tipoContratacao: row.tipo_contratacao ?? row.tipoContratacao,
    unidadeDemandante: row.unidade_demandante ?? row.unidadeDemandante,
    objeto: row.objeto,
    justificativa: row.justificativa,
    previsaoInicio: row.previsao_inicio ?? row.previsaoInicio,
    estimativaValor: rawEstimativa !== undefined && rawEstimativa !== null && rawEstimativa !== "" ? Number(rawEstimativa) : 0,
    dotacaoOrcamentaria: rawDotacao !== undefined && rawDotacao !== null && rawDotacao !== "" ? Number(rawDotacao) : 0,
    grauPrioridade: row.grau_prioridade ?? row.grauPrioridade,
    vinculacao: row.vinculacao,
    dependenciaDescricao: row.dependencia_descricao ?? row.dependenciaDescricao,
    gerencia: row.gerencias?.sigla
      ?? (row.gerencia && !String(row.gerencia).includes("-") ? row.gerencia : undefined)
      ?? memoryGerenciasById.get(String(row.gerencia_id || row.gerencia || "").trim().toLowerCase())
      ?? row.gerencia
      ?? row.gerencia_id,
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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ gerencia_id: gerenciaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }

  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("gerencia_id", gerenciaId)
    .eq("periodo_id", periodoId)
    .order("item");

  if (error) throw error;
  return deduplicateById((data || []).map(mapDbToServicoItem));
}

export async function getServicosCatalogoByGerencia(
  gerenciaId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("servicos_catalogo")
    .select("*")
    .or(`gerencia_id.eq.${gerenciaId},gerencia_id.is.null`);

  if (error) throw error;
  return deduplicateById(data || []);
}

export async function getServicosByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<ServicoItem[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ diretoria_id: diretoriaId, periodo_id: periodoId });
    return deduplicateById((rows || []).map(mapDbToServicoItem));
  }

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
  return deduplicateById(data.map(mapDbToServicoItem));
}

export async function updateServico(
  servicoId: string,
  updates: Partial<ServicoItem> | any
): Promise<ServicoItem | undefined> {
  if (gs.isGoogleSheetsActive()) {
    const dbUpdates = mapServicoItemToDb(updates);
    const updated = await gs.gsUpdateServico(servicoId, dbUpdates);
    await registrarLogAtividade("EDITAR", "servicos", servicoId, updates);
    return mapDbToServicoItem(updated);
  }

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
  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateServico(dbRow);
    await registrarLogAtividade("CRIAR", "servicos", created.id, servico);
    return mapDbToServicoItem(created);
  }

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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServico(String(idOrItem));
    await registrarLogAtividade("EXCLUIR", "servicos", String(idOrItem));
    return true;
  }

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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicosBulk(itemIds.map(String));
    await registrarLogAtividadeBulk("EXCLUIR", "servicos", itemIds.map(String));
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const items = ids.map(id => ({ id, ...updates }));
    await gs.gsUpdateSolicitacoesBulkData(items);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacoesBulkData" });
    return;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const dbUpdates = mapServicoItemToDb(updates);
    const items = ids.map(id => ({ id, ...dbUpdates }));
    await gs.gsUpdateServicosBulkData(items);
    await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicosBulkData" });
    return;
  }

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
  if (gs.isGoogleSheetsActive()) {
    console.warn(`invokeAdminFunction: redirecionando chamada de '${functionName}' para Google Sheets.`);
    return { success: true };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateServicoCatalogo(item);
    await registrarLogAtividade("CRIAR", "servicos_catalogo", (created as any)?.id || "novo", item);
    return { success: true, data: created };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateServicoCatalogo(servicoId, item);
    await registrarLogAtividade("EDITAR", "servicos_catalogo", servicoId, item);
    return { success: true, data: updated };
  }

  const adminAccessCode = sessionStorage.getItem("access-code:admin");
  if (!adminAccessCode) throw new Error("Sessão admin não encontrada.");

  return await invokeAdminFunction("admin-update-servico", {
    accessCode: adminAccessCode,
    servicoId,
    item,
  });
}

export async function deleteServicoAdmin(servicoId: string): Promise<unknown> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicoCatalogo(servicoId);
    await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId);
    return { success: true };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateItemCatalogo(itemId, updates);
    await registrarLogAtividade("EDITAR", "itens_catalogo", itemId, updates);
    return { success: true, data: updated };
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteItemCatalogo(itemId);
    await registrarLogAtividade("EXCLUIR", "itens_catalogo", itemId);
    return { success: true };
  }

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

export async function deleteItensCatalogoBulkAdmin(
  itemIds: string[]
): Promise<unknown> {
  if (!itemIds || itemIds.length === 0) return { success: true };
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteItensCatalogoBulk(itemIds);
    await registrarLogAtividadeBulk("EXCLUIR", "itens_catalogo", itemIds, { acao: "deleteItensCatalogoBulkAdmin" });
    return { success: true };
  }
  return Promise.all(itemIds.map(id => deleteItemCatalogoAdmin(id)));
}

export async function criarOrcamento(
  diretoriaId: string,
  tipo: "aquisicao" | "servicos",
  retidoDiretoria: number,
  repassesGerencias: Record<string, number>
): Promise<unknown> {
  if (gs.isGoogleSheetsActive()) {
    const currentConfig = (await gs.gsGetAdminConfig()) || {};
    const miniConfig = (currentConfig.admin_mini_erp_config || {}) as any;
    if (tipo === "aquisicao") {
      miniConfig.diretoriaBudgetsAquisicao = miniConfig.diretoriaBudgetsAquisicao || {};
      miniConfig.diretoriaBudgetsAquisicao[diretoriaId] = retidoDiretoria;
      miniConfig.gerenciaBudgetsAquisicao = miniConfig.gerenciaBudgetsAquisicao || {};
      Object.entries(repassesGerencias || {}).forEach(([gId, val]) => {
        miniConfig.gerenciaBudgetsAquisicao[gId] = val;
      });
    } else {
      miniConfig.diretoriaBudgetsServicos = miniConfig.diretoriaBudgetsServicos || {};
      miniConfig.diretoriaBudgetsServicos[diretoriaId] = retidoDiretoria;
      miniConfig.gerenciaBudgetsServicos = miniConfig.gerenciaBudgetsServicos || {};
      Object.entries(repassesGerencias || {}).forEach(([gId, val]) => {
        miniConfig.gerenciaBudgetsServicos[gId] = val;
      });
    }
    await gs.gsSaveAdminConfig("admin_mini_erp_config", miniConfig);
    await registrarLogAtividade("CRIAR", "admin_orcamento_config", diretoriaId, { acao: "criarOrcamento", tipo, retidoDiretoria });
    return { success: true };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const currentConfig = (await gs.gsGetAdminConfig()) || {};
    const miniConfig = (currentConfig.admin_mini_erp_config || {}) as any;
    if (tipo === "aquisicao") {
      miniConfig.diretoriaBudgetsAquisicao = miniConfig.diretoriaBudgetsAquisicao || {};
      miniConfig.diretoriaBudgetsAquisicao[diretoriaId] = retidoDiretoria;
      miniConfig.gerenciaBudgetsAquisicao = miniConfig.gerenciaBudgetsAquisicao || {};
      Object.entries(repassesGerencias || {}).forEach(([gId, val]) => {
        miniConfig.gerenciaBudgetsAquisicao[gId] = val;
      });
    } else {
      miniConfig.diretoriaBudgetsServicos = miniConfig.diretoriaBudgetsServicos || {};
      miniConfig.diretoriaBudgetsServicos[diretoriaId] = retidoDiretoria;
      miniConfig.gerenciaBudgetsServicos = miniConfig.gerenciaBudgetsServicos || {};
      Object.entries(repassesGerencias || {}).forEach(([gId, val]) => {
        miniConfig.gerenciaBudgetsServicos[gId] = val;
      });
    }
    await gs.gsSaveAdminConfig("admin_mini_erp_config", miniConfig);
    await registrarLogAtividade("EDITAR", "admin_orcamento_config", diretoriaId, { acao: "enviarOrcamento", tipo, retidoDiretoria });
    return { success: true };
  }

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
  if (gs.isGoogleSheetsActive()) {
    const currentConfig = (await gs.gsGetAdminConfig()) || {};
    const miniConfig = (currentConfig.admin_mini_erp_config || {}) as any;
    if (tipo === "aquisicao") {
      if (miniConfig.diretoriaBudgetsAquisicao) delete miniConfig.diretoriaBudgetsAquisicao[diretoriaId];
      if (miniConfig.gerenciaBudgetsAquisicao) {
        (gerenciasIds || []).forEach(gId => delete miniConfig.gerenciaBudgetsAquisicao[gId]);
      }
    } else {
      if (miniConfig.diretoriaBudgetsServicos) delete miniConfig.diretoriaBudgetsServicos[diretoriaId];
      if (miniConfig.gerenciaBudgetsServicos) {
        (gerenciasIds || []).forEach(gId => delete miniConfig.gerenciaBudgetsServicos[gId]);
      }
    }
    await gs.gsSaveAdminConfig("admin_mini_erp_config", miniConfig);
    await registrarLogAtividade("EXCLUIR", "admin_orcamento_config", diretoriaId, { acao: "deletarOrcamento", tipo, gerenciasIds });
    return { success: true };
  }

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

export async function getLogsAtividades(): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsAtividades(false)) || [];
  }

  const { data, error } = await supabase
    .from("logs_atividades")
    .select("*")
    .is("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLixeiraLogsAtividades(): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsAtividades(true)) || [];
  }

  const { data, error } = await supabase
    .from("logs_atividades")
    .select("*")
    .eq("is_deleted", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getFuncionariosNomes() {
  if (gs.isGoogleSheetsActive()) {
    try {
      const data = await gs.gsGetFuncionarios();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (_e) {
      console.warn("Aviso ao buscar funcionários via gsGetFuncionarios, tentando fallback por GID:", _e);
      try {
        const fallback = await gs.gsGetDataByGid("553474173");
        if (fallback && Array.isArray(fallback.data) && fallback.data.length > 0) {
          return fallback.data;
        }
      } catch (_e2) {
        console.error("Falha no fallback de funcionários por GID:", _e2);
      }
    }
  }

  const { data, error } = await supabase
    .from("funcionarios")
    .select("matricula, nome, diretoria_id, gerencia_id");

  if (error) {
    console.warn("Erro ao buscar funcionários no Supabase, tentando fallback Google Sheets:", error);
    try {
      const fallback = await gs.gsGetDataByGid("553474173");
      if (fallback && Array.isArray(fallback.data) && fallback.data.length > 0) {
        return fallback.data;
      }
    } catch (_e3) {
      console.warn("Falha ao recuperar funcionários:", _e3);
    }
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
  if (gs.isGoogleSheetsActive()) {
    try {
      await gs.gsRegistrarLogOrcamentario({
        ano: 2027,
        centro_custo_id: diretoriaId,
        referencia_tipo: 'solicitacao',
        referencia_id: solicitacaoId,
        acao,
        valor
      });
    } catch (e) {
      console.warn("Aviso ao registrar log orçamentário no Google Sheets:", e);
    }
    return;
  }

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

  if (gs.isGoogleSheetsActive()) {
    try {
      const prepared = logs.map(l => ({
        ano: 2027,
        centro_custo_id: l.diretoriaId,
        referencia_tipo: 'solicitacao',
        referencia_id: l.solicitacaoId,
        acao: l.acao,
        valor: l.valor
      }));
      await gs.gsRegistrarLogsOrcamentariosBulk(prepared);
    } catch (e) {
      console.warn("Aviso ao registrar logs orçamentários em lote no Google Sheets:", e);
    }
    return;
  }

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
  if (gs.isGoogleSheetsActive()) {
    return await gs.gsDeleteLogAtividade(id);
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsAtividadeBulk(ids);
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    return await gs.gsRestoreLogAtividade(id);
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsRestoreLogsAtividadeBulk(ids);
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk([id]);
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk(ids);
    return true;
  }

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
  if (!tableName || !id || gs.isGoogleSheetsActive()) return null;
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", id)
      .single();
      
    if (error) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
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
  if (gs.isGoogleSheetsActive()) {
    try {
      return (await gs.gsGetLogsOrcamentarios()) || [];
    } catch {
      return [];
    }
  }

  try {
    const { data, error } = await supabase
      .from("log_orcamentario")
      .select(`
        *,
        centro_custo:centro_custo_id(codigo, nome, diretoria_id)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Erro ao buscar logs orçamentários:", error);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

export async function deleteLogOrcamentario(id: string): Promise<boolean> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsOrcamentarioBulk([id]);
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsOrcamentarioBulk(ids);
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetRestricoesAtividades();
    let list = rows || [];
    if (periodoId) {
      list = list.filter((r: any) => String(r.periodo_id) === String(periodoId));
    }
    return list.map((r: any) => ({
      id: r.id,
      periodo_id: r.periodo_id,
      escopo_tipo: r.escopo_tipo || r.escopo,
      diretoria_id: r.diretoria_id,
      gerencia_id: r.gerencia_id,
      perfil: r.perfil,
      modulo: r.modulo,
      atividade: r.atividade,
      status: r.status,
      ativo: r.ativo !== false && r.ativo !== "false",
      observacao: r.observacao || r.mensagem || "",
      criado_por: r.criado_por || r.bloqueado_por || "",
      created_at: r.created_at,
      updated_at: r.updated_at,
      periodo_nome: r.periodo_nome || "",
      diretoria_sigla: r.diretoria_sigla || "",
      gerencia_sigla: r.gerencia_sigla || "",
    }));
  }

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

  if (gs.isGoogleSheetsActive()) {
    const res = await gs.gsCreateRestricaoAtividade(insertPayload);
    const newId = (res as any)?.data?.id || (res as any)?.id || ("res-" + Date.now());
    await registrarLogAtividade("CRIAR", "restricoes_atividades", newId, insertPayload);
    return {
      id: newId,
      ...insertPayload,
      periodo_nome: "",
      diretoria_sigla: "",
      gerencia_sigla: "",
    } as RestricaoAtividade;
  }

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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsCreateRestricoesAtividadesBulk(insertPayloads);
    return true;
  }

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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateRestricaoAtividade(id, updatePayload);
    await registrarLogAtividade("EDITAR", "restricoes_atividades", id, updatePayload);
    return {
      id,
      ...updates,
      periodo_nome: updates.periodo_nome || "",
      diretoria_sigla: updates.diretoria_sigla || "",
      gerencia_sigla: updates.gerencia_sigla || "",
    } as RestricaoAtividade;
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsToggleRestricaoAtividade(id, String(ativo));
    await registrarLogAtividade(
      ativo ? "ATIVAR" : "DESATIVAR",
      "restricoes_atividades",
      id,
      { ativo }
    );
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteRestricaoAtividade(id);
    await registrarLogAtividade("EXCLUIR", "restricoes_atividades", id);
    return true;
  }

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

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteRestricoesAtividadesBulk(ids);
    try {
      await registrarLogAtividadeBulk("EXCLUIR", "restricoes_atividades", ids, { total: ids.length });
    } catch (logErr) {
      console.warn("Aviso ao registrar log de exclusão em massa de restrições:", logErr);
    }
    return true;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const list = await getRestricoesAtividades(params.periodo_id);
    const existing = list.find(r => 
      String(r.periodo_id) === String(params.periodo_id) &&
      r.escopo_tipo === "perfil" &&
      r.perfil === params.perfil &&
      r.modulo === params.modulo &&
      r.atividade === params.atividade
    );

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

  if (gs.isGoogleSheetsActive()) {
    const list = await getRestricoesAtividades(params.periodo_id);

    if (params.escopo_tipo === "gerencia") {
      await Promise.all(
        params.target_ids.map(async (gerencia_id) => {
          const existing = list.find(r => 
            String(r.periodo_id) === String(params.periodo_id) &&
            r.escopo_tipo === "gerencia" &&
            String(r.gerencia_id) === String(gerencia_id) &&
            r.modulo === params.modulo &&
            r.atividade === params.atividade
          );

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

    if (params.escopo_tipo === "diretoria") {
      await Promise.all(
        params.target_ids.map(async (diretoria_id) => {
          const existing = list.find(r => 
            String(r.periodo_id) === String(params.periodo_id) &&
            r.escopo_tipo === "diretoria" &&
            String(r.diretoria_id) === String(diretoria_id) &&
            r.modulo === params.modulo &&
            r.atividade === params.atividade
          );

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
  if (gs.isGoogleSheetsActive()) {
    const gerencias = await gs.gsGetGerencias();
    const targetGer = (gerencias || []).find((g: any) => String(g.id) === String(targetGerenciaId));
    const targetDirId = targetGer?.diretoria_id || "";
    await gs.gsTransferirSolicitacoesParaGerenciaBulk(ids, targetGerenciaId, targetDirId);
    await registrarLogAtividadeBulk("TRANSFERIR", "solicitacoes", ids, {
      acao: "transferir_para_gerencia_bulk",
      gerencia_destino_id: targetGerenciaId,
    });
    return;
  }

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
  if (gs.isGoogleSheetsActive()) {
    const gerencias = await gs.gsGetGerencias();
    const targetGer = (gerencias || []).find((g: any) => String(g.id) === String(targetGerenciaId));
    const targetDirId = targetGer?.diretoria_id || "";
    await gs.gsTransferirServicosParaGerenciaBulk(ids, targetGerenciaId, targetDirId);
    await registrarLogAtividadeBulk("TRANSFERIR", "servicos", ids, {
      acao: "transferir_para_gerencia_bulk",
      gerencia_destino_id: targetGerenciaId,
    });
    return;
  }

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

