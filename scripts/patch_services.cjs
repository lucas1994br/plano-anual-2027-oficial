const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('src/lib/services.ts');
const backupFile = path.resolve('src/lib/services.backup.ts');

if (!fs.existsSync(backupFile)) {
  fs.copyFileSync(targetFile, backupFile);
  console.log('Backup criado em src/lib/services.backup.ts');
}

let content = fs.readFileSync(targetFile, 'utf8');

// 1. Inserir import e helper mapDbToPlanItem no topo
if (!content.includes('import * as gs from "./googleSheetsClient.ts";')) {
  const importTarget = 'import { supabase } from "./supabaseClient.ts";';
  const importReplacement = `import { supabase } from "./supabaseClient.ts";\nimport * as gs from "./googleSheetsClient.ts";

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
}

// Helper para injetar bloco logo após a assinatura da função
function injectAfter(funcSignature, injectionCode) {
  if (content.includes(injectionCode.trim())) return; // Já injetado
  const idx = content.indexOf(funcSignature);
  if (idx === -1) {
    console.warn(`Assinatura não encontrada: ${funcSignature.substring(0, 50)}...`);
    return;
  }
  // Achar abertura da chave {
  const braceIdx = content.indexOf('{', idx);
  if (braceIdx === -1) return;

  const before = content.substring(0, braceIdx + 1);
  const after = content.substring(braceIdx + 1);
  content = before + '\n' + injectionCode + after;
}

// 2. Injetar guards do Google Sheets
injectAfter('export async function registrarLogAtividade(', `  if (gs.isGoogleSheetsActive()) {
    try {
      await gs.gsRegistrarLogAtividade(
        (typeof window !== "undefined" && (sessionStorage.getItem("access-code:admin") || sessionStorage.getItem("access-code:compras") || sessionStorage.getItem("access-code:diretoria") || sessionStorage.getItem("access-code:gerencia"))) || "sistema",
        acao, tabelaAfetada, registroId, detalhes
      );
      return;
    } catch (e) {
      console.warn("Falha ao registrar log no Google Sheets:", e);
    }
  }`);

injectAfter('export async function getDiretorias(): Promise<DiretoriaRow[]> {', `  if (gs.isGoogleSheetsActive()) {
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
  }`);

injectAfter('export async function getGerenciasByDiretoria(', `  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias(diretoriaId);
    return (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
  }`);

injectAfter('export async function getAllGerencias(): Promise<Record<string, unknown>[]> {', `  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias();
    return (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
  }`);

injectAfter('export async function getTodasGerencias(): Promise<Record<string, unknown>[]> {', `  if (gs.isGoogleSheetsActive()) {
    const data = await gs.gsGetGerencias();
    return (data || []).filter((g: any) => g.ativa !== false && g.ativa !== "false");
  }`);

injectAfter('export async function getDiretoriasComDetalhes(): Promise<', `  if (gs.isGoogleSheetsActive()) {
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
  }`);

injectAfter('export async function getPeriodosAtivos(): Promise<Record<string, unknown>[]> {', `  if (gs.isGoogleSheetsActive()) {
    const list = await gs.gsGetPeriodos();
    return (list || []).filter((p: any) => p.ativo === true || p.ativo === "true" || p.ativo === 1);
  }`);

injectAfter('export async function getTodosPeriodos(): Promise<Record<string, unknown>[]> {', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetPeriodos()) || [];
  }`);

injectAfter('export async function createPeriodo(periodo: {', `  if (gs.isGoogleSheetsActive()) {
    const saved = await gs.gsCreatePeriodo({ ...periodo, ativo: false });
    await registrarLogAtividade("CRIAR", "periodos", saved.id || "novo", { periodo });
    return saved || {};
  }`);

injectAfter('export async function updatePeriodo(', `  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdatePeriodo(periodoId, updates);
    await registrarLogAtividade("EDITAR", "periodos", periodoId, { updates });
    return updated || {};
  }`);

