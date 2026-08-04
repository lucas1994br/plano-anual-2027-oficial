import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Plus, Home, Check, X, Send, Download, FileText, Pencil, Trash2, Clock, ShoppingCart, FileSpreadsheet, FileDown, Undo2, ArrowUp, ArrowDown, ArrowUpDown, Search, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AccessCodeScreen } from "@/components/ui/AccessCodeScreen";
import { PlanItem, SolicitacaoStatus, ServicoItem, GrauPrioridade, Diretoria, Gerencia } from "@/types/plan";
import { useMaterialDescriptions } from "@/hooks/useMaterialDescriptions";
import getItensCatalogo, { getAdminMiniErpConfigDb, getCategoryBudgetOwnerRules, getDiretorias, getSolicitacoesByDiretoria, getPeriodosAtivos, getGerenciasByDiretoria, updateSolicitacaoStatus, updateSolicitacaoStatusBulk, updateSolicitacoesBulkData, updateSolicitacao, deleteSolicitacao, deleteSolicitacoesBulk, createSolicitacao, getServicosByDiretoria, getServicosCatalogo, updateServico, deleteServico, deleteServicosBulk, updateServicosBulkData, createServico } from "@/lib/services";
import { BulkEditAquisicaoDialog, BulkEditServicosDialog } from "@/components/common/BulkActionDialogs";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/useDebounce";


/** Itens aguardando decisão da diretoria (podem ser aprovados ou rejeitados em massa). */
function isPendenteDiretoriaAprovacao(item: PlanItem) {
  return item.status === "enviado" || item.status === "em_analise";
}

