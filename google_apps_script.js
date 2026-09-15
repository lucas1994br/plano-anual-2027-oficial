/**
 * =========================================================================
 * PLANO ANUAL 2027 - BACKEND GOOGLE APPS SCRIPT (CUSTO ZERO)
 * =========================================================================
 * Planilha Oficial:
 * https://docs.google.com/spreadsheets/d/1iAMhiwnwkKDznVYGjCxr-9lzHTiMMDQzmGUdoPUJfnc/edit?gid=604009512#gid=604009512
 *
 * Instruções de Implantação:
 * 1. Abra a sua Planilha Google oficial acima
 * 2. Clique em Extensões > Apps Script
 * 3. Substitua todo o conteúdo pelo código deste arquivo
 * 4. Clique em "Implantar" > "Gerenciar Implantações"
 *    - Clique no ícone de lápis (Editar)
 *    - Selecione Versão: "Nova versão"
 *    - Clique em "Implantar"
 * =========================================================================
 */

// ================= CONSTANTES E CONFIGURAÇÃO =================
const SPREADSHEET_ID = "1iAMhiwnwkKDznVYGjCxr-9lzHTiMMDQzmGUdoPUJfnc";
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1iAMhiwnwkKDznVYGjCxr-9lzHTiMMDQzmGUdoPUJfnc/edit?gid=604009512#gid=604009512";
const OFFICIAL_GID = "604009512";

// Planilha de Origem para Migração
const ORIGIN_SPREADSHEET_ID = "10av2TSqdF6jOanJ-bBscc3I13vpm1W5RALvsgPAnK-o";
const ORIGIN_SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/10av2TSqdF6jOanJ-bBscc3I13vpm1W5RALvsgPAnK-o/edit?usp=sharing";

const SHEETS = {
  DIRETORIAS: "diretorias",
  GERENCIAS: "gerencias",
  PERIODOS: "periodos",
  CODIGOS_ACESSO: "codigos_acesso",
  SOLICITACOES: "solicitacoes",
  SERVICOS: "servicos",
  SERVICOS_CATALOGO: "servicos_catalogo",
  ITENS_CATALOGO: "itens_catalogo",
  LOGS: "logs_atividades",
  LOGS_ORCAMENTARIOS: "log_orcamentario",
  ADMIN_CONFIG: "admin_config",
  RESTRICOES: "restricoes_atividades",
  FUNCIONARIOS: "funcionarios"
};

// ==================== ROTEAMENTO HTTP GET ====================

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || "ping";

    if (action === "ping") {
      return jsonResponse({
        success: true,
        message: "Google Apps Script Backend PAC 2027 ativo!",
        spreadsheetId: SPREADSHEET_ID,
        spreadsheetUrl: SPREADSHEET_URL,
        officialGid: OFFICIAL_GID,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getSpreadsheetInfo") {
      const ss = getSs();
      const sheetsList = ss.getSheets().map(s => ({
        name: s.getName(),
        id: s.getSheetId(),
        gid: String(s.getSheetId()),
        rows: s.getLastRow(),
        cols: s.getLastColumn(),
        isOfficialTarget: String(s.getSheetId()) === OFFICIAL_GID
      }));
      return jsonResponse({
        success: true,
        data: {
          spreadsheetId: SPREADSHEET_ID,
          spreadsheetUrl: SPREADSHEET_URL,
          officialGid: OFFICIAL_GID,
          sheets: sheetsList
        }
      });
    }

    if (action === "getDataByGid") {
      const targetGid = params.gid || OFFICIAL_GID;
      const sheet = getSheetByGid(targetGid);
      if (!sheet) {
        return jsonResponse({ success: false, error: "Aba não encontrada para gid: " + targetGid }, 404);
      }
      const data = getSheetData(sheet.getName());
      return jsonResponse({
        success: true,
        gid: targetGid,
        sheetName: sheet.getName(),
        count: data.length,
        data
      });
    }

    if (action === "initSpreadsheet") {
      const result = initSpreadsheet();
      return jsonResponse({ success: true, result });
    }

    if (action === "migrateAllDataFromOldSpreadsheet" || action === "migrateFromOldSpreadsheet") {
      const result = migrateAllDataFromOldSpreadsheet();
      return jsonResponse({ success: true, result });
    }

    if (action === "deduplicateSpreadsheet" || action === "cleanDuplicates") {
      const result = deduplicateAllSheets();
      return jsonResponse({ success: true, result });
    }

    if (action === "getDiretorias") {
      const rawData = getSheetData(SHEETS.DIRETORIAS);
      const seen = {};
      const data = [];
      rawData.forEach(d => {
        const sigla = String(d.sigla || "").trim().toUpperCase();
        const key = sigla || String(d.id || "").trim().toLowerCase();
        if (key && !seen[key]) {
          seen[key] = true;
          data.push(d);
        }
      });
      return jsonResponse({ success: true, data });
    }

    if (action === "getGerencias") {
      const rawData = getSheetData(SHEETS.GERENCIAS);
      const seenGer = {};
      let data = [];
      rawData.forEach(g => {
        const dId = String(g.diretoria_id || "").trim().toLowerCase();
        const s = String(g.sigla || "").trim().toUpperCase();
        const key = (dId && s) ? `${dId}-${s}` : String(g.id || s).trim().toLowerCase();
        if (key && !seenGer[key]) {
          seenGer[key] = true;
          data.push(g);
        }
      });
      if (params.diretoria_id) {
        const targetDir = String(params.diretoria_id).trim().toLowerCase();
        // Permite buscar por UUID ou por sigla da diretoria
        const diretoriasData = getSheetData(SHEETS.DIRETORIAS);
        const matchedDir = diretoriasData.find(d => 
          String(d.id || "").trim().toLowerCase() === targetDir || 
          String(d.sigla || "").trim().toLowerCase() === targetDir
        );
        const targetId = matchedDir ? String(matchedDir.id).trim().toLowerCase() : targetDir;
        data = data.filter(g => String(g.diretoria_id || "").trim().toLowerCase() === targetId);
      }
      return jsonResponse({ success: true, data });
    }

    if (action === "getPeriodos") {
      const rawData = getSheetData(SHEETS.PERIODOS);
      const seenPer = {};
      const data = [];
      rawData.forEach(p => {
        const key = String(p.id || p.nome || "").trim().toLowerCase();
        if (key && !seenPer[key]) {
          seenPer[key] = true;
          data.push(p);
        }
      });
      return jsonResponse({ success: true, data });
    }

    // Leitura otimizada de solicitações com hidratação do catálogo
    if (action === "getSolicitacoes") {
      if (params.diretoria_id && String(params.diretoria_id).trim().length <= 4) {
        const diretoriasData = getSheetData(SHEETS.DIRETORIAS);
        const dMatch = diretoriasData.find(d => String(d.sigla || "").trim().toLowerCase() === String(params.diretoria_id).trim().toLowerCase());
        if (dMatch && dMatch.id) {
          params.diretoria_id = dMatch.id;
        }
      }
      const rawSolicitacoes = getSolicitacoesFast(params);
      const data = hydrateSolicitacoesWithCatalog(rawSolicitacoes);
      return jsonResponse({ success: true, data });
    }

    if (action === "getSolicitacoesCountByDiretoria") {
      const counts = getSolicitacoesCountByDiretoria();
      return jsonResponse({ success: true, data: counts });
    }

    if (action === "getFuncionarios") {
      const data = getSheetData(SHEETS.FUNCIONARIOS);
      return jsonResponse({ success: true, data });
    }

    if (action === "getServicos") {
      let data = getSheetData(SHEETS.SERVICOS);
      // Hidrata a sigla da gerência e da diretoria
      const gerenciasData = getSheetData(SHEETS.GERENCIAS);
      const diretoriasData = getSheetData(SHEETS.DIRETORIAS);
      const gerMap = {};
      gerenciasData.forEach(g => {
        if (g.id && g.sigla) gerMap[String(g.id).toLowerCase()] = String(g.sigla);
      });
      const dirMap = {};
      diretoriasData.forEach(d => {
        if (d.id && d.sigla) dirMap[String(d.id).toLowerCase()] = String(d.sigla);
        if (d.sigla) dirMap[String(d.sigla).toLowerCase()] = String(d.sigla);
      });
      data.forEach(s => {
        if (s.gerencia_id && gerMap[String(s.gerencia_id).toLowerCase()]) {
          s.gerencia = gerMap[String(s.gerencia_id).toLowerCase()];
        }
        const dirSigla = (s.diretoria_id && dirMap[String(s.diretoria_id).toLowerCase()]) || "";
        if (dirSigla) {
          s.diretoria_sigla = dirSigla;
          s.diretorias = { sigla: dirSigla };
        }
      });
      if (params.gerencia_id) {
        const targetGer = String(params.gerencia_id).trim().toLowerCase();
        data = data.filter(s => String(s.gerencia_id || "").trim().toLowerCase() === targetGer);
      }
      if (params.diretoria_id) {
        const rawDir = String(params.diretoria_id).trim().toLowerCase();
        const matchedD = diretoriasData.find(d => 
          String(d.id || "").toLowerCase() === rawDir || 
          String(d.sigla || "").toLowerCase() === rawDir
        );
        const targetDir = matchedD ? String(matchedD.id).toLowerCase() : rawDir;
        const targetSigla = matchedD ? String(matchedD.sigla).toLowerCase() : rawDir;
        data = data.filter(s => {
          const sDir = String(s.diretoria_id || "").trim().toLowerCase();
          return sDir === targetDir || sDir === targetSigla;
        });
      }
      if (params.periodo_id) {
        const targetPer = String(params.periodo_id).trim().toLowerCase();
        data = data.filter(s => String(s.periodo_id || "").trim().toLowerCase() === targetPer);
      }
      if (params.status) {
        const statuses = params.status.split(",").map(s => s.trim().toLowerCase());
        data = data.filter(s => statuses.includes(String(s.status || "").trim().toLowerCase()));
      }
      return jsonResponse({ success: true, data });
    }

    if (action === "getServicosCatalogo") {
      const rawData = getSheetData(SHEETS.SERVICOS_CATALOGO);
      const seenSc = {};
      let data = [];
      rawData.forEach(s => {
        const itemNum = parseInt(s.item, 10);
        const key = (!isNaN(itemNum) && itemNum > 0) ? String(itemNum) : String(s.id || "").toLowerCase();
        if (key && !seenSc[key]) {
          seenSc[key] = true;
          data.push(s);
        }
      });
      if (params.gerencia_id) {
        const targetGer = String(params.gerencia_id).trim().toLowerCase();
        data = data.filter(s => !s.gerencia_id || String(s.gerencia_id).trim().toLowerCase() === targetGer);
      }
      return jsonResponse({ success: true, data });
    }

    if (action === "getItensCatalogo") {
      const rawData = getSheetData(SHEETS.ITENS_CATALOGO);
      const seenIc = {};
      const data = [];
      rawData.forEach(i => {
        const code = parseInt(i.codigo, 10);
        const key = (!isNaN(code) && code > 0) ? String(code) : String(i.id || "").toLowerCase();
        if (key && !seenIc[key]) {
          seenIc[key] = true;
          data.push(i);
        }
      });
      return jsonResponse({ success: true, data });
    }

    if (action === "getAdminConfig") {
      const rows = getSheetData(SHEETS.ADMIN_CONFIG);
      const config = {};
      rows.forEach(r => {
        if (!r.chave) return;
        try {
          config[r.chave] = typeof r.valor === "string" ? JSON.parse(r.valor) : r.valor;
        } catch {
          config[r.chave] = r.valor;
        }
      });
      return jsonResponse({ success: true, data: config });
    }

    if (action === "getLogsAtividades") {
      let data = getSheetData(SHEETS.LOGS);
      if (params.lixeira === "true") {
        data = data.filter(l => l.deleted_at && l.deleted_at !== "");
      } else {
        data = data.filter(l => !l.deleted_at || l.deleted_at === "");
      }
      return jsonResponse({ success: true, data: data.slice(-300).reverse() });
    }

    if (action === "getLogsOrcamentarios") {
      const data = getSheetData(SHEETS.LOGS_ORCAMENTARIOS);
      return jsonResponse({ success: true, data: data.slice(-300).reverse() });
    }

    if (action === "getRestricoesAtividades") {
      const data = getSheetData(SHEETS.RESTRICOES);
      return jsonResponse({ success: true, data });
    }

    if (action === "getCodigosAcesso") {
      const rawData = getSheetData(SHEETS.CODIGOS_ACESSO);
      const seenCa = {};
      const data = [];
      rawData.forEach(c => {
        const key = `${c.scope || ""}-${c.diretoria_id || ""}-${c.gerencia_id || ""}-${c.codigo_hash || c.codigo || ""}`.toLowerCase();
        if (key && !seenCa[key]) {
          seenCa[key] = true;
          data.push(c);
        }
      });
      return jsonResponse({ success: true, data });
    }

    if (action === "getTable" || action === "getTableData") {
      const tableName = params.table || params.sheet || SHEETS.SOLICITACOES;
      const data = getSheetData(tableName);
      return jsonResponse({
        success: true,
        table: tableName,
        count: data.length,
        data
      });
    }

    return jsonResponse({ success: false, error: "Ação desconhecida no GET: " + action }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || String(error) }, 500);
  }
}

