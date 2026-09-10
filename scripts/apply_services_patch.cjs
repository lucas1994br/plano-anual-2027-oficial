const fs = require('fs');
const path = require('path');

const srcFile = path.resolve('src/lib/services.backup.ts');
const targetFile = path.resolve('src/lib/services.ts');

let content = fs.readFileSync(srcFile, 'utf8').replace(/\r\n/g, '\n');

// Top imports and helper
const importTarget = 'import { supabase } from "./supabaseClient.ts";';
const importReplacement = `import { supabase } from "./supabaseClient.ts";
import * as gs from "./googleSheetsClient.ts";

function normalizePeriodo(p: any) {
  if (!p) return p;
  return {
    ...p,
    nome: p.nome || (p.ano ? \`PAC \${p.ano}\` : "Plano Anual 2027"),
    inicio: p.inicio ? String(p.inicio).split("T")[0] : "",
    fim: p.fim ? String(p.fim).split("T")[0] : "",
    ativo: p.ativo === true || p.ativo === "true" || p.ativo === 1,
  };
}

function mapDbToPlanItem(s: any): PlanItem {
  if (!s) return s;
  return {
    id: s.id,
    item_id: s.item_id,
    codigo: s.item?.codigo ?? (s.codigo ? Number(s.codigo) : 0),
    descricao: s.descricao || s.item?.descricao || "",
    categoria: s.categoria || s.item?.categoria || "diversos",
    unidade: s.unidade || s.item?.unidade || "un",
    valorUnitario: Number(s.valor_unitario ?? s.item?.valor_unitario ?? 0),
    valor_unitario: Number(s.valor_unitario ?? s.item?.valor_unitario ?? 0),
    qtdEstimada: Number(s.qtd_estimada ?? 0),
    qtd_estimada: Number(s.qtd_estimada ?? 0),
    prioridade: s.prioridade || s.grau_prioridade || "Baixa",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
    justificativaRejeicao: s.justificativa_rejeicao || "",
    justificativa_rejeicao: s.justificativa_rejeicao || "",
    gerencia: s.gerencias?.sigla || s.gerencia || "",
    gerencia_id: s.gerencia_id,
    diretoria_id: s.diretoria_id,
    diretoriaSigla: s.diretoriaSigla || s.diretorias?.sigla,
    periodo_id: s.periodo_id,
    created_at: s.created_at,
    updated_at: s.updated_at,
  } as unknown as PlanItem;
}`;
content = content.replace(importTarget, importReplacement);

function replaceUnique(findStr, replaceStr) {
  const normFind = findStr.replace(/\r\n/g, '\n');
  if (!content.includes(normFind)) {
    console.error('NOT FOUND:', normFind.substring(0, 50));
    return false;
  }
  content = content.replace(normFind, replaceStr.replace(/\r\n/g, '\n'));
  return true;
}

// 1. registrarLogAtividade
replaceUnique(
  `    // Upsert to ensure FK constraint is satisfied without overwriting existing names
    await supabase.from("funcionarios").upsert`,
  `    if (gs.isGoogleSheetsActive()) {
      await gs.gsRegistrarLogAtividade(matricula, acao, tabelaAfetada, registroId, detalhes);
      return;
    }

    // Upsert to ensure FK constraint is satisfied without overwriting existing names
    await supabase.from("funcionarios").upsert`
);

// 2. registrarLogAtividadeBulk
replaceUnique(
  `    // Upsert to ensure FK constraint is satisfied without overwriting existing names
    await supabase.from("funcionarios").upsert([{
      matricula,
      nome: \`Usuário \${matricula}\`
    }], { onConflict: 'matricula', ignoreDuplicates: true });

    const payload = registrosIds.map(id => ({`,
  `    if (gs.isGoogleSheetsActive()) {
      for (const id of registrosIds) {
        await gs.gsRegistrarLogAtividade(matricula, acao, tabelaAfetada, id, detalhes);
      }
      return;
    }

    // Upsert to ensure FK constraint is satisfied without overwriting existing names
    await supabase.from("funcionarios").upsert([{
      matricula,
      nome: \`Usuário \${matricula}\`
    }], { onConflict: 'matricula', ignoreDuplicates: true });

    const payload = registrosIds.map(id => ({`
);