/** Serviços aguardando decisão da diretoria */
function isPendenteServicoAprovacao(servico: ServicoItem) {
  return servico.status === "enviado" || servico.status === "em_analise";
}
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
  const { descriptions: materialDescriptions, isLoading: isLoadingDescriptions } = useMaterialDescriptions();
  const { sigla } = useParams<{ sigla: string }>();
  const navigate = useNavigate();
  const siglaUpper = (sigla || "").toUpperCase();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [authenticated, setAuthenticated] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | "servicos_existentes" | "servicos_novos" | null>(null);
  const [approvalTab, setApprovalTab] = useState<"aquisicao" | "servicos" | null>(null);
  const [ownSearchTerm, setOwnSearchTerm] = useState("");
  const debouncedOwnSearchTerm = useDebounce(ownSearchTerm, 300);
  const [ownCategoria, setOwnCategoria] = useState("");
  const [ownPrioridade, setOwnPrioridade] = useState("todas");
  const [ownGerenciaId, setOwnGerenciaId] = useState<string>("diretoria");
  const [ownShowOnlyComQuantidade, setOwnShowOnlyComQuantidade] = useState(false);
  const [ownShowOnlyZerados, setOwnShowOnlyZerados] = useState(false);
  const [ownShowOnlyAprovados, setOwnShowOnlyAprovados] = useState(false);
  const [ownServicosShowOnlyAprovados, setOwnServicosShowOnlyAprovados] = useState(false);
  const [ownServicosShowOnlyZerados, setOwnServicosShowOnlyZerados] = useState(false);
  const [ownServicosShowOnlyComValor, setOwnServicosShowOnlyComValor] = useState(false);
  const [ownServicosGerenciaId, setOwnServicosGerenciaId] = useState<string>("diretoria");
  const [servicosSortOrder, setServicosSortOrder] = useState<"asc" | "desc" | null>(null);
  const [ownServicosSearchTerm, setOwnServicosSearchTerm] = useState("");
  const debouncedOwnServicosSearchTerm = useDebounce(ownServicosSearchTerm, 300);
  const [ownServicosCurrentPage, setOwnServicosCurrentPage] = useState(1);
  const [showOnlyComQuantidade, setShowOnlyComQuantidade] = useState(false);
  const [showOnlyZerados, setShowOnlyZerados] = useState(false);
  const [selectedGerencia, setSelectedGerencia] = useState<string>("todas");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedOwnItems, setSelectedOwnItems] = useState<Set<string | number>>(new Set());
  const [activeTabOwnServicos, setActiveTabOwnServicos] = useState<"todos" | "pendentes" | "aprovados" | "enviados_compras">("todos");

  const [bulkEditAquisicaoOpen, setBulkEditAquisicaoOpen] = useState(false);
  const [bulkEditServicosOpen, setBulkEditServicosOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [editingBulkOwn, setEditingBulkOwn] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  /** Lista exibida em "Recebidos das Gerências": separa pendentes, aprovados, rejeitados e fluxo de compras. */
  const [recebidosStatusTab, setRecebidosStatusTab] = useState<
    "pendentes" | "aprovados" | "rejeitados" | "em_compra"
  >("pendentes");
  /** Tab de status para serviços: separa pendentes, aprovados, rejeitados e em compras */
  const [servicosStatusTab, setServicosStatusTab] = useState<
    "pendentes" | "aprovados" | "rejeitados" | "em_compra"
  >("pendentes");
  const [servicosCurrentPage, setServicosCurrentPage] = useState(1);
  const [selectedServicos, setSelectedServicos] = useState<Set<string>>(new Set());
  const [expandedJustificativas, setExpandedJustificativas] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const debouncedCatalogSearch = useDebounce(catalogSearch, 300);

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
    action: "aprovar" | "rejeitar" | "devolver" | "analisar" | null;
    isBulk: boolean;
  }>({ open: false, action: null, isBulk: false });
  const [justificativa, setJustificativa] = useState("");
  const [actionServicosDialog, setActionServicosDialog] = useState<{
    open: boolean;
    action: "aprovar" | "rejeitar" | "enviar_compras" | "devolver" | "analisar" | null;
  }>({ open: false, action: null });
  const [confirmComprasOpen, setConfirmComprasOpen] = useState(false);

  // Estado do dialog de novo serviço da diretoria
  const [novoServicoOpen, setNovoServicoOpen] = useState(false);
  const [novoServicoLoading, setNovoServicoLoading] = useState(false);
  const [servicoEditOpen, setServicoEditOpen] = useState(false);
  const [servicoEdicao, setServicoEdicao] = useState<ServicoItem | null>(null);
  const [solicitacaoEditOpen, setSolicitacaoEditOpen] = useState(false);
  const [solicitacaoEdicao, setSolicitacaoEdicao] = useState<PlanItem | null>(null);
  const [novoServicoForm, setNovoServicoForm] = useState({
    objeto: "",
    justificativa: "",
    tipoContratacao: "Contínuo",
    gerenciaId: "",
    previsaoInicio: "",
    estimativaValor: "",
    dotacaoOrcamentaria: "",
    grauPrioridade: "Médio" as GrauPrioridade,
    vinculacao: "Não" as "Sim" | "Não",
    dependenciaDescricao: "",
  });

  const isAuthenticated = () => {
    return localStorage.getItem("@pga:user") !== null;
  };

  useEffect(() => {
    if (isAuthenticated()) {
      setAuthenticated(true);
    }
  }, []);



  // Buscar diretorias
  const { data: diretorias = [], isLoading: isDiretoriasLoading, isError: isDiretoriasError } = useQuery<any[]>({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const diretoria = (diretorias as any[]).find((d: any) => d.sigla === siglaUpper);

  // Buscar gerências desta diretoria
  const { data: gerenciasData = [] } = useQuery<any[]>({
    queryKey: ["gerencias", diretoria?.id],
    queryFn: () => diretoria ? getGerenciasByDiretoria(diretoria.id) : Promise.resolve([]),
    enabled: !!diretoria,
    staleTime: 5 * 60 * 1000,
  });

  // Criar mapa de gerencia_id -> sigla
  const gerenciaMap = useMemo(() => {
    const map: Record<string, string> = {};
    (gerenciasData as any[]).forEach((g: any) => {
      map[g.id] = g.sigla;
    });
    return map;
  }, [gerenciasData]);

  useEffect(() => {
    if (ownGerenciaId === "diretoria" && gerenciasData.length > 0) {
      const dgGerencia = gerenciasData.find((g: any) => g.sigla === siglaUpper);
      if (dgGerencia) {
        setOwnGerenciaId(dgGerencia.id);
      }
    }
  }, [gerenciasData, ownGerenciaId, siglaUpper]);

  // Criar mapa de sigla -> nome de gerência
  const siglaToNome = useMemo(() => {
    const map: Record<string, string> = {};
    (gerenciasData as any[]).forEach((g: any) => {
      map[g.sigla] = g.nome;
    });
    return map;
  }, [gerenciasData]);

  // Buscar períodos ativos
  const { data: periodos = [] } = useQuery<any[]>({
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

  const solicitacoesQueryKey = ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id];
  const servicosQueryKey = ["servicos-diretoria", diretoria?.id, periodAtivo?.id];
  // Buscar solicitações para esta diretoria
  // Busca os itens da própria diretoria (por diretoria_id) garantindo que apareçam
  // independentemente de regras de roteamento orçamentário
  // Pré-carrega solicitações assim que diretoria + período estão disponíveis
  // (não aguarda selectedOption para evitar atraso após autenticação)
  const { data: solicitacoes = [], isLoading: isSolicitacoesLoading } = useQuery({
    queryKey: solicitacoesQueryKey,
    queryFn: () => (diretoria && periodAtivo) ? getSolicitacoesByDiretoria(diretoria.id, periodAtivo.id) : [],
    enabled: !!diretoria && !!periodAtivo,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const { data: servicosData = [], isLoading: isServicosLoading } = useQuery({
    queryKey: servicosQueryKey,
    queryFn: () => (diretoria && periodAtivo) ? getServicosByDiretoria(diretoria.id, periodAtivo.id) : [],
    enabled: authenticated && (selectedOption === "servicos" || selectedOption === "servicos_existentes" || selectedOption === "servicos_novos") && !!diretoria && !!periodAtivo,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });


  // Buscar itens do catalogo (banco)
  const { data: catalogoData = [] } = useQuery({
    queryKey: ["itens-catalogo"],
    queryFn: getItensCatalogo,
    enabled: authenticated && selectedOption === "aquisicao",
    staleTime: 10 * 60 * 1000,
  });

  const { data: servicosCatalogoData = [] } = useQuery({
    queryKey: ["servicos-catalogo"],
    queryFn: getServicosCatalogo,
    enabled: authenticated && (selectedOption === "servicos" || selectedOption === "servicos_existentes" || selectedOption === "servicos_novos"),
    staleTime: 10 * 60 * 1000,
  });

  const servicosCatalogoSet = useMemo(() => {
    return new Set((servicosCatalogoData as any[]).map(c => c.item));
  }, [servicosCatalogoData]);

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
    const map: Record<string, Diretoria> = {};
    (diretorias as any[]).forEach((dir: any) => {
      map[dir.id] = dir;
    });
    return map;
  }, [diretorias]);

  // Converter solicitações para o formato de PlanItem (apenas itens enviados para fluxo de aprovação)
  const items: PlanItem[] = useMemo(() => {
    if (isLoadingDescriptions) return [];
    if (!diretoria) return [];

    return solicitacoes
      .filter((s: any) =>
        s.qtd_estimada >= 0 &&
        ["enviado", "em_analise", "aprovado", "rejeitado", "em_compra", "concluido"].includes(s.status)
      )
      .map((s: any) => {
        const mappedCategory = materialDescriptions[String(s.codigo)];
        const categoriaItem = mappedCategory
          ? mappedCategory
          : (typeof s.categoria === "string" && s.categoria.trim().length > 0)
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
          qtdEstimada: Number(s.qtd_estimada || 0),
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
        qtdEstimada: Number(s.qtd_estimada || 0),
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
    const term = debouncedCatalogSearch.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (existingCodigos.has(item.codigo)) return false;
      if (!term) return true;
      const matchesDescricao = item.descricao.toLowerCase().includes(term);
      const matchesCodigo = item.codigo.toString().includes(term);
      return matchesDescricao || matchesCodigo;
    });
  }, [catalogItems, debouncedCatalogSearch, existingCodigos]);

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
    if (showOnlyZerados) {
      filtered = filtered.filter((i) => i.qtdEstimada === 0);
    }
    if (showOnlyComQuantidade) {
      filtered = filtered.filter((i) => i.qtdEstimada > 0);
    }
    return filtered;
  }, [items, selectedGerencia, selectedCategoria, showOnlyComQuantidade, showOnlyZerados]);

  const recebidosTabCounts = useMemo(() => {
    const base = filteredItems;
    const counts = { pendentes: 0, aprovados: 0, rejeitados: 0, em_compra: 0 };
    
    for (let i = 0; i < base.length; i++) {
      const item = base[i];
      if (isPendenteDiretoriaAprovacao(item)) counts.pendentes++;
      else if (item.status === "aprovado") counts.aprovados++;
      else if (item.status === "rejeitado") counts.rejeitados++;
      else if (item.status === "em_compra" || item.status === "concluido") counts.em_compra++;
    }
    return counts;
  }, [filteredItems]);

  const recebidosTableItems = useMemo(() => {
    switch (recebidosStatusTab) {
      case "pendentes":
        return filteredItems.filter(isPendenteDiretoriaAprovacao);
      case "aprovados":
        return filteredItems.filter((i) => i.status === "aprovado");
      case "rejeitados":
        return filteredItems.filter((i) => i.status === "rejeitado");
      case "em_compra":
        return filteredItems.filter((i) => i.status === "em_compra" || i.status === "concluido");
      default:
        return filteredItems;
    }
  }, [filteredItems, recebidosStatusTab]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems(new Set());
  }, [selectedGerencia, selectedCategoria, showOnlyComQuantidade]);

  const categoriasItensProprios = useMemo(() => {
    const unique = Array.from(new Set(catalogItems.map((item) => item.categoria))).filter(Boolean);
    return unique.sort();
  }, [catalogItems]);

  const itensPropriosMap = useMemo(() => {
    return new Map(itensProprios.map((item) => [item.codigo, item]));
  }, [itensProprios]);

  const filteredOwnItems = useMemo(() => {
    const term = debouncedOwnSearchTerm.trim().toLowerCase();
    
    // Otimização extrema de performance: se a UI vai esconder a tabela, nem processe os 4000 itens
    if (term === "" && !ownShowOnlyComQuantidade && !ownShowOnlyZerados) {
      return [];
    }

    const gerenciaSelecionada = ownGerenciaId === "diretoria"
      ? `DIRETORIA ${siglaUpper}`
      : (gerenciaMap[ownGerenciaId] || "N/A");

    const results: PlanItem[] = [];
    
    for (const item of catalogItems) {
      // Filtro de busca (mais performático se feito antes do map)
      const matchesSearch = term === "" || 
        item.descricao.toLowerCase().includes(term) || 
        item.codigo.toString().includes(term);
      
      if (!matchesSearch) continue;

      const matchesCategoria = !ownCategoria || item.categoria === ownCategoria;
      if (!matchesCategoria) continue;

      const existente = itensPropriosMap.get(item.codigo);

      // Otimização: Se só quer itens com quantidade e não existe em itensProprios, pula a criação do objeto
      if (ownShowOnlyComQuantidade && !existente) {
        continue;
      }

      const planItem = existente || {
        ...item,
        gerencia: gerenciaSelecionada,
        status: "rascunho" as SolicitacaoStatus,
      };

      // Filtro de prioridade
      if (ownPrioridade !== "todas" && planItem.prioridade !== ownPrioridade) continue;

      // Filtro de itens zerados
      if (ownShowOnlyZerados && planItem.qtdEstimada !== 0) continue;

      // Filtro de itens com quantidade
      if (ownShowOnlyComQuantidade && planItem.qtdEstimada <= 0) continue;

      // Filtro de itens aprovados
      if (ownShowOnlyAprovados && planItem.status !== "aprovado") continue;

      results.push(planItem);
    }

    return results;
  }, [catalogItems, itensPropriosMap, ownGerenciaId, debouncedOwnSearchTerm, ownCategoria, ownPrioridade, gerenciaMap, siglaUpper, ownShowOnlyComQuantidade, ownShowOnlyZerados, ownShowOnlyAprovados]);



  const ownPaginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredOwnItems.length / ITEMS_PER_PAGE);
    const startIdx = (ownCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = filteredOwnItems.slice(startIdx, endIdx);
    return { totalPages, paginatedItems };
  }, [filteredOwnItems, ownCurrentPage]);

  /** 
   * Liberado para edição em todas as abas conforme solicitado para permitir ajustes orçamentários.
   */
  const isItemReadOnly = (item: PlanItem) => false;

  const selectableItems = useMemo(
    () =>
      recebidosTableItems.filter((item) => {
        if (!item.id) return false;
        if (recebidosStatusTab === "rejeitados") return item.status === "rejeitado";
        return !isItemReadOnly(item);
      }),
    [recebidosTableItems, recebidosStatusTab],
  );

  // Paginação (tabela Recebidos das Gerências)
  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return recebidosTableItems.slice(startIdx, endIdx);
  }, [recebidosTableItems, currentPage]);

  const totalPages = Math.ceil(recebidosTableItems.length / ITEMS_PER_PAGE);

  const summary = useMemo(() => ({
    totalItens:
      recebidosTableItems.filter((item) => item.qtdEstimada > 0).length +
      filteredOwnItems.filter((item) => item.qtdEstimada > 0).length,
    valorTotal:
      recebidosTableItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0) +
      filteredOwnItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
  }), [recebidosTableItems, filteredOwnItems]);

  const orcamentoDiretoriaAquisicao = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "aquisicao")
    : 0;
  const orcamentoDiretoriaServicosNovos = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "servicos_novos")
    : 0;
  const orcamentoDiretoriaServicosExistentes = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "servicos_existentes")
    : 0;
  const gastoAquisicaoDiretoria = useMemo(
    () => [...filteredOwnItems, ...recebidosTableItems].reduce((acc, item) => {
      const isSelected = item.id ? (selectedItems.has(item.id) || selectedOwnItems.has(item.id)) : (item.codigo ? selectedOwnItems.has(item.codigo) : false);
      const isApproved = item.status === "aprovado";
      if (isSelected || isApproved) {
        return acc + item.qtdEstimada * item.valorUnitario;
      }
      return acc;
    }, 0),
    [filteredOwnItems, recebidosTableItems, selectedItems, selectedOwnItems],
  );
  const gastoServicosDiretoria = useMemo(() => {
    let list = servicosData.filter((s: ServicoItem) => s.status !== "rascunho");
    if (selectedOption === "servicos_novos") {
      list = list.filter(s => !servicosCatalogoSet.has(s.item));
    } else if (selectedOption === "servicos_existentes") {
      list = list.filter(s => servicosCatalogoSet.has(s.item));
    }
    return list.reduce(
      (acc: number, servico: ServicoItem) => {
        const isSelected = servico.id ? selectedServicos.has(servico.id) : false;
        const isApproved = servico.status === "aprovado";
        if (isSelected || isApproved) {
          return acc + (servico.dotacaoOrcamentaria || servico.estimativaValor || 0);
        }
        return acc;
      },
      0
    );
  }, [servicosData, selectedOption, servicosCatalogoSet, selectedServicos]);

  // Serviços da própria diretoria
  const servicosPropriosBase: ServicoItem[] = useMemo(() => {
    if (!diretoria) return [];
    const servicosDaDiretoria = servicosData.filter((s: ServicoItem) => s.unidadeDemandante === siglaUpper);
    
    if (selectedOption === "servicos_existentes") {
      return (servicosCatalogoData as any[]).map((catalogoItem) => {
        const servicoDb = servicosDaDiretoria.find(s => s.item === catalogoItem.item);
        if (servicoDb) {
          return servicoDb;
        }
        return {
          id: undefined,
          item: catalogoItem.item,
          tipoContratacao: catalogoItem.tipo_contratacao || "Serviço",
          unidadeDemandante: siglaUpper,
          objeto: catalogoItem.objeto || "",
          justificativa: "",
          previsaoInicio: catalogoItem.previsao_inicio || undefined,
          estimativaValor: catalogoItem.estimativa_valor || 0,
          dotacaoOrcamentaria: catalogoItem.dotacao_orcamentaria || 0,
          grauPrioridade: catalogoItem.grau_prioridade || "Baixo",
          vinculacao: catalogoItem.vinculacao || "Não",
          dependenciaDescricao: catalogoItem.dependencia_descricao || undefined,
          status: "rascunho",
          observacao: catalogoItem.observacao || "",
          gerencia: siglaUpper,
          diretoriaSigla: siglaUpper,
        } as unknown as ServicoItem;
      });
    } else if (selectedOption === "servicos_novos") {
      return servicosDaDiretoria.filter(s => !servicosCatalogoSet.has(s.item));
    }
    return [];
  }, [servicosData, diretoria, siglaUpper, selectedOption, servicosCatalogoData, servicosCatalogoSet]);

  const servicosProprios = useMemo(() => {
    let list = servicosPropriosBase;
    
    if (ownServicosGerenciaId !== "diretoria") {
      list = list.filter(s => (s as any).gerencia_id === ownServicosGerenciaId || s.gerencia === (gerenciaMap[ownServicosGerenciaId] || "N/A"));
    }
    if (ownServicosShowOnlyAprovados) {
      list = list.filter(s => s.status === "aprovado");
    }
    if (ownServicosShowOnlyZerados) {
      list = list.filter(s => !(s as any).estimativa_valor && !s.estimativaValor || (s as any).estimativa_valor === 0 || s.estimativaValor === 0);
    }
    if (ownServicosShowOnlyComValor) {
      list = list.filter(s => ((s as any).estimativa_valor && (s as any).estimativa_valor > 0) || (s.estimativaValor && s.estimativaValor > 0));
    }
    
    if (debouncedOwnServicosSearchTerm) {
      const term = debouncedOwnServicosSearchTerm.toLowerCase();
      list = list.filter(s => 
        (s.objeto || "").toLowerCase().includes(term) ||
        (s.justificativa || "").toLowerCase().includes(term) ||
        String(s.item).toLowerCase().includes(term)
      );
    }
    
    return list;
  }, [servicosPropriosBase, ownServicosShowOnlyAprovados, ownServicosGerenciaId, ownServicosShowOnlyZerados, ownServicosShowOnlyComValor, gerenciaMap, debouncedOwnServicosSearchTerm]);

  const ownServicosPaginationData = useMemo(() => {
    const totalItems = servicosProprios.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (ownServicosCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = servicosProprios.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    return {
      paginatedItems,
      totalPages,
      totalItems
    };
  }, [servicosProprios, ownServicosCurrentPage]);

  // Mostrar serviços de gerências (não rascunho)
  const servicosRecebidosBase = useMemo(() => {
    return servicosData.filter((s: ServicoItem) => 
      s.status !== "rascunho"
    );
  }, [servicosData]);

  const filteredServicos = useMemo(() => {
    const list = selectedGerencia === "todas"
      ? servicosRecebidosBase
      : servicosRecebidosBase.filter((s: ServicoItem) => s.gerencia === selectedGerencia);

    if (selectedOption === "servicos_novos") {
      return list.filter(s => !servicosCatalogoSet.has(s.item));
    }
    if (selectedOption === "servicos_existentes") {
      return list.filter(s => servicosCatalogoSet.has(s.item));
    }
    return list;
  }, [servicosRecebidosBase, selectedGerencia, selectedOption]);



  /** Contadores de serviços por status */
  const servicosTabCounts = useMemo(() => {
    const counts = { pendentes: 0, aprovados: 0, rejeitados: 0, em_compra: 0 };
    
    for (let i = 0; i < filteredServicos.length; i++) {
      const servico = filteredServicos[i];
      if (isPendenteServicoAprovacao(servico)) counts.pendentes++;
      else if (servico.status === "aprovado") counts.aprovados++;
      else if (servico.status === "rejeitado") counts.rejeitados++;
      else if (servico.status === "em_compra" || servico.status === "concluido") counts.em_compra++;
    }
    return counts;
  }, [filteredServicos]);

  /** Filtra serviços baseado no status selecionado */
  const servicosFiltradasPorStatus = useMemo(() => {
    switch (servicosStatusTab) {
      case "pendentes":
        return filteredServicos.filter(isPendenteServicoAprovacao);
      case "aprovados":
        return filteredServicos.filter((s: ServicoItem) => s.status === "aprovado");
      case "rejeitados":
        return filteredServicos.filter((s: ServicoItem) => s.status === "rejeitado");
      case "em_compra":
        return filteredServicos.filter((s: ServicoItem) => s.status === "em_compra" || s.status === "concluido");
      default:
        return filteredServicos;
    }
  }, [filteredServicos, servicosStatusTab]);

  const totalPagesServicos = Math.ceil(servicosFiltradasPorStatus.length / ITEMS_PER_PAGE);

  const servicosPaginados = useMemo(() => {
    const startIdx = (servicosCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return servicosFiltradasPorStatus.slice(startIdx, endIdx);
  }, [servicosFiltradasPorStatus, servicosCurrentPage]);

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
  const handleUpdateQtdEstimada = async (id: string, qtdEstimada: number) => {
    if (!id) return;

    // Atualização otimista no cache local para recálculo instantâneo na UI
    const queryKey = solicitacoesQueryKey;
    queryClient.setQueryData(queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((row: any) => 
        row?.id === id ? { ...row, qtd_estimada: qtdEstimada } : row
      );
    });

    await updateSolicitacao(id, { qtdEstimada });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdateObservacao = async (id: string, observacao: string) => {
    if (!id) return;

    const queryKey = solicitacoesQueryKey;
    queryClient.setQueryData(queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((row: any) => 
        row?.id === id ? { ...row, observacao } : row
      );
    });

    await updateSolicitacao(id, { observacao });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdatePrioridade = async (id: string, prioridade: PlanItem["prioridade"]) => {
    if (!id) return;

    const queryKey = solicitacoesQueryKey;
    queryClient.setQueryData(queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((row: any) => 
        row?.id === id ? { ...row, prioridade } : row
      );
    });

    await updateSolicitacao(id, { prioridade });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
  };

  const handleUpdateUnidadeDiretoria = async (codigo: number, unidade: string) => {
    await ensureSolicitacaoDiretoria(codigo, { unidade });
  };

  const ensureSolicitacaoDiretoria = async (codigo: number, updates: Partial<PlanItem>) => {
    const itemExistente = itensProprios.find((item) => Number(item.codigo) === codigo);

    if (itemExistente?.id) {
      queryClient.setQueryData(solicitacoesQueryKey, (current: any) => {
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

    // Optimistic Update for creation
    const tempId = `temp-${Date.now()}`;
    const newItem = {
      id: tempId,
      codigo: itemCatalogo.codigo,
      descricao: updates.descricao ?? itemCatalogo.descricao,
      categoria: updates.categoria ?? itemCatalogo.categoria,
      gerencia_id: gerenciaIdDestino,
      prioridade: updates.prioridade ?? itemCatalogo.prioridade,
      qtd_estimada: updates.qtdEstimada ?? 0,
      unidade: updates.unidade ?? itemCatalogo.unidade,
      valor_unitario: updates.valorUnitario ?? itemCatalogo.valorUnitario,
      observacao: updates.observacao || "",
      status: "rascunho",
      diretoria_id: diretoria.id,
      periodo_id: periodAtivo.id,
    };

    queryClient.setQueryData(solicitacoesQueryKey, (current: any) => {
      if (!Array.isArray(current)) return [newItem];
      return [...current.filter((c: any) => Number(c.codigo) !== codigo), newItem];
    });

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

  const handleDeleteSolicitacao = async (itemId: string) => {
    if (!confirm("Deseja realmente devolver este item para rascunho?")) return;
    try {
      const itemToUpdate = [...items, ...itensProprios].find(i => i.id === itemId);
      
      // Atualização otimista
      queryClient.setQueryData(solicitacoesQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((s: any) => {
          if (s.id === itemId) {
            if (itemToUpdate && itemToUpdate.status === "rascunho") {
              return { ...s, qtd_estimada: 0 };
            }
            return { ...s, status: "rascunho" };
          }
          return s;
        });
      });

      if (itemToUpdate && itemToUpdate.status === "rascunho") {
        await updateSolicitacao(itemId, { qtdEstimada: 0 });
      } else {
        await updateSolicitacao(itemId, { status: "rascunho" });
      }
      
      setSelectedOwnItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });

      await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id] });
      toast({ title: "Item devolvido", description: "Solicitação devolvida para rascunho com sucesso." });
    } catch (error) {
      console.error("Erro ao devolver solicitação:", error);
      toast({ title: "Erro ao devolver", description: "Não foi possível devolver a solicitação.", variant: "destructive" });
    }
  };

  const openSolicitacaoEditor = (item: PlanItem) => {
    setSolicitacaoEdicao(item);
    setSolicitacaoEditOpen(true);
  };

  const handleSaveSolicitacaoEdicao = async () => {
    if (!solicitacaoEdicao?.id) return;

    const updates: Partial<PlanItem> = {
      descricao: solicitacaoEdicao.descricao,
      categoria: solicitacaoEdicao.categoria,
      unidade: solicitacaoEdicao.unidade,
      qtdEstimada: solicitacaoEdicao.qtdEstimada,
      prioridade: solicitacaoEdicao.prioridade,
      observacao: solicitacaoEdicao.observacao,
    };

    try {
      await updateSolicitacao(solicitacaoEdicao.id, updates);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id] });
      setSolicitacaoEditOpen(false);
      setSolicitacaoEdicao(null);
      toast({ title: "Solicitação atualizada", description: "Dados atualizados com sucesso." });
    } catch (error) {
      console.error("Erro ao atualizar solicitação:", error);
      toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    }
  };

  const openServicoEditor = (servico: ServicoItem) => {
    setServicoEdicao(servico);
    setServicoEditOpen(true);
  };

  const handleDeleteServicoDiretoria = async (servicoId: string) => {
    if (!confirm("Deseja realmente excluir este serviço?")) return;
    try {
      // Atualização otimista
      queryClient.setQueryData(servicosQueryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.filter((s: any) => s.id !== servicoId);
      });

      await deleteServicosBulk([servicoId]);
      
      await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", diretoria?.id, periodAtivo?.id] });
      toast({ title: "Serviço excluído", description: "Serviço excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir o serviço.", variant: "destructive" });
    }
  };

  const handleSaveServicoEdicao = async () => {
    if (!servicoEdicao?.id) return;

    const updates: Partial<ServicoItem> = {
      objeto: servicoEdicao.objeto,
      justificativa: servicoEdicao.justificativa,
      observacao: servicoEdicao.observacao,
      estimativaValor: servicoEdicao.estimativaValor,
      dotacaoOrcamentaria: servicoEdicao.dotacaoOrcamentaria,
      grauPrioridade: servicoEdicao.grauPrioridade,
      vinculacao: servicoEdicao.vinculacao,
      dependenciaDescricao: servicoEdicao.dependenciaDescricao,
    };

    try {
      await updateServico(servicoEdicao.id, updates);
      await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", diretoria?.id, periodAtivo?.id] });
      setServicoEditOpen(false);
      setServicoEdicao(null);
      toast({ title: "Serviço atualizado", description: "Informações do serviço salvas." });
    } catch (error) {
      console.error("Erro ao atualizar serviço:", error);
      toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    }
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

        const tableData = recebidosTableItems.map((item) => [
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
        ...recebidosTableItems.map((item) => [
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

  const exportServicosToPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      import("jspdf-autotable").then(() => {
        const doc = new jsPDF({ orientation: "landscape", format: "a4" }) as any;
        const columnStyles = {
          0: { halign: "left" },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "left" },
          4: { halign: "center" },
          5: { halign: "right" }
        };

        const isNovos = selectedOption === "servicos_novos";
        const categoryTitle = isNovos ? "Novos Serviços" : "Serviços Existentes";
        const categoryFile = isNovos ? "Novos_Servicos" : "Servicos_Existentes";

        const tableData = servicosFiltradasPorStatus.map((s: any) => [
          s.objeto,
          s.gerencia || "N/A",
          s.unidadeDemandante || "N/A",
          s.justificativa || "-",
          s.grauPrioridade || "Médio",
          `R$ ${(s.estimativaValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);

        doc.autoTable({
          head: [["Objeto", "Gerência", "Unid. Demandante", "Justificativa", "Prioridade", "Estimativa Valor"]],
          body: tableData,
          columnStyles,
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
          theme: 'striped',
          margin: { top: 10, right: 10, bottom: 10, left: 10 },
          startY: 20
        });
  
        doc.text(`Painel de Aprovação - ${categoryTitle} - ${diretoria?.sigla}`, 10, 10);
        
        const totalValue = servicosFiltradasPorStatus.reduce((acc: number, s: any) => acc + (s.estimativaValor || 0), 0);
        doc.text(`Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 10, doc.lastAutoTable.finalY + 10);
        doc.save(`aprovacao_${categoryFile}_${diretoria?.sigla}_${new Date().toISOString().split('T')[0]}.pdf`);
      });
    });
  };

  const exportServicosToExcel = () => {
    import("xlsx-js-style").then((XLSXStyle) => {
      const xlsx = XLSXStyle.default;
      
      const isNovos = selectedOption === "servicos_novos";
      const categoryTitle = isNovos ? "Novos Serviços" : "Serviços Existentes";
      const categoryFile = isNovos ? "Novos_Servicos" : "Servicos_Existentes";

      const worksheetData = [
        ["Objeto", "Gerência", "Unidade Demandante", "Justificativa", "Prioridade", "Estimativa Valor"],
        ...servicosFiltradasPorStatus.map((s: any) => [
          s.objeto,
          s.gerencia || "N/A",
          s.unidadeDemandante || "N/A",
          s.justificativa || "-",
          s.grauPrioridade || "Médio",
          s.estimativaValor || 0
        ])
      ];

      const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = [
        { wch: 40 }, // Objeto
        { wch: 15 }, // Gerência
        { wch: 20 }, // Unidade Demandante
        { wch: 30 }, // Justificativa
        { wch: 12 }, // Prioridade
        { wch: 18 }  // Estimativa Valor
      ];

      // Aplicar estilos ao header
      const headerStyle = {
        fill: { fgColor: { rgb: "FF2980B9" } },
        font: { color: { rgb: "FFFFFFFF" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };

      for (let i = 0; i < 6; i++) {
        const cellRef = xlsx.utils.encode_cell({ r: 0, c: i });
        worksheet[cellRef].s = headerStyle;
      }

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Serviços");
      xlsx.writeFile(workbook, `aprovacao_${categoryFile}_${diretoria?.sigla}_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const handleSendToCompras = async () => {
    if (selectedApprovedItems.length === 0) return;
    setConfirmComprasOpen(false);
    setSelectedItems(new Set());
    try {
      const validIds = selectedApprovedItems.map(i => i.id!).filter(Boolean);
      if (validIds.length > 0) {
        await updateSolicitacaoStatusBulk(validIds, "em_compra");
      }
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast({
        title: "Enviado para Compras",
        description: `${selectedApprovedItems.length} item(ns) enviado(s) para o setor de Compras.`,
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

  const confirmActionServicosBulk = async () => {
    if (selectedServicos.size === 0) return;
    setIsUpdating(true);
    try {
      const validIds = Array.from(selectedServicos);

      let newStatus: SolicitacaoStatus = "aprovado";
      let actionText = "aprovado(s)";

      if (actionServicosDialog.action === "rejeitar") {
        newStatus = "rejeitado";
        actionText = "rejeitado(s)";
      } else if (actionServicosDialog.action === "devolver") {
        newStatus = "rascunho";
        actionText = "devolvido(s) ao rascunho";
      }

      await Promise.all(
        validIds.map((id) =>
          updateServico(id, {
            status: newStatus,
            justificativa_rejeicao: justificativa || null,
          })
        )
      );

      await queryClient.invalidateQueries({ queryKey: servicosQueryKey, exact: true });
      setSelectedServicos(new Set());
      setActionServicosDialog({ open: false, action: null });
      setJustificativa("");
      toast({ title: "Sucesso", description: `Serviço(s) ${actionText} com sucesso.` });
    } catch (error: any) {
      console.error("Erro na ação em lote de serviços:", error);
      toast({ title: "Erro", description: error.message || "Ocorreu um erro ao processar a ação.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkEditAquisicao = async (updates: any) => {
    setIsBulkUpdating(true);
    try {
      const ids = editingBulkOwn ? Array.from(selectedOwnItems) : Array.from(selectedItems);
      await updateSolicitacoesBulkData(ids as string[], updates);
      await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey, exact: true });
      toast({ title: "Itens atualizados", description: "Os itens selecionados foram atualizados com sucesso." });
      setBulkEditAquisicaoOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkEditServicos = async (updates: any) => {
    setIsBulkUpdating(true);
    try {
      await updateServicosBulkData(Array.from(selectedServicos), updates);
      await queryClient.invalidateQueries({ queryKey: servicosQueryKey, exact: true });
      toast({ title: "Serviços atualizados", description: "Os serviços selecionados foram atualizados com sucesso." });
      setBulkEditServicosOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
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
      devolver: "rascunho" as SolicitacaoStatus,
      analisar: "em_analise" as SolicitacaoStatus,
    };

    const newStatus = actionMap[actionDialog.action];
    const itemsToUpdate =
      actionDialog.isBulk && actionDialog.action === "aprovar"
        ? filteredItems.filter((item) => isPendenteDiretoriaAprovacao(item))
        : filteredItems.filter(
            (item) => item.id && selectedItems.has(item.id) && !isItemReadOnly(item),
          );

    setActionDialog({ open: false, action: null, isBulk: false });
    setJustificativa("");
    setSelectedItems(new Set());
    try {
      const validIds = itemsToUpdate.map(i => i.id!).filter(Boolean);
      if (validIds.length > 0) {
        // Atualização otimista
        queryClient.setQueryData(solicitacoesQueryKey, (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((s: any) => 
            validIds.includes(s.id) ? { ...s, status: newStatus } : s
          );
        });

        await updateSolicitacaoStatusBulk(validIds, newStatus, justificativa || undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      
      let actionText = "processado(s)";
      if (actionDialog.action === "aprovar") actionText = "aprovado(s)";
      else if (actionDialog.action === "rejeitar") actionText = "rejeitado(s)";
      else if (actionDialog.action === "devolver") actionText = "devolvido(s) ao rascunho";
      else if (actionDialog.action === "analisar") actionText = "retornado(s) para análise";

      toast({
        title: "Ação executada",
        description: `${itemsToUpdate.length} item(ns) ${actionText} com sucesso.`,
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

  const ensureServicoDiretoria = async (itemCode: number, updates: any) => {
    if (!diretoria || !periodAtivo) return;
    try {
      const servicoDb = servicosData.find((s: any) => s.item === itemCode && s.unidadeDemandante === siglaUpper);
      if (servicoDb && servicoDb.id) {
        await updateServico(servicoDb.id, updates);
        queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
        return servicoDb.id;
      }
      
      const catalogoItem: any = servicosCatalogoData.find((c: any) => c.item === itemCode);
      if (!catalogoItem) return;

      const gerenciaIdAlvo = gerenciasData[0]?.id ?? ""; 

      await createServico({
        periodo_id: periodAtivo.id,
        diretoria_id: diretoria.id,
        gerencia_id: gerenciaIdAlvo,
        item: catalogoItem.item,
        tipo_contratacao: catalogoItem.tipo_contratacao || "",
        unidade_demandante: siglaUpper,
        objeto: catalogoItem.objeto || "",
        justificativa: updates.justificativa !== undefined ? updates.justificativa : (catalogoItem.justificativa || null),
        previsao_inicio: null,
        estimativa_valor: updates.estimativa_valor !== undefined ? updates.estimativa_valor : (catalogoItem.estimativa_valor || 0),
        dotacao_orcamentaria: updates.dotacao_orcamentaria !== undefined ? updates.dotacao_orcamentaria : 0,
        grau_prioridade: updates.grau_prioridade !== undefined ? updates.grau_prioridade : (catalogoItem.grau_prioridade || "Baixo"),
        vinculacao: updates.vinculacao !== undefined ? updates.vinculacao : (catalogoItem.vinculacao || "Não"),
        dependencia_descricao: null,
        status: updates.status || "rascunho",
      });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
    } catch (e) {
      console.error(e);
    }
  };

  const isServicoReadOnly = (servico: ServicoItem) =>
    servico.status === "rejeitado" || servico.status === "em_compra" || servico.status === "concluido";

  const handleUpdateServicoGrauPrioridade = async (servico: ServicoItem, grauPrioridade: GrauPrioridade) => {
    if (isServicoReadOnly(servico)) return;
    if (!servico.id) {
      await ensureServicoDiretoria(servico.item, { grau_prioridade: grauPrioridade });
    } else {
      await updateServico(servico.id, { grau_prioridade: grauPrioridade });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
    }
  };

  const handleUpdateServicoEstimativa = async (servico: ServicoItem, estimativaValor: number) => {
    if (isServicoReadOnly(servico)) return;
    if (!servico.id) {
      await ensureServicoDiretoria(servico.item, { estimativa_valor: estimativaValor });
    } else {
      await updateServico(servico.id, { estimativa_valor: estimativaValor });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
    }
  };

  const handleCriarServicoDiretoria = async () => {
    if (novoServicoLoading) return; // Prevent double submission
    if (!diretoria || !periodAtivo) return;
    if (!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim()) return;

    const gerenciaIdAlvo = novoServicoForm.gerenciaId || (gerenciasData[0]?.id ?? "");
    if (!gerenciaIdAlvo) return;

    setNovoServicoLoading(true);
    try {
      const maxItem = servicosData.length > 0
        ? Math.max(...servicosData.map((s: any) => s.item || 0))
        : 0;
      const proximoItem = maxItem < 9000000 ? 9000000 : maxItem + 1;

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
        tipoContratacao: "Contínuo",
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
      devolver: "rascunho" as SolicitacaoStatus,
      analisar: "enviado" as SolicitacaoStatus,
    };

    const newStatus = actionMap[actionServicosDialog.action];
    const servicosSelecionados = servicosFiltradasPorStatus.filter((s: any) => s.id && selectedServicos.has(s.id));
    const servicosToUpdate = actionServicosDialog.action === "enviar_compras"
      ? servicosSelecionados.filter((s: any) => s.status === "aprovado")
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
      // Atualização otimista
      queryClient.setQueryData(["servicos-diretoria", diretoria?.id, periodAtivo?.id], (oldData: any) => {
        if (!oldData) return oldData;
        const idsToUpdate = servicosToUpdate.map((s: any) => s.id);
        return oldData.map((s: any) => 
          idsToUpdate.includes(s.id) ? { ...s, status: newStatus } : s
        );
      });

      await Promise.all(
        servicosToUpdate
          .filter((s: any) => s.id)
          .map((s: any) => {
            const updates: any = { status: newStatus };
            if (justificativa && (actionServicosDialog.action === "rejeitar" || actionServicosDialog.action === "devolver")) {
              const prefix = actionServicosDialog.action === "rejeitar" ? "Motivo Rejeição: " : "Motivo Devolução: ";
              updates.observacao = s.observacao ? `${s.observacao}\n${prefix}${justificativa}` : `${prefix}${justificativa}`;
            }
            return updateServico(s.id, updates);
          })
      );
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast({
        title: "Ação executada",
        description: `${servicosToUpdate.length} serviço(s) ${
          actionServicosDialog.action === "aprovar"
            ? "aprovado(s)"
            : actionServicosDialog.action === "rejeitar"
            ? "rejeitado(s)"
            : actionServicosDialog.action === "devolver"
            ? "devolvido(s) ao rascunho"
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

  // Handlers para seleção de serviços
  const toggleSelectAllServicos = () => {
    const selectableIds = servicosFiltradasPorStatus
      .filter((s: any) => s.id && !isServicoReadOnly(s))
      .map((s: any) => s.id as string);

    if (selectedServicos.size === selectableIds.length && selectableIds.length > 0) {
      setSelectedServicos(new Set());
    } else {
      setSelectedServicos(new Set(selectableIds));
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
        subtitle={diretoria.nome || ""}
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

  // Tela de seleção: Serviços Existentes ou Novos Serviços (Diretoria)
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
              <Badge variant="outline" className="text-xs">Diretoria {diretoria?.sigla}</Badge>
            </div>
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {getIconPath(diretoria?.sigla) && (
                  <img src={getIconPath(diretoria?.sigla)!} alt={diretoria?.sigla} className="h-12 w-12 object-contain" />
                )}
                <Badge className="bg-white/20 text-white border-none text-xl font-bold">Diretoria {diretoria?.sigla}</Badge>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Aprovação de Serviços</h1>
              <p className="text-white/80 text-lg">Selecione a categoria de serviços para aprovação</p>
            </div>
          </div>

          {/* Opções: Serviços Existentes e Novos Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cartão Serviços Existentes */}
                <button
                  onClick={() => {
                    setSelectedOption("servicos_existentes");
                    setApprovalTab("servicos");
                  }}
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-[320px]"
                >
                  <div className="mb-4 flex justify-center w-full">
                    <div className="w-48 h-32 rounded-lg overflow-hidden flex items-center justify-center transition-colors">
                      <img
                        src="/assets/images/servicos_existentes.png"
                        alt="Serviços Existentes"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Serviços Existentes</h2>
                  <p className="text-muted-foreground">
                    Aprovar e gerenciar contratações recorrentes e serviços já existentes
                  </p>
                </button>

                {/* Cartão Novos Serviços */}
                <button
                  onClick={() => {
                    setSelectedOption("servicos_novos");
                    setApprovalTab("servicos");
                  }}
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-[320px]"
                >
                  <div className="mb-4 flex justify-center w-full">
                    <div className="w-48 h-32 rounded-lg overflow-hidden flex items-center justify-center transition-colors">
                      <img
                        src="/assets/images/novos_servicos.png"
                        alt="Novos Serviços"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Novos Serviços</h2>
                  <p className="text-muted-foreground">
                    Aprovar e gerenciar novas demandas de contratação de serviços
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
  if (selectedOption === "servicos_existentes" || selectedOption === "servicos_novos") {


    const toggleSelectAllServicosLista = (lista: ServicoItem[]) => {
      const ids = lista.map((s) => s.id || String(s.item));
      const allSelected = ids.length > 0 && ids.every((id) => selectedServicos.has(id));
      const newSelection = new Set(selectedServicos);

      if (allSelected) {
        ids.forEach((id) => newSelection.delete(id));
      } else {
        ids.forEach((id) => newSelection.add(id));
      }

      setSelectedServicos(newSelection);
    };

    const renderServicosTable = (titulo: string, listaBase: ServicoItem[]) => {
      const lista = [...listaBase].sort((a, b) => {
        if (!servicosSortOrder) return 0;
        const valA = a.estimativaValor || (a as any).estimativa_valor || 0;
        const valB = b.estimativaValor || (b as any).estimativa_valor || 0;
        if (servicosSortOrder === "asc") return valA - valB;
        if (servicosSortOrder === "desc") return valB - valA;
        return 0;
      });
      
      const ids = lista.map((s) => s.id || String(s.item));
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
                <th className="px-4 py-3 text-center text-sm font-semibold">
                  <div 
                    className="flex items-center justify-center gap-2 cursor-pointer select-none" 
                    onClick={() => setServicosSortOrder(s => s === "asc" ? "desc" : s === "desc" ? null : "asc")}
                  >
                    Estimativa Valor
                    <span className="text-gray-400">
                      {servicosSortOrder === "asc" ? <ArrowUp className="h-4 w-4 text-primary" /> : servicosSortOrder === "desc" ? <ArrowDown className="h-4 w-4 text-primary" /> : <ArrowUpDown className="h-4 w-4" />}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Prioridade</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Vinculação</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((servico) => (
                <tr key={servico.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedServicos.has(servico.id || String(servico.item))}
                      onChange={() => {
                        const id = servico.id || String(servico.item);
                        const newSelection = new Set(selectedServicos);
                        if (newSelection.has(id)) {
                          newSelection.delete(id);
                        } else {
                          newSelection.add(id);
                        }
                        setSelectedServicos(newSelection);
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm max-w-xs" title={servico.objeto}>
                    <p className="font-medium line-clamp-2">{servico.objeto}</p>
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
                      <CurrencyInput
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
                          <SelectItem value="Baixo">Baixo</SelectItem>
                          <SelectItem value="Médio">Médio</SelectItem>
                          <SelectItem value="Alto">Alto</SelectItem>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {servico.id && (
                        <>
                          {!isServicoReadOnly(servico) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Editar"
                              onClick={() => openServicoEditor(servico)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            title="Excluir"
                            onClick={() => handleDeleteServicoDiretoria(servico.id!)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
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
              titulo={`Orçamento da Diretoria ${siglaUpper} (${selectedOption === "servicos_existentes" ? "serviços existentes" : "novos serviços"})`}
              orcamento={selectedOption === "servicos_existentes" ? orcamentoDiretoriaServicosExistentes : orcamentoDiretoriaServicosNovos}
              gasto={gastoServicosDiretoria}
            />

            {/* Seus Serviços - adicionados diretamente pela diretoria */}
            <div className="px-6 py-4 mt-6 bg-card rounded-lg border">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Seus Serviços</h3>
                  <p className="text-xs text-muted-foreground">Serviços adicionados pela diretoria</p>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center mb-4">
                <div className="relative flex-1 max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar serviço..."
                    value={ownServicosSearchTerm}
                    onChange={(e) => {
                      setOwnServicosSearchTerm(e.target.value);
                      setOwnServicosCurrentPage(1);
                    }}
                    className="pl-9 h-10 w-full border-blue-600 focus:ring-blue-600 transition-all rounded-xl"
                  />
                </div>
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center ml-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Gerência responsável:</span>
                    <Select value={ownServicosGerenciaId} onValueChange={(v) => { setOwnServicosGerenciaId(v); setOwnCurrentPage(1); }}>
                      <SelectTrigger className="w-[240px] bg-card text-sm h-9">
                        <SelectValue placeholder="Selecione a gerência" />
                      </SelectTrigger>
                      <SelectContent>
                        {!gerenciasData.some((g: any) => g.sigla === siglaUpper) && (
                          <SelectItem value="diretoria">Diretoria ({siglaUpper})</SelectItem>
                        )}
                        {gerenciasData.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.sigla} - {g.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={ownServicosShowOnlyZerados ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setOwnServicosShowOnlyZerados(!ownServicosShowOnlyZerados);
                        if (!ownServicosShowOnlyZerados) setOwnServicosShowOnlyComValor(false);
                      }}
                    >
                      Filtrar serviços zerados
                    </Button>
                    <Button
                      variant={ownServicosShowOnlyComValor ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setOwnServicosShowOnlyComValor(!ownServicosShowOnlyComValor);
                        if (!ownServicosShowOnlyComValor) setOwnServicosShowOnlyZerados(false);
                      }}
                    >
                      Filtrar serviços com valor
                    </Button>
                    <Button
                      variant={ownServicosShowOnlyAprovados ? "default" : "outline"}
                      size="sm"
                      className="gap-2"
                      onClick={() => setOwnServicosShowOnlyAprovados(!ownServicosShowOnlyAprovados)}
                    >
                      {ownServicosShowOnlyAprovados ? "Mostrando apenas aprovados" : "Filtrar aprovados"}
                    </Button>
                    {selectedServicos.size > 0 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (confirm(`Deseja realmente excluir ${selectedServicos.size} serviço(s) selecionado(s)?`)) {
                              try {
                                const ids = Array.from(selectedServicos);
                                const realIds = ids.filter(id => typeof id === "string" && id.includes('-'));
                                if (realIds.length > 0) {
                                  await deleteServicosBulk(realIds);
                                }
                                setSelectedServicos(new Set());
                                toast({ title: "Excluídos", description: "Serviços excluídos com sucesso." });
                                queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
                              } catch (e) {
                                toast({ title: "Erro", description: "Erro ao excluir.", variant: "destructive" });
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir ({selectedServicos.size})
                        </Button>
                        {selectedOption !== "servicos_novos" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setBulkEditServicosOpen(true)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar ({selectedServicos.size})
                          </Button>
                        )}
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="gap-2 bg-success hover:bg-success/90 text-white"
                          onClick={async () => {
                            if (confirm(`Deseja realmente aprovar ${selectedServicos.size} serviço(s) selecionado(s)?`)) {
                              try {
                                const ids = Array.from(selectedServicos);
                                const realIds: string[] = [];
                                for (const idOrCode of ids) {
                                if (idOrCode.includes('-')) {
                                  realIds.push(idOrCode);
                                } else {
                                  await ensureServicoDiretoria(Number(idOrCode), { status: "aprovado" });
                                }
                              }
                              if (realIds.length > 0) {
                                await updateSolicitacaoStatusBulk(realIds, "aprovado");
                              }
                              setSelectedServicos(new Set());
                              toast({ title: "Aprovados", description: "Serviços aprovados com sucesso." });
                              queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
                            } catch (e) {
                              toast({ title: "Erro", description: "Erro ao aprovar.", variant: "destructive" });
                            }
                          }
                        }}
                      >
                        <Send className="h-4 w-4" />
                        Aprovar ({selectedServicos.size})
                      </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {servicosProprios.length === 0 ? (
                <div className="text-center py-8 bg-background rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">Nenhum serviço {ownServicosShowOnlyAprovados ? "aprovado" : "encontrado"} adicionado pela diretoria.</p>
                </div>
              ) : (
                <>
                  {renderServicosTable(selectedOption === "servicos_existentes" ? "Serviços Existentes" : "Novos Serviços", ownServicosPaginationData.paginatedItems)}
                  {ownServicosPaginationData.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setOwnServicosCurrentPage(Math.max(1, ownServicosCurrentPage - 1))}
                              className={ownServicosCurrentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          
                          {Array.from({ length: ownServicosPaginationData.totalPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={`own-svc-${page}`}>
                              <PaginationLink 
                                onClick={() => setOwnServicosCurrentPage(page)}
                                isActive={ownServicosCurrentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setOwnServicosCurrentPage(Math.min(ownServicosPaginationData.totalPages, ownServicosCurrentPage + 1))}
                              className={ownServicosCurrentPage === ownServicosPaginationData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}

              {/* Botão Adicionar Novo Serviço da Diretoria */}
              {selectedOption === "servicos_novos" && (
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
              )}
            </div>

            {/* Recebidos das Gerências */}
            <div className="px-6 pt-8 pb-1">
              <h3 className="text-sm font-semibold text-foreground">Recebidos das Gerências</h3>
              <p className="text-xs text-muted-foreground">Serviços enviados pelas gerências para análise e aprovação</p>
            </div>

            {/* Filtros para Recebidos */}
            <div className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Gerência:</span>
                  <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                    <SelectTrigger className="w-[200px] bg-card">
                      <SelectValue placeholder="Todas as gerências" />
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
              </div>
            </div>

            {/* Tabs de Status para Serviços Recebidos */}
            <div className="px-6 pb-2">
              <Tabs
                value={servicosStatusTab}
                onValueChange={(v) => {
                  setServicosStatusTab(v as "pendentes" | "aprovados" | "rejeitados" | "em_compra");
                  setSelectedServicos(new Set());
                  setServicosCurrentPage(1);
                }}
              >
                <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 p-1">
                  <TabsTrigger value="pendentes" className="gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                    Pendentes
                    <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                      {servicosTabCounts.pendentes}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="aprovados" className="gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    Aprovados
                    <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                      {servicosTabCounts.aprovados}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="rejeitados" className="gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    Rejeitados
                    <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                      {servicosTabCounts.rejeitados}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="em_compra" className="gap-2">
                    <ShoppingCart className="h-4 w-4 shrink-0 text-sky-600" />
                    Em compras
                    <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                      {servicosTabCounts.em_compra}
                    </span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="mt-2 text-xs text-muted-foreground">
                {servicosStatusTab === "pendentes" &&
                  "Serviços com status Enviado ou Em análise: use os checkboxes ou Aprovar todos / Rejeitar."}
                {servicosStatusTab === "aprovados" &&
                  "Serviços aprovados: selecione para enviar ao setor de Compras quando estiver pronto."}
                {servicosStatusTab === "rejeitados" &&
                  "Serviços rejeitados: você pode selecionar itens para excluir permanentemente da lista."}
                {servicosStatusTab === "em_compra" &&
                  "Serviços já encaminhados às compras ou concluídos (somente consulta)."}
              </p>
            </div>

            {servicosFiltradasPorStatus.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground bg-white rounded-lg border mt-4 mx-6">
                {isServicosLoading ? "Carregando serviços..." : "Nenhum serviço nesta lista para os filtros atuais. Escolha outra aba acima."}
              </div>
            ) : (
              <>
                {/* Botões de Ação de Serviços Recebidos */}
                <div className="px-6 py-4 border-b bg-white mx-6 rounded-t-lg border-t border-l border-r mt-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={selectedServicos.size === servicosFiltradasPorStatus.filter(s => !isServicoReadOnly(s)).length && servicosFiltradasPorStatus.filter(s => !isServicoReadOnly(s)).length > 0}
                        onCheckedChange={() => {
                          const selectableIds = servicosFiltradasPorStatus
                            .filter((s: any) => s.id && !isServicoReadOnly(s))
                            .map((s: any) => s.id as string);
                          if (selectedServicos.size === selectableIds.length && selectableIds.length > 0) {
                            setSelectedServicos(new Set());
                          } else {
                            setSelectedServicos(new Set(selectableIds));
                          }
                        }}
                        disabled={servicosFiltradasPorStatus.filter(s => !isServicoReadOnly(s)).length === 0}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedServicos.size > 0 ? `${selectedServicos.size} selecionado(s)` : "Selecionar todos"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                      {selectedServicos.size > 0 && servicosStatusTab === "pendentes" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setActionServicosDialog({ open: true, action: "aprovar" })}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar Selecionados ({selectedServicos.size})
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2"
                        onClick={() => setActionServicosDialog({ open: true, action: "enviar_compras" })}
                        disabled={selectedServicos.size === 0 || servicosStatusTab !== "aprovados"}
                      >
                        <Send className="h-4 w-4" />
                        Enviar para Compras ({selectedServicos.size})
                      </Button>

                      {servicosStatusTab === "pendentes" && selectedServicos.size === 0 && (
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="gap-2"
                          onClick={() => {
                            // Seleciona todos os pendentes e abre dialog
                            const pendentes = servicosFiltradasPorStatus.filter(isPendenteServicoAprovacao);
                            setSelectedServicos(new Set(pendentes.map(s => s.id).filter(Boolean) as string[]));
                            setActionServicosDialog({ open: true, action: "aprovar" });
                          }}
                          disabled={!servicosFiltradasPorStatus.some(isPendenteServicoAprovacao)}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar todos
                        </Button>
                      )}

                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="gap-2"
                        onClick={() => setActionServicosDialog({ open: true, action: "rejeitar" })}
                        disabled={selectedServicos.size === 0 || servicosStatusTab === "rejeitados"}
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar ({selectedServicos.size})
                      </Button>

                      {(servicosStatusTab === "pendentes" || servicosStatusTab === "rejeitados") && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2 text-primary border-primary hover:bg-primary/10"
                            onClick={() => setBulkEditServicosOpen(true)}
                            disabled={selectedServicos.size === 0}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar Selecionados
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                            onClick={() => setActionServicosDialog({ open: true, action: "devolver" })}
                            disabled={selectedServicos.size === 0}
                          >
                            <Undo2 className="h-4 w-4" />
                            Devolver para Rascunho ({selectedServicos.size})
                          </Button>
                        </>
                      )}

                      {servicosStatusTab === "rejeitados" && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => setActionServicosDialog({ open: true, action: "analisar" })}
                            disabled={selectedServicos.size === 0}
                          >
                            <Undo2 className="h-4 w-4" />
                            Voltar para Pendentes ({selectedServicos.size})
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 md:ml-auto">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-2"
                        onClick={exportServicosToPDF}
                        disabled={servicosFiltradasPorStatus.length === 0}
                      >
                        <FileText className="h-4 w-4" />
                        Exportar PDF
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-2"
                        onClick={exportServicosToExcel}
                        disabled={servicosFiltradasPorStatus.length === 0}
                      >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Serviços Recebidos */}
                <div className="px-6 pb-6">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {servicosFiltradasPorStatus.length} serviço(s) nesta aba
                    {totalPagesServicos > 1 ? ` — página ${servicosCurrentPage} de ${totalPagesServicos}` : ""}
                  </p>
                  
                  {(() => {
                    const titulo = selectedOption === "servicos_novos" ? "Serviços Novos" : "Serviços Existentes";
                    return renderServicosTable(titulo, servicosPaginados);
                  })()}

                  {/* Paginação Serviços */}
                  {totalPagesServicos > 1 && (
                    <div className="mt-4 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setServicosCurrentPage(Math.max(1, servicosCurrentPage - 1))}
                              className={servicosCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>

                          {Array.from({ length: totalPagesServicos }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink 
                                onClick={() => setServicosCurrentPage(page)}
                                isActive={page === servicosCurrentPage}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}

                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setServicosCurrentPage(Math.min(totalPagesServicos, servicosCurrentPage + 1))}
                              className={servicosCurrentPage === totalPagesServicos ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Dialog Novo Serviço da Diretoria{/* Dialog Novo Serviço da Diretoria */}
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
                  <div>
                    <label className="text-sm font-medium">Estimativa de Valor (R$)</label>
                    <CurrencyInput
                      value={novoServicoForm.estimativaValor}
                      onChange={(e) => setNovoServicoForm(f => ({ ...f, estimativaValor: e.target.value }))}
                      className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      placeholder="0,00"
                    />
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
                  {!novoServicoLoading ? (
                    <Button
                      onClick={handleCriarServicoDiretoria}
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
                    {actionServicosDialog.action === "devolver" && "Devolver para Rascunho"}
                    {actionServicosDialog.action === "enviar_compras" && "Enviar para Compras"}
                    {actionServicosDialog.action === "analisar" && "Voltar Serviços para Análise"}
                  </DialogTitle>
                  <DialogDescription>
                    {actionServicosDialog.action === "aprovar" && `Aprovar ${selectedServicos.size} serviço(s) selecionado(s)?`}
                    {actionServicosDialog.action === "rejeitar" && `Rejeitar ${selectedServicos.size} serviço(s) selecionado(s)? Por favor, forneça uma justificativa:`}
                    {actionServicosDialog.action === "devolver" && `Devolver ${selectedServicos.size} serviço(s) selecionado(s) para Rascunho? Por favor, forneça uma justificativa:`}
                    {actionServicosDialog.action === "enviar_compras" && `Enviar ${selectedServicos.size} serviço(s) para o setor de Compras?`}
                    {actionServicosDialog.action === "analisar" && `Tem certeza que deseja desfazer a rejeição e retornar os ${selectedServicos.size} serviço(s) selecionado(s) para a aba de Pendentes?`}
                  </DialogDescription>
                </DialogHeader>
                {(actionServicosDialog.action === "rejeitar" || actionServicosDialog.action === "devolver") && (
                  <div className="py-4">
                    <Textarea
                      placeholder="Motivo da ação..."
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
                    disabled={(actionServicosDialog.action === "rejeitar" || actionServicosDialog.action === "devolver") && !justificativa.trim()}
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

  const isPeriodExpired = useMemo(() => {
    if (!periodAtivo?.fim) return false;
    const dataFim = new Date(periodAtivo.fim);
    dataFim.setHours(23, 59, 59, 999);
    return new Date() > dataFim;
  }, [periodAtivo]);

  if (isPeriodExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative flex items-center justify-center p-4 z-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border max-w-lg w-full text-center relative z-10">
          <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mb-6">
            <Lock className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Período Encerrado</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">O prazo para o preenchimento e aprovação do Plano Anual de Contratações foi encerrado. Não é mais possível acessar ou modificar as solicitações.</p>
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
              <Select value={ownGerenciaId} onValueChange={(v) => { setOwnGerenciaId(v); setOwnCurrentPage(1); }}>
                <SelectTrigger className="w-[240px] bg-card">
                  <SelectValue placeholder="Selecione a gerência" />
                </SelectTrigger>
                <SelectContent>
                  {!gerenciasData.some((g: any) => g.sigla === siglaUpper) && (
                    <SelectItem value="diretoria">Diretoria ({siglaUpper})</SelectItem>
                  )}
                  {gerenciasData.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.sigla} - {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={ownShowOnlyZerados ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  const next = !ownShowOnlyZerados;
                  setOwnShowOnlyZerados(next);
                  if (next) setOwnShowOnlyComQuantidade(false);
                  setOwnCurrentPage(1);
                }}
              >
                {ownShowOnlyZerados ? "Mostrando apenas itens zerados" : "Filtrar itens zerados"}
              </Button>
              <Button
                variant={ownShowOnlyComQuantidade ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  const next = !ownShowOnlyComQuantidade;
                  setOwnShowOnlyComQuantidade(next);
                  if (next) setOwnShowOnlyZerados(false);
                  setOwnCurrentPage(1);
                }}
              >
                {ownShowOnlyComQuantidade ? "Mostrando apenas itens com quantidade" : "Filtrar itens com quantidade"}
              </Button>
              <Button
                variant={ownShowOnlyAprovados ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  const next = !ownShowOnlyAprovados;
                  setOwnShowOnlyAprovados(next);
                  setOwnCurrentPage(1);
                }}
              >
                {ownShowOnlyAprovados ? "Mostrando apenas itens aprovados" : "Filtrar aprovados"}
              </Button>
            </div>
          </div>
        </div>

        <PlanFilters
          searchTerm={ownSearchTerm}
          onSearchChange={(v) => { setOwnSearchTerm(v); setOwnCurrentPage(1); }}
          categoria={ownCategoria}
          onCategoriaChange={(v) => { setOwnCategoria(v); setOwnCurrentPage(1); }}
          prioridade={ownPrioridade}
          onPrioridadeChange={(v) => { setOwnPrioridade(v); setOwnCurrentPage(1); }}
          categorias={categoriasItensProprios}
        />

        {ownSearchTerm.trim() === "" && !ownShowOnlyComQuantidade && !ownShowOnlyZerados ? (
          <div className="text-center py-8 bg-card rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">🔍 Digite o código ou descrição para buscar itens do catálogo.</p>
          </div>
        ) : filteredOwnItems.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">Nenhum item encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <>
            {selectedOwnItems.size > 0 && (
              <div className="mb-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  onClick={async () => {
                    if (confirm(`Deseja realmente devolver para rascunho ${selectedOwnItems.size} item(ns) selecionado(s)?`)) {
                      for (const id of selectedOwnItems) {
                        if (typeof id === 'string') {
                          await handleDeleteSolicitacao(id);
                        }
                      }
                      setSelectedOwnItems(new Set());
                    }
                  }}
                >
                  <Undo2 className="h-4 w-4" />
                  Devolver para Rascunho ({selectedOwnItems.size})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-primary border-primary hover:bg-primary/10"
                  onClick={() => {
                    setEditingBulkOwn(true);
                    setBulkEditAquisicaoOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar Selecionados
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-2 bg-success hover:bg-success/90 text-white"
                  onClick={async () => {
                    if (confirm(`Deseja realmente aprovar ${selectedOwnItems.size} item(ns) selecionado(s)?`)) {
                      const idsToApprove = Array.from(selectedOwnItems).filter(id => typeof id === 'string') as string[];
                      if (idsToApprove.length > 0) {
                        try {
                          await updateSolicitacaoStatusBulk(idsToApprove, "aprovado");
                          setSelectedOwnItems(new Set());
                          toast({ title: "Itens aprovados", description: "Os itens selecionados foram aprovados com sucesso." });
                          queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
                        } catch (e) {
                          toast({ title: "Erro", description: "Erro ao aprovar itens.", variant: "destructive" });
                        }
                      }
                    }
                  }}
                >
                  <Send className="h-4 w-4" />
                  Aprovar ({selectedOwnItems.size})
                </Button>
              </div>
            )}
            <PlanTable
              items={ownPaginationData.paginatedItems}
              onUpdateQtdEstimada={handleUpdateQtdEstimadaDiretoria}
              onUpdateUnidade={handleUpdateUnidadeDiretoria}
              onUpdateObservacao={handleUpdateObservacaoDiretoria}
              onUpdatePrioridade={handleUpdatePrioridadeDiretoria}
              onDeleteItem={handleDeleteSolicitacao}
              valorTotal={itensProprios.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0)}
              selectedItems={selectedOwnItems}
              onToggleSelect={(id) => {
                const newSet = new Set(selectedOwnItems);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                setSelectedOwnItems(newSet);
              }}
              onToggleSelectAll={() => {
                const validIds = ownPaginationData.paginatedItems.map(i => i.id || i.codigo).filter(Boolean);
                if (selectedOwnItems.size === validIds.length && validIds.length > 0) {
                  setSelectedOwnItems(new Set());
                } else {
                  setSelectedOwnItems(new Set(validIds));
                }
              }}
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
        <div className="flex flex-wrap items-center gap-4">
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
                if (next) setShowOnlyZerados(false);
              }}
            >
              {showOnlyComQuantidade ? "Mostrando apenas itens com quantidade" : "Filtrar itens com quantidade"}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-2">
        <Tabs
          value={recebidosStatusTab}
          onValueChange={(v) => {
            setRecebidosStatusTab(v as "pendentes" | "aprovados" | "rejeitados" | "em_compra");
            setCurrentPage(1);
            setSelectedItems(new Set());
          }}
        >
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="pendentes" className="gap-2">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              Pendentes
              <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                {recebidosTabCounts.pendentes}
              </span>
            </TabsTrigger>
            <TabsTrigger value="aprovados" className="gap-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              Aprovados
              <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                {recebidosTabCounts.aprovados}
              </span>
            </TabsTrigger>
            <TabsTrigger value="rejeitados" className="gap-2">
              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              Rejeitados
              <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                {recebidosTabCounts.rejeitados}
              </span>
            </TabsTrigger>
            <TabsTrigger value="em_compra" className="gap-2">
              <ShoppingCart className="h-4 w-4 shrink-0 text-sky-600" />
              Em compras
              <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums">
                {recebidosTabCounts.em_compra}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="mt-2 text-xs text-muted-foreground">
          {recebidosStatusTab === "pendentes" &&
            "Itens com status Enviado ou Em análise: use os checkboxes ou Aprovar todos / Rejeitar. Itens já rejeitados ou em compras aparecem nas outras abas."}
          {recebidosStatusTab === "aprovados" &&
            "Itens aprovados: selecione para enviar ao setor de Compras quando estiver pronto."}
          {recebidosStatusTab === "rejeitados" &&
            "Itens rejeitados: você pode selecionar itens para aprovar (recuperar) ou excluir permanentemente da lista."}
          {recebidosStatusTab === "em_compra" &&
            "Itens já encaminhados às compras ou concluídos (somente consulta)."}
        </p>
      </div>

      {recebidosTableItems.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground bg-white rounded-lg border mt-4 mx-6">
          {isSolicitacoesLoading ? "Carregando solicitações..." : "Nenhum item nesta lista para os filtros atuais."}
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
                  disabled={selectableItems.length === 0}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size > 0 ? `${selectedItems.size} selecionado(s)` : "Selecionar todos"}
                </span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                {selectedItems.size > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setActionDialog({ open: true, action: "aprovar", isBulk: false })}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar Selecionados ({selectedItems.size})
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setConfirmComprasOpen(true)}
                  disabled={selectedApprovedItems.length === 0 || recebidosStatusTab !== "aprovados"}
                >
                  <Send className="h-4 w-4" />
                  Enviar para Compras ({selectedApprovedItems.length})
                </Button>

                {recebidosStatusTab === "pendentes" && selectedItems.size === 0 && (
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="gap-2"
                    onClick={() => setActionDialog({ open: true, action: "aprovar", isBulk: true })}
                    disabled={!filteredItems.some(isPendenteDiretoriaAprovacao)}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar todos
                  </Button>
                )}

                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => setActionDialog({ open: true, action: "rejeitar", isBulk: false })}
                  disabled={selectedItems.size === 0 || recebidosStatusTab === "rejeitados"}
                >
                  <XCircle className="h-4 w-4" />
                  Rejeitar ({selectedItems.size})
                </Button>

                {(recebidosStatusTab === "pendentes" || recebidosStatusTab === "rejeitados") && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-2 text-primary border-primary hover:bg-primary/10"
                      onClick={() => {
                        setEditingBulkOwn(false);
                        setBulkEditAquisicaoOpen(true);
                      }}
                      disabled={selectedItems.size === 0}
                    >
                      <Pencil className="h-4 w-4" />
                      Editar Selecionados
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => setActionDialog({ open: true, action: "devolver", isBulk: false })}
                      disabled={selectedItems.size === 0}
                    >
                      <Undo2 className="h-4 w-4" />
                      Devolver para Rascunho ({selectedItems.size})
                    </Button>
                  </>
                )}

                {recebidosStatusTab === "rejeitados" && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => setActionDialog({ open: true, action: "analisar", isBulk: false })}
                      disabled={selectedItems.size === 0}
                    >
                      <Undo2 className="h-4 w-4" />
                      Voltar para Pendentes ({selectedItems.size})
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 md:ml-auto">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-2"
                  onClick={exportToPDF}
                  disabled={recebidosTableItems.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-2"
                  onClick={exportToExcel}
                  disabled={recebidosTableItems.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="px-6 pb-6">
            <p className="mb-2 text-xs text-muted-foreground">
              {recebidosTableItems.length} item(ns) nesta aba
              {totalPages > 1 ? ` — página ${currentPage} de ${totalPages}` : ""}
            </p>
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 text-left w-12">
                        <Checkbox 
                          checked={selectedItems.size === selectableItems.length && selectableItems.length > 0}
                          onCheckedChange={toggleSelectAll}
                          disabled={selectableItems.length === 0}
                        />
                      </th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Cód.</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Gerência</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Prioridade</th>
                      <th className="p-3 text-center text-xs font-medium text-muted-foreground">Qtd.</th>
                      <th className="p-3 text-left text-xs font-medium text-muted-foreground">Unidade</th>
                      <th className="p-3 text-right text-xs font-medium text-muted-foreground">Valor Unit.</th>
                      <th className="p-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                      <th className="p-3 text-center text-xs font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item, index) => (
                      <tr 
                        key={item.id ?? `row-${item.codigo}-${item.gerencia}-${index}`}
                        className={`border-b hover:bg-muted/30 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                      >
                        <td className="p-3">
                          <Checkbox 
                            checked={Boolean(item.id && selectedItems.has(item.id))}
                            onCheckedChange={() => {
                              if (item.id) toggleSelectItem(item.id);
                            }}
                            disabled={isItemReadOnly(item) || !item.id}
                          />
                        </td>
                        <td className="p-3 text-sm font-mono">{item.codigo}</td>
                        <td className="p-3 text-sm max-w-sm" title={item.descricao}>
                          <p className="font-medium line-clamp-2">{item.descricao}</p>
                          <p className="text-xs text-muted-foreground">{item.categoria}</p>
                        </td>
                        <td className="p-3 text-sm">{item.gerencia}</td>
                        <td className="p-3">
                          <Badge variant={getStatusBadgeVariant(item.status || "rascunho") as any}>
                            {getStatusLabel(item.status || "rascunho")}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {isItemReadOnly(item) ? (
                            <Badge variant={getPrioridadeBadgeVariant(item.prioridade) as any}>
                              {item.prioridade}
                            </Badge>
                          ) : (
                            <Select value={item.prioridade} onValueChange={(value) => handleUpdatePrioridade(item.id!, value as any)}>
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
                              defaultValue={item.qtdEstimada === 0 ? "" : item.qtdEstimada}
                              onBlur={(e) => handleUpdateQtdEstimada(item.id!, Number(e.target.value))}
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
                        <td className="p-3 text-right text-sm">
                          R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right text-sm font-medium">
                          R$ {(item.qtdEstimada * item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            {item.id && (
                              <>
                                {!isItemReadOnly(item) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Editar"
                                    onClick={() => openSolicitacaoEditor(item)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {(!isItemReadOnly(item) || item.status === "rejeitado") && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    title="Devolver para Rascunho"
                                    onClick={() => handleDeleteSolicitacao(item.id!)}
                                  >
                                    <Undo2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
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
              {actionDialog.action === "devolver" && "Devolver Solicitações para Rascunho"}
              {actionDialog.action === "analisar" && "Voltar Solicitações para Análise"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === "aprovar" && `Tem certeza que deseja aprovar ${actionDialog.isBulk ? 'todas as solicitações pendentes' : 'as solicitações selecionadas'}?`}
              {actionDialog.action === "rejeitar" && `Por favor, forneça uma justificativa para a rejeição (opcional):`}
              {actionDialog.action === "devolver" && `Tem certeza que deseja devolver as solicitações selecionadas para Rascunho (retornando-as para a Gerência)?`}
              {actionDialog.action === "analisar" && `Tem certeza que deseja desfazer a rejeição e retornar os itens selecionados para a aba de Pendentes?`}
            </DialogDescription>
          </DialogHeader>

          {(actionDialog.action === "rejeitar" || actionDialog.action === "devolver") && (
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
              disabled={(actionDialog.action === "rejeitar" || actionDialog.action === "devolver") && !justificativa.trim()}
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
      
      {/* DIALOGS DE EDIÇÃO EM LOTE */}
      <BulkEditAquisicaoDialog 
        open={bulkEditAquisicaoOpen} 
        onOpenChange={setBulkEditAquisicaoOpen} 
        selectedCount={editingBulkOwn ? selectedOwnItems.size : selectedItems.size} 
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
    </div>
    </div>
  );
};

export default DiretoriaAprovacao;