// ==================== ROTEAMENTO HTTP POST ====================

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    try {
      lockAcquired = lock.tryLock(25000);
    } catch (lockErr) {
      lockAcquired = false;
    }

    if (!lockAcquired) {
      return jsonResponse({
        success: false,
        isLockTimeout: true,
        error: "Servidor ocupado com operação concorrente. Por favor, tente novamente em instantes."
      }, 503);
    }

    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    const action = body.action || "";

    if (action === "initSpreadsheet") {
      const result = initSpreadsheet();
      return jsonResponse({ success: true, result });
    }

    if (action === "migrateAllDataFromOldSpreadsheet" || action === "migrateFromOldSpreadsheet") {
      const result = migrateAllDataFromOldSpreadsheet();
      return jsonResponse({ success: true, result });
    }

    if (action === "deduplicateSpreadsheet" || action === "cleanDuplicates") {
      const result = deduplicateAllSheets();
      return jsonResponse({ success: true, result });
    }

    if (action === "validateAccessCode") {
      const result = handleValidateAccessCode(body.code, body.scope, body.diretoria_id, body.gerencia_id);
      return jsonResponse(result);
    }

    // ============ INSERÇÃO EM LOTE GENÉRICA ============
    if (action === "bulkInsert") {
      const sheetName = SHEETS[String(body.sheet).toUpperCase()] || body.sheet;
      let items = body.items || [];
      if (!sheetName || items.length === 0) {
        return jsonResponse({ success: true, count: 0 });
      }
      let nextItem = (sheetName === SHEETS.SERVICOS || sheetName === SHEETS.SERVICOS_CATALOGO) ? getNextServicoItemIndex(sheetName) : 1;
      items = items.map(it => {
        const copy = { ...it };
        if (copy.id) {
          if (typeof copy.id === "string" && (copy.id.startsWith("item-") || copy.id.startsWith("per-") || copy.id.startsWith("sol-") || copy.id.startsWith("res-"))) {
            // Preserva identificadores com prefixos estáveis
          } else {
            copy.id = ensureCanonicalUuid(copy.id);
          }
        } else if (copy.codigo && sheetName === SHEETS.ITENS_CATALOGO) {
          copy.id = "item-" + copy.codigo;
        } else {
          copy.id = generateCanonicalUuid();
        }

        if ((sheetName === SHEETS.SERVICOS || sheetName === SHEETS.SERVICOS_CATALOGO) && (!copy.item || Number(copy.item) <= 0)) {
          copy.item = nextItem++;
        }
        return copy;
      });
      const count = appendRowsBulk(sheetName, items);
      return jsonResponse({ success: true, count });
    }

    // ============ SOLICITAÇÕES ============
    if (action === "createSolicitacao") {
      const item = body.solicitacao || {};
      item.id = ensureCanonicalUuid(item.id);
      if (!item.created_at) item.created_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      const saved = appendRow(SHEETS.SOLICITACOES, item);
      return jsonResponse({ success: true, data: saved });
    }

    if (action === "updateSolicitacao") {
      const id = body.id;
      const updates = body.updates || {};
      updates.updated_at = new Date().toISOString();
      const updated = updateRow(SHEETS.SOLICITACOES, id, updates);
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "deleteSolicitacao") {
      const success = deleteRow(SHEETS.SOLICITACOES, body.id);
      return jsonResponse({ success });
    }

    if (action === "deleteSolicitacoesBulk") {
      const count = deleteRowsBulk(SHEETS.SOLICITACOES, body.ids || []);
      return jsonResponse({ success: true, deletedCount: count });
    }

    if (action === "updateSolicitacaoStatus") {
      const updates = {
        status: body.status,
        updated_at: new Date().toISOString()
      };
      if (body.justificativa_rejeicao !== undefined) {
        updates.justificativa_rejeicao = body.justificativa_rejeicao;
      }
      const updated = updateRow(SHEETS.SOLICITACOES, body.id, updates);
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "updateSolicitacaoStatusBulk") {
      const ids = body.ids || [];
      const status = body.status;
      const now = new Date().toISOString();
      const updates = ids.map(id => ({
        id,
        status,
        updated_at: now,
        justificativa_rejeicao: body.justificativa_rejeicao || ""
      }));
      const count = updateRowsBulk(SHEETS.SOLICITACOES, updates);
      return jsonResponse({ success: true, updatedCount: count });
    }

    if (action === "updateSolicitacoesBulkData") {
      const count = updateRowsBulk(SHEETS.SOLICITACOES, body.items || []);
      return jsonResponse({ success: true, updatedCount: count });
    }

    if (action === "transferirSolicitacoesParaGerenciaBulk") {
      const ids = body.ids || [];
      const gerencia_id = body.gerencia_id;
      const diretoria_id = body.diretoria_id;
      const now = new Date().toISOString();
      const updates = ids.map(id => ({
        id,
        gerencia_id,
        diretoria_id,
        updated_at: now
      }));
      const count = updateRowsBulk(SHEETS.SOLICITACOES, updates);
      return jsonResponse({ success: true, count });
    }

    // ============ SERVIÇOS ============
    if (action === "createServico") {
      const item = body.servico || {};
      item.id = ensureCanonicalUuid(item.id);
      if (!item.item || Number(item.item) <= 0) {
        item.item = getNextServicoItemIndex(SHEETS.SERVICOS, item.gerencia_id);
      } else {
        item.item = parseInt(item.item, 10) || 1;
      }
      if (!item.created_at) item.created_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      const saved = appendRow(SHEETS.SERVICOS, item);
      return jsonResponse({ success: true, data: saved });
    }

    if (action === "updateServico") {
      const id = body.id;
      const updates = body.updates || {};
      updates.updated_at = new Date().toISOString();
      const updated = updateRow(SHEETS.SERVICOS, id, updates);
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "deleteServico") {
      const success = deleteRow(SHEETS.SERVICOS, body.id);
      return jsonResponse({ success });
    }

    if (action === "deleteServicosBulk") {
      const count = deleteRowsBulk(SHEETS.SERVICOS, body.ids || []);
      return jsonResponse({ success: true, deletedCount: count });
    }

    if (action === "updateServicoStatusBulk") {
      const ids = body.ids || [];
      const status = body.status;
      const now = new Date().toISOString();
      const updates = ids.map(id => ({
        id,
        status,
        updated_at: now,
        justificativa_rejeicao: body.justificativa_rejeicao || ""
      }));
      const count = updateRowsBulk(SHEETS.SERVICOS, updates);
      return jsonResponse({ success: true, updatedCount: count });
    }

    if (action === "updateServicosBulkData") {
      const count = updateRowsBulk(SHEETS.SERVICOS, body.items || []);
      return jsonResponse({ success: true, updatedCount: count });
    }

    if (action === "transferirServicosParaGerenciaBulk") {
      const ids = body.ids || [];
      const gerencia_id = body.gerencia_id;
      const diretoria_id = body.diretoria_id;
      const unidade_demandante = body.unidade_demandante;
      const now = new Date().toISOString();
      const updates = ids.map(id => ({
        id,
        gerencia_id,
        diretoria_id,
        unidade_demandante: unidade_demandante || "",
        updated_at: now
      }));
      const count = updateRowsBulk(SHEETS.SERVICOS, updates);
      return jsonResponse({ success: true, count });
    }

    // ============ CATÁLOGO DE MATERIAIS (ITENS_CATALOGO) ============
    if (action === "createItemCatalogo") {
      const item = body.item || {};
      if (item.codigo) item.codigo = parseInt(item.codigo, 10) || 0;
      if (item.valor_unitario !== undefined) item.valor_unitario = parseSafeNumberGAS(item.valor_unitario, 0);
      if (item.valorUnitario !== undefined) item.valor_unitario = parseSafeNumberGAS(item.valorUnitario, 0);
      if (!item.id) item.id = item.codigo ? ("item-" + item.codigo) : generateCanonicalUuid();
      if (!item.created_at) item.created_at = new Date().toISOString();
      const saved = appendRow(SHEETS.ITENS_CATALOGO, item);
      return jsonResponse({ success: true, data: saved });
    }

    if (action === "updateItemCatalogo") {
      const updates = body.updates || {};
      if (updates.codigo !== undefined) updates.codigo = parseInt(updates.codigo, 10) || 0;
      if (updates.valor_unitario !== undefined) updates.valor_unitario = parseSafeNumberGAS(updates.valor_unitario, 0);
      if (updates.valorUnitario !== undefined) updates.valor_unitario = parseSafeNumberGAS(updates.valorUnitario, 0);
      const updated = updateRow(SHEETS.ITENS_CATALOGO, body.id, updates);
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "deleteItemCatalogo") {
      const success = deleteRow(SHEETS.ITENS_CATALOGO, body.id);
      return jsonResponse({ success });
    }

    if (action === "deleteItensCatalogoBulk") {
      const ids = body.ids || [];
      const count = deleteRowsBulk(SHEETS.ITENS_CATALOGO, ids);
      return jsonResponse({ success: true, deletedCount: count });
    }

    if (action === "updateItensCatalogoBulk") {
      const updates = body.items || [];
      const count = updateRowsBulk(SHEETS.ITENS_CATALOGO, updates);
      return jsonResponse({ success: true, updatedCount: count });
    }

    // ============ CATÁLOGO DE SERVIÇOS (SERVICOS_CATALOGO) ============
    if (action === "createServicoCatalogo") {
      const item = body.servico || {};
      if (!item.id) item.id = generateCanonicalUuid();
      if (!item.item || Number(item.item) <= 0) {
        item.item = getNextServicoItemIndex(SHEETS.SERVICOS_CATALOGO);
      } else {
        item.item = parseInt(item.item, 10) || 1;
      }
      if (item.estimativa_valor !== undefined) item.estimativa_valor = parseSafeNumberGAS(item.estimativa_valor, 0);
      if (!item.created_at) item.created_at = new Date().toISOString();
      const saved = appendRow(SHEETS.SERVICOS_CATALOGO, item);
      return jsonResponse({ success: true, data: saved });
    }

    if (action === "updateServicoCatalogo") {
      const updates = body.updates || {};
      if (updates.item !== undefined) updates.item = parseInt(updates.item, 10) || 1;
      if (updates.estimativa_valor !== undefined) updates.estimativa_valor = parseSafeNumberGAS(updates.estimativa_valor, 0);
      const updated = updateRow(SHEETS.SERVICOS_CATALOGO, body.id, updates);
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "deleteServicoCatalogo") {
      const success = deleteRow(SHEETS.SERVICOS_CATALOGO, body.id);
      return jsonResponse({ success });
    }

    if (action === "deleteServicosCatalogoBulk") {
      const ids = body.ids || [];
      const count = deleteRowsBulk(SHEETS.SERVICOS_CATALOGO, ids);
      return jsonResponse({ success: true, deletedCount: count });
    }

    if (action === "updateServicosCatalogoBulk") {
      const updates = body.items || [];
      const count = updateRowsBulk(SHEETS.SERVICOS_CATALOGO, updates);
      return jsonResponse({ success: true, updatedCount: count });
    }

    // ============ PERÍODOS ============
    if (action === "createPeriodo") {
      const periodo = body.periodo || {};
      if (!periodo.id) periodo.id = "per-" + (periodo.nome ? periodo.nome.replace(/\s+/g, "-").toLowerCase() : Utilities.getUuid());
      if (!periodo.created_at) periodo.created_at = new Date().toISOString();
      const saved = appendRow(SHEETS.PERIODOS, periodo);
      return jsonResponse({ success: true, data: saved });
    }

    if (action === "updatePeriodo") {
      const updated = updateRow(SHEETS.PERIODOS, body.id, body.updates || {});
      return jsonResponse({ success: true, data: updated });
    }

    // ============ ADMIN CONFIG (MINI ERP) ============
    if (action === "saveAdminConfig") {
      const chave = String(body.chave || "").trim();
      if (!chave) {
        return jsonResponse({ success: false, error: "Chave não informada" }, 400);
      }
      const valor = typeof body.valor === "object" ? JSON.stringify(body.valor) : String(body.valor !== undefined ? body.valor : "");
      const sheet = getOrCreateSheet(SHEETS.ADMIN_CONFIG);
      const now = new Date().toISOString();
      const lastRow = sheet.getLastRow();

      if (lastRow <= 1) {
        if (lastRow === 0) {
          sheet.getRange(1, 1, 1, 4).setValues([["id", "chave", "valor", "updated_at"]]);
        }
        appendRow(SHEETS.ADMIN_CONFIG, {
          id: generateCanonicalUuid(),
          chave,
          valor,
          updated_at: now
        });
        return jsonResponse({ success: true });
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
      const chaveIdx = headers.indexOf("chave");
      const valorIdx = headers.indexOf("valor");
      const updIdx = headers.indexOf("updated_at");
      const idIdx = headers.indexOf("id");

      let matchedRow = -1;
      if (chaveIdx !== -1) {
        const chaveVals = sheet.getRange(2, chaveIdx + 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < chaveVals.length; i++) {
          if (String(chaveVals[i][0] || "").trim() === chave) {
            matchedRow = i + 2;
            break;
          }
        }
      }

      if (matchedRow !== -1) {
        if (valorIdx !== -1) sheet.getRange(matchedRow, valorIdx + 1).setValue(valor);
        if (updIdx !== -1) sheet.getRange(matchedRow, updIdx + 1).setValue(now);
        if (idIdx !== -1) {
          const curId = sheet.getRange(matchedRow, idIdx + 1).getValue();
          if (!curId) sheet.getRange(matchedRow, idIdx + 1).setValue(generateCanonicalUuid());
        }
      } else {
        appendRow(SHEETS.ADMIN_CONFIG, {
          id: generateCanonicalUuid(),
          chave,
          valor,
          updated_at: now
        });
      }
      return jsonResponse({ success: true });
    }

    // ============ LOGS DE ATIVIDADES ============
    if (action === "registrarLog") {
      const log = {
        id: Utilities.getUuid(),
        matricula: body.matricula || "sistema",
        acao: body.acao || "",
        tabela_afetada: body.tabelaAfetada || body.tabela_afetada || "",
        registro_id: String(body.registroId || body.registro_id || ""),
        detalhes: typeof body.detalhes === "object" ? JSON.stringify(body.detalhes) : String(body.detalhes || ""),
        deleted_at: "",
        created_at: new Date().toISOString()
      };
      appendRow(SHEETS.LOGS, log);
      return jsonResponse({ success: true, data: log });
    }

    if (action === "deleteLogAtividade") {
      const updated = updateRow(SHEETS.LOGS, body.id, { deleted_at: new Date().toISOString() });
      return jsonResponse({ success: !!updated });
    }

    if (action === "deleteLogsAtividadeBulk") {
      const ids = body.ids || [];
      const now = new Date().toISOString();
      const updates = ids.map(id => ({ id, deleted_at: now }));
      const count = updateRowsBulk(SHEETS.LOGS, updates);
      return jsonResponse({ success: true, count });
    }

    if (action === "restoreLogAtividade") {
      const updated = updateRow(SHEETS.LOGS, body.id, { deleted_at: "" });
      return jsonResponse({ success: !!updated });
    }

    if (action === "restoreLogsAtividadeBulk") {
      const ids = body.ids || [];
      const updates = ids.map(id => ({ id, deleted_at: "" }));
      const count = updateRowsBulk(SHEETS.LOGS, updates);
      return jsonResponse({ success: true, count });
    }

    if (action === "hardDeleteLogsAtividadeBulk") {
      const count = deleteRowsBulk(SHEETS.LOGS, body.ids || []);
      return jsonResponse({ success: true, deletedCount: count });
    }

    // ============ TRILHA FINANCEIRA (LOG ORÇAMENTÁRIO) ============
    if (action === "registrarLogOrcamentario") {
      const log = body.log || {};
      if (!log.id) log.id = Utilities.getUuid();
      if (!log.created_at) log.created_at = new Date().toISOString();
      appendRow(SHEETS.LOGS_ORCAMENTARIOS, log);
      return jsonResponse({ success: true, data: log });
    }

    if (action === "registrarLogsOrcamentariosBulk") {
      const logs = body.logs || [];
      const now = new Date().toISOString();
      const prepared = logs.map(l => ({
        ...l,
        id: l.id || Utilities.getUuid(),
        created_at: l.created_at || now
      }));
      appendRowsBulk(SHEETS.LOGS_ORCAMENTARIOS, prepared);
      return jsonResponse({ success: true, count: prepared.length });
    }

    if (action === "deleteLogOrcamentarioBulk") {
      const count = deleteRowsBulk(SHEETS.LOGS_ORCAMENTARIOS, body.ids || []);
      return jsonResponse({ success: true, deletedCount: count });
    }

    if (action === "updateLogOrcamentario") {
      const updated = updateRow(SHEETS.LOGS_ORCAMENTARIOS, body.id, body.updates || {});
      return jsonResponse({ success: true, data: updated });
    }

    // ============ RESTRIÇÕES DE ATIVIDADES ============
    if (action === "createRestricaoAtividade") {
      const item = body.restricao || {};
      if (!item.id) item.id = Utilities.getUuid();
      if (item.ativo === undefined) item.ativo = true;
      if (!item.created_at) item.created_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      const saved = appendRow(SHEETS.RESTRICOES, item);
      return jsonResponse({ success: true, data: saved });
    }

    if (action === "createRestricoesAtividadesBulk") {
      const restricoes = body.restricoes || [];
      const now = new Date().toISOString();
      const prepared = restricoes.map(r => ({
        ...r,
        id: r.id || Utilities.getUuid(),
        ativo: r.ativo !== undefined ? r.ativo : true,
        created_at: r.created_at || now,
        updated_at: now
      }));
      appendRowsBulk(SHEETS.RESTRICOES, prepared);
      return jsonResponse({ success: true, count: prepared.length });
    }

    if (action === "updateRestricaoAtividade") {
      const updates = body.updates || {};
      updates.updated_at = new Date().toISOString();
      const updated = updateRow(SHEETS.RESTRICOES, body.id, updates);
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "toggleRestricaoAtividade") {
      const status = body.status;
      const isAtivo = status === "ativo" || status === true || String(status).toLowerCase() === "true";
      const updated = updateRow(SHEETS.RESTRICOES, body.id, {
        ativo: isAtivo,
        updated_at: new Date().toISOString()
      });
      return jsonResponse({ success: true, data: updated });
    }

    if (action === "deleteRestricaoAtividade") {
      const success = deleteRow(SHEETS.RESTRICOES, body.id);
      return jsonResponse({ success });
    }

    if (action === "deleteRestricoesAtividadesBulk") {
      const count = deleteRowsBulk(SHEETS.RESTRICOES, body.ids || []);
      return jsonResponse({ success: true, deletedCount: count });
    }

    return jsonResponse({ success: false, error: "Ação POST desconhecida: " + action }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || String(error) }, 500);
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (ignored) {}
    }
  }
}

