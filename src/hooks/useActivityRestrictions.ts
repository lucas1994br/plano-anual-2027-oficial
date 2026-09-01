import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRestricoesAtividades, evaluateActivityPermission } from "@/lib/services";
import type {
  RestricaoAtividade,
  ActivityPermissionContext,
  PermissionCheckResult,
  ModuloTipo,
  AtividadeTipo,
} from "@/types/restricoes";

interface UseActivityRestrictionsOptions {
  periodoId?: string;
  gerenciaId?: string;
  diretoriaId?: string;
  perfil?: "gerencia" | "diretoria" | "compras" | "admin";
  enabled?: boolean;
}

export function useActivityRestrictions({
  periodoId,
  gerenciaId,
  diretoriaId,
  perfil,
  enabled = true,
}: UseActivityRestrictionsOptions = {}) {
  const {
    data: rawRules = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["restricoes-atividades", periodoId || "all"],
    queryFn: () => getRestricoesAtividades(periodoId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const rules = rawRules as RestricaoAtividade[];

  const activeRules = useMemo(
    () => rules.filter((r) => r.ativo),
    [rules]
  );

  const checkPermission = useCallback(
    (
      modulo: ModuloTipo,
      atividade: AtividadeTipo | string,
      overrideContext?: Partial<ActivityPermissionContext>
    ): PermissionCheckResult => {
      const ctx: ActivityPermissionContext = {
        periodoId: overrideContext?.periodoId ?? periodoId,
        gerenciaId: overrideContext?.gerenciaId ?? gerenciaId,
        diretoriaId: overrideContext?.diretoriaId ?? diretoriaId,
        perfil: overrideContext?.perfil ?? perfil,
        modulo,
        atividade,
      };

      return evaluateActivityPermission(activeRules, ctx);
    },
    [activeRules, periodoId, gerenciaId, diretoriaId, perfil]
  );

  const isBlocked = useCallback(
    (
      modulo: ModuloTipo,
      atividade: AtividadeTipo | string,
      overrideContext?: Partial<ActivityPermissionContext>
    ): boolean => {
      return checkPermission(modulo, atividade, overrideContext).blocked;
    },
    [checkPermission]
  );

  const getBlockReason = useCallback(
    (
      modulo: ModuloTipo,
      atividade: AtividadeTipo | string,
      overrideContext?: Partial<ActivityPermissionContext>
    ): string | undefined => {
      const res = checkPermission(modulo, atividade, overrideContext);
      return res.blocked ? res.reason : undefined;
    },
    [checkPermission]
  );

  const blockedCount = useMemo(
    () => activeRules.filter((r) => r.status === "bloqueado").length,
    [activeRules]
  );

  const liberadoCount = useMemo(
    () => activeRules.filter((r) => r.status === "liberado").length,
    [activeRules]
  );

  return {
    rules,
    activeRules,
    isLoading,
    isError,
    refetch,
    checkPermission,
    isBlocked,
    getBlockReason,
    blockedCount,
    liberadoCount,
    hasAnyRestriction: activeRules.length > 0,
  };
}
