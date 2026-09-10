const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('src/lib/services.ts');
let content = fs.readFileSync(targetFile, 'utf8');

function injectAfter(funcSignature, injectionCode) {
  if (content.includes(injectionCode.trim())) return; // Já injetado
  const idx = content.indexOf(funcSignature);
  if (idx === -1) {
    console.warn(`Assinatura não encontrada: ${funcSignature.substring(0, 50)}...`);
    return;
  }
  const braceIdx = content.indexOf('{', idx);
  if (braceIdx === -1) return;

  const before = content.substring(0, braceIdx + 1);
  const after = content.substring(braceIdx + 1);
  content = before + '\n' + injectionCode + after;
}

injectAfter('export const deleteServico = async (idOrItem: string | number): Promise<boolean> => {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServico(String(idOrItem));
    await registrarLogAtividade("EXCLUIR", "servicos", String(idOrItem));
    return true;
  }`);

injectAfter('export async function deleteServicosBulk(itemIds: (string | number)[]): Promise<boolean> {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteServicosBulk(itemIds.map(String));
    await registrarLogAtividadeBulk("EXCLUIR", "servicos", itemIds.map(String));
    return true;
  }`);

injectAfter('export async function updateSolicitacoesBulkData(', `  if (gs.isGoogleSheetsActive()) {
    const items = ids.map(id => ({ id, ...updates }));
    await gs.gsUpdateSolicitacoesBulkData(items);
    await registrarLogAtividadeBulk("EDITAR", "solicitacoes", ids, { acao: "updateSolicitacoesBulkData" });
    return;
  }`);

injectAfter('export async function updateServicosBulkData(', `  if (gs.isGoogleSheetsActive()) {
    const dbUpdates = mapServicoItemToDb(updates);
    const items = ids.map(id => ({ id, ...dbUpdates }));
    await gs.gsUpdateServicosBulkData(items);
    await registrarLogAtividadeBulk("EDITAR", "servicos", ids, { acao: "updateServicosBulkData" });
    return;
  }`);

injectAfter('export async function saveAdminMiniErpConfigDb(config: {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsSaveAdminConfig("admin_mini_erp_config", config);
    await registrarLogAtividade("EDITAR", "configuracoes", "admin-mini-erp-config", { acao: "saveAdminMiniErpConfigDb" });
    return { success: true };
  }`);

injectAfter('export async function deleteLogsAtividadeBulk(ids: string[]) {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsDeleteLogsAtividadeBulk(ids);
    return true;
  }`);

injectAfter('export async function restoreLogsAtividadeBulk(ids: string[]) {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsRestoreLogsAtividadeBulk(ids);
    return true;
  }`);

injectAfter('export async function hardDeleteLogsAtividadeBulk(ids: string[]) {', `  if (gs.isGoogleSheetsActive()) {
    await gs.gsHardDeleteLogsAtividadeBulk(ids);
    return true;
  }`);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Restantes funções atualizadas com sucesso em src/lib/services.ts!');