// ================= HELPERS DE BANCO NA PLANILHA =================

function getSs() {
  // 1. Sempre prioriza a planilha oficial indicada por SPREADSHEET_ID
  if (typeof SPREADSHEET_ID !== "undefined" && SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      const explicitSs = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
      if (explicitSs) return explicitSs;
    } catch (e) {
      console.warn("Aviso ao abrir por SPREADSHEET_ID (" + SPREADSHEET_ID + "): " + e.message);
    }
  }
  // 2. Fallback para a planilha ativa do container onde o script está rodando
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  throw new Error("Planilha não encontrada pelo ID: " + (typeof SPREADSHEET_ID !== "undefined" ? SPREADSHEET_ID : "não definido"));
}

function getSheetByGid(gid) {
  const ss = getSs();
  const sheets = ss.getSheets();
  const searchGid = String(gid).trim();
  for (let i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === searchGid) {
      return sheets[i];
    }
  }
  return null;
}

function getOrCreateSheet(name) {
  const ss = getSs();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ================= HELPERS DE UUID E ÍNDICES SEQUENCIAIS =================

/**
 * Gera um identificador UUID v4 canônico em minúsculas
 * Exemplo: '00149c22-e917-4956-bf32-365c76fa4a07'
 */
function generateCanonicalUuid() {
  return Utilities.getUuid().toLowerCase();
}

/**
 * Valida ou gera um UUID v4 canônico
 */
function ensureCanonicalUuid(val) {
  if (val && typeof val === "string") {
    const trimmed = val.trim().toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return generateCanonicalUuid();
}

/**
 * Calcula o próximo índice sequencial (1, 2, 3...) para o campo 'item' de serviços
 */
function getNextServicoItemIndex(sheetName, gerenciaId) {
  const sheet = getSs().getSheetByName(sheetName || SHEETS.SERVICOS);
  if (!sheet) return 1;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const itemColIdx = headers.indexOf("item");
  const gerColIdx = headers.indexOf("gerencia_id");
  if (itemColIdx === -1) return 1;

  const itemVals = sheet.getRange(2, itemColIdx + 1, lastRow - 1, 1).getValues();
  const gerVals = (gerColIdx !== -1 && gerenciaId) ? sheet.getRange(2, gerColIdx + 1, lastRow - 1, 1).getValues() : null;
  const targetGer = gerenciaId ? String(gerenciaId).trim().toLowerCase() : null;

  let maxIdx = 0;
  for (let i = 0; i < itemVals.length; i++) {
    if (gerVals && targetGer && String(gerVals[i][0] || "").trim().toLowerCase() !== targetGer) {
      continue;
    }
    const val = parseInt(itemVals[i][0], 10);
    if (!isNaN(val) && val > maxIdx) {
      maxIdx = val;
    }
  }
  return maxIdx + 1;
}

// ================= SANITIZAÇÃO DE DADOS E FORMATAÇÃO =================

const NUMERIC_COLS = [
  "valor_unitario",
  "qtd_estimada",
  "estimativa_valor",
  "dotacao_orcamentaria",
  "dotacao",
  "valor_estimado",
  "item",
  "codigo",
  "ano"
];

/**
 * Converte com máxima precisão valores para número seguro
 * Corrige valores que o Excel/Sheets converteu em datas (ex: 3329-10-01T03:00:00.000Z -> 3329.10)
 * Remove 'R$', espaços, formata vírgula e ponto pt-BR
 */
function parseSafeNumberGAS(val, fallback) {
  const def = fallback !== undefined ? fallback : 0;
  if (val === null || val === undefined || val === "") return def;
  if (typeof val === "number") return isNaN(val) ? def : val;
  if (val instanceof Date || (val && typeof val.getFullYear === "function")) {
    const yr = val.getFullYear();
    const mo = val.getMonth() + 1;
    const day = val.getDate();
    if (day <= 2 && yr >= 1000) {
      return yr + (mo / 100);
    }
    return val.getTime ? val.getTime() : def;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return def;
    // Não converter objetos JSON stringificados
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return val;
    if (trimmed.includes("T") && (trimmed.includes("Z") || trimmed.includes("+") || trimmed.includes("-"))) {
      const m = trimmed.match(/^(\d{1,6})-(\d{2})/);
      if (m) {
        const rec = parseFloat(m[1] + "." + m[2]);
        if (!isNaN(rec)) return rec;
      }
    }
    const clean = trimmed.replace(/[R$\s]/g, "");
    if (!clean) return def;
    if (clean.includes(",")) {
      const normalized = clean.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      return isNaN(n) ? def : n;
    }
    const n = parseFloat(clean);
    return isNaN(n) ? def : n;
  }
  const n = Number(val);
  return isNaN(n) ? def : n;
}

function formatCellSafe(colHeader, val) {
  if (val === null || val === undefined) return "";
  const h = String(colHeader).trim().toLowerCase();

  // Colunas de dados complexos, JSON ou texto livre
  if (h === "valor" || h === "detalhes" || h === "chave" || h === "descricao" || h === "objeto" || h === "justificativa") {
    if (typeof val === "object") return JSON.stringify(val);
    if (typeof val === "string") {
      const trimmed = val.trim();
      // Protege contra formula injection se começar com =, +, @ ou - seguido de letra
      if (trimmed.startsWith("=") || trimmed.startsWith("+") || trimmed.startsWith("@") || (trimmed.startsWith("-") && trimmed.length > 1 && isNaN(Number(trimmed)))) {
        return "'" + val;
      }
    }
    return val;
  }

  if (typeof val === "string" && (val.trim().startsWith("{") || val.trim().startsWith("["))) {
    return val;
  }

  // Proteção contra Formula / CSV Injection em campos de texto livre
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("=") || trimmed.startsWith("+") || trimmed.startsWith("@") || (trimmed.startsWith("-") && trimmed.length > 1 && isNaN(Number(trimmed)))) {
      return "'" + val;
    }
  }

  // Índice sequencial de itens (1, 2, 3...)
  if (h === "item") {
    const n = parseInt(val, 10);
    return isNaN(n) ? 1 : n;
  }

  // Código numérico
  if (h === "codigo") {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }

  // Colunas numéricas e financeiras
  if (NUMERIC_COLS.indexOf(h) !== -1) {
    return parseSafeNumberGAS(val, 0);
  }

  // Booleanos
  if (["ativo", "ativa", "is_active", "is_ativo"].indexOf(h) !== -1) {
    if (val === true || String(val).toLowerCase() === "true" || String(val) === "1" || String(val).toUpperCase() === "VERDADEIRO") {
      return true;
    }
    return false;
  }

  // Datas
  if (val instanceof Date) {
    return val.toISOString();
  }

  return val;
}

