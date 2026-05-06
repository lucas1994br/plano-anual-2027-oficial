import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Eye, CheckCircle, Home, Plus, FileDown, FileSpreadsheet, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import DOMPurify from 'dompurify';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PlanHeader } from "@/components/layout/PlanHeader";
import { SummaryCards } from "@/components/common/SummaryCards";
import { PlanFilters } from "@/components/forms/PlanFilters";
import { PlanTable } from "@/components/tables/PlanTable";
import { BudgetConsumptionCard } from "@/components/features/orcamento/BudgetConsumptionCard";
import { AdminBudgetConfig } from "@/lib/adminBudgetConfig";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AccessCodeScreen } from "@/components/ui/AccessCodeScreen";
import { PlanItem, SolicitacaoStatus, ServicoItem, GrauPrioridade, Diretoria, Gerencia } from "@/types/plan";
import {
  getAdminMiniErpConfigDb,
  getDiretorias,
  getCategoryBudgetOwnerRules,
  getGerenciasByDiretoria,
  getPeriodosAtivos,
  getSolicitacoesByGerencia,
  deleteSolicitacao,
  updateSolicitacao,
  updateSolicitacaoStatus,
  getServicosByGerencia,
  updateServico,
  createServico,
  deleteServico,
} from "@/lib/services";
import { getBudgetOwnerDiretoriaId, getGerenciaBudget, loadAdminBudgetConfig } from "@/lib/adminBudgetConfig";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resolveGerenciaNome } from "@/data/gerencias";

// Mapeamento de ícones por sigla
const getIconPath = (sigla: string): string | null => {
  const iconMap: Record<string, string> = {
    'DC': '/assets/images/dc2.png',
    'DE': '/assets/images/de2.png',
    'DG': '/assets/images/gd2.png',
  };
  return iconMap[sigla] || null;
};