injectAfter('export async function getSolicitacoesByGerencia(', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ gerencia_id: gerenciaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToPlanItem);
  }`);

injectAfter('export async function getSolicitacoesByDiretoria(', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ diretoria_id: diretoriaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToPlanItem);
  }`);

injectAfter('export async function getSolicitacoesByPeriodo({', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({ periodo_id: periodoId });
    return (rows || []).map(mapDbToPlanItem);
  }`);

injectAfter('export async function getSolicitacoesCompras(', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetSolicitacoes({
      periodo_id: periodoId,
      status: "aprovado,em_compra,concluido",
    });
    return (rows || []).map(mapDbToPlanItem);
  }`);

injectAfter('export async function getServicosCompras(periodoId: string): Promise<unknown[]> {', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({
      periodo_id: periodoId,
      status: "aprovado,em_compra,concluido",
    });
    return (rows || []).map(mapDbToServicoItem);
  }`);

injectAfter('export async function getSolicitacoesResumoByPeriodo({', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetSolicitacoes({ periodo_id: periodoId })) || [];
  }`);

injectAfter('export async function getServicosResumoByPeriodo({', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetServicos({ periodo_id: periodoId })) || [];
  }`);

injectAfter('export async function createSolicitacao(solicitacao: Partial<PlanItem> & {', `  if (gs.isGoogleSheetsActive()) {
    const payload = {
      periodo_id: solicitacao.periodo_id,
      diretoria_id: solicitacao.diretoria_id,
      gerencia_id: solicitacao.gerencia_id,
      item_id: solicitacao.item_id || "",
      codigo: solicitacao.codigo ? Number(solicitacao.codigo) : 0,
      descricao: solicitacao.descricao || "",
      categoria: solicitacao.categoria || "diversos",
      unidade: solicitacao.unidade || "un",
      valor_unitario: solicitacao.valorUnitario ?? (solicitacao as any).valor_unitario ?? 0,
      qtd_estimada: solicitacao.qtdEstimada ?? (solicitacao as any).qtd_estimada ?? 0,
      prioridade: solicitacao.prioridade || "Baixa",
      observacao: solicitacao.observacao || "",
      status: solicitacao.status || "rascunho",
      justificativa_rejeicao: "",
    };
    const created = await gs.gsCreateSolicitacao(payload);
    await registrarLogAtividade("CRIAR", "solicitacoes", created.id, payload);
    return mapDbToPlanItem(created);
  }`);

injectAfter('export async function deleteSolicitacao(itemId: string | number): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteSolicitacao(String(itemId));
    await registrarLogAtividade("EXCLUIR", "solicitacoes", String(itemId));
    return true;
  }`);

injectAfter('export async function deleteSolicitacoesBulk(', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteSolicitacoesBulk(itemIds.map(String));
    await registrarLogAtividade("EXCLUIR", "solicitacoes", "BULK", { ids: itemIds });
    return true;
  }`);

injectAfter('export async function updateSolicitacaoStatus(', `  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateSolicitacaoStatus(id, status, justificativa);
    await registrarLogAtividade("STATUS", "solicitacoes", id, { acao: "updateSolicitacaoStatus", status_novo: status, justificativa });
    return mapDbToPlanItem(updated);
  }`);

injectAfter('export async function updateSolicitacaoStatusBulk(', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateSolicitacaoStatusBulk(ids, status, justificativa);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacaoStatusBulk", status_novo: status, justificativa });
    return;
  }`);

injectAfter('export async function updateServicoStatusBulk(', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateServicoStatusBulk(ids, status, justificativa);
    await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicoStatusBulk", status_novo: status, justificativa });
    return;
  }`);

injectAfter('export async function updateSolicitacoesBulkData(items: any[]): Promise<number> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateSolicitacoesBulkData(items);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", items.map(i => i.id), { acao: "updateSolicitacoesBulkData" });
    return items.length;
  }`);