/**
 * Lê uma aba e retorna array de objetos com cabeçalhos normalizados para minúsculas
 */
function getSheetData(sheetName) {
  const sheet = getSs().getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(h => String(h).trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(cell => cell === "" || cell === null)) continue;
    const obj = {};
    headers.forEach((h, colIdx) => {
      let cellVal = formatCellSafe(h, row[colIdx]);
      // Remove apóstrofo de proteção de fórmula ao ler para o front-end
      if (typeof cellVal === "string" && cellVal.startsWith("'") && (cellVal.startsWith("'=") || cellVal.startsWith("'+") || cellVal.startsWith("'@") || cellVal.startsWith("'-"))) {
        cellVal = cellVal.slice(1);
      }
      obj[h] = cellVal;
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Leitura ultra-rápida de solicitações com algoritmo de fusão de blocos contíguos (< 1.5s em 107k linhas)
 */
function getSolicitacoesFast(params) {
  const sheet = getSs().getSheetByName(SHEETS.SOLICITACOES);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const gerColIdx = headers.indexOf("gerencia_id");
  const dirColIdx = headers.indexOf("diretoria_id");
  const perColIdx = headers.indexOf("periodo_id");
  const statusColIdx = headers.indexOf("status");
  const qtdColIdx = headers.indexOf("qtd_estimada");

  const targetGer = params.gerencia_id ? String(params.gerencia_id).trim().toLowerCase() : null;
  const targetDir = params.diretoria_id ? String(params.diretoria_id).trim().toLowerCase() : null;
  const targetPer = params.periodo_id ? String(params.periodo_id).trim().toLowerCase() : null;
  const targetStatuses = params.status ? params.status.split(",").map(s => s.trim().toLowerCase()) : null;
  const activeOnly = params.active_only === "true" || params.with_quantity === "true";

  // Escolhe a coluna mais seletiva para varredura inicial (1 coluna de 107k linhas leva ~150ms)
  let filterColIdx = -1;
  let targetValsList = null;
  let singleTargetVal = null;

  if (targetStatuses && statusColIdx !== -1) {
    // Status é extremamente seletivo (~1.200 linhas entre 107k)
    filterColIdx = statusColIdx;
    targetValsList = targetStatuses;
  } else if (targetGer && gerColIdx !== -1) {
    // Gerência isola para ~2.300 linhas
    filterColIdx = gerColIdx;
    singleTargetVal = targetGer;
  } else if (targetDir && dirColIdx !== -1) {
    filterColIdx = dirColIdx;
    singleTargetVal = targetDir;
  }

  if (filterColIdx !== -1) {
    const colValues = sheet.getRange(2, filterColIdx + 1, lastRow - 1, 1).getValues();
    const matchingRowIndices = [];
    for (let i = 0; i < colValues.length; i++) {
      const cellVal = String(colValues[i][0] || "").trim().toLowerCase();
      const isMatch = targetValsList ? targetValsList.includes(cellVal) : (cellVal === singleTargetVal);
      if (isMatch) {
        matchingRowIndices.push(i + 2); // Linha base 1
      }
    }

    if (matchingRowIndices.length === 0) return [];

    // FUSÃO DE BLOCOS: Se duas linhas têm distância <= 150 linhas, junta em um único bloco de leitura contínua.
    // Isso reduz centenas/milhares de chamadas a getRange para apenas 2 a 5 chamadas ultra-rápidas!
    const MERGE_GAP = 150;
    const mergedBlocks = [];
    let curStart = matchingRowIndices[0];
    let curEnd = matchingRowIndices[0];

    for (let k = 1; k < matchingRowIndices.length; k++) {
      const rNum = matchingRowIndices[k];
      if (rNum - curEnd <= MERGE_GAP) {
        curEnd = rNum;
      } else {
        mergedBlocks.push({ start: curStart, count: curEnd - curStart + 1 });
        curStart = rNum;
        curEnd = rNum;
      }
    }
    mergedBlocks.push({ start: curStart, count: curEnd - curStart + 1 });

    const results = [];
    for (let b = 0; b < mergedBlocks.length; b++) {
      const chunk = sheet.getRange(mergedBlocks[b].start, 1, mergedBlocks[b].count, lastCol).getValues();
      for (let r = 0; r < chunk.length; r++) {
        const row = chunk[r];
        if (targetPer && perColIdx !== -1 && String(row[perColIdx] || "").trim().toLowerCase() !== targetPer) continue;
        if (targetDir && dirColIdx !== -1 && String(row[dirColIdx] || "").trim().toLowerCase() !== targetDir) continue;
        if (targetGer && gerColIdx !== -1 && String(row[gerColIdx] || "").trim().toLowerCase() !== targetGer) continue;
        if (targetStatuses && statusColIdx !== -1 && !targetStatuses.includes(String(row[statusColIdx] || "").trim().toLowerCase())) continue;
        if (activeOnly && qtdColIdx !== -1) {
          const q = parseSafeNumberGAS(row[qtdColIdx]);
          const st = statusColIdx !== -1 ? String(row[statusColIdx] || "").trim().toLowerCase() : "";
          if (q <= 0 && st === "rascunho") continue;
        }

        const obj = {};
        headers.forEach((h, colIdx) => {
          obj[h] = formatCellSafe(h, row[colIdx]);
        });
        results.push(obj);
      }
    }
    return results;
  }

  // Se não filtrado por coluna e planilha for grande, carrega prévia segura para não estourar tempo
  if (lastRow > 5000) {
    const previewChunk = sheet.getRange(2, 1, Math.min(2500, lastRow - 1), lastCol).getValues();
    const results = [];
    for (let i = 0; i < previewChunk.length; i++) {
      const row = previewChunk[i];
      if (row.every(cell => cell === "" || cell === null)) continue;
      const obj = {};
      headers.forEach((h, colIdx) => {
        obj[h] = formatCellSafe(h, row[colIdx]);
      });
      results.push(obj);
    }
    return results;
  }

  return getSheetData(SHEETS.SOLICITACOES);
}

/**
 * Contagem ultra-rápida de solicitações agrupadas por diretoria (lê apenas 2 colunas de 107k linhas)
 */
function getSolicitacoesCountByDiretoria() {
  const sheet = getSs().getSheetByName(SHEETS.SOLICITACOES);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  const dirColIdx = headers.indexOf("diretoria_id");
  const qtdColIdx = headers.indexOf("qtd_estimada");
  if (dirColIdx === -1) return {};

  const dirValues = sheet.getRange(2, dirColIdx + 1, lastRow - 1, 1).getValues();
  const qtdValues = qtdColIdx !== -1 ? sheet.getRange(2, qtdColIdx + 1, lastRow - 1, 1).getValues() : null;

  const counts = {};
  for (let i = 0; i < dirValues.length; i++) {
    const dirId = String(dirValues[i][0] || "").trim();
    if (!dirId) continue;
    if (qtdValues) {
      const q = Number(qtdValues[i][0] || 0);
      if (q <= 0) continue;
    }
    counts[dirId] = (counts[dirId] || 0) + 1;
  }
  return counts;
}

/**
 * Hidrata as solicitações com código e descrição do catálogo de materiais
 * Garante que s.codigo nunca seja 0 e s.descricao nunca seja 'Material não especificado' quando existir no catálogo
 * Sempre anexa o objeto aninhado s.item = { id, codigo, descricao, categoria, unidade, valor_unitario }
 */
function hydrateSolicitacoesWithCatalog(solicitacoes) {
  if (!solicitacoes || solicitacoes.length === 0) return solicitacoes;

  const catalogSheet = getSs().getSheetByName(SHEETS.ITENS_CATALOGO);
  if (!catalogSheet) return solicitacoes;

  const catLastRow = catalogSheet.getLastRow();
  const catLastCol = catalogSheet.getLastColumn();
  if (catLastRow <= 1) return solicitacoes;

  // Lê todos os dados do catálogo em 1 única chamada direta
  const catValues = catalogSheet.getRange(1, 1, catLastRow, catLastCol).getValues();
  const catHeaders = catValues[0].map(h => String(h).trim().toLowerCase());
  const idIdx = catHeaders.indexOf("id");
  const codeIdx = catHeaders.indexOf("codigo");
  const descIdx = catHeaders.indexOf("descricao");
  const catIdx = catHeaders.indexOf("categoria");
  const unIdx = catHeaders.indexOf("unidade");
  const valIdx = catHeaders.indexOf("valor_unitario");

  const catalogMap = new Map();
  for (let i = 1; i < catValues.length; i++) {
    const row = catValues[i];
    const rowId = idIdx !== -1 ? String(row[idIdx] || "").trim().toLowerCase() : "";
    const rowCode = codeIdx !== -1 ? parseInt(row[codeIdx], 10) || 0 : 0;
    const catObj = {
      id: rowId,
      codigo: rowCode,
      descricao: descIdx !== -1 ? String(row[descIdx] || "").trim() : "",
      categoria: catIdx !== -1 ? String(row[catIdx] || "").trim() : "MATERIAIS DE CUSTEIO",
      unidade: unIdx !== -1 ? String(row[unIdx] || "").trim() : "UND",
      valor_unitario: valIdx !== -1 ? parseSafeNumberGAS(row[valIdx]) : 0
    };
    if (rowId) catalogMap.set(rowId, catObj);
    if (rowCode > 0) catalogMap.set(String(rowCode), catObj);
  }

  // Mapeamento de gerências para preencher a sigla correta
  const gerSheet = getSs().getSheetByName(SHEETS.GERENCIAS);
  const gerMap = new Map();
  if (gerSheet && gerSheet.getLastRow() > 1) {
    const gerValues = gerSheet.getRange(1, 1, gerSheet.getLastRow(), gerSheet.getLastColumn()).getValues();
    const gHeaders = gerValues[0].map(h => String(h).trim().toLowerCase());
    const gIdIdx = gHeaders.indexOf("id");
    const gSiglaIdx = gHeaders.indexOf("sigla");
    if (gIdIdx !== -1 && gSiglaIdx !== -1) {
      for (let i = 1; i < gerValues.length; i++) {
        const gid = String(gerValues[i][gIdIdx] || "").trim().toLowerCase();
        const gsigla = String(gerValues[i][gSiglaIdx] || "").trim();
        if (gid && gsigla) gerMap.set(gid, gsigla);
      }
    }
  }

  // Mapeamento de diretorias para preencher a sigla correta
  const dirSheet = getSs().getSheetByName(SHEETS.DIRETORIAS);
  const dirMap = new Map();
  if (dirSheet && dirSheet.getLastRow() > 1) {
    const dirValues = dirSheet.getRange(1, 1, dirSheet.getLastRow(), dirSheet.getLastColumn()).getValues();
    const dHeaders = dirValues[0].map(h => String(h).trim().toLowerCase());
    const dIdIdx = dHeaders.indexOf("id");
    const dSiglaIdx = dHeaders.indexOf("sigla");
    if (dIdIdx !== -1 && dSiglaIdx !== -1) {
      for (let i = 1; i < dirValues.length; i++) {
        const did = String(dirValues[i][dIdIdx] || "").trim().toLowerCase();
        const dsigla = String(dirValues[i][dSiglaIdx] || "").trim();
        if (did && dsigla) dirMap.set(did, dsigla);
        if (dsigla) dirMap.set(dsigla.toLowerCase(), dsigla);
      }
    }
  }

  return solicitacoes.map(s => {
    const rawCode = s.codigo ? parseInt(s.codigo, 10) || 0 : 0;
    const rawDesc = s.descricao ? String(s.descricao).trim() : "";
    const isDescDefault = !rawDesc || rawDesc.toLowerCase() === "material não especificado" || rawDesc.toLowerCase() === "diversos";

    let cat = null;
    if (s.item_id) {
      cat = catalogMap.get(String(s.item_id).trim().toLowerCase());
    }
    if (!cat && rawCode > 0) {
      cat = catalogMap.get(String(rawCode));
    }

    const finalCode = (cat && cat.codigo > 0) ? cat.codigo : rawCode;
    const finalDesc = (isDescDefault && cat && cat.descricao) ? cat.descricao : (rawDesc || (cat ? cat.descricao : "Material não especificado"));
    const finalCat = (s.categoria && s.categoria !== "diversos") ? s.categoria : (cat ? cat.categoria : "MATERIAIS DE CUSTEIO");
    const finalUn = s.unidade || (cat ? cat.unidade : "UND");
    const finalVal = (s.valor_unitario !== undefined && s.valor_unitario !== "" && Number(s.valor_unitario) > 0)
      ? parseSafeNumberGAS(s.valor_unitario)
      : (cat ? cat.valor_unitario : 0);
    const finalGerencia = (s.gerencia_id && gerMap.get(String(s.gerencia_id).trim().toLowerCase())) || s.gerencia || "";
    const finalDirSigla = (s.diretoria_id && dirMap.get(String(s.diretoria_id).trim().toLowerCase())) || s.diretoria_sigla || "";

    return {
      ...s,
      gerencia: finalGerencia,
      diretoria_sigla: finalDirSigla,
      diretorias: { sigla: finalDirSigla },
      codigo: finalCode,
      descricao: finalDesc,
      categoria: finalCat,
      unidade: finalUn,
      valor_unitario: finalVal,
      item: {
        id: s.item_id || (cat ? cat.id : s.id),
        codigo: finalCode,
        descricao: finalDesc,
        categoria: finalCat,
        unidade: finalUn,
        valor_unitario: finalVal
      }
    };
  });
}

function appendRow(sheetName, obj) {
  const sheet = getOrCreateSheet(sheetName);
  const headersRange = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()));
  let headers = headersRange.getValues()[0].map(h => String(h).trim().toLowerCase()).filter(Boolean);

  if (!obj.id) {
    obj.id = generateCanonicalUuid();
  } else if (typeof obj.id === "string" && (obj.id.startsWith("item-") || obj.id.startsWith("per-") || obj.id.startsWith("sol-") || obj.id.startsWith("res-"))) {
    // Preserva identificadores com prefixos estáveis
  } else {
    obj.id = ensureCanonicalUuid(obj.id);
  }

  if ((sheetName === SHEETS.SERVICOS || sheetName === SHEETS.SERVICOS_CATALOGO) && (!obj.item || Number(obj.item) <= 0)) {
    obj.item = getNextServicoItemIndex(sheetName, obj.gerencia_id);
  }

  if (headers.length === 0) {
    headers = Object.keys(obj).map(k => k.toLowerCase());
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    let updatedHeaders = false;
    Object.keys(obj).forEach(k => {
      const kLower = k.toLowerCase();
      if (!headers.includes(kLower)) {
        headers.push(kLower);
        updatedHeaders = true;
      }
    });
    if (updatedHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  const rowValues = headers.map(h => {
    const matchKey = Object.keys(obj).find(k => k.toLowerCase() === h);
    const v = matchKey ? obj[matchKey] : undefined;
    return v !== undefined && v !== null ? formatCellSafe(h, v) : "";
  });

  sheet.appendRow(rowValues);
  return obj;
}

function appendRowsBulk(sheetName, objArray) {
  if (!objArray || objArray.length === 0) return 0;
  const sheet = getOrCreateSheet(sheetName);
  const headersRange = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()));
  let headers = headersRange.getValues()[0].map(h => String(h).trim().toLowerCase()).filter(Boolean);

  let nextItemIdx = (sheetName === SHEETS.SERVICOS || sheetName === SHEETS.SERVICOS_CATALOGO) ? getNextServicoItemIndex(sheetName) : 1;

  objArray.forEach(obj => {
    if (!obj.id) {
      obj.id = generateCanonicalUuid();
    } else if (typeof obj.id === "string" && (obj.id.startsWith("item-") || obj.id.startsWith("per-") || obj.id.startsWith("sol-") || obj.id.startsWith("res-"))) {
      // Preserva identificadores com prefixos estáveis
    } else {
      obj.id = ensureCanonicalUuid(obj.id);
    }
    if ((sheetName === SHEETS.SERVICOS || sheetName === SHEETS.SERVICOS_CATALOGO) && (!obj.item || Number(obj.item) <= 0)) {
      obj.item = nextItemIdx++;
    }
  });

  if (headers.length === 0) {
    headers = Object.keys(objArray[0]).map(k => k.toLowerCase());
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    let updatedHeaders = false;
    objArray.forEach(obj => {
      Object.keys(obj).forEach(k => {
        const kLower = k.toLowerCase();
        if (!headers.includes(kLower)) {
          headers.push(kLower);
          updatedHeaders = true;
        }
      });
    });
    if (updatedHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  const rows = objArray.map(obj => {
    return headers.map(h => {
      const matchKey = Object.keys(obj).find(k => k.toLowerCase() === h);
      const v = matchKey ? obj[matchKey] : undefined;
      return v !== undefined && v !== null ? formatCellSafe(h, v) : "";
    });
  });

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, headers.length).setValues(rows);
  return rows.length;
}

function updateRow(sheetName, id, updates) {
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return null;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const idColIdx = headers.indexOf("id");
  const targetId = String(id).trim().toLowerCase();

  let matchedRowNum = -1;

  if (idColIdx !== -1) {
    const idValues = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0] || "").trim().toLowerCase() === targetId) {
        matchedRowNum = i + 2;
        break;
      }
    }
  }

  // Fallback por coluna codigo ou item se não achou pelo ID
  if (matchedRowNum === -1) {
    const codColIdx = headers.indexOf("codigo");
    const itemColIdx = headers.indexOf("item");
    let altColIdx = -1;
    let altTarget = null;
    if (codColIdx !== -1) {
      altColIdx = codColIdx;
      altTarget = targetId.replace(/^item-/, "");
    } else if (itemColIdx !== -1) {
      altColIdx = itemColIdx;
      altTarget = targetId;
    }
    if (altColIdx !== -1 && altTarget) {
      const altValues = sheet.getRange(2, altColIdx + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < altValues.length; i++) {
        if (String(altValues[i][0] || "").trim().toLowerCase() === altTarget) {
          matchedRowNum = i + 2;
          break;
        }
      }
    }
  }

  if (matchedRowNum !== -1) {
    Object.keys(updates).forEach(key => {
      const kLower = key.toLowerCase();
      let colIdx = headers.indexOf(kLower);
      if (colIdx === -1) {
        colIdx = headers.length;
        headers.push(kLower);
        sheet.getRange(1, colIdx + 1).setValue(kLower);
      }
      sheet.getRange(matchedRowNum, colIdx + 1).setValue(formatCellSafe(kLower, updates[key]));
    });
    return { id: targetId, ...updates };
  }

  return null;
}