const GerenciaPanel = () => {

  console.log("TELA DE SERVIÇOS RENDERIZOU");

  const { sigla, gerencia: gerenciaParam } = useParams<{ sigla: string; gerencia: string }>();
  const navigate = useNavigate();
  const siglaUpper = (sigla || "").toUpperCase();
  const gerenciaUpper = (gerenciaParam || "").toUpperCase();

  const [authenticated, setAuthenticated] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prioridade, setPrioridade] = useState("todas");
  const [showOnlyZerados, setShowOnlyZerados] = useState(false);
  const [showOnlyComQuantidade, setShowOnlyComQuantidade] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedServicos, setSelectedServicos] = useState<Set<string>>(new Set());
  const [confirmSendServicosOpen, setConfirmSendServicosOpen] = useState(false);
  const [novoServicoOpen, setNovoServicoOpen] = useState(false);
  const [novoServicoForm, setNovoServicoForm] = useState({
    objeto: "",
    justificativa: "",
    tipoContratacao: "Novo",
    unidadeDemandante: "",
    previsaoInicio: "",
    estimativaValor: "",
    dotacaoOrcamentaria: "",
    grauPrioridade: "Médio" as GrauPrioridade,
    vinculacao: "Não" as "Sim" | "Não",
    dependenciaDescricao: "",
  });
  const [novoServicoLoading, setNovoServicoLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Buscar diretorias
  const { data: diretorias = [] } = useQuery({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
    staleTime: 5 * 60 * 1000,
  });

  const diretoria = diretorias.find((d: Diretoria) => d.sigla === siglaUpper);
  const diretoriaMap = useMemo(() => {
    const map: Record<string, Diretoria> = {};
    diretorias.forEach((dir: Diretoria) => {
      map[dir.id] = dir;
    });
    return map;
  }, [diretorias]);

  // Buscar gerências
  const { data: gerenciasData = [] } = useQuery({
    queryKey: ["gerencias", diretoria?.id],
    queryFn: () => diretoria ? getGerenciasByDiretoria(diretoria.id) : [],
    enabled: !!diretoria,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar períodos ativos
  const { data: periodos = [] } = useQuery({
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

  const gerenciaAtual = gerenciasData.find((g: Gerencia) => g.sigla === gerenciaUpper);
  const gerenciaNome = resolveGerenciaNome(gerenciaUpper, gerenciaAtual?.nome);

  // Buscar solicitações para esta gerência — pré-carrega sem aguardar seleção de aba
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["solicitacoes", gerenciaAtual?.id, periodAtivo?.id],
    queryFn: () => (gerenciaAtual && periodAtivo) ? getSolicitacoesByGerencia(gerenciaAtual.id, periodAtivo.id) : [],
    enabled: !!periodAtivo && !!gerenciaAtual,
    staleTime: 2 * 60 * 1000,
  });

  // Buscar serviços para esta gerência
  const { data: servicosData = [] } = useQuery({
    queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id],
    queryFn: () =>
      (gerenciaAtual && periodAtivo)
        ? getServicosByGerencia(gerenciaAtual.id, periodAtivo.id)
        : [],
    enabled: !!periodAtivo && !!gerenciaAtual,
    staleTime: 0,
    refetchOnMount: true,
  });

  console.log("SERVICOS DATA:", servicosData);

  const orcamentoConfig = useMemo(() => {
    const localConfig = loadAdminBudgetConfig();
    const dbConfig = adminMiniConfigFromDb as Partial<AdminBudgetConfig>;

    if (!localConfig && !dbConfig) return null;

    return {
      ...(localConfig || {}),
      ...(dbConfig || {}),
      routingRules: dbConfig?.routingRules || localConfig?.routingRules || {},
      categoryBudgetOwners: localConfig?.categoryBudgetOwners || {},
    };
  }, [adminMiniConfigFromDb]);

  // Converter solicitações para o formato de PlanItem
  const items: PlanItem[] = useMemo(() => {
    return solicitacoes.map((s: ServicoItem) => {
      const categoriaItem = (typeof s.categoria === "string" && s.categoria.trim().length > 0)
        ? s.categoria
        : "diversos";
      const diretoriaOrcamentariaId = diretoria
        ? getBudgetOwnerDiretoriaId(orcamentoConfig, categoriaItem, diretoria.id, categoryBudgetOwnersFromDb)
        : s.diretoria_id;
      const diretoriaOrcamentaria = diretoriaMap[diretoriaOrcamentariaId];

      return {
        id: s.id,
        codigo: s.codigo,
        descricao: s.descricao,
        categoria: categoriaItem,
        gerencia: gerenciaUpper,
        prioridade: s.prioridade || "Média",
        qtdEstimada: s.qtd_estimada || 0,
        unidade: s.unidade || "un",
        valorUnitario: s.valor_unitario || 0,
        observacao: s.observacao || "",
        status: (s.status as SolicitacaoStatus) || "rascunho",
        justificativaRejeicao: s.justificativa_rejeicao || "",
        diretoriaSigla: diretoria?.sigla,
        diretoriaOrcamentariaId,
        diretoriaOrcamentariaSigla: diretoriaOrcamentaria?.sigla || diretoria?.sigla,
        isOrcamentoCompartilhado: !!diretoria && diretoriaOrcamentariaId !== diretoria.id,
      };
    });
  }, [solicitacoes, gerenciaUpper, diretoria, diretoriaMap, orcamentoConfig, categoryBudgetOwnersFromDb]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = searchTerm === "" || item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || item.codigo.toString().includes(searchTerm);
      const matchesCategoria = !categoria || categoria === "" || item.categoria === categoria;
      const matchesPrioridade = prioridade === "todas" || item.prioridade === prioridade;
      const matchesZerado = !showOnlyZerados || item.qtdEstimada === 0;
      const matchesComQuantidade = !showOnlyComQuantidade || item.qtdEstimada > 0;
      return matchesSearch && matchesCategoria && matchesPrioridade && matchesZerado && matchesComQuantidade;
    });
  }, [items, searchTerm, categoria, prioridade, showOnlyZerados, showOnlyComQuantidade]);

  const categoriasDisponiveis = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.categoria))).filter(Boolean);
    return unique.sort();
  }, [items]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [categoria, searchTerm, prioridade, showOnlyZerados, showOnlyComQuantidade]);

  // Calcular paginação
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = filteredItems.slice(startIdx, endIdx);
    return { totalPages, currentPage, paginatedItems };
  }, [filteredItems, currentPage]);

  const orcamentoGerenciaAquisicao = gerenciaAtual?.id
    ? getGerenciaBudget(orcamentoConfig as AdminBudgetConfig | null, gerenciaAtual.id, "aquisicao")
    : 0;
  const orcamentoGerenciaServicos = gerenciaAtual?.id
    ? getGerenciaBudget(orcamentoConfig as AdminBudgetConfig | null, gerenciaAtual.id, "servicos")
    : 0;
  const gastoAquisicaoGerencia = useMemo(
    () =>
      items
        .filter((item) => item.diretoriaOrcamentariaId === diretoria?.id)
        .reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
    [items, diretoria?.id],
  );
  const summary = useMemo(
    () => ({
      totalItens: items.length,
      valorTotal: gastoAquisicaoGerencia,
    }),
    [items.length, gastoAquisicaoGerencia],
  );
    const resumoOrcamentoPorDiretoria = useMemo(() => {
      const grupos = new Map<string, { sigla: string; total: number; itens: number }>();

      items
        .filter((item) => item.qtdEstimada > 0)
        .forEach((item) => {
          const siglaDestino = item.diretoriaOrcamentariaSigla || diretoria?.sigla || "N/D";
          const atual = grupos.get(siglaDestino) || { sigla: siglaDestino, total: 0, itens: 0 };
          atual.total += item.qtdEstimada * item.valorUnitario;
          atual.itens += 1;
          grupos.set(siglaDestino, atual);
        });

      return Array.from(grupos.values()).sort((a, b) => a.sigla.localeCompare(b.sigla));
    }, [items, diretoria?.sigla]);

    const resumoEnvioPorDiretoria = useMemo(() => {
      const grupos = new Map<string, { sigla: string; total: number; itens: number }>();

      items
        .filter((item) => item.qtdEstimada > 0 && item.status === "rascunho")
        .forEach((item) => {
          const siglaDestino = item.diretoriaOrcamentariaSigla || diretoria?.sigla || "N/D";
          const atual = grupos.get(siglaDestino) || { sigla: siglaDestino, total: 0, itens: 0 };
          atual.total += item.qtdEstimada * item.valorUnitario;
          atual.itens += 1;
          grupos.set(siglaDestino, atual);
        });

      return Array.from(grupos.values()).sort((a, b) => a.sigla.localeCompare(b.sigla));
    }, [items, diretoria?.sigla]);

  const gastoServicosGerencia = useMemo(
    () =>
      servicosData.reduce(
        (acc: number, servico: ServicoItem) =>
          acc + (servico.dotacaoOrcamentaria || servico.estimativaValor || 0),
        0,
      ),
    [servicosData],
  );

  const canSend = items.some((item) => item.qtdEstimada > 0 && item.status === "rascunho"); // Permite enviar se tiver pelo menos 1 item com quantidade em rascunho
  const isReadOnly = items.some((item) => item.status === "enviado" || item.status === "em_analise" || item.status === "aprovado");
  const hasApprovedItems = items.some((item) => item.status === "aprovado");
  const hasRascunhoItems = items.some((item) => item.status === "rascunho");
  const solicitacoesQueryKey = useMemo(() => ["solicitacoes", gerenciaAtual?.id, periodAtivo?.id] as const, [gerenciaAtual?.id, periodAtivo?.id]);

  const patchSolicitacaoInCache = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      queryClient.setQueryData(solicitacoesQueryKey, (current: ServicoItem[] | undefined) => {
        if (!Array.isArray(current)) return current;
        return current.map((row: ServicoItem) => (row?.id === id ? { ...row, ...patch } : row));
      });
    },
    [queryClient, solicitacoesQueryKey],
  );

  const handleUpdateQtdEstimada = async (codigo: number, qtdEstimada: number) => {
    const item = items.find((i) => i.codigo === codigo);
    // Permite edicao apenas se o item estiver em rascunho
    if (!item?.id || item.status !== "rascunho") return;

    patchSolicitacaoInCache(item.id, { qtd_estimada: qtdEstimada });
    try {
      await updateSolicitacao(item.id, { qtdEstimada });
    } finally {
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    }
  };

  const handleUpdateUnidade = async (codigo: number, unidade: string) => {
    const item = items.find((i) => i.codigo === codigo);
    if (!item?.id || item.status !== "rascunho") return;

    patchSolicitacaoInCache(item.id, { unidade });
    try {
      await updateSolicitacao(item.id, { unidade });
    } finally {
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    }
  };

  const handleUpdateObservacao = async (codigo: number, observacao: string) => {
    const item = items.find((i) => i.codigo === codigo);
    if (!item?.id || item.status !== "rascunho") return;

    patchSolicitacaoInCache(item.id, { observacao });
    try {
      await updateSolicitacao(item.id, { observacao });
    } finally {
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    }
  };

  const handleUpdatePrioridade = async (codigo: number, prioridade: PlanItem["prioridade"]) => {
    const item = items.find((i) => i.codigo === codigo);
    if (!item?.id || item.status !== "rascunho") return;

    patchSolicitacaoInCache(item.id, { prioridade });
    try {
      await updateSolicitacao(item.id, { prioridade });
    } finally {
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Excluir este item permanentemente?")) return;

    try {
      await deleteSolicitacao(itemId);
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
      toast({ title: "Item excluído", description: "O item foi removido com sucesso." });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível excluir o item.", variant: "destructive" });
    }
  };

  const handleSendToDiretoria = async () => {
    if (!gerenciaAtual || !periodAtivo) return;

    try {
      const idsParaEnviar = items
        .filter((item) => item.qtdEstimada > 0 && item.status === "rascunho")
        .map((item) => item.id)
        .filter(Boolean) as string[];

      if (idsParaEnviar.length === 0) {
        setConfirmSendOpen(false);
        return;
      }

      // Atualizar cache imediatamente para feedback instantâneo
      idsParaEnviar.forEach((id) => {
        patchSolicitacaoInCache(id, { status: "enviado" });
      });

      // Executar updates em paralelo sem aguardar refetch
      const updates = idsParaEnviar.map((id) => updateSolicitacaoStatus(id, "enviado"));
      await Promise.all(updates);
      
      // Invalidar query apenas uma vez após todos os updates
      await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
      
      setConfirmSendOpen(false);
    } catch (error) {
      console.error("Erro ao enviar para diretoria:", error);
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
    }
  };

  const handleUpdateGrauPrioridade = async (item: number, grauPrioridade: GrauPrioridade) => {
    try {
      const servico = servicosData.find((s: ServicoItem) => s.item === item);
      if (servico) {
        await updateServico(servico.id, { grau_prioridade: grauPrioridade });
        queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      }
    } catch (error) {
      console.error("Erro ao atualizar grau de prioridade:", error);
    }
  };

  const handleUpdateJustificativa = async (item: number, justificativa: string) => {
    try {
      const servico = servicosData.find((s: ServicoItem) => s.item === item);
      if (servico && servico.status === "rascunho") {
        const justificativaLimpa = justificativa.trim();
        if (!justificativaLimpa) return;

        await updateServico(servico.id, { justificativa: justificativaLimpa });
        queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      }
    } catch (error) {
      console.error("Erro ao atualizar justificativa:", error);
    }
  };

  const handleUpdateDotacao = async (item: number, dotacaoOrcamentaria: number) => {
    try {
      const servico = servicosData.find((s: ServicoItem) => s.item === item);
      if (servico && servico.status === "rascunho") {
        await updateServico(servico.id, { dotacao_orcamentaria: dotacaoOrcamentaria });
        queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      }
    } catch (error) {
      console.error("Erro ao atualizar dotação orçamentária:", error);
    }
  };

  const handleUpdateVinculacao = async (item: number, vinculacao: string) => {
    try {
      const servico = servicosData.find((s: ServicoItem) => s.item === item);
      if (servico && servico.status === "rascunho") {
        await updateServico(servico.id, { vinculacao });
        queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      }
    } catch (error) {
      console.error("Erro ao atualizar vinculação:", error);
    }
  };

  const handleUpdateObservacaoServico = async (item: number, observacao: string) => {
    try {
      const servico = servicosData.find((s: ServicoItem) => s.item === item);
      if (servico) {
        await updateServico(servico.id, { observacao });
        queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      }
    } catch (error) {
      console.error("Erro ao atualizar observação:", error);
    }
  };

  const handleDeleteServico = async (servicoId: string) => {
    try {
      await deleteServico(servicoId);
      await queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi removido com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast({
        title: "Não foi possível excluir o serviço",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectServico = (servicoId: string) => {
    const newSelected = new Set(selectedServicos);
    if (newSelected.has(servicoId)) {
      newSelected.delete(servicoId);
    } else {
      newSelected.add(servicoId);
    }
    setSelectedServicos(newSelected);
  };

  const toggleSelectAllServicos = (todos: ServicoItem[]) => {
    if (selectedServicos.size === todos.length) {
      setSelectedServicos(new Set());
    } else {
      setSelectedServicos(new Set(todos.map(s => s.id).filter(Boolean) as string[]));
    }
  };

  const handleCriarServico = async () => {
    if (!gerenciaAtual || !diretoria || !periodAtivo) return;
    if (!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim()) return;

    setNovoServicoLoading(true);
    try {
      const proximoItem = servicosData.length > 0
        ? Math.max(...servicosData.map((s: ServicoItem) => s.item || 0)) + 1
        : 1;

      await createServico({
        periodo_id: periodAtivo.id,
        diretoria_id: diretoria.id,
        gerencia_id: gerenciaAtual.id,
        item: proximoItem,
        tipo_contratacao: novoServicoForm.tipoContratacao || "Serviço",
        unidade_demandante: novoServicoForm.unidadeDemandante || gerenciaUpper,
        objeto: novoServicoForm.objeto.trim(),
        justificativa: novoServicoForm.justificativa.trim() || null,
        previsao_inicio: novoServicoForm.previsaoInicio || null,
        estimativa_valor: novoServicoForm.estimativaValor ? parseFloat(novoServicoForm.estimativaValor) : 0,
        dotacao_orcamentaria: novoServicoForm.dotacaoOrcamentaria ? parseFloat(novoServicoForm.dotacaoOrcamentaria) : 0,
        grau_prioridade: novoServicoForm.grauPrioridade,
        vinculacao: novoServicoForm.vinculacao,
        dependencia_descricao: novoServicoForm.vinculacao === "Sim" ? novoServicoForm.dependenciaDescricao.trim() || null : null,
        status: "rascunho",
      });

      await queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual.id, periodAtivo.id] });
      setNovoServicoOpen(false);
      setNovoServicoForm({
        objeto: "",
        justificativa: "",
        tipoContratacao: "Novo",
        unidadeDemandante: "",
        previsaoInicio: "",
        estimativaValor: "",
        dotacaoOrcamentaria: "",
        grauPrioridade: "Médio",
        vinculacao: "Não",
        dependenciaDescricao: "",
      });
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
    } finally {
      setNovoServicoLoading(false);
    }
  };

  const handleSendServicosToDir = async () => {
    if (!gerenciaAtual || !periodAtivo) return;
    
    try {
      const servicosParaEnviar = servicosData
        .filter((s: ServicoItem) => selectedServicos.has(s.id) && s.status === "rascunho");

      if (servicosParaEnviar.length === 0) {
        setConfirmSendServicosOpen(false);
        return;
      }

      const updates = servicosParaEnviar.map((s: ServicoItem) => 
        updateServico(s.id, { status: "enviado" })
      );
      
      await Promise.all(updates);

      await queryClient.invalidateQueries({
        queryKey: ["servicos"]
      });

      await queryClient.refetchQueries({
        queryKey: ["servicos"]
      });

      await queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual.id, periodAtivo.id] });

      
      setSelectedServicos(new Set());
      setConfirmSendServicosOpen(false);
    } catch (error) {
      console.error("Erro ao enviar serviços para diretoria:", error);
      queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
    }
  };

  if (!diretoria) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Diretoria não encontrada</h1>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AccessCodeScreen
        title={gerenciaUpper}
        subtitle={`${gerenciaNome} • ${diretoria.sigla} - ${diretoria.nome}`}
        gradientClass="from-blue-600 to-blue-800"
        icon=""
        onAccessGranted={() => setAuthenticated(true)}
        onBack={() => navigate(`/diretoria/${sigla}`)}
        scope="gerencia"
      />
    );
  }

  // Tela de seleção: Aquisição ou Serviços
  if (!selectedOption) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ top: "200px" }}
        >
          <img
            src="/assets/images/caema-logo.png"
            alt="CAEMA"
            className="w-full max-w-3xl opacity-[0.08]"
          />
        </div>
        <div className="relative z-10">
          {/* Top Bar */}
          <div className="px-6 py-3 bg-card border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(`/diretoria/${sigla}`)}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <Home className="h-4 w-4" />
                Página inicial
              </Button>
              <Badge variant="outline" className="text-xs">{gerenciaUpper}</Badge>
            </div>
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {getIconPath(siglaUpper) && (
                  <img src={getIconPath(siglaUpper)!} alt={siglaUpper} className="h-12 w-12 object-contain" />
                )}
                <Badge className="bg-white/20 text-white border-none text-xl font-bold">{gerenciaUpper}</Badge>
              </div>
              <p className="text-white/90 text-sm mb-2">{gerenciaNome}</p>
              <p className="text-white/80 text-lg">Selecione o tipo de solicitação</p>
            </div>
          </div>

          {/* Opções: Aquisição e Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cartão Aquisição */}
                <button
                  onClick={() => setSelectedOption("aquisicao")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <span className="text-4xl">📦</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Aquisição</h2>
                  <p className="text-muted-foreground">
                    Gerenciar solicitações de aquisição de materiais e equipamentos
                  </p>
                </button>

                {/* Cartão Serviços */}
                <button
                  onClick={() => setSelectedOption("servicos")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <span className="text-4xl">🛠️</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Serviços</h2>
                  <p className="text-muted-foreground">
                    Gerenciar solicitações de serviços e manutenções
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se escolheu "Serviços", mostrar tabela de serviços com seleção
  if (selectedOption === "servicos") {
    type ServicoRow = {
      id?: string;
      item: number;
      tipo_contratacao: string;
      unidade_demandante: string;
      objeto: string;
      justificativa?: string;
      previsao_inicio?: string;
      estimativa_valor?: number;
      dotacao_orcamentaria?: number;
      grau_prioridade: GrauPrioridade;
      vinculacao: "Sim" | "Não";
      dependencia_descricao?: string;
      status?: SolicitacaoStatus;
      observacao?: string;
    };

    const servicos: ServicoItem[] = servicosData.map((s: ServicoRow) => ({
      id: s.id,
      item: s.item,
      tipoContratacao: s.tipo_contratacao,
      unidadeDemandante: s.unidade_demandante,
      objeto: s.objeto,
      justificativa: s.justificativa,
      previsaoInicio: s.previsao_inicio,
      estimativaValor: s.estimativa_valor,
      dotacaoOrcamentaria: s.dotacao_orcamentaria,
      grauPrioridade: s.grau_prioridade,
      vinculacao: s.vinculacao,
      dependenciaDescricao: s.dependencia_descricao,
      gerencia: gerenciaUpper,
      diretoriaSigla: siglaUpper,
      status: s.status,
      observacao: s.observacao,
    }));

    const isServicoReadOnly = (s: ServicoItem) => s.status !== "rascunho";
    const servicosExistentes = servicos.filter((s) => s.tipoContratacao !== "Novo");
    const servicosNovos = servicos.filter((s) => s.tipoContratacao === "Novo");
    const canSendServicos = servicos.some((s) => !isServicoReadOnly(s));
    const servicosEditaveis = servicos.filter((s) => !isServicoReadOnly(s));
    const isAllSent = servicos.length > 0 && servicos.every((s) => isServicoReadOnly(s));

    const formatCurrency = (value?: number) =>
      value != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
        : "—";

    type XlsxModule = {
      default?: unknown;
      utils: {
        book_new: () => unknown;
        aoa_to_sheet: (data: unknown[][]) => unknown;
        book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
      };
      writeFile: (wb: unknown, filename: string) => void;
    };

    const handleExportExcel = async () => {
      const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js") as XlsxModule;
      const XLSX = ((xlsxModule.default ?? xlsxModule) as XlsxModule);
      const wb = XLSX.utils.book_new();
      const wsData: unknown[][] = [];
      wsData.push([`Plano Anual de Contratações 2027 — Serviços — ${gerenciaUpper}`]);
      wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
      wsData.push([]);
      wsData.push(["Item", "Tipo", "Unidade Demandante", "Objeto", "Justificativa", "Previsão Início", "Estimativa Valor", "Dotação Orçamentária", "Grau Prioridade", "Vinculação", "Status"]);
      servicos.forEach((s) => {
        wsData.push([s.item, s.tipoContratacao, s.unidadeDemandante, s.objeto, s.justificativa || "", s.previsaoInicio || "", s.estimativaValor || 0, s.dotacaoOrcamentaria || 0, s.grauPrioridade, s.vinculacao, s.status || "rascunho"]);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      (ws as Record<string, unknown>)["!cols"] = [{ wch: 6 }, { wch: 15 }, { wch: 20 }, { wch: 45 }, { wch: 40 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, "Serviços");
      XLSX.writeFile(wb, `PAC_2027_Servicos_${gerenciaUpper}_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const handleExportPDF = () => {
      const doc = new jsPDF({ orientation: "landscape", format: "a4" });
      doc.setFontSize(14);
      doc.text(`PAC 2027 — Serviços — ${gerenciaUpper}`, 14, 18);
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
      autoTable(doc, {
        head: [["Item", "Tipo", "Objeto", "Estimativa", "Dotação", "Prioridade", "Status"]],
        body: servicos.map((s) => [
          s.item,
          s.tipoContratacao,
          s.objeto.length > 50 ? s.objeto.substring(0, 50) + "…" : s.objeto,
          formatCurrency(s.estimativaValor),
          formatCurrency(s.dotacaoOrcamentaria),
          s.grauPrioridade,
          s.status || "rascunho",
        ]),
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 250, 246] },
      });
      doc.save(`PAC_2027_Servicos_${gerenciaUpper}_${new Date().toISOString().split("T")[0]}.pdf`);
    };

    const ServicosSection = ({ lista, titulo, badge }: { lista: ServicoItem[]; titulo: string; badge?: React.ReactNode }) => (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {badge}
          <span className="text-xs text-muted-foreground">({lista.length} serviço{lista.length !== 1 ? "s" : ""})</span>
        </div>
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {!isAllSent && (
                    <th className="p-3 text-left w-10">
                      <Checkbox
                        checked={lista.filter(s => !isServicoReadOnly(s)).length > 0 && lista.filter(s => !isServicoReadOnly(s)).every(s => s.id && selectedServicos.has(s.id!))}
                        onCheckedChange={() => {
                          const editaveis = lista.filter(s => !isServicoReadOnly(s) && s.id);
                          const allSelected = editaveis.every(s => selectedServicos.has(s.id!));
                          const next = new Set(selectedServicos);
                          editaveis.forEach(s => allSelected ? next.delete(s.id!) : next.add(s.id!));
                          setSelectedServicos(next);
                        }}
                      />
                    </th>
                  )}
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground w-12">Nº</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Objeto</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Justificativa</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground w-36">Prioridade</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground w-32">Dotação (R$)</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground w-28">Vinculação</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground w-24">Status</th>
                  {!isAllSent && (
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground w-24">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr>
                    <td colSpan={isAllSent ? 7 : 9} className="text-center py-6 text-muted-foreground text-sm">
                      Nenhum serviço nesta seção.
                    </td>
                  </tr>
                ) : (
                  lista.map((servico, index) => {
                    const readOnly = isServicoReadOnly(servico);
                    return (
                      <tr
                        key={servico.id || index}
                        className={`border-b ${readOnly ? "opacity-80" : "hover:bg-muted/20"} ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                      >
                        {!isAllSent && (
                          <td className="p-3">
                            {!readOnly && (
                              <Checkbox
                                checked={servico.id ? selectedServicos.has(servico.id) : false}
                                onCheckedChange={() => servico.id && toggleSelectServico(servico.id)}
                              />
                            )}
                          </td>
                        )}
                        <td className="p-3 text-sm font-mono text-muted-foreground">{servico.item}</td>
                        <td className="p-3 text-sm max-w-xs">
                          <p className="font-medium line-clamp-2">{servico.objeto}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{servico.tipoContratacao} · {servico.unidadeDemandante}</p>
                        </td>
                        <td className="p-3 text-sm">
                          {readOnly ? (
                            <p className="text-xs text-muted-foreground line-clamp-3">{servico.justificativa || "—"}</p>
                          ) : (
                            <textarea
                              defaultValue={servico.justificativa || ""}
                              onBlur={(e) => {
                                const justificativaLimpa = e.target.value.trim();
                                if (!justificativaLimpa) {
                                  e.target.value = servico.justificativa || "";
                                  return;
                                }
                                handleUpdateJustificativa(servico.item, justificativaLimpa);
                              }}
                              className="w-full text-xs border rounded px-2 py-1 min-h-16 bg-background"
                              placeholder="Justificativa..."
                            />
                          )}
                        </td>
                        <td className="p-3">
                          {readOnly ? (
                            <Badge variant={getPrioridadeBadgeVariant(servico.grauPrioridade)}>{servico.grauPrioridade}</Badge>
                          ) : (
                            <Select
                              value={servico.grauPrioridade}
                              onValueChange={(value) => handleUpdateGrauPrioridade(servico.item, value as GrauPrioridade)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue>
                                  <Badge variant={getPrioridadeBadgeVariant(servico.grauPrioridade)}>{servico.grauPrioridade}</Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {(["Muito Baixo", "Baixo", "Médio", "Alto", "Muito Alto"] as GrauPrioridade[]).map((p) => (
                                  <SelectItem key={p} value={p}>
                                    <Badge variant={getPrioridadeBadgeVariant(p)}>{p}</Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {readOnly ? (
                            <span className="text-sm">{formatCurrency(servico.dotacaoOrcamentaria)}</span>
                          ) : (
                            <input
                              type="number"
                              defaultValue={servico.dotacaoOrcamentaria || 0}
                              onBlur={(e) => handleUpdateDotacao(servico.item, parseFloat(e.target.value) || 0)}
                              className="w-28 text-sm border rounded px-2 py-1 text-right bg-background"
                              step="0.01"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          {readOnly ? (
                            <div className="space-y-1">
                              <span className="text-sm">{servico.vinculacao}</span>
                              {servico.dependenciaDescricao && (
                                <p className="text-xs text-muted-foreground">{servico.dependenciaDescricao}</p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <select
                                value={servico.vinculacao}
                                onChange={(e) => handleUpdateVinculacao(servico.item, e.target.value)}
                                className="w-full text-sm border rounded px-2 py-1 bg-background"
                              >
                                <option value="Não">Não</option>
                                <option value="Sim">Sim</option>
                              </select>
                              {servico.dependenciaDescricao && (
                                <p className="text-xs text-muted-foreground">{servico.dependenciaDescricao}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={
                            servico.status === "enviado" ? "secondary" :
                            servico.status === "aprovado" ? "success" :
                            servico.status === "rejeitado" ? "destructive" :
                            "outline"
                          } className="text-xs whitespace-nowrap">
                            {servico.status === "rascunho" ? "Rascunho" :
                             servico.status === "enviado" ? "Enviado" :
                             servico.status === "aprovado" ? "Aprovado" :
                             servico.status === "rejeitado" ? "Rejeitado" :
                             servico.status || "—"}
                          </Badge>
                        </td>
                        {!isAllSent && (
                          <td className="p-3 text-right">
                            {!readOnly && servico.id ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteServico(servico.id!)}
                                title="Excluir serviço"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0" style={{ top: "200px" }}>
          <img src="/assets/images/caema-logo.png" alt="CAEMA" className="w-full max-w-3xl opacity-[0.08]" />
        </div>
        <div className="relative z-10">
          {/* Top Bar */}
          <div className="px-6 py-3 bg-card border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption(null)}>
                <ArrowLeft className="h-4 w-4" />Voltar
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <Home className="h-4 w-4" />Página inicial
              </Button>
              <Badge variant="outline" className="text-xs">{gerenciaUpper}</Badge>
              <Badge variant="outline" className="text-xs bg-green-50">Serviços</Badge>
            </div>
            <div className="flex items-center gap-2">
              {isAllSent && (
                <Badge className="bg-info text-info-foreground text-sm gap-1 py-2 px-4">
                  <Eye className="h-4 w-4" /> Somente leitura
                </Badge>
              )}
              {canSendServicos && (
                <Button
                  className="gap-2"
                  onClick={() => setConfirmSendServicosOpen(true)}
                  disabled={selectedServicos.size === 0}
                >
                  <Send className="h-4 w-4" />
                  Enviar para Diretoria ({selectedServicos.size})
                </Button>
              )}
            </div>
          </div>

          <PlanHeader
            title="Painel da Gerência - Serviços"
            diretoria={`${diretoria.sigla} / ${gerenciaUpper} - ${gerenciaNome}`}
            ano={2027}
            prazo={prazo}
          />

          <BudgetConsumptionCard
            titulo={`Orçamento da Gerência ${gerenciaUpper} (serviços)`}
            orcamento={orcamentoGerenciaServicos}
            gasto={gastoServicosGerencia}
          />

          {/* Ações gerais + exportação */}
          <div className="px-6 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isAllSent && servicosEditaveis.length > 0 && (
                <>
                  <Checkbox
                    checked={servicosEditaveis.length > 0 && servicosEditaveis.every(s => s.id && selectedServicos.has(s.id!))}
                    onCheckedChange={() => toggleSelectAllServicos(servicosEditaveis)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedServicos.size > 0 ? `${selectedServicos.size} selecionado(s)` : "Selecionar todos"}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" />Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4" />PDF
              </Button>
            </div>
          </div>

          {/* Tabelas */}
          <div className="px-6 py-6">
            {servicosExistentes.length > 0 && (
              <ServicosSection
                lista={servicosExistentes}
                titulo="Serviços Existentes"
                badge={<Badge variant="secondary" className="text-xs">Contratos vigentes / renovações</Badge>}
              />
            )}
            {servicosNovos.length > 0 && (
              <ServicosSection
                lista={servicosNovos}
                titulo="Novas Contratações"
                badge={<Badge variant="outline" className="text-xs bg-green-50 text-green-700">Novos serviços adicionados</Badge>}
              />
            )}
            {servicos.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg font-medium mb-2">Nenhum serviço cadastrado</p>
                <p className="text-sm">Clique em "Novo Serviço" abaixo para adicionar o primeiro.</p>
              </div>
            )}

            {/* Botão Novo Serviço — na parte de baixo */}
            {!isAllSent && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className="gap-2 border-dashed border-green-400 text-green-700 hover:bg-green-50"
                  onClick={() => setNovoServicoOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Novo Serviço
                </Button>
              </div>
            )}
          </div>

          {/* Dialog Novo Serviço */}
          <Dialog open={novoServicoOpen} onOpenChange={setNovoServicoOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Serviço</DialogTitle>
                <DialogDescription>
                  Preencha os dados do serviço a ser contratado em 2027.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Objeto <span className="text-destructive">*</span></label>
                  <textarea
                    value={novoServicoForm.objeto}
                    onChange={(e) => setNovoServicoForm(f => ({ ...f, objeto: e.target.value }))}
                    className="w-full mt-1 text-sm border rounded px-3 py-2 min-h-20 bg-background"
                    placeholder="Descreva o objeto do serviço a ser contratado..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Justificativa <span className="text-destructive">*</span></label>
                  <textarea
                    value={novoServicoForm.justificativa}
                    onChange={(e) => setNovoServicoForm(f => ({ ...f, justificativa: e.target.value }))}
                    className="w-full mt-1 text-sm border rounded px-3 py-2 min-h-20 bg-background"
                    placeholder="Fundamentação técnica e administrativa..."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Tipo de Contratação</label>
                    <select
                      value={novoServicoForm.tipoContratacao}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, tipoContratacao: e.target.value }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                    >
                      <option value="Novo">Novo</option>
                      <option value="Contínuo">Contínuo</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Unidade Demandante</label>
                    <input
                      type="text"
                      value={novoServicoForm.unidadeDemandante}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, unidadeDemandante: e.target.value }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      placeholder={gerenciaUpper}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Previsão de Início da Nova Contratação</label>
                  <input
                    type="date"
                    value={novoServicoForm.previsaoInicio}
                    onChange={(e) => setNovoServicoForm(f => ({ ...f, previsaoInicio: e.target.value }))}
                    className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Estimativa de Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoServicoForm.estimativaValor}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, estimativaValor: e.target.value }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Grau de Prioridade</label>
                  <Select
                    value={novoServicoForm.grauPrioridade}
                    onValueChange={(v) => setNovoServicoForm(f => ({ ...f, grauPrioridade: v as GrauPrioridade }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Muito Baixo">Muito Baixo</SelectItem>
                      <SelectItem value="Baixo">Baixo</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Alto">Alto</SelectItem>
                      <SelectItem value="Muito Alto">Muito Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Obs</label>
                  <Select
                    value={novoServicoForm.vinculacao}
                    onValueChange={(v) => setNovoServicoForm(f => ({ ...f, vinculacao: v as "Sim" | "Não" }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Não">Não</SelectItem>
                      <SelectItem value="Sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                  {novoServicoForm.vinculacao === "Sim" && (
                    <textarea
                      value={novoServicoForm.dependenciaDescricao}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, dependenciaDescricao: e.target.value }))}
                      className="w-full mt-2 text-sm border rounded px-3 py-2 min-h-16 bg-background"
                      placeholder="Descreva a vinculação ou dependência..."
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setNovoServicoOpen(false)} disabled={novoServicoLoading}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCriarServico}
                  disabled={!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim() || novoServicoLoading}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {novoServicoLoading ? "Salvando..." : "Adicionar Serviço"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog Confirmação Envio Serviços */}
          <Dialog open={confirmSendServicosOpen} onOpenChange={setConfirmSendServicosOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar envio de Serviços</DialogTitle>
                <DialogDescription>
                  Ao enviar, os serviços serão bloqueados para edição até que a diretoria
                  analise e aprove ou rejeite. Deseja continuar?
                </DialogDescription>
              </DialogHeader>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p><strong>{selectedServicos.size}</strong> serviço(s) serão enviado(s) para a <strong>{diretoria.sigla}</strong></p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirmSendServicosOpen(false)}>Cancelar</Button>
                <Button onClick={handleSendServicosToDir} className="gap-2">
                  <Send className="h-4 w-4" />
                  Confirmar Envio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{ top: "200px" }}
      >
        <img
          src="/assets/images/caema-logo.png"
          alt="CAEMA"
          className="w-full max-w-3xl opacity-[0.08]"
        />
      </div>
      <div className="relative z-10">
      <div className="px-6 py-3 bg-card border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption(null)}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}><Home className="h-4 w-4" />Página inicial</Button>
            <Badge variant="outline" className="text-xs">{gerenciaUpper}</Badge>
            <Badge variant="outline" className="text-xs bg-blue-50">Aquisição</Badge>
          </div>
          <div className="flex items-center gap-2">
            {hasRascunhoItems && !hasApprovedItems && (
              <Button
                className="gap-2"
                disabled={!canSend}
                onClick={() => setConfirmSendOpen(true)}
              >
                <Send className="h-4 w-4" />
                Enviar para Diretoria
              </Button>
            )}
            {hasApprovedItems && (
              <Badge className="bg-success text-success-foreground text-sm gap-1 py-2 px-4">
                <CheckCircle className="h-4 w-4" /> Aprovado pela Diretoria
              </Badge>
            )}
            {isReadOnly && !hasApprovedItems && (
              <Badge className="bg-info text-info-foreground text-sm gap-1">
                <Eye className="h-3 w-3" /> Somente leitura
              </Badge>
            )}
          </div>
        </div>
      </div>

      <PlanHeader
        title="Painel da Gerência"
        diretoria={`${diretoria.sigla} / ${gerenciaUpper} - ${gerenciaNome}`}
        ano={2027}
        prazo={prazo}
      />

      <SummaryCards totalItens={summary.totalItens} valorTotal={summary.valorTotal} />

      <BudgetConsumptionCard
        titulo={`Orçamento da Gerência ${gerenciaUpper} (aquisição)`}
        orcamento={orcamentoGerenciaAquisicao}
        gasto={gastoAquisicaoGerencia}
      />

      {resumoOrcamentoPorDiretoria.length > 0 && (
        <div className="px-6 pb-2">
          <Card className="p-4 card-shadow border-l-4 border-l-blue-500">
            <h3 className="font-semibold text-foreground mb-3">Diretoria orçamentária dos itens selecionados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {resumoOrcamentoPorDiretoria.map((grupo) => (
                <div key={grupo.sigla} className="rounded border p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={grupo.sigla === diretoria?.sigla ? "default" : "secondary"}>{grupo.sigla}</Badge>
                    <span className="text-xs text-muted-foreground">{grupo.itens} item(ns)</span>
                  </div>
                  <p className="font-bold text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(grupo.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {grupo.sigla === diretoria?.sigla
                      ? "Sai do orçamento da própria diretoria"
                      : `Será enviado para aprovação da diretoria ${grupo.sigla}`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="px-6 pb-2 flex flex-wrap gap-2">
        <Button
          variant={showOnlyZerados ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => {
            const next = !showOnlyZerados;
            setShowOnlyZerados(next);
            if (next) setShowOnlyComQuantidade(false);
          }}
        >
          {showOnlyZerados ? "Mostrando apenas itens zerados" : "Filtrar itens zerados"}
        </Button>
        <Button
          variant={showOnlyComQuantidade ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => {
            const next = !showOnlyComQuantidade;
            setShowOnlyComQuantidade(next);
            if (next) setShowOnlyZerados(false);
          }}
        >
          {showOnlyComQuantidade ? "Mostrando apenas itens com quantidade" : "Filtrar itens com quantidade"}
        </Button>
      </div>

      <PlanFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoria={categoria}
        onCategoriaChange={setCategoria}
        prioridade={prioridade}
        onPrioridadeChange={setPrioridade}
        categorias={categoriasDisponiveis}
      />
      { filteredItems.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground">
          Nenhum item encontrado na categoria selecionada.
        </div>
      ) : (
        <>
          <PlanTable
            items={paginationData.paginatedItems}
            onUpdateQtdEstimada={handleUpdateQtdEstimada}
            onUpdateUnidade={handleUpdateUnidade}
            onUpdateObservacao={handleUpdateObservacao}
            onUpdatePrioridade={handleUpdatePrioridade}
            onDeleteItem={handleDeleteItem}
          />
          
          {paginationData.totalPages > 1 && (
            <div className="px-6 py-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {currentPage > 1 && (
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className="cursor-pointer"
                      >
                        {currentPage - 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationLink isActive>
                      {currentPage}
                    </PaginationLink>
                  </PaginationItem>

                  {currentPage < paginationData.totalPages && (
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="cursor-pointer"
                      >
                        {currentPage + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  {currentPage < paginationData.totalPages - 1 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {currentPage < paginationData.totalPages - 1 && (
                    <PaginationItem>
                      <PaginationLink
                        onClick={() => setCurrentPage(paginationData.totalPages)}
                        className="cursor-pointer"
                      >
                        {paginationData.totalPages}
                      </PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(paginationData.totalPages, currentPage + 1))}
                      className={currentPage === paginationData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <div className="flex justify-center mt-2 text-sm text-muted-foreground">
                Página {currentPage} de {paginationData.totalPages} • Total: {filteredItems.length} itens
              </div>
            </div>
          )}
        </>
      )}


      {/* Confirm Send Dialog */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
            <DialogDescription>
              Ao enviar, os itens serão bloqueados para edição até que a diretoria
              analise e aprove ou rejeite. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p><strong>{items.filter(i => i.qtdEstimada > 0 && i.status === "rascunho").length}</strong> itens serão enviados para análise orçamentária.</p>
            <div className="mt-3 space-y-2">
              {resumoEnvioPorDiretoria.map((grupo) => (
                <div key={grupo.sigla} className="flex items-center justify-between rounded border bg-background px-3 py-2">
                  <span>
                    <strong>{grupo.sigla}</strong> receberá {grupo.itens} item(ns)
                  </span>
                  <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(grupo.total)}</strong>
                </div>
              ))}
            </div>
            {items.filter(i => i.qtdEstimada === 0 || i.status !== "rascunho").length > 0 && (
              <p className="text-muted-foreground mt-2 text-xs">
                ({items.filter(i => i.qtdEstimada === 0 || i.status !== "rascunho").length} itens não serão enviados)
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendToDiretoria} className="gap-2">
              <Send className="h-4 w-4" />
              Confirmar Envio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default GerenciaPanel;

