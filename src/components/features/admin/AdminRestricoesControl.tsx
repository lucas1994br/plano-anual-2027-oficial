import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SlidersHorizontal,
  FileSpreadsheet,
  FileDown,
  Layers,
  Building2,
  Building,
  Users,
  CheckSquare,
  ChevronDown,
  Check,
  RotateCcw,
  X,
} from "lucide-react";
import {
  getRestricoesAtividades,
  createRestricaoAtividade,
  createRestricoesAtividadesBulk,
  updateRestricaoAtividade,
  toggleRestricaoAtividade,
  deleteRestricaoAtividade,
  deleteRestricoesAtividadesBulk,
  upsertPerfilRestricao,
  upsertMultiplosEscoposRestricao,
  getTodosPeriodos,
  getDiretorias,
  getTodasGerencias,
} from "@/lib/services";
import {
  RestricaoAtividade,
  ModuloTipo,
  AtividadeTipo,
  EscopoTipo,
  PerfilTipo,
  StatusRestricao,
  MODULOS_CONFIG,
} from "@/types/restricoes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SmartPagination } from "@/components/common/SmartPagination";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useSortableTable } from "@/hooks/useSortableTable";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

const GERENCIA_ACTIONS = [
  { id: "enviar_solicitacao", label: "📤 Enviar Solicitação", desc: "Envio de solicitações de Aquisição e Serviços para a diretoria", modulo: "todos" },
  { id: "adicionar_item", label: "➕ Adicionar Itens / Serviços", desc: "Inclusão de itens do catálogo e novos serviços no plano", modulo: "todos" },
  { id: "alterar_quantidade", label: "✏️ Editar Quantidades e Valores", desc: "Alteração de quantidades, estimativas e prioridades", modulo: "todos" },
  { id: "devolver_solicitacao", label: "🔄 Devolver Solicitação", desc: "Devolução de itens enviados de volta para rascunho", modulo: "todos" },
  { id: "excluir_item", label: "🗑️ Excluir Itens / Serviços", desc: "Exclusão de itens ou serviços cadastrados", modulo: "todos" },
  { id: "edicao_em_lote", label: "⚡ Edição em Lote", desc: "Alterações em massa de itens ou serviços", modulo: "todos" },
];

const DIRETORIA_ACTIONS = [
  { id: "aprovar", label: "✅ Aprovar Solicitações", desc: "Aprovação de itens e serviços das gerências", modulo: "aprovacao" },
  { id: "reprovar", label: "❌ Reprovar / Rejeitar", desc: "Rejeição de solicitações com justificativa", modulo: "aprovacao" },
  { id: "devolver", label: "🔄 Devolver para Gerência", desc: "Retorno de solicitações para rascunho da gerência", modulo: "aprovacao" },
  { id: "enviar_compras", label: "🚚 Enviar para Compras", desc: "Encaminhamento de demandas para o setor de compras", modulo: "aprovacao" },
  { id: "adicionar_item", label: "➕ Adicionar (Plano Próprio)", desc: "Inclusão direta de itens no plano próprio da diretoria", modulo: "aprovacao" },
  { id: "editar_item", label: "✏️ Editar Solicitações", desc: "Edição de solicitações no painel de aprovação", modulo: "aprovacao" },
];

interface AdminRestricoesControlProps {
  defaultPeriodoId?: string;
}