// 3. getDiretorias
replaceUnique(
  `  const query = await supabase
    .from("diretorias")
    .select("*")
    .order("sigla");`,
  `  if (gs.isGoogleSheetsActive()) {
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
    .order("sigla");`
);

// 4. getGerenciasByDiretoria
replaceUnique(
  `export async function getGerenciasByDiretoria(
  diretoriaId: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase`,
  `export async function getGerenciasByDiretoria(
  diretoriaId: string
): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias(diretoriaId);
    return (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
  }

  const { data, error } = await supabase`
);

// 5. getAllGerencias & getTodasGerencias
replaceUnique(
  `export async function getAllGerencias(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase`,
  `export async function getAllGerencias(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias();
    return (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
  }

  const { data, error } = await supabase`
);

replaceUnique(
  `export async function getTodasGerencias(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase`,
  `export async function getTodasGerencias(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias();
    return (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
  }

  const { data, error } = await supabase`
);

// 6. getDiretoriasComDetalhes
replaceUnique(
  `export async function getDiretoriasComDetalhes(): Promise<
  (Diretoria & { totalGerencias: number; totalItens: number })[]
> {
  const { data: diretorias, error: errDir } = await supabase`,
  `export async function getDiretoriasComDetalhes(): Promise<
  (Diretoria & { totalGerencias: number; totalItens: number })[]
> {
  if (gs.isGoogleSheetsActive()) {
    const [diretorias, gerencias, solicitacoes, servicos] = await Promise.all([
      gs.gsGetDiretorias(),
      gs.gsGetGerencias(),
      gs.gsGetSolicitacoes(),
      gs.gsGetServicos()
    ]);
    return (diretorias || []).map((dir: any) => {
      const gCount = (gerencias || []).filter((g: any) => String(g.diretoria_id) === String(dir.id) && g.ativa !== false).length;
      const sCount = (solicitacoes || []).filter((s: any) => String(s.diretoria_id) === String(dir.id)).length;
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

  const { data: diretorias, error: errDir } = await supabase`
);

// 7. getPeriodosAtivos & getTodosPeriodos
replaceUnique(
  `export async function getPeriodosAtivos(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase`,
  `export async function getPeriodosAtivos(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const list = await gs.gsGetPeriodos();
    return (list || []).map(normalizePeriodo).filter((p: any) => p.ativo);
  }

  const { data, error } = await supabase`
);

replaceUnique(
  `export async function getTodosPeriodos(): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase`,
  `export async function getTodosPeriodos(): Promise<Record<string, unknown>[]> {
  if (gs.isGoogleSheetsActive()) {
    const list = await gs.gsGetPeriodos();
    return (list || []).map(normalizePeriodo);
  }

  const { data, error } = await supabase`
);

// 8. createPeriodo & updatePeriodo
replaceUnique(
  `export async function createPeriodo(periodo: {
  nome: string;
  inicio: string;
  fim: string;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase`,
  `export async function createPeriodo(periodo: {
  nome: string;
  inicio: string;
  fim: string;
}): Promise<Record<string, unknown>> {
  if (gs.isGoogleSheetsActive()) {
    const saved = await gs.gsCreatePeriodo({ ...periodo, ativo: false });
    await registrarLogAtividade("CRIAR", "periodos", saved.id || "novo", { periodo });
    return saved || {};
  }

  const { data, error } = await supabase`
);

replaceUnique(
  `export async function updatePeriodo(
  periodoId: string,
  updates: {
    nome?: string;
    inicio?: string;
    fim?: string;
    ativo?: boolean;
  }
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase`,
  `export async function updatePeriodo(
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

  const { data, error } = await supabase`
);

