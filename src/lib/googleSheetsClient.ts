// deno-lint-ignore-file no-explicit-any

const OFFICIAL_DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbDfO2wQoN-i7u1NlR_k5IK64WwlthyY0JgebAq3fH0Q56fLjcTXDic1iMUTTmKvl4/exec";

const GOOGLE_SCRIPT_URL =
  (import.meta.env.VITE_GOOGLE_SCRIPT_URL as string | undefined)?.trim() ||
  OFFICIAL_DEFAULT_SCRIPT_URL;

export const GOOGLE_SPREADSHEET_URL =
  (import.meta.env.VITE_GOOGLE_SPREADSHEET_URL as string | undefined)?.trim() ||
  "https://docs.google.com/spreadsheets/d/1iAMhiwnwkKDznVYGjCxr-9lzHTiMMDQzmGUdoPUJfnc/edit?gid=604009512#gid=604009512";

export const GOOGLE_SPREADSHEET_ID =
  (import.meta.env.VITE_GOOGLE_SPREADSHEET_ID as string | undefined)?.trim() ||
  "1iAMhiwnwkKDznVYGjCxr-9lzHTiMMDQzmGUdoPUJfnc";

export const GOOGLE_SPREADSHEET_GID =
  (import.meta.env.VITE_GOOGLE_SPREADSHEET_GID as string | undefined)?.trim() ||
  "604009512";

/**
 * Retorna o link completo da Planilha Google apontando para a aba desejada (ou padrão gid=604009512)
 */
export function getSpreadsheetUrl(gid?: string | number): string {
  const targetGid = gid !== undefined ? String(gid) : GOOGLE_SPREADSHEET_GID;
  return `https://docs.google.com/spreadsheets/d/${GOOGLE_SPREADSHEET_ID}/edit?gid=${targetGid}#gid=${targetGid}`;
}

/**
 * Abre a Planilha Google oficial em uma nova aba do navegador com segurança
 */
export function openOfficialSpreadsheet(gid?: string | number): void {
  if (typeof window !== "undefined") {
    const url = getSpreadsheetUrl(gid);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export const isGoogleSheetsActive = (): boolean => {
  return Boolean(GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.startsWith("http"));
};

/**
 * Executa uma requisição GET para o Web App do Google Apps Script
 */
export async function gsGet<T = any>(
  action: string,
  params: Record<string, string | number | boolean | undefined | null> = {}
): Promise<T> {
  if (!isGoogleSheetsActive()) {
    throw new Error("VITE_GOOGLE_SCRIPT_URL não configurado");
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, String(val));
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP no Google Apps Script: ${response.status} ${response.statusText}`);
  }

  const rawText = await response.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Resposta inválida do Google Apps Script (servidor ou timeout): ${rawText.slice(0, 160)}`);
  }

  if (data && data.success === false) {
    throw new Error(data.error || "Erro desconhecido retornado pelo Google Apps Script");
  }

  return data.data !== undefined ? data.data : data;
}

/**
 * Executa uma requisição POST para o Web App do Google Apps Script
 * NOTA: Não enviamos o cabeçalho 'Content-Type: application/json' explicitamente
 * para evitar preflight CORS OPTIONS no navegador.
 * Inclui retry automático com backoff suave para contornar concorrência de ScriptLock transitória.
 */
export async function gsPost<T = any>(
  action: string,
  payload: Record<string, any> = {},
  retryCount: number = 0
): Promise<T> {
  if (!isGoogleSheetsActive()) {
    throw new Error("VITE_GOOGLE_SCRIPT_URL não configurado");
  }

  const body = JSON.stringify({ action, ...payload });

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      if ((response.status === 503 || response.status === 429 || response.status === 500) && retryCount < 2) {
        await new Promise((res) => setTimeout(res, 700 * (retryCount + 1)));
        return gsPost<T>(action, payload, retryCount + 1);
      }
      throw new Error(`Erro HTTP POST no Google Apps Script: ${response.status} ${response.statusText}`);
    }

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      if (retryCount < 2) {
        await new Promise((res) => setTimeout(res, 700 * (retryCount + 1)));
        return gsPost<T>(action, payload, retryCount + 1);
      }
      throw new Error(`Resposta inválida do Google Apps Script (servidor ou timeout): ${rawText.slice(0, 160)}`);
    }

    if (data && data.success === false) {
      const errMsg = String(data.error || "");
      const isLockError =
        data.isLockTimeout ||
        errMsg.toLowerCase().includes("lock") ||
        errMsg.toLowerCase().includes("ocupado");
      if (isLockError && retryCount < 2) {
        await new Promise((res) => setTimeout(res, 800 * (retryCount + 1)));
        return gsPost<T>(action, payload, retryCount + 1);
      }
      throw new Error(data.error || "Erro retornado pelo Google Apps Script");
    }

    return data.data !== undefined ? data.data : data;
  } catch (err: any) {
    if (
      retryCount < 2 &&
      (err.message?.includes("Failed to fetch") ||
        err.message?.includes("NetworkError") ||
        err.message?.includes("Load failed"))
    ) {
      await new Promise((res) => setTimeout(res, 800 * (retryCount + 1)));
      return gsPost<T>(action, payload, retryCount + 1);
    }
    throw err;
  }
}