export function AdminRestricoesControl({ defaultPeriodoId }: AdminRestricoesControlProps) {
  const queryClient = useQueryClient();

  // Estados dos filtros
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>(defaultPeriodoId || "todos");
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("todas");
  const [selectedGerencia, setSelectedGerencia] = useState<string>("todas");
  const [selectedModulo, setSelectedModulo] = useState<string>("todos");
  const [selectedAtividade, setSelectedAtividade] = useState<string>("todas");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedAtivo, setSelectedAtivo] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Estados de modais
  const [isNewDialogOpen, setIsNewDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<RestricaoAtividade | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Seleção em lote para exclusão
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState<boolean>(false);

  // Form de criação / edição
  const [formData, setFormData] = useState({
    periodo_id: "",
    escopo_tipo: "todos" as EscopoTipo,
    diretoria_id: "",
    gerencia_id: "",
    perfil: "todos" as PerfilTipo,
    modulo: "aquisicao" as ModuloTipo,
    atividade: "enviar_solicitacao" as string,
    status: "bloqueado" as StatusRestricao,
    ativo: true,
    observacao: "",
  });

  // Queries
  const { data: periodosRaw = [], isLoading: isLoadingPeriodos } = useQuery({
    queryKey: ["todos-periodos"],
    queryFn: getTodosPeriodos,
  });
  const periodos = periodosRaw as any[];
  const activePeriod = periodos.find((p) => p.ativo);

  const { data: diretorias = [], isLoading: isLoadingDiretorias } = useQuery({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
  });

  const { data: todasGerencias = [] } = useQuery({
    queryKey: ["todas-gerencias"],
    queryFn: getTodasGerencias,
  });

  const {
    data: restricoes = [],
    isLoading: isLoadingRestricoes,
    refetch: refetchRestricoes,
  } = useQuery({
    queryKey: ["restricoes-atividades-admin"],
    queryFn: () => getRestricoesAtividades(),
  });

  // Período efetivo para os controles rápidos
  const effectivePeriodoId = useMemo(() => {
    if (selectedPeriodo && selectedPeriodo !== "todos") return selectedPeriodo;
    return activePeriod?.id || periodos[0]?.id || "";
  }, [selectedPeriodo, activePeriod, periodos]);

  // Estados de escopo múltiplo por gerência / diretoria
  const [gerenciaScopeMode, setGerenciaScopeMode] = useState<"todas" | "selecionadas">("todas");
  const [selectedGerenciaIds, setSelectedGerenciaIds] = useState<Set<string>>(new Set());
  const [searchGerenciaText, setSearchGerenciaText] = useState<string>("");

  const [diretoriaScopeMode, setDiretoriaScopeMode] = useState<"todas" | "selecionadas">("todas");
  const [selectedDiretoriaIds, setSelectedDiretoriaIds] = useState<Set<string>>(new Set());
  const [searchDiretoriaText, setSearchDiretoriaText] = useState<string>("");

  // Regras ativas do período selecionado
  const periodRules = useMemo(() => {
    return restricoes.filter((r) => r.ativo && r.periodo_id === effectivePeriodoId);
  }, [restricoes, effectivePeriodoId]);

  // Checagens de Gerência
  const isGerenciaGeralRestrita = useMemo(() => {
    if (gerenciaScopeMode === "todas") {
      return periodRules.some(
        (r) =>
          r.escopo_tipo === "perfil" &&
          r.perfil === "gerencia" &&
          r.modulo === "todos" &&
          r.atividade === "todas" &&
          r.status === "bloqueado"
      );
    }
    if (selectedGerenciaIds.size === 0) return false;
    return Array.from(selectedGerenciaIds).every((gId) =>
      periodRules.some(
        (r) =>
          r.escopo_tipo === "gerencia" &&
          r.gerencia_id === gId &&
          r.modulo === "todos" &&
          r.atividade === "todas" &&
          r.status === "bloqueado"
      )
    );
  }, [periodRules, gerenciaScopeMode, selectedGerenciaIds]);

  const isGerenciaActionRestrita = (atividade: string, modulo: ModuloTipo = "todos") => {
    if (isGerenciaGeralRestrita) return true;
    if (gerenciaScopeMode === "todas") {
      return periodRules.some(
        (r) =>
          r.escopo_tipo === "perfil" &&
          r.perfil === "gerencia" &&
          (r.modulo === "todos" || r.modulo === modulo) &&
          (r.atividade === atividade || r.atividade === "todas") &&
          r.status === "bloqueado"
      );
    }
    if (selectedGerenciaIds.size === 0) return false;
    return Array.from(selectedGerenciaIds).every((gId) =>
      periodRules.some(
        (r) =>
          r.escopo_tipo === "gerencia" &&
          r.gerencia_id === gId &&
          (r.modulo === "todos" || r.modulo === modulo) &&
          (r.atividade === atividade || r.atividade === "todas") &&
          r.status === "bloqueado"
      )
    );
  };

  const isAnyGerenciaActionRestrita = useMemo(() => {
    return (
      isGerenciaGeralRestrita ||
      GERENCIA_ACTIONS.some((act) => isGerenciaActionRestrita(act.id, act.modulo as any))
    );
  }, [isGerenciaGeralRestrita, periodRules, gerenciaScopeMode, selectedGerenciaIds]);

  // Checagens de Diretoria
  const isDiretoriaGeralRestrita = useMemo(() => {
    if (diretoriaScopeMode === "todas") {
      return periodRules.some(
        (r) =>
          r.escopo_tipo === "perfil" &&
          r.perfil === "diretoria" &&
          (r.modulo === "todos" || r.modulo === "aprovacao") &&
          r.atividade === "todas" &&
          r.status === "bloqueado"
      );
    }
    if (selectedDiretoriaIds.size === 0) return false;
    return Array.from(selectedDiretoriaIds).every((dId) =>
      periodRules.some(
        (r) =>
          r.escopo_tipo === "diretoria" &&
          r.diretoria_id === dId &&
          (r.modulo === "todos" || r.modulo === "aprovacao") &&
          r.atividade === "todas" &&
          r.status === "bloqueado"
      )
    );
  }, [periodRules, diretoriaScopeMode, selectedDiretoriaIds]);

  const isDiretoriaActionRestrita = (atividade: string, modulo: ModuloTipo = "aprovacao") => {
    if (isDiretoriaGeralRestrita) return true;
    if (diretoriaScopeMode === "todas") {
      return periodRules.some(
        (r) =>
          r.escopo_tipo === "perfil" &&
          r.perfil === "diretoria" &&
          (r.modulo === "todos" || r.modulo === modulo) &&
          (r.atividade === atividade || r.atividade === "todas") &&
          r.status === "bloqueado"
      );
    }
    if (selectedDiretoriaIds.size === 0) return false;
    return Array.from(selectedDiretoriaIds).every((dId) =>
      periodRules.some(
        (r) =>
          r.escopo_tipo === "diretoria" &&
          r.diretoria_id === dId &&
          (r.modulo === "todos" || r.modulo === modulo) &&
          (r.atividade === atividade || r.atividade === "todas") &&
          r.status === "bloqueado"
      )
    );
  };

  const isAnyDiretoriaActionRestrita = useMemo(() => {
    return (
      isDiretoriaGeralRestrita ||
      DIRETORIA_ACTIONS.some((act) => isDiretoriaActionRestrita(act.id, act.modulo as any))
    );
  }, [isDiretoriaGeralRestrita, periodRules, diretoriaScopeMode, selectedDiretoriaIds]);

  // Mutação para alternar restrições com suporte a seleção múltipla e atualização otimista instantânea (0ms delay)
  const multiScopeToggleMutation = useMutation({
    mutationFn: (params: {
      periodo_id: string;
      escopo_tipo: "gerencia" | "diretoria" | "perfil";
      perfil?: "gerencia" | "diretoria" | "compras";
      target_ids?: string[];
      modulo: ModuloTipo;
      atividade: AtividadeTipo | string;
      bloqueado: boolean;
      observacao?: string;
    }) => upsertMultiplosEscoposRestricao(params),
    onMutate: async (newParams) => {
      // Cancelar refetches concorrentes para evitar sobrescrever a UI instantânea
      await queryClient.cancelQueries({ queryKey: ["restricoes-atividades-admin"] });
      await queryClient.cancelQueries({ queryKey: ["restricoes-atividades"] });

      // Salvar snapshot do estado anterior
      const previousAdminRules = queryClient.getQueryData<RestricaoAtividade[]>(["restricoes-atividades-admin"]) || [];

      // Aplicar atualização otimista instantânea no cache do React Query
      queryClient.setQueryData<RestricaoAtividade[]>(["restricoes-atividades-admin"], (old = []) => {
        const targetIds = newParams.target_ids && newParams.target_ids.length > 0 ? newParams.target_ids : [undefined];
        const currentRules = [...old];

        targetIds.forEach((targetId) => {
          const existingIdx = currentRules.findIndex((r) => {
            if (r.periodo_id !== newParams.periodo_id) return false;
            if (r.modulo !== newParams.modulo) return false;
            if (r.atividade !== newParams.atividade) return false;
            if (newParams.escopo_tipo === "perfil") {
              return r.escopo_tipo === "perfil" && r.perfil === newParams.perfil;
            }
            if (newParams.escopo_tipo === "gerencia") {
              return r.escopo_tipo === "gerencia" && r.gerencia_id === targetId;
            }
            if (newParams.escopo_tipo === "diretoria") {
              return r.escopo_tipo === "diretoria" && r.diretoria_id === targetId;
            }
            return false;
          });

          if (existingIdx >= 0) {
            currentRules[existingIdx] = {
              ...currentRules[existingIdx],
              ativo: newParams.bloqueado,
              status: "bloqueado",
              observacao: newParams.observacao || currentRules[existingIdx].observacao,
            };
          } else if (newParams.bloqueado) {
            currentRules.push({
              id: `optimistic-${Date.now()}-${Math.random()}`,
              periodo_id: newParams.periodo_id,
              escopo_tipo: newParams.escopo_tipo,
              perfil: newParams.perfil,
              gerencia_id: newParams.escopo_tipo === "gerencia" ? targetId : undefined,
              diretoria_id: newParams.escopo_tipo === "diretoria" ? targetId : undefined,
              modulo: newParams.modulo,
              atividade: newParams.atividade,
              status: "bloqueado",
              ativo: true,
              observacao: newParams.observacao || "",
            });
          }
        });

        return currentRules;
      });

      return { previousAdminRules };
    },
    onError: (err: any, _vars, context) => {
      console.error("Erro ao alternar restrição:", err);
      if (context?.previousAdminRules) {
        queryClient.setQueryData(["restricoes-atividades-admin"], context.previousAdminRules);
      }
      toast.error("Falha ao atualizar restrição.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.bloqueado
          ? `Restrição aplicada com sucesso!`
          : `Restrição removida com sucesso!`
      );
    },
  });

  // Maps auxiliares
  const periodosMap = useMemo(() => {
    const map = new Map<string, string>();
    periodos.forEach((p) => map.set(p.id, p.nome));
    return map;
  }, [periodos]);

  const diretoriasMap = useMemo(() => {
    const map = new Map<string, string>();
    diretorias.forEach((d: any) => map.set(d.id, d.sigla));
    return map;
  }, [diretorias]);

  const gerenciasMap = useMemo(() => {
    const map = new Map<string, { sigla: string; diretoria_id: string; nome?: string }>();
    todasGerencias.forEach((g: any) =>
      map.set(g.id, { sigla: g.sigla, diretoria_id: g.diretoria_id, nome: g.nome })
    );
    return map;
  }, [todasGerencias]);

  // Set com siglas de diretorias para filtro de exclusão
  const diretoriasSiglasSet = useMemo(() => {
    return new Set(diretorias.map((d: any) => (d.sigla || "").toUpperCase().trim()));
  }, [diretorias]);

  // Apenas gerências reais (exclui registros de diretorias presentes na tabela de gerências)
  const apenasGerencias = useMemo(() => {
    return todasGerencias.filter((g: any) => {
      const siglaUpper = (g.sigla || "").toUpperCase().trim();
      const nomeLower = (g.nome || "").toLowerCase().trim();
      if (
        diretoriasSiglasSet.has(siglaUpper) &&
        (nomeLower === "diretoria" ||
          nomeLower.startsWith("diretoria de") ||
          nomeLower.startsWith("diretoria da") ||
          !g.diretoria_id)
      ) {
        return false;
      }
      return true;
    });
  }, [todasGerencias, diretoriasSiglasSet]);

  // Listas filtradas para os seletores múltiplos
  const filteredGerenciasList = useMemo(() => {
    if (!searchGerenciaText) return apenasGerencias;
    const lower = searchGerenciaText.toLowerCase();
    return apenasGerencias.filter(
      (g: any) =>
        g.sigla?.toLowerCase().includes(lower) ||
        g.nome?.toLowerCase().includes(lower)
    );
  }, [apenasGerencias, searchGerenciaText]);

  const filteredDiretoriasList = useMemo(() => {
    if (!searchDiretoriaText) return diretorias;
    const lower = searchDiretoriaText.toLowerCase();
    return diretorias.filter(
      (d: any) =>
        d.sigla?.toLowerCase().includes(lower) ||
        d.nome?.toLowerCase().includes(lower)
    );
  }, [diretorias, searchDiretoriaText]);

  // Handlers de disparo de mutação
  const handleToggleGerenciaGeneral = (checked: boolean) => {
    if (gerenciaScopeMode === "selecionadas" && selectedGerenciaIds.size === 0) {
      toast.error("Selecione ao menos uma gerência na lista para aplicar a restrição.");
      return;
    }

    multiScopeToggleMutation.mutate({
      periodo_id: effectivePeriodoId,
      escopo_tipo: gerenciaScopeMode === "todas" ? "perfil" : "gerencia",
      perfil: "gerencia",
      target_ids: gerenciaScopeMode === "selecionadas" ? Array.from(selectedGerenciaIds) : undefined,
      modulo: "todos",
      atividade: "todas",
      bloqueado: checked,
      observacao:
        gerenciaScopeMode === "todas"
          ? "Bloqueio geral de todas as gerências"
          : `Bloqueio geral para ${selectedGerenciaIds.size} gerência(s) selecionada(s)`,
    });
  };

  const handleToggleGerenciaAction = (act: typeof GERENCIA_ACTIONS[0], checked: boolean) => {
    if (gerenciaScopeMode === "selecionadas" && selectedGerenciaIds.size === 0) {
      toast.error("Selecione ao menos uma gerência na lista para aplicar a restrição.");
      return;
    }

    multiScopeToggleMutation.mutate({
      periodo_id: effectivePeriodoId,
      escopo_tipo: gerenciaScopeMode === "todas" ? "perfil" : "gerencia",
      perfil: "gerencia",
      target_ids: gerenciaScopeMode === "selecionadas" ? Array.from(selectedGerenciaIds) : undefined,
      modulo: act.modulo as any,
      atividade: act.id,
      bloqueado: checked,
      observacao:
        gerenciaScopeMode === "todas"
          ? `Bloqueio da ação ${act.label} para todas as gerências`
          : `Bloqueio da ação ${act.label} para ${selectedGerenciaIds.size} gerência(s) selecionada(s)`,
    });
  };

  const handleToggleDiretoriaGeneral = (checked: boolean) => {
    if (diretoriaScopeMode === "selecionadas" && selectedDiretoriaIds.size === 0) {
      toast.error("Selecione ao menos uma diretoria na lista para aplicar a restrição.");
      return;
    }

    multiScopeToggleMutation.mutate({
      periodo_id: effectivePeriodoId,
      escopo_tipo: diretoriaScopeMode === "todas" ? "perfil" : "diretoria",
      perfil: "diretoria",
      target_ids: diretoriaScopeMode === "selecionadas" ? Array.from(selectedDiretoriaIds) : undefined,
      modulo: "todos",
      atividade: "todas",
      bloqueado: checked,
      observacao:
        diretoriaScopeMode === "todas"
          ? "Bloqueio geral de todas as diretorias"
          : `Bloqueio geral para ${selectedDiretoriaIds.size} diretoria(s) selecionada(s)`,
    });
  };

  const handleToggleDiretoriaAction = (act: typeof DIRETORIA_ACTIONS[0], checked: boolean) => {
    if (diretoriaScopeMode === "selecionadas" && selectedDiretoriaIds.size === 0) {
      toast.error("Selecione ao menos uma diretoria na lista para aplicar a restrição.");
      return;
    }

    multiScopeToggleMutation.mutate({
      periodo_id: effectivePeriodoId,
      escopo_tipo: diretoriaScopeMode === "todas" ? "perfil" : "diretoria",
      perfil: "diretoria",
      target_ids: diretoriaScopeMode === "selecionadas" ? Array.from(selectedDiretoriaIds) : undefined,
      modulo: act.modulo as any,
      atividade: act.id,
      bloqueado: checked,
      observacao:
        diretoriaScopeMode === "todas"
          ? `Bloqueio da ação ${act.label} para todas as diretorias`
          : `Bloqueio da ação ${act.label} para ${selectedDiretoriaIds.size} diretoria(s) selecionada(s)`,
    });
  };



  // Estados de seleção múltipla do modal de Nova Restrição (iniciam vazios por padrão)
  const [modalEscopoTipo, setModalEscopoTipo] = useState<"todos" | "diretoria" | "gerencia" | "diretoria_gerencia" | "perfil">("todos");
  const [modalSelectedDiretoriaIds, setModalSelectedDiretoriaIds] = useState<Set<string>>(new Set());
  const [modalSelectedGerenciaIds, setModalSelectedGerenciaIds] = useState<Set<string>>(new Set());
  const [modalSelectedModulos, setModalSelectedModulos] = useState<Set<ModuloTipo>>(new Set());
  const [modalSelectedAtividades, setModalSelectedAtividades] = useState<Set<string>>(new Set());
  const [modalSearchGerencia, setModalSearchGerencia] = useState<string>("");

  // Lista dos 5 módulos principais
  const ALL_MODULOS: { id: ModuloTipo; label: string }[] = [
    { id: "aquisicao", label: "Aquisição" },
    { id: "servicos_existentes", label: "Serviços Existentes" },
    { id: "servicos_novos", label: "Novos Serviços" },
    { id: "aprovacao", label: "Aprovação (Diretoria)" },
    { id: "compras", label: "Compras" },
  ];

  // Siglas das diretorias selecionadas no modal
  const selectedDiretoriaSiglas = useMemo(() => {
    const siglas = new Set<string>();
    diretorias.forEach((d: any) => {
      if (modalSelectedDiretoriaIds.has(d.id)) {
        siglas.add((d.sigla || "").toUpperCase().trim());
      }
    });
    return siglas;
  }, [diretorias, modalSelectedDiretoriaIds]);

  // Gerências filtradas no modal (auto-reguladas caso haja diretoria(s) selecionada(s))
  const modalGerenciasFiltradas = useMemo(() => {
    let list = apenasGerencias;

    // Se houver diretoria(s) selecionada(s) (ex: DG), auto-regular e filtrar para exibir apenas as gerências dessas diretorias (ex: GFCI, GCON, GEPE, GESL, GSAD)
    if (modalSelectedDiretoriaIds.size > 0 && (modalEscopoTipo === "diretoria_gerencia" || modalEscopoTipo === "gerencia" || modalEscopoTipo === "diretoria")) {
      list = list.filter((g: any) => {
        if (g.diretoria_id && modalSelectedDiretoriaIds.has(g.diretoria_id)) return true;
        if (g.diretoria_sigla && selectedDiretoriaSiglas.has((g.diretoria_sigla || "").toUpperCase().trim())) return true;
        const mappedSigla = diretoriasMap.get(g.diretoria_id || "");
        if (mappedSigla && selectedDiretoriaSiglas.has(mappedSigla.toUpperCase().trim())) return true;
        return false;
      });
    }

    if (modalSearchGerencia) {
      const q = modalSearchGerencia.toLowerCase().trim();
      list = list.filter(
        (g: any) =>
          (g.sigla || "").toLowerCase().includes(q) || ((g.nome || "").toLowerCase().includes(q))
      );
    }

    return list;
  }, [apenasGerencias, modalSelectedDiretoriaIds, selectedDiretoriaSiglas, modalEscopoTipo, modalSearchGerencia, diretoriasMap]);

  // Atividades disponíveis para os módulos selecionados no modal
  const modalAvailableActivities = useMemo(() => {
    const list: { id: string; label: string; moduloLabel: string; moduloId: ModuloTipo; descricao?: string }[] = [];
    const isTodosModulos = modalSelectedModulos.has("todos");

    MODULOS_CONFIG.forEach((mod) => {
      if (mod.id === "todos") return;
      if (isTodosModulos || modalSelectedModulos.has(mod.id)) {
        mod.atividades.forEach((act) => {
          if (act.id !== "todas") {
            list.push({
              id: act.id,
              label: act.label,
              moduloLabel: mod.label,
              moduloId: mod.id,
              descricao: act.descricao,
            });
          }
        });
      }
    });

    return list;
  }, [modalSelectedModulos]);

  // Gerências filtradas pela diretoria selecionada no modal de edição individual
  const gerenciasFiltradasModal = useMemo(() => {
    if (!formData.diretoria_id) return apenasGerencias;
    return apenasGerencias.filter((g: any) => g.diretoria_id === formData.diretoria_id);
  }, [apenasGerencias, formData.diretoria_id]);

  // Atividades disponíveis para o módulo selecionado na edição individual
  const atividadesDisponiveisModal = useMemo(() => {
    const modConfig = MODULOS_CONFIG.find((m) => m.id === formData.modulo);
    return modConfig ? modConfig.atividades : [];
  }, [formData.modulo]);

  // Atividades disponíveis para o filtro da tabela (garante que 'todas' não duplique)
  const atividadesDisponiveisFiltro = useMemo(() => {
    if (selectedModulo === "todos") {
      const allActs = new Map<string, string>();
      MODULOS_CONFIG.forEach((m) =>
        m.atividades.forEach((a) => {
          if (a.id !== "todas") {
            allActs.set(a.id, a.label);
          }
        })
      );
      return Array.from(allActs.entries()).map(([id, label]) => ({ id, label }));
    }
    const modConfig = MODULOS_CONFIG.find((m) => m.id === selectedModulo);
    return modConfig ? modConfig.atividades.filter((a) => a.id !== "todas") : [];
  }, [selectedModulo]);

  // Mutações
  const bulkCreateMutation = useMutation({
    mutationFn: (items: Array<Omit<RestricaoAtividade, "id" | "created_at" | "updated_at" | "periodo_nome" | "diretoria_sigla" | "gerencia_sigla">>) =>
      createRestricoesAtividadesBulk(items),
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
      toast.success(
        items.length === 1
          ? "Restrição cadastrada com sucesso!"
          : `${items.length} regras de restrição cadastradas com sucesso!`
      );
      setIsNewDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Erro ao criar restrições:", error);
      toast.error(error.message || "Falha ao criar restrições.");
    },
  });

  const createMutation = useMutation({
    mutationFn: createRestricaoAtividade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
      toast.success("Restrição cadastrada com sucesso!");
      setIsNewDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Erro ao criar restrição:", error);
      toast.error(error.message || "Falha ao criar restrição.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RestricaoAtividade> }) =>
      updateRestricaoAtividade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
      toast.success("Restrição atualizada com sucesso!");
      setIsEditDialogOpen(false);
      setEditingRule(null);
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar restrição:", error);
      toast.error(error.message || "Falha ao atualizar restrição.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      toggleRestricaoAtividade(id, ativo),
    onMutate: async ({ id, ativo }) => {
      await queryClient.cancelQueries({ queryKey: ["restricoes-atividades-admin"] });
      await queryClient.cancelQueries({ queryKey: ["restricoes-atividades"] });

      const previousAdminRules = queryClient.getQueryData<RestricaoAtividade[]>(["restricoes-atividades-admin"]) || [];

      queryClient.setQueryData<RestricaoAtividade[]>(["restricoes-atividades-admin"], (old = []) =>
        old.map((r) => (r.id === id ? { ...r, ativo } : r))
      );

      return { previousAdminRules };
    },
    onError: (error: any, _vars, context) => {
      console.error("Erro ao alterar estado da regra:", error);
      if (context?.previousAdminRules) {
        queryClient.setQueryData(["restricoes-atividades-admin"], context.previousAdminRules);
      }
      toast.error("Falha ao alterar estado da regra.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.ativo ? "Regra ativada!" : "Regra desativada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRestricaoAtividade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
      toast.success("Restrição excluída com sucesso!");
      setDeletingRuleId(null);
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        if (deletingRuleId) next.delete(deletingRuleId);
        return next;
      });
    },
    onError: (error: any) => {
      console.error("Erro ao excluir restrição:", error);
      toast.error("Falha ao excluir restrição.");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteRestricoesAtividadesBulk(ids),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["restricoes-atividades-admin"] });
      toast.success(`${variables.length} restrição(ões) excluída(s) com sucesso!`);
      setSelectedRuleIds(new Set());
      setIsBulkDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Erro ao excluir restrições em massa:", error);
      toast.error("Falha ao excluir restrições selecionadas.");
    },
  });

  const resetForm = () => {
    setFormData({
      periodo_id: activePeriod?.id || (periodos[0]?.id ?? ""),
      escopo_tipo: "todos",
      diretoria_id: "",
      gerencia_id: "",
      perfil: "todos",
      modulo: "aquisicao",
      atividade: "enviar_solicitacao",
      status: "bloqueado",
      ativo: true,
      observacao: "",
    });
  };

  const handleToggleAllModulos = (checked: boolean) => {
    if (checked) {
      setModalSelectedModulos(new Set(["todos", ...ALL_MODULOS.map((m) => m.id)]));
    } else {
      setModalSelectedModulos(new Set());
    }
  };

  const handleToggleModulo = (modId: ModuloTipo, checked: boolean) => {
    const next = new Set(modalSelectedModulos);
    if (checked) {
      next.add(modId);
      const allSelected = ALL_MODULOS.every((m) => next.has(m.id));
      if (allSelected) next.add("todos");
    } else {
      next.delete(modId);
      next.delete("todos");
      const modConfig = MODULOS_CONFIG.find((m) => m.id === modId);
      if (modConfig) {
        setModalSelectedAtividades((prev) => {
          const nextAct = new Set(prev);
          nextAct.delete("todas");
          modConfig.atividades.forEach((a) => {
            nextAct.delete(a.id);
            nextAct.delete(`${modId}:${a.id}`);
          });
          return nextAct;
        });
      }
    }
    setModalSelectedModulos(next);
  };

  const handleToggleAllAtividades = (checked: boolean) => {
    if (checked) {
      const allKeys = [
        "todas",
        ...modalAvailableActivities.map((a) => `${a.moduloId}:${a.id}`),
        ...modalAvailableActivities.map((a) => a.id),
      ];
      setModalSelectedAtividades(new Set(allKeys));
    } else {
      setModalSelectedAtividades(new Set());
    }
  };

  const handleToggleAtividade = (moduloId: ModuloTipo, actId: string, checked: boolean) => {
    const next = new Set(modalSelectedAtividades);
    const key = `${moduloId}:${actId}`;
    if (checked) {
      next.add(key);
      next.add(actId);
      const allSelected = modalAvailableActivities.every(
        (a) => next.has(`${a.moduloId}:${a.id}`) || next.has(a.id)
      );
      if (allSelected) next.add("todas");
    } else {
      next.delete(key);
      next.delete(actId);
      next.delete("todas");
    }
    setModalSelectedAtividades(next);
  };

  const handleOpenNewDialog = () => {
    resetForm();
    setModalEscopoTipo("todos");
    setModalSelectedDiretoriaIds(new Set());
    setModalSelectedGerenciaIds(new Set());
    setModalSelectedModulos(new Set());
    setModalSelectedAtividades(new Set());
    setModalSearchGerencia("");
    setIsNewDialogOpen(true);
  };

  const handleOpenEditDialog = (rule: RestricaoAtividade) => {
    setEditingRule(rule);
    setFormData({
      periodo_id: rule.periodo_id,
      escopo_tipo: rule.escopo_tipo,
      diretoria_id: rule.diretoria_id || "",
      gerencia_id: rule.gerencia_id || "",
      perfil: rule.perfil || "todos",
      modulo: rule.modulo,
      atividade: rule.atividade,
      status: rule.status,
      ativo: rule.ativo,
      observacao: rule.observacao || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveNew = () => {
    if (!formData.periodo_id) {
      toast.error("Selecione um período.");
      return;
    }

    if (modalEscopoTipo === "diretoria" && modalSelectedDiretoriaIds.size === 0) {
      toast.error("Selecione ao menos uma diretoria.");
      return;
    }

    if (modalEscopoTipo === "gerencia" && modalSelectedGerenciaIds.size === 0) {
      toast.error("Selecione ao menos uma gerência.");
      return;
    }

    if (
      modalEscopoTipo === "diretoria_gerencia" &&
      modalSelectedDiretoriaIds.size === 0 &&
      modalSelectedGerenciaIds.size === 0
    ) {
      toast.error("Selecione ao menos uma diretoria ou gerência.");
      return;
    }

    if (modalSelectedModulos.size === 0) {
      toast.error("Selecione ao menos um módulo.");
      return;
    }

    if (modalSelectedAtividades.size === 0) {
      toast.error("Selecione ao menos uma atividade.");
      return;
    }

    const rulesToCreate: Array<Omit<RestricaoAtividade, "id" | "created_at" | "updated_at" | "periodo_nome" | "diretoria_sigla" | "gerencia_sigla">> = [];

    const isAllModulos = modalSelectedModulos.has("todos");
    const isAllAtividades = modalSelectedAtividades.has("todas");

    const effectiveModulos = isAllModulos
      ? (["todos"] as ModuloTipo[])
      : Array.from(modalSelectedModulos).filter((m) => m !== "todos");

    const moduloAtividadePairs: Array<{ modulo: ModuloTipo; atividade: string }> = [];

    if (isAllModulos && isAllAtividades) {
      moduloAtividadePairs.push({ modulo: "todos", atividade: "todas" });
    } else {
      effectiveModulos.forEach((mod) => {
        if (isAllAtividades) {
          moduloAtividadePairs.push({ modulo: mod, atividade: "todas" });
        } else {
          const modActivities = modalAvailableActivities.filter((a) => a.moduloId === mod);
          modActivities.forEach((act) => {
            const key = `${act.moduloId}:${act.id}`;
            if (modalSelectedAtividades.has(key) || modalSelectedAtividades.has(act.id)) {
              moduloAtividadePairs.push({ modulo: mod, atividade: act.id });
            }
          });
        }
      });
    }

    if (moduloAtividadePairs.length === 0) {
      toast.error("Nenhuma atividade correspondente aos módulos selecionados foi selecionada.");
      return;
    }

    if (modalEscopoTipo === "todos") {
      moduloAtividadePairs.forEach(({ modulo, atividade }) => {
        rulesToCreate.push({
          periodo_id: formData.periodo_id,
          escopo_tipo: "todos",
          modulo,
          atividade,
          status: formData.status,
          ativo: formData.ativo,
          observacao: formData.observacao.trim() || null,
        });
      });
    } else if (modalEscopoTipo === "perfil") {
      moduloAtividadePairs.forEach(({ modulo, atividade }) => {
        rulesToCreate.push({
          periodo_id: formData.periodo_id,
          escopo_tipo: "perfil",
          perfil: formData.perfil,
          modulo,
          atividade,
          status: formData.status,
          ativo: formData.ativo,
          observacao: formData.observacao.trim() || null,
        });
      });
    } else {
      if (modalEscopoTipo === "diretoria" || modalEscopoTipo === "diretoria_gerencia") {
        modalSelectedDiretoriaIds.forEach((dId) => {
          moduloAtividadePairs.forEach(({ modulo, atividade }) => {
            rulesToCreate.push({
              periodo_id: formData.periodo_id,
              escopo_tipo: "diretoria",
              diretoria_id: dId,
              perfil: "diretoria",
              modulo,
              atividade,
              status: formData.status,
              ativo: formData.ativo,
              observacao: formData.observacao.trim() || null,
            });
          });
        });
      }

      if (modalEscopoTipo === "gerencia" || modalEscopoTipo === "diretoria_gerencia") {
        modalSelectedGerenciaIds.forEach((gId) => {
          const g = gerenciasMap.get(gId);
          moduloAtividadePairs.forEach(({ modulo, atividade }) => {
            rulesToCreate.push({
              periodo_id: formData.periodo_id,
              escopo_tipo: "gerencia",
              gerencia_id: gId,
              diretoria_id: g?.diretoria_id || null,
              modulo,
              atividade,
              status: formData.status,
              ativo: formData.ativo,
              observacao: formData.observacao.trim() || null,
            });
          });
        });
      }
    }

    if (rulesToCreate.length === 0) {
      toast.error("Nenhuma regra configurada para salvar.");
      return;
    }

    bulkCreateMutation.mutate(rulesToCreate);
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;
    if (!formData.periodo_id) {
      toast.error("Selecione um período.");
      return;
    }
    if (formData.escopo_tipo === "diretoria" && !formData.diretoria_id) {
      toast.error("Selecione a diretoria.");
      return;
    }
    if (formData.escopo_tipo === "gerencia" && !formData.gerencia_id) {
      toast.error("Selecione a gerência.");
      return;
    }

    updateMutation.mutate({
      id: editingRule.id,
      data: {
        periodo_id: formData.periodo_id,
        escopo_tipo: formData.escopo_tipo,
        diretoria_id:
          formData.escopo_tipo === "diretoria" || formData.escopo_tipo === "gerencia"
            ? formData.diretoria_id || null
            : null,
        gerencia_id: formData.escopo_tipo === "gerencia" ? formData.gerencia_id || null : null,
        perfil: formData.escopo_tipo === "perfil" ? formData.perfil : null,
        modulo: formData.modulo,
        atividade: formData.atividade,
        status: formData.status,
        ativo: formData.ativo,
        observacao: formData.observacao.trim() || null,
      },
    });
  };

  // Helper para rótulo legível de atividades
  const getActivityLabel = (modulo: ModuloTipo, atividade: string) => {
    const mod = MODULOS_CONFIG.find((m) => m.id === modulo);
    const act = mod?.atividades.find((a) => a.id === atividade);
    if (act) return act.label;
    if (atividade === "todas") return "Todas as atividades";
    return atividade.replace(/_/g, " ");
  };

  const getModuleLabel = (modulo: ModuloTipo) => {
    const mod = MODULOS_CONFIG.find((m) => m.id === modulo);
    return mod?.label || modulo;
  };

  // Filtragem dos dados da tabela
  const filteredRestricoes = useMemo(() => {
    return restricoes.filter((r) => {
      if (selectedPeriodo !== "todos" && r.periodo_id !== selectedPeriodo) return false;
      if (selectedDiretoria !== "todas" && r.diretoria_id !== selectedDiretoria) return false;
      if (selectedGerencia !== "todas" && r.gerencia_id !== selectedGerencia) return false;
      if (selectedModulo !== "todos" && r.modulo !== selectedModulo) return false;
      if (selectedAtividade !== "todas" && r.atividade !== selectedAtividade) return false;
      if (selectedStatus !== "todos" && r.status !== selectedStatus) return false;
      if (selectedAtivo !== "todos") {
        const isAtivo = selectedAtivo === "ativas";
        if (r.ativo !== isAtivo) return false;
      }

      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        const perNome = (r.periodo_nome || periodosMap.get(r.periodo_id) || "").toLowerCase();
        const dirSigla = (r.diretoria_sigla || diretoriasMap.get(r.diretoria_id || "") || "").toLowerCase();
        const gerSigla = (r.gerencia_sigla || gerenciasMap.get(r.gerencia_id || "")?.sigla || "").toLowerCase();
        const actLabel = getActivityLabel(r.modulo, r.atividade).toLowerCase();
        const modLabel = getModuleLabel(r.modulo).toLowerCase();
        const obs = (r.observacao || "").toLowerCase();

        return (
          perNome.includes(search) ||
          dirSigla.includes(search) ||
          gerSigla.includes(search) ||
          actLabel.includes(search) ||
          modLabel.includes(search) ||
          obs.includes(search) ||
          r.escopo_tipo.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [
    restricoes,
    selectedPeriodo,
    selectedDiretoria,
    selectedGerencia,
    selectedModulo,
    selectedAtividade,
    selectedStatus,
    selectedAtivo,
    searchTerm,
    periodosMap,
    diretoriasMap,
    gerenciasMap,
  ]);

  const { sortedItems, sortConfig, requestSort } = useSortableTable(filteredRestricoes);

  // Paginação
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const paginatedRestricoes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  // Helpers de seleção em lote
  const allCurrentPageSelected = useMemo(() => {
    if (paginatedRestricoes.length === 0) return false;
    return paginatedRestricoes.every((r) => selectedRuleIds.has(r.id));
  }, [paginatedRestricoes, selectedRuleIds]);

  const handleSelectAllCurrentPage = (checked: boolean) => {
    const newSet = new Set(selectedRuleIds);
    paginatedRestricoes.forEach((r) => {
      if (checked) newSet.add(r.id);
      else newSet.delete(r.id);
    });
    setSelectedRuleIds(newSet);
  };

  const handleToggleSelectRule = (id: string, checked: boolean) => {
    const newSet = new Set(selectedRuleIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedRuleIds(newSet);
  };

  // KPIs
  const totalRegras = restricoes.length;
  const bloqueiosAtivos = restricoes.filter((r) => r.ativo && r.status === "bloqueado").length;
  const liberacoesAtivas = restricoes.filter((r) => r.ativo && r.status === "liberado").length;
  const modulosComRestricao = useMemo(() => {
    const set = new Set(restricoes.filter((r) => r.ativo).map((r) => r.modulo));
    return set.size;
  }, [restricoes]);

  // Exportação Excel
  const handleExportExcel = () => {
    const dataToExport = filteredRestricoes.map((r) => ({
      Período: r.periodo_nome || periodosMap.get(r.periodo_id) || "N/D",
      "Tipo de Escopo":
        r.escopo_tipo === "todos"
          ? "Geral (Todos)"
          : r.escopo_tipo === "diretoria"
          ? `Diretoria (${r.diretoria_sigla || diretoriasMap.get(r.diretoria_id || "") || ""})`
          : r.escopo_tipo === "gerencia"
          ? `Gerência (${r.gerencia_sigla || gerenciasMap.get(r.gerencia_id || "")?.sigla || ""})`
          : `Perfil (${r.perfil})`,
      Módulo: getModuleLabel(r.modulo),
      Atividade: getActivityLabel(r.modulo, r.atividade),
      Status: r.status === "bloqueado" ? "Bloqueado" : "Liberado",
      "Regra Ativa": r.ativo ? "Sim" : "Não",
      Observação: r.observacao || "",
      "Criado em": r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Restrições");
    XLSX.writeFile(workbook, `Restricoes_PAC_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Relatório Excel gerado com sucesso!");
  };

  // Exportação PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("Plano Anual 2027 — Relatório de Restrições de Atividades", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 22);

    const tableData = filteredRestricoes.map((r) => [
      r.periodo_nome || periodosMap.get(r.periodo_id) || "N/D",
      r.escopo_tipo === "todos"
        ? "Todos"
        : r.escopo_tipo === "diretoria"
        ? r.diretoria_sigla || diretoriasMap.get(r.diretoria_id || "") || "Diretoria"
        : r.escopo_tipo === "gerencia"
        ? r.gerencia_sigla || gerenciasMap.get(r.gerencia_id || "")?.sigla || "Gerência"
        : `Perfil: ${r.perfil}`,
      getModuleLabel(r.modulo),
      getActivityLabel(r.modulo, r.atividade),
      r.status.toUpperCase(),
      r.ativo ? "Ativa" : "Inativa",
      r.observacao || "-",
    ]);

    autoTable(doc, {
      head: [["Período", "Escopo", "Módulo", "Atividade", "Status", "Regra", "Observação"]],
      body: tableData,
      startY: 26,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`Restricoes_PAC_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório PDF gerado com sucesso!");
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Cards de Resumo (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 card-shadow border-l-4 border-l-primary flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Regras</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalRegras}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
          </div>
        </Card>

        <Card className="p-4 card-shadow border-l-4 border-l-red-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Bloqueios Ativos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{bloqueiosAtivos}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
        </Card>

        <Card className="p-4 card-shadow border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Liberações / Exceções</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{liberacoesAtivas}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-4 card-shadow border-l-4 border-l-blue-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Módulos c/ Restrição</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{modulosComRestricao}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <Layers className="h-6 w-6 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Card Principal de Gerenciamento */}
      <Card className="p-6 card-shadow space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Restrições de Atividades</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Controle administrativo de ações liberadas ou bloqueadas por período, gerência, diretoria e módulo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchRestricoes();
                toast.success("Dados atualizados!");
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={filteredRestricoes.length === 0}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={filteredRestricoes.length === 0}
              className="gap-1.5"
            >
              <FileDown className="h-4 w-4 text-red-600" />
              PDF
            </Button>
            <Button
              size="sm"
              onClick={handleOpenNewDialog}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow"
            >
              <Plus className="h-4 w-4" />
              Nova Restrição
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CONTROLES INDEPENDENTES POR PERFIL: GERÊNCIA E DIRETORIA */}
        {/* ========================================================================= */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Controle de Restrições por Perfil
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configurações de bloqueio com ativação 100% independente entre Gerência e Diretoria.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Período Selecionado:</span>
              <Badge variant="outline" className="bg-white text-slate-800 border-slate-300 text-xs gap-1.5 font-bold shadow-xs py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {periodosMap.get(effectivePeriodoId) || activePeriod?.nome || "PAC 2027"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ----------------------------------------------------------------------- */}
            {/* CARD 1: RESTRIÇÕES DA GERÊNCIA */}
            {/* ----------------------------------------------------------------------- */}
            <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/40 via-white to-white p-5 space-y-4 shadow-xs">
              {/* Header Gerência */}
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Restrições da Gerência</h4>
                    <p className="text-xs text-slate-500">Ações operacionais das gerências</p>
                  </div>
                </div>

                {isGerenciaGeralRestrita ? (
                  <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    🔒 Restrita ({gerenciaScopeMode === "todas" ? "Geral" : `${selectedGerenciaIds.size} Gerência(s)`})
                  </Badge>
                ) : isAnyGerenciaActionRestrita ? (
                  <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1 shadow-xs">
                    🔒 Restrita (Parcial)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    🟢 Normal (Liberada)
                  </Badge>
                )}
              </div>

              {/* Seletor de Escopo: Todas vs Múltiplas Gerências */}
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-indigo-600" />
                    Aplicar Bloqueio Em:
                  </span>
                  <div className="inline-flex rounded-lg bg-indigo-100/80 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setGerenciaScopeMode("todas")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        gerenciaScopeMode === "todas"
                          ? "bg-white text-indigo-900 shadow-xs font-bold"
                          : "text-indigo-700 hover:text-indigo-900"
                      }`}
                    >
                      Todas as Gerências
                    </button>
                    <button
                      type="button"
                      onClick={() => setGerenciaScopeMode("selecionadas")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        gerenciaScopeMode === "selecionadas"
                          ? "bg-white text-indigo-900 shadow-xs font-bold"
                          : "text-indigo-700 hover:text-indigo-900"
                      }`}
                    >
                      Selecionar Gerências ({selectedGerenciaIds.size})
                    </button>
                  </div>
                </div>

                {/* Dropdown Múltiplo para Selecionar Gerências */}
                {gerenciaScopeMode === "selecionadas" && (
                  <div className="space-y-2 pt-1 border-t border-indigo-100/80 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs bg-white border-indigo-200 text-indigo-900 font-semibold gap-1.5 shadow-xs"
                          >
                            <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                            {selectedGerenciaIds.size === 0
                              ? "Clique para escolher as gerências..."
                              : `${selectedGerenciaIds.size} de ${apenasGerencias.length} gerência(s) selecionada(s)`}
                            <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3 shadow-lg" align="start">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b">
                              <span className="text-xs font-bold text-slate-800">Escolha as Gerências</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedGerenciaIds(new Set(apenasGerencias.map((g: any) => g.id)))}
                                  className="text-[11px] text-indigo-600 hover:underline font-semibold"
                                >
                                  Todas
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedGerenciaIds(new Set())}
                                  className="text-[11px] text-slate-500 hover:underline"
                                >
                                  Limpar
                                </button>
                              </div>
                            </div>
                            <div className="relative">
                              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                placeholder="Buscar por sigla ou nome..."
                                value={searchGerenciaText}
                                onChange={(e) => setSearchGerenciaText(e.target.value)}
                                className="h-7.5 pl-7 text-xs"
                              />
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                              {filteredGerenciasList.map((g: any) => {
                                const isChecked = selectedGerenciaIds.has(g.id);
                                return (
                                  <label
                                    key={g.id}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-xs transition-colors"
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        const next = new Set(selectedGerenciaIds);
                                        if (checked) next.add(g.id);
                                        else next.delete(g.id);
                                        setSelectedGerenciaIds(next);
                                      }}
                                    />
                                    <span className="font-bold text-slate-900">{g.sigla}</span>
                                    <span className="text-[11px] text-slate-500 line-clamp-1">{g.nome}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {selectedGerenciaIds.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedGerenciaIds(new Set())}
                          className="h-7 text-[11px] text-slate-500 hover:text-slate-700 px-2"
                        >
                          Limpar seleção
                        </Button>
                      )}
                    </div>

                    {/* Badges das Gerências Selecionadas */}
                    {selectedGerenciaIds.size > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-white/90 rounded-lg border border-indigo-100">
                        {Array.from(selectedGerenciaIds).map((gId) => {
                          const g = gerenciasMap.get(gId);
                          return (
                            <Badge key={gId} variant="secondary" className="bg-indigo-100/80 text-indigo-900 border-indigo-200 text-[10px] gap-1 font-semibold py-0.5">
                              {g?.sigla || gId}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = new Set(selectedGerenciaIds);
                                  next.delete(gId);
                                  setSelectedGerenciaIds(next);
                                }}
                                className="hover:text-red-600 font-bold ml-0.5"
                              >
                                ✕
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle Geral da Gerência */}
              <div className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                isGerenciaGeralRestrita
                  ? "bg-red-50/80 border-red-300 text-red-950 shadow-xs"
                  : "bg-indigo-50/50 border-indigo-100 text-slate-800"
              }`}>
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-sm block">
                    {gerenciaScopeMode === "todas"
                      ? "Restringir toda a Gerência"
                      : `Restringir as ${selectedGerenciaIds.size} Gerência(s) Selecionada(s)`}
                  </span>
                  <p className="text-xs text-slate-500">
                    {gerenciaScopeMode === "todas"
                      ? "Bloqueia todas as ações operacionais de todas as gerências no período."
                      : `Bloqueia todas as ações para as gerências selecionadas no período.`}
                  </p>
                </div>
                <Switch
                  checked={isGerenciaGeralRestrita}
                  onCheckedChange={handleToggleGerenciaGeneral}
                  disabled={gerenciaScopeMode === "selecionadas" && selectedGerenciaIds.size === 0}
                  aria-label="Restringir Gerência"
                />
              </div>

              {/* Ações Individuais da Gerência */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Ações Individuais da Gerência
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {GERENCIA_ACTIONS.map((act) => {
                    const isActionRestricted = isGerenciaActionRestrita(act.id, act.modulo as any);
                    return (
                      <div
                        key={act.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isActionRestricted
                            ? "bg-red-50/60 border-red-200 text-red-900 font-medium"
                            : "bg-white border-slate-200/80 hover:border-indigo-200 text-slate-700"
                        }`}
                      >
                        <div className="flex flex-col pr-2">
                          <span className="text-xs font-semibold leading-snug">{act.label}</span>
                          <span className="text-[10px] text-slate-400 line-clamp-1">{act.desc}</span>
                        </div>
                        <Switch
                          checked={isActionRestricted}
                          disabled={isGerenciaGeralRestrita || (gerenciaScopeMode === "selecionadas" && selectedGerenciaIds.size === 0)}
                          onCheckedChange={(checked) => handleToggleGerenciaAction(act, checked)}
                          aria-label={`Restringir ${act.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------------------------- */}
            {/* CARD 2: RESTRIÇÕES DA DIRETORIA */}
            {/* ----------------------------------------------------------------------- */}
            <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-b from-purple-50/40 via-white to-white p-5 space-y-4 shadow-xs">
              {/* Header Diretoria */}
              <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">Restrições da Diretoria</h4>
                    <p className="text-xs text-slate-500">Ações de aprovação e plano próprio</p>
                  </div>
                </div>

                {isDiretoriaGeralRestrita ? (
                  <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    🔒 Restrita ({diretoriaScopeMode === "todas" ? "Geral" : `${selectedDiretoriaIds.size} Diretoria(s)`})
                  </Badge>
                ) : isAnyDiretoriaActionRestrita ? (
                  <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1 shadow-xs">
                    🔒 Restrita (Parcial)
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    🟢 Normal (Liberada)
                  </Badge>
                )}
              </div>

              {/* Seletor de Escopo: Todas vs Múltiplas Diretorias */}
              <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-100 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-purple-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-purple-600" />
                    Aplicar Bloqueio Em:
                  </span>
                  <div className="inline-flex rounded-lg bg-purple-100/80 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDiretoriaScopeMode("todas")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        diretoriaScopeMode === "todas"
                          ? "bg-white text-purple-900 shadow-xs font-bold"
                          : "text-purple-700 hover:text-purple-900"
                      }`}
                    >
                      Todas as Diretorias
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiretoriaScopeMode("selecionadas")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        diretoriaScopeMode === "selecionadas"
                          ? "bg-white text-purple-900 shadow-xs font-bold"
                          : "text-purple-700 hover:text-purple-900"
                      }`}
                    >
                      Selecionar Diretorias ({selectedDiretoriaIds.size})
                    </button>
                  </div>
                </div>

                {/* Dropdown Múltiplo para Selecionar Diretorias */}
                {diretoriaScopeMode === "selecionadas" && (
                  <div className="space-y-2 pt-1 border-t border-purple-100/80 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs bg-white border-purple-200 text-purple-900 font-semibold gap-1.5 shadow-xs"
                          >
                            <CheckSquare className="h-3.5 w-3.5 text-purple-600" />
                            {selectedDiretoriaIds.size === 0
                              ? "Clique para escolher as diretorias..."
                              : `${selectedDiretoriaIds.size} de ${diretorias.length} diretoria(s) selecionada(s)`}
                            <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3 shadow-lg" align="start">
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b">
                              <span className="text-xs font-bold text-slate-800">Escolha as Diretorias</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDiretoriaIds(new Set(diretorias.map((d: any) => d.id)))}
                                  className="text-[11px] text-purple-600 hover:underline font-semibold"
                                >
                                  Todas
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDiretoriaIds(new Set())}
                                  className="text-[11px] text-slate-500 hover:underline"
                                >
                                  Limpar
                                </button>
                              </div>
                            </div>
                            <div className="relative">
                              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                placeholder="Buscar diretoria..."
                                value={searchDiretoriaText}
                                onChange={(e) => setSearchDiretoriaText(e.target.value)}
                                className="h-7.5 pl-7 text-xs"
                              />
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                              {filteredDiretoriasList.map((d: any) => {
                                const isChecked = selectedDiretoriaIds.has(d.id);
                                return (
                                  <label
                                    key={d.id}
                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-xs transition-colors"
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        const next = new Set(selectedDiretoriaIds);
                                        if (checked) next.add(d.id);
                                        else next.delete(d.id);
                                        setSelectedDiretoriaIds(next);
                                      }}
                                    />
                                    <span className="font-bold text-slate-900">{d.sigla}</span>
                                    <span className="text-[11px] text-slate-500 line-clamp-1">{d.nome}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {selectedDiretoriaIds.size > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDiretoriaIds(new Set())}
                          className="h-7 text-[11px] text-slate-500 hover:text-slate-700 px-2"
                        >
                          Limpar seleção
                        </Button>
                      )}
                    </div>

                    {/* Badges das Diretorias Selecionadas */}
                    {selectedDiretoriaIds.size > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 bg-white/90 rounded-lg border border-purple-100">
                        {Array.from(selectedDiretoriaIds).map((dId) => {
                          const sigla = diretoriasMap.get(dId);
                          return (
                            <Badge key={dId} variant="secondary" className="bg-purple-100/80 text-purple-900 border-purple-200 text-[10px] gap-1 font-semibold py-0.5">
                              {sigla || dId}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = new Set(selectedDiretoriaIds);
                                  next.delete(dId);
                                  setSelectedDiretoriaIds(next);
                                }}
                                className="hover:text-red-600 font-bold ml-0.5"
                              >
                                ✕
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle Geral da Diretoria */}
              <div className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                isDiretoriaGeralRestrita
                  ? "bg-red-50/80 border-red-300 text-red-950 shadow-xs"
                  : "bg-purple-50/50 border-purple-100 text-slate-800"
              }`}>
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-sm block">
                    {diretoriaScopeMode === "todas"
                      ? "Restringir toda a Diretoria"
                      : `Restringir as ${selectedDiretoriaIds.size} Diretoria(s) Selecionada(s)`}
                  </span>
                  <p className="text-xs text-slate-500">
                    {diretoriaScopeMode === "todas"
                      ? "Bloqueia todas as ações do painel da Diretoria no período."
                      : `Bloqueia todas as ações para as diretorias selecionadas no período.`}
                  </p>
                </div>
                <Switch
                  checked={isDiretoriaGeralRestrita}
                  onCheckedChange={handleToggleDiretoriaGeneral}
                  disabled={diretoriaScopeMode === "selecionadas" && selectedDiretoriaIds.size === 0}
                  aria-label="Restringir Diretoria"
                />
              </div>

              {/* Ações Individuais da Diretoria */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Ações Individuais da Diretoria
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DIRETORIA_ACTIONS.map((act) => {
                    const isActionRestricted = isDiretoriaActionRestrita(act.id, act.modulo as any);
                    return (
                      <div
                        key={act.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          isActionRestricted
                            ? "bg-red-50/60 border-red-200 text-red-900 font-medium"
                            : "bg-white border-slate-200/80 hover:border-purple-200 text-slate-700"
                        }`}
                      >
                        <div className="flex flex-col pr-2">
                          <span className="text-xs font-semibold leading-snug">{act.label}</span>
                          <span className="text-[10px] text-slate-400 line-clamp-1">{act.desc}</span>
                        </div>
                        <Switch
                          checked={isActionRestricted}
                          disabled={isDiretoriaGeralRestrita || (diretoriaScopeMode === "selecionadas" && selectedDiretoriaIds.size === 0)}
                          onCheckedChange={(checked) => handleToggleDiretoriaAction(act, checked)}
                          aria-label={`Restringir ${act.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Separador e Título da Tabela de Regras com Barra de Busca e Filtros Compacta */}
        <div className="pt-4 border-t space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Regras Granulares & Exceções Cadastradas
              </h3>
              <p className="text-xs text-muted-foreground">
                Tabela com todas as regras específicas de bloqueio/liberação salvas no sistema.
              </p>
            </div>

            {/* Barra de Busca Inteligente e Filtros Rápidos */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] sm:min-w-[300px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por gerência, diretoria, módulo, ação..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-8 h-9 bg-white text-xs rounded-lg border-slate-200 shadow-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Limpar texto de busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filtro Rápido de Status */}
              <Select
                value={selectedStatus}
                onValueChange={(v) => {
                  setSelectedStatus(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 bg-white text-xs w-[140px] border-slate-200 shadow-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="bloqueado">🔴 Bloqueados</SelectItem>
                  <SelectItem value="liberado">🟢 Liberados</SelectItem>
                </SelectContent>
              </Select>

              {/* Filtro Rápido de Estado da Regra */}
              <Select
                value={selectedAtivo}
                onValueChange={(v) => {
                  setSelectedAtivo(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 bg-white text-xs w-[140px] border-slate-200 shadow-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as regras</SelectItem>
                  <SelectItem value="ativas">⚡ Apenas Ativas</SelectItem>
                  <SelectItem value="inativas">💤 Apenas Inativas</SelectItem>
                </SelectContent>
              </Select>

              {/* Botão Limpar Filtros */}
              {(searchTerm || selectedStatus !== "todos" || selectedAtivo !== "todos" || selectedPeriodo !== "todos" || selectedDiretoria !== "todas" || selectedGerencia !== "todas" || selectedModulo !== "todos" || selectedAtividade !== "todas") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPeriodo("todos");
                    setSelectedDiretoria("todas");
                    setSelectedGerencia("todas");
                    setSelectedModulo("todos");
                    setSelectedAtividade("todas");
                    setSelectedStatus("todos");
                    setSelectedAtivo("todos");
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="h-9 text-xs gap-1.5 text-slate-600 hover:text-slate-900 border-slate-300 bg-white hover:bg-slate-50 shadow-xs animate-in fade-in"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Ações em Lote (quando houver seleção) */}
        {selectedRuleIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-red-50 border border-red-200 p-3 rounded-xl animate-in fade-in shadow-sm">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-red-900">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <span>{selectedRuleIds.size} restrição(ões) selecionada(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRuleIds(new Set())}
                className="text-xs h-8"
              >
                Desmarcar Todas
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                className="gap-1.5 text-xs h-8 font-semibold shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir Selecionadas ({selectedRuleIds.size})
              </Button>
            </div>
          </div>
        )}

        {/* Tabela de Restrições */}
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-100/80">
              <TableRow>
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    checked={allCurrentPageSelected}
                    onCheckedChange={handleSelectAllCurrentPage}
                    aria-label="Selecionar todas as regras da página"
                  />
                </TableHead>
                <TableHead className="w-[170px] font-bold">Período</TableHead>
                <TableHead className="w-[180px] font-bold">Aplicação / Escopo</TableHead>
                <TableHead className="w-[140px] font-bold">Módulo</TableHead>
                <TableHead className="font-bold">Atividade</TableHead>
                <TableHead className="w-[110px] font-bold text-center">Status</TableHead>
                <TableHead className="w-[100px] font-bold text-center">Regra Ativa</TableHead>
                <TableHead className="w-[110px] font-bold text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingRestricoes ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Carregando restrições de atividades...
                  </TableCell>
                </TableRow>
              ) : filteredRestricoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium text-slate-700">Nenhuma restrição encontrada.</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Não existem regras cadastradas para os filtros selecionados. Clique em "+ Nova Restrição" para definir uma nova regra.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenNewDialog}
                      className="mt-4 gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Cadastrar Restrição
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRestricoes.map((rule) => {
                  const perNome = rule.periodo_nome || periodosMap.get(rule.periodo_id) || "Período";
                  const isBlocked = rule.status === "bloqueado";

                  return (
                    <TableRow
                      key={rule.id}
                      className={`transition-colors hover:bg-slate-50/80 ${
                        !rule.ativo ? "opacity-60 bg-slate-50/40" : ""
                      } ${selectedRuleIds.has(rule.id) ? "bg-red-50/40" : ""}`}
                    >
                      {/* Checkbox de Seleção */}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedRuleIds.has(rule.id)}
                          onCheckedChange={(checked) => handleToggleSelectRule(rule.id, !!checked)}
                          aria-label={`Selecionar regra ${rule.id}`}
                        />
                      </TableCell>

                      {/* Período */}
                      <TableCell className="font-medium text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 line-clamp-1">{perNome}</span>
                          {rule.periodo_id === activePeriod?.id && (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Período Ativo
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Escopo */}
                      <TableCell>
                        {rule.escopo_tipo === "todos" && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-bold">
                            🌐 Todos os Setores
                          </Badge>
                        )}
                        {rule.escopo_tipo === "diretoria" && (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                              Diretoria {rule.diretoria_sigla || diretoriasMap.get(rule.diretoria_id || "") || ""}
                            </Badge>
                          </div>
                        )}
                        {rule.escopo_tipo === "gerencia" && (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-bold w-fit">
                              Gerência {rule.gerencia_sigla || gerenciasMap.get(rule.gerencia_id || "")?.sigla || ""}
                            </Badge>
                            {rule.diretoria_sigla && (
                              <span className="text-[10px] text-muted-foreground">
                                ({rule.diretoria_sigla})
                              </span>
                            )}
                          </div>
                        )}
                        {rule.escopo_tipo === "perfil" && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold capitalize">
                            Perfil: {rule.perfil}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Módulo */}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${
                            rule.modulo === "aquisicao"
                              ? "bg-blue-100 text-blue-800"
                              : rule.modulo === "servicos_existentes"
                              ? "bg-amber-100 text-amber-800"
                              : rule.modulo === "servicos_novos"
                              ? "bg-teal-100 text-teal-800"
                              : rule.modulo === "compras"
                              ? "bg-emerald-100 text-emerald-800"
                              : rule.modulo === "aprovacao"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {getModuleLabel(rule.modulo)}
                        </Badge>
                      </TableCell>

                      {/* Atividade */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-slate-800">
                            {getActivityLabel(rule.modulo, rule.atividade)}
                          </span>
                          {rule.observacao && (
                            <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 italic">
                              Motivo: {rule.observacao}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {isBlocked ? (
                          <Badge className="bg-red-600 text-white font-bold text-xs gap-1 hover:bg-red-700 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            Bloqueado
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1 hover:bg-emerald-700 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            Liberado
                          </Badge>
                        )}
                      </TableCell>

                      {/* Toggle Regra Ativa */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={rule.ativo}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({ id: rule.id, ativo: checked })
                            }
                            aria-label="Ativar ou desativar regra"
                          />
                        </div>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:text-primary"
                                onClick={() => handleOpenEditDialog(rule)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar restrição</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeletingRuleId(rule.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir restrição</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {paginatedRestricoes.length} de {filteredRestricoes.length} regras
            </p>
            <SmartPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Modal de Criação de Restrição */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Nova Restrição de Atividade
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setModalSelectedDiretoriaIds(new Set());
                  setModalSelectedGerenciaIds(new Set());
                  setModalSelectedModulos(new Set());
                  setModalSelectedAtividades(new Set());
                  setModalSearchGerencia("");
                }}
                className="text-xs h-7 gap-1 text-slate-500 hover:text-slate-900 mr-6"
                title="Limpar todas as seleções"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar Seleções
              </Button>
            </div>
            <DialogDescription>
              Defina as regras de bloqueio ou liberação de atividades operacionais para o período selecionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Período */}
            <div>
              <Label className="text-xs font-semibold">Período do PAC *</Label>
              <Select
                value={formData.periodo_id}
                onValueChange={(v) => setFormData({ ...formData, periodo_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.ativo ? "(Ativo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Escopo da Restrição */}
            <div>
              <Label className="text-xs font-semibold">Aplicação da Regra (Escopo) *</Label>
              <Select
                value={modalEscopoTipo}
                onValueChange={(v: any) => {
                  setModalEscopoTipo(v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">🌐 Bloqueio / Liberação Geral (Todos os Setores)</SelectItem>
                  <SelectItem value="diretoria">🏢 Por Diretoria</SelectItem>
                  <SelectItem value="gerencia">👥 Por Gerência Específica</SelectItem>
                  <SelectItem value="diretoria_gerencia">🏢👥 Diretorias & Gerências</SelectItem>
                  <SelectItem value="perfil">🛡️ Por Perfil / Papel (Gerência / Diretoria / Compras)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* IMAGEM 1 & IMAGEM 3: SELEÇÃO DE DIRETORIAS */}
            {/* ------------------------------------------------------------------ */}
            {(modalEscopoTipo === "diretoria" || modalEscopoTipo === "diretoria_gerencia") && (
              <div className="space-y-2 p-3.5 rounded-xl border border-purple-200 bg-purple-50/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-purple-600" />
                    Diretoria *
                  </Label>
                  <Badge variant="secondary" className="text-[11px] bg-purple-100 text-purple-900 border-purple-200">
                    {modalSelectedDiretoriaIds.size} de {diretorias.length} selecionada(s)
                  </Badge>
                </div>

                {/* Caixa de Seleção para Todos */}
                <div
                  onClick={() => {
                    const allSelected = diretorias.length > 0 && modalSelectedDiretoriaIds.size === diretorias.length;
                    if (allSelected) {
                      setModalSelectedDiretoriaIds(new Set());
                    } else {
                      setModalSelectedDiretoriaIds(new Set(diretorias.map((d: any) => d.id)));
                    }
                  }}
                  className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-purple-200/80 hover:bg-purple-50/50 cursor-pointer transition-colors select-none"
                >
                  <Checkbox
                    checked={diretorias.length > 0 && modalSelectedDiretoriaIds.size === diretorias.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setModalSelectedDiretoriaIds(new Set(diretorias.map((d: any) => d.id)));
                      } else {
                        setModalSelectedDiretoriaIds(new Set());
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Selecionar Todas as Diretorias
                  </span>
                </div>

                {/* Caixas de Seleção Únicas para Cada Diretoria */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {diretorias.map((d: any) => {
                    const isChecked = modalSelectedDiretoriaIds.has(d.id);
                    return (
                      <div
                        key={d.id}
                        onClick={() => {
                          const next = new Set(modalSelectedDiretoriaIds);
                          if (isChecked) next.delete(d.id);
                          else next.add(d.id);
                          setModalSelectedDiretoriaIds(next);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all select-none ${
                          isChecked
                            ? "bg-purple-100/60 border-purple-300 text-purple-950 font-medium"
                            : "bg-white border-slate-200 hover:border-purple-200 text-slate-700"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const next = new Set(modalSelectedDiretoriaIds);
                            if (checked) next.add(d.id);
                            else next.delete(d.id);
                            setModalSelectedDiretoriaIds(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Badge variant="outline" className="font-bold text-[10px] bg-white">
                          {d.sigla}
                        </Badge>
                        <span className="line-clamp-1 flex-1">{d.nome}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* IMAGEM 2 & IMAGEM 3 & IMAGEM 5: SELEÇÃO DE GERÊNCIAS */}
            {/* ------------------------------------------------------------------ */}
            {(modalEscopoTipo === "gerencia" || modalEscopoTipo === "diretoria_gerencia") && (
              <div className="space-y-2 p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-indigo-600" />
                    Gerência * (Apenas Gerências)
                  </Label>
                  <Badge variant="secondary" className="text-[11px] bg-indigo-100 text-indigo-900 border-indigo-200">
                    {modalSelectedGerenciaIds.size} de {modalGerenciasFiltradas.length} selecionada(s)
                    {modalSelectedDiretoriaIds.size > 0 && modalEscopoTipo === "diretoria_gerencia" && (
                      <span className="ml-1 opacity-80">(auto-regulada por {modalSelectedDiretoriaIds.size} diretoria(s))</span>
                    )}
                  </Badge>
                </div>

                {/* Busca apenas de gerências */}
                <div className="pt-0.5">
                  <Input
                    placeholder="Buscar gerência por sigla ou nome..."
                    value={modalSearchGerencia}
                    onChange={(e) => setModalSearchGerencia(e.target.value)}
                    className="h-8 text-xs bg-white w-full"
                  />
                </div>

                {/* Caixa de Seleção para Todas as Gerências */}
                <div
                  onClick={() => {
                    const allSelected =
                      modalGerenciasFiltradas.length > 0 &&
                      modalGerenciasFiltradas.every((g: any) => modalSelectedGerenciaIds.has(g.id));
                    const next = new Set(modalSelectedGerenciaIds);
                    if (allSelected) {
                      modalGerenciasFiltradas.forEach((g: any) => next.delete(g.id));
                    } else {
                      modalGerenciasFiltradas.forEach((g: any) => next.add(g.id));
                    }
                    setModalSelectedGerenciaIds(next);
                  }}
                  className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-indigo-200/80 hover:bg-indigo-50/50 cursor-pointer transition-colors select-none"
                >
                  <Checkbox
                    checked={
                      modalGerenciasFiltradas.length > 0 &&
                      modalGerenciasFiltradas.every((g: any) => modalSelectedGerenciaIds.has(g.id))
                    }
                    onCheckedChange={(checked) => {
                      const next = new Set(modalSelectedGerenciaIds);
                      if (checked) {
                        modalGerenciasFiltradas.forEach((g: any) => next.add(g.id));
                      } else {
                        modalGerenciasFiltradas.forEach((g: any) => next.delete(g.id));
                      }
                      setModalSelectedGerenciaIds(next);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Selecionar Todas as Gerências ({modalGerenciasFiltradas.length})
                  </span>
                </div>

                {/* Caixas de Seleção Únicas para Cada Gerência */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 border rounded-lg bg-white">
                  {modalGerenciasFiltradas.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      {modalSelectedDiretoriaIds.size > 0
                        ? "Nenhuma gerência encontrada para as diretorias selecionadas."
                        : "Nenhuma gerência encontrada."}
                    </p>
                  ) : (
                    modalGerenciasFiltradas.map((g: any) => {
                      const isChecked = modalSelectedGerenciaIds.has(g.id);
                      const dirSigla = diretoriasMap.get(g.diretoria_id || "") || g.diretoria_sigla || "";
                      return (
                        <div
                          key={g.id}
                          onClick={() => {
                            const next = new Set(modalSelectedGerenciaIds);
                            if (isChecked) next.delete(g.id);
                            else next.add(g.id);
                            setModalSelectedGerenciaIds(next);
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all select-none ${
                            isChecked
                              ? "bg-indigo-50 border-indigo-300 text-indigo-950 font-medium"
                              : "bg-white border-slate-200 hover:border-indigo-200 text-slate-700"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const next = new Set(modalSelectedGerenciaIds);
                              if (checked) next.add(g.id);
                              else next.delete(g.id);
                              setModalSelectedGerenciaIds(next);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Badge variant="secondary" className="font-bold text-[10px]">
                            {g.sigla}
                          </Badge>
                          <span className="line-clamp-1 flex-1">{g.nome || g.sigla}</span>
                          {dirSigla && (
                            <Badge variant="outline" className="text-[10px] text-slate-500 font-mono ml-auto bg-slate-50">
                              {dirSigla}
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Perfil (se escopo for perfil) */}
            {modalEscopoTipo === "perfil" && (
              <div>
                <Label className="text-xs font-semibold">Perfil *</Label>
                <Select
                  value={formData.perfil}
                  onValueChange={(v: PerfilTipo) => setFormData({ ...formData, perfil: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerencia">Gerência</SelectItem>
                    <SelectItem value="diretoria">Diretoria</SelectItem>
                    <SelectItem value="compras">Compras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* IMAGEM 4: SELEÇÃO DE MÓDULOS */}
            {/* ------------------------------------------------------------------ */}
            <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Módulo(s) *
                </Label>
                <Badge variant="outline" className="text-[11px] bg-white">
                  {modalSelectedModulos.has("todos")
                    ? "Todos os Módulos"
                    : `${modalSelectedModulos.size} de ${ALL_MODULOS.length} selecionado(s)`}
                </Badge>
              </div>

              {/* Caixa de Seleção Todos os Módulos */}
              <div
                onClick={() => handleToggleAllModulos(!modalSelectedModulos.has("todos"))}
                className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors select-none"
              >
                <Checkbox
                  checked={modalSelectedModulos.has("todos")}
                  onCheckedChange={handleToggleAllModulos}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs font-bold text-slate-800">
                  Todos os Módulos
                </span>
              </div>

              {/* Caixas de Seleção Únicas para Cada Módulo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {ALL_MODULOS.map((m) => {
                  const isChecked = modalSelectedModulos.has(m.id) || modalSelectedModulos.has("todos");
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleToggleModulo(m.id, !isChecked)}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all select-none ${
                        isChecked
                          ? "bg-blue-50/70 border-blue-300 text-blue-950 font-medium"
                          : "bg-white border-slate-200 hover:border-blue-200 text-slate-700"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleToggleModulo(m.id, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="font-semibold">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* IMAGEM 5: SELEÇÃO DE ATIVIDADES / AÇÕES */}
            {/* ------------------------------------------------------------------ */}
            <div className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Atividade(s) / Ação(ões) *
                </Label>
                <Badge variant="outline" className="text-[11px] bg-white">
                  {modalSelectedAtividades.has("todas")
                    ? "Todas as Atividades"
                    : modalAvailableActivities.length === 0
                    ? "0 selecionada(s)"
                    : `${Array.from(modalSelectedAtividades).filter((k) => k !== "todas").length} de ${modalAvailableActivities.length} selecionada(s)`}
                </Badge>
              </div>

              {/* Caixa de Seleção Todas as Atividades */}
              <div
                onClick={() => handleToggleAllAtividades(!modalSelectedAtividades.has("todas"))}
                className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors select-none"
              >
                <Checkbox
                  checked={modalSelectedAtividades.has("todas")}
                  onCheckedChange={handleToggleAllAtividades}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs font-bold text-slate-800">
                  Todas as Atividades {modalSelectedModulos.has("todos") ? "(Todos os Módulos)" : "(Módulos Selecionados)"}
                </span>
              </div>

              {/* Caixas de Seleção Únicas para Cada Atividade */}
              <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 border rounded-lg bg-white">
                {modalAvailableActivities.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Selecione ao menos um módulo para ver as atividades disponíveis.</p>
                ) : (
                  modalAvailableActivities.map((act) => {
                    const key = `${act.moduloId}:${act.id}`;
                    const isChecked =
                      modalSelectedAtividades.has("todas") ||
                      modalSelectedAtividades.has(key) ||
                      modalSelectedAtividades.has(act.id);
                    return (
                      <div
                        key={key}
                        onClick={() => handleToggleAtividade(act.moduloId, act.id, !isChecked)}
                        className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all select-none ${
                          isChecked
                            ? "bg-slate-50 border-slate-400 text-slate-950 font-medium"
                            : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => handleToggleAtividade(act.moduloId, act.id, !isChecked)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{act.label}</span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-slate-500">
                              {act.moduloLabel}
                            </Badge>
                          </div>
                          {act.descricao && (
                            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                              {act.descricao}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Status (Bloqueado / Liberado) */}
            <div>
              <Label className="text-xs font-semibold">Status da Atividade *</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div
                  onClick={() => setFormData({ ...formData, status: "bloqueado" })}
                  className={`p-3 rounded-lg border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    formData.status === "bloqueado"
                      ? "border-red-500 bg-red-50/60 text-red-900 font-bold"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs font-bold">🔴 Bloqueado</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Impede a execução da ação</p>
                  </div>
                </div>

                <div
                  onClick={() => setFormData({ ...formData, status: "liberado" })}
                  className={`p-3 rounded-lg border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    formData.status === "liberado"
                      ? "border-emerald-500 bg-emerald-50/60 text-emerald-900 font-bold"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold">🟢 Liberado</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Permite a execução da ação</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Observação */}
            <div>
              <Label className="text-xs font-semibold">Observação / Justificativa (Opcional)</Label>
              <Textarea
                placeholder="Ex: Envio temporariamente bloqueado para alinhamento orçamentário anual."
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                className="mt-1 text-xs"
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Esta mensagem será apresentada aos usuários caso tentem executar a atividade bloqueada.
              </p>
            </div>

            {/* Switch de Ativação */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
              <div>
                <Label className="text-xs font-semibold text-slate-800">Regra Ativa Imediatamente</Label>
                <p className="text-[10px] text-muted-foreground">
                  Se desativada, a regra ficará salva mas não causará impacto operacional até ser ativada.
                </p>
              </div>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewDialogOpen(false)}
              disabled={bulkCreateMutation.isPending || createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveNew}
              disabled={bulkCreateMutation.isPending || createMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {bulkCreateMutation.isPending || createMutation.isPending ? "Salvando..." : "Salvar Restrição(ões)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Restrição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Restrição
            </DialogTitle>
            <DialogDescription>
              Altere as configurações, escopo ou status desta regra de restrição.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Período */}
            <div>
              <Label className="text-xs font-semibold">Período do PAC *</Label>
              <Select
                value={formData.periodo_id}
                onValueChange={(v) => setFormData({ ...formData, periodo_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.ativo ? "(Ativo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Escopo da Restrição */}
            <div>
              <Label className="text-xs font-semibold">Aplicação da Regra (Escopo) *</Label>
              <Select
                value={formData.escopo_tipo}
                onValueChange={(v: EscopoTipo) =>
                  setFormData({
                    ...formData,
                    escopo_tipo: v,
                    diretoria_id: "",
                    gerencia_id: "",
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">🌐 Bloqueio / Liberação Geral (Todos os Setores)</SelectItem>
                  <SelectItem value="diretoria">🏢 Por Diretoria</SelectItem>
                  <SelectItem value="gerencia">👥 Por Gerência Específica</SelectItem>
                  <SelectItem value="perfil">🛡️ Por Perfil / Papel (Gerência / Diretoria / Compras)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Diretoria */}
            {(formData.escopo_tipo === "diretoria" || formData.escopo_tipo === "gerencia") && (
              <div>
                <Label className="text-xs font-semibold">Diretoria *</Label>
                <Select
                  value={formData.diretoria_id}
                  onValueChange={(v) =>
                    setFormData({ ...formData, diretoria_id: v, gerencia_id: "" })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a diretoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {diretorias.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.sigla} - {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Gerência */}
            {formData.escopo_tipo === "gerencia" && (
              <div>
                <Label className="text-xs font-semibold">Gerência *</Label>
                <Select
                  value={formData.gerencia_id}
                  onValueChange={(v) => setFormData({ ...formData, gerencia_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a gerência" />
                  </SelectTrigger>
                  <SelectContent>
                    {gerenciasFiltradasModal.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.sigla} {g.nome ? `- ${g.nome}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Perfil */}
            {formData.escopo_tipo === "perfil" && (
              <div>
                <Label className="text-xs font-semibold">Perfil *</Label>
                <Select
                  value={formData.perfil}
                  onValueChange={(v: PerfilTipo) => setFormData({ ...formData, perfil: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerencia">Gerência</SelectItem>
                    <SelectItem value="diretoria">Diretoria</SelectItem>
                    <SelectItem value="compras">Compras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Módulo e Atividade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Módulo *</Label>
                <Select
                  value={formData.modulo}
                  onValueChange={(v: ModuloTipo) => {
                    const modConfig = MODULOS_CONFIG.find((m) => m.id === v);
                    const firstAct = modConfig?.atividades[0]?.id || "todas";
                    setFormData({ ...formData, modulo: v, atividade: firstAct });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULOS_CONFIG.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Atividade / Ação *</Label>
                <Select
                  value={formData.atividade}
                  onValueChange={(v) => setFormData({ ...formData, atividade: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {atividadesDisponiveisModal.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status (Bloqueado / Liberado) */}
            <div>
              <Label className="text-xs font-semibold">Status da Atividade *</Label>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div
                  onClick={() => setFormData({ ...formData, status: "bloqueado" })}
                  className={`p-3 rounded-lg border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    formData.status === "bloqueado"
                      ? "border-red-500 bg-red-50/60 text-red-900 font-bold"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs font-bold">🔴 Bloqueado</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Impede a execução da ação</p>
                  </div>
                </div>

                <div
                  onClick={() => setFormData({ ...formData, status: "liberado" })}
                  className={`p-3 rounded-lg border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    formData.status === "liberado"
                      ? "border-emerald-500 bg-emerald-50/60 text-emerald-900 font-bold"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold">🟢 Liberado</p>
                    <p className="text-[10px] text-muted-foreground font-normal">Permite a execução da ação</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Observação */}
            <div>
              <Label className="text-xs font-semibold">Observação / Justificativa (Opcional)</Label>
              <Textarea
                placeholder="Ex: Envio temporariamente bloqueado para alinhamento orçamentário anual."
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                className="mt-1 text-xs"
                rows={2}
              />
            </div>

            {/* Switch de Ativação */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50">
              <div>
                <Label className="text-xs font-semibold text-slate-800">Regra Ativa</Label>
                <p className="text-[10px] text-muted-foreground">
                  Alterne para ativar ou desativar esta restrição no sistema.
                </p>
              </div>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão Individual */}
      <Dialog open={!!deletingRuleId} onOpenChange={(open) => !open && setDeletingRuleId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Excluir Restrição
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta regra de restrição? A atividade voltará ao comportamento padrão liberado para o setor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingRuleId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingRuleId && deleteMutation.mutate(deletingRuleId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão em Massa */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Excluir {selectedRuleIds.size} Restrições
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir as {selectedRuleIds.size} regras selecionadas? Todas as atividades afetadas voltarão ao comportamento padrão liberado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={bulkDeleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedRuleIds))}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