injectAfter('export async function updateServicosBulkData(items: any[]): Promise<number> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsUpdateServicosBulkData(items.map(mapServicoItemToDb));
    await registrarLogAtividadeBulk("EDITAR", "servicos", items.map(i => i.id), { acao: "updateServicosBulkData" });
    return items.length;
  }`);

injectAfter('export async function getServicosByGerencia(', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ gerencia_id: gerenciaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }`);

injectAfter('export async function getServicosByDiretoria(', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ diretoria_id: diretoriaId, periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }`);

injectAfter('export async function getServicosByPeriodo({', `  if (gs.isGoogleSheetsActive()) {
    const rows = await gs.gsGetServicos({ periodo_id: periodoId });
    return (rows || []).map(mapDbToServicoItem);
  }`);

injectAfter('export async function createServico(', `  if (gs.isGoogleSheetsActive()) {
    const dbRow = mapServicoItemToDb(servico);
    const created = await gs.gsCreateServico(dbRow);
    await registrarLogAtividade("CRIAR", "servicos", created.id, servico);
    return mapDbToServicoItem(created);
  }`);

injectAfter('export async function updateServico(', `  if (gs.isGoogleSheetsActive()) {
    const dbUpdates = mapServicoItemToDb(updates);
    const updated = await gs.gsUpdateServico(id, dbUpdates);
    await registrarLogAtividade("EDITAR", "servicos", id, updates);
    return mapDbToServicoItem(updated);
  }`);

injectAfter('export async function deleteServico(id: string): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServico(id);
    await registrarLogAtividade("EXCLUIR", "servicos", id);
    return true;
  }`);

injectAfter('export async function deleteServicosBulk(ids: string[]): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicosBulk(ids);
    await registrarLogAtividadeBulk("EXCLUIR", "servicos", ids);
    return true;
  }`);

injectAfter('export async function getServicosCatalogo(): Promise<unknown[]> {', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetServicosCatalogo()) || [];
  }`);

injectAfter('export async function createServicoCatalogoAndDistribuir(', `  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateServicoCatalogo(servico);
    await registrarLogAtividade("CRIAR", "servicos_catalogo", (created as any)?.id || "novo", servico);
    return { success: true, data: created };
  }`);

injectAfter('export async function updateServicoCatalogoAdmin(', `  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateServicoCatalogo(servicoId, updates);
    await registrarLogAtividade("EDITAR", "servicos_catalogo", servicoId, updates);
    return { success: true, data: updated };
  }`);

injectAfter('export async function deleteServicoCatalogoAdmin(', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicoCatalogo(servicoId);
    await registrarLogAtividade("EXCLUIR", "servicos_catalogo", servicoId);
    return { success: true };
  }`);

injectAfter('export default async function getItensCatalogo(): Promise<unknown[]> {', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetItensCatalogo()) || [];
  }`);

injectAfter('export async function createItemCatalogoAndDistribuir(', `  if (gs.isGoogleSheetsActive()) {
    const created = await gs.gsCreateItemCatalogo(item);
    await registrarLogAtividade("CRIAR", "itens_catalogo", (created as any)?.id || "novo", item);
    return { success: true, data: created };
  }`);

injectAfter('export async function updateItemCatalogoAdmin(', `  if (gs.isGoogleSheetsActive()) {
    const updated = await gs.gsUpdateItemCatalogo(itemId, updates);
    await registrarLogAtividade("EDITAR", "itens_catalogo", itemId, updates);
    return { success: true, data: updated };
  }`);

