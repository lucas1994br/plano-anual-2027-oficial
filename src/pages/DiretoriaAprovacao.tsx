import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Plus, Home, Check, X, Send, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AccessCodeScreen } from "@/components/ui/AccessCodeScreen";
import { PlanItem, SolicitacaoStatus, ServicoItem, GrauPrioridade } from "@/types/plan";
import { getAdminMiniErpConfigDb, getCategoryBudgetOwnerRules, getDiretorias, getSolicitacoesByDiretoria, getPeriodosAtivos, getGerenciasByDiretoria, updateSolicitacaoStatus, updateSolicitacao, createSolicitacao, getItensCatalogo, getServicosByDiretoria, updateServico, createServico } from "@/lib/services";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SummaryCards } from "@/components/common/SummaryCards";
import { PlanFilters } from "@/components/forms/PlanFilters";
import { PlanTable } from "@/components/tables/PlanTable";
import { ServicosTable } from "@/components/tables/ServicosTable";
import { BudgetConsumptionCard } from "@/components/features/orcamento/BudgetConsumptionCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getBudgetOwnerDiretoriaId, getDiretoriaBudget, loadAdminBudgetConfig } from "@/lib/adminBudgetConfig";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

import DOMPurify from 'dompurify';
// Mapeamento de ícones por sigla
const getIconPath = (sigla: string) => {
  const iconMap: Record<string, string> = {
    'DC': '/assets/images/dc2.png',
    'DE': '/assets/images/de2.png',
    'DG': '/assets/images/gd2.png',
    'DO': '/assets/images/do2.png',
    'PR': '/assets/images/pr2.png'
  };
  return iconMap[sigla] || null;
};

