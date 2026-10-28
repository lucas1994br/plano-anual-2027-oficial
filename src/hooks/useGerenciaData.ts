import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import {
  getDiretorias,
  getGerenciasByDiretoria,
  getPeriodosAtivos,
  getCategoryBudgetOwnerRules,
  getAdminMiniErpConfigDb,
  getSolicitacoesByGerencia,
  getServicosByGerencia,
  getServicosCatalogo,
  default as getItensCatalogo
} from "@/lib/services";
import { loadAdminBudgetConfig, AdminBudgetConfig } from "@/lib/adminBudgetConfig";
import { Gerencia } from "@/types/plan";
import { resolveGerenciaNome } from "@/data/gerencias";

export function useGerenciaData(siglaUpper: string, gerenciaUpper: string) {
  const queryClient = useQueryClient();

  const { data: diretorias = [], isLoading: isLoadingDiretorias } = useQuery<any[]>({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
    staleTime: 5 * 60 * 1000,
  });

  const diretoria = (diretorias as any[]).find((d: any) => d.sigla === siglaUpper);
  const diretoriaMap = useMemo(() => {
    const map: Record<string, any> = {};
    (diretorias as any[]).forEach((dir: any) => {
      map[dir.id] = dir;
    });
    return map;
  }, [diretorias]);

  const { data: gerenciasData = [], isLoading: isLoadingGerencias } = useQuery<any[]>({
    queryKey: ["gerencias", diretoria?.id],
    queryFn: () => diretoria ? getGerenciasByDiretoria(diretoria.id) : Promise.resolve([]),
    enabled: !!diretoria,
    staleTime: 5 * 60 * 1000,
  });

  const { data: periodos = [], isLoading: isLoadingPeriodos } = useQuery<any[]>({
    queryKey: ["periodos"],
    queryFn: getPeriodosAtivos,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoryBudgetOwnersFromDb = {} } = useQuery({
    queryKey: ["category-budget-owners-db"],
    queryFn: getCategoryBudgetOwnerRules,
    staleTime: 5 * 60 * 1000,
  });

  const { data: adminMiniConfigFromDb = {} } = useQuery({
    queryKey: ["admin-mini-erp-config-db"],
    queryFn: getAdminMiniErpConfigDb,
    staleTime: 5 * 60 * 1000,
  });

  const periodAtivo = periodos[0];
  const prazo = periodAtivo ? new Date(periodAtivo.fim) : null;

  const gerenciaAtual = gerenciasData.find((g: Gerencia) => g.sigla === gerenciaUpper) as Gerencia | undefined;
  const gerenciaNome = resolveGerenciaNome(gerenciaUpper, gerenciaAtual?.nome);

  const { data: solicitacoes = [], isLoading: isLoadingSolicitacoes } = useQuery({
    queryKey: ["solicitacoes", gerenciaAtual?.id, periodAtivo?.id],
    queryFn: () => (gerenciaAtual && periodAtivo) ? getSolicitacoesByGerencia(gerenciaAtual.id, periodAtivo.id) : [],
    enabled: !!periodAtivo && !!gerenciaAtual,
    staleTime: 2 * 60 * 1000,
  });

  const { data: servicosData = [], isLoading: isLoadingServicos } = useQuery({
    queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id],
    queryFn: () =>
      (gerenciaAtual && periodAtivo)
        ? getServicosByGerencia(gerenciaAtual.id, periodAtivo.id)
        : [],
    enabled: !!periodAtivo && !!gerenciaAtual,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: servicosCatalogoData = [], isLoading: isLoadingServicosCatalogo } = useQuery<any[]>({
    queryKey: ["servicos-catalogo"],
    queryFn: () => getServicosCatalogo(),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Listener para sincronização automática quando serviços forem atualizados no Painel Administrativo
  useEffect(() => {
    const handleServicosCatalogoUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
    };

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === "servicos_catalogo_last_updated") {
        queryClient.invalidateQueries({ queryKey: ["servicos"] });
        queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      }
    };

    window.addEventListener("servicos_catalogo_updated", handleServicosCatalogoUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("servicos_catalogo_updated", handleServicosCatalogoUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [queryClient]);

  const orcamentoConfig = useMemo(() => {
    const localConfig = loadAdminBudgetConfig();
    const dbConfig = adminMiniConfigFromDb as Partial<AdminBudgetConfig>;

    if (!localConfig && !dbConfig) return null;

    return {
      ...(localConfig || {}),
      ...(dbConfig || {}),
      routingRules: dbConfig?.routingRules || localConfig?.routingRules || {},
      categoryBudgetOwners: localConfig?.categoryBudgetOwners || {},
    } as AdminBudgetConfig;
  }, [adminMiniConfigFromDb]);

  const { data: catalogoData = [], isLoading: isLoadingCatalogo } = useQuery<any[]>({
    queryKey: ["itens-catalogo"],
    queryFn: () => getItensCatalogo(),
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  const isAquisicaoLoading = isLoadingDiretorias || isLoadingGerencias || isLoadingPeriodos || isLoadingCatalogo || (!!gerenciaAtual && !!periodAtivo && isLoadingSolicitacoes);
  const isServicosLoading = isLoadingDiretorias || isLoadingGerencias || isLoadingPeriodos || isLoadingServicos || isLoadingServicosCatalogo;

  return {
    diretoria,
    diretoriaMap,
    gerenciaAtual,
    gerenciaNome,
    periodAtivo,
    prazo,
    solicitacoes,
    servicosData,
    servicosCatalogoData,
    catalogoData,
    orcamentoConfig,
    categoryBudgetOwnersFromDb,
    isAquisicaoLoading,
    isServicosLoading,
  };
}