injectAfter('export async function deleteItemCatalogoAdmin(', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteItemCatalogo(itemId);
    await registrarLogAtividade("EXCLUIR", "itens_catalogo", itemId);
    return { success: true };
  }`);

injectAfter('export async function validateAccessCode(', `  if (gs.isGoogleSheetsActive()) {
    const res = await gs.gsValidateAccessCode(normalizedCode, scope);
    if (!res || !res.scope) {
      throw new Error("Código de acesso inválido ou inativo");
    }
    return res as AccessCodeResponse;
  }`);

injectAfter('export async function getAdminMiniErpConfigDb() {', `  if (gs.isGoogleSheetsActive()) {
    const config = await gs.gsGetAdminConfig();
    return config?.admin_mini_erp_config || null;
  }`);

injectAfter('export async function saveAdminMiniErpConfigDb(config: AdminBudgetConfig) {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsSaveAdminConfig("admin_mini_erp_config", config);
    await registrarLogAtividade("EDITAR", "configuracoes", "admin-mini-erp-config", { acao: "saveAdminMiniErpConfigDb" });
    return { success: true };
  }`);

injectAfter('export async function getLogsAtividades() {', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsAtividades(false)) || [];
  }`);

injectAfter('export async function getLixeiraLogsAtividades() {', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsAtividades(true)) || [];
  }`);

injectAfter('export async function deleteLogAtividade(id: string): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    return await gs.gsDeleteLogAtividade(id);
  }`);

injectAfter('export async function deleteLogsAtividadeBulk(ids: string[]): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsAtividadeBulk(ids);
    return true;
  }`);

injectAfter('export async function restoreLogAtividade(id: string): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    return await gs.gsRestoreLogAtividade(id);
  }`);

injectAfter('export async function restoreLogsAtividadeBulk(ids: string[]): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsRestoreLogsAtividadeBulk(ids);
    return true;
  }`);

injectAfter('export async function hardDeleteLogAtividade(id: string): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk([id]);
    return true;
  }`);

injectAfter('export async function hardDeleteLogsAtividadeBulk(ids: string[]): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk(ids);
    return true;
  }`);

injectAfter('export async function getLogsOrcamentarios(): Promise<any[]> {', `  if (gs.isGoogleSheetsActive()) {
    return (await gs.gsGetLogsOrcamentarios()) || [];
  }`);

injectAfter('export async function deleteLogOrcamentario(id: string): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsOrcamentarioBulk([id]);
    return true;
  }`);

injectAfter('export async function deleteLogsOrcamentarioBulk(ids: string[]): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsOrcamentarioBulk(ids);
    return true;
  }`);

injectAfter('export async function getRestricoesAtividades(', `  if (gs.isGoogleSheetsActive()) {
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
  }`);

injectAfter('export async function transferirSolicitacoesParaGerenciaBulk(', `  if (gs.isGoogleSheetsActive()) {
    const gerencias = await gs.gsGetGerencias();
    const targetGer = (gerencias || []).find((g: any) => String(g.id) === String(targetGerenciaId));
    const targetDirId = targetGer?.diretoria_id || "";
    await gs.gsTransferirSolicitacoesParaGerenciaBulk(ids, targetGerenciaId, targetDirId);
    await registrarLogAtividadeBulk("TRANSFERIR", "solicitacoes", ids, {
      acao: "transferir_para_gerencia_bulk",
      gerencia_destino_id: targetGerenciaId,
    });
    return;
  }`);

injectAfter('export async function transferirServicosParaGerenciaBulk(', `  if (gs.isGoogleSheetsActive()) {
    const gerencias = await gs.gsGetGerencias();
    const targetGer = (gerencias || []).find((g: any) => String(g.id) === String(targetGerenciaId));
    const targetDirId = targetGer?.diretoria_id || "";
    await gs.gsTransferirServicosParaGerenciaBulk(ids, targetGerenciaId, targetDirId);
    await registrarLogAtividadeBulk("TRANSFERIR", "servicos", ids, {
      acao: "transferir_para_gerencia_bulk",
      gerencia_destino_id: targetGerenciaId,
    });
    return;
  }`);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('src/lib/services.ts atualizado com sucesso com delegações ao Google Sheets!');