function updateRowsBulk(sheetName, updatesArray) {
  if (!updatesArray || updatesArray.length === 0) return 0;
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return 0;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const idColIdx = headers.indexOf("id");
  if (idColIdx === -1) return 0;

  const updateMap = {};
  updatesArray.forEach(u => {
    if (u && u.id) updateMap[String(u.id).trim().toLowerCase()] = u;
  });

  // Lê apenas a coluna de IDs para identificar linhas afetadas
  const idValues = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
  const matchedRows = [];

  for (let i = 0; i < idValues.length; i++) {
    const rowId = String(idValues[i][0] || "").trim().toLowerCase();
    if (updateMap[rowId]) {
      matchedRows.push({ rowNum: i + 2, updates: updateMap[rowId] });
    }
  }

  if (matchedRows.length === 0) return 0;

  // Se poucas linhas ou planilha grande, atualiza diretamente cada célula sem reescrever a planilha inteira
  if (matchedRows.length <= 100 || lastRow > 5000) {
    matchedRows.forEach(item => {
      Object.keys(item.updates).forEach(key => {
        if (key.toLowerCase() === "id") return;
        const colIdx = headers.indexOf(key.toLowerCase());
        if (colIdx !== -1) {
          sheet.getRange(item.rowNum, colIdx + 1).setValue(formatCellSafe(key, item.updates[key]));
        }
      });
    });
    return matchedRows.length;
  }

  // Para planilhas menores, atualiza em matriz de dados
  const range = sheet.getDataRange();
  const data = range.getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][idColIdx] || "").trim().toLowerCase();
    if (updateMap[rowId]) {
      const updates = updateMap[rowId];
      Object.keys(updates).forEach(key => {
        if (key.toLowerCase() === "id") return;
        const colIdx = headers.indexOf(key.toLowerCase());
        if (colIdx !== -1) {
          data[i][colIdx] = formatCellSafe(key, updates[key]);
        }
      });
      count++;
    }
  }
  if (count > 0) {
    range.setValues(data);
  }
  return count;
}