// ================= MÉTODOS DE ALTO NÍVEL =================

// Diretorias e Gerências
export const gsGetDiretorias = () => gsGet("getDiretorias");
export const gsGetGerencias = (diretoria_id?: string) =>
  gsGet("getGerencias", { diretoria_id });
export const gsGetFuncionarios = () => gsGet("getFuncionarios");

// Períodos
export const gsGetPeriodos = () => gsGet("getPeriodos");
export const gsCreatePeriodo = (periodo: any) => gsPost("createPeriodo", { periodo });
export const gsUpdatePeriodo = (id: string, updates: any) =>
  gsPost("updatePeriodo", { id, updates });

// Códigos de Acesso
export const gsValidateAccessCode = (
  code: string,
  scope: string,
  diretoria_id?: string,
  gerencia_id?: string
) => gsPost("validateAccessCode", { code, scope, diretoria_id, gerencia_id });

// Solicitações (Aquisições)
export const gsGetSolicitacoes = (filters?: {
  gerencia_id?: string;
  diretoria_id?: string;
  periodo_id?: string;
  status?: string;
}) => gsGet("getSolicitacoes", filters);

export const gsGetSolicitacoesCountByDiretoria = () =>
  gsGet<Record<string, number>>("getSolicitacoesCountByDiretoria");

export const gsCreateSolicitacao = (solicitacao: any) =>
  gsPost("createSolicitacao", { solicitacao });

export const gsUpdateSolicitacao = (id: string, updates: any) =>
  gsPost("updateSolicitacao", { id, updates });

export const gsDeleteSolicitacao = (id: string) =>
  gsPost("deleteSolicitacao", { id });

export const gsDeleteSolicitacoesBulk = (ids: string[]) =>
  gsPost("deleteSolicitacoesBulk", { ids });

export const gsUpdateSolicitacaoStatus = (
  id: string,
  status: string,
  justificativa_rejeicao?: string
) => gsPost("updateSolicitacaoStatus", { id, status, justificativa_rejeicao });

export const gsUpdateSolicitacaoStatusBulk = (
  ids: string[],
  status: string,
  justificativa_rejeicao?: string
) => gsPost("updateSolicitacaoStatusBulk", { ids, status, justificativa_rejeicao });

export const gsUpdateSolicitacoesBulkData = (items: any[]) =>
  gsPost("updateSolicitacoesBulkData", { items });

export const gsTransferirSolicitacoesParaGerenciaBulk = (
  ids: string[],
  gerencia_id: string,
  diretoria_id: string
) => gsPost("transferirSolicitacoesParaGerenciaBulk", { ids, gerencia_id, diretoria_id });

// Serviços
export const gsGetServicos = (filters?: {
  gerencia_id?: string;
  diretoria_id?: string;
  periodo_id?: string;
  status?: string;
}) => gsGet("getServicos", filters);

export const gsCreateServico = (servico: any) =>
  gsPost("createServico", { servico });

export const gsUpdateServico = (id: string, updates: any) =>
  gsPost("updateServico", { id, updates });

export const gsDeleteServico = (id: string) =>
  gsPost("deleteServico", { id });

export const gsDeleteServicosBulk = (ids: string[]) =>
  gsPost("deleteServicosBulk", { ids });

export const gsUpdateServicoStatusBulk = (
  ids: string[],
  status: string,
  justificativa_rejeicao?: string
) => gsPost("updateServicoStatusBulk", { ids, status, justificativa_rejeicao });

export const gsUpdateServicosBulkData = (items: any[]) =>
  gsPost("updateServicosBulkData", { items });

export const gsTransferirServicosParaGerenciaBulk = (
  ids: string[],
  gerencia_id: string,
  diretoria_id: string,
  unidade_demandante?: string
) => gsPost("transferirServicosParaGerenciaBulk", { ids, gerencia_id, diretoria_id, unidade_demandante });

// Serviços Catálogo
export const gsGetServicosCatalogo = (gerencia_id?: string) =>
  gsGet("getServicosCatalogo", { gerencia_id });