// 9. getSolicitacoesByGerencia
replaceUnique(
  `export async function getSolicitacoesByGerencia(
  gerenciaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getSolicitacoesByGerencia(
  gerenciaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ gerencia_id: gerenciaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToPlanItem);
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

// 10. deleteSolicitacao & deleteSolicitacoesBulk
replaceUnique(
  `  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  const idStr = String(itemId);`,
  `  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteSolicitacao(String(itemId));
    await registrarLogAtividade("EXCLUIR", "solicitacoes", String(itemId));
    return true;
  }

  const idStr = String(itemId);`
);

replaceUnique(
  `  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  const stringIds = itemIds.map(String);`,
  `  await assertActivityAllowed({
    modulo: "aquisicao",
    atividade: "excluir_item",
  });

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteSolicitacoesBulk(itemIds.map(String));
    await registrarLogAtividade("EXCLUIR", "solicitacoes", "BULK", { ids: itemIds });
    return true;
  }

  const stringIds = itemIds.map(String);`
);

// 11. getSolicitacoesByDiretoria & getSolicitacoesByPeriodo
replaceUnique(
  `export async function getSolicitacoesByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getSolicitacoesByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<PlanItem[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ diretoria_id: diretoriaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToPlanItem);
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

replaceUnique(
  `export async function getSolicitacoesByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<PlanItem[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getSolicitacoesByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<PlanItem[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ periodo_id: periodoId });
    return (rows || []).map(mapDbToPlanItem);
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

// 12. getSolicitacoesResumoByPeriodo & getServicosResumoByPeriodo
replaceUnique(
  `export async function getSolicitacoesResumoByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getSolicitacoesResumoByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetSolicitacoes({ periodo_id: periodoId })) || [];
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