function deleteRow(sheetName, id) {
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  const idColIdx = headers.indexOf("id");
  const targetId = String(id).trim().toLowerCase();

  if (idColIdx !== -1) {
    const idValues = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      if (String(idValues[i][0] || "").trim().toLowerCase() === targetId) {
        sheet.deleteRow(i + 2);
        return true;
      }
    }
  }

  // Fallback por coluna codigo ou item se não achou pelo ID
  const codColIdx = headers.indexOf("codigo");
  const itemColIdx = headers.indexOf("item");
  let altColIdx = -1;
  let altTarget = null;
  if (codColIdx !== -1) {
    altColIdx = codColIdx;
    altTarget = targetId.replace(/^item-/, "");
  } else if (itemColIdx !== -1) {
    altColIdx = itemColIdx;
    altTarget = targetId;
  }

  if (altColIdx !== -1 && altTarget) {
    const altValues = sheet.getRange(2, altColIdx + 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < altValues.length; i++) {
      if (String(altValues[i][0] || "").trim().toLowerCase() === altTarget) {
        sheet.deleteRow(i + 2);
        return true;
      }
    }
  }

  return false;
}

function deleteRowsBulk(sheetName, ids) {
  if (!ids || ids.length === 0) return 0;
  const sheet = getOrCreateSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return 0;

  // Lê cabeçalhos para localizar colunas de identificação
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const idColIdx = headers.indexOf("id");
  const codColIdx = headers.indexOf("codigo");
  const itemColIdx = headers.indexOf("item");
  if (idColIdx === -1 && codColIdx === -1 && itemColIdx === -1) return 0;

  const idSet = new Set(ids.map(id => String(id).trim().toLowerCase()));
  const matchesTarget = (rowId, codVal, itemVal) => {
    if (rowId && idSet.has(rowId)) return true;
    if (codColIdx !== -1 && codVal !== undefined && codVal !== null && codVal !== "") {
      const cStr = String(codVal).trim().toLowerCase();
      if (idSet.has(cStr) || idSet.has("item-" + cStr)) return true;
    }
    if (itemColIdx !== -1 && itemVal !== undefined && itemVal !== null && itemVal !== "") {
      const iStr = String(itemVal).trim().toLowerCase();
      if (idSet.has(iStr)) return true;
    }
    return false;
  };

  // CORREÇÃO: Usa sempre deleção reversa de linhas para evitar mismatch de colunas.
  // O método anterior (clearContents + setValues) falhava com:
  // "The number of columns in the data does not match the number of columns in the range"
  // quando a planilha possuía mais colunas que o cabeçalho retornado.
  // A deleção reversa é atômica, segura e não requer reconstrução da planilha.
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rowsToDelete = [];

  for (let i = 0; i < dataRange.length; i++) {
    const rowData = dataRange[i];
    const rowId = idColIdx !== -1 ? String(rowData[idColIdx] || "").trim().toLowerCase() : "";
    const codVal = codColIdx !== -1 ? rowData[codColIdx] : null;
    const itemVal = itemColIdx !== -1 ? rowData[itemColIdx] : null;
    if (matchesTarget(rowId, codVal, itemVal)) {
      rowsToDelete.push(i + 2); // +2: índice 1-based e pula o cabeçalho
    }
  }

  if (rowsToDelete.length === 0) return 0;

  // Deleta de trás para frente para não deslocar índices
  for (let k = rowsToDelete.length - 1; k >= 0; k--) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  return rowsToDelete.length;
}

// ================= VALIDAÇÃO DE CÓDIGO DE ACESSO =================

function sha256(str) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  let txtHash = "";
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    let byteHex = hashVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    txtHash += byteHex;
  }
  return txtHash;
}

function handleValidateAccessCode(code, scope, diretoria_id, gerencia_id) {
  if (!code) return { success: false, error: "Código de acesso vazio" };
  const rawCode = String(code).trim();
  const normalized = rawCode.toLowerCase();
  const hash = sha256(normalized);
  const rawHash = sha256(rawCode);

  const codes = getSheetData(SHEETS.CODIGOS_ACESSO);
  if (!codes || codes.length === 0) {
    return { success: false, error: "Tabela de códigos de acesso vazia ou não encontrada na planilha" };
  }

  const match = codes.find(c => {
    // Aceitar ativo flexível: true, "true", "TRUE", "VERDADEIRO", 1, "t", "sim", "s" ou vazio/indefinido
    const isAtivo = c.ativo === true || 
                    String(c.ativo).toLowerCase() === "true" || 
                    String(c.ativo).toUpperCase() === "VERDADEIRO" || 
                    String(c.ativo) === "1" || 
                    String(c.ativo).toLowerCase() === "t" ||
                    String(c.ativo).toLowerCase() === "sim" ||
                    String(c.ativo).toLowerCase() === "s" ||
                    c.ativo === "" || c.ativo === undefined || c.ativo === null;
    if (!isAtivo) return false;

    if (scope && String(c.scope || "").toLowerCase() !== String(scope).toLowerCase()) return false;

    // Obtém o valor configurado na coluna codigo_hash da guia codigos_acesso
    const dbHash = String(c.codigo_hash || c["código_hash"] || c.codigo || c.hash || "").trim();
    if (!dbHash) return false;

    const dbHashLower = dbHash.toLowerCase();

    // Valida diretamente contra a coluna codigo_hash:
    // Suporta tanto texto direto/senha simples quanto hash SHA-256
    const isCodeMatch = (
      dbHashLower === hash || 
      dbHashLower === rawHash.toLowerCase() || 
      dbHashLower === normalized || 
      dbHash === rawCode
    );
    if (!isCodeMatch) return false;

    // Se especificada a diretoria_id, valida correspondência
    if (diretoria_id && c.diretoria_id) {
      const rowDir = String(c.diretoria_id).trim().toLowerCase();
      const targetDir = String(diretoria_id).trim().toLowerCase();
      if (rowDir && rowDir !== targetDir) {
        return false;
      }
    }

    // Se especificada a gerencia_id, valida correspondência
    if (gerencia_id && c.gerencia_id) {
      const rowGer = String(c.gerencia_id).trim().toLowerCase();
      const targetGer = String(gerencia_id).trim().toLowerCase();
      if (rowGer && rowGer !== targetGer) {
        return false;
      }
    }

    return true;
  });

  if (!match) {
    return { success: false, error: "Código de acesso inválido ou inativo" };
  }

  if (match.expira_em && new Date(match.expira_em) < new Date()) {
    return { success: false, error: "Código de acesso expirado" };
  }

  return {
    success: true,
    data: {
      id: match.id || null,
      scope: match.scope,
      diretoria_id: match.diretoria_id || null,
      gerencia_id: match.gerencia_id || null,
      expired_at: match.expira_em || null
    }
  };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= REMOÇÃO DE DUPLICATAS NA PLANILHA =================

/**
 * Remove linhas duplicadas em uma aba com base em uma ou mais colunas-chave.
 * Preserva a primeira ocorrência encontrada e remove fisicamente as subsequentes na planilha.
 */
function deduplicateSheetByKey(sheetName, keyColNames) {
  try {
    const sheet = getSs().getSheetByName(sheetName);
    if (!sheet) return { sheet: sheetName, removed: 0, message: "Aba não encontrada" };
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 2 || lastCol === 0) return { sheet: sheetName, removed: 0, message: "Sem duplicatas possíveis" };

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
    const cols = Array.isArray(keyColNames) ? keyColNames : [keyColNames];
    const colIndices = cols.map(c => headers.indexOf(String(c).trim().toLowerCase())).filter(idx => idx !== -1);

    if (colIndices.length === 0) {
      return { sheet: sheetName, removed: 0, message: "Coluna chave não encontrada nos cabeçalhos" };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const seen = {};
    const rowsToDelete = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const key = colIndices.map(ci => String(row[ci] || "").trim().toLowerCase()).join("|");
      if (!key) continue;
      if (seen[key]) {
        rowsToDelete.push(i + 2); // +2: índice 1-based e pula o cabeçalho
      } else {
        seen[key] = true;
      }
    }

    if (rowsToDelete.length === 0) {
      return { sheet: sheetName, removed: 0, message: "Nenhuma duplicata encontrada" };
    }

    // Deleta de trás para frente para preservar a integridade dos índices
    for (let k = rowsToDelete.length - 1; k >= 0; k--) {
      sheet.deleteRow(rowsToDelete[k]);
    }

    return { sheet: sheetName, removed: rowsToDelete.length, message: "Duplicatas removidas com sucesso" };
  } catch (err) {
    return { sheet: sheetName, removed: 0, error: err.message || String(err) };
  }
}

