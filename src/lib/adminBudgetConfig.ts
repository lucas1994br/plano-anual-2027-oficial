export interface RoutingRule {
  destinoTipo: "diretoria" | "compras" | "admin";
  destinoId: string;
}

export interface AdminBudgetConfig {
  diretoriaBudgetsAquisicao?: Record<string, number>;
  diretoriaBudgetsServicos?: Record<string, number>;
  diretoriaBudgetsServicosNovos?: Record<string, number>;
  diretoriaBudgetsServicosExistentes?: Record<string, number>;
  diretoriaBudgetsOrcamentoGeral?: Record<string, number>;
  gerenciaBudgetsAquisicao?: Record<string, number>;
  gerenciaBudgetsServicos?: Record<string, number>;
  gerenciaBudgetsServicosNovos?: Record<string, number>;
  gerenciaBudgetsServicosExistentes?: Record<string, number>;
  gerenciaBudgetsOrcamentoGeral?: Record<string, number>;
  // Legado
  diretoriaBudgets?: Record<string, number>;
  gerenciaBudgets?: Record<string, number>;
  routingRules: Record<string, RoutingRule>;
  categoryBudgetOwners?: Record<string, string>;
  updatedAt: string;
}

export const ADMIN_BUDGET_STORAGE_KEY = "admin-mini-erp-config-v2";
export const DEFAULT_BUDGET_OWNER = "__solicitante__";

const normalizeCategoryKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

export function loadAdminBudgetConfig(): AdminBudgetConfig | null {
  try {
    const raw = localStorage.getItem(ADMIN_BUDGET_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminBudgetConfig;
  } catch {
    return null;
  }
}

export function saveAdminBudgetConfig(config: AdminBudgetConfig) {
  localStorage.setItem(ADMIN_BUDGET_STORAGE_KEY, JSON.stringify(config));
}

export function getBudgetOwnerDiretoriaId(
  config: AdminBudgetConfig | null,
  categoria: string,
  solicitanteDiretoriaId: string,
  dbRules?: Record<string, string>,
) {
  const categoriaNormalizada = normalizeCategoryKey(categoria || "");

  const findOwnerByNormalizedKey = (rules?: Record<string, string>) => {
    if (!rules) return undefined;

    if (rules[categoria]) return rules[categoria];

    const match = Object.entries(rules).find(([key]) => normalizeCategoryKey(key) === categoriaNormalizada);
    return match?.[1];
  };

  const configuredOwner =
    findOwnerByNormalizedKey(dbRules) ??
    findOwnerByNormalizedKey(config?.categoryBudgetOwners);

  if (!configuredOwner || configuredOwner === DEFAULT_BUDGET_OWNER) {
    return solicitanteDiretoriaId;
  }

  return configuredOwner;
}

export function getDiretoriaBudget(
  config: AdminBudgetConfig | null,
  diretoriaId: string,
  tipo: "aquisicao" | "servicos" | "servicos_novos" | "servicos_existentes",
) {
  if (!config) return 0;

  const baseBudget = (() => {
    if (tipo === "aquisicao") {
      return config.diretoriaBudgetsAquisicao?.[diretoriaId] ?? config.diretoriaBudgets?.[diretoriaId] ?? 0;
    }
    if (tipo === "servicos_novos") {
      return config.diretoriaBudgetsServicosNovos?.[diretoriaId] ?? 0;
    }
    if (tipo === "servicos_existentes") {
      return config.diretoriaBudgetsServicosExistentes?.[diretoriaId] ?? 0;
    }
    return config.diretoriaBudgetsServicos?.[diretoriaId] ?? 0;
  })();

  const geralBudget = config.diretoriaBudgetsOrcamentoGeral?.[diretoriaId] ?? 0;
  return baseBudget + geralBudget;
}

export function getGerenciaBudget(
  config: AdminBudgetConfig | null,
  gerenciaId: string,
  tipo: "aquisicao" | "servicos" | "servicos_novos" | "servicos_existentes",
) {
  if (!config) return 0;

  const baseBudget = (() => {
    if (tipo === "aquisicao") {
      return config.gerenciaBudgetsAquisicao?.[gerenciaId] ?? config.gerenciaBudgets?.[gerenciaId] ?? 0;
    }
    if (tipo === "servicos_novos") {
      return config.gerenciaBudgetsServicosNovos?.[gerenciaId] ?? 0;
    }
    if (tipo === "servicos_existentes") {
      return config.gerenciaBudgetsServicosExistentes?.[gerenciaId] ?? 0;
    }
    return config.gerenciaBudgetsServicos?.[gerenciaId] ?? 0;
  })();

  const geralBudget = config.gerenciaBudgetsOrcamentoGeral?.[gerenciaId] ?? 0;
  return baseBudget + geralBudget;
}

export function getTotalDiretoriaBudget(
  config: AdminBudgetConfig | null,
  diretoriaId: string
) {
  if (!config) return 0;
  
  const aquisicao = config.diretoriaBudgetsAquisicao?.[diretoriaId] ?? config.diretoriaBudgets?.[diretoriaId] ?? 0;
  const servicosNovos = config.diretoriaBudgetsServicosNovos?.[diretoriaId] ?? 0;
  const servicosExistentes = config.diretoriaBudgetsServicosExistentes?.[diretoriaId] ?? 0;
  const geral = config.diretoriaBudgetsOrcamentoGeral?.[diretoriaId] ?? 0;

  return aquisicao + servicosNovos + servicosExistentes + geral;
}

export function getTotalGerenciaBudget(
  config: AdminBudgetConfig | null,
  gerenciaId: string
) {
  if (!config) return 0;
  
  const aquisicao = config.gerenciaBudgetsAquisicao?.[gerenciaId] ?? config.gerenciaBudgets?.[gerenciaId] ?? 0;
  const servicosNovos = config.gerenciaBudgetsServicosNovos?.[gerenciaId] ?? 0;
  const servicosExistentes = config.gerenciaBudgetsServicosExistentes?.[gerenciaId] ?? 0;
  const geral = config.gerenciaBudgetsOrcamentoGeral?.[gerenciaId] ?? 0;

  return aquisicao + servicosNovos + servicosExistentes + geral;
}