replaceUnique(
  `export async function getServicosResumoByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getServicosResumoByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetServicos({ periodo_id: periodoId })) || [];
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

// 13. getSolicitacoesCompras & getServicosCompras
replaceUnique(
  `export async function getSolicitacoesCompras(
  periodoId: string
): Promise<unknown[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getSolicitacoesCompras(
  periodoId: string
): Promise<unknown[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({
      periodo_id: periodoId,
      status: "aprovado,em_compra,concluido",
    });
    return (rows || []).map(mapDbToPlanItem);
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

replaceUnique(
  `export async function getServicosCompras(periodoId: string): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>`,
  `export async function getServicosCompras(periodoId: string): Promise<unknown[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({
      periodo_id: periodoId,
      status: "aprovado,em_compra,concluido",
    });
    return (rows || []).map(mapDbToServicoItem);
  }

  return await fetchAllPages<unknown>((from, to) =>`
);

// 14. createSolicitacao
replaceUnique(
  `  const { data, error } = await supabase
    .from("solicitacoes")
    .insert([payload])
    .select()
    .single();`,
  `  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateSolicitacao({ ...payload, codigo: solicitacao.codigo, descricao: solicitacao.descricao, categoria: solicitacao.categoria, unidade: solicitacao.unidade });
    await registrarLogAtividade("CRIAR", "solicitacoes", created.id, payload);
    return mapDbToPlanItem(created);
  }

  const { data, error } = await supabase
    .from("solicitacoes")
    .insert([payload])
    .select()
    .single();`
);

// 15. updateSolicitacao
replaceUnique(
  `  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("solicitacoes")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();`,
  `  dbUpdates.updated_at = new Date().toISOString();

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
    .single();`
);

// 16. updateSolicitacaoStatus & updateSolicitacaoStatusBulk
replaceUnique(
  `  const { data, error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();`,
  `  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateSolicitacaoStatus(id, status, justificativa);
    await registrarLogAtividade("STATUS", "solicitacoes", id, { acao: "updateSolicitacaoStatus", status_novo: status, justificativa });
    return mapDbToPlanItem(updated);
  }

  const { data, error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();`
);

replaceUnique(
  `  const { error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .in("id", ids);`,
  `  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateSolicitacaoStatusBulk(ids, status, justificativa);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacaoStatusBulk", status_novo: status, justificativa });
    return;
  }

  const { error } = await supabase
    .from("solicitacoes")
    .update(updates)
    .in("id", ids);`
);

// 17. updateServicoStatusBulk
replaceUnique(
  `  const { error } = await supabase
    .from("servicos")
    .update(updates)
    .in("id", ids);`,
  `  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateServicoStatusBulk(ids, status, justificativa);
    await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicoStatusBulk", status_novo: status, justificativa });
    return;
  }

  const { error } = await supabase
    .from("servicos")
    .update(updates)
    .in("id", ids);`
);

// 18. validateAccessCode
replaceUnique(
  `export async function validateAccessCode(
  code: string,
  scope: "diretoria" | "gerencia" | "admin" | "compras"
): Promise<AccessCodeResponse> {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error("Código de acesso vazio");
  }

  try {
    // Busca direta no banco de dados (ignorando a Edge Function)`,
  `export async function validateAccessCode(
  code: string,
  scope: "diretoria" | "gerencia" | "admin" | "compras"
): Promise<AccessCodeResponse> {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error("Código de acesso vazio");
  }

  if (gs.isGoogleSheetsActive()) {
    const res = await gs.gsValidateAccessCode(normalizedCode, scope);
    if (!res || !res.scope) {
      throw new Error("Código de acesso inválido ou inativo");
    }
    return res as AccessCodeResponse;
  }

  try {
    // Busca direta no banco de dados (ignorando a Edge Function)`
);

// 19. getItensCatalogo
replaceUnique(
  `export default async function getItensCatalogo(): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>`,
  `export default async function getItensCatalogo(): Promise<unknown[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetItensCatalogo()) || [];
  }

  return await fetchAllPages<unknown>((from, to) =>`
);

// 20. getAdminMiniErpConfigDb & saveAdminMiniErpConfigDb
replaceUnique(
  `export async function getAdminMiniErpConfigDb() {
  const { data: orcamentos } = await supabase`,
  `export async function getAdminMiniErpConfigDb(): Promise<Partial<AdminBudgetConfig> | null> {
  if (gs.isGoogleSheetsActive()) {
    const config = await gs.gsGetAdminConfig();
    return (config?.admin_mini_erp_config as Partial<AdminBudgetConfig>) || null;
  }

  const { data: orcamentos } = await supabase`
);

replaceUnique(
  `export async function saveAdminMiniErpConfigDb(config: {
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
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function saveAdminMiniErpConfigDb(config: {
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

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

// 21. getServicosCatalogo, create, update, delete
replaceUnique(
  `export async function getServicosCatalogo(): Promise<unknown[]> {
  return await fetchAllPages<unknown>((from, to) =>`,
  `export async function getServicosCatalogo(): Promise<unknown[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetServicosCatalogo()) || [];
  }

  return await fetchAllPages<unknown>((from, to) =>`
);

replaceUnique(
  `export async function createServicoCatalogoAndDistribuir(servico: {
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
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function createServicoCatalogoAndDistribuir(servico: {
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

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

replaceUnique(
  `export async function updateServicoCatalogoAdmin(
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
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function updateServicoCatalogoAdmin(
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

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

replaceUnique(
  `export async function deleteServicoCatalogoAdmin(
  servicoId: string
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function deleteServicoCatalogoAdmin(
  servicoId: string
): Promise<unknown> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicoCatalogo(servicoId);
    await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId);
    return { success: true };
  }

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

// 22. createItemCatalogoAndDistribuir, updateItemCatalogoAdmin, deleteItemCatalogoAdmin
replaceUnique(
  `export async function createItemCatalogoAndDistribuir(item: {
  codigo: number;
  descricao: string;
  categoria: string;
  unidade: string;
  valorUnitario: number;
}): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function createItemCatalogoAndDistribuir(item: {
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

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

replaceUnique(
  `export async function updateItemCatalogoAdmin(
  itemId: string,
  updates: Partial<{
    codigo: number;
    descricao: string;
    categoria: string;
    unidade: string;
    valor_unitario: number;
  }>
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function updateItemCatalogoAdmin(
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

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

replaceUnique(
  `export async function deleteItemCatalogoAdmin(
  itemId: string
): Promise<unknown> {
  const adminAccessCode = sessionStorage.getItem("access-code:admin");`,
  `export async function deleteItemCatalogoAdmin(
  itemId: string
): Promise<unknown> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteItemCatalogo(itemId);
    await registrarLogAtividade("EXCLUIR", "itens_catalogo", itemId);
    return { success: true };
  }

  const adminAccessCode = sessionStorage.getItem("access-code:admin");`
);

// 23. getServicosByGerencia, getServicosByDiretoria, getServicosByPeriodo
replaceUnique(
  `export async function getServicosByGerencia(
  gerenciaId: string,
  periodoId: string
): Promise<ServicoItem[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("gerencia_id", gerenciaId)
    .eq("periodo_id", periodoId)
    .order("item");`,
  `export async function getServicosByGerencia(
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
    .order("item");`
);

replaceUnique(
  `export async function getServicosByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<ServicoItem[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getServicosByDiretoria(
  diretoriaId: string,
  periodoId: string
): Promise<ServicoItem[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ diretoria_id: diretoriaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

replaceUnique(
  `export async function getServicosByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  const data = await fetchAllPages<any>((from, to) =>`,
  `export async function getServicosByPeriodo({
  periodoId,
}: {
  periodoId: string;
}): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }

  const data = await fetchAllPages<any>((from, to) =>`
);

// 24. createServico, updateServico, deleteServico, deleteServicosBulk
replaceUnique(
  `  const { data, error } = await supabase
    .from("servicos")
    .insert([dbRow])
    .select()
    .single();`,
  `  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateServico(dbRow);
    await registrarLogAtividade("CRIAR", "servicos", created.id, servico);
    return mapDbToServicoItem(created);
  }

  const { data, error } = await supabase
    .from("servicos")
    .insert([dbRow])
    .select()
    .single();`
);

replaceUnique(
  `export async function updateServico(
  servicoId: string,
  updates: Partial<ServicoItem> | any
): Promise<ServicoItem | undefined> {
  const isNovo = (updates.tipo_contratacao || updates.tipoContratacao) === "Novo";`,
  `export async function updateServico(
  servicoId: string,
  updates: Partial<ServicoItem> | any
): Promise<ServicoItem | undefined> {
  if (gs.isGoogleSheetsActive()) {
    const dbUpdates = mapServicoItemToDb(updates);
    const updated = await gs.gsUpdateServico(servicoId, dbUpdates);
    await registrarLogAtividade("EDITAR", "servicos", servicoId, updates);
    return mapDbToServicoItem(updated);
  }

  const isNovo = (updates.tipo_contratacao || updates.tipoContratacao) === "Novo";`
);

replaceUnique(
  `export const deleteServico = async (idOrItem: string | number): Promise<boolean> => {
  if (!idOrItem) throw new Error("ID inválido para exclusão");`,
  `export const deleteServico = async (idOrItem: string | number): Promise<boolean> => {
  if (!idOrItem) throw new Error("ID inválido para exclusão");

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServico(String(idOrItem));
    await registrarLogAtividade("EXCLUIR", "servicos", String(idOrItem));
    return true;
  }`
);

replaceUnique(
  `export async function deleteServicosBulk(itemIds: (string | number)[]): Promise<boolean> {
  if (!itemIds || itemIds.length === 0) return false;

  await assertActivityAllowed({
    modulo: "servicos_existentes",
    atividade: "excluir_servico",
  });`,
  `export async function deleteServicosBulk(itemIds: (string | number)[]): Promise<boolean> {
  if (!itemIds || itemIds.length === 0) return false;

  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicosBulk(itemIds.map(String));
    await registrarLogAtividadeBulk("EXCLUIR", "servicos", itemIds.map(String));
    return true;
  }

  await assertActivityAllowed({
    modulo: "servicos_existentes",
    atividade: "excluir_servico",
  });`
);

// 25. updateSolicitacoesBulkData & updateServicosBulkData
replaceUnique(
  `export async function updateSolicitacoesBulkData(
  ids: string[],
  updates: Partial<PlanItem> | any
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};`,
  `export async function updateSolicitacoesBulkData(
  ids: string[],
  updates: Partial<PlanItem> | any
): Promise<void> {
  if (gs.isGoogleSheetsActive()) {
    const items = ids.map(id => ({ id, ...updates }));
    await gs.gsUpdateSolicitacoesBulkData(items);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacoesBulkData" });
    return;
  }

  const dbUpdates: Record<string, unknown> = {};`
);

replaceUnique(
  `export async function updateServicosBulkData(
  ids: string[],
  updates: Partial<ServicoItem> | any
): Promise<void> {
  const dbUpdates = mapServicoItemToDb(updates);`,
  `export async function updateServicosBulkData(
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

  const dbUpdates = mapServicoItemToDb(updates);`
);

// 26. Logs de atividades
replaceUnique(
  `export async function getLogsAtividades() {
  const { data, error } = await supabase`,
  `export async function getLogsAtividades(): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsAtividades(false)) || [];
  }

  const { data, error } = await supabase`
);

replaceUnique(
  `export async function getLixeiraLogsAtividades() {
  const { data, error } = await supabase`,
  `export async function getLixeiraLogsAtividades(): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsAtividades(true)) || [];
  }

  const { data, error } = await supabase`
);

replaceUnique(
  `export async function deleteLogAtividade(id: string): Promise<boolean> {
  const { error } = await supabase`,
  `export async function deleteLogAtividade(id: string): Promise<boolean> {
  if (gs.isGoogleSheetsActive()) {
    return await gs.gsDeleteLogAtividade(id);
  }

  const { error } = await supabase`
);

replaceUnique(
  `export async function deleteLogsAtividadeBulk(ids: string[]) {
  const { error } = await supabase`,
  `export async function deleteLogsAtividadeBulk(ids: string[]) {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsAtividadeBulk(ids);
    return true;
  }

  const { error } = await supabase`
);

replaceUnique(
  `export async function restoreLogAtividade(id: string): Promise<boolean> {
  const { error } = await supabase`,
  `export async function restoreLogAtividade(id: string): Promise<boolean> {
  if (gs.isGoogleSheetsActive()) {
    return await gs.gsRestoreLogAtividade(id);
  }

  const { error } = await supabase`
);

replaceUnique(
  `export async function restoreLogsAtividadeBulk(ids: string[]) {
  const { error } = await supabase`,
  `export async function restoreLogsAtividadeBulk(ids: string[]) {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsRestoreLogsAtividadeBulk(ids);
    return true;
  }

  const { error } = await supabase`
);

replaceUnique(
  `export async function hardDeleteLogAtividade(id: string): Promise<boolean> {
  const { error } = await supabase`,
  `export async function hardDeleteLogAtividade(id: string): Promise<boolean> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk([id]);
    return true;
  }

  const { error } = await supabase`
);

replaceUnique(
  `export async function hardDeleteLogsAtividadeBulk(ids: string[]) {
  const { error } = await supabase`,
  `export async function hardDeleteLogsAtividadeBulk(ids: string[]) {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk(ids);
    return true;
  }

  const { error } = await supabase`
);

// 27. Logs orçamentários
replaceUnique(
  `export async function getLogsOrcamentarios(): Promise<any[]> {
  const { data, error } = await supabase`,
  `export async function getLogsOrcamentarios(): Promise<any[]> {
  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsOrcamentarios()) || [];
  }

  const { data, error } = await supabase`
);

replaceUnique(
  `export async function deleteLogOrcamentario(id: string): Promise<boolean> {
  const { error } = await supabase`,
  `export async function deleteLogOrcamentario(id: string): Promise<boolean> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsOrcamentarioBulk([id]);
    return true;
  }

  const { error } = await supabase`
);

replaceUnique(
  `export async function deleteLogsOrcamentarioBulk(ids: string[]): Promise<boolean> {
  const { error } = await supabase`,
  `export async function deleteLogsOrcamentarioBulk(ids: string[]): Promise<boolean> {
  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsOrcamentarioBulk(ids);
    return true;
  }

  const { error } = await supabase`
);

// 28. Restrições de atividades
replaceUnique(
  `export async function getRestricoesAtividades(
  periodoId?: string
): Promise<RestricaoAtividade[]> {
  let query = supabase`,
  `export async function getRestricoesAtividades(
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

  let query = supabase`
);

// 29. Transferência para gerência
replaceUnique(
  `export async function transferirSolicitacoesParaGerenciaBulk(
  ids: string[],
  targetGerenciaId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase`,
  `export async function transferirSolicitacoesParaGerenciaBulk(
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

  const { error } = await supabase`
);

replaceUnique(
  `export async function transferirServicosParaGerenciaBulk(
  ids: string[],
  targetGerenciaId: string
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase`,
  `export async function transferirServicosParaGerenciaBulk(
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

  const { error } = await supabase`
);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('src/lib/services.ts patched with CRLF-normalized exact replacement points!');