const DiretoriaAprovacao = () => {
  const { sigla } = useParams<{ sigla: string }>();
  const navigate = useNavigate();
  const siglaUpper = (sigla || "").toUpperCase();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [authenticated, setAuthenticated] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | null>(null);
  const [approvalTab, setApprovalTab] = useState<"aquisicao" | "servicos" | null>(null);
  const [ownSearchTerm, setOwnSearchTerm] = useState("");
  const [ownCategoria, setOwnCategoria] = useState("");
  const [ownPrioridade, setOwnPrioridade] = useState("todas");
  const [ownGerenciaId, setOwnGerenciaId] = useState<string>("diretoria");
  const [selectedGerencia, setSelectedGerencia] = useState<string>("todas");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedServicos, setSelectedServicos] = useState<Set<string>>(new Set());
  const [expandedJustificativas, setExpandedJustificativas] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<PlanItem | null>(null);
  const [selectedGerenciaId, setSelectedGerenciaId] = useState<string>("");
  const [addQtd, setAddQtd] = useState<number>(1);
  const [addPrioridade, setAddPrioridade] = useState<PlanItem["prioridade"]>("Média");
  const [addObservacao, setAddObservacao] = useState("");
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ownCurrentPage, setOwnCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "aprovar" | "rejeitar" | null;
    isBulk: boolean;
  }>({ open: false, action: null, isBulk: false });
  const [justificativa, setJustificativa] = useState("");
  const [actionServicosDialog, setActionServicosDialog] = useState<{
    open: boolean;
    action: "aprovar" | "rejeitar" | "enviar_compras" | null;
  }>({ open: false, action: null });
  const [confirmComprasOpen, setConfirmComprasOpen] = useState(false);

  // Estado do dialog de novo serviço da diretoria
  const [novoServicoOpen, setNovoServicoOpen] = useState(false);
  const [novoServicoLoading, setNovoServicoLoading] = useState(false);
  const [novoServicoForm, setNovoServicoForm] = useState({
    objeto: "",
    justificativa: "",
    tipoContratacao: "Novo",
    gerenciaId: "",
    previsaoInicio: "",
    estimativaValor: "",
    dotacaoOrcamentaria: "",
    grauPrioridade: "Médio" as GrauPrioridade,
    vinculacao: "Não" as "Sim" | "Não",
    dependenciaDescricao: "",
  });

  // Buscar diretorias
  const { data: diretorias = [], isLoading: isDiretoriasLoading, isError: isDiretoriasError } = useQuery({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const diretoria = diretorias.find((d: any) => d.sigla === siglaUpper);

  // Buscar gerências desta diretoria
  const { data: gerenciasData = [] } = useQuery({
    queryKey: ["gerencias", diretoria?.id],
    queryFn: () => diretoria ? getGerenciasByDiretoria(diretoria.id) : [],
    enabled: !!diretoria,
    staleTime: 5 * 60 * 1000,
  });

  // Criar mapa de gerencia_id -> sigla
  const gerenciaMap = useMemo(() => {
    const map: Record<string, string> = {};
    gerenciasData.forEach((g: any) => {
      map[g.id] = g.sigla;
    });
    return map;
  }, [gerenciasData]);

  // Criar mapa de sigla -> nome de gerência
  const siglaToNome = useMemo(() => {
    const map: Record<string, string> = {};
    gerenciasData.forEach((g: any) => {
      map[g.sigla] = g.nome;
    });
    return map;
  }, [gerenciasData]);

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

  // Buscar solicitações para esta diretoria
  // Busca os itens da própria diretoria (por diretoria_id) garantindo que apareçam
  // independentemente de regras de roteamento orçamentário
  // Pré-carrega solicitações assim que diretoria + período estão disponíveis
  // (não aguarda selectedOption para evitar atraso após autenticação)
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id],
    queryFn: () => (diretoria && periodAtivo) ? getSolicitacoesByDiretoria(diretoria.id, periodAtivo.id) : [],
    enabled: !!diretoria && !!periodAtivo,
    staleTime: 2 * 60 * 1000,
  });


  console.log("authenticated:", authenticated);
  console.log("selectedOption:", selectedOption);
  console.log("diretoria:", diretoria);
  console.log("periodAtivo:", periodAtivo);

  // Buscar serviços para esta diretoria (pré-carrega em paralelo com solicitações)
  const { data: servicosData = [], isFetching: isServicosLoading } = useQuery({
    queryKey: ["servicos-diretoria", diretoria?.id, periodAtivo?.id],
    queryFn: () => (diretoria && periodAtivo) ? getServicosByDiretoria(diretoria.id, periodAtivo.id) : [],
    enabled: authenticated && selectedOption === "servicos" && !!diretoria && !!periodAtivo,
    staleTime: 0,
    refetchOnMount: true,
  });

  console.log("SERVICOS CARREGADOS:", servicosData);

  // Buscar itens do catalogo (banco)
  const { data: catalogoData = [] } = useQuery({
    queryKey: ["itens-catalogo"],
    queryFn: getItensCatalogo,
    enabled: authenticated && selectedOption === "aquisicao",
    staleTime: 10 * 60 * 1000,
  });

  const orcamentoConfig = useMemo(() => {
    const localConfig = loadAdminBudgetConfig();
    const dbConfig = adminMiniConfigFromDb as any;

    if (!localConfig && !dbConfig) return null;

    return {
      ...(localConfig || {}),
      ...(dbConfig || {}),
      routingRules: dbConfig?.routingRules || localConfig?.routingRules || {},
      categoryBudgetOwners: localConfig?.categoryBudgetOwners || {},
    };
  }, [diretoria?.id, adminMiniConfigFromDb]);
  const diretoriaMap = useMemo(() => {
    const map: Record<string, any> = {};
    diretorias.forEach((dir: any) => {
      map[dir.id] = dir;
    });
    return map;
  }, [diretorias]);

  // Converter solicitações para o formato de PlanItem (apenas itens enviados para fluxo de aprovação)
  const items: PlanItem[] = useMemo(() => {
    if (!diretoria) return [];

    return solicitacoes
      .filter((s: any) =>
        s.qtd_estimada > 0 &&
        ["enviado", "em_analise", "aprovado", "rejeitado", "em_compra", "concluido"].includes(s.status)
      )
      .map((s: any) => {
        const categoriaItem = (typeof s.categoria === "string" && s.categoria.trim().length > 0)
          ? s.categoria
          : "diversos";
        const diretoriaOrcamentariaIdRaw = getBudgetOwnerDiretoriaId(
          orcamentoConfig,
          categoriaItem,
          s.diretoria_id,
          categoryBudgetOwnersFromDb,
        );
        // Fallback defensivo: evita sumir com itens quando a regra aponta para diretoria inexistente.
        const diretoriaOrcamentariaId = diretoriaMap[diretoriaOrcamentariaIdRaw]
          ? diretoriaOrcamentariaIdRaw
          : s.diretoria_id;
        const diretoriaSolicitante = diretoriaMap[s.diretoria_id];
        const diretoriaOrcamentaria = diretoriaMap[diretoriaOrcamentariaId];
        const codigo = Number(s.codigo);

        return {
          id: s.id,
          codigo,
          descricao: s.descricao,
          categoria: categoriaItem,
          gerencia: gerenciaMap[s.gerencia_id] || "N/A",
          prioridade: s.prioridade || "Média",
          qtdEstimada: s.qtd_estimada || 0,
          unidade: s.unidade || "un",
          valorUnitario: s.valor_unitario || 0,
          observacao: s.observacao || "",
          status: s.status as SolicitacaoStatus,
          justificativaRejeicao: s.justificativa_rejeicao || "",
          diretoriaSigla: diretoriaSolicitante?.sigla,
          diretoriaOrcamentariaId,
          diretoriaOrcamentariaSigla: diretoriaOrcamentaria?.sigla || diretoriaSolicitante?.sigla,
          isOrcamentoCompartilhado: diretoriaSolicitante?.id !== diretoriaOrcamentariaId,
        };
      })
      // Não filtramos por diretoriaOrcamentariaId aqui — todos os itens da diretoria
      // devem aparecer no painel de aprovação, independentemente de regras de roteamento.
      ;
  }, [solicitacoes, diretoria, gerenciaMap, orcamentoConfig, diretoriaMap, categoryBudgetOwnersFromDb]);

  // Itens adicionados diretamente pela diretoria (rascunho, editáveis)
  const itensProprios: PlanItem[] = useMemo(() => {
    if (!diretoria) return [];

    const solicitacoesRascunho = [...solicitacoes]
      .filter((s: any) => s.status === "rascunho")
      .sort((a: any, b: any) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return aTime - bTime;
      });

    const latestByCodigo = new Map<number, PlanItem>();

    solicitacoesRascunho.forEach((s: any) => {
      const codigo = Number(s.codigo);
      latestByCodigo.set(codigo, {
        id: s.id,
        codigo,
        descricao: s.descricao,
        categoria: (typeof s.categoria === "string" && s.categoria.trim().length > 0) ? s.categoria : "diversos",
        gerencia: gerenciaMap[s.gerencia_id] || "N/A",
        prioridade: s.prioridade || "Média",
        qtdEstimada: s.qtd_estimada || 0,
        unidade: s.unidade || "un",
        valorUnitario: s.valor_unitario || 0,
        observacao: s.observacao || "",
        status: s.status as SolicitacaoStatus,
        justificativaRejeicao: "",
      });
    });

    return Array.from(latestByCodigo.values());
  }, [solicitacoes, diretoria, gerenciaMap]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const gerencias = useMemo(() => {
    const unique = [...new Set(items.map((i) => i.gerencia))].filter(g => g !== "N/A");
    return unique.sort();
  }, [items]);

  const catalogItems: PlanItem[] = useMemo(() => {
    return catalogoData.map((item: any) => ({
      codigo: Number(item.codigo),
      descricao: item.descricao,
      categoria: item.categoria || "diversos",
      unidade: item.unidade || "un",
      qtdEstimada: 0,
      valorUnitario: item.valor_unitario || 0,
      prioridade: "Média",
      gerencia: "",
    }));
  }, [catalogoData]);

  const existingCodigos = useMemo(() => new Set([...items, ...itensProprios].map((item) => item.codigo)), [items, itensProprios]);

  const filteredCatalogItems = useMemo(() => {
    const term = catalogSearch.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (existingCodigos.has(item.codigo)) return false;
      if (!term) return true;
      const matchesDescricao = item.descricao.toLowerCase().includes(term);
      const matchesCodigo = item.codigo.toString().includes(term);
      return matchesDescricao || matchesCodigo;
    });
  }, [catalogItems, catalogSearch, existingCodigos]);

  useEffect(() => {
    if (addDialogOpen && !selectedGerenciaId && gerenciasData.length > 0) {
      setSelectedGerenciaId(gerenciasData[0].id);
    }
  }, [addDialogOpen, selectedGerenciaId, gerenciasData]);

  useEffect(() => {
    if (selectedOption === "servicos") {
      setSelectedServicos(new Set());
    }
  }, [selectedGerencia, selectedOption]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (selectedGerencia !== "todas") {
      filtered = filtered.filter((i) => i.gerencia === selectedGerencia);
    }
    if (selectedCategoria !== "todas") {
      filtered = filtered.filter((i) => i.categoria === selectedCategoria);
    }
    return filtered;
  }, [items, selectedGerencia, selectedCategoria]);

  const categoriasItensProprios = useMemo(() => {
    const unique = Array.from(new Set(catalogItems.map((item) => item.categoria))).filter(Boolean);
    return unique.sort();
  }, [catalogItems]);

  const itensPropriosMap = useMemo(() => {
    return new Map(itensProprios.map((item) => [item.codigo, item]));
  }, [itensProprios]);

  const itensDiretoriaDisponiveis = useMemo(() => {
    const gerenciaSelecionada = ownGerenciaId === "diretoria"
      ? `DIRETORIA ${siglaUpper}`
      : (gerenciaMap[ownGerenciaId] || "N/A");

    return catalogItems.map((item) => {
      const existente = itensPropriosMap.get(item.codigo);
      if (existente) {
        return existente;
      }

      return {
        ...item,
        gerencia: gerenciaSelecionada,
        status: "rascunho" as SolicitacaoStatus,
      };
    });
  }, [catalogItems, itensPropriosMap, gerenciaMap, ownGerenciaId, siglaUpper]);

  const filteredOwnItems = useMemo(() => {
    return itensDiretoriaDisponiveis.filter((item) => {
      const matchesGerencia = ownGerenciaId === "diretoria"
        ? item.gerencia === `DIRETORIA ${siglaUpper}`
        : item.gerencia === (gerenciaMap[ownGerenciaId] || "N/A");
      const matchesSearch =
        ownSearchTerm === "" ||
        item.descricao.toLowerCase().includes(ownSearchTerm.toLowerCase()) ||
        item.codigo.toString().includes(ownSearchTerm);
      const matchesCategoria = !ownCategoria || ownCategoria === "" || item.categoria === ownCategoria;
      const matchesPrioridade = ownPrioridade === "todas" || item.prioridade === ownPrioridade;

      return matchesGerencia && matchesSearch && matchesCategoria && matchesPrioridade;
    });
  }, [itensDiretoriaDisponiveis, ownGerenciaId, ownSearchTerm, ownCategoria, ownPrioridade, gerenciaMap, siglaUpper]);

  useEffect(() => {
    setOwnCurrentPage(1);
  }, [ownGerenciaId, ownSearchTerm, ownCategoria, ownPrioridade]);

  const ownPaginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredOwnItems.length / ITEMS_PER_PAGE);
    const startIdx = (ownCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = filteredOwnItems.slice(startIdx, endIdx);
    return { totalPages, paginatedItems };
  }, [filteredOwnItems, ownCurrentPage]);

  const isItemReadOnly = (item: PlanItem) => item.status === "rejeitado" || item.status === "em_compra" || item.status === "concluido";

  const selectableItems = useMemo(
    () => filteredItems.filter((item) => item.id && !isItemReadOnly(item)),
    [filteredItems]
  );

  // Paginação
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return filteredItems.slice(startIdx, endIdx);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const summary = useMemo(() => ({
    totalItens:
      items.filter((item) => item.qtdEstimada > 0).length +
      itensProprios.filter((item) => item.qtdEstimada > 0).length,
    valorTotal:
      filteredItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0) +
      itensProprios.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
  }), [filteredItems, itensProprios, items]);

  const orcamentoDiretoriaAquisicao = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "aquisicao")
    : 0;
  const orcamentoDiretoriaServicos = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "servicos")
    : 0;
  const gastoAquisicaoDiretoria = useMemo(
    () => [...items, ...itensProprios].reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
    [items, itensProprios],
  );
  const gastoServicosDiretoria = useMemo(
    () =>
      servicosData
        .filter((s: any) => s.status !== "rascunho")
        .reduce(
          (acc: number, servico: any) =>
            acc + (servico.dotacao_orcamentaria || servico.estimativa_valor || 0),
          0,
        ),
    [servicosData],
  );

  // Listas únicas de categorias
  const categorias = useMemo(() => [...new Set(items.map(i => i.categoria))].sort(), [items]);
  const resumoDiretoriasSolicitantes = useMemo(() => {
    const grupos = new Map<string, { sigla: string; total: number; itens: number }>();

    items.forEach((item) => {
      const siglaOrigem = item.diretoriaSigla || siglaUpper;
      const atual = grupos.get(siglaOrigem) || { sigla: siglaOrigem, total: 0, itens: 0 };
      atual.total += item.qtdEstimada * item.valorUnitario;
      atual.itens += 1;
      grupos.set(siglaOrigem, atual);
    });

    return Array.from(grupos.values()).sort((a, b) => a.sigla.localeCompare(b.sigla));
  }, [items, siglaUpper]);

  // Handlers para seleção de itens
  const toggleSelectAll = () => {
    if (selectedItems.size === selectableItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(selectableItems.map(item => item.id).filter(Boolean) as string[]));
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectedApprovedItems = useMemo(() => {
    return filteredItems.filter((item) => item.id && selectedItems.has(item.id) && item.status === "aprovado" && !isItemReadOnly(item));
  }, [filteredItems, selectedItems]);

  // Handlers para edição
  const handleUpdateQtdEstimada = async (codigo: number, qtdEstimada: number) => {
    const item = items.find((i) => Number(i.codigo) === codigo);
    if (!item?.id) return;
    await updateSolicitacao(item.id, { qtdEstimada });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdateObservacao = async (codigo: number, observacao: string) => {
    const item = items.find((i) => Number(i.codigo) === codigo);
    if (!item?.id) return;
    await updateSolicitacao(item.id, { observacao });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdatePrioridade = async (codigo: number, prioridade: PlanItem["prioridade"]) => {
    const item = items.find((i) => Number(i.codigo) === codigo);
    if (!item?.id) return;
    await updateSolicitacao(item.id, { prioridade });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdateUnidadeDiretoria = async (codigo: number, unidade: string) => {
    await ensureSolicitacaoDiretoria(codigo, { unidade });
  };

  const ensureSolicitacaoDiretoria = async (codigo: number, updates: Partial<PlanItem>) => {
    const itemExistente = itensProprios.find((item) => Number(item.codigo) === codigo);

    if (itemExistente?.id) {
      queryClient.setQueryData(["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id], (current: any) => {
        if (!Array.isArray(current)) return current;
        return current.map((row: any) =>
          row?.id === itemExistente.id
            ? {
                ...row,
                qtd_estimada: updates.qtdEstimada ?? row.qtd_estimada,
                observacao: updates.observacao ?? row.observacao,
                prioridade: updates.prioridade ?? row.prioridade,
                unidade: updates.unidade ?? row.unidade,
              }
            : row,
        );
      });
      await updateSolicitacao(itemExistente.id, updates);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      return;
    }

    if (!diretoria || !periodAtivo) return;

    const gerenciaIdDestino = ownGerenciaId === "diretoria"
      ? (gerenciasData[0]?.id ?? "")
      : ownGerenciaId;

    if (!gerenciaIdDestino) return;

    const itemCatalogo = catalogItems.find((item) => Number(item.codigo) === codigo);
    if (!itemCatalogo) return;

    await createSolicitacao({
      periodo_id: periodAtivo.id,
      diretoria_id: diretoria.id,
      gerencia_id: gerenciaIdDestino,
      codigo: itemCatalogo.codigo,
      descricao: updates.descricao ?? itemCatalogo.descricao,
      categoria: updates.categoria ?? itemCatalogo.categoria,
      unidade: updates.unidade ?? itemCatalogo.unidade,
      valorUnitario: updates.valorUnitario ?? itemCatalogo.valorUnitario,
      qtdEstimada: updates.qtdEstimada ?? 0,
      prioridade: updates.prioridade ?? itemCatalogo.prioridade,
      observacao: updates.observacao || undefined,
      status: "rascunho",
    });

    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdateQtdEstimadaDiretoria = async (codigo: number, qtdEstimada: number) => {
    await ensureSolicitacaoDiretoria(codigo, { qtdEstimada });
  };

  const handleUpdateObservacaoDiretoria = async (codigo: number, observacao: string) => {
    await ensureSolicitacaoDiretoria(codigo, { observacao });
  };

  const handleUpdatePrioridadeDiretoria = async (codigo: number, prioridade: PlanItem["prioridade"]) => {
    await ensureSolicitacaoDiretoria(codigo, { prioridade });
  };

  const exportToPDF = () => {
    // Dinamic import para evitar problemas de compatibilidade
    import("jspdf").then(({ jsPDF }) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF() as any;
        const columnStyles = {
          0: { halign: "center" },
          1: { halign: "left" },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" }
        };

        const tableData = filteredItems.map((item) => [
          item.codigo,
          item.descricao.substring(0, 40),
          item.gerencia,
          item.prioridade,
          item.qtdEstimada,
          `R$ ${item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${(item.qtdEstimada * item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);

        doc.autoTable({
          head: [["Cód.", "Descrição", "Gerência", "Prioridade", "Qtd.", "Valor Unit.", "Total"]],
          body: tableData,
          columnStyles,
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          theme: 'striped',
          margin: { top: 10, right: 10, bottom: 10, left: 10 },
          startY: 20
        });
  
        doc.text(`Painel de Aprovação - ${diretoria?.sigla}`, 10, 10);
        doc.text(`Total: R$ ${summary.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 10, doc.lastAutoTable.finalY + 10);
        doc.save(`aprovacao_${diretoria?.sigla}_${new Date().toISOString().split('T')[0]}.pdf`);
      });
    });
  };

  const exportToExcel = () => {
    import("xlsx-js-style").then((XLSXStyle) => {
      const xlsx = XLSXStyle.default;
      const worksheetData = [
        ["Código", "Descrição", "Gerência", "Prioridade", "Quantidade", "Valor Unitário", "Total"],
        ...filteredItems.map((item) => [
          item.codigo,
          item.descricao,
          item.gerencia,
          item.prioridade,
          item.qtdEstimada,
          item.valorUnitario,
          item.qtdEstimada * item.valorUnitario
        ])
      ];

      const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = [
        { wch: 10 }, // Código
        { wch: 40 }, // Descrição
        { wch: 15 }, // Gerência
        { wch: 12 }, // Prioridade
        { wch: 10 }, // Quantidade
        { wch: 15 }, // Valor Unitário
        { wch: 15 }  // Total
      ];

      // Aplicar estilos ao header
      const headerStyle = {
        fill: { fgColor: { rgb: "FF2980B9" } },
        font: { color: { rgb: "FFFFFFFF" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      for (let i = 0; i < 7; i++) {
        const cellRef = xlsx.utils.encode_cell({ r: 0, c: i });
        worksheet[cellRef].s = headerStyle;
      }

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Aprovação");
      xlsx.writeFile(workbook, `aprovacao_${diretoria?.sigla}_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const handleSendToCompras = async () => {
    if (selectedApprovedItems.length === 0) return;
    const diretoriaQueryKey = ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id];
    // Atualiza cache imediatamente para feedback visual instantâneo
    selectedApprovedItems.forEach((item) => {
      if (item.id) {
        queryClient.setQueryData(diretoriaQueryKey, (current: any) => {
          if (!Array.isArray(current)) return current;
          return current.map((row: any) => row?.id === item.id ? { ...row, status: "em_compra" } : row);
        });
      }
    });
    setConfirmComprasOpen(false);
    setSelectedItems(new Set());
    try {
      await Promise.all(
        selectedApprovedItems
          .filter((item) => item.id)
          .map((item) => updateSolicitacaoStatus(item.id!, "em_compra"))
      );
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast({
        title: "Enviado para Compras",
        description: `${selectedApprovedItems.length} item(ns) enviado(s) para o setor de compras.`,
      });
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast({
        title: "Erro",
        description: "Nao foi possivel enviar para Compras.",
        variant: "destructive",
      });
    }
  };

  const handleAddItem = async () => {
    if (!selectedCatalogItem || !diretoria || !periodAtivo || !selectedGerenciaId) return;

    try {
      await createSolicitacao({
        periodo_id: periodAtivo.id,
        diretoria_id: diretoria.id,
        gerencia_id: selectedGerenciaId,
        codigo: selectedCatalogItem.codigo,
        descricao: selectedCatalogItem.descricao,
        categoria: selectedCatalogItem.categoria,
        unidade: selectedCatalogItem.unidade,
        valorUnitario: selectedCatalogItem.valorUnitario,
        qtdEstimada: addQtd,
        prioridade: addPrioridade,
        observacao: addObservacao || undefined,
        status: "rascunho",
      });

      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      setAddDialogOpen(false);
      setSelectedCatalogItem(null);
      setCatalogSearch("");
      setAddQtd(1);
      setAddPrioridade("Média");
      setAddObservacao("");

      toast({
        title: "Item adicionado",
        description: "Item adicionado ao planejamento da diretoria.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Nao foi possivel adicionar o item.",
        variant: "destructive",
      });
    }
  };

  const handleAction = async () => {
    if (!actionDialog.action) return;

    const actionMap = {
      aprovar: "aprovado" as SolicitacaoStatus,
      rejeitar: "rejeitado" as SolicitacaoStatus,
    };

    const newStatus = actionMap[actionDialog.action];
    const itemsToUpdate = actionDialog.isBulk 
      ? filteredItems.filter((item) => !isItemReadOnly(item))
      : filteredItems.filter(item => item.id && selectedItems.has(item.id) && !isItemReadOnly(item));

    const diretoriaQueryKey = ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id];
    // Atualiza cache imediatamente
    itemsToUpdate.forEach((item) => {
      if (item.id) {
        queryClient.setQueryData(diretoriaQueryKey, (current: any) => {
          if (!Array.isArray(current)) return current;
          return current.map((row: any) => row?.id === item.id ? { ...row, status: newStatus } : row);
        });
      }
    });
    setActionDialog({ open: false, action: null, isBulk: false });
    setJustificativa("");
    setSelectedItems(new Set());
    try {
      await Promise.all(
        itemsToUpdate
          .filter((item) => item.id)
          .map((item) => updateSolicitacaoStatus(item.id!, newStatus, justificativa || undefined))
      );
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast({
        title: "Ação executada",
        description: `${itemsToUpdate.length} item(ns) ${actionDialog.action === "aprovar" ? "aprovado(s)" : "rejeitado(s)"} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao executar ação:", error);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast({
        title: "Erro",
        description: "Não foi possível executar a ação.",
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

  const toggleExpandJustificativa = (servicoId: string) => {
    const newExpanded = new Set(expandedJustificativas);
    if (newExpanded.has(servicoId)) {
      newExpanded.delete(servicoId);
    } else {
      newExpanded.add(servicoId);
    }
    setExpandedJustificativas(newExpanded);
  };

  const getStatusBadgeVariant = (status: SolicitacaoStatus) => {
    switch (status) {
      case "aprovado":
        return "success";
      case "rejeitado":
        return "destructive";
      case "em_compra":
        return "default";
      case "concluido":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: SolicitacaoStatus) => {
    switch (status) {
      case "enviado":
        return "Enviado";
      case "em_analise":
        return "Em análise";
      case "aprovado":
        return "Aprovado";
      case "rejeitado":
        return "Rejeitado";
      case "em_compra":
        return "Enviado para compras";
      case "concluido":
        return "Concluído";
      default:
        return status;
    }
  };

  const isServicoReadOnly = (servico: ServicoItem) =>
    servico.status === "rejeitado" || servico.status === "em_compra" || servico.status === "concluido";

  const handleUpdateServicoGrauPrioridade = async (servico: ServicoItem, grauPrioridade: GrauPrioridade) => {
    if (!servico.id || isServicoReadOnly(servico)) return;
    await updateServico(servico.id, { grau_prioridade: grauPrioridade });
    queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
  };

  const handleUpdateServicoEstimativa = async (servico: ServicoItem, estimativaValor: number) => {
    if (!servico.id || isServicoReadOnly(servico)) return;
    await updateServico(servico.id, { estimativa_valor: estimativaValor });
    queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
  };

  const handleCriarServicoDiretoria = async () => {
    if (!diretoria || !periodAtivo) return;
    if (!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim()) return;

    const gerenciaIdAlvo = novoServicoForm.gerenciaId || (gerenciasData[0]?.id ?? "");
    if (!gerenciaIdAlvo) return;

    setNovoServicoLoading(true);
    try {
      const proximoItem =
        servicosData.length > 0
          ? Math.max(...servicosData.map((s: any) => s.item || 0)) + 1
          : 1;

      await createServico({
        periodo_id: periodAtivo.id,
        diretoria_id: diretoria.id,
        gerencia_id: gerenciaIdAlvo,
        item: proximoItem,
        tipo_contratacao: novoServicoForm.tipoContratacao || "Novo",
        unidade_demandante: siglaUpper,
        objeto: novoServicoForm.objeto.trim(),
        justificativa: novoServicoForm.justificativa.trim(),
        previsao_inicio: novoServicoForm.previsaoInicio || null,
        estimativa_valor: novoServicoForm.estimativaValor
          ? parseFloat(novoServicoForm.estimativaValor)
          : 0,
        dotacao_orcamentaria: novoServicoForm.dotacaoOrcamentaria
          ? parseFloat(novoServicoForm.dotacaoOrcamentaria)
          : 0,
        grau_prioridade: novoServicoForm.grauPrioridade,
        vinculacao: novoServicoForm.vinculacao,
        dependencia_descricao:
          novoServicoForm.vinculacao === "Sim"
            ? novoServicoForm.dependenciaDescricao.trim() || null
            : null,
        status: "rascunho",
      });

      await queryClient.invalidateQueries({
        queryKey: ["servicos-diretoria", diretoria.id, periodAtivo.id],
      });
      setNovoServicoOpen(false);
      setNovoServicoForm({
        objeto: "",
        justificativa: "",
        tipoContratacao: "Novo",
        gerenciaId: "",
        previsaoInicio: "",
        estimativaValor: "",
        dotacaoOrcamentaria: "",
        grauPrioridade: "Médio",
        vinculacao: "Não",
        dependenciaDescricao: "",
      });
      toast({ title: "Serviço adicionado", description: "Novo serviço cadastrado com sucesso." });
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o serviço.", variant: "destructive" });
    } finally {
      setNovoServicoLoading(false);
    }
  };

  const handleActionServicos = async () => {
    if (!actionServicosDialog.action) return;

    const actionMap = {
      aprovar: "aprovado" as SolicitacaoStatus,
      rejeitar: "rejeitado" as SolicitacaoStatus,
      enviar_compras: "em_compra" as SolicitacaoStatus,
    };

    const newStatus = actionMap[actionServicosDialog.action];
    const servicosEnviados = servicosData.filter((s) => s.status !== "rascunho");
    const servicosSelecionados = servicosEnviados.filter((s) => s.id && selectedServicos.has(s.id));
    const servicosToUpdate = actionServicosDialog.action === "enviar_compras"
      ? servicosSelecionados.filter((s) => s.status === "aprovado")
      : servicosSelecionados;

    if (actionServicosDialog.action === "enviar_compras" && servicosToUpdate.length === 0) {
      setActionServicosDialog({ open: false, action: null });
      setSelectedServicos(new Set());
      toast({
        title: "Nenhum serviço enviado",
        description: "Selecione serviços com status aprovado para enviar ao setor de Compras.",
      });
      return;
    }

    setActionServicosDialog({ open: false, action: null });
    setJustificativa("");
    setSelectedServicos(new Set());
    try {
      await Promise.all(
        servicosToUpdate
          .filter((s) => s.id)
          .map((s) => updateServico(s.id, { status: newStatus }))
      );
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast({
        title: "Ação executada",
        description: `${servicosToUpdate.length} serviço(s) ${
          actionServicosDialog.action === "aprovar"
            ? "aprovado(s)"
            : actionServicosDialog.action === "rejeitar"
            ? "rejeitado(s)"
            : "enviado(s) para Compras"
        } com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao executar ação:", error);
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast({
        title: "Erro",
        description: "Não foi possível executar a ação.",
        variant: "destructive",
      });
    }
  };

  if (isDiretoriasLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Carregando diretoria...</h1>
        </div>
      </div>
    );
  }

  if (!diretoria) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            {isDiretoriasError ? "Erro ao carregar diretorias" : "Diretoria não encontrada"}
          </h1>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AccessCodeScreen
        title={`Diretoria ${diretoria.sigla}`}
        subtitle={diretoria.nome}
        gradientClass="from-blue-700 to-blue-900"
        icon=""
        onAccessGranted={() => setAuthenticated(true)}
        onBack={() => navigate("/")}
        scope="diretoria"
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
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <Home className="h-4 w-4" />
                Página inicial
              </Button>
              <Badge variant="outline" className="text-xs">Diretoria {diretoria.sigla}</Badge>
            </div>
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {getIconPath(diretoria.sigla) && (
                  <img src={getIconPath(diretoria.sigla)!} alt={diretoria.sigla} className="h-12 w-12 object-contain" />
                )}
                <Badge className="bg-white/20 text-white border-none text-xl font-bold">{diretoria.sigla}</Badge>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{diretoria.nome}</h1>
              <p className="text-white/80 text-lg">Selecione o tipo de solicitação</p>
            </div>
          </div>

          {/* Opções: Aquisição e Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-lg font-semibold text-foreground mb-4">Selecione o painel para gestão da diretoria</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cartão Aquisição */}
                <button
                  onClick={() => {
                    setSelectedOption("aquisicao");
                    setApprovalTab("aquisicao");
                  }}
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <span className="text-4xl">📦</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Aquisição</h2>
                  <p className="text-muted-foreground">
                    Defina prioridades e quantidades dos itens, aprove/rejeite e adicione novos itens
                  </p>
                </button>

                {/* Cartão Serviços */}
                <button
                  onClick={() => {
                    setSelectedOption("servicos");
                    setApprovalTab("servicos");
                  }}
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <span className="text-4xl">🛠️</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Serviços</h2>
                  <p className="text-muted-foreground">
                    Gerencie serviços da diretoria e das gerências com priorização no mesmo painel
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se escolheu "Serviços", mostrar tabela de serviços com aprovação
  if (selectedOption === "servicos") {
    // Converter dados de serviços para o formato correto
    const servicos: ServicoItem[] = servicosData.map((s: any) => ({
      id: s.id,
      item: s.item,
      tipoContratacao: s.tipo_contratacao,
      unidadeDemandante: s.unidade_demandante,
      objeto: s.objeto,
      justificativa: s.justificativa,
      previsaoInicio: s.previsao_inicio,
      estimativaValor: s.estimativa_valor,
      dotacaoOrcamentaria: s.dotacao_orcamentaria,
      grauPrioridade: s.grau_prioridade as GrauPrioridade,
      vinculacao: s.vinculacao as "Sim" | "Não",
      dependenciaDescricao: s.dependencia_descricao,
      gerencia: gerenciaMap[s.gerencia_id] || "",
      diretoriaSigla: siglaUpper,
      status: s.status as SolicitacaoStatus,
      observacao: s.observacao,
    }));

    // Filtrar apenas serviços enviados (não rascunho)
    const servicosEnviados = servicos.filter((s) => s.status !== "rascunho");

    const servicosEnviadosFiltrados =
      selectedGerencia === "todas"
        ? servicosEnviados
        : servicosEnviados.filter((s) => s.gerencia === selectedGerencia);

    const servicosExistentes = servicosEnviadosFiltrados.filter((s) => s.tipoContratacao !== "Novo");
    const servicosNovos = servicosEnviadosFiltrados.filter((s) => s.tipoContratacao === "Novo");

    const toggleSelectAllServicosLista = (lista: ServicoItem[]) => {
      const ids = lista.filter((s) => s.id).map((s) => s.id as string);
      const allSelected = ids.length > 0 && ids.every((id) => selectedServicos.has(id));
      const newSelection = new Set(selectedServicos);

      if (allSelected) {
        ids.forEach((id) => newSelection.delete(id));
      } else {
        ids.forEach((id) => newSelection.add(id));
      }

      setSelectedServicos(newSelection);
    };

    const renderServicosTable = (titulo: string, lista: ServicoItem[]) => {
      const ids = lista.filter((s) => s.id).map((s) => s.id as string);
      const allSelected = ids.length > 0 && ids.every((id) => selectedServicos.has(id));

      return (
        <div className="bg-white rounded-lg border overflow-hidden mb-4">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">{titulo} ({lista.length})</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAllServicosLista(lista)}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Objeto / Justificativa</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Gerência</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Estimativa Valor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Prioridade</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Vinculação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((servico) => (
                <tr key={servico.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedServicos.has(servico.id || "")}
                      onChange={() => toggleSelectServico(servico.id || "")}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs">
                    <p className="font-medium">{servico.objeto}</p>
                    {servico.justificativa && (
                      <>
                        <p
                          className={`text-xs text-gray-500 mt-1 ${
                            expandedJustificativas.has(servico.id || "") ? "" : "line-clamp-2"
                          }`}
                        >
                          <span className="font-semibold text-gray-600">Justif.: </span>
                          {servico.justificativa}
                        </p>
                        {servico.justificativa.length > 120 && (
                          <button
                            type="button"
                            className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            onClick={() => toggleExpandJustificativa(servico.id || "")}
                          >
                            {expandedJustificativas.has(servico.id || "") ? "Ver menos" : "Ver mais"}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{servico.gerencia}</td>
                  <td className="px-4 py-3 text-sm text-center font-mono">
                    {isServicoReadOnly(servico) ? (
                      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(servico.estimativaValor || 0)
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={servico.estimativaValor || 0}
                        className="w-36 h-8 text-right mx-auto"
                        onBlur={(e) => handleUpdateServicoEstimativa(servico, Number(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {isServicoReadOnly(servico) ? (
                      <Badge variant={getPrioridadeBadgeVariant(servico.grauPrioridade) as any}>
                        {servico.grauPrioridade}
                      </Badge>
                    ) : (
                      <Select
                        value={servico.grauPrioridade}
                        onValueChange={(value) => handleUpdateServicoGrauPrioridade(servico, value as GrauPrioridade)}
                      >
                        <SelectTrigger className="w-[150px] h-8">
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
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {servico.status && (
                      <Badge variant={getStatusBadgeVariant(servico.status) as any}>
                        {getStatusLabel(servico.status)}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Badge variant={servico.vinculacao === "Sim" ? "default" : "secondary"}>
                      {servico.vinculacao}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      );
    };

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
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption(null)}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <Home className="h-4 w-4" />
                Página inicial
              </Button>
              <Badge variant="outline" className="text-xs">{siglaUpper}</Badge>
              <Badge variant="outline" className="text-xs bg-blue-50">Serviços - Aprovação</Badge>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-3 mb-2">
                {getIconPath(siglaUpper) && (
                  <img src={getIconPath(siglaUpper)!} alt={siglaUpper} className="h-10 w-10 object-contain" />
                )}
                <Badge className="bg-white/20 text-white border-none text-lg font-bold">{siglaUpper}</Badge>
              </div>
              <h1 className="text-2xl font-bold text-white">Serviços - Aprovação</h1>
              <p className="text-white/80 text-sm">Serviços enviados para aprovação</p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-6">
            <BudgetConsumptionCard
              titulo={`Orçamento da Diretoria ${siglaUpper} (serviços)`}
              orcamento={orcamentoDiretoriaServicos}
              gasto={gastoServicosDiretoria}
            />

            {/* Filtro de gerência */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Gerência:</span>
                <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="Selecione a gerência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as gerências</SelectItem>
                    {gerenciasData.map((g: any) => (
                      <SelectItem key={g.id} value={g.sigla}>
                        {g.sigla}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {servicosEnviadosFiltrados.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    className="gap-2"
                    disabled={selectedServicos.size === 0}
                    onClick={() => setActionServicosDialog({ ...actionServicosDialog, open: true, action: "aprovar" })}
                  >
                    <Check className="h-4 w-4" />
                    Aprovar Seleção
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={selectedServicos.size === 0}
                    onClick={() => setActionServicosDialog({ ...actionServicosDialog, open: true, action: "rejeitar" })}
                  >
                    <X className="h-4 w-4" />
                    Rejeitar Seleção
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={selectedServicos.size === 0}
                    onClick={() => setActionServicosDialog({ ...actionServicosDialog, open: true, action: "enviar_compras" })}
                  >
                    <Send className="h-4 w-4" />
                    Enviar para Compras
                  </Button>
                </div>
              )}
            </div>

            {/* Serviços Table */}
            {isServicosLoading && servicosData.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500">Carregando serviços...</p>
                </div>
              </div>
            ) : servicosEnviadosFiltrados.length > 0 ? (
              <>
                {isServicosLoading && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 mb-2">
                    <div className="h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Atualizando...
                  </div>
                )}
                {servicosExistentes.length > 0 && renderServicosTable("Serviços Existentes", servicosExistentes)}
                {servicosNovos.length > 0 && renderServicosTable("Serviços Novos", servicosNovos)}
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border">
                <p className="text-gray-500">
                  {isServicosLoading ? "Carregando..." : "Nenhum serviço enviado para aprovação nesta gerência"}
                </p>
              </div>
            )}

            {/* Botão Adicionar Novo Serviço da Diretoria */}
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                className="gap-2 border-dashed border-green-400 text-green-700 hover:bg-green-50"
                onClick={() => setNovoServicoOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar Novo Serviço da Diretoria
              </Button>
            </div>
          </div>

            {/* Dialog Novo Serviço da Diretoria */}
            <Dialog open={novoServicoOpen} onOpenChange={setNovoServicoOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Serviço</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do serviço a ser contratado pela diretoria em 2027.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Objeto <span className="text-destructive">*</span></label>
                    <textarea
                      value={novoServicoForm.objeto}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, objeto: e.target.value }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 min-h-20 bg-background"
                      placeholder="Descreva o objeto do serviço..."
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
                        <option value="Serviço">Serviço</option>
                        <option value="Contínuo">Contínuo</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Gerência responsável</label>
                      <select
                        value={novoServicoForm.gerenciaId}
                        onChange={(e) => setNovoServicoForm(f => ({ ...f, gerenciaId: e.target.value }))}
                        className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      >
                        <option value="">Geral / Diretoria</option>
                        {gerenciasData.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.sigla}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Previsão de Início</label>
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
                    <div>
                      <label className="text-sm font-medium">Dotação Orçamentária 2027 (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={novoServicoForm.dotacaoOrcamentaria}
                        onChange={(e) => setNovoServicoForm(f => ({ ...f, dotacaoOrcamentaria: e.target.value }))}
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
                    <label className="text-sm font-medium">Vinculação ou Dependência</label>
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
                        placeholder="Descreva a vinculação..."
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" onClick={() => setNovoServicoOpen(false)} disabled={novoServicoLoading}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCriarServicoDiretoria}
                    disabled={!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim() || novoServicoLoading}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {novoServicoLoading ? "Salvando..." : "Adicionar Serviço"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Dialog de Ação para Serviços */}
            <Dialog open={actionServicosDialog.open} onOpenChange={(open) => {
              if (!open) {
                setActionServicosDialog({ open: false, action: null });
                setJustificativa("");
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {actionServicosDialog.action === "aprovar" && "Aprovar Serviços"}
                    {actionServicosDialog.action === "rejeitar" && "Rejeitar Serviços"}
                    {actionServicosDialog.action === "enviar_compras" && "Enviar para Compras"}
                  </DialogTitle>
                  <DialogDescription>
                    {actionServicosDialog.action === "aprovar" && `Aprovar ${selectedServicos.size} serviço(s) selecionado(s)?`}
                    {actionServicosDialog.action === "rejeitar" && `Rejeitar ${selectedServicos.size} serviço(s) selecionado(s)?`}
                    {actionServicosDialog.action === "enviar_compras" && `Enviar ${selectedServicos.size} serviço(s) para o setor de Compras?`}
                  </DialogDescription>
                </DialogHeader>
                {actionServicosDialog.action === "rejeitar" && (
                  <div className="py-4">
                    <Textarea
                      placeholder="Motivo da rejeição..."
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      rows={4}
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setActionServicosDialog({ open: false, action: null });
                    setJustificativa("");
                  }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleActionServicos}
                    disabled={actionServicosDialog.action === "rejeitar" && !justificativa.trim()}
                  >
                    Confirmar
                  </Button>
                </DialogFooter>
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
      {/* Top Bar */}
      <div className="px-6 py-3 bg-card border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption(null)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}><Home className="h-4 w-4" />Página inicial</Button>
          <Badge variant="outline" className="text-xs">Painel da Diretoria</Badge>
          
          {/* Tabs: Aquisição e Serviços */}
          <div className="ml-auto flex gap-2">
            <Button
              variant={approvalTab === "aquisicao" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedOption("aquisicao");
                setApprovalTab("aquisicao");
              }}
            >
              Aquisição
            </Button>
            <Button
              variant={approvalTab === "servicos" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedOption("servicos");
                setApprovalTab("servicos");
              }}
            >
              Serviços
            </Button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            {getIconPath(diretoria.sigla) && (
              <img src={getIconPath(diretoria.sigla)!} alt={diretoria.sigla} className="h-8 w-8 object-contain" />
            )}
            <Badge className="bg-white/20 text-white border-none text-lg font-bold">{diretoria.sigla}</Badge>
          </div>
          <h1 className="text-xl font-bold text-white">Painel de Aprovação</h1>
          <p className="text-white/80 text-sm">{diretoria.nome}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards totalItens={summary.totalItens} valorTotal={summary.valorTotal} />

      <BudgetConsumptionCard
        titulo={`Orçamento da Diretoria ${siglaUpper} (aquisição)`}
        orcamento={orcamentoDiretoriaAquisicao}
        gasto={gastoAquisicaoDiretoria}
      />

      {/* Seus Itens - adicionados diretamente pela diretoria */}
      <div className="px-6 py-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">Seus Itens</h3>
          <p className="text-xs text-muted-foreground">Escolha a gerência responsável, filtre por categoria e preencha direto na lista</p>
        </div>

        <div className="px-6 pb-4 -mx-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center px-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Gerência responsável:</span>
              <Select value={ownGerenciaId} onValueChange={setOwnGerenciaId}>
                <SelectTrigger className="w-[240px] bg-card">
                  <SelectValue placeholder="Selecione a gerência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diretoria">Diretoria ({siglaUpper})</SelectItem>
                  {gerenciasData.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.sigla} - {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <PlanFilters
          searchTerm={ownSearchTerm}
          onSearchChange={setOwnSearchTerm}
          categoria={ownCategoria}
          onCategoriaChange={setOwnCategoria}
          prioridade={ownPrioridade}
          onPrioridadeChange={setOwnPrioridade}
          categorias={categoriasItensProprios}
        />

        {ownCategoria === "" ? (
          <div className="text-center py-8 bg-card rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">Selecione uma categoria para exibir os itens.</p>
          </div>
        ) : filteredOwnItems.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">Nenhum item encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <>
            <PlanTable
              items={ownPaginationData.paginatedItems}
              onUpdateQtdEstimada={handleUpdateQtdEstimadaDiretoria}
              onUpdateUnidade={handleUpdateUnidadeDiretoria}
              onUpdateObservacao={handleUpdateObservacaoDiretoria}
              onUpdatePrioridade={handleUpdatePrioridadeDiretoria}
              valorTotal={itensProprios.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0)}
            />

            {ownPaginationData.totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setOwnCurrentPage(Math.max(1, ownCurrentPage - 1))}
                        className={ownCurrentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {Array.from({ length: ownPaginationData.totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={`own-${page}`}>
                        <PaginationLink
                          onClick={() => setOwnCurrentPage(page)}
                          isActive={page === ownCurrentPage}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setOwnCurrentPage(Math.min(ownPaginationData.totalPages, ownCurrentPage + 1))}
                        className={ownCurrentPage === ownPaginationData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {resumoDiretoriasSolicitantes.length > 0 && (
        <div className="px-6 pb-2">
          <Card className="p-4 card-shadow border-l-4 border-l-indigo-500">
            <h3 className="font-semibold text-foreground mb-3">Origem das solicitações que consomem este orçamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {resumoDiretoriasSolicitantes.map((grupo) => (
                <div key={grupo.sigla} className="rounded border p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={grupo.sigla === siglaUpper ? "default" : "secondary"}>{grupo.sigla}</Badge>
                    <span className="text-xs text-muted-foreground">{grupo.itens} item(ns)</span>
                  </div>
                  <p className="font-bold text-foreground">{formatCurrency(grupo.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {grupo.sigla === siglaUpper
                      ? "Solicitações da própria diretoria"
                      : `Solicitações recebidas de ${grupo.sigla} por regra orçamentária`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Recebidos das Gerências */}
      <div className="px-6 pt-4 pb-1">
        <h3 className="text-sm font-semibold text-foreground">Recebidos das Gerências</h3>
        <p className="text-xs text-muted-foreground">Itens enviados pelas gerências para análise e aprovação</p>
      </div>

      {/* Filtros */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Gerência:</span>
            <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({items.length})</SelectItem>
                {gerencias.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g} ({items.filter(i => i.gerencia === g).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Categoria:</span>
            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({items.length})</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c} ({items.filter(i => i.categoria === c).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mensagem inicial ou sem itens das gerências */}
      {filteredItems.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground">
          Nenhum item recebido das gerências para os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Botões de Ação */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedItems.size === selectableItems.length && selectableItems.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size > 0 ? `${selectedItems.size} selecionado(s)` : "Selecionar todos"}
                </span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setConfirmComprasOpen(true)}
                  disabled={selectedApprovedItems.length === 0}
                >
                  <Send className="h-4 w-4" />
                  Enviar para Compras ({selectedApprovedItems.length})
                </Button>
                <Button 
                  size="sm" 
                  variant="default" 
                  className="gap-2"
                  onClick={() => setActionDialog({ open: true, action: "aprovar", isBulk: true })}
                  disabled={filteredItems.every(i => i.status === "aprovado" || i.status === "em_compra" || i.status === "concluido")}
                >
                  <CheckCircle className="h-4 w-4" />
                  Aprovar todos
                </Button>

                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => setActionDialog({ open: true, action: "rejeitar", isBulk: false })}
                  disabled={selectedItems.size === 0}
                >
                  <XCircle className="h-4 w-4" />
                  Rejeitar ({selectedItems.size})
                </Button>

              </div>
              <div className="flex items-center gap-2 md:ml-auto">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-2"
                  onClick={exportToPDF}
                  disabled={filteredItems.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-2"
                  onClick={exportToExcel}
                  disabled={filteredItems.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="px-6 pb-6">
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 text-left w-12">
                        <Checkbox 
                          checked={selectedItems.size === selectableItems.length && selectableItems.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Cód.</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Gerência</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Prioridade</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Qtd.</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Unidade</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Obs.</th>
                      <th className="p-3 text-right text-xs font-medium text-muted-foreground">Valor Unit.</th>
                      <th className="p-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item, index) => (
                      <tr 
                        key={item.id}
                        className={`border-b hover:bg-muted/30 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                      >
                        <td className="p-3">
                          <Checkbox 
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                            disabled={isItemReadOnly(item)}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono">{item.codigo}</td>
                        <td className="p-3 text-sm max-w-sm">
                          <p className="font-medium truncate">{item.descricao}</p>
                          <p className="text-xs text-muted-foreground">{item.categoria}</p>
                        </td>
                        <td className="p-3 text-sm">{item.gerencia}</td>
                        <td className="p-3">
                          <Badge variant={getStatusBadgeVariant(item.status) as any}>
                            {getStatusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {isItemReadOnly(item) ? (
                            <Badge variant={getPrioridadeBadgeVariant(item.prioridade) as any}>
                              {item.prioridade}
                            </Badge>
                          ) : (
                            <Select value={item.prioridade} onValueChange={(value) => handleUpdatePrioridade(item.codigo, value as any)}>
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Baixa">Baixa</SelectItem>
                                <SelectItem value="Média">Média</SelectItem>
                                <SelectItem value="Alta">Alta</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {isItemReadOnly(item) ? (
                            item.qtdEstimada
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              defaultValue={item.qtdEstimada}
                              onBlur={(e) => handleUpdateQtdEstimada(item.codigo, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-16 h-8 text-sm"
                            />
                          )}
                        </td>
                        <td className="p-3 text-sm">{item.unidade}</td>
                        <td className="p-3 text-sm min-w-[220px]">
                          {isItemReadOnly(item) ? (
                            <span className="text-muted-foreground">{item.observacao || "-"}</span>
                          ) : (
                            <Textarea
                              defaultValue={item.observacao || ""}
                              onBlur={(e) => handleUpdateObservacao(item.codigo, e.target.value)}
                              placeholder="Observação"
                              rows={2}
                              className="min-h-[56px] text-sm"
                            />
                          )}
                        </td>
                        <td className="p-3 text-right text-sm">
                          R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-sm font-medium">
                          R$ {(item.qtdEstimada * item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          onClick={() => setCurrentPage(page)}
                          isActive={page === currentPage}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </>
      )}



      {/* Dialog Adicionar Item */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) {
          setSelectedCatalogItem(null);
          setCatalogSearch("");
          setAddQtd(1);
          setAddPrioridade("Média");
          setAddObservacao("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar item da diretoria</DialogTitle>
            <DialogDescription>
              Busque um item do catálogo e informe os dados. O item entrará em "Seus Itens" para você editar antes de enviar para compras.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Buscar item</label>
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Digite o codigo ou nome do item..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                {filteredCatalogItems.length} item(ns) disponivel(is) no catalogo
              </p>
            </div>

            <div className="border rounded-md max-h-48 overflow-auto">
              {filteredCatalogItems.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">
                  Nenhum item encontrado.
                </div>
              )}
              {filteredCatalogItems.slice(0, 20).map((item) => (
                <button
                  key={item.codigo}
                  type="button"
                  onClick={() => setSelectedCatalogItem(item)}
                  className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/40 ${
                    selectedCatalogItem?.codigo === item.codigo ? "bg-muted" : ""
                  }`}
                >
                  <div className="text-sm font-medium">{item.descricao}</div>
                  <div className="text-xs text-muted-foreground">
                    Codigo {item.codigo} · {item.categoria} · Unid: {item.unidade}
                  </div>
                </button>
              ))}
            </div>

            {selectedCatalogItem && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Gerencia</label>
                  <Select value={selectedGerenciaId} onValueChange={setSelectedGerenciaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {gerenciasData.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.sigla}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Quantidade</label>
                  <Input
                    type="number"
                    min={1}
                    value={addQtd}
                    onChange={(e) => setAddQtd(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Prioridade</label>
                  <Select value={addPrioridade} onValueChange={(value) => setAddPrioridade(value as PlanItem["prioridade"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Observacao</label>
                  <Textarea
                    value={addObservacao}
                    onChange={(e) => setAddObservacao(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedCatalogItem || !selectedGerenciaId || addQtd <= 0}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Ação */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => {
        if (!open) {
          setActionDialog({ open: false, action: null, isBulk: false });
          setJustificativa("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === "aprovar" && "Aprovar Solicitações"}
              {actionDialog.action === "rejeitar" && "Rejeitar Solicitações"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === "aprovar" && `Aprovar ${filteredItems.length} solicitação(ões)?`}
              {actionDialog.action === "rejeitar" && `Rejeitar ${selectedItems.size} solicitação(ões) selecionada(s)? Informe uma justificativa:`}
            </DialogDescription>
          </DialogHeader>

          {actionDialog.action === "rejeitar" && (
            <div className="py-4">
              <Textarea
                placeholder="Motivo da rejeição..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionDialog({ open: false, action: null, isBulk: false });
              setJustificativa("");
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAction}
              disabled={actionDialog.action === "rejeitar" && !justificativa.trim()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Envio para Compras (aquisição) */}
      <Dialog open={confirmComprasOpen} onOpenChange={setConfirmComprasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para Compras</DialogTitle>
            <DialogDescription>
              Enviar {selectedApprovedItems.length} item(ns) aprovado(s) para o setor de Compras?
              Após o envio os itens não poderão ser editados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmComprasOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendToCompras} className="gap-2">
              <Send className="h-4 w-4" />
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default DiretoriaAprovacao;