function deduplicateAllSheets() {
  const results = {};
  results[SHEETS.DIRETORIAS] = deduplicateSheetByKey(SHEETS.DIRETORIAS, "sigla");
  results[SHEETS.PERIODOS] = deduplicateSheetByKey(SHEETS.PERIODOS, "id");
  results[SHEETS.GERENCIAS] = deduplicateSheetByKey(SHEETS.GERENCIAS, ["diretoria_id", "sigla"]);
  results[SHEETS.CODIGOS_ACESSO] = deduplicateSheetByKey(SHEETS.CODIGOS_ACESSO, ["scope", "diretoria_id", "gerencia_id", "codigo_hash"]);
  return results;
}

// ================= MIGRAÇÃO DA PLANILHA ANTIGA =================

/**
 * Migra todos os dados de todas as abas da planilha anterior para a nova planilha oficial.
 * Origem: 10av2TSqdF6jOanJ-bBscc3I13vpm1W5RALvsgPAnK-o
 * Destino: 1iAMhiwnwkKDznVYGjCxr-9lzHTiMMDQzmGUdoPUJfnc
 * 
 * - Preserva a integridade de todas as 26 abas.
 * - Aplica deduplicação automática em diretorias, gerencias, periodos e codigos_acesso.
 * - Copia dados completos com cabeçalhos e valores preservados.
 */
/**
 * OPÇÃO 1: Executar a partir da Planilha Nova (Puxar da Antiga)
 * Caso dê erro de permissão: Certifique-se de que a planilha antiga está com
 * acesso de Editor concedido para a sua conta Google atual.
 */
