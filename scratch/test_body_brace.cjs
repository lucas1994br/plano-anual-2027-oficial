const fs = require('fs');

const content = fs.readFileSync('src/lib/services.backup.ts', 'utf8');

const targets = [
  'export async function registrarLogAtividade(',
  'export async function registrarLogAtividadeBulk(',
  'export async function getDiretorias(): Promise<DiretoriaRow[]> {',
  'export async function getGerenciasByDiretoria(',
  'export async function getAllGerencias(): Promise<Record<string, unknown>[]> {',
  'export async function getTodasGerencias(): Promise<Record<string, unknown>[]> {',
  'export async function getDiretoriasComDetalhes(): Promise<',
  'export async function getPeriodosAtivos(): Promise<Record<string, unknown>[]> {',
  'export async function getTodosPeriodos(): Promise<Record<string, unknown>[]> {',
  'export async function createPeriodo(periodo:',
  'export async function updatePeriodo(',
  'export async function getSolicitacoesByGerencia(',
  'export async function deleteSolicitacao(',
  'export async function deleteSolicitacoesBulk(',
  'export async function getSolicitacoesByDiretoria(',
  'export async function getSolicitacoesByPeriodo({',
  'export async function getSolicitacoesCompras(',
  'export async function getServicosCompras(',
  'export async function getSolicitacoesResumoByPeriodo({',
  'export async function getServicosResumoByPeriodo({',
  'export async function createSolicitacao(',
  'export async function updateSolicitacao(',
  'export async function updateSolicitacaoStatus(',
  'export async function updateSolicitacaoStatusBulk(',
  'export async function updateServicoStatusBulk(',
  'export async function updateSolicitacoesBulkData(',
  'export async function updateServicosBulkData(',
  'export async function getServicosByGerencia(',
  'export async function getServicosByDiretoria(',
  'export async function getServicosByPeriodo({',
  'export const deleteServico =',
  'export async function deleteServicosBulk(',
  'export async function createServico(',
  'export async function updateServico(',
  'export async function getServicosCatalogo(): Promise<unknown[]> {',
  'export async function createServicoCatalogoAndDistribuir(',
  'export async function updateServicoCatalogoAdmin(',
  'export async function deleteServicoCatalogoAdmin(',
  'export default async function getItensCatalogo(): Promise<unknown[]> {',
  'export async function createItemCatalogoAndDistribuir(',
  'export async function updateItemCatalogoAdmin(',
  'export async function deleteItemCatalogoAdmin(',
  'export async function validateAccessCode(',
  'export async function getAdminMiniErpConfigDb() {',
  'export async function saveAdminMiniErpConfigDb(',
  'export async function getLogsAtividades() {',
  'export async function getLixeiraLogsAtividades() {',
  'export async function deleteLogAtividade(',
  'export async function deleteLogsAtividadeBulk(',
  'export async function restoreLogAtividade(',
  'export async function restoreLogsAtividadeBulk(',
  'export async function hardDeleteLogAtividade(',
  'export async function hardDeleteLogsAtividadeBulk(',
  'export async function getLogsOrcamentarios(): Promise<any[]> {',
  'export async function deleteLogOrcamentario(',
  'export async function deleteLogsOrcamentarioBulk(',
  'export async function getRestricoesAtividades(',
  'export async function transferirSolicitacoesParaGerenciaBulk(',
  'export async function transferirServicosParaGerenciaBulk('
];

targets.forEach(t => {
  const idx = content.indexOf(t);
  if (idx === -1) {
    console.log('MISSING:', t);
  } else {
    // Find the matching `{` for the function body
    // Strategy: find `):` or `) {` after idx
    const returnTypeIdx = content.indexOf('):', idx);
    const arrowIdx = content.indexOf('=> {', idx);
    const parenBraceIdx = content.indexOf(') {', idx);

    let bodyBrace = -1;
    if (arrowIdx !== -1 && (returnTypeIdx === -1 || arrowIdx < returnTypeIdx)) {
      bodyBrace = arrowIdx + 3;
    } else if (returnTypeIdx !== -1) {
      bodyBrace = content.indexOf('{', returnTypeIdx);
    } else if (parenBraceIdx !== -1) {
      bodyBrace = parenBraceIdx + 2;
    }

    if (bodyBrace === -1) {
      console.log('NO BODY BRACE:', t);
    } else {
      // console.log('OK:', t.substring(0, 40), 'at char', bodyBrace);
    }
  }
});
console.log('Check finished.');
