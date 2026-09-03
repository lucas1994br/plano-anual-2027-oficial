import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Eye, CheckCircle, Home, Plus, FileDown, FileSpreadsheet, Trash2, Pencil, Undo2, Lock, RotateCcw, Loader2 } from "lucide-react";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { PlanHeader } from "@/components/layout/PlanHeader";
import { SummaryCards } from "@/components/common/SummaryCards";
import { BulkEditAquisicaoDialog, BulkEditServicosDialog } from "@/components/common/BulkActionDialogs";
import { ServicoEditDialog, AquisicaoEditDialog } from "@/components/common/ItemEditDialogs";
import { PlanFilters } from "@/components/forms/PlanFilters";
import { formatContratoMask } from "@/lib/utils";
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
import { SmartPagination } from "@/components/common/SmartPagination";
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
  deleteSolicitacoesBulk,
  updateSolicitacao,
  updateSolicitacaoStatus,
  updateSolicitacaoStatusBulk,
    updateSolicitacoesBulkData,
    getServicosByGerencia,
    updateServico,
    createServico,
    deleteServico,
    deleteServicosBulk,
    updateServicosBulkData,
    getServicosCatalogo,
    createSolicitacao
  } from "@/lib/services";
  import { getBudgetOwnerDiretoriaId, getGerenciaBudget, getDiretoriaBudget, loadAdminBudgetConfig } from "@/lib/adminBudgetConfig";
  import { getPrioridadeBadgeVariant } from "@/lib/prioridade";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import { useToast } from "@/hooks/use-toast";
  import { supabase } from "@/lib/supabaseClient";
  import { useSortableTable } from "@/hooks/useSortableTable";
  import { SortableTableHead } from "@/components/ui/sortable-table-head";
  import { useGerenciaData } from "@/hooks/useGerenciaData";
  import { useMaterialDescriptions } from "@/hooks/useMaterialDescriptions";
  import { useActivityRestrictions } from "@/hooks/useActivityRestrictions";
  
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
    const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | "servicos_novos" | "servicos_existentes" | null>(null);
    const [confirmSendOpen, setConfirmSendOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoria, setCategoria] = useState("");
    const [prioridade, setPrioridade] = useState("todas");
    const [showOnlyZerados, setShowOnlyZerados] = useState(false);
    const [showOnlySent, setShowOnlySent] = useState(false);
    const [showOnlyComQuantidade, setShowOnlyComQuantidade] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedServicos, setSelectedServicos] = useState<Set<number>>(new Set());
    const [confirmSendServicosOpen, setConfirmSendServicosOpen] = useState(false);
    const [novoServicoOpen, setNovoServicoOpen] = useState(false);
    const [novoServicoForm, setNovoServicoForm] = useState({
      objeto: "",
      justificativa: "",
      contrato: "",
      contratada: "",
      tipoContratacao: "Contínuo",
      unidadeDemandante: "",
      previsaoInicio: "",
      estimativaValor: "",
      dotacaoOrcamentaria: "",
      grauPrioridade: "Baixo" as GrauPrioridade,
      vinculacao: "Não" as "Sim" | "Não",
      dependenciaDescricao: "",
    });
    const [novoServicoLoading, setNovoServicoLoading] = useState(false);
    const [bulkEditAquisicaoOpen, setBulkEditAquisicaoOpen] = useState(false);
    const [bulkEditServicosOpen, setBulkEditServicosOpen] = useState(false);
    
    const [servicoEditOpen, setServicoEditOpen] = useState(false);
    const [servicoEdicao, setServicoEdicao] = useState<ServicoItem | null>(null);
    const [solicitacaoEditOpen, setSolicitacaoEditOpen] = useState(false);
    const [solicitacaoEdicao, setSolicitacaoEdicao] = useState<PlanItem | null>(null);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [isSendingAquisicao, setIsSendingAquisicao] = useState(false);
    const [isSendingServicos, setIsSendingServicos] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentPageServicos, setCurrentPageServicos] = useState(1);
    const ITEMS_PER_PAGE = 100;
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { descriptions: materialDescriptions } = useMaterialDescriptions();
    const [selectedAquisicaoIds, setSelectedAquisicaoIds] = useState<Set<string>>(new Set());
    const {
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
    } = useGerenciaData(siglaUpper, gerenciaUpper);

  const { isBlocked, getBlockReason } = useActivityRestrictions({
    periodoId: periodAtivo?.id,
    gerenciaId: gerenciaAtual?.id,
    diretoriaId: diretoria?.id,
    perfil: "gerencia",
  });

  const isSendAquisicaoBlocked = isBlocked("aquisicao", "enviar_solicitacao") || isBlocked("todos", "enviar_solicitacao");
  const isAddAquisicaoBlocked = isBlocked("aquisicao", "adicionar_item") || isBlocked("todos", "adicionar_item");
  const isQtdAquisicaoBlocked = isBlocked("aquisicao", "alterar_quantidade") || isBlocked("aquisicao", "editar_item") || isBlocked("todos", "alterar_quantidade") || isBlocked("todos", "editar_item");
  const isPrioridadeAquisicaoBlocked = isBlocked("aquisicao", "alterar_prioridade") || isBlocked("todos", "alterar_prioridade") || isQtdAquisicaoBlocked;
  const isObsAquisicaoBlocked = isBlocked("aquisicao", "adicionar_observacao") || isBlocked("todos", "adicionar_observacao") || isQtdAquisicaoBlocked;
  const isDevolverAquisicaoBlocked = isBlocked("aquisicao", "devolver_solicitacao") || isBlocked("aquisicao", "devolver") || isBlocked("todos", "devolver_solicitacao") || isBlocked("todos", "devolver");
  const isExcluirAquisicaoBlocked = isBlocked("aquisicao", "excluir_item") || isBlocked("todos", "excluir_item");

  const isSendServicosExistentesBlocked = isBlocked("servicos_existentes", "enviar_solicitacao") || isBlocked("todos", "enviar_solicitacao");
  const isAddServicosExistentesBlocked = isBlocked("servicos_existentes", "adicionar_servico") || isBlocked("servicos_existentes", "adicionar_item") || isBlocked("todos", "adicionar_item");
  const isValorServicosExistentesBlocked = isBlocked("servicos_existentes", "alterar_valor") || isBlocked("servicos_existentes", "alterar_quantidade") || isBlocked("servicos_existentes", "editar_item") || isBlocked("todos", "alterar_valor") || isBlocked("todos", "editar_item");
  const isDevolverServicosExistentesBlocked = isBlocked("servicos_existentes", "devolver_solicitacao") || isBlocked("servicos_existentes", "devolver") || isBlocked("todos", "devolver_solicitacao") || isBlocked("todos", "devolver");

  const isSendServicosNovosBlocked = isBlocked("servicos_novos", "enviar_solicitacao") || isBlocked("todos", "enviar_solicitacao");
  const isAddServicosNovosBlocked = isBlocked("servicos_novos", "adicionar_novo_servico") || isBlocked("servicos_novos", "adicionar_item") || isBlocked("todos", "adicionar_item");
  const isValorServicosNovosBlocked = isBlocked("servicos_novos", "alterar_valor") || isBlocked("servicos_novos", "alterar_quantidade") || isBlocked("servicos_novos", "editar_item") || isBlocked("todos", "alterar_valor") || isBlocked("todos", "editar_item");
  const isDevolverServicosNovosBlocked = isBlocked("servicos_novos", "devolver_solicitacao") || isBlocked("servicos_novos", "devolver") || isBlocked("todos", "devolver_solicitacao") || isBlocked("todos", "devolver");

  const isPeriodExpired = useMemo(() => {
    if (!periodAtivo?.fim) return false;
    const dataFim = new Date(periodAtivo.fim);
    dataFim.setHours(23, 59, 59, 999);
    return new Date() > dataFim;
  }, [periodAtivo]);



  // Converter solicitações para o formato de PlanItem
  const items: PlanItem[] = useMemo(() => {
    // Mesclar catálogo base com solicitações existentes
    return catalogoData.map((c: any) => {
      const existente = solicitacoes.find((s: any) => s.item_id === c.id || Number(s.codigo) === Number(c.codigo));
      const s = existente || { ...c, qtd_estimada: 0, status: "rascunho" };

      const mappedCategory = materialDescriptions[String(c.codigo)];
      const categoriaItem = mappedCategory
        ? mappedCategory
        : (typeof c.categoria === "string" && c.categoria.trim().length > 0)
          ? c.categoria
          : (typeof s.categoria === "string" && s.categoria.trim().length > 0)
            ? s.categoria
            : "diversos";
      const diretoriaOrcamentariaId = diretoria
        ? getBudgetOwnerDiretoriaId(orcamentoConfig, categoriaItem, diretoria.id, categoryBudgetOwnersFromDb)
        : (s.diretoria_id || diretoria?.id);
      const diretoriaOrcamentaria = diretoriaMap[diretoriaOrcamentariaId];

      return {
        id: existente ? s.id : undefined,
        item_id: c.id,
        codigo: c.codigo,
        descricao: (existente && s.descricao) ? s.descricao : c.descricao,
        categoria: categoriaItem,
        gerencia: gerenciaUpper,
        prioridade: s.prioridade || "Baixa",
        qtdEstimada: s.qtd_estimada !== undefined ? s.qtd_estimada : (s.qtdEstimada || 0),
        unidade: s.unidade || c.unidade || "un",
        valorUnitario: s.valor_unitario !== undefined ? s.valor_unitario : (c.valor_unitario || 0),
        observacao: s.observacao || "",
        status: (s.status as SolicitacaoStatus) || "rascunho",
        justificativaRejeicao: s.justificativa_rejeicao || s.justificativaRejeicao || "",
        diretoriaSigla: diretoria?.sigla,
        diretoriaOrcamentariaId,
        diretoriaOrcamentariaSigla: diretoriaOrcamentaria?.sigla || diretoria?.sigla,
        isOrcamentoCompartilhado: !!diretoria && diretoriaOrcamentariaId !== diretoria.id,
      };
    });
  }, [solicitacoes, catalogoData, materialDescriptions, gerenciaUpper, diretoria, orcamentoConfig, diretoriaMap, categoryBudgetOwnersFromDb]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      const descInitials = item.descricao.split(/\s+/).map(w => w[0]?.toLowerCase() || '').join('');
      const codInitials = item.codigo.toString().split(/\s+/).map(w => w[0]?.toLowerCase() || '').join('');
      
      const matchesSearch = searchTerm === "" || 
        item.descricao.toLowerCase().includes(searchLower) || 
        item.codigo.toString().includes(searchLower) ||
        descInitials.includes(searchLower) ||
        codInitials.includes(searchLower);

      const matchesCategoria = !categoria || categoria === "" || item.categoria === categoria;
      const matchesPrioridade = prioridade === "todas" || item.prioridade === prioridade;
      const isSentStatus = ["enviado", "em_analise", "aprovado", "rejeitado"].includes(item.status || "rascunho");
      const matchesZerado = !showOnlyZerados || item.qtdEstimada === 0;
      const matchesComQuantidade = !showOnlyComQuantidade || (item.qtdEstimada > 0 && !isSentStatus);
      const matchesSent = !showOnlySent || isSentStatus;
      return matchesSearch && matchesCategoria && matchesPrioridade && matchesZerado && matchesComQuantidade && matchesSent;
    });
  }, [items, searchTerm, categoria, prioridade, showOnlyZerados, showOnlyComQuantidade, showOnlySent]);

  const categoriasDisponiveis = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.categoria))).filter(Boolean);
    return unique.sort();
  }, [items]);

  // Resetar seleções e filtros ao mudar de tela principal
  useEffect(() => {
    setCurrentPage(1);
    setCurrentPageServicos(1);
    setSelectedAquisicaoIds(new Set());
    setSelectedServicos(new Set());
    setSearchTerm("");
    setCategoria("");
    setPrioridade("todas");
    setShowOnlyZerados(false);
    setShowOnlySent(false);
    setShowOnlyComQuantidade(false);
  }, [selectedOption]);

  // Resetar apenas página quando filtros mudarem (mantendo as seleções)
  useEffect(() => {
    setCurrentPage(1);
  }, [categoria, searchTerm, prioridade, showOnlyZerados, showOnlyComQuantidade, showOnlySent]);

  useEffect(() => {
    setCurrentPageServicos(1);
  }, [searchTerm, prioridade, showOnlyZerados, showOnlyComQuantidade, showOnlySent]);

  const { sortedItems: sortedFilteredItems, sortConfig: itemsSortConfig, requestSort: requestItemsSort } = useSortableTable(filteredItems);

  // Calcular paginação
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(sortedFilteredItems.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = sortedFilteredItems.slice(startIdx, endIdx);
    return { totalPages, currentPage, paginatedItems };
  }, [sortedFilteredItems, currentPage]);

  const orcamentoDiretoriaAquisicao = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as AdminBudgetConfig | null, diretoria.id, "aquisicao")
    : 0;
  const orcamentoDiretoriaServicosNovos = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as AdminBudgetConfig | null, diretoria.id, "servicos_novos")
    : 0;
  const orcamentoDiretoriaServicosExistentes = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as AdminBudgetConfig | null, diretoria.id, "servicos_existentes")
    : 0;
  const isAprovado = (status?: SolicitacaoStatus) =>
    status === "aprovado" || status === "em_compra" || status === "concluido";

  const gastoAquisicaoGerencia = useMemo(() => {
    if (selectedAquisicaoIds.size > 0) {
      return items
        .filter((item) => {
          const matchId = item.id && selectedAquisicaoIds.has(item.id);
          const matchCodigo = selectedAquisicaoIds.has(item.codigo as any) || selectedAquisicaoIds.has(String(item.codigo) as any);
          return (matchId || matchCodigo) && item.qtdEstimada > 0;
        })
        .reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0);
    }
    return items
      .filter((item) => item.diretoriaOrcamentariaId === diretoria?.id && isAprovado(item.status) && item.qtdEstimada > 0)
      .reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0);
  }, [items, diretoria?.id, selectedAquisicaoIds]);

  const summary = useMemo(
    () => ({
      totalItens: filteredItems.length,
      valorTotal: filteredItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
    }),
    [filteredItems],
  );
    const resumoOrcamentoPorDiretoria = useMemo(() => {
      const grupos = new Map<string, { sigla: string; total: number; itens: number }>();

      items
        .filter((item) => item.qtdEstimada > 0)
        .forEach((item) => {
          const siglaDestino = diretoria?.sigla || "N/D";
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
        .filter((item) => item.id && selectedAquisicaoIds.has(item.id))
        .forEach((item) => {
          const siglaDestino = diretoria?.sigla || "N/D";
          const atual = grupos.get(siglaDestino) || { sigla: siglaDestino, total: 0, itens: 0 };
          atual.total += item.qtdEstimada * item.valorUnitario;
          atual.itens += 1;
          grupos.set(siglaDestino, atual);
        });

      return Array.from(grupos.values()).sort((a, b) => a.sigla.localeCompare(b.sigla));
    }, [items, diretoria?.sigla, selectedAquisicaoIds]);

  const gastoServicosExistentes = useMemo(() => {
    const catalogoSet = new Set(servicosCatalogoData.map((c: any) => String(c.item)));
    if (selectedServicos.size > 0) {
      return servicosData
        .filter((s: ServicoItem) => {
          const matchItem = selectedServicos.has(s.item) || selectedServicos.has(String(s.item) as any) || selectedServicos.has(Number(s.item) as any);
          const matchId = s.id && selectedServicos.has(s.id as any);
          return catalogoSet.has(String(s.item)) && (matchItem || matchId);
        })
        .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || 0), 0);
    }
    return servicosData
      .filter((s: ServicoItem) => catalogoSet.has(String(s.item)) && isAprovado(s.status))
      .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || 0), 0);
  }, [servicosData, servicosCatalogoData, selectedServicos]);

  const gastoServicosNovos = useMemo(() => {
    const catalogoSet = new Set(servicosCatalogoData.map((c: any) => String(c.item)));
    if (selectedServicos.size > 0) {
      return servicosData
        .filter((s: ServicoItem) => {
          const matchItem = selectedServicos.has(s.item) || selectedServicos.has(String(s.item) as any) || selectedServicos.has(Number(s.item) as any);
          const matchId = s.id && selectedServicos.has(s.id as any);
          return !catalogoSet.has(String(s.item)) && (matchItem || matchId);
        })
        .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || 0), 0);
    }
    return servicosData
      .filter((s: ServicoItem) => !catalogoSet.has(String(s.item)) && isAprovado(s.status))
      .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || 0), 0);
  }, [servicosData, servicosCatalogoData, selectedServicos]);

  const canSend = items.some((item) => item.qtdEstimada > 0 && item.status === "rascunho"); // Permite enviar se tiver pelo menos 1 item com quantidade em rascunho
  const isReadOnly = items.filter((item) => item.qtdEstimada > 0).length > 0 && items.filter((item) => item.qtdEstimada > 0).every((item) => item.status === "enviado" || item.status === "em_analise" || item.status === "aprovado");
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

  const ensureSolicitacao = async (itemCode: number, updates: any) => {
    const safeUpdates = { ...updates };
    if (safeUpdates.status !== undefined && safeUpdates.status !== "enviado") {
      delete safeUpdates.status;
    }

    const existente = items.find((i) => String(i.codigo) === String(itemCode));
    if (existente?.id) {
      if (existente.status !== "rascunho" && existente.status !== "rejeitado") return;
      if (existente.status === "rejeitado" && !safeUpdates.status) {
        safeUpdates.status = "rascunho";
        safeUpdates.justificativa_rejeicao = null;
      }
      await updateSolicitacao(existente.id, safeUpdates);
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
      return;
    }

    const catalogoItem = catalogoData.find((c: any) => String(c.codigo) === String(itemCode));
    if (!catalogoItem || !gerenciaAtual || !diretoria || !periodAtivo) return;

    const destinoId = (orcamentoConfig as any)?.routingRules?.[gerenciaAtual.id]?.destinoId || diretoria.id;

    await createSolicitacao({
      periodo_id: periodAtivo.id,
      diretoria_id: destinoId,
      gerencia_id: gerenciaAtual.id,
      item_id: catalogoItem.id,
      codigo: catalogoItem.codigo,
      descricao: safeUpdates.descricao !== undefined ? safeUpdates.descricao : catalogoItem.descricao,
      categoria: safeUpdates.categoria !== undefined ? safeUpdates.categoria : catalogoItem.categoria,
      unidade: safeUpdates.unidade !== undefined ? safeUpdates.unidade : (catalogoItem.unidade || "un"),
      qtdEstimada: safeUpdates.qtdEstimada !== undefined ? safeUpdates.qtdEstimada : 0,
      valorUnitario: catalogoItem.valor_unitario || 0,
      prioridade: safeUpdates.prioridade !== undefined ? safeUpdates.prioridade : "Baixa",
      observacao: safeUpdates.observacao !== undefined ? safeUpdates.observacao : null,
      status: safeUpdates.status || "rascunho",
    });
    await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
    await queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
  };

  const handleUpdateQtdEstimada = async (codigo: number, qtdEstimada: number) => {
    if (isQtdAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "alterar_quantidade") || "A edição de quantidades está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    const item = items.find(i => i.codigo === codigo);
    if (item && item.id) {
      if (item.status !== "rascunho" && item.status !== "rejeitado") return;
      patchSolicitacaoInCache(item.id, { qtd_estimada: qtdEstimada });
      await ensureSolicitacao(item.codigo, { qtdEstimada });
    } else if (item) {
      await ensureSolicitacao(item.codigo, { qtdEstimada });
    }
  };

  const handleUpdateUnidade = async (codigo: number, unidade: string) => {
    if (isQtdAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "alterar_quantidade") || "A edição está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    const item = items.find(i => i.codigo === codigo);
    if (item && item.id) {
      if (item.status !== "rascunho" && item.status !== "rejeitado") return;
      patchSolicitacaoInCache(item.id, { unidade });
      await ensureSolicitacao(item.codigo, { unidade });
    } else if (item) {
      await ensureSolicitacao(item.codigo, { unidade });
    }
  };

  const handleUpdateObservacao = async (codigo: number, observacao: string) => {
    if (isObsAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "adicionar_observacao") || "A edição de observações está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    const item = items.find(i => i.codigo === codigo);
    if (item && item.id) {
      if (item.status !== "rascunho" && item.status !== "rejeitado") return;
      patchSolicitacaoInCache(item.id, { observacao });
      await ensureSolicitacao(item.codigo, { observacao });
    } else if (item) {
      await ensureSolicitacao(item.codigo, { observacao });
    }
  };

  const handleUpdatePrioridade = async (codigo: number, prioridade: PlanItem["prioridade"]) => {
    if (isPrioridadeAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "alterar_prioridade") || "A alteração de prioridades está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    const item = items.find(i => i.codigo === codigo);
    if (item && item.id) {
      if (item.status !== "rascunho" && item.status !== "rejeitado") return;
      patchSolicitacaoInCache(item.id, { prioridade });
      await ensureSolicitacao(item.codigo, { prioridade });
    } else if (item) {
      await ensureSolicitacao(item.codigo, { prioridade });
    }
  };

  const handleDevolverAquisicao = async (itemId: string) => {
    if (isDevolverAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "devolver_solicitacao") || "A devolução de solicitações está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Tem certeza que deseja devolver este item para rascunho?")) return;
    try {
      await updateSolicitacao(itemId, { status: "rascunho" });
      toast({ title: "Item devolvido", description: "O item voltou para o status de Rascunho." });
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    } catch (error: any) {
      console.error("Erro ao devolver item:", error);
      toast({ title: "Erro", description: "Não foi possível devolver o item.", variant: "destructive" });
    }
  };

  const handleDevolverTodosAquisicao = async (itemIds: string[]) => {
    if (isDevolverAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "devolver_solicitacao") || "A devolução de solicitações está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (itemIds.length === 0) {
      toast({
        title: "Nenhum item selecionado",
        description: "Selecione pelo menos um item antes de utilizar a ação.",
        variant: "destructive",
      });
      return;
    }
    const msg = itemIds.length === 1
      ? "Tem certeza que deseja devolver o item selecionado para rascunho?"
      : `Tem certeza que deseja devolver os ${itemIds.length} item(ns) selecionados para rascunho?`;
    if (!confirm(msg)) return;
    try {
      await updateSolicitacaoStatusBulk(itemIds, "rascunho");
      toast({ title: "Itens devolvidos", description: `${itemIds.length} item(ns) voltaram para o status de Rascunho.` });
      setSelectedAquisicaoIds((prev) => {
        const next = new Set(prev);
        itemIds.forEach((id) => next.delete(id));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    } catch (error: any) {
      console.error("Erro ao devolver itens:", error);
      toast({ title: "Erro", description: "Não foi possível devolver os itens.", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (isExcluirAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "excluir_item") || "A exclusão de itens está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Excluir este item permanentemente?")) return;

    try {
      queryClient.setQueryData(solicitacoesQueryKey, (current: any[] | undefined) => {
        if (!Array.isArray(current)) return current;
        return current.filter(s => s.id !== itemId);
      });
      
      setSelectedAquisicaoIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      
      await deleteSolicitacao(itemId);
      await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      await queryClient.refetchQueries({ queryKey: ["solicitacoes"] });
      toast({ title: "Item excluído", description: "O item foi removido com sucesso." });
    } catch (error: any) {
      console.error("Erro no handleDeleteItem:", error);
      toast({ title: "Erro", description: `Não foi possível excluir o item. Detalhe: ${error?.message || JSON.stringify(error)}`, variant: "destructive" });
    } finally {
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
    }
  };

  const handleSendToDiretoria = async () => {
    if (!gerenciaAtual || !periodAtivo || isSendingAquisicao) return;

    const idsParaEnviar = Array.from(selectedAquisicaoIds);
    if (idsParaEnviar.length === 0) {
      setConfirmSendOpen(false);
      return;
    }

    setIsSendingAquisicao(true);

    try {
      // Executar update em massa
      await updateSolicitacaoStatusBulk(idsParaEnviar, "enviado");
      
      const destinoId = (orcamentoConfig as any)?.routingRules?.[gerenciaAtual.id]?.destinoId || gerenciaAtual.diretoria_id || diretoria?.id;

      // Atualização otimista no cache da gerência para reflexo imediato
      queryClient.setQueryData(
        solicitacoesQueryKey,
        (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: any) => 
            idsParaEnviar.includes(item.id) ? { ...item, status: "enviado" } : item
          );
        }
      );

      // Atualização otimista no cache da diretoria para garantir reflexo imediato
      if (destinoId) {
        queryClient.setQueryData(
          ["solicitacoes-diretoria", destinoId, periodAtivo.id],
          (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((item: any) => 
              idsParaEnviar.includes(item.id) ? { ...item, status: "enviado" } : item
            );
          }
        );
      }

      // Invalidar queries
      await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
      if (destinoId) {
        await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", destinoId, periodAtivo.id], exact: true });
      }

      setSelectedAquisicaoIds(new Set());
      setConfirmSendOpen(false);

      toast({
        title: "Envio confirmado com sucesso",
        description: `${idsParaEnviar.length} item(ns) enviado(s) para a diretoria com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro ao enviar para diretoria:", error);
      toast({
        title: "Erro ao confirmar envio",
        description: error?.message || "Não foi possível enviar as solicitações para a diretoria.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
    } finally {
      setIsSendingAquisicao(false);
    }
  };

  const openSolicitacaoEditor = (item: PlanItem) => {
    if (isQtdAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "alterar_quantidade") || "A edição de solicitações está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    setSolicitacaoEdicao(item);
    setSolicitacaoEditOpen(true);
  };

  const handleSaveSolicitacaoEdicao = async (codigo: number, updates: Partial<PlanItem>) => {
    if (isQtdAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "alterar_quantidade") || "A edição de solicitações está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (solicitacaoEdicao?.id) {
        await updateSolicitacao(solicitacaoEdicao.id, updates);
      } else {
        await ensureSolicitacao(codigo, updates);
      }
      await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      setSolicitacaoEditOpen(false);
      setSolicitacaoEdicao(null);
      toast({ title: "Solicitação atualizada", description: "Dados atualizados com sucesso." });
    } catch (error: any) {
      console.error("Erro ao atualizar solicitação:", error);
      toast({ title: "Erro ao atualizar", description: error?.message || "Não foi possível salvar as alterações.", variant: "destructive" });
    }
  };

  const handleBulkEditAquisicao = async (updates: any) => {
    if (isQtdAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aquisicao", "edicao_em_lote") || getBlockReason("aquisicao", "alterar_quantidade") || "A edição em lote está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    setIsBulkUpdating(true);
    try {
      await updateSolicitacoesBulkData(Array.from(selectedAquisicaoIds), updates);
      await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
      toast({ title: "Itens atualizados", description: "Os itens selecionados foram atualizados com sucesso." });
      setBulkEditAquisicaoOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDeleteAquisicao = async () => {
    if (!confirm("Excluir os itens selecionados permanentemente?")) return;
    try {
      const idsToDelete = Array.from(selectedAquisicaoIds);
      queryClient.setQueryData(solicitacoesQueryKey, (current: any[] | undefined) => {
        if (!Array.isArray(current)) return current;
        return current.filter(s => !idsToDelete.includes(s.id));
      });
      await deleteSolicitacoesBulk(idsToDelete);
      setSelectedAquisicaoIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      await queryClient.refetchQueries({ queryKey: ["solicitacoes"] });
      toast({ title: "Itens excluídos", description: "Os itens foram removidos." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const ensureServico = async (itemCode: number | string, updates: any) => {
    const safeUpdates = { ...updates };
    if (safeUpdates.status !== undefined && safeUpdates.status !== "enviado") {
      delete safeUpdates.status;
    }

    const servicoExistente = servicosData.find((s: ServicoItem) => String(s.item) === String(itemCode));
    
    if (servicoExistente?.id) {
      if (servicoExistente.status !== "rascunho" && servicoExistente.status !== "rejeitado") return;
      if (servicoExistente.status === "rejeitado" && !safeUpdates.status) {
        safeUpdates.status = "rascunho";
        safeUpdates.justificativa_rejeicao = null;
      }
      await updateServico(servicoExistente.id, safeUpdates);
      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      return;
    }

    const catalogoItem = servicosCatalogoData.find((c: any) => String(c.item) === String(itemCode));
    if (!catalogoItem) return;

    const newServico = {
      periodo_id: periodAtivo?.id,
      diretoria_id: diretoria?.id,
      gerencia_id: gerenciaAtual?.id,
      item: catalogoItem.item,
      tipo_contratacao: safeUpdates.tipoContratacao !== undefined ? safeUpdates.tipoContratacao : (catalogoItem.tipo_contratacao || ""),
      unidade_demandante: safeUpdates.unidadeDemandante !== undefined ? safeUpdates.unidadeDemandante : (catalogoItem.unidade_demandante || gerenciaUpper),
      objeto: safeUpdates.objeto !== undefined ? safeUpdates.objeto : (catalogoItem.objeto || ""),
      justificativa: safeUpdates.justificativa !== undefined ? safeUpdates.justificativa : (catalogoItem.justificativa || ""),
      previsao_inicio: safeUpdates.previsaoInicio !== undefined ? safeUpdates.previsaoInicio : (catalogoItem.previsao_inicio || ""),
      estimativa_valor: safeUpdates.estimativaValor !== undefined ? safeUpdates.estimativaValor : (catalogoItem.estimativa_valor || 0),
      dotacao_orcamentaria: safeUpdates.dotacaoOrcamentaria !== undefined ? safeUpdates.dotacaoOrcamentaria : (catalogoItem.dotacao_orcamentaria || 0),
      grau_prioridade: safeUpdates.grauPrioridade !== undefined ? safeUpdates.grauPrioridade : (catalogoItem.grau_prioridade || ""),
      vinculacao: safeUpdates.vinculacao !== undefined ? safeUpdates.vinculacao : (catalogoItem.vinculacao || "Não"),
      dependencia_descricao: safeUpdates.dependenciaDescricao !== undefined ? safeUpdates.dependenciaDescricao : (catalogoItem.dependencia_descricao || ""),
      status: safeUpdates.status || "rascunho",
      observacao: safeUpdates.observacao !== undefined ? safeUpdates.observacao : "",
      contrato: safeUpdates.contrato !== undefined ? safeUpdates.contrato : "",
      contratada: safeUpdates.contratada !== undefined ? safeUpdates.contratada : "",
    };

    await createServico(newServico);
    await queryClient.invalidateQueries({ queryKey: ["servicos"] });
    await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
  };

  const handleUpdateGrauPrioridade = async (item: number, grauPrioridade: GrauPrioridade) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason(selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes", "alterar_valor") || "A alteração de prioridades está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    await ensureServico(item, { grau_prioridade: grauPrioridade });
  };

  const handleUpdateJustificativa = async (item: number, justificativa: string) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) return;
    const justificativaLimpa = justificativa.trim();
    if (!justificativaLimpa) return;
    await ensureServico(item, { justificativa: justificativaLimpa });
  };

  const handleUpdateDotacao = async (item: number, dotacaoOrcamentaria: number) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) return;
    await ensureServico(item, { dotacao_orcamentaria: dotacaoOrcamentaria });
  };

  const handleUpdateVinculacao = async (item: number, vinculacao: string) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) return;
    await ensureServico(item, { vinculacao });
  };

  const handleUpdateObservacaoServico = async (item: number, observacao: string) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) return;
    await ensureServico(item, { observacao });
  };

  const handleDevolverServico = async (servicoId: string) => {
    const isCurrentDevolverBlocked = (selectedOption === "servicos_novos" ? isDevolverServicosNovosBlocked : isDevolverServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentDevolverBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason(selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes", "devolver_solicitacao") || "A devolução de serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Tem certeza que deseja devolver este serviço para rascunho?")) return;
    try {
      await updateServico(servicoId, { status: "rascunho" });
      toast({ title: "Serviço devolvido", description: "O serviço voltou para o status de Rascunho." });
      queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
    } catch (error: any) {
      console.error("Erro ao devolver serviço:", error);
      toast({ title: "Erro", description: "Não foi possível devolver o serviço.", variant: "destructive" });
    }
  };

  const handleDevolverTodosServico = async (servicoIds: string[]) => {
    const isCurrentDevolverBlocked = (selectedOption === "servicos_novos" ? isDevolverServicosNovosBlocked : isDevolverServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentDevolverBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason(selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes", "devolver_solicitacao") || "A devolução de serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (servicoIds.length === 0) {
      toast({
        title: "Nenhum serviço selecionado",
        description: "Selecione pelo menos um item antes de utilizar a ação.",
        variant: "destructive",
      });
      return;
    }
    const msg = servicoIds.length === 1
      ? "Tem certeza que deseja devolver o serviço selecionado para rascunho?"
      : `Tem certeza que deseja devolver os ${servicoIds.length} serviço(s) selecionados para rascunho?`;
    if (!confirm(msg)) return;
    try {
      await Promise.all(servicoIds.map((id) => updateServico(id, { status: "rascunho" })));
      toast({ title: "Serviços devolvidos", description: `${servicoIds.length} serviço(s) voltaram para o status de Rascunho.` });
      setSelectedServicos((prev) => {
        const next = new Set(prev);
        const itemsToRemove = servicosData.filter((s) => s.id && servicoIds.includes(s.id)).map((s) => s.item);
        itemsToRemove.forEach((itemCode) => next.delete(itemCode));
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
    } catch (error: any) {
      console.error("Erro ao devolver serviços:", error);
      toast({ title: "Erro", description: "Não foi possível devolver os serviços.", variant: "destructive" });
    }
  };

  const handleDeleteServico = async (servicoId: string | undefined, itemCode: number) => {
    if (isExcluirAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("servicos_novos", "excluir_item") || "A exclusão de serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    try {
      let targetId = servicoId;
      if (!targetId) {
        const found = servicosData.find((sd: ServicoItem) => sd.item === itemCode);
        if (found?.id) targetId = found.id;
      }

      // Optimistic update
      queryClient.setQueryData(
        ["servicos", gerenciaAtual?.id, periodAtivo?.id],
        (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((s: any) => (targetId ? s.id !== targetId : true) && s.item !== itemCode);
        }
      );

      if (targetId) {
        await deleteServico(targetId);
      }
      
      const catalogoItem = servicosCatalogoData.find((c: any) => c.item === itemCode);
      if (catalogoItem?.id) {
        try {
          await supabase.from("servicos_catalogo").delete().eq("id", catalogoItem.id);
        } catch (catErr) {
          console.warn("Could not delete from servicos_catalogo:", catErr);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      await queryClient.refetchQueries({ queryKey: ["servicos"] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi removido com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro ao excluir serviço:", error);
      toast({
        title: "Não foi possível excluir o serviço",
        description: error?.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectServico = (itemCode: number) => {
    const newSelected = new Set(selectedServicos);
    if (newSelected.has(itemCode)) {
      newSelected.delete(itemCode);
    } else {
      newSelected.add(itemCode);
    }
    setSelectedServicos(newSelected);
  };

  const toggleSelectAllServicos = (todos: ServicoItem[]) => {
    if (todos.length > 0 && todos.every((s) => selectedServicos.has(s.item))) {
      const newSet = new Set(selectedServicos);
      todos.forEach((s) => newSet.delete(s.item));
      setSelectedServicos(newSet);
    } else {
      const newSet = new Set(selectedServicos);
      todos.forEach((s) => newSet.add(s.item));
      setSelectedServicos(newSet);
    }
  };

  const handleCriarServico = async () => {
    if (novoServicoLoading) return; // Prevent double submission
    if (isAddServicosNovosBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("servicos_novos", "adicionar_novo_servico") || "A criação de novos serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (!gerenciaAtual || !diretoria || !periodAtivo) return;
    if (!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim()) return;

    setNovoServicoLoading(true);
    try {
      const maxItem = servicosData.length > 0
        ? Math.max(...servicosData.map((s: ServicoItem) => s.item || 0))
        : 0;
      const proximoItem = maxItem < 9000000 ? 9000000 : maxItem + 1;

      await createServico({
        periodo_id: periodAtivo.id,
        diretoria_id: diretoria.id,
        gerencia_id: gerenciaAtual.id,
        item: proximoItem,
        tipo_contratacao: novoServicoForm.tipoContratacao || "Serviço",
        unidade_demandante: novoServicoForm.unidadeDemandante || gerenciaUpper,
        objeto: novoServicoForm.objeto.trim(),
        justificativa: novoServicoForm.justificativa.trim() || null,
        contrato: novoServicoForm.contrato?.trim() || null,
        contratada: novoServicoForm.contratada?.trim() || null,
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
        contrato: "",
        contratada: "",
        tipoContratacao: "Contínuo",
        unidadeDemandante: "",
        previsaoInicio: "",
        estimativaValor: "",
        dotacaoOrcamentaria: "",
        grauPrioridade: "Baixo",
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
    if (!gerenciaAtual || !periodAtivo || isSendingServicos) return;
    
    if (selectedServicos.size === 0) {
      setConfirmSendServicosOpen(false);
      return;
    }

    setIsSendingServicos(true);

    try {
      const updates = Array.from(selectedServicos).map((itemCode: any) => 
        ensureServico(itemCode, { status: "enviado" })
      );
      
      await Promise.all(updates);

      const destinoId = (orcamentoConfig as any)?.routingRules?.[gerenciaAtual.id]?.destinoId || gerenciaAtual.diretoria_id || diretoria?.id;

      // Atualização otimista no cache da diretoria para reflexo instantâneo
      if (destinoId) {
        queryClient.setQueryData(
          ["servicos-diretoria", destinoId, periodAtivo.id],
          (old: any) => {
            if (!Array.isArray(old)) return old;
            const idsEnviados = new Set(Array.from(selectedServicos));
            return old.map((item: any) => 
              idsEnviados.has(item.id) || idsEnviados.has(item.codigo) ? { ...item, status: "enviado" } : item
            );
          }
        );
      }

      await queryClient.invalidateQueries({
        queryKey: ["servicos"]
      });

      await queryClient.refetchQueries({
        queryKey: ["servicos"]
      });

      await queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual.id, periodAtivo.id] });

      const count = selectedServicos.size;
      setSelectedServicos(new Set());
      setConfirmSendServicosOpen(false);
      
      toast({
        title: "Serviços enviados",
        description: `${count} serviço(s) enviado(s) para a diretoria com sucesso.`
      });
    } catch (error: any) {
      console.error("Erro ao enviar serviços para diretoria:", error);
      toast({
        title: "Erro ao enviar serviços",
        description: error?.message || "Não foi possível enviar os serviços para a diretoria.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
    } finally {
      setIsSendingServicos(false);
    }
  };

  const openServicoEditor = (servico: ServicoItem) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason(selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes", "alterar_valor") || "A edição de serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    setServicoEdicao(servico);
    setServicoEditOpen(true);
  };

  const handleSaveServicoEdicao = async () => {
    if (!servicoEdicao?.item) return;
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason(selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes", "alterar_valor") || "A edição de serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }

    const updates: Partial<ServicoItem> = {
      objeto: servicoEdicao.objeto,
      justificativa: servicoEdicao.justificativa,
      observacao: servicoEdicao.observacao,
      estimativaValor: servicoEdicao.estimativaValor,
      dotacaoOrcamentaria: servicoEdicao.dotacaoOrcamentaria,
      grauPrioridade: servicoEdicao.grauPrioridade,
      vinculacao: servicoEdicao.vinculacao,
      dependenciaDescricao: servicoEdicao.dependenciaDescricao,
      contrato: servicoEdicao.contrato,
      contratada: servicoEdicao.contratada,
      tipoContratacao: servicoEdicao.tipoContratacao,
    };

    try {
      await ensureServico(servicoEdicao.item as number, updates);
      setServicoEditOpen(false);
      setServicoEdicao(null);
      toast({ title: "Serviço atualizado", description: "Informações do serviço salvas." });
    } catch (error) {
      console.error("Erro ao atualizar serviço:", error);
      toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    }
  };

  const handleBulkEditServicos = async (updates: any) => {
    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
    if (isCurrentValorBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason(selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes", "edicao_em_lote") || "A edição em lote está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    setIsBulkUpdating(true);
    try {
      const promises = Array.from(selectedServicos).map((itemCode) =>
        ensureServico(itemCode, updates)
      );
      await Promise.all(promises);
      await queryClient.invalidateQueries({ queryKey: ["servicos", gerenciaAtual?.id, periodAtivo?.id] });
      toast({ title: "Serviços atualizados", description: "Os serviços selecionados foram atualizados com sucesso." });
      setBulkEditServicosOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDeleteServicos = async () => {
    if (isExcluirAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("servicos_novos", "excluir_item") || "A exclusão de serviços está bloqueada para a sua gerência neste período.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Excluir os serviços selecionados permanentemente?")) return;
    try {
      const selectedCodes = Array.from(selectedServicos);
      const idsToDelete = selectedCodes
        .map(itemCode => servicosData.find((s: any) => s.item === itemCode)?.id)
        .filter(Boolean) as string[];

      queryClient.setQueryData(
        ["servicos", gerenciaAtual?.id, periodAtivo?.id],
        (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((s: any) => !selectedCodes.includes(s.item) && (s.id ? !idsToDelete.includes(s.id) : true));
        }
      );

      if (idsToDelete.length > 0) {
        await deleteServicosBulk(idsToDelete);
      }
      setSelectedServicos(new Set());
      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      await queryClient.refetchQueries({ queryKey: ["servicos"] });
      toast({ title: "Serviços excluídos", description: "Os serviços foram removidos." });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleExportAquisicaoExcel = async () => {
    // @ts-ignore
    const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js");
    const XLSX = (xlsxModule as any).default ?? xlsxModule;
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    wsData.push([`Plano Anual de Contratações 2027 — Aquisições — ${gerenciaUpper}`]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);

    const headers = ["Código", "Descrição", "Categoria", "Unidade", "Qtd. Estimada", "Valor Unitário", "Total Item", "Prioridade", "Gerência", "Diretoria Orçamentária", "Observação", "Status"];
    wsData.push(headers);

    filteredItems.forEach((item) => {
      wsData.push([
        item.codigo,
        item.descricao,
        item.categoria,
        item.unidade,
        item.qtdEstimada,
        item.valorUnitario,
        item.qtdEstimada * item.valorUnitario,
        item.prioridade,
        item.gerencia,
        item.diretoriaOrcamentariaSigla || "",
        item.observacao || "",
        item.status || "rascunho"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 10 }, { wch: 45 }, { wch: 20 }, { wch: 10 }, { wch: 14 },
      { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 12 }
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }
    ];

    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: "1E3A5F" } }, alignment: { horizontal: "center" as const } };
    const subtitleStyle = { font: { sz: 10, color: { rgb: "666666" } }, alignment: { horizontal: "center" as const } };

    for (let c = 0; c <= 11; c++) {
      const cell0 = XLSX.utils.encode_cell({ r: 0, c });
      const cell1 = XLSX.utils.encode_cell({ r: 1, c });
      if (ws[cell0]) ws[cell0].s = titleStyle;
      if (ws[cell1]) ws[cell1].s = subtitleStyle;
    }

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "2563EB" } },
      alignment: { horizontal: "center" as const, vertical: "center" as const },
      border: { bottom: { style: "thin" as const, color: { rgb: "1D4ED8" } } },
    };
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }

    const prioridadeColors: Record<string, string> = { Alta: "FECACA", Média: "FEF3C7", Baixa: "D1FAE5" };
    const prioridadeFontColors: Record<string, string> = { Alta: "DC2626", Média: "D97706", Baixa: "059669" };

    for (let r = 0; r < filteredItems.length; r++) {
      const rowIdx = r + 4;
      const item = filteredItems[r];

      const prioCell = XLSX.utils.encode_cell({ r: rowIdx, c: 7 });
      if (ws[prioCell]) {
        ws[prioCell].s = {
          font: { bold: true, color: { rgb: prioridadeFontColors[item.prioridade] || "000000" } },
          fill: { fgColor: { rgb: prioridadeColors[item.prioridade] || "FFFFFF" } },
          alignment: { horizontal: "center" as const },
        };
      }

      for (const valueCol of [5, 6]) {
        const valRef = XLSX.utils.encode_cell({ r: rowIdx, c: valueCol });
        if (ws[valRef]) {
          ws[valRef].z = '#,##0.00';
          ws[valRef].s = { alignment: { horizontal: "right" as const } };
        }
      }

      for (const c of [0, 3, 4, 8, 9, 11]) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[ref]) {
          ws[ref].s = { ...(ws[ref].s || {}), alignment: { horizontal: "center" as const } };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Aquisições");
    XLSX.writeFile(wb, `PAC_2027_Aquisicoes_${gerenciaUpper}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportAquisicaoPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    doc.setFontSize(14);
    doc.text(`PAC 2027 — Aquisições — ${gerenciaUpper}`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    
    const formatCurrency = (value?: number) =>
      value != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
        : "—";

    autoTable(doc, {
      head: [["Cód.", "Descrição", "Categoria", "Unid.", "Qtd. Est.", "Valor Unit.", "Total Item", "Prioridade", "Status"]],
      body: filteredItems.map((item) => [
        item.codigo,
        item.descricao.length > 60 ? item.descricao.substring(0, 60) + "…" : item.descricao,
        item.categoria,
        item.unidade,
        item.qtdEstimada,
        formatCurrency(item.valorUnitario),
        formatCurrency(item.qtdEstimada * item.valorUnitario),
        item.prioridade,
        item.status === "rascunho" ? "Rascunho" : item.status === "enviado" ? "Enviado" : item.status === "aprovado" ? "Aprovado" : item.status
      ]) as any,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 254] },
    });
    doc.save(`PAC_2027_Aquisicoes_${gerenciaUpper}_${new Date().toISOString().split("T")[0]}.pdf`);
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
        targetSigla={gerenciaUpper}
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
          <PageBreadcrumb
            onBack={() => navigate(`/diretoria/${sigla}`)}
            onHome={() => navigate("/")}
            crumbs={[
              { label: gerenciaUpper },
            ]}
          />

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

  // Tela de seleção secundária: Serviços Existentes ou Novos Serviços
  if (selectedOption === "servicos") {
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
          <PageBreadcrumb
            onBack={() => setSelectedOption(null)}
            onHome={() => navigate("/")}
            crumbs={[
              { label: gerenciaUpper, onClick: () => setSelectedOption(null) },
              { label: "Serviços", isActive: true },
            ]}
          />

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
              <p className="text-white/80 text-lg">Selecione a categoria de serviços</p>
            </div>
          </div>

          {/* Opções: Serviços Existentes e Novos Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cartão Serviços Existentes */}
                <button
                  onClick={() => setSelectedOption("servicos_existentes")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-[320px]"
                >
                  <div className="mb-4 flex justify-center w-full">
                    <div className="w-48 h-32 rounded-lg overflow-hidden flex items-center justify-center transition-colors">
                      <img
                        src="/assets/images/servicos_existentes.png"
                        alt="Serviços Existentes"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Serviços Existentes</h2>
                    <p className="text-muted-foreground text-sm">
                      Contratos vigentes, renovações e prorrogações em andamento
                    </p>
                  </div>
                </button>

                {/* Cartão Novos Serviços */}
                <button
                  onClick={() => setSelectedOption("servicos_novos")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-purple-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-[320px]"
                >
                  <div className="mb-4 flex justify-center w-full">
                    <div className="w-48 h-32 rounded-lg overflow-hidden flex items-center justify-center transition-colors">
                      <img
                        src="/assets/images/novos_servicos.png"
                        alt="Novos Serviços"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Novos Serviços</h2>
                    <p className="text-muted-foreground text-sm">
                      Cadastrar e gerenciar novas solicitações de serviços e contratações
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se escolheu "Serviços Existentes" ou "Novos Serviços", mostrar tabela de serviços com seleção
  if (selectedOption === "servicos_existentes" || selectedOption === "servicos_novos") {
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

    const getContratadaFallback = (contrato: string | undefined | null) => {
      if (!contrato) return null;
      const found = (servicosCatalogoData as any[]).find(c => c.contrato === contrato && c.contratada);
      return found ? found.contratada : null;
    };

    const servicos: ServicoItem[] = (servicosData as any[]).map((s: any) => ({
      id: s.id,
      item: s.item,
      tipoContratacao: s.tipoContratacao || s.tipo_contratacao || "",
      unidadeDemandante: s.unidadeDemandante || s.unidade_demandante || "",
      objeto: s.objeto || "",
      justificativa: s.justificativa || "",
      previsaoInicio: s.previsaoInicio || s.previsao_inicio,
      estimativaValor: s.estimativaValor || s.estimativa_valor,
      dotacaoOrcamentaria: s.dotacaoOrcamentaria || s.dotacao_orcamentaria,
      grauPrioridade: s.grauPrioridade || s.grau_prioridade || "Baixo",
      vinculacao: s.vinculacao || "Não",
      dependenciaDescricao: s.dependenciaDescricao || s.dependencia_descricao,
      gerencia: gerenciaUpper,
      diretoriaSigla: siglaUpper,
      status: s.status,
      observacao: s.observacao,
      contrato: s.contrato,
      contratada: s.contratada || getContratadaFallback(s.contrato),
    }));

    const isServicoReadOnly = (s: ServicoItem) => s.status !== "rascunho" && s.status !== "rejeitado";
    const catalogoItemsSet = new Set((servicosCatalogoData as any[]).map(c => c.item));
    
    // Serviços Existentes vêm do catálogo (Painel Administrativo)
    const servicosExistentes: ServicoItem[] = (servicosCatalogoData as any[]).map((catalogoItem) => {
      const servicoDb = servicos.find(s => s.item === catalogoItem.item);
      if (servicoDb) {
        return servicoDb;
      }
      // Virtual item if it doesn't exist in the database yet
      return {
        id: undefined, // undefined indicates it needs to be created
        item: catalogoItem.item,
        tipoContratacao: catalogoItem.tipo_contratacao || "Serviço",
        unidadeDemandante: gerenciaUpper,
        objeto: catalogoItem.objeto || "",
        justificativa: "",
        previsaoInicio: catalogoItem.previsao_inicio || undefined,
        estimativaValor: catalogoItem.estimativa_valor || 0,
        dotacaoOrcamentaria: catalogoItem.dotacao_orcamentaria || 0,
        grauPrioridade: catalogoItem.grau_prioridade || "Baixo",
        vinculacao: catalogoItem.vinculacao || "Não",
        dependenciaDescricao: catalogoItem.dependencia_descricao || undefined,
        status: catalogoItem.status || "rascunho",
        observacao: catalogoItem.observacao || "",
        gerencia: gerenciaUpper,
        diretoriaSigla: siglaUpper,
        contrato: catalogoItem.contrato,
        contratada: catalogoItem.contratada,
      } as unknown as ServicoItem;
    });
    
    // Novos Serviços são aqueles criados diretamente pela Gerência (não estão no catálogo)
    const servicosNovos = servicos.filter((s) => !catalogoItemsSet.has(s.item));
    const displayedServicos = selectedOption === "servicos_existentes" ? servicosExistentes : servicosNovos;
    
    const filteredServicos = displayedServicos.filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      const objInitials = item.objeto.split(/\s+/).map(w => w[0]?.toLowerCase() || '').join('');
      const codInitials = item.item.toString().split(/\s+/).map(w => w[0]?.toLowerCase() || '').join('');
      
      const matchesSearch = searchTerm === "" || 
        item.objeto.toLowerCase().includes(searchLower) || 
        item.item.toString().includes(searchLower) ||
        (item.contrato && item.contrato.toLowerCase().includes(searchLower)) ||
        (item.contratada && item.contratada.toLowerCase().includes(searchLower)) ||
        objInitials.includes(searchLower) ||
        codInitials.includes(searchLower);

      const matchesPrioridade = prioridade === "todas" || item.grauPrioridade === prioridade;
      const val = item.estimativaValor || item.dotacaoOrcamentaria || 0;
      const isServicoSentStatus = ["enviado", "em_analise", "aprovado", "rejeitado"].includes(item.status || "rascunho");
      const matchesZerado = !showOnlyZerados || val === 0;
      const matchesComQuantidade = !showOnlyComQuantidade || (val > 0 && !isServicoSentStatus);
      const matchesSent = !showOnlySent || isServicoSentStatus;
      return matchesSearch && matchesPrioridade && matchesZerado && matchesComQuantidade && matchesSent;
    });

    const servicosSummary = {
      totalItens: filteredServicos.length,
      valorTotal: filteredServicos.reduce((acc, s) => acc + (s.estimativaValor || s.dotacaoOrcamentaria || 0), 0)
    };

    const canSendServicos = displayedServicos.some((s) => !isServicoReadOnly(s));
    const servicosEditaveis = filteredServicos.filter((s) => !isServicoReadOnly(s));
    const isAllSent = filteredServicos.length > 0 && filteredServicos.every((s) => isServicoReadOnly(s));

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
      // @ts-ignore
      const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js") as XlsxModule;
      const XLSX = ((xlsxModule.default ?? xlsxModule) as XlsxModule);
      const wb = XLSX.utils.book_new();
      const wsData: unknown[][] = [];
      const titleLabel = selectedOption === "servicos_existentes" ? "Serviços Existentes" : "Novos Serviços";
      const filenameSuffix = selectedOption === "servicos_existentes" ? "Servicos_Existentes" : "Novos_Servicos";
      wsData.push([`Plano Anual de Contratações 2027 — ${titleLabel} — ${gerenciaUpper}`]);
      wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
      wsData.push([]);
      wsData.push(["Item", "Tipo", "Unidade Demandante", "Contrato", "Contratada", "Objeto", "Justificativa", "Previsão Início", "Estimativa Valor", "Grau Prioridade", "Vinculação", "Status"]);
      filteredServicos.forEach((s) => {
        wsData.push([s.item, s.tipoContratacao, s.unidadeDemandante, s.contrato || "", s.contratada || "", s.objeto, s.justificativa || "", s.previsaoInicio || "", s.estimativaValor || 0, s.grauPrioridade, s.vinculacao, s.status || "rascunho"]);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      (ws as Record<string, unknown>)["!cols"] = [{ wch: 6 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 45 }, { wch: 40 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, titleLabel);
      XLSX.writeFile(wb, `PAC_2027_${filenameSuffix}_${gerenciaUpper}_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    const handleExportPDF = () => {
      const doc = new jsPDF({ orientation: "landscape", format: "a4" });
      const titleLabel = selectedOption === "servicos_existentes" ? "Serviços Existentes" : "Novos Serviços";
      const filenameSuffix = selectedOption === "servicos_existentes" ? "Servicos_Existentes" : "Novos_Servicos";
      doc.setFontSize(14);
      doc.text(`PAC 2027 — ${titleLabel} — ${gerenciaUpper}`, 14, 18);
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
      autoTable(doc, {
        head: [["Item", "Tipo", "Contrato", "Contratada", "Objeto", "Estimativa", "Prioridade", "Status"]],
        body: filteredServicos.map((s) => [
          s.item,
          s.tipoContratacao,
          s.contrato || "-",
          s.contratada || "-",
          s.objeto.length > 50 ? s.objeto.substring(0, 50) + "…" : s.objeto,
          formatCurrency(s.estimativaValor),
          s.grauPrioridade,
          s.status || "rascunho",
        ]),
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 250, 246] },
      });
      doc.save(`PAC_2027_${filenameSuffix}_${gerenciaUpper}_${new Date().toISOString().split("T")[0]}.pdf`);
    };

    const ServicosSection = ({ lista, titulo, badge }: { lista: ServicoItem[]; titulo: string; badge?: React.ReactNode }) => {
      const { sortedItems, sortConfig, requestSort } = useSortableTable(lista);
      const valorTotal = lista.reduce((acc, s) => acc + (s.estimativaValor || s.dotacaoOrcamentaria || 0), 0);
      const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
      const startIdx = (currentPageServicos - 1) * ITEMS_PER_PAGE;
      const paginatedLista = sortedItems.slice(startIdx, startIdx + ITEMS_PER_PAGE);

      return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {badge}
        </div>
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-sm font-semibold text-foreground">
              {lista.length} serviço(s) encontrado(s)
            </h2>
            <span className="text-xs text-muted-foreground">
              Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotal)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap lg:whitespace-normal text-sm md:text-base">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 text-left w-10">
                    {(() => {
                      const servicosSelecionaveis = showOnlySent
                        ? paginatedLista.filter(s => Boolean(s.id))
                        : paginatedLista.filter(s => !isServicoReadOnly(s));
                      const allChecked = servicosSelecionaveis.length > 0 && servicosSelecionaveis.every(s => selectedServicos.has(s.item));
                      return (
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedServicos);
                            if (checked) {
                              servicosSelecionaveis.forEach(s => newSet.add(s.item));
                            } else {
                              servicosSelecionaveis.forEach(s => newSet.delete(s.item));
                            }
                            setSelectedServicos(newSet);
                          }}
                          disabled={servicosSelecionaveis.length === 0}
                        />
                      );
                    })()}
                  </th>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-12 cursor-pointer hover:text-foreground" field="item" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Nº
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-24 cursor-pointer hover:text-foreground" field="contrato" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Contrato
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-32 cursor-pointer hover:text-foreground" field="contratada" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Contratada
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="objeto" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Objeto
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="justificativa" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Justificativa
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-36 cursor-pointer hover:text-foreground" field="grauPrioridade" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Prioridade
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-right text-xs font-medium text-muted-foreground w-32 cursor-pointer hover:text-foreground" field="estimativaValor" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Estimativa (R$)
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-28 cursor-pointer hover:text-foreground" field="vinculacao" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Vinculação
                  </SortableTableHead>
                  <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-24 cursor-pointer hover:text-foreground" field="status" sortConfig={sortConfig} onRequestSort={requestSort}>
                    Status
                  </SortableTableHead>
                  <th className="p-3 text-center text-xs font-medium text-muted-foreground w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLista.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-6 text-muted-foreground text-sm">
                      Nenhum serviço nesta seção.
                    </td>
                  </tr>
                ) : (
                  paginatedLista.map((servico, index) => {
                    const isServicoLocked = isServicoReadOnly(servico);
                    const isCurrentValorBlocked = (selectedOption === "servicos_novos" ? isValorServicosNovosBlocked : isValorServicosExistentesBlocked) || isPeriodExpired;
                    const isCurrentDevolverBlocked = (selectedOption === "servicos_novos" ? isDevolverServicosNovosBlocked : isDevolverServicosExistentesBlocked) || isPeriodExpired;
                    const isCurrentExcluirBlocked = isExcluirAquisicaoBlocked || isPeriodExpired;
                    const isEditDisabled = isServicoLocked || isCurrentValorBlocked;
                    const isSelectable = showOnlySent ? Boolean(servico.id) : !isServicoLocked;
                    return (
                      <tr
                        key={servico.id || index}
                        className={`border-b ${isServicoLocked && !showOnlySent ? "opacity-80" : "hover:bg-muted/20"} ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedServicos.has(servico.item)}
                            onCheckedChange={() => isSelectable && toggleSelectServico(servico.item)}
                            disabled={!isSelectable}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono text-muted-foreground">{servico.item}</td>
                        <td className="p-3 text-sm font-medium text-muted-foreground whitespace-nowrap">{servico.contrato || "-"}</td>
                        <td className="p-3 text-sm font-medium text-muted-foreground whitespace-nowrap">{servico.contratada || "-"}</td>
                        <td className="p-3 text-sm max-w-xs" title={servico.objeto}>
                          <p className="font-medium line-clamp-2">{servico.objeto}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {servico.tipoContratacao} · {servico.unidadeDemandante}
                          </p>
                        </td>
                        <td className="p-3 text-sm">
                          {isEditDisabled ? (
                            <p className="text-xs text-muted-foreground line-clamp-3">{servico.justificativa || "—"}</p>
                          ) : (
                            <textarea
                              key={`${servico.item}-${servico.justificativa}`}
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
                          {isEditDisabled ? (
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
                                {(["Baixo", "Médio", "Alto"] as GrauPrioridade[]).map((p) => (
                                  <SelectItem key={p} value={p}>
                                    <Badge variant={getPrioridadeBadgeVariant(p)}>{p}</Badge>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-sm">{formatCurrency(servico.estimativaValor)}</span>
                        </td>
                        <td className="p-3">
                          {isEditDisabled ? (
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
                        <td className="p-3 text-right">
                          {!isServicoLocked ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openServicoEditor(servico)}
                                disabled={isEditDisabled}
                                title={isEditDisabled ? "Edição bloqueada pelo administrador" : "Editar serviço"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {selectedOption === "servicos_novos" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  disabled={isCurrentExcluirBlocked}
                                  onClick={() => handleDeleteServico(servico.id, servico.item)}
                                  title={isCurrentExcluirBlocked ? "Exclusão bloqueada pelo administrador" : "Excluir serviço"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ) : servico.status === "enviado" && servico.id ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-500"
                              disabled={isCurrentDevolverBlocked}
                              onClick={() => handleDevolverServico(servico.id!)}
                              title={isCurrentDevolverBlocked ? "Devolução bloqueada pelo administrador" : "Devolver serviço para Rascunho"}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {totalPages > 1 && (
          <div className="py-4">
            <SmartPagination
              currentPage={currentPageServicos}
              totalPages={totalPages}
              onPageChange={setCurrentPageServicos}
              totalItems={lista.length}
            />
          </div>
        )}
      </div>
    );
  };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0" style={{ top: "200px" }}>
          <img src="/assets/images/caema-logo.png" alt="CAEMA" className="w-full max-w-3xl opacity-[0.08]" />
        </div>
        <div className="relative z-10">
          {/* Top Bar */}
          <PageBreadcrumb
            onBack={() => setSelectedOption("servicos")}
            onHome={() => navigate("/")}
            crumbs={[
              { label: gerenciaUpper, onClick: () => setSelectedOption(null) },
              { label: "Serviços", onClick: () => setSelectedOption("servicos") },
              { label: selectedOption === "servicos_existentes" ? "Serviços Existentes" : "Novos Serviços", isActive: true },
            ]}
            rightContent={isAllSent ? (
              <Badge className="bg-info text-info-foreground text-sm gap-1 py-2 px-4">
                <Eye className="h-4 w-4" /> Somente leitura
              </Badge>
            ) : undefined}
          />

          <PlanHeader
            title={`Painel da Gerência - ${selectedOption === "servicos_existentes" ? "Serviços Existentes" : "Novos Serviços"}`}
            diretoria={`${diretoria.sigla} / ${gerenciaUpper} - ${gerenciaNome}`}
            ano={2027}
            prazo={prazo}
          />

          <SummaryCards totalItens={servicosSummary.totalItens} valorTotal={servicosSummary.valorTotal} />

          <BudgetConsumptionCard
            titulo={`Orçamento da Diretoria ${diretoria?.sigla} (${selectedOption === "servicos_existentes" ? "serviços existentes" : "novos serviços"})`}
            orcamento={selectedOption === "servicos_existentes" ? orcamentoDiretoriaServicosExistentes : orcamentoDiretoriaServicosNovos}
            gasto={selectedOption === "servicos_existentes" ? gastoServicosExistentes : gastoServicosNovos}
          />

          <div className="px-6 pb-2 pt-4 flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-2">
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
                {showOnlyZerados ? "Mostrando apenas serviços zerados" : "Filtrar serviços zerados"}
              </Button>
              <Button
                variant={showOnlyComQuantidade ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  const next = !showOnlyComQuantidade;
                  setShowOnlyComQuantidade(next);
                  if (next) {
                    setShowOnlyZerados(false);
                    setShowOnlySent(false);
                  }
                }}
              >
                {showOnlyComQuantidade ? "Mostrando apenas serviços com valor" : "Filtrar serviços com valor"}
              </Button>
              <Button
                variant={showOnlySent ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  const next = !showOnlySent;
                  setShowOnlySent(next);
                  if (next) {
                    setShowOnlyZerados(false);
                    setShowOnlyComQuantidade(false);
                  }
                }}
              >
                <Send className="h-4 w-4" />
                {showOnlySent ? "Mostrando apenas enviados" : "Filtrar enviados"}
              </Button>
              {showOnlySent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-amber-600 border-amber-400 hover:bg-amber-50"
                  onClick={() => {
                    const ids = filteredServicos
                      .filter(s => s.id && selectedServicos.has(s.item))
                      .map(s => s.id!);
                    handleDevolverTodosServico(ids);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Devolver Todos ({filteredServicos.filter(s => s.id && selectedServicos.has(s.item)).length})
                </Button>
              )}
              {canSendServicos && (
                <>
                  {selectedOption === "servicos_novos" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                      onClick={handleBulkDeleteServicos}
                      disabled={selectedServicos.size === 0}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir Selecionados
                    </Button>
                  )}
                  {(() => {
                    const isCurrentSendBlocked = selectedOption === "servicos_novos" ? isSendServicosNovosBlocked : isSendServicosExistentesBlocked;
                    return (
                      <Button
                        size="sm"
                        className={`gap-2 ${isCurrentSendBlocked ? "opacity-60 cursor-not-allowed bg-slate-400 hover:bg-slate-400" : ""}`}
                        onClick={() => {
                          if (isCurrentSendBlocked) {
                            toast({
                              title: "🔒 Ação Bloqueada",
                              description:
                                getBlockReason(
                                  selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes",
                                  "enviar_solicitacao"
                                ) || "O envio de serviços está temporariamente bloqueado pelo administrador para a sua gerência neste período.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setConfirmSendServicosOpen(true);
                        }}
                        disabled={selectedServicos.size === 0 || isCurrentSendBlocked}
                      >
                        {isCurrentSendBlocked ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                        Enviar para Diretoria ({selectedServicos.size})
                      </Button>
                    );
                  })()}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportExcel}
                disabled={filteredServicos.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4" />Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportPDF}
                disabled={filteredServicos.length === 0}
              >
                <FileDown className="h-4 w-4" />PDF
              </Button>
            </div>
          </div>

          {/* Banner de restrição de serviços */}
          {((selectedOption === "servicos_novos" && isSendServicosNovosBlocked) ||
            (selectedOption === "servicos_existentes" && isSendServicosExistentesBlocked)) && (
            <div className="mx-6 mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-900 text-sm shadow-sm">
              <div className="p-2 bg-red-100 rounded-lg shrink-0">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-red-800">Envio de Serviços Bloqueado</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {getBlockReason(
                    selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes",
                    "enviar_solicitacao"
                  ) || "O envio de solicitações de serviços está temporariamente bloqueado pelo administrador para a sua gerência neste período."}
                </p>
              </div>
            </div>
          )}

          <PlanFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            categoria={categoria}
            onCategoriaChange={setCategoria}
            prioridade={prioridade}
            onPrioridadeChange={setPrioridade}
            categorias={[]}
            hideCategoriaFilter={true}
            searchPlaceholder="Pesquisar por código, descrição, contrato e contratada"
          />

          {/* Ações gerais */}
          {(searchTerm.trim() !== "" || showOnlyComQuantidade || showOnlyZerados || showOnlySent || selectedServicos.size > 0) && (
            <div className="px-6 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const servicosSelecionaveisGeral = showOnlySent
                    ? filteredServicos.filter(s => Boolean(s.id))
                    : servicosEditaveis;
                  if (servicosSelecionaveisGeral.length === 0) return null;
                  return (
                    <>
                      <Checkbox
                        checked={servicosSelecionaveisGeral.length > 0 && servicosSelecionaveisGeral.every(s => selectedServicos.has(s.item))}
                        onCheckedChange={() => toggleSelectAllServicos(servicosSelecionaveisGeral)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedServicos.size > 0 ? `${selectedServicos.size} selecionado(s)` : "Selecionar todos"}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tabelas */}
          <div className="px-6 py-6">
            {isServicosLoading && displayedServicos.length === 0 ? (
              <div className="px-6 py-12 text-center text-muted-foreground">
                <div className="inline-flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-base font-medium">Carregando serviços...</p>
                </div>
              </div>
            ) : searchTerm.trim() === "" && !showOnlyComQuantidade && !showOnlyZerados && !showOnlySent ? (
              <div className="px-6 py-12 text-center">
                <div className="inline-flex flex-col items-center gap-3 text-muted-foreground">
                  <span className="text-5xl">🔍</span>
                  <p className="text-base font-medium">Digite o código ou descrição para buscar serviços</p>
                  <p className="text-sm">Sua gerência possui {displayedServicos.length} serviços planejados nesta aba</p>
                </div>
              </div>
            ) : filteredServicos.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">
                {searchTerm.trim() !== ""
                  ? `Nenhum serviço encontrado para "${searchTerm}".`
                  : showOnlyComQuantidade
                  ? "Nenhum serviço com valor estimado encontrado nesta gerência."
                  : showOnlySent
                  ? "Nenhum serviço enviado encontrado nesta gerência."
                  : showOnlyZerados
                  ? "Nenhum serviço zerado encontrado nesta gerência."
                  : "Nenhum serviço encontrado para os filtros selecionados."}
              </div>
            ) : (
              <>
                {selectedOption === "servicos_existentes" && (
                  <ServicosSection
                    lista={filteredServicos}
                    titulo="Serviços Existentes"
                    badge={<Badge variant="secondary" className="text-xs">Contratos vigentes / renovações</Badge>}
                  />
                )}

                {selectedOption === "servicos_novos" && (
                  filteredServicos.length > 0 ? (
                    <ServicosSection
                      lista={filteredServicos}
                      titulo="Novas Contratações"
                      badge={<Badge variant="outline" className="text-xs bg-green-50 text-green-700">Novos serviços adicionados</Badge>}
                    />
                  ) : null
                )}
              </>
            )}

            {/* Botão Novo Serviço — na parte de baixo apenas para novos serviços */}
            {selectedOption === "servicos_novos" && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  className={`gap-2 border-dashed ${
                    isAddServicosNovosBlocked
                      ? "border-slate-300 text-slate-400 cursor-not-allowed hover:bg-transparent"
                      : "border-green-400 text-green-700 hover:bg-green-50"
                  }`}
                  disabled={isAddServicosNovosBlocked}
                  onClick={() => {
                    if (isAddServicosNovosBlocked) {
                      toast({
                        title: "🔒 Ação Bloqueada",
                        description:
                          getBlockReason("servicos_novos", "adicionar_novo_servico") ||
                          "A criação de novos serviços está temporariamente bloqueada para o período atual.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setNovoServicoOpen(true);
                  }}
                >
                  {isAddServicosNovosBlocked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Adicionar Novo Serviço
                </Button>
              </div>
            )}
          </div>

          {/* Dialog Novo Serviço */}
          <Dialog open={novoServicoOpen} onOpenChange={setNovoServicoOpen}>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Contrato</label>
                    <input
                      type="text"
                      value={novoServicoForm.contrato}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, contrato: formatContratoMask(e.target.value) }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      placeholder="Ex: 028/2021"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contratada</label>
                    <input
                      type="text"
                      value={novoServicoForm.contratada || ""}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, contratada: e.target.value }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      placeholder="Nome da empresa contratada"
                    />
                  </div>
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
                      <option value="Contínuo">Contínuo</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Unidade Demandante</label>
                  <input
                    type="text"
                    value={gerenciaUpper}
                    disabled
                    className="w-full mt-1 text-sm border rounded px-3 py-2 bg-muted text-muted-foreground cursor-not-allowed"
                  />
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
                    <CurrencyInput
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
                      <SelectItem value="Baixo">Baixo</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Alto">Alto</SelectItem>
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
                {!novoServicoLoading ? (
                  <Button
                    onClick={handleCriarServico}
                    disabled={!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim()}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Serviço
                  </Button>
                ) : (
                  <Button disabled className="gap-2 opacity-50 cursor-not-allowed">
                    Salvando...
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog Confirmação Envio Serviços */}
          <Dialog open={confirmSendServicosOpen} onOpenChange={setConfirmSendServicosOpen}>
            <DialogContent className="w-[95vw] sm:max-w-md">
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
                <Button variant="outline" disabled={isSendingServicos} onClick={() => setConfirmSendServicosOpen(false)}>Cancelar</Button>
                <Button onClick={handleSendServicosToDir} disabled={isSendingServicos} className="gap-2">
                  {isSendingServicos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSendingServicos ? "Enviando..." : "Confirmar Envio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <ServicoEditDialog
            open={servicoEditOpen}
            onOpenChange={setServicoEditOpen}
            servico={servicoEdicao}
            onSave={async (item, updates) => {
              try {
                if (servicoEdicao?.id) {
                  await updateServico(servicoEdicao.id, updates);
                } else {
                  await ensureServico(item, updates);
                }
                await queryClient.invalidateQueries({ queryKey: ["servicos"] });
                await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
                setServicoEditOpen(false);
                setServicoEdicao(null);
                toast({ title: "Serviço atualizado", description: "Informações do serviço salvas." });
              } catch (error: any) {
                console.error("Erro ao atualizar serviço:", error);
                toast({ title: "Erro ao atualizar", description: error?.message || "Falha ao salvar serviço.", variant: "destructive" });
              }
            }}
            diretoriaLabel={diretoria?.sigla ? `${diretoria.sigla} - ${diretoria.nome}` : undefined}
            gerenciaLabel={gerenciaAtual?.sigla ? `${gerenciaAtual.sigla} - ${gerenciaAtual.nome}` : undefined}
          />
          
        </div>
      </div>
    );
  }
  if (isPeriodExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative flex items-center justify-center p-4 z-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border max-w-lg w-full text-center relative z-10">
          <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Período Encerrado</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">O prazo para o preenchimento do Plano Anual de Contratações foi encerrado. Não é mais possível acessar ou modificar as solicitações.</p>
          <Button onClick={() => navigate("/")} className="w-full text-base h-12" size="lg">Voltar para a Página Inicial</Button>
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
      <PageBreadcrumb
        onBack={() => setSelectedOption(null)}
        onHome={() => navigate("/")}
        crumbs={[
          { label: gerenciaUpper, onClick: () => setSelectedOption(null) },
          { label: "Aquisição", isActive: true },
        ]}
        rightContent={
          <>
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
          </>
        }
      />

      <PlanHeader
        title="Painel da Gerência"
        diretoria={`${diretoria.sigla} / ${gerenciaUpper} - ${gerenciaNome}`}
        ano={2027}
        prazo={prazo}
      />

      <SummaryCards totalItens={summary.totalItens} valorTotal={summary.valorTotal} />

      <BudgetConsumptionCard
        titulo={`Orçamento da Diretoria ${diretoria?.sigla} (aquisição)`}
        orcamento={orcamentoDiretoriaAquisicao}
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

      <div className="px-6 pb-2 flex flex-wrap justify-between items-center gap-2">
        <div className="flex flex-wrap gap-2">
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
              if (next) {
                setShowOnlyZerados(false);
                setShowOnlySent(false);
              }
            }}
          >
            {showOnlyComQuantidade ? "Mostrando apenas itens com quantidade" : "Filtrar itens com quantidade"}
          </Button>
          <Button
            variant={showOnlySent ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => {
              const next = !showOnlySent;
              setShowOnlySent(next);
              if (next) {
                setShowOnlyZerados(false);
                setShowOnlyComQuantidade(false);
              }
            }}
          >
            <Send className="h-4 w-4" />
            {showOnlySent ? "Mostrando apenas enviados" : "Filtrar enviados"}
          </Button>
          {showOnlySent && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-amber-600 border-amber-400 hover:bg-amber-50"
              onClick={() => {
                const ids = filteredItems
                  .filter(i => i.id && selectedAquisicaoIds.has(i.id))
                  .map(i => i.id!);
                handleDevolverTodosAquisicao(ids);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Devolver Todos ({filteredItems.filter(i => i.id && selectedAquisicaoIds.has(i.id)).length})
            </Button>
          )}
          {hasRascunhoItems && (
            <Button
              size="sm"
              className={`gap-2 ${isSendAquisicaoBlocked ? "opacity-60 cursor-not-allowed bg-slate-400 hover:bg-slate-400" : ""}`}
              disabled={!canSend || selectedAquisicaoIds.size === 0 || isSendAquisicaoBlocked}
              onClick={() => {
                if (isSendAquisicaoBlocked) {
                  toast({
                    title: "🔒 Ação Bloqueada",
                    description:
                      getBlockReason("aquisicao", "enviar_solicitacao") ||
                      "O envio de solicitações está temporariamente bloqueado pelo administrador para a sua gerência neste período.",
                    variant: "destructive",
                  });
                  return;
                }
                setConfirmSendOpen(true);
              }}
            >
              {isSendAquisicaoBlocked ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Enviar ({selectedAquisicaoIds.size})
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportAquisicaoExcel}
            disabled={filteredItems.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportAquisicaoPDF}
            disabled={filteredItems.length === 0}
          >
            <FileDown className="h-4 w-4" />PDF
          </Button>
        </div>
      </div>

      {/* Banner de restrição de aquisição */}
      {isSendAquisicaoBlocked && (
        <div className="mx-6 mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-900 text-sm shadow-sm">
          <div className="p-2 bg-red-100 rounded-lg shrink-0">
            <Lock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-red-800">Envio de Solicitações Bloqueado</p>
            <p className="text-xs text-red-700 mt-0.5">
              {getBlockReason("aquisicao", "enviar_solicitacao") ||
                "A atividade 'Enviar solicitação' está temporariamente bloqueada para sua gerência neste período. Entre em contato com o administrador caso necessário."}
            </p>
          </div>
        </div>
      )}

      <PlanFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoria={categoria}
        onCategoriaChange={setCategoria}
        prioridade={prioridade}
        onPrioridadeChange={setPrioridade}
        categorias={categoriasDisponiveis}
      />
      {/* Resultados da busca — só mostra quando o usuário digitar algo, ou se ativar um dos filtros específicos */}
      {isAquisicaoLoading && items.length === 0 ? (
        <div className="px-6 py-12 text-center text-muted-foreground">
          <div className="inline-flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-base font-medium">Carregando itens do planejamento...</p>
          </div>
        </div>
      ) : searchTerm.trim() === "" && !showOnlyComQuantidade && !showOnlyZerados && !showOnlySent ? (
        <div className="px-6 py-12 text-center">
          <div className="inline-flex flex-col items-center gap-3 text-muted-foreground">
            <span className="text-5xl">🔍</span>
            <p className="text-base font-medium">Digite o código ou descrição para buscar itens</p>
            <p className="text-sm">Sua gerência possui {items.length} solicitações planejadas</p>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground">
          {searchTerm.trim() !== ""
            ? `Nenhum item encontrado para "${searchTerm}".`
            : showOnlyComQuantidade
            ? "Nenhum item com quantidade preenchida encontrado nesta gerência."
            : showOnlySent
            ? "Nenhum item enviado encontrado nesta gerência."
            : showOnlyZerados
            ? "Nenhum item zerado encontrado para os filtros selecionados."
            : "Nenhum item encontrado para os filtros selecionados."}
        </div>
      ) : (
        <div className="px-6 pb-6">
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-sm font-semibold text-foreground">
                {filteredItems.length} item(ns) encontrado(s)
              </h2>
              <span className="text-xs text-muted-foreground">
                Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  filteredItems.reduce((acc, i) => acc + i.qtdEstimada * i.valorUnitario, 0)
                )}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap lg:whitespace-normal text-sm md:text-base">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 text-left w-10">
                      {(() => {
                        const selectableItems = showOnlySent
                          ? paginationData.paginatedItems.filter(i => Boolean(i.id))
                          : paginationData.paginatedItems.filter(i => (i.status === "rascunho" || i.status === "rejeitado") && Boolean(i.id));
                        const allSelectableChecked = selectableItems.length > 0 && selectableItems.every(i => selectedAquisicaoIds.has(i.id!));
                        return (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={allSelectableChecked}
                            onChange={(e) => {
                              const newSet = new Set(selectedAquisicaoIds);
                              if (e.target.checked) {
                                selectableItems.forEach(i => {
                                  if (i.id) newSet.add(i.id);
                                });
                              } else {
                                selectableItems.forEach(i => {
                                  if (i.id) newSet.delete(i.id);
                                });
                              }
                              setSelectedAquisicaoIds(newSet);
                            }}
                            disabled={selectableItems.length === 0}
                          />
                        );
                      })()}
                    </th>
                    <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground w-16 cursor-pointer hover:text-foreground" field="codigo" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Código
                    </SortableTableHead>
                    <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="descricao" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Descrição
                    </SortableTableHead>
                    <SortableTableHead className="p-3 text-center text-xs font-medium text-muted-foreground w-20 cursor-pointer hover:text-foreground" field="unidade" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Unid.
                    </SortableTableHead>
                    <SortableTableHead className="p-3 text-center text-xs font-medium text-muted-foreground w-24 cursor-pointer hover:text-foreground" field="qtdEstimada" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Quantidade
                    </SortableTableHead>
                    <SortableTableHead className="p-3 text-right text-xs font-medium text-muted-foreground w-28 cursor-pointer hover:text-foreground" field="valorUnitario" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Valor Unit.
                    </SortableTableHead>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground w-28">Total Item</th>
                    <SortableTableHead className="p-3 text-center text-xs font-medium text-muted-foreground w-28 cursor-pointer hover:text-foreground" field="prioridade" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Prioridade
                    </SortableTableHead>
                    <SortableTableHead className="p-3 text-center text-xs font-medium text-muted-foreground w-20 cursor-pointer hover:text-foreground" field="gerencia" sortConfig={itemsSortConfig} onRequestSort={requestItemsSort}>
                      Gerência
                    </SortableTableHead>
                    <th className="p-3 text-center text-xs font-medium text-muted-foreground w-28">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginationData.paginatedItems.map((item, idx) => {
                    const isItemLocked = item.status !== "rascunho" && item.status !== "rejeitado";
                    const isQtyDisabled = isItemLocked || isQtdAquisicaoBlocked || isPeriodExpired;
                    const isPriorityDisabled = isItemLocked || isPrioridadeAquisicaoBlocked || isPeriodExpired;
                    const isEditDisabled = isItemLocked || isQtdAquisicaoBlocked || isPeriodExpired;
                    const isSelectable = showOnlySent
                      ? Boolean(item.id)
                      : Boolean(item.id && (item.status === "rascunho" || item.status === "rejeitado"));
                    return (
                      <tr key={item.id ?? `item-${item.codigo}-${idx}`} className={`border-b hover:bg-muted/30 ${idx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={Boolean(item.id && selectedAquisicaoIds.has(item.id))}
                            disabled={!isSelectable}
                            onChange={(e) => {
                              if (!isSelectable || !item.id) return;
                              const newSet = new Set(selectedAquisicaoIds);
                              if (e.target.checked) newSet.add(item.id);
                              else newSet.delete(item.id);
                              setSelectedAquisicaoIds(newSet);
                            }}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono text-primary">{item.codigo}</td>
                        <td className="p-3 text-sm max-w-md" title={item.descricao}>
                          <p className="font-medium line-clamp-2">{item.descricao}</p>
                          <p className="text-xs text-primary">{item.categoria}</p>
                          {item.observacao && (
                            <p className="text-xs text-success mt-1">💬 {item.observacao}</p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">{item.unidade}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          {isQtyDisabled ? (
                            <span className="text-sm font-medium">{item.qtdEstimada}</span>
                          ) : (
                            <input
                              key={`${item.codigo}-${item.qtdEstimada}`}
                              type="number"
                              min="0"
                              defaultValue={item.qtdEstimada === 0 ? "" : item.qtdEstimada}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                if (val !== item.qtdEstimada) {
                                  handleUpdateQtdEstimada(item.codigo, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-20 h-8 text-center text-sm border rounded px-2 bg-background"
                            />
                          )}
                        </td>
                        <td className="p-3 text-right text-sm">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valorUnitario)}
                        </td>
                        <td className="p-3 text-right text-sm font-semibold text-primary">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.qtdEstimada * item.valorUnitario)}
                        </td>
                        <td className="p-3 text-center">
                          {isPriorityDisabled ? (
                            <Badge variant={getPrioridadeBadgeVariant(item.prioridade) as any}>{item.prioridade}</Badge>
                          ) : (
                            <Select value={item.prioridade} onValueChange={(v) => handleUpdatePrioridade(item.codigo, v as PlanItem["prioridade"])}>
                              <SelectTrigger className="h-8 w-[90px] mx-auto border-none bg-transparent p-0 justify-center">
                                <Badge variant={getPrioridadeBadgeVariant(item.prioridade) as any} className="cursor-pointer">{item.prioridade}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Baixa">Baixa</SelectItem>
                                <SelectItem value="Média">Média</SelectItem>
                                <SelectItem value="Alta">Alta</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline">{item.gerencia}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            {(item.status === "rascunho" || item.status === "rejeitado") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={isEditDisabled ? "Edição bloqueada pelo administrador" : "Editar item"}
                                disabled={isEditDisabled}
                                onClick={() => openSolicitacaoEditor(item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status === "enviado" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-500"
                                title={isDevolverAquisicaoBlocked || isPeriodExpired ? "Devolução bloqueada pelo administrador" : "Devolver item para Rascunho"}
                                disabled={!item.id || isDevolverAquisicaoBlocked || isPeriodExpired}
                                onClick={() => item.id && handleDevolverAquisicao(item.id)}
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Badge variant={item.status === "enviado" || item.status === "em_analise" ? "secondary" : item.status === "aprovado" ? "success" : "outline"} className="text-xs">
                              {item.status === "rascunho" ? "Rascunho" : item.status === "enviado" ? "Enviado" : item.status === "aprovado" ? "Aprovado" : item.status}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {paginationData.totalPages > 1 && (
            <div className="py-4">
              <SmartPagination
                currentPage={currentPage}
                totalPages={paginationData.totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredItems.length}
              />
            </div>
          )}
        </div>
      )}


      {/* Confirm Send Dialog */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Envio</DialogTitle>
            <DialogDescription>
              Ao enviar, os itens serão bloqueados para edição até que a diretoria
              analise e aprove ou rejeite. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p><strong>{selectedAquisicaoIds.size}</strong> itens serão enviados para análise orçamentária.</p>
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
            {items.filter(i => (i.qtdEstimada === 0 || i.status !== "rascunho") && i.id && selectedAquisicaoIds.has(i.id)).length > 0 && (
              <p className="text-muted-foreground mt-2 text-xs">
                ({items.filter(i => (i.qtdEstimada === 0 || i.status !== "rascunho") && i.id && selectedAquisicaoIds.has(i.id)).length} itens selecionados não podem ser enviados)
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={isSendingAquisicao} onClick={() => setConfirmSendOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendToDiretoria} disabled={isSendingAquisicao} className="gap-2">
              {isSendingAquisicao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSendingAquisicao ? "Enviando..." : "Confirmar Envio"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <BulkEditAquisicaoDialog 
        open={bulkEditAquisicaoOpen} 
        onOpenChange={setBulkEditAquisicaoOpen} 
        selectedCount={selectedAquisicaoIds.size} 
        onConfirm={handleBulkEditAquisicao} 
        isUpdating={isBulkUpdating} 
      />
      <BulkEditServicosDialog 
        open={bulkEditServicosOpen} 
        onOpenChange={setBulkEditServicosOpen} 
        selectedCount={selectedServicos.size} 
        onConfirm={handleBulkEditServicos} 
        isUpdating={isBulkUpdating} 
      />

      <ServicoEditDialog
        open={servicoEditOpen}
        onOpenChange={setServicoEditOpen}
        servico={servicoEdicao}
        onSave={async (item, updates) => {
          try {
            if (servicoEdicao?.id) {
              await updateServico(servicoEdicao.id, updates);
            } else {
              await ensureServico(item, updates);
            }
            await queryClient.invalidateQueries({ queryKey: ["servicos"] });
            await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
            setServicoEditOpen(false);
            setServicoEdicao(null);
            toast({ title: "Serviço atualizado", description: "Informações do serviço salvas." });
          } catch (error: any) {
            console.error("Erro ao atualizar serviço:", error);
            toast({ title: "Erro ao atualizar", description: error?.message || "Falha ao salvar serviço.", variant: "destructive" });
          }
        }}
        diretoriaLabel={diretoria?.sigla ? `${diretoria.sigla} - ${diretoria.nome}` : undefined}
        gerenciaLabel={gerenciaAtual?.sigla ? `${gerenciaAtual.sigla} - ${gerenciaAtual.nome}` : undefined}
      />

      <AquisicaoEditDialog
        open={solicitacaoEditOpen}
        onOpenChange={setSolicitacaoEditOpen}
        aquisicao={solicitacaoEdicao}
        onSave={handleSaveSolicitacaoEdicao}
      />
      </div>
    </div>
  );
};

export default GerenciaPanel;