function migrateAllDataFromOldSpreadsheet() {
  let originSs;
  try {
    // Força o escopo do Google Drive para permitir acesso entre planilhas
    DriveApp.getRootFolder();
    originSs = SpreadsheetApp.openById(ORIGIN_SPREADSHEET_ID);
  } catch (permErr) {
    throw new Error(
      "Sem permissão para acessar a planilha antiga (" + ORIGIN_SPREADSHEET_ID + ").\n" +
      "SOLUÇÃO RECOMENDADA:\n" +
      "1. Abra a planilha antiga e clique em 'Compartilhar' > adicione sua conta Google como Editor, OU\n" +
      "2. Execute a função 'exportDataFromOldToNewSpreadsheet' diretamente na Planilha Antiga (Extensões > Apps Script nela)."
    );
  }
  const targetSs = getSs();
  
  const originSheets = originSs.getSheets();
  const report = {
    startedAt: new Date().toISOString(),
    originSpreadsheetId: ORIGIN_SPREADSHEET_ID,
    targetSpreadsheetId: SPREADSHEET_ID,
    migratedSheets: [],
    errors: []
  };

  for (let i = 0; i < originSheets.length; i++) {
    const originSheet = originSheets[i];
    const sheetName = originSheet.getName();
    const lastRow = originSheet.getLastRow();
    const lastCol = originSheet.getLastColumn();

    try {
      if (lastRow <= 0 || lastCol <= 0) {
        report.migratedSheets.push({ name: sheetName, rows: 0, status: "Vazia ignorada" });
        continue;
      }

      // Lê todos os dados da aba de origem em bloco
      const originValues = originSheet.getRange(1, 1, lastRow, lastCol).getValues();
      let targetSheet = targetSs.getSheetByName(sheetName);
      if (!targetSheet) {
        targetSheet = targetSs.insertSheet(sheetName);
      }

      // Aplica deduplicação inteligente em tabelas estruturais conhecidas
      let finalValues = originValues;
      const lowerName = sheetName.toLowerCase().trim();

      if (lowerName === "diretorias" && originValues.length > 1) {
        const headers = originValues[0].map(h => String(h).trim().toLowerCase());
        const siglaIdx = headers.indexOf("sigla");
        if (siglaIdx !== -1) {
          const seen = {};
          finalValues = [originValues[0]];
          for (let r = 1; r < originValues.length; r++) {
            const row = originValues[r];
            const sigla = String(row[siglaIdx] || "").trim().toUpperCase();
            if (!sigla || seen[sigla]) continue;
            seen[sigla] = true;
            finalValues.push(row);
          }
        }
      } else if (lowerName === "gerencias" && originValues.length > 1) {
        const headers = originValues[0].map(h => String(h).trim().toLowerCase());
        const siglaIdx = headers.indexOf("sigla");
        const dirIdx = headers.indexOf("diretoria_id");
        if (siglaIdx !== -1) {
          const seen = {};
          finalValues = [originValues[0]];
          for (let r = 1; r < originValues.length; r++) {
            const row = originValues[r];
            const sigla = String(row[siglaIdx] || "").trim().toUpperCase();
            const dirId = dirIdx !== -1 ? String(row[dirIdx] || "").trim().toLowerCase() : "";
            const key = (dirId && sigla) ? (dirId + "-" + sigla) : sigla;
            if (!key || seen[key]) continue;
            seen[key] = true;
            finalValues.push(row);
          }
        }
      } else if (lowerName === "periodos" && originValues.length > 1) {
        const headers = originValues[0].map(h => String(h).trim().toLowerCase());
        const idIdx = headers.indexOf("id");
        const nomeIdx = headers.indexOf("nome");
        const seen = {};
        finalValues = [originValues[0]];
        for (let r = 1; r < originValues.length; r++) {
          const row = originValues[r];
          const key = (idIdx !== -1 && row[idIdx]) ? String(row[idIdx]).trim().toLowerCase() : ((nomeIdx !== -1 && row[nomeIdx]) ? String(row[nomeIdx]).trim().toLowerCase() : "");
          if (!key || seen[key]) continue;
          seen[key] = true;
          finalValues.push(row);
        }
      } else if (lowerName === "codigos_acesso" && originValues.length > 1) {
        const headers = originValues[0].map(h => String(h).trim().toLowerCase());
        const scopeIdx = headers.indexOf("scope");
        const dirIdx = headers.indexOf("diretoria_id");
        const gerIdx = headers.indexOf("gerencia_id");
        const hashIdx = headers.indexOf("codigo_hash");
        const seen = {};
        finalValues = [originValues[0]];
        for (let r = 1; r < originValues.length; r++) {
          const row = originValues[r];
          const sc = scopeIdx !== -1 ? String(row[scopeIdx] || "").trim().toLowerCase() : "";
          const dir = dirIdx !== -1 ? String(row[dirIdx] || "").trim().toLowerCase() : "";
          const ger = gerIdx !== -1 ? String(row[gerIdx] || "").trim().toLowerCase() : "";
          const hash = hashIdx !== -1 ? String(row[hashIdx] || "").trim().toLowerCase() : "";
          const key = sc + "-" + dir + "-" + ger + "-" + hash;
          if (!key || seen[key]) continue;
          seen[key] = true;
          finalValues.push(row);
        }
      }

      // Escreve os dados na aba de destino
      targetSheet.clear();
      const numRows = finalValues.length;
      const numCols = finalValues[0].length;
      targetSheet.getRange(1, 1, numRows, numCols).setValues(finalValues);

      report.migratedSheets.push({
        name: sheetName,
        originRows: lastRow,
        migratedRows: numRows,
        deduplicated: lastRow - numRows,
        status: "Sucesso"
      });
    } catch (sheetErr) {
      report.errors.push({ sheet: sheetName, error: sheetErr.message || String(sheetErr) });
    }
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

/**
 * OPÇÃO 2: Executar diretamente na PLANILHA ANTIGA (Enviar para a Nova)
 * Como você já é proprietário/editor da planilha antiga, ela nunca dará erro de leitura!
 * Basta abrir a Planilha Antiga > Extensões > Apps Script > colar esta função e clicar em Executar!
 */
function exportDataFromOldToNewSpreadsheet() {
  const originSs = SpreadsheetApp.getActiveSpreadsheet();
  const targetSs = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const originSheets = originSs.getSheets();
  const report = {
    startedAt: new Date().toISOString(),
    originSpreadsheet: originSs.getName(),
    targetSpreadsheet: targetSs.getName(),
    migratedSheets: []
  };

  for (let i = 0; i < originSheets.length; i++) {
    const originSheet = originSheets[i];
    const sheetName = originSheet.getName();
    const lastRow = originSheet.getLastRow();
    const lastCol = originSheet.getLastColumn();

    if (lastRow <= 0 || lastCol <= 0) continue;

    const values = originSheet.getRange(1, 1, lastRow, lastCol).getValues();
    let targetSheet = targetSs.getSheetByName(sheetName);
    if (!targetSheet) {
      targetSheet = targetSs.insertSheet(sheetName);
    }
    targetSheet.clear();
    targetSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
    report.migratedSheets.push({ name: sheetName, rows: values.length, status: "OK" });
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

// ================= INICIALIZAÇÃO / CARGA ESTRUTURAL =================

function initSpreadsheet() {
  const ss = getSs();

  // 1. DIRETORIAS
  const sDir = getOrCreateSheet(SHEETS.DIRETORIAS);
  if (sDir.getLastRow() <= 1) {
    const headers = ["id", "sigla", "nome", "descricao", "ativa"];
    const rows = [
      ["36180ff2-6ce5-435c-8da4-c282315a9283", "DG", "Diretoria de Gestão Administrativa Financeira e de Pessoas", "Gestão administrativa, financeira e de pessoas", true],
      ["684972d4-a9ef-4f8e-b849-4576e5c0d8c9", "DC", "Diretoria de Comercialização e Relacionamento com Cliente", "Comercialização, faturamento e relacionamento com cliente", true],
      ["cbe634cd-7c90-400e-babe-b51402d57a50", "PR", "Diretoria da Presidência", "Presidência e planejamento estratégico", true],
      ["56768808-d2ef-4ee8-80e9-743e98898a95", "DE", "Diretoria de Engenharia e Meio Ambiente", "Engenharia, projetos e meio ambiente", true],
      ["842c2695-a38b-4ffa-aeb7-0f9d5753fb34", "DO", "Diretoria de Operação e Manutenção", "Operação e manutenção dos sistemas", true]
    ];
    sDir.clear();
    sDir.getRange(1, 1, 1, headers.length).setValues([headers]);
    sDir.getRange(2, 1, rows.length, headers.length).setValues(rows);
  } else {
    deduplicateSheetByKey(SHEETS.DIRETORIAS, "sigla");
  }

  // 2. GERÊNCIAS
  const sGer = getOrCreateSheet(SHEETS.GERENCIAS);
  if (sGer.getLastRow() <= 1) {
    const headers = ["id", "diretoria_id", "sigla", "nome", "ativa"];
    const gerencias = [
      // DC
      ["ger-ccrr", "684972d4-a9ef-4f8e-b849-4576e5c0d8c9", "CCRR", "Gerência de Relacionamento com Cliente", true],
      ["ger-ccrf", "684972d4-a9ef-4f8e-b849-4576e5c0d8c9", "CCRF", "Gerência de Faturamento e Arrecadação", true],
      ["ger-ccrc", "684972d4-a9ef-4f8e-b849-4576e5c0d8c9", "CCRC", "Gerência de Operações Comerciais", true],
      // DE
      ["ger-epro", "56768808-d2ef-4ee8-80e9-743e98898a95", "EPRO", "Gerência de Projetos", true],
      ["ger-eobr", "56768808-d2ef-4ee8-80e9-743e98898a95", "EOBR", "Gerência de Obras", true],
      ["ger-emar", "56768808-d2ef-4ee8-80e9-743e98898a95", "EMAR", "Gerência de Meio Ambiente e Recursos Hídricos", true],
      ["ger-epre", "56768808-d2ef-4ee8-80e9-743e98898a95", "EPRE", "Gerência de Projetos e Obras Especiais", true],
      // DG
      ["ger-gcfi", "36180ff2-6ce5-435c-8da4-c282315a9283", "GCFI", "Gerência Contábil e Financeira", true],
      ["ger-gsad", "36180ff2-6ce5-435c-8da4-c282315a9283", "GSAD", "Gerência de Suporte Administrativo", true],
      ["ger-gpce", "36180ff2-6ce5-435c-8da4-c282315a9283", "GPCE", "Gerência de Planejamento e Controle Econômico", true],
      ["ger-gpes", "36180ff2-6ce5-435c-8da4-c282315a9283", "GPES", "Gerência de Gestão de Pessoas", true],
      ["ger-glog", "36180ff2-6ce5-435c-8da4-c282315a9283", "GLOG", "Gerência de Logística e Patrimônio", true],
      // DO
      ["ger-oope", "842c2695-a38b-4ffa-aeb7-0f9d5753fb34", "OOPE", "Gerência de Operações", true],
      ["ger-oman", "842c2695-a38b-4ffa-aeb7-0f9d5753fb34", "OMAN", "Gerência de Manutenção", true],
      ["ger-oeng", "842c2695-a38b-4ffa-aeb7-0f9d5753fb34", "OENG", "Gerência de Engenharia Operacional", true],
      ["ger-oqua", "842c2695-a38b-4ffa-aeb7-0f9d5753fb34", "OQUA", "Gerência de Controle de Qualidade", true],
      // PR
      ["ger-utin", "cbe634cd-7c90-400e-babe-b51402d57a50", "UTIN", "Gerência de Tecnologia da Informação", true],
      ["ger-uep", "cbe634cd-7c90-400e-babe-b51402d57a50", "UEP", "Unidade Especial de Planejamento e Inovação", true],
      ["ger-audit", "cbe634cd-7c90-400e-babe-b51402d57a50", "AUDIT", "Auditoria Interna", true],
      ["ger-pro", "cbe634cd-7c90-400e-babe-b51402d57a50", "PRO", "Ouvidoria", true],
      ["ger-ascom", "cbe634cd-7c90-400e-babe-b51402d57a50", "ASCOM", "Assessoria de Comunicação", true],
      ["ger-prj", "cbe634cd-7c90-400e-babe-b51402d57a50", "PRJ", "Procuradoria Jurídica", true],
      ["ger-prl", "cbe634cd-7c90-400e-babe-b51402d57a50", "PRL", "Central de Licitação", true]
    ];
    sGer.clear();
    sGer.getRange(1, 1, 1, headers.length).setValues([headers]);
    sGer.getRange(2, 1, gerencias.length, headers.length).setValues(gerencias);
  } else {
    deduplicateSheetByKey(SHEETS.GERENCIAS, ["diretoria_id", "sigla"]);
  }

  // 3. PERÍODOS
  const sPer = getOrCreateSheet(SHEETS.PERIODOS);
  if (sPer.getLastRow() <= 1) {
    const headers = ["id", "nome", "inicio", "fim", "ativo", "created_at"];
    const rows = [
      ["1d7edd8a-f895-4835-8139-8e53dbbf73b7", "PAC 2027 - Preenchimento Plano Anual", "2026-02-17", "2026-09-30", true, new Date().toISOString()]
    ];
    sPer.clear();
    sPer.getRange(1, 1, 1, headers.length).setValues([headers]);
    sPer.getRange(2, 1, rows.length, headers.length).setValues(rows);
  } else {
    deduplicateSheetByKey(SHEETS.PERIODOS, "id");
  }

  // 4. CÓDIGOS DE ACESSO
  const sCod = getOrCreateSheet(SHEETS.CODIGOS_ACESSO);
  if (sCod.getLastRow() <= 1) {
    const headers = ["id", "diretoria_id", "gerencia_id", "scope", "codigo_hash", "ativo", "expira_em"];
    const codes = [
      ["cod-admin", "", "", "admin", sha256("admin123"), true, ""],
      ["cod-compras", "", "", "compras", sha256("compras123"), true, ""],
      // Diretorias
      ["cod-dg", "36180ff2-6ce5-435c-8da4-c282315a9283", "", "diretoria", sha256("dg1234"), true, ""],
      ["cod-dc", "684972d4-a9ef-4f8e-b849-4576e5c0d8c9", "", "diretoria", sha256("dc1234"), true, ""],
      ["cod-pr", "cbe634cd-7c90-400e-babe-b51402d57a50", "", "diretoria", sha256("pr1234"), true, ""],
      ["cod-de", "56768808-d2ef-4ee8-80e9-743e98898a95", "", "diretoria", sha256("de1234"), true, ""],
      ["cod-do", "842c2695-a38b-4ffa-aeb7-0f9d5753fb34", "", "diretoria", sha256("do1234"), true, ""]
    ];

    const gerenciasData = getSheetData(SHEETS.GERENCIAS);
    gerenciasData.forEach(g => {
      const codePlain = String(g.sigla || "").toLowerCase() + "1234";
      codes.push(["cod-" + String(g.sigla || "").toLowerCase(), g.diretoria_id, g.id, "gerencia", sha256(codePlain), true, ""]);
    });

    sCod.clear();
    sCod.getRange(1, 1, 1, headers.length).setValues([headers]);
    sCod.getRange(2, 1, codes.length, headers.length).setValues(codes);
  }

  // 5. SOLICITAÇÕES
  const sSol = getOrCreateSheet(SHEETS.SOLICITACOES);
  if (sSol.getLastRow() <= 0) {
    const headers = ["id", "periodo_id", "diretoria_id", "gerencia_id", "item_id", "codigo", "descricao", "categoria", "unidade", "qtd_estimada", "valor_unitario", "prioridade", "observacao", "status", "justificativa_rejeicao", "created_at", "updated_at"];
    sSol.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 6. SERVIÇOS
  const sSer = getOrCreateSheet(SHEETS.SERVICOS);
  if (sSer.getLastRow() <= 0) {
    const headers = ["id", "periodo_id", "diretoria_id", "gerencia_id", "item", "tipo_contratacao", "unidade_demandante", "objeto", "justificativa", "previsao_inicio", "estimativa_valor", "dotacao_orcamentaria", "grau_prioridade", "vinculacao", "dependencia_descricao", "contrato", "contratada", "status", "observacao", "justificativa_rejeicao", "created_at", "updated_at"];
    sSer.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 7. SERVIÇOS CATÁLOGO
  const sCat = getOrCreateSheet(SHEETS.SERVICOS_CATALOGO);
  if (sCat.getLastRow() <= 0) {
    const headers = ["id", "item", "tipo_contratacao", "objeto", "justificativa", "estimativa_valor", "grau_prioridade", "vinculacao", "dependencia_descricao", "contrato", "contratada", "diretoria_id", "gerencia_id", "created_at"];
    sCat.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 8. ITENS CATÁLOGO (MATERIAIS)
  const sItens = getOrCreateSheet(SHEETS.ITENS_CATALOGO);
  if (sItens.getLastRow() <= 0) {
    const headers = ["id", "codigo", "descricao", "categoria", "unidade", "valor_unitario", "created_at"];
    sItens.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 9. LOGS ATIVIDADES
  const sLog = getOrCreateSheet(SHEETS.LOGS);
  if (sLog.getLastRow() <= 0) {
    const headers = ["id", "matricula", "acao", "tabela_afetada", "registro_id", "detalhes", "deleted_at", "created_at"];
    sLog.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 10. TRILHA FINANCEIRA (LOG ORÇAMENTÁRIO)
  const sOrcLog = getOrCreateSheet(SHEETS.LOGS_ORCAMENTARIOS);
  if (sOrcLog.getLastRow() <= 0) {
    const headers = ["id", "referencia_id", "tipo", "escopo", "valor_anterior", "valor_novo", "motivo", "usuario_matricula", "centro_custo_id", "created_at"];
    sOrcLog.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 11. ADMIN CONFIG
  const sCfg = getOrCreateSheet(SHEETS.ADMIN_CONFIG);
  if (sCfg.getLastRow() <= 0) {
    const headers = ["id", "chave", "valor", "updated_at"];
    sCfg.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 12. RESTRIÇÕES DE ATIVIDADES
  const sRest = getOrCreateSheet(SHEETS.RESTRICOES);
  if (sRest.getLastRow() <= 0) {
    const headers = ["id", "periodo_id", "escopo_tipo", "diretoria_id", "gerencia_id", "perfil", "modulo", "atividade", "status", "ativo", "observacao", "criado_por", "created_at", "updated_at"];
    sRest.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return { message: "Planilha estruturada e pré-populada com sucesso!" };
}