export const gsCreateServicoCatalogo = (servico: any) =>
  gsPost("createServicoCatalogo", { servico });

export const gsUpdateServicoCatalogo = (id: string, updates: any) =>
  gsPost("updateServicoCatalogo", { id, updates });

export const gsDeleteServicoCatalogo = (id: string) =>
  gsPost("deleteServicoCatalogo", { id });

export const gsDeleteServicosCatalogoBulk = (ids: string[]) =>
  gsPost("deleteServicosCatalogoBulk", { ids });

export const gsUpdateServicosCatalogoBulk = (items: any[]) =>
  gsPost("updateServicosCatalogoBulk", { items });

// Itens Catálogo (Materiais)
export const gsGetItensCatalogo = () => gsGet("getItensCatalogo");
export const gsCreateItemCatalogo = (item: any) =>
  gsPost("createItemCatalogo", { item });
export const gsUpdateItemCatalogo = (id: string, updates: any) =>
  gsPost("updateItemCatalogo", { id, updates });
export const gsDeleteItemCatalogo = (id: string) =>
  gsPost("deleteItemCatalogo", { id });
export const gsDeleteItensCatalogoBulk = (ids: string[]) =>
  gsPost("deleteItensCatalogoBulk", { ids });
export const gsUpdateItensCatalogoBulk = (items: any[]) =>
  gsPost("updateItensCatalogoBulk", { items });

// Admin Config
export const gsGetAdminConfig = () => gsGet("getAdminConfig");
export const gsSaveAdminConfig = (chave: string, valor: any) =>
  gsPost("saveAdminConfig", { chave, valor });

// Logs Atividades
export const gsGetLogsAtividades = (lixeira = false) =>
  gsGet("getLogsAtividades", { lixeira });

export const gsRegistrarLogAtividade = (
  matricula: string,
  acao: string,
  tabelaAfetada: string,
  registroId: string,
  detalhes?: any
) => gsPost("registrarLog", { matricula, acao, tabelaAfetada, registroId, detalhes });

export const gsDeleteLogAtividade = (id: string) =>
  gsPost("deleteLogAtividade", { id });

export const gsDeleteLogsAtividadeBulk = (ids: string[]) =>
  gsPost("deleteLogsAtividadeBulk", { ids });

export const gsRestoreLogAtividade = (id: string) =>
  gsPost("restoreLogAtividade", { id });

export const gsRestoreLogsAtividadeBulk = (ids: string[]) =>
  gsPost("restoreLogsAtividadeBulk", { ids });

export const gsHardDeleteLogsAtividadeBulk = (ids: string[]) =>
  gsPost("hardDeleteLogsAtividadeBulk", { ids });

// Logs Orçamentários (Trilha Financeira)
export const gsGetLogsOrcamentarios = () => gsGet("getLogsOrcamentarios");

export const gsRegistrarLogOrcamentario = (log: any) =>
  gsPost("registrarLogOrcamentario", { log });

export const gsRegistrarLogsOrcamentariosBulk = (logs: any[]) =>
  gsPost("registrarLogsOrcamentariosBulk", { logs });

export const gsDeleteLogsOrcamentarioBulk = (ids: string[]) =>
  gsPost("deleteLogOrcamentarioBulk", { ids });

// Restrições de Atividades
export const gsGetRestricoesAtividades = () => gsGet("getRestricoesAtividades");

export const gsCreateRestricaoAtividade = (restricao: any) =>
  gsPost("createRestricaoAtividade", { restricao });

export const gsCreateRestricoesAtividadesBulk = (restricoes: any[]) =>
  gsPost("createRestricoesAtividadesBulk", { restricoes });

export const gsUpdateRestricaoAtividade = (id: string, updates: any) =>
  gsPost("updateRestricaoAtividade", { id, updates });

export const gsToggleRestricaoAtividade = (id: string, status: string) =>
  gsPost("toggleRestricaoAtividade", { id, status });

export const gsDeleteRestricaoAtividade = (id: string) =>
  gsPost("deleteRestricaoAtividade", { id });

export const gsDeleteRestricoesAtividadesBulk = (ids: string[]) =>
  gsPost("deleteRestricoesAtividadesBulk", { ids });

// Carga em lote genérica
export const gsBulkInsert = (sheet: string, items: any[]) =>
  gsPost("bulkInsert", { sheet, items });

// Metadados da Planilha e Abas por GID
export const gsGetSpreadsheetInfo = () => gsGet("getSpreadsheetInfo");

export const gsGetDataByGid = (gid?: string | number) =>
  gsGet("getDataByGid", { gid: gid !== undefined ? String(gid) : GOOGLE_SPREADSHEET_GID });
