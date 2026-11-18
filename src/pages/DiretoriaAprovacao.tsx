import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Plus, Home, Check, X, Send, Download, FileText, Pencil, Trash2, Clock, ShoppingCart, FileSpreadsheet, FileDown, Undo2, ArrowUp, ArrowDown, ArrowUpDown, Search, Lock, ArrowRightLeft, Loader2 } from "lucide-react";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AccessCodeScreen } from "@/components/ui/AccessCodeScreen";
import { PlanItem, SolicitacaoStatus, ServicoItem, GrauPrioridade, Diretoria, Gerencia } from "@/types/plan";
import { useMaterialDescriptions } from "@/hooks/useMaterialDescriptions";
import { useActivityRestrictions } from "@/hooks/useActivityRestrictions";
import getItensCatalogo, { parseSafeNumber, getAdminMiniErpConfigDb, getCategoryBudgetOwnerRules, getDiretorias, getSolicitacoesByDiretoria, getPeriodosAtivos, getGerenciasByDiretoria, getTodasGerencias, updateSolicitacaoStatus, updateSolicitacaoStatusBulk, updateSolicitacoesBulkData, updateSolicitacao, deleteSolicitacao, deleteSolicitacoesBulk, createSolicitacao, getServicosByDiretoria, getServicosCatalogo, updateServico, deleteServico, deleteServicosBulk, updateServicosBulkData, createServico, updateServicoStatusBulk, registrarLogAtividade, transferirSolicitacoesParaGerenciaBulk, transferirServicosParaGerenciaBulk, transferirCategoriaAquisicao, transferirContratoServicos } from "@/lib/services";
import { BulkEditAquisicaoDialog, BulkEditServicosDialog } from "@/components/common/BulkActionDialogs";
import { ServicoEditDialog, AquisicaoEditDialog } from "@/components/common/ItemEditDialogs";
import { DesfazerTransferenciaDialog } from "@/components/common/DesfazerTransferenciaDialog";
import { GERENCIA_NOME_POR_SIGLA, DIRETORIA_GERENCIAS } from "@/data/gerencias";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SummaryCards } from "@/components/common/SummaryCards";
import { PlanFilters } from "@/components/forms/PlanFilters";
import { PlanTable } from "@/components/tables/PlanTable";
import { ServicosTable } from "@/components/tables/ServicosTable";
import { BudgetConsumptionCard } from "@/components/features/orcamento/BudgetConsumptionCard";
import { DiretoriaVisaoGerencial } from "@/components/features/diretoria/DiretoriaVisaoGerencial";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SortableWrapper, SortableTableHead } from "@/components/ui/sortable-table-head";
import { useToast } from "@/hooks/use-toast";
import { getBudgetOwnerDiretoriaId, getDiretoriaBudget, loadAdminBudgetConfig } from "@/lib/adminBudgetConfig";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade";
import { formatContratoMask } from "@/lib/utils";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { SmartPagination } from "@/components/common/SmartPagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebounce } from "@/hooks/useDebounce";


/** Itens aguardando decisão da diretoria (podem ser aprovados ou rejeitados em massa). */
function isPendenteDiretoriaAprovacao(item: PlanItem) {
  return item.status === "enviado" || item.status === "em_analise" || (item.status === "rascunho" && Boolean(item.observacao && item.observacao.includes("[Transferido")));
}

/** Serviços aguardando decisão da diretoria */
function isPendenteServicoAprovacao(servico: ServicoItem) {
  return servico.status === "enviado" || servico.status === "em_analise" || (servico.status === "rascunho" && Boolean(servico.observacao && servico.observacao.includes("[Transferido")));
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
  const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | "servicos_existentes" | "servicos_novos" | "visao_gerencial" | null>(null);
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
  const [ownServicosGerenciaId, setOwnServicosGerenciaId] = useState<string>("todas");
  const [servicosSortOrder, setServicosSortOrder] = useState<"asc" | "desc" | null>(null);
  const [ownServicosSearchTerm, setOwnServicosSearchTerm] = useState("");
  const debouncedOwnServicosSearchTerm = useDebounce(ownServicosSearchTerm, 300);
  const [ownServicosCurrentPage, setOwnServicosCurrentPage] = useState(1);
  const [recebidosSearchTerm, setRecebidosSearchTerm] = useState("");
  const debouncedRecebidosSearchTerm = useDebounce(recebidosSearchTerm, 300);
  const [servicosRecebidosSearchTerm, setServicosRecebidosSearchTerm] = useState("");
  const debouncedServicosRecebidosSearchTerm = useDebounce(servicosRecebidosSearchTerm, 300);
  const [showOnlyComQuantidade, setShowOnlyComQuantidade] = useState(false);
  const [showOnlyZerados, setShowOnlyZerados] = useState(false);
  const [showOnlyTransferidos, setShowOnlyTransferidos] = useState(false);
  const [showOnlyTransferidosServicos, setShowOnlyTransferidosServicos] = useState(false);
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

  const [actionOwnDialog, setActionOwnDialog] = useState<{
    open: boolean;
    action: "aprovar" | "rejeitar" | "devolver" | "analisar" | null;
  }>({ open: false, action: null });

  // Estado do diálogo de Transferir para Gerência / Diretoria
  const [filtroCategoriaTransfer, setFiltroCategoriaTransfer] = useState("");
  const [filtroContratoTransfer, setFiltroContratoTransfer] = useState("");
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    tipo: "aquisicao" | "servicos_existentes" | "servicos_novos";
    item: PlanItem | ServicoItem | null;
    isBulk?: boolean;
    bulkSource?: "aquisicao_proprios" | "aquisicao_recebidos" | "servicos_proprios" | "servicos_recebidos";
    bulkCount?: number;
    modo?: "item" | "bulk" | "categoria" | "contrato";
    selectedCategoria?: string;
    selectedCategorias?: string[];
    selectedContrato?: string;
    selectedContratos?: string[];
    sourceDiretoriaId?: string;
    targetDiretoriaId?: string;
    targetDiretoriaIds?: string[];
    targetGerenciaId: string;
    targetGerenciaIds?: string[];
    incluirCustoFinanceiro?: boolean;
    loading: boolean;
  }>({
    open: false,
    tipo: "aquisicao",
    item: null,
    isBulk: false,
    modo: "item",
    selectedCategorias: [],
    selectedContratos: [],
    sourceDiretoriaId: "",
    targetDiretoriaId: "",
    targetDiretoriaIds: [],
    targetGerenciaId: "",
    targetGerenciaIds: [],
    incluirCustoFinanceiro: true,
    loading: false,
  });

  const [desfazerTransferDialog, setDesfazerTransferDialog] = useState<{
    open: boolean;
    tipo: "aquisicao" | "servicos";
  }>({
    open: false,
    tipo: "aquisicao",
  });

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
    contrato: "",
    tipoContratacao: "Contínuo",
    gerenciaId: "",
    previsaoInicio: "",
    estimativaValor: "",
    dotacaoOrcamentaria: "",
    grauPrioridade: "Médio" as GrauPrioridade,
    vinculacao: "Não" as "Sim" | "Não",
    dependenciaDescricao: "",
    contratada: "",
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

  // Buscar todas as gerências
  const { data: todasGerenciasData = [] } = useQuery<any[]>({
    queryKey: ["todas-gerencias"],
    queryFn: getTodasGerencias,
    staleTime: 5 * 60 * 1000,
  });

  // Criar mapa global de gerencia_id -> diretoria_id e sigla
  const globalGerenciaMap = useMemo(() => {
    const map: Record<string, { sigla: string, diretoria_id: string }> = {};
    (todasGerenciasData as any[]).forEach((g: any) => {
      if (g.id) {
        map[g.id] = { sigla: g.sigla, diretoria_id: g.diretoria_id };
        map[String(g.id).toLowerCase()] = { sigla: g.sigla, diretoria_id: g.diretoria_id };
      }
      if (g.sigla) {
        map[g.sigla] = { sigla: g.sigla, diretoria_id: g.diretoria_id };
        map[String(g.sigla).toLowerCase()] = { sigla: g.sigla, diretoria_id: g.diretoria_id };
      }
    });
    // Mapeamento defensivo para diretorias (quando o item aponta diretamente para a diretoria)
    (diretorias as any[]).forEach((d: any) => {
      if (d.id && !map[d.id]) {
        map[d.id] = { sigla: d.sigla, diretoria_id: d.id };
        map[String(d.id).toLowerCase()] = { sigla: d.sigla, diretoria_id: d.id };
      }
      if (d.sigla && !map[d.sigla]) {
        map[d.sigla] = { sigla: d.sigla, diretoria_id: d.id };
        map[String(d.sigla).toLowerCase()] = { sigla: d.sigla, diretoria_id: d.id };
      }
    });
    return map;
  }, [todasGerenciasData, diretorias]);

  // Buscar gerências desta diretoria
  const { data: gerenciasData = [] } = useQuery<any[]>({
    queryKey: ["gerencias", diretoria?.id],
    queryFn: () => diretoria ? getGerenciasByDiretoria(diretoria.id) : Promise.resolve([]),
    enabled: !!diretoria,
    staleTime: 5 * 60 * 1000,
  });

  // Lista consolidada de todas as gerências desta diretoria
  const todasGerenciasDaDiretoria = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. Dos dados de gerenciasData (vindos de getGerenciasByDiretoria)
    (gerenciasData as any[]).forEach((g: any) => {
      const sig = (g.sigla || "").toUpperCase();
      if (sig && !seen.has(sig)) {
        seen.add(sig);
        list.push({
          id: g.id || sig,
          sigla: sig,
          nome: g.nome || GERENCIA_NOME_POR_SIGLA[sig] || sig,
          diretoria_id: g.diretoria_id || diretoria?.id,
        });
      }
    });

    // 2. De todasGerenciasData que pertençam a esta diretoria (por id ou sigla)
    (todasGerenciasData as any[]).forEach((g: any) => {
      const sig = (g.sigla || "").toUpperCase();
      const belongs = 
        (diretoria?.id && String(g.diretoria_id) === String(diretoria.id)) ||
        (g.diretoria_sigla && String(g.diretoria_sigla).toUpperCase() === siglaUpper) ||
        (g.diretoria && String(g.diretoria).toUpperCase() === siglaUpper);

      if (belongs && sig && !seen.has(sig)) {
        seen.add(sig);
        list.push({
          id: g.id || sig,
          sigla: sig,
          nome: g.nome || GERENCIA_NOME_POR_SIGLA[sig] || sig,
          diretoria_id: g.diretoria_id || diretoria?.id,
        });
      }
    });

    // 3. De DIRETORIA_GERENCIAS da siglaUpper (garante 100% que todas as gerências oficiais existam no select!)
    const siglasOficiais = DIRETORIA_GERENCIAS[siglaUpper] || [];
    siglasOficiais.forEach((sig) => {
      const sigUpper = sig.toUpperCase();
      if (!seen.has(sigUpper)) {
        seen.add(sigUpper);
        const gDb = (todasGerenciasData as any[]).find((g: any) => (g.sigla || "").toUpperCase() === sigUpper);
        list.push({
          id: gDb?.id || sigUpper,
          sigla: sigUpper,
          nome: gDb?.nome || GERENCIA_NOME_POR_SIGLA[sigUpper] || sigUpper,
          diretoria_id: gDb?.diretoria_id || diretoria?.id,
        });
      }
    });

    return list.sort((a, b) => a.sigla.localeCompare(b.sigla));
  }, [gerenciasData, todasGerenciasData, diretoria, siglaUpper]);

  // Criar mapa de gerencia_id -> sigla
  const gerenciaMap = useMemo(() => {
    const map: Record<string, string> = {};
    (todasGerenciasData as any[]).forEach((g: any) => {
      if (g.id && g.sigla) {
        map[g.id] = g.sigla;
        map[String(g.id).toLowerCase()] = g.sigla;
      }
      if (g.sigla) {
        map[g.sigla] = g.sigla;
      }
    });
    todasGerenciasDaDiretoria.forEach((g: any) => {
      if (g.id && g.sigla) {
        map[g.id] = g.sigla;
        map[String(g.id).toLowerCase()] = g.sigla;
      }
      if (g.sigla) {
        map[g.sigla] = g.sigla;
      }
    });
    // Mapeamento defensivo para todas as diretorias
    (diretorias as any[]).forEach((d: any) => {
      if (d.id && !map[d.id]) {
        map[d.id] = d.sigla;
        map[String(d.id).toLowerCase()] = d.sigla;
      }
      if (d.sigla && !map[d.sigla]) {
        map[d.sigla] = d.sigla;
        map[String(d.sigla).toLowerCase()] = d.sigla;
      }
    });
    return map;
  }, [todasGerenciasData, todasGerenciasDaDiretoria, diretorias]);

  useEffect(() => {
    if (ownGerenciaId === "diretoria" && todasGerenciasDaDiretoria.length > 0) {
      const dgGerencia = todasGerenciasDaDiretoria.find((g: any) => g.sigla === siglaUpper);
      if (dgGerencia) {
        setOwnGerenciaId(dgGerencia.id);
      }
    }
  }, [todasGerenciasDaDiretoria, ownGerenciaId, siglaUpper]);

  // Criar mapa de sigla -> nome de gerência
  const siglaToNome = useMemo(() => {
    const map: Record<string, string> = {};
    (todasGerenciasDaDiretoria as any[]).forEach((g: any) => {
      map[g.sigla] = g.nome;
    });
    return map;
  }, [todasGerenciasDaDiretoria]);

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

  const { isBlocked, getBlockReason } = useActivityRestrictions({
    periodoId: periodAtivo?.id,
    diretoriaId: diretoria?.id,
    perfil: "diretoria",
  });

  const isAprovarAquisicaoBlocked = isBlocked("aprovacao", "aprovar") || isBlocked("aquisicao", "aprovar") || isBlocked("todos", "aprovar");
  const isRejeitarAquisicaoBlocked = isBlocked("aprovacao", "reprovar") || isBlocked("aquisicao", "reprovar") || isBlocked("todos", "reprovar");
  const isDevolverAquisicaoBlocked = isBlocked("aprovacao", "devolver") || isBlocked("aquisicao", "devolver") || isBlocked("aquisicao", "devolver_solicitacao") || isBlocked("todos", "devolver");
  const isEnviarComprasBlocked = isBlocked("aprovacao", "enviar_compras") || isBlocked("aquisicao", "enviar_compras") || isBlocked("compras", "enviar_compras") || isBlocked("todos", "enviar_compras");
  const isAddPlanoProprioBlocked = isBlocked("aprovacao", "adicionar_item") || isBlocked("aquisicao", "adicionar_item") || isBlocked("todos", "adicionar_item");
  const isEditarAquisicaoBlocked = isBlocked("aprovacao", "editar_item") || isBlocked("aquisicao", "alterar_quantidade") || isBlocked("aquisicao", "editar_item") || isBlocked("todos", "editar_item") || isBlocked("todos", "alterar_quantidade");

  const isAprovarServicosBlocked = isBlocked("aprovacao", "aprovar") || isBlocked("servicos_existentes", "aprovar") || isBlocked("servicos_novos", "aprovar") || isBlocked("todos", "aprovar");
  const isRejeitarServicosBlocked = isBlocked("aprovacao", "reprovar") || isBlocked("servicos_existentes", "reprovar") || isBlocked("servicos_novos", "reprovar") || isBlocked("todos", "reprovar");
  const isDevolverServicosBlocked = isBlocked("aprovacao", "devolver") || isBlocked("servicos_existentes", "devolver") || isBlocked("servicos_novos", "devolver") || isBlocked("servicos_existentes", "devolver_solicitacao") || isBlocked("servicos_novos", "devolver_solicitacao") || isBlocked("todos", "devolver");
  const isAddNovoServicoBlocked = isBlocked("servicos_novos", "adicionar_novo_servico") || isBlocked("servicos_novos", "adicionar_item") || isBlocked("aprovacao", "adicionar_servico") || isBlocked("aprovacao", "adicionar_item") || isBlocked("todos", "adicionar_item");
  const isEditarServicosBlocked = isBlocked("aprovacao", "editar_item") || isBlocked("servicos_existentes", "alterar_valor") || isBlocked("servicos_novos", "alterar_valor") || isBlocked("servicos_existentes", "editar_item") || isBlocked("servicos_novos", "editar_item") || isBlocked("todos", "editar_item") || isBlocked("todos", "alterar_valor");

  const isAnyAquisicaoActionBlocked = isAprovarAquisicaoBlocked || isRejeitarAquisicaoBlocked || isDevolverAquisicaoBlocked || isEnviarComprasBlocked || isAddPlanoProprioBlocked || isEditarAquisicaoBlocked;
  const isAnyServicosActionBlocked = isAprovarServicosBlocked || isRejeitarServicosBlocked || isDevolverServicosBlocked || isAddNovoServicoBlocked || isEditarServicosBlocked;

  const isPeriodExpired = useMemo(() => {
    if (!periodAtivo?.fim) return false;
    const dataFim = new Date(periodAtivo.fim);
    dataFim.setHours(23, 59, 59, 999);
    return new Date() > dataFim;
  }, [periodAtivo]);

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
    enabled: !!diretoria && !!periodAtivo,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });


  // Buscar itens do catalogo (banco)
  const { data: catalogoData = [] } = useQuery({
    queryKey: ["itens-catalogo"],
    queryFn: getItensCatalogo,
    enabled: !!authenticated,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });

  const { data: servicosCatalogoData = [] } = useQuery({
    queryKey: ["servicos-catalogo"],
    queryFn: getServicosCatalogo,
    enabled: !!authenticated,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Listener para sincronização automática quando serviços forem atualizados no Painel Administrativo
  useEffect(() => {
    const handleServicosCatalogoUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: servicosQueryKey });
    };

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === "servicos_catalogo_last_updated") {
        queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
        queryClient.invalidateQueries({ queryKey: servicosQueryKey });
      }
    };

    window.addEventListener("servicos_catalogo_updated", handleServicosCatalogoUpdate);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener("servicos_catalogo_updated", handleServicosCatalogoUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, [queryClient, servicosQueryKey]);

  const servicosCatalogoSet = useMemo(() => {
    return new Set((servicosCatalogoData as any[]).map(c => String(c.item || "").trim()));
  }, [servicosCatalogoData]);

  const servicosCatalogoExistentesSet = useMemo(() => {
    return new Set(
      (servicosCatalogoData as any[])
        .filter(c => {
          const contrato = String(c.contrato || "").trim();
          const contratada = String(c.contratada || "").trim();
          const hasContrato = (contrato !== "" && contrato !== "-") || (contratada !== "" && contratada !== "-");
          if (hasContrato) return true;
          const itemNum = Number(c.item);
          if (!isNaN(itemNum) && itemNum >= 9000000) return false;
          return String(c.tipo_contratacao || c.tipoContratacao || "").trim().toLowerCase() !== "novo";
        })
        .map(c => String(c.item || "").trim())
    );
  }, [servicosCatalogoData]);

  const servicosCatalogoNovosSet = useMemo(() => {
    return new Set(
      (servicosCatalogoData as any[])
        .filter(c => {
          const contrato = String(c.contrato || "").trim();
          const contratada = String(c.contratada || "").trim();
          const hasContrato = (contrato !== "" && contrato !== "-") || (contratada !== "" && contratada !== "-");
          if (hasContrato) return false;
          const itemNum = Number(c.item);
          if (!isNaN(itemNum) && itemNum >= 9000000) return true;
          return String(c.tipo_contratacao || c.tipoContratacao || "").trim().toLowerCase() === "novo";
        })
        .map(c => String(c.item || "").trim())
    );
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
      map[String(dir.id).toLowerCase()] = dir;
      if (dir.sigla) {
        map[dir.sigla] = dir;
        map[dir.sigla.toUpperCase()] = dir;
        map[dir.sigla.toLowerCase()] = dir;
      }
    });
    return map;
  }, [diretorias]);

  // Converter solicitações para o formato de PlanItem (apenas itens enviados para fluxo de aprovação)
  const items: PlanItem[] = useMemo(() => {
    if (!diretoria) return [];

    const catalogoByCodigoMap = new Map<number, any>();
    const catalogoByIdMap = new Map<string, any>();
    (catalogoData as any[]).forEach((c) => {
      if (c.id) catalogoByIdMap.set(String(c.id).toLowerCase(), c);
      const cCode = Number(c.codigo);
      if (!isNaN(cCode) && cCode > 0) catalogoByCodigoMap.set(cCode, c);
    });

    return solicitacoes
      .filter((s: any) =>
        s.qtd_estimada >= 0 &&
        (
          ["enviado", "em_analise", "aprovado", "rejeitado", "em_compra", "concluido"].includes(s.status) ||
          Boolean(s.observacao && s.observacao.includes("[Transferido"))
        )
      )
      .map((s: any) => {
        const rawCode = s.codigo ?? s.item?.codigo ?? 0;
        const codigo = Number(rawCode) || 0;
        const catItem = (codigo > 0 ? catalogoByCodigoMap.get(codigo) : undefined) || (s.item_id ? catalogoByIdMap.get(String(s.item_id).toLowerCase()) : undefined) || s.item;
        const descFromMap = codigo > 0 ? (materialDescriptions[String(codigo)] || "") : "";
        const rawDesc = catItem?.descricao || s.descricao || s.item?.descricao || "";
        const isDescUnspecified = !rawDesc || rawDesc.trim().toLowerCase() === "diversos" || rawDesc.trim().toLowerCase() === "material não especificado";
        const descricao = !isDescUnspecified
          ? rawDesc
          : (descFromMap || "Não identificado");
        const categoriaItem = catItem?.categoria || ((typeof s.categoria === "string" && s.categoria.trim().length > 0 && s.categoria !== "diversos")
          ? s.categoria
          : (s.item?.categoria || "MATERIAIS DE CUSTEIO"));
        const trueRequesterDiretoriaId = globalGerenciaMap[s.gerencia_id]?.diretoria_id || s.diretoria_id;
        
        const diretoriaOrcamentariaIdRaw = getBudgetOwnerDiretoriaId(
          orcamentoConfig,
          categoriaItem,
          trueRequesterDiretoriaId,
          categoryBudgetOwnersFromDb,
        );
        // Fallback defensivo: evita sumir com itens quando a regra aponta para diretoria inexistente.
        const diretoriaOrcamentariaId = diretoriaMap[diretoriaOrcamentariaIdRaw]
          ? diretoriaOrcamentariaIdRaw
          : trueRequesterDiretoriaId;
        const diretoriaSolicitante = diretoriaMap[trueRequesterDiretoriaId];
        const diretoriaOrcamentaria = diretoriaMap[diretoriaOrcamentariaId];
        const valUnit = parseSafeNumber(catItem?.valor_unitario !== undefined && Number(catItem?.valor_unitario) > 0 ? catItem.valor_unitario : (s.valor_unitario !== undefined ? s.valor_unitario : (s.item?.valor_unitario || 0)), 0);

        const resolvedGerencia = 
          (globalGerenciaMap[s.gerencia_id]?.sigla && globalGerenciaMap[s.gerencia_id]?.sigla !== "N/A" ? globalGerenciaMap[s.gerencia_id]?.sigla : undefined) ||
          (gerenciaMap[s.gerencia_id] && gerenciaMap[s.gerencia_id] !== "N/A" ? gerenciaMap[s.gerencia_id] : undefined) ||
          (gerenciaMap[s.gerencia] && gerenciaMap[s.gerencia] !== "N/A" ? gerenciaMap[s.gerencia] : undefined) ||
          diretoriaMap[s.gerencia_id]?.sigla ||
          (s.gerencia && !String(s.gerencia).includes("-") && s.gerencia !== "N/A" ? s.gerencia : undefined) ||
          (s.unidade_demandante && !String(s.unidade_demandante).includes("-") && s.unidade_demandante !== "N/A" ? s.unidade_demandante : undefined) ||
          diretoriaSolicitante?.sigla ||
          diretoriaMap[s.diretoria_id]?.sigla ||
          s.diretoriaSigla ||
          siglaUpper;

        return {
          id: s.id,
          codigo,
          descricao,
          categoria: categoriaItem,
          gerencia: resolvedGerencia,
          prioridade: s.prioridade || "Média",
          qtdEstimada: parseSafeNumber(s.qtd_estimada !== undefined ? s.qtd_estimada : (s.qtdEstimada || 0), 0),
          unidade: catItem?.unidade || s.unidade || s.item?.unidade || "un",
          valorUnitario: valUnit,
          observacao: s.observacao || "",
          status: s.status as SolicitacaoStatus,
          justificativaRejeicao: s.justificativa_rejeicao || s.justificativaRejeicao || "",
          diretoriaSigla: diretoriaSolicitante?.sigla,
          diretoriaOrcamentariaId,
          diretoriaOrcamentariaSigla: diretoriaOrcamentaria?.sigla || diretoriaSolicitante?.sigla,
          isOrcamentoCompartilhado: diretoriaSolicitante?.id !== diretoriaOrcamentariaId,
          gerencia_id: s.gerencia_id,
          diretoria_id: s.diretoria_id,
        };
      });
  }, [solicitacoes, diretoria, globalGerenciaMap, orcamentoConfig, diretoriaMap, categoryBudgetOwnersFromDb, materialDescriptions, gerenciaMap, catalogoData, siglaUpper]);

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
      const rawCode = s.codigo ?? s.item?.codigo ?? 0;
      const codigo = Number(rawCode) || 0;
      const descFromMap = codigo > 0 ? (materialDescriptions[String(codigo)] || "") : "";
      const rawDesc = s.descricao || s.item?.descricao || "";
      const isDescUnspecified = !rawDesc || rawDesc.trim().toLowerCase() === "diversos" || rawDesc.trim().toLowerCase() === "material não especificado";
      const descricao = !isDescUnspecified
        ? rawDesc
        : (descFromMap || "Não identificado");
      const resolvedGerProprio = 
        (globalGerenciaMap[s.gerencia_id]?.sigla && globalGerenciaMap[s.gerencia_id]?.sigla !== "N/A" ? globalGerenciaMap[s.gerencia_id]?.sigla : undefined) ||
        (gerenciaMap[s.gerencia_id] && gerenciaMap[s.gerencia_id] !== "N/A" ? gerenciaMap[s.gerencia_id] : undefined) ||
        (gerenciaMap[s.gerencia] && gerenciaMap[s.gerencia] !== "N/A" ? gerenciaMap[s.gerencia] : undefined) ||
        diretoriaMap[s.gerencia_id]?.sigla ||
        (s.gerencia && !String(s.gerencia).includes("-") && s.gerencia !== "N/A" ? s.gerencia : undefined) ||
        diretoriaMap[s.diretoria_id]?.sigla ||
        siglaUpper;

      latestByCodigo.set(codigo, {
        id: s.id,
        codigo,
        descricao,
        categoria: (typeof s.categoria === "string" && s.categoria.trim().length > 0 && s.categoria !== "diversos") ? s.categoria : (s.item?.categoria || "MATERIAIS DE CUSTEIO"),
        gerencia: resolvedGerProprio,
        prioridade: s.prioridade || "Média",
        qtdEstimada: parseSafeNumber(s.qtd_estimada !== undefined ? s.qtd_estimada : (s.qtdEstimada || 0), 0),
        unidade: s.unidade || s.item?.unidade || "un",
        valorUnitario: parseSafeNumber(s.valor_unitario !== undefined ? s.valor_unitario : (s.item?.valor_unitario || 0), 0),
        observacao: s.observacao || "",
        status: s.status as SolicitacaoStatus,
        justificativaRejeicao: "",
        gerencia_id: s.gerencia_id,
      });
    });

    return Array.from(latestByCodigo.values());
  }, [solicitacoes, diretoria, globalGerenciaMap, gerenciaMap, diretoriaMap, materialDescriptions, siglaUpper]);

  const formatCurrency = (value: any) => {
    const num = parseSafeNumber(value, 0);
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const gerencias = useMemo(() => {
    const unique = [...new Set(items.map((i) => i.gerencia))].filter(g => g !== "N/A");
    return unique.sort();
  }, [items]);

  const catalogItems: PlanItem[] = useMemo(() => {
    return catalogoData.map((item: any) => ({
      codigo: Number(item.codigo) || 0,
      descricao: item.descricao,
      categoria: item.categoria || "MATERIAIS DE CUSTEIO",
      unidade: item.unidade || "un",
      qtdEstimada: 0,
      valorUnitario: parseSafeNumber(item.valor_unitario, 0),
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
    if (addDialogOpen && !selectedGerenciaId && todasGerenciasDaDiretoria.length > 0) {
      setSelectedGerenciaId(todasGerenciasDaDiretoria[0].id);
    }
  }, [addDialogOpen, selectedGerenciaId, todasGerenciasDaDiretoria]);

  useEffect(() => {
    if (selectedOption === "servicos") {
      setSelectedServicos(new Set());
    }
  }, [selectedOption]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (selectedGerencia && selectedGerencia !== "todas") {
      filtered = filtered.filter((i) => i.gerencia === selectedGerencia);
    }
    if (selectedCategoria && selectedCategoria !== "todas") {
      filtered = filtered.filter((i) => i.categoria === selectedCategoria);
    }
    if (showOnlyZerados) {
      filtered = filtered.filter((i) => i.qtdEstimada === 0);
    }
    if (showOnlyComQuantidade) {
      filtered = filtered.filter((i) => i.qtdEstimada > 0);
    }
    if (showOnlyTransferidos) {
      filtered = filtered.filter((i) => Boolean(i.observacao && i.observacao.includes("[Transferido")));
    }
    const term = debouncedRecebidosSearchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((i) => {
        const isUnidentifiedCode = !i.codigo || Number(i.codigo) <= 0;
        const matchesCodeText = isUnidentifiedCode && "não identificado".includes(term);
        const matchesDesc = i.descricao ? i.descricao.toLowerCase().includes(term) : false;
        const matchesCode = i.codigo && Number(i.codigo) > 0 ? i.codigo.toString().includes(term) : false;
        const matchesGerencia = i.gerencia ? i.gerencia.toLowerCase().includes(term) : false;
        const matchesCategoria = i.categoria ? i.categoria.toLowerCase().includes(term) : false;
        const matchesObs = i.observacao ? i.observacao.toLowerCase().includes(term) : false;
        return matchesDesc || matchesCode || matchesCodeText || matchesGerencia || matchesCategoria || matchesObs;
      });
    }
    return filtered;
  }, [items, selectedGerencia, selectedCategoria, showOnlyComQuantidade, showOnlyZerados, showOnlyTransferidos, debouncedRecebidosSearchTerm]);

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
  }, [selectedGerencia, selectedCategoria, showOnlyComQuantidade, showOnlyZerados, debouncedRecebidosSearchTerm]);

  const categoriasItensProprios = useMemo(() => {
    const fromCatalog = (catalogItems || []).map((item) => item.categoria);
    const fromItems = (items || []).map((item) => item.categoria);
    const fromProprios = (itensProprios || []).map((item) => item.categoria);
    const unique = Array.from(new Set([...fromCatalog, ...fromItems, ...fromProprios])).filter(Boolean);
    return unique.sort();
  }, [catalogItems, items, itensProprios]);

  const itensPropriosMap = useMemo(() => {
    const targetGerenciaId = ownGerenciaId === "diretoria" ? diretoria?.id : ownGerenciaId;
    const allItems = [...items, ...itensProprios].filter(i => i.gerencia_id === targetGerenciaId);
    return new Map(allItems.map((item) => [item.codigo, item]));
  }, [items, itensProprios, ownGerenciaId, diretoria]);

  const filteredOwnItems = useMemo(() => {
    const term = debouncedOwnSearchTerm.trim().toLowerCase();
    
    // Otimização extrema de performance: se a UI vai esconder a tabela, nem processe os 4000 itens
    if (term === "" && !ownShowOnlyComQuantidade && !ownShowOnlyZerados && !ownShowOnlyAprovados) {
      return [];
    }

    const gerenciaSelecionada = ownGerenciaId === "diretoria"
      ? `DIRETORIA ${siglaUpper}`
      : ((gerenciaMap[ownGerenciaId] && gerenciaMap[ownGerenciaId] !== "N/A" ? gerenciaMap[ownGerenciaId] : undefined) || siglaUpper);

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
      if (ownShowOnlyAprovados) {
        if (planItem.status !== "aprovado") continue;
      } else {
        if (planItem.status === "aprovado") continue;
      }

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
   * Respeita regras de bloqueio de edição e encerramento de período
   */
  const isItemReadOnly = (item: PlanItem) => isEditarAquisicaoBlocked || isPeriodExpired;

  const selectableItems = useMemo(
    () =>
      recebidosTableItems.filter((item) => {
        if (!item.id) return false;
        if (recebidosStatusTab === "em_compra") return false;
        return true;
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

  const summary = useMemo(() => {
    if (selectedOwnItems.size > 0 || selectedItems.size > 0) {
      let count = 0;
      let totalVal = 0;
      if (selectedOwnItems.size > 0) {
        filteredOwnItems.forEach((item) => {
          const matchId = item.id && selectedOwnItems.has(item.id);
          const matchCodigo = selectedOwnItems.has(item.codigo as any) || selectedOwnItems.has(String(item.codigo) as any);
          if ((matchId || matchCodigo) && item.qtdEstimada > 0) {
            count++;
            totalVal += item.qtdEstimada * item.valorUnitario;
          }
        });
      }
      if (selectedItems.size > 0) {
        items.forEach((item) => {
          if (item.id && selectedItems.has(item.id) && item.qtdEstimada > 0) {
            count++;
            totalVal += item.qtdEstimada * item.valorUnitario;
          }
        });
      }
      return { totalItens: count, valorTotal: totalVal };
    }

    if (selectedServicos.size > 0 && selectedOption !== "aquisicao") {
      let count = 0;
      let totalVal = 0;
      servicosData.forEach((s: ServicoItem) => {
        const itemKey = String(s.item || "").trim();
        const matchItem = selectedServicos.has(s.item as any) || selectedServicos.has(itemKey);
        const matchId = s.id && selectedServicos.has(s.id as any);
        if (matchItem || matchId) {
          count++;
          totalVal += (s.dotacaoOrcamentaria || s.estimativaValor || (s as any).estimativa_valor || 0);
        }
      });
      return { totalItens: count, valorTotal: totalVal };
    }

    return {
      totalItens:
        recebidosTableItems.filter((item) => item.qtdEstimada > 0).length +
        filteredOwnItems.filter((item) => item.qtdEstimada > 0).length,
      valorTotal:
        recebidosTableItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0) +
        filteredOwnItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
    };
  }, [recebidosTableItems, filteredOwnItems, selectedOwnItems, selectedItems, selectedServicos, items, servicosData, selectedOption]);

  const orcamentoDiretoriaAquisicao = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "aquisicao")
    : 0;
  const orcamentoDiretoriaServicosNovos = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "servicos_novos")
    : 0;
  const orcamentoDiretoriaServicosExistentes = diretoria?.id
    ? getDiretoriaBudget(orcamentoConfig as any, diretoria.id, "servicos_existentes")
    : 0;

  const orcamentoGeralDiretoria = diretoria?.id
    ? (orcamentoConfig as any)?.diretoriaBudgetsOrcamentoGeral?.[diretoria.id] || 0
    : 0;

  const isEnviadoOuAprovado = (status?: SolicitacaoStatus | string) =>
    status === "enviado" ||
    status === "em_analise" ||
    status === "aprovado" ||
    status === "em_compra" ||
    status === "concluido";

  const isAprovado = (status?: SolicitacaoStatus) =>
    status === "aprovado" || status === "em_compra" || status === "concluido";

  const gastoAquisicaoDiretoria = useMemo(() => {
    if ((selectedOwnItems.size > 0 || selectedItems.size > 0) && selectedOption === "aquisicao") {
      let totalSelected = 0;
      if (selectedOwnItems.size > 0) {
        filteredOwnItems.forEach((item) => {
          const matchId = item.id && selectedOwnItems.has(item.id);
          const matchCodigo = selectedOwnItems.has(item.codigo as any) || selectedOwnItems.has(String(item.codigo) as any);
          if ((matchId || matchCodigo) && item.qtdEstimada > 0) {
            totalSelected += item.qtdEstimada * item.valorUnitario;
          }
        });
      }
      if (selectedItems.size > 0) {
        items.forEach((item) => {
          if (item.id && selectedItems.has(item.id) && item.qtdEstimada > 0) {
            totalSelected += item.qtdEstimada * item.valorUnitario;
          }
        });
      }
      return totalSelected;
    }
    return [...items, ...itensProprios]
      .filter((item) => isEnviadoOuAprovado(item.status) && item.qtdEstimada > 0)
      .reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0);
  }, [items, itensProprios, filteredOwnItems, selectedOwnItems, selectedItems, selectedOption]);

  const gastoServicosExistentesDiretoria = useMemo(() => {
    const isExistente = (s: ServicoItem) => {
      const c = String(s.contrato || (s as any).contrato || "").trim();
      const emp = String(s.contratada || (s as any).contratada || "").trim();
      if ((c !== "" && c !== "-") || (emp !== "" && emp !== "-")) return true;
      const itemKey = String(s.item || "").trim();
      if (servicosCatalogoExistentesSet.has(itemKey)) return true;
      if (servicosCatalogoNovosSet.has(itemKey)) return false;
      const itemNum = Number(s.item);
      if (!isNaN(itemNum) && itemNum >= 9000000) return false;
      const tipo = String(s.tipoContratacao || (s as any).tipo_contratacao || "").trim().toLowerCase();
      return !tipo.includes("novo");
    };

    if (selectedServicos.size > 0 && selectedOption !== "aquisicao") {
      return servicosData
        .filter((s: ServicoItem) => {
          const itemKey = String(s.item || "").trim();
          const matchItem = selectedServicos.has(s.item as any) || selectedServicos.has(itemKey);
          const matchId = s.id && selectedServicos.has(s.id as any);
          return isExistente(s) && (matchItem || matchId);
        })
        .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || (s as any).estimativa_valor || (s as any).valor_total || (s as any).valorTotal || 0), 0);
    }
    return servicosData
      .filter((s: ServicoItem) => {
        return isEnviadoOuAprovado(s.status) && isExistente(s);
      })
      .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || (s as any).estimativa_valor || (s as any).valor_total || (s as any).valorTotal || 0), 0);
  }, [servicosData, servicosCatalogoExistentesSet, servicosCatalogoNovosSet, selectedServicos, selectedOption]);

  const gastoServicosNovosDiretoria = useMemo(() => {
    const isNovo = (s: ServicoItem) => {
      const c = String(s.contrato || (s as any).contrato || "").trim();
      const emp = String(s.contratada || (s as any).contratada || "").trim();
      if ((c !== "" && c !== "-") || (emp !== "" && emp !== "-")) return false;
      const itemKey = String(s.item || "").trim();
      if (servicosCatalogoNovosSet.has(itemKey)) return true;
      if (servicosCatalogoExistentesSet.has(itemKey)) return false;
      const itemNum = Number(s.item);
      if (!isNaN(itemNum) && itemNum >= 9000000) return true;
      const tipo = String(s.tipoContratacao || (s as any).tipo_contratacao || "").trim().toLowerCase();
      return tipo.includes("novo");
    };

    if (selectedServicos.size > 0 && selectedOption !== "aquisicao") {
      return servicosData
        .filter((s: ServicoItem) => {
          const itemKey = String(s.item || "").trim();
          const matchItem = selectedServicos.has(s.item as any) || selectedServicos.has(itemKey);
          const matchId = s.id && selectedServicos.has(s.id as any);
          return isNovo(s) && (matchItem || matchId);
        })
        .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || (s as any).estimativa_valor || (s as any).valor_total || (s as any).valorTotal || 0), 0);
    }
    return servicosData
      .filter((s: ServicoItem) => {
        return isEnviadoOuAprovado(s.status) && isNovo(s);
      })
      .reduce((acc: number, s: ServicoItem) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || (s as any).estimativa_valor || (s as any).valor_total || (s as any).valorTotal || 0), 0);
  }, [servicosData, servicosCatalogoExistentesSet, servicosCatalogoNovosSet, selectedServicos, selectedOption]);

  const gastoServicosDiretoria = useMemo(() => {
    return selectedOption === "servicos_existentes"
      ? gastoServicosExistentesDiretoria
      : gastoServicosNovosDiretoria;
  }, [selectedOption, gastoServicosExistentesDiretoria, gastoServicosNovosDiretoria]);

  // Serviços da própria diretoria
  const servicosPropriosBase: ServicoItem[] = useMemo(() => {
    if (!diretoria) return [];
    
    const getContratadaFallback = (contrato: string | undefined | null) => {
      if (!contrato) return null;
      const found = (servicosCatalogoData as any[]).find(c => c.contrato === contrato && c.contratada);
      return found ? found.contratada : null;
    };

    const dgGerencia = todasGerenciasDaDiretoria.find((g: any) => g.sigla === siglaUpper);
    const isDiretoriaSelected = 
      ownServicosGerenciaId === "diretoria" || 
      ownServicosGerenciaId === diretoria?.id || 
      (dgGerencia && ownServicosGerenciaId === dgGerencia.id);

    const selectedGerenciaObj = todasGerenciasDaDiretoria.find((g: any) => g.id === ownServicosGerenciaId);
    const selectedGerenciaSigla = ownServicosGerenciaId === "todas"
      ? undefined
      : isDiretoriaSelected
        ? siglaUpper
        : (selectedGerenciaObj?.sigla || gerenciaMap[ownServicosGerenciaId] || ownServicosGerenciaId);

    const targetGerenciaId = ownServicosGerenciaId === "todas"
      ? undefined
      : isDiretoriaSelected
        ? (dgGerencia?.id || diretoria?.id)
        : ownServicosGerenciaId;

    const servicosDaDiretoria = servicosData
      .filter((s: ServicoItem) => 
        !diretoria?.id ||
        (s as any).diretoria_id === diretoria?.id ||
        s.unidadeDemandante === siglaUpper || 
        s.diretoriaSigla === siglaUpper || 
        ((s as any).diretorias && (s as any).diretorias.sigla === siglaUpper) ||
        (s.gerencia_id && gerenciaMap[(s as any).gerencia_id]) ||
        todasGerenciasDaDiretoria.some((g: any) => g.sigla === s.gerencia || g.sigla === s.unidadeDemandante || g.id === (s as any).gerencia_id)
      )
      .map((s: ServicoItem) => {
        const rawG = s.gerencia || (s as any).gerencia_id;
        const resolvedGer = (s.gerencia && !String(s.gerencia).includes("-") && s.gerencia !== "N/A" ? s.gerencia : undefined) ||
          (gerenciaMap[rawG] && gerenciaMap[rawG] !== "N/A" ? gerenciaMap[rawG] : undefined) ||
          ((s as any).gerencia_id && gerenciaMap[(s as any).gerencia_id] && gerenciaMap[(s as any).gerencia_id] !== "N/A" ? gerenciaMap[(s as any).gerencia_id] : undefined) ||
          diretoriaMap[(s as any).gerencia_id]?.sigla ||
          diretoriaMap[(s as any).diretoria_id]?.sigla ||
          (s.unidadeDemandante && s.unidadeDemandante !== "N/A" ? s.unidadeDemandante : undefined) ||
          siglaUpper;
        return {
          ...s,
          gerencia: resolvedGer,
          contratada: s.contratada || getContratadaFallback(s.contrato),
        };
      });
    
    const hasContratoOuContratada = (s: any) => {
      const c = String(s.contrato || "").trim();
      const emp = String(s.contratada || "").trim();
      return (c !== "" && c !== "-") || (emp !== "" && emp !== "-");
    };

    const isNovoServico = (s: any) => {
      if (hasContratoOuContratada(s)) return false;
      const itemNum = Number(s.item);
      if (!isNaN(itemNum) && itemNum >= 9000000) return true;
      const itemKey = s.item !== undefined && s.item !== null ? String(s.item).trim() : "";
      if (itemKey && servicosCatalogoNovosSet.has(itemKey)) return true;
      if (itemKey && servicosCatalogoExistentesSet.has(itemKey)) return false;
      const tipo = String(s.tipoContratacao || s.tipo_contratacao || "").trim().toLowerCase();
      return tipo.includes("novo");
    };

    if (selectedOption === "servicos_existentes") {
      if (ownServicosGerenciaId === "todas") {
        const catalogoMap = new Map<string, any>();
        (servicosCatalogoData as any[]).forEach(c => {
          if (c.item !== undefined && c.item !== null) {
            catalogoMap.set(String(c.item).trim(), c);
          }
        });

        const dbExistentes = servicosDaDiretoria
          .filter(s => !isNovoServico(s))
          .map(s => {
            const cat = catalogoMap.get(String(s.item || "").trim());
            return {
              ...s,
              objeto: s.objeto || cat?.objeto || "",
              contrato: s.contrato !== undefined ? s.contrato : cat?.contrato,
              contratada: s.contratada || cat?.contratada || getContratadaFallback(s.contrato),
              justificativa: s.justificativa || cat?.justificativa || "",
              grauPrioridade: s.grauPrioridade || cat?.grau_prioridade || "Médio",
              vinculacao: s.vinculacao || cat?.vinculacao || "Não",
              estimativaValor: (s.estimativaValor !== undefined && s.estimativaValor > 0)
                ? s.estimativaValor
                : ((cat?.estimativa_valor !== undefined && cat.estimativa_valor > 0) ? cat.estimativa_valor : (s.estimativaValor || 0)),
            };
          });

        const dbCodesSet = new Set(dbExistentes.map(s => String(s.item || "").trim()));
        const placeholders = (servicosCatalogoData as any[])
          .filter(c => !isNovoServico(c) && !dbCodesSet.has(String(c.item || "").trim()))
          .map(catalogoItem => ({
            id: undefined,
            item: catalogoItem.item,
            tipoContratacao: catalogoItem.tipo_contratacao || "Serviço",
            unidadeDemandante: siglaUpper,
            objeto: catalogoItem.objeto || "",
            justificativa: catalogoItem.justificativa || "",
            previsaoInicio: catalogoItem.previsao_inicio || undefined,
            estimativaValor: catalogoItem.estimativa_valor || 0,
            dotacaoOrcamentaria: catalogoItem.dotacao_orcamentaria || 0,
            grauPrioridade: catalogoItem.grau_prioridade || "Baixo",
            vinculacao: catalogoItem.vinculacao || "Não",
            dependenciaDescricao: catalogoItem.dependencia_descricao || undefined,
            status: catalogoItem.status || "rascunho",
            contrato: catalogoItem.contrato,
            contratada: catalogoItem.contratada,
            observacao: catalogoItem.observacao || "",
            gerencia: siglaUpper,
            gerencia_id: dgGerencia?.id || diretoria.id,
            diretoria_id: diretoria.id,
            diretoriaSigla: siglaUpper,
          } as unknown as ServicoItem));

        return [...dbExistentes, ...placeholders];
      }

      const catalogoExistentes = (servicosCatalogoData as any[])
        .filter((catalogoItem) => !isNovoServico(catalogoItem))
        .map((catalogoItem) => {
          let servicoDb = selectedGerenciaSigla
            ? servicosDaDiretoria.find(s => 
                (String(s.item).trim() === String(catalogoItem.item).trim() || (Number(s.item) > 0 && Number(s.item) === Number(catalogoItem.item))) &&
                (s.gerencia === selectedGerenciaSigla || s.unidadeDemandante === selectedGerenciaSigla || (targetGerenciaId && (s as any).gerencia_id === targetGerenciaId))
              )
            : undefined;

          if (!servicoDb && isDiretoriaSelected) {
            servicoDb = servicosDaDiretoria.find(s => 
              (String(s.item).trim() === String(catalogoItem.item).trim() || (Number(s.item) > 0 && Number(s.item) === Number(catalogoItem.item))) &&
              (s.gerencia === siglaUpper || s.unidadeDemandante === siglaUpper || (dgGerencia && (s as any).gerencia_id === dgGerencia.id))
            );
          }

          const resolvedGer = isDiretoriaSelected
            ? siglaUpper
            : ((servicoDb && servicoDb.gerencia && !String(servicoDb.gerencia).includes("-") && servicoDb.gerencia !== "N/A" ? servicoDb.gerencia : undefined) ||
              (servicoDb && (servicoDb as any).unidadeDemandante) ||
              selectedGerenciaSigla ||
              (catalogoItem.gerencia_id && gerenciaMap[catalogoItem.gerencia_id]) ||
              siglaUpper);

          if (servicoDb) {
            return {
              ...servicoDb,
              gerencia: isDiretoriaSelected ? siglaUpper : resolvedGer,
              unidadeDemandante: isDiretoriaSelected ? siglaUpper : (servicoDb.unidadeDemandante || resolvedGer),
              gerencia_id: (servicoDb as any).gerencia_id || targetGerenciaId || catalogoItem.gerencia_id,
              diretoria_id: (servicoDb as any).diretoria_id || catalogoItem.diretoria_id || diretoria.id,
              objeto: catalogoItem.objeto || servicoDb.objeto,
              tipoContratacao: catalogoItem.tipo_contratacao || servicoDb.tipoContratacao,
              estimativaValor: (catalogoItem.estimativa_valor !== undefined && catalogoItem.estimativa_valor > 0)
                ? catalogoItem.estimativa_valor
                : servicoDb.estimativaValor,
              grauPrioridade: catalogoItem.grau_prioridade || servicoDb.grauPrioridade,
              vinculacao: catalogoItem.vinculacao || servicoDb.vinculacao,
              contrato: catalogoItem.contrato !== undefined ? catalogoItem.contrato : servicoDb.contrato,
              contratada: catalogoItem.contratada || servicoDb.contratada,
              dependenciaDescricao: catalogoItem.dependencia_descricao !== undefined ? catalogoItem.dependencia_descricao : servicoDb.dependenciaDescricao,
              justificativa: servicoDb.justificativa || catalogoItem.justificativa || "",
            };
          }
          return {
            id: undefined,
            item: catalogoItem.item,
            tipoContratacao: catalogoItem.tipo_contratacao || "Serviço",
            unidadeDemandante: isDiretoriaSelected ? siglaUpper : resolvedGer,
            objeto: catalogoItem.objeto || "",
            justificativa: catalogoItem.justificativa || "",
            previsaoInicio: catalogoItem.previsao_inicio || undefined,
            estimativaValor: catalogoItem.estimativa_valor || 0,
            dotacaoOrcamentaria: catalogoItem.dotacao_orcamentaria || 0,
            grauPrioridade: catalogoItem.grau_prioridade || "Baixo",
            vinculacao: catalogoItem.vinculacao || "Não",
            dependenciaDescricao: catalogoItem.dependencia_descricao || undefined,
            status: catalogoItem.status || "rascunho",
            contrato: catalogoItem.contrato,
            contratada: catalogoItem.contratada,
            observacao: catalogoItem.observacao || "",
            gerencia: isDiretoriaSelected ? siglaUpper : resolvedGer,
            gerencia_id: targetGerenciaId || catalogoItem.gerencia_id,
            diretoria_id: catalogoItem.diretoria_id || diretoria.id,
            diretoriaSigla: siglaUpper,
          } as unknown as ServicoItem;
        });

      const catalogoExistentesItemsSet = new Set(catalogoExistentes.map(s => String(s.item || "").trim()));
      const customExistentes = servicosDaDiretoria.filter(s => 
        !isNovoServico(s) && 
        !catalogoExistentesItemsSet.has(String(s.item || "").trim()) &&
        (!isDiretoriaSelected || s.gerencia === siglaUpper || s.unidadeDemandante === siglaUpper || (dgGerencia && (s as any).gerencia_id === dgGerencia.id))
      );
      return [...catalogoExistentes, ...customExistentes];
    } else if (selectedOption === "servicos_novos") {
      if (ownServicosGerenciaId === "todas") {
        const catalogoMap = new Map<string, any>();
        (servicosCatalogoData as any[]).forEach(c => {
          if (c.item !== undefined && c.item !== null) {
            catalogoMap.set(String(c.item).trim(), c);
          }
        });

        const dbNovos = servicosDaDiretoria
          .filter(s => isNovoServico(s))
          .map(s => {
            const cat = catalogoMap.get(String(s.item || "").trim());
            return {
              ...s,
              objeto: s.objeto || cat?.objeto || "",
              tipoContratacao: "Novo",
              contrato: s.contrato !== undefined ? s.contrato : cat?.contrato,
              contratada: s.contratada || cat?.contratada || getContratadaFallback(s.contrato),
              justificativa: s.justificativa || cat?.justificativa || "",
              grauPrioridade: s.grauPrioridade || cat?.grau_prioridade || "Médio",
              vinculacao: s.vinculacao || cat?.vinculacao || "Não",
              estimativaValor: (s.estimativaValor !== undefined && s.estimativaValor > 0)
                ? s.estimativaValor
                : ((cat?.estimativa_valor !== undefined && cat.estimativa_valor > 0) ? cat.estimativa_valor : (s.estimativaValor || 0)),
            };
          });

        const dbCodesSet = new Set(dbNovos.map(s => String(s.item || "").trim()));
        const placeholdersNovos = (servicosCatalogoData as any[])
          .filter(c => isNovoServico(c) && !dbCodesSet.has(String(c.item || "").trim()))
          .map(catalogoItem => ({
            id: undefined,
            item: catalogoItem.item,
            tipoContratacao: "Novo",
            unidadeDemandante: siglaUpper,
            objeto: catalogoItem.objeto || "",
            justificativa: catalogoItem.justificativa || "",
            previsaoInicio: catalogoItem.previsao_inicio || undefined,
            estimativaValor: catalogoItem.estimativa_valor || 0,
            dotacaoOrcamentaria: catalogoItem.dotacao_orcamentaria || 0,
            grauPrioridade: catalogoItem.grau_prioridade || "Médio",
            vinculacao: catalogoItem.vinculacao || "Não",
            dependenciaDescricao: catalogoItem.dependencia_descricao || undefined,
            status: catalogoItem.status || "rascunho",
            observacao: catalogoItem.observacao || "",
            gerencia: siglaUpper,
            gerencia_id: dgGerencia?.id || diretoria.id,
            diretoria_id: diretoria.id,
            diretoriaSigla: siglaUpper,
            contrato: catalogoItem.contrato,
            contratada: catalogoItem.contratada,
          } as unknown as ServicoItem));

        return [...dbNovos, ...placeholdersNovos];
      }

      const catalogoNovos = (servicosCatalogoData as any[])
        .filter((catalogoItem) => isNovoServico(catalogoItem))
        .map((catalogoItem) => {
          let servicoDb = selectedGerenciaSigla
            ? servicosDaDiretoria.find(s => 
                (Number(s.item) === Number(catalogoItem.item)) &&
                (s.gerencia === selectedGerenciaSigla || s.unidadeDemandante === selectedGerenciaSigla || (targetGerenciaId && (s as any).gerencia_id === targetGerenciaId))
              )
            : undefined;

          if (!servicoDb && isDiretoriaSelected) {
            servicoDb = servicosDaDiretoria.find(s => 
              (Number(s.item) === Number(catalogoItem.item)) &&
              (s.gerencia === siglaUpper || s.unidadeDemandante === siglaUpper || (dgGerencia && (s as any).gerencia_id === dgGerencia.id))
            );
          }

          const resolvedGer = isDiretoriaSelected
            ? siglaUpper
            : ((servicoDb && servicoDb.gerencia && !String(servicoDb.gerencia).includes("-") && servicoDb.gerencia !== "N/A" ? servicoDb.gerencia : undefined) ||
              (servicoDb && (servicoDb as any).unidadeDemandante) ||
              selectedGerenciaSigla ||
              (catalogoItem.gerencia_id && gerenciaMap[catalogoItem.gerencia_id]) ||
              siglaUpper);

          if (servicoDb) {
            return {
              ...servicoDb,
              gerencia: isDiretoriaSelected ? siglaUpper : resolvedGer,
              unidadeDemandante: isDiretoriaSelected ? siglaUpper : (servicoDb.unidadeDemandante || resolvedGer),
              gerencia_id: (servicoDb as any).gerencia_id || targetGerenciaId || catalogoItem.gerencia_id,
              diretoria_id: (servicoDb as any).diretoria_id || catalogoItem.diretoria_id || diretoria.id,
              objeto: catalogoItem.objeto || servicoDb.objeto,
              tipoContratacao: "Novo",
              estimativaValor: (catalogoItem.estimativa_valor !== undefined && catalogoItem.estimativa_valor > 0)
                ? catalogoItem.estimativa_valor
                : servicoDb.estimativaValor,
              grauPrioridade: catalogoItem.grau_prioridade || servicoDb.grauPrioridade,
              vinculacao: catalogoItem.vinculacao || servicoDb.vinculacao,
              contrato: catalogoItem.contrato !== undefined ? catalogoItem.contrato : servicoDb.contrato,
              contratada: catalogoItem.contratada || servicoDb.contratada,
              dependenciaDescricao: catalogoItem.dependencia_descricao !== undefined ? catalogoItem.dependencia_descricao : servicoDb.dependenciaDescricao,
              justificativa: servicoDb.justificativa || catalogoItem.justificativa || "",
            };
          }
          return {
            id: undefined,
            item: catalogoItem.item,
            tipoContratacao: "Novo",
            unidadeDemandante: isDiretoriaSelected ? siglaUpper : resolvedGer,
            objeto: catalogoItem.objeto || "",
            justificativa: catalogoItem.justificativa || "",
            previsaoInicio: catalogoItem.previsao_inicio || undefined,
            estimativaValor: catalogoItem.estimativa_valor || 0,
            dotacaoOrcamentaria: catalogoItem.dotacao_orcamentaria || 0,
            grauPrioridade: catalogoItem.grau_prioridade || "Médio",
            vinculacao: catalogoItem.vinculacao || "Não",
            dependenciaDescricao: catalogoItem.dependencia_descricao || undefined,
            status: catalogoItem.status || "rascunho",
            observacao: catalogoItem.observacao || "",
            gerencia: isDiretoriaSelected ? siglaUpper : resolvedGer,
            gerencia_id: targetGerenciaId || catalogoItem.gerencia_id,
            diretoria_id: catalogoItem.diretoria_id || diretoria.id,
            diretoriaSigla: siglaUpper,
            contrato: catalogoItem.contrato,
            contratada: catalogoItem.contratada,
          } as unknown as ServicoItem;
        });
      const catalogoNovosItemsSet = new Set(catalogoNovos.map(s => Number(s.item)));
      const customNovos = servicosDaDiretoria.filter(s => 
        isNovoServico(s) && 
        !servicosCatalogoSet.has(String(s.item || "").trim()) && 
        !catalogoNovosItemsSet.has(Number(s.item)) &&
        (!isDiretoriaSelected || s.gerencia === siglaUpper || s.unidadeDemandante === siglaUpper || (dgGerencia && (s as any).gerencia_id === dgGerencia.id))
      );
      return [...catalogoNovos, ...customNovos];
    }
    return [];
  }, [servicosData, diretoria, siglaUpper, selectedOption, servicosCatalogoData, servicosCatalogoSet, gerenciaMap, ownServicosGerenciaId, todasGerenciasDaDiretoria]);

  const servicosProprios = useMemo(() => {
    let list = servicosPropriosBase;
    
    if (ownServicosGerenciaId !== "todas") {
      const dgGerencia = todasGerenciasDaDiretoria.find((g: any) => g.sigla === siglaUpper);
      const isDiretoriaSelected = 
        ownServicosGerenciaId === "diretoria" || 
        ownServicosGerenciaId === diretoria?.id || 
        (dgGerencia && ownServicosGerenciaId === dgGerencia.id);

      if (isDiretoriaSelected) {
        list = list.filter(s => 
          s.gerencia === siglaUpper || 
          s.unidadeDemandante === siglaUpper || 
          s.diretoriaSigla === siglaUpper ||
          (s as any).gerencia_id === diretoria?.id || 
          (dgGerencia && (s as any).gerencia_id === dgGerencia.id) || 
          (!s.gerencia || s.gerencia === "N/A")
        );
      } else {
        const targetGerObj = todasGerenciasDaDiretoria.find((g: any) => g.id === ownServicosGerenciaId);
        const targetSigla = targetGerObj?.sigla || gerenciaMap[ownServicosGerenciaId] || ownServicosGerenciaId;
        list = list.filter(s => 
          (s as any).gerencia_id === ownServicosGerenciaId || 
          (targetSigla && (s.gerencia === targetSigla || s.unidadeDemandante === targetSigla))
        );
      }
    }

    if (ownServicosShowOnlyAprovados) {
      list = list.filter(s => s.status === "aprovado");
    } else {
      list = list.filter(s => s.status !== "aprovado");
    }
    if (ownServicosShowOnlyZerados) {
      list = list.filter(s => !(s as any).estimativa_valor && !s.estimativaValor || (s as any).estimativa_valor === 0 || s.estimativaValor === 0);
    }
    if (ownServicosShowOnlyComValor) {
      list = list.filter(s => ((s as any).estimativa_valor && (s as any).estimativa_valor > 0) || (s.estimativaValor && s.estimativaValor > 0));
    }
    
    if (debouncedOwnServicosSearchTerm) {
      const term = debouncedOwnServicosSearchTerm.toLowerCase().trim();
      list = list.filter(s => {
        const val = Number(s.estimativaValor ?? (s as any).estimativa_valor ?? 0);
        const valFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val).toLowerCase();
        const valRawStr = String(val);
        const valLocaleStr = val.toLocaleString("pt-BR").toLowerCase();
        const cleanTerm = term.replace(/[r$\s.]/g, "");
        const cleanValStr = valRawStr.replace(/[.]/g, "");

        return (
          (s.objeto || "").toLowerCase().includes(term) ||
          (s.justificativa || "").toLowerCase().includes(term) ||
          (s.contrato && s.contrato.toLowerCase().includes(term)) ||
          (s.contratada && s.contratada.toLowerCase().includes(term)) ||
          String(s.item || "").toLowerCase().includes(term) ||
          (s.gerencia && s.gerencia.toLowerCase().includes(term)) ||
          valFormatted.includes(term) ||
          valLocaleStr.includes(term) ||
          (cleanTerm.length > 0 && cleanValStr.includes(cleanTerm))
        );
      });
    }
    
    return list;
  }, [servicosPropriosBase, ownServicosShowOnlyAprovados, ownServicosGerenciaId, ownServicosShowOnlyZerados, ownServicosShowOnlyComValor, gerenciaMap, debouncedOwnServicosSearchTerm, todasGerenciasDaDiretoria, siglaUpper, diretoria]);

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
    const getContratadaFallback = (contrato: string | undefined | null) => {
      if (!contrato) return null;
      const found = (servicosCatalogoData as any[]).find(c => c.contrato === contrato && c.contratada);
      return found ? found.contratada : null;
    };

    const catalogoMapByItem = new Map<string, any>();
    const catalogoMapById = new Map<string, any>();
    (servicosCatalogoData as any[]).forEach((c) => {
      if (c.id) catalogoMapById.set(String(c.id).toLowerCase(), c);
      if (c.item !== undefined && c.item !== null && c.item !== "") {
        catalogoMapByItem.set(String(c.item).trim(), c);
        const parsed = parseInt(c.item, 10);
        if (!isNaN(parsed)) catalogoMapByItem.set(String(parsed), c);
      }
    });

    return servicosData
      .filter((s: ServicoItem) => s.status !== "rascunho" || Boolean(s.observacao && s.observacao.includes("[Transferido")))
      .map((s: ServicoItem) => {
        const rawG = s.gerencia || (s as any).gerencia_id;
        const resolvedGer = (s.gerencia && !String(s.gerencia).includes("-") && s.gerencia !== "N/A" ? s.gerencia : undefined) ||
          (gerenciaMap[rawG] && gerenciaMap[rawG] !== "N/A" ? gerenciaMap[rawG] : undefined) ||
          ((s as any).gerencia_id && gerenciaMap[(s as any).gerencia_id] && gerenciaMap[(s as any).gerencia_id] !== "N/A" ? gerenciaMap[(s as any).gerencia_id] : undefined) ||
          diretoriaMap[(s as any).gerencia_id]?.sigla ||
          diretoriaMap[(s as any).diretoria_id]?.sigla ||
          (s.unidadeDemandante && s.unidadeDemandante !== "N/A" ? s.unidadeDemandante : undefined) ||
          (s.gerencia && s.gerencia !== "N/A" ? s.gerencia : undefined) ||
          siglaUpper;
        
        const itemKey = s.item !== undefined && s.item !== null ? String(s.item).trim() : "";
        const catItem = (s.id && catalogoMapById.get(String(s.id).toLowerCase())) || (itemKey ? catalogoMapByItem.get(itemKey) : null);

        if (catItem) {
          return {
            ...s,
            gerencia: resolvedGer,
            gerencia_id: (s as any).gerencia_id,
            diretoria_id: (s as any).diretoria_id,
            unidadeDemandante: s.unidadeDemandante || resolvedGer,
            objeto: (catItem.objeto && String(catItem.objeto).trim().length > 0) ? catItem.objeto : s.objeto,
            tipoContratacao: catItem.tipo_contratacao || catItem.tipoContratacao || s.tipoContratacao || "Serviço",
            estimativaValor: (catItem.estimativa_valor !== undefined && catItem.estimativa_valor !== null && Number(catItem.estimativa_valor) > 0)
              ? Number(catItem.estimativa_valor)
              : (s.estimativaValor !== undefined && Number(s.estimativaValor) > 0 ? Number(s.estimativaValor) : 0),
            dotacaoOrcamentaria: (catItem.dotacao_orcamentaria !== undefined && catItem.dotacao_orcamentaria !== null && Number(catItem.dotacao_orcamentaria) > 0)
              ? Number(catItem.dotacao_orcamentaria)
              : (catItem.estimativa_valor !== undefined && catItem.estimativa_valor !== null && Number(catItem.estimativa_valor) > 0)
                ? Number(catItem.estimativa_valor)
                : (s.dotacaoOrcamentaria || s.estimativaValor || 0),
            grauPrioridade: catItem.grau_prioridade || catItem.grauPrioridade || s.grauPrioridade || "Baixo",
            vinculacao: catItem.vinculacao || s.vinculacao || "Não",
            dependenciaDescricao: catItem.dependencia_descricao !== undefined ? catItem.dependencia_descricao : s.dependenciaDescricao,
            contrato: (catItem.contrato !== undefined && catItem.contrato !== null && catItem.contrato !== "") ? catItem.contrato : s.contrato,
            contratada: catItem.contratada || s.contratada || getContratadaFallback(catItem.contrato || s.contrato),
          };
        }

        return {
          ...s,
          gerencia: resolvedGer,
          gerencia_id: (s as any).gerencia_id,
          diretoria_id: (s as any).diretoria_id,
          unidadeDemandante: s.unidadeDemandante || resolvedGer,
          contratada: s.contratada || getContratadaFallback(s.contrato),
        };
      });
  }, [servicosData, servicosCatalogoData, gerenciaMap]);

  const isNovoServicoItem = (s: ServicoItem) => {
    const c = String(s.contrato || (s as any).contrato || "").trim();
    const emp = String(s.contratada || (s as any).contratada || "").trim();
    if ((c !== "" && c !== "-") || (emp !== "" && emp !== "-")) return false;

    const itemNum = Number(s.item);
    if (!isNaN(itemNum) && itemNum >= 9000000) return true;

    const itemKey = s.item !== undefined && s.item !== null ? String(s.item).trim() : "";
    if (itemKey && servicosCatalogoNovosSet.has(itemKey)) return true;
    if (itemKey && servicosCatalogoExistentesSet.has(itemKey)) return false;

    const tipo = String(s.tipoContratacao || (s as any).tipo_contratacao || "").trim().toLowerCase();
    if (tipo.includes("novo")) return true;
    return false;
  };

  const servicosRecebidosPorTipo = useMemo(() => {
    if (selectedOption === "servicos_novos") {
      return servicosRecebidosBase.filter(isNovoServicoItem);
    }
    if (selectedOption === "servicos_existentes") {
      return servicosRecebidosBase.filter((s: ServicoItem) => !isNovoServicoItem(s));
    }
    return servicosRecebidosBase;
  }, [servicosRecebidosBase, selectedOption, servicosCatalogoNovosSet, servicosCatalogoExistentesSet, servicosCatalogoSet]);

  const filteredServicos = useMemo(() => {
    let list = servicosRecebidosPorTipo;
    if (selectedGerencia !== "todas") {
      const dgGerencia = gerenciasData.find((g: any) => g.sigla === siglaUpper);
      const isDiretoriaFilter = selectedGerencia === siglaUpper || (dgGerencia && selectedGerencia === dgGerencia.sigla);
      if (isDiretoriaFilter) {
        list = list.filter((s: ServicoItem) => 
          s.gerencia === siglaUpper || 
          s.unidadeDemandante === siglaUpper || 
          s.diretoriaSigla === siglaUpper ||
          (dgGerencia && (s as any).gerencia_id === dgGerencia.id) ||
          ((s as any).diretoria_id === diretoria?.id && (!s.gerencia || s.gerencia === siglaUpper || s.gerencia === "N/A"))
        );
      } else {
        list = list.filter((s: ServicoItem) => 
          s.gerencia === selectedGerencia || 
          s.unidadeDemandante === selectedGerencia || 
          ((s as any).gerencia_id && gerenciaMap[(s as any).gerencia_id] === selectedGerencia)
        );
      }
    }

    if (showOnlyTransferidosServicos) {
      list = list.filter((s: ServicoItem) => Boolean(s.observacao && s.observacao.includes("[Transferido")));
    }

    const term = debouncedServicosRecebidosSearchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((s: ServicoItem) => {
        const itemMatch = String(s.item).toLowerCase().includes(term);
        const objMatch = s.objeto ? s.objeto.toLowerCase().includes(term) : false;
        const justMatch = s.justificativa ? s.justificativa.toLowerCase().includes(term) : false;
        const contratoMatch = s.contrato ? s.contrato.toLowerCase().includes(term) : false;
        const contratadaMatch = s.contratada ? s.contratada.toLowerCase().includes(term) : false;
        const gerenciaMatch = s.gerencia ? s.gerencia.toLowerCase().includes(term) : false;
        return itemMatch || objMatch || justMatch || contratoMatch || contratadaMatch || gerenciaMatch;
      });
    }

    return list;
  }, [servicosRecebidosPorTipo, selectedGerencia, showOnlyTransferidosServicos, gerenciasData, siglaUpper, diretoria, gerenciaMap, debouncedServicosRecebidosSearchTerm]);

  useEffect(() => {
    setServicosCurrentPage(1);
  }, [selectedGerencia, debouncedServicosRecebidosSearchTerm]);



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
  const categoriasRecebidosDisponiveis = useMemo(() => {
    const baseItems = (selectedGerencia && selectedGerencia !== "todas") 
      ? items.filter(i => i.gerencia === selectedGerencia)
      : items;
    const catMap = new Map<string, number>();
    baseItems.forEach(i => {
      const c = (i.categoria || "Outros").trim();
      catMap.set(c, (catMap.get(c) || 0) + 1);
    });
    return {
      total: baseItems.length,
      lista: Array.from(catMap.entries())
        .map(([nome, count]) => ({ nome, count }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  }, [items, selectedGerencia]);

  useEffect(() => {
    if (selectedCategoria && selectedCategoria !== "todas") {
      const exists = categoriasRecebidosDisponiveis.lista.some(c => c.nome === selectedCategoria);
      if (!exists) {
        setSelectedCategoria("todas");
      }
    }
  }, [selectedGerencia, categoriasRecebidosDisponiveis, selectedCategoria]);

  const countTransferidos = useMemo(() => {
    return items.filter(i => Boolean(i.observacao && i.observacao.includes("[Transferido"))).length;
  }, [items]);

  const countTransferidosServicos = useMemo(() => {
    return servicosRecebidosPorTipo.filter((s: any) => Boolean(s.observacao && s.observacao.includes("[Transferido"))).length;
  }, [servicosRecebidosPorTipo]);

  const resumoDiretoriasSolicitantes = useMemo(() => {
    const grupos = new Map<string, { sigla: string; total: number; itens: number; itensZerados: number }>();

    items.forEach((item) => {
      const matchTransfer = item.observacao ? item.observacao.match(/\[Transferido da Diretoria ([^\]]+)\]/) : null;
      const siglaOrigem = matchTransfer ? matchTransfer[1].trim() : (item.diretoriaSigla || siglaUpper);
      const atual = grupos.get(siglaOrigem) || { sigla: siglaOrigem, total: 0, itens: 0, itensZerados: 0 };
      const qtd = Number(item.qtdEstimada) || 0;
      const val = Number(item.valorUnitario) || 0;
      const itemTotal = qtd * val;
      atual.total += isNaN(itemTotal) ? 0 : itemTotal;
      atual.itens += 1;
      if (qtd <= 0) {
        atual.itensZerados += 1;
      }
      grupos.set(siglaOrigem, atual);
    });

    return Array.from(grupos.values()).sort((a, b) => a.sigla.localeCompare(b.sigla));
  }, [items, siglaUpper]);

  // Handlers para seleção de itens
  const toggleSelectAll = () => {
    const selectableIds = selectableItems.map(item => item.id).filter(Boolean) as string[];
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedItems.has(id));
    const newSelected = new Set(selectedItems);
    if (allSelected) {
      selectableIds.forEach(id => newSelected.delete(id));
    } else {
      selectableIds.forEach(id => newSelected.add(id));
    }
    setSelectedItems(newSelected);
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
    if (isEditarAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "editar_item") || "A edição de quantidades está bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }

    // Atualização otimista no cache local para recálculo instantâneo na UI
    const queryKey = solicitacoesQueryKey;
    queryClient.setQueryData(queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((row: any) => 
        row?.id === id ? { ...row, qtd_estimada: qtdEstimada } : row
      );
    });

    await updateSolicitacao(id, { qtdEstimada });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
  };

  const handleUpdateObservacao = async (id: string, observacao: string) => {
    if (!id) return;
    if (isEditarAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "editar_item") || "A edição de observações está bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }

    const queryKey = solicitacoesQueryKey;
    queryClient.setQueryData(queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((row: any) => 
        row?.id === id ? { ...row, observacao } : row
      );
    });

    await updateSolicitacao(id, { observacao });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
  };

  const handleUpdatePrioridade = async (id: string, prioridade: PlanItem["prioridade"]) => {
    if (!id) return;
    if (isEditarAquisicaoBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "editar_item") || "A alteração de prioridades está bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }

    const queryKey = solicitacoesQueryKey;
    queryClient.setQueryData(queryKey, (current: any) => {
      if (!Array.isArray(current)) return current;
      return current.map((row: any) => 
        row?.id === id ? { ...row, prioridade } : row
      );
    });

    await updateSolicitacao(id, { prioridade });
    queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
  };

  const handleUpdateUnidadeDiretoria = async (codigo: number, unidade: string) => {
    await ensureSolicitacaoDiretoria(codigo, { unidade });
  };

  const ensureSolicitacaoDiretoria = async (codigo: number, updates: Partial<PlanItem>) => {
    if (isEditarAquisicaoBlocked || isAddPlanoProprioBlocked || isPeriodExpired) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "adicionar_item") || getBlockReason("aprovacao", "editar_item") || "A edição e inclusão no plano próprio estão bloqueadas pelo administrador.",
        variant: "destructive",
      });
      return;
    }

    const itemExistente = itensPropriosMap.get(codigo);

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
                status: updates.status ?? row.status,
              }
            : row,
        );
      });
      await updateSolicitacao(itemExistente.id, updates);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
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
      status: updates.status || "rascunho",
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
      status: updates.status || "rascunho",
    });

    queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
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

  const handleActionOwnSubmit = async () => {
    if (!actionOwnDialog.action) return;

    if (actionOwnDialog.action === "aprovar" && isAprovarAquisicaoBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "aprovar") || "A aprovação de solicitações está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionOwnDialog.action === "rejeitar" && isRejeitarAquisicaoBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "reprovar") || "A rejeição de solicitações está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionOwnDialog.action === "devolver" && isDevolverAquisicaoBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description: getBlockReason("aprovacao", "devolver") || "A devolução de solicitações está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }

    const actionMap = {
      aprovar: "aprovado" as SolicitacaoStatus,
      rejeitar: "rejeitado" as SolicitacaoStatus,
      devolver: "rascunho" as SolicitacaoStatus,
      analisar: "em_analise" as SolicitacaoStatus,
    };

    const newStatus = actionMap[actionOwnDialog.action];
    const itemsToUpdate = Array.from(selectedOwnItems);
    
    if (itemsToUpdate.length === 0) {
      setActionOwnDialog({ open: false, action: null });
      return;
    }

    setActionOwnDialog({ open: false, action: null });
    setJustificativa("");
    
    try {
      const idsToApprove = itemsToUpdate.filter(id => typeof id === 'string') as string[];
      const catalogCodesToApprove = itemsToUpdate.filter(id => typeof id === 'number') as number[];
      
      // Update local codes (itensProprios logic)
      if (catalogCodesToApprove.length > 0) {
        for (const codigo of catalogCodesToApprove) {
          await ensureSolicitacaoDiretoria(codigo, { status: newStatus });
        }
      }
      
      // Update actual UUIDs
      if (idsToApprove.length > 0) {
        // Atualização otimista
        queryClient.setQueryData(solicitacoesQueryKey, (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((s: any) => 
            idsToApprove.includes(s.id) ? { ...s, status: newStatus } : s
          );
        });

        await updateSolicitacaoStatusBulk(idsToApprove, newStatus, justificativa || undefined);
      }
      
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      
      let actionText = "processado(s)";
      if (actionOwnDialog.action === "aprovar") actionText = "aprovado(s)";
      else if (actionOwnDialog.action === "rejeitar") actionText = "rejeitado(s)";
      else if (actionOwnDialog.action === "devolver") actionText = "devolvido(s) ao rascunho";
      else if (actionOwnDialog.action === "analisar") actionText = "retornado(s) para análise";

      toast({
        title: "Ação executada",
        description: `${itemsToUpdate.length} item(ns) ${actionText} com sucesso.`,
      });
      setSelectedOwnItems(new Set());
    } catch (error: any) {
      console.error("Erro ao executar ação (Seus Itens):", error);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível executar a ação.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSolicitacao = async (itemId: string) => {
    setSelectedItems(new Set([itemId]));
    setActionDialog({ open: true, action: "devolver", isBulk: false });
  };

  const handleOwnDevolverIndividual = (itemId: string | number) => {
    setSelectedOwnItems(new Set([itemId]));
    setActionOwnDialog({ open: true, action: "devolver" });
  };

  const openSolicitacaoEditor = (item: PlanItem) => {
    setSolicitacaoEdicao(item);
    setSolicitacaoEditOpen(true);
  };

  const handleSaveSolicitacaoEdicao = async (codigo: number, updates: Partial<PlanItem>) => {
    try {
      await ensureSolicitacaoDiretoria(codigo, updates);
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

  const handleDevolverServicoDiretoria = async (servicoId: string) => {
    setSelectedServicos(new Set([servicoId]));
    setActionServicosDialog({ open: true, action: "devolver" });
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
      
      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast({ title: "Serviço excluído", description: "Serviço excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast({ title: "Erro ao excluir", description: "Não foi possível excluir o serviço.", variant: "destructive" });
    }
  };

  const handleSaveServicoEdicao = async () => {
    if (!servicoEdicao?.item) return;

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
      await ensureServicoDiretoria(servicoEdicao.item as number, updates);
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
          item.codigo && Number(item.codigo) > 0 ? item.codigo : "Não identificado",
          (item.descricao || "Não identificado").substring(0, 40),
          item.gerencia,
          item.prioridade,
          item.qtdEstimada,
          formatCurrency(item.valorUnitario),
          formatCurrency((Number(item.qtdEstimada) || 0) * (Number(item.valorUnitario) || 0))
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
          item.codigo && Number(item.codigo) > 0 ? item.codigo : "Não identificado",
          item.descricao || "Não identificado",
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
          2: { halign: "left" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "left" },
          6: { halign: "center" },
          7: { halign: "right" }
        };

        const isNovos = selectedOption === "servicos_novos";
        const categoryTitle = isNovos ? "Novos Serviços" : "Serviços Existentes";
        const categoryFile = isNovos ? "Novos_Servicos" : "Servicos_Existentes";

        const tableData = servicosFiltradasPorStatus.map((s: any) => [
          s.objeto,
          s.contrato || "-",
          s.contratada || "-",
          s.gerencia || "N/A",
          s.unidadeDemandante || "N/A",
          s.justificativa || "-",
          s.grauPrioridade || "Médio",
          `R$ ${(s.estimativaValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);

        doc.autoTable({
          head: [["Objeto", "Contrato", "Contratada", "Gerência", "Unid. Demandante", "Justificativa", "Prioridade", "Estimativa Valor"]],
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
        ["Objeto", "Contrato", "Contratada", "Gerência", "Unidade Demandante", "Justificativa", "Prioridade", "Estimativa Valor"],
        ...servicosFiltradasPorStatus.map((s: any) => [
          s.objeto,
          s.contrato || "",
          s.contratada || "",
          s.gerencia || "N/A",
          s.unidadeDemandante || "N/A",
          s.justificativa || "-",
          s.grauPrioridade || "Médio",
          s.estimativaValor || 0
        ])
      ];

      const totalValue = servicosFiltradasPorStatus.reduce((acc: number, s: any) => acc + (s.estimativaValor || 0), 0);
      worksheetData.push([]);
      worksheetData.push(["TOTAL:", "", "", "", "", "", "", totalValue]);

      const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = [
        { wch: 40 }, // Objeto
        { wch: 15 }, // Contrato
        { wch: 25 }, // Contratada
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

      for (let i = 0; i < 8; i++) {
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

    if (isEnviarComprasBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "enviar_compras") ||
          "O envio de itens para compras está temporariamente bloqueado pelo administrador.",
        variant: "destructive",
      });
      return;
    }

    setConfirmComprasOpen(false);
    setSelectedItems(new Set());
    try {
      const validIds = selectedApprovedItems.map(i => i.id!).filter(Boolean);
      if (validIds.length > 0) {
        await updateSolicitacaoStatusBulk(validIds, "em_compra");
      }
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast({
        title: "Enviado para Compras",
        description: `${selectedApprovedItems.length} item(ns) enviado(s) para o setor de Compras.`,
      });
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast({
        title: "Erro",
        description: "Nao foi possivel enviar para Compras.",
        variant: "destructive",
      });
    }
  };

  const confirmActionServicosBulk = async () => {
    if (selectedServicos.size === 0) return;

    if (actionServicosDialog.action === "aprovar" && isAprovarServicosBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "aprovar") ||
          "A aprovação de serviços está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionServicosDialog.action === "rejeitar" && isRejeitarServicosBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "reprovar") ||
          "A rejeição de serviços está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionServicosDialog.action === "devolver" && isDevolverServicosBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "devolver") ||
          "A devolução de serviços está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionServicosDialog.action === "enviar_compras" && isEnviarComprasBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "enviar_compras") ||
          "O envio de serviços para compras está temporariamente bloqueado pelo administrador.",
        variant: "destructive",
      });
      return;
    }

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
      } else if (actionServicosDialog.action === "enviar_compras") {
        newStatus = "em_compra";
        actionText = "enviado(s) para compras";
      } else if (actionServicosDialog.action === "analisar") {
        newStatus = "enviado";
        actionText = "retornado(s) para análise";
      }

      // Atualização otimista imediata na tabela de serviços
      queryClient.setQueryData(servicosQueryKey, (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((s: any) =>
          validIds.includes(s.id) ? { ...s, status: newStatus } : s
        );
      });

      await updateServicoStatusBulk(validIds, newStatus, justificativa || undefined);

      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: servicosQueryKey });
      setSelectedServicos(new Set());
      setActionServicosDialog({ open: false, action: null });
      setJustificativa("");
      toast({ title: "Sucesso", description: `${validIds.length} serviço(s) ${actionText} com sucesso.` });
    } catch (error: any) {
      console.error("Erro na ação em lote de serviços:", error);
      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: servicosQueryKey });
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
      await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
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
      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
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

    if (isAddPlanoProprioBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "adicionar_item") ||
          "A adição de itens está temporariamente bloqueada pelo administrador para este período.",
        variant: "destructive",
      });
      return;
    }

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

      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
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

    if (actionDialog.action === "aprovar" && isAprovarAquisicaoBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "aprovar") ||
          "A aprovação de solicitações está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionDialog.action === "rejeitar" && isRejeitarAquisicaoBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "reprovar") ||
          "A rejeição de solicitações está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }
    if (actionDialog.action === "devolver" && isDevolverAquisicaoBlocked) {
      toast({
        title: "🔒 Ação Bloqueada",
        description:
          getBlockReason("aprovacao", "devolver") ||
          "A devolução de solicitações está temporariamente bloqueada pelo administrador.",
        variant: "destructive",
      });
      return;
    }

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
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((s: any) => 
            validIds.includes(s.id) ? { ...s, status: newStatus } : s
          );
        });

        await updateSolicitacaoStatusBulk(validIds, newStatus, justificativa || undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      
      let actionText = "processado(s)";
      if (actionDialog.action === "aprovar") actionText = "aprovado(s)";
      else if (actionDialog.action === "rejeitar") actionText = "rejeitado(s)";
      else if (actionDialog.action === "devolver") actionText = "devolvido(s) ao rascunho";
      else if (actionDialog.action === "analisar") actionText = "retornado(s) para análise";

      toast({
        title: "Ação executada",
        description: `${itemsToUpdate.length} item(ns) ${actionText} com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro ao executar ação:", error);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível executar a ação.",
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

  const ensureServicoDiretoria = async (itemCode: number | string, updates: any) => {
    if (!diretoria || !periodAtivo) return;
    try {
      const dgGerencia = todasGerenciasDaDiretoria.find((g: any) => g.sigla === siglaUpper);
      const isDiretoriaSelected = 
        ownServicosGerenciaId === "diretoria" || 
        ownServicosGerenciaId === diretoria?.id || 
        (dgGerencia && ownServicosGerenciaId === dgGerencia.id);

      const targetGerencia = (ownServicosGerenciaId !== "todas" && !isDiretoriaSelected)
        ? todasGerenciasDaDiretoria.find((g: any) => g.id === ownServicosGerenciaId)
        : dgGerencia;

      const gerenciaIdAlvo = targetGerencia?.id || dgGerencia?.id || todasGerenciasDaDiretoria[0]?.id || "";
      const gerenciaSiglaAlvo = targetGerencia?.sigla || siglaUpper;

      const servicoDb = servicosData.find((s: any) => 
        String(s.item) === String(itemCode) &&
        (s.diretoria_id === diretoria.id || s.unidadeDemandante === siglaUpper || (s as any).diretoriaSigla === siglaUpper) &&
        (!isDiretoriaSelected || s.gerencia === siglaUpper || s.unidadeDemandante === siglaUpper || (s as any).gerencia_id === gerenciaIdAlvo)
      );

      if (servicoDb && servicoDb.id) {
        await updateServico(servicoDb.id, updates);
        return servicoDb.id;
      }
      
      let catalogoItem: any = servicosCatalogoData.find((c: any) => String(c.item) === String(itemCode));
      if (!catalogoItem) {
        catalogoItem = servicosProprios.find((s: any) => String(s.item) === String(itemCode));
      }
      if (!catalogoItem) return;

      const created = await createServico({
        periodo_id: periodAtivo.id,
        diretoria_id: diretoria.id,
        gerencia_id: gerenciaIdAlvo,
        item: catalogoItem.item,
        tipo_contratacao: updates.tipoContratacao !== undefined ? updates.tipoContratacao : (catalogoItem.tipoContratacao || catalogoItem.tipo_contratacao || ""),
        unidade_demandante: gerenciaSiglaAlvo,
        objeto: updates.objeto !== undefined ? updates.objeto : (catalogoItem.objeto || ""),
        justificativa: updates.justificativa !== undefined ? updates.justificativa : (catalogoItem.justificativa || null),
        contrato: updates.contrato !== undefined ? updates.contrato : (catalogoItem.contrato || null),
        contratada: updates.contratada !== undefined ? updates.contratada : (catalogoItem.contratada || null),
        previsao_inicio: null,
        estimativa_valor: updates.estimativaValor !== undefined ? updates.estimativaValor : (catalogoItem.estimativaValor || catalogoItem.estimativa_valor || 0),
        dotacao_orcamentaria: updates.dotacaoOrcamentaria !== undefined ? updates.dotacaoOrcamentaria : (catalogoItem.dotacaoOrcamentaria || catalogoItem.dotacao_orcamentaria || 0),
        grau_prioridade: updates.grauPrioridade !== undefined ? updates.grauPrioridade : (catalogoItem.grauPrioridade || catalogoItem.grau_prioridade || "Baixo"),
        vinculacao: updates.vinculacao !== undefined ? updates.vinculacao : (catalogoItem.vinculacao || "Não"),
        dependencia_descricao: updates.dependenciaDescricao !== undefined ? updates.dependenciaDescricao : (catalogoItem.dependenciaDescricao || catalogoItem.dependencia_descricao || null),
        observacao: updates.observacao !== undefined ? updates.observacao : (catalogoItem.observacao || ""),
        status: updates.status || "rascunho",
      });
      return created?.id;
    } catch (e) {
      console.error(e);
    }
  };

  const isServicoReadOnly = (servico: ServicoItem) =>
    servico.status === "em_compra" || servico.status === "concluido";

  const handleUpdateServicoGrauPrioridade = async (servico: ServicoItem, grauPrioridade: GrauPrioridade) => {
    if (isServicoReadOnly(servico)) return;
    if (!servico.id) {
      await ensureServicoDiretoria(servico.item, { grau_prioridade: grauPrioridade });
    } else {
      await updateServico(servico.id, { grau_prioridade: grauPrioridade });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    }
  };

  const handleUpdateServicoEstimativa = async (servico: ServicoItem, estimativaValor: number) => {
    if (isServicoReadOnly(servico)) return;
    if (!servico.id) {
      await ensureServicoDiretoria(servico.item, { estimativa_valor: estimativaValor });
    } else {
      await updateServico(servico.id, { estimativa_valor: estimativaValor });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
    }
  };

  const handleCriarServicoDiretoria = async () => {
    if (novoServicoLoading) return; // Prevent double submission
    if (!diretoria || !periodAtivo) return;
    if (!novoServicoForm.objeto.trim() || !novoServicoForm.justificativa.trim()) return;

    const dgGerencia = todasGerenciasDaDiretoria.find((g: any) => g.sigla === siglaUpper);
    const gerenciaIdAlvo = novoServicoForm.gerenciaId || (dgGerencia?.id ?? todasGerenciasDaDiretoria[0]?.id ?? "");
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
        contrato: novoServicoForm.contrato?.trim() || null,
        contratada: novoServicoForm.contratada?.trim() || null,
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
        contrato: "",
        tipoContratacao: "Contínuo",
        gerenciaId: "",
        previsaoInicio: "",
        estimativaValor: "",
        dotacaoOrcamentaria: "",
        grauPrioridade: "Médio",
        vinculacao: "Não",
        dependenciaDescricao: "",
        contratada: "",
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
    const actionText = actionServicosDialog.action === "aprovar"
      ? "aprovado(s)"
      : actionServicosDialog.action === "rejeitar"
      ? "rejeitado(s)"
      : actionServicosDialog.action === "devolver"
      ? "devolvido(s) ao rascunho"
      : actionServicosDialog.action === "analisar"
      ? "retornado(s) para análise"
      : "enviado(s) para Compras";

    const todosServicosVisiveis = [
      ...servicosFiltradasPorStatus,
      ...servicosProprios,
      ...servicosData,
    ];
    const mapUnicos = new Map<string, any>();
    todosServicosVisiveis.forEach((s: any) => {
      if (s.id && (selectedServicos.has(s.id) || selectedServicos.has(String(s.item)))) {
        mapUnicos.set(s.id, s);
      }
    });
    const servicosSelecionados = Array.from(mapUnicos.values());
    const servicosToUpdate = actionServicosDialog.action === "enviar_compras"
      ? servicosSelecionados.filter((s: any) => s.status === "aprovado")
      : servicosSelecionados;

    // Se houver itens selecionados sem ID ainda (itens do catálogo de Seus Serviços), persiste-os com o novo status
    const unpersistedToCreate = servicosProprios.filter(
      (s: any) => !s.id && (selectedServicos.has(String(s.item)) || selectedServicos.has(s.item))
    );
    let createdCount = 0;
    for (const item of unpersistedToCreate) {
      try {
        const createdId = await ensureServicoDiretoria(item.item, { status: newStatus });
        if (createdId) createdCount++;
      } catch (err) {
        console.warn("Erro ao persistir serviço novo:", err);
      }
    }

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

      const idsToUpdate = servicosToUpdate.map((s: any) => s.id).filter(Boolean);
      if (idsToUpdate.length > 0) {
        await updateServicoStatusBulk(idsToUpdate, newStatus, justificativa || undefined);
      }

      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: servicosQueryKey });
      if (diretoria?.id) {
        await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", diretoria.id] });
      }

      const totalAfetados = idsToUpdate.length + createdCount;
      toast({
        title: "Ação executada",
        description: `${totalAfetados > 0 ? totalAfetados : (servicosSelecionados.length || selectedServicos.size)} serviço(s) ${actionText} com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro ao executar ação:", error);
      await queryClient.invalidateQueries({ queryKey: ["servicos"] });
      await queryClient.invalidateQueries({ queryKey: servicosQueryKey });
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível executar a ação.",
        variant: "destructive",
      });
    }
  };

  // Handlers para seleção de serviços
  const toggleSelectAllServicos = () => {
    const selectableIds = servicosFiltradasPorStatus
      .filter((s: any) => s.id && !isServicoReadOnly(s))
      .map((s: any) => s.id as string);
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedServicos.has(id));
    const newSelected = new Set(selectedServicos);
    if (allSelected) {
      selectableIds.forEach(id => newSelected.delete(id));
    } else {
      selectableIds.forEach(id => newSelected.add(id));
    }
    setSelectedServicos(newSelected);
  };

  const contratosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    servicosData.forEach((s: ServicoItem) => {
      const c = String(s.contrato || "").trim();
      if (c && c !== "-" && c !== "null" && c !== "undefined") {
        set.add(c);
      }
    });
    return Array.from(set).sort();
  }, [servicosData]);

  const gerenciasDisponiveisParaDestino = useMemo(() => {
    const dirId = transferDialog.targetDiretoriaId || diretoria?.id;
    if (!dirId) return gerenciasData;
    const filtradas = (todasGerenciasData as any[]).filter(g => g.diretoria_id === dirId);
    return filtradas.length > 0 ? filtradas : gerenciasData;
  }, [transferDialog.targetDiretoriaId, diretoria, gerenciasData, todasGerenciasData]);

  const opcoesGerenciasDisponiveis = useMemo(() => {
    const targetDirs = (transferDialog.targetDiretoriaIds && transferDialog.targetDiretoriaIds.length > 0)
      ? transferDialog.targetDiretoriaIds
      : (transferDialog.targetDiretoriaId ? [transferDialog.targetDiretoriaId] : (diretoria?.id ? [diretoria.id] : []));

    const options: Array<{ id: string; label: string; sigla: string; diretoriaId: string; isDiretoria?: boolean }> = [];

    targetDirs.forEach((dirId) => {
      const dirObj = (diretorias as any[]).find((d: any) => String(d.id) === String(dirId));
      if (dirObj) {
        options.push({
          id: dirObj.id,
          label: `${dirObj.sigla} - Diretoria (${dirObj.nome || dirObj.sigla})`,
          sigla: dirObj.sigla,
          diretoriaId: String(dirObj.id),
          isDiretoria: true,
        });
      }
      const gers = (todasGerenciasData as any[]).filter((g: any) => String(g.diretoria_id) === String(dirId));
      gers.forEach((g: any) => {
        if (g.id && (!dirObj || String(g.id) !== String(dirObj.id))) {
          options.push({
            id: g.id,
            label: `${g.sigla} - ${g.nome}`,
            sigla: g.sigla,
            diretoriaId: String(dirId),
            isDiretoria: false,
          });
        }
      });
    });

    return options;
  }, [transferDialog.targetDiretoriaIds, transferDialog.targetDiretoriaId, diretoria, diretorias, todasGerenciasData]);

  const handleOpenTransferDialog = (
    item: PlanItem | ServicoItem,
    tipo: "aquisicao" | "servicos_existentes" | "servicos_novos"
  ) => {
    const defaultGerenciaId =
      (item as any).gerencia_id ||
      (ownGerenciaId !== "diretoria" ? ownGerenciaId : "") ||
      (gerenciasData && gerenciasData.length > 0 ? gerenciasData[0].id : "");

    setTransferDialog({
      open: true,
      tipo,
      item,
      isBulk: false,
      modo: "item",
      sourceDiretoriaId: diretoria?.id || "",
      targetDiretoriaId: diretoria?.id || "",
      targetDiretoriaIds: diretoria?.id ? [diretoria.id] : [],
      targetGerenciaId: defaultGerenciaId,
      targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
      loading: false,
    });
  };

  const handleOpenBulkTransferDialog = (
    source: "aquisicao_proprios" | "aquisicao_recebidos" | "servicos_proprios" | "servicos_recebidos"
  ) => {
    let count = 0;
    let tipo: "aquisicao" | "servicos_existentes" | "servicos_novos" = "aquisicao";

    if (source === "aquisicao_proprios") {
      count = selectedOwnItems.size;
      tipo = "aquisicao";
    } else if (source === "aquisicao_recebidos") {
      count = selectedItems.size;
      tipo = "aquisicao";
    } else if (source === "servicos_proprios" || source === "servicos_recebidos") {
      count = selectedServicos.size;
      tipo = selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes";
    }

    if (count === 0) return;

    const firstDest = (diretorias as any[]).find(d => d.id !== diretoria?.id)?.id || diretoria?.id || "";
    const firstDestObj = (diretorias as any[]).find(d => d.id === firstDest);
    const destGers = (todasGerenciasData as any[]).filter(g => String(g.diretoria_id) === String(firstDest));
    const defaultGerenciaId = firstDestObj?.id || destGers[0]?.id || "";

    if (source === "aquisicao_recebidos") {
      const selectedList = items.filter(i => selectedItems.has(i.id || String(i.codigo)));
      const selectedCats = Array.from(new Set(selectedList.map(i => i.categoria).filter(Boolean))).sort();
      const availableCats = selectedCats.length > 0 ? selectedCats : ((categorias && categorias.length > 0) ? categorias : categoriasItensProprios);
      const cat = availableCats[0] || "";

      setFiltroCategoriaTransfer("");
      setTransferDialog({
        open: true,
        tipo: "aquisicao",
        item: null,
        isBulk: true,
        modo: "categoria",
        bulkSource: "aquisicao_recebidos",
        bulkCount: count,
        selectedCategoria: cat,
        selectedCategorias: [...availableCats],
        sourceDiretoriaId: diretoria?.id || "",
        targetDiretoriaId: firstDest,
        targetDiretoriaIds: firstDest ? [firstDest] : [],
        targetGerenciaId: defaultGerenciaId,
        targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
        incluirCustoFinanceiro: true,
        loading: false,
      });
      return;
    }

    if (source === "aquisicao_proprios") {
      const selectedList = itensProprios.filter(i => selectedOwnItems.has(i.id || i.codigo));
      const selectedCats = Array.from(new Set(selectedList.map(i => i.categoria).filter(Boolean))).sort();
      const availableCats = selectedCats.length > 0 ? selectedCats : categoriasItensProprios;
      const cat = availableCats[0] || "";

      setFiltroCategoriaTransfer("");
      setTransferDialog({
        open: true,
        tipo: "aquisicao",
        item: null,
        isBulk: true,
        modo: "categoria",
        bulkSource: "aquisicao_proprios",
        bulkCount: count,
        selectedCategoria: cat,
        selectedCategorias: [...availableCats],
        sourceDiretoriaId: diretoria?.id || "",
        targetDiretoriaId: firstDest,
        targetDiretoriaIds: firstDest ? [firstDest] : [],
        targetGerenciaId: defaultGerenciaId,
        targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
        incluirCustoFinanceiro: true,
        loading: false,
      });
      return;
    }

    if (source === "servicos_recebidos" || source === "servicos_proprios") {
      const baseList = source === "servicos_recebidos" ? servicosData : servicosProprios;
      const selectedServList = baseList.filter((s: any) => selectedServicos.has(s.id || String(s.numero_termo || s.contrato)));
      const selectedConts = Array.from(new Set(selectedServList.map((s: any) => String(s.numero_termo || s.contrato || "")).filter(Boolean))).sort() as string[];
      const availableConts: string[] = selectedConts.length > 0 ? selectedConts : contratosDisponiveis;
      const c: string = availableConts[0] || "";

      setFiltroContratoTransfer("");
      setTransferDialog({
        open: true,
        tipo: selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes",
        item: null,
        isBulk: true,
        modo: "contrato",
        bulkSource: source,
        bulkCount: count,
        selectedContrato: c,
        selectedContratos: [...availableConts],
        sourceDiretoriaId: diretoria?.id || "",
        targetDiretoriaId: firstDest,
        targetDiretoriaIds: firstDest ? [firstDest] : [],
        targetGerenciaId: defaultGerenciaId,
        targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
        incluirCustoFinanceiro: true,
        loading: false,
      });
      return;
    }

    setTransferDialog({
      open: true,
      tipo,
      item: null,
      isBulk: true,
      modo: "bulk",
      bulkSource: source,
      bulkCount: count,
      sourceDiretoriaId: diretoria?.id || "",
      targetDiretoriaId: firstDest,
      targetDiretoriaIds: firstDest ? [firstDest] : [],
      targetGerenciaId: defaultGerenciaId,
      targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
      loading: false,
    });
  };

  const handleOpenCategoriaTransferDialog = (preSelectedCat?: string) => {
    const cat = preSelectedCat || (ownCategoria && ownCategoria !== "todas" ? ownCategoria : (categoriasItensProprios[0] || ""));
    const firstDest = (diretorias as any[]).find(d => d.id !== diretoria?.id)?.id || diretoria?.id || "";
    const firstDestObj = (diretorias as any[]).find(d => d.id === firstDest);
    const destGers = (todasGerenciasData as any[]).filter(g => String(g.diretoria_id) === String(firstDest));
    const defaultGerenciaId = firstDestObj?.id || destGers[0]?.id || "";

    setFiltroCategoriaTransfer("");
    setTransferDialog({
      open: true,
      tipo: "aquisicao",
      item: null,
      isBulk: true,
      modo: "categoria",
      bulkSource: "aquisicao_proprios",
      selectedCategoria: cat,
      selectedCategorias: cat ? [cat] : [...categoriasItensProprios],
      sourceDiretoriaId: diretoria?.id || "",
      targetDiretoriaId: firstDest,
      targetDiretoriaIds: firstDest ? [firstDest] : [],
      targetGerenciaId: defaultGerenciaId,
      targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleOpenCategoriaTransferDialogRecebidos = (preSelectedCat?: string) => {
    const catsDisponiveis = (categorias && categorias.length > 0) ? categorias : categoriasItensProprios;
    const cat = preSelectedCat || (selectedCategoria && selectedCategoria !== "todas" ? selectedCategoria : (catsDisponiveis[0] || ""));
    const firstDest = (diretorias as any[]).find(d => d.id !== diretoria?.id)?.id || diretoria?.id || "";
    const firstDestObj = (diretorias as any[]).find(d => d.id === firstDest);
    const destGers = (todasGerenciasData as any[]).filter(g => String(g.diretoria_id) === String(firstDest));
    const defaultGerenciaId = firstDestObj?.id || destGers[0]?.id || "";

    setFiltroCategoriaTransfer("");
    setTransferDialog({
      open: true,
      tipo: "aquisicao",
      item: null,
      isBulk: true,
      modo: "categoria",
      bulkSource: "aquisicao_recebidos",
      bulkCount: 0,
      selectedCategoria: cat,
      selectedCategorias: cat ? [cat] : [...catsDisponiveis],
      sourceDiretoriaId: diretoria?.id || "",
      targetDiretoriaId: firstDest,
      targetDiretoriaIds: firstDest ? [firstDest] : [],
      targetGerenciaId: defaultGerenciaId,
      targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleOpenContratoTransferDialog = (preSelectedContrato?: string) => {
    const c = preSelectedContrato || (contratosDisponiveis[0] || "");
    const firstDest = (diretorias as any[]).find(d => d.id !== diretoria?.id)?.id || diretoria?.id || "";
    const firstDestObj = (diretorias as any[]).find(d => d.id === firstDest);
    const destGers = (todasGerenciasData as any[]).filter(g => String(g.diretoria_id) === String(firstDest));
    const defaultGerenciaId = firstDestObj?.id || destGers[0]?.id || "";

    setFiltroContratoTransfer("");
    setTransferDialog({
      open: true,
      tipo: selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes",
      item: null,
      isBulk: true,
      modo: "contrato",
      selectedContrato: c,
      selectedContratos: c ? [c] : [...contratosDisponiveis],
      sourceDiretoriaId: diretoria?.id || "",
      targetDiretoriaId: firstDest,
      targetDiretoriaIds: firstDest ? [firstDest] : [],
      targetGerenciaId: defaultGerenciaId,
      targetGerenciaIds: defaultGerenciaId ? [defaultGerenciaId] : [],
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleConfirmTransfer = async () => {
    const { item, tipo, targetGerenciaId, targetGerenciaIds, targetDiretoriaId, targetDiretoriaIds, sourceDiretoriaId, isBulk, bulkSource, modo, selectedCategoria, selectedCategorias, selectedContrato, selectedContratos, incluirCustoFinanceiro } = transferDialog;

    const sourceDirId = sourceDiretoriaId || diretoria?.id || "";
    const targetDirIds = (targetDiretoriaIds && targetDiretoriaIds.length > 0)
      ? targetDiretoriaIds
      : (targetDiretoriaId ? [targetDiretoriaId] : (diretoria?.id ? [diretoria.id] : []));
    const finalTargetDirId = targetDirIds[0] || targetDiretoriaId || diretoria?.id || "";

    const destGers = (todasGerenciasData as any[]).filter(g => String(g.diretoria_id) === String(finalTargetDirId));
    const requestedGerId = (targetGerenciaIds && targetGerenciaIds.length > 0)
      ? targetGerenciaIds[0]
      : (targetGerenciaId || "");

    const dirDestinoObj = (diretorias as any[]).find((d: any) => String(d.id) === String(finalTargetDirId));
    const dirDestinoSigla = dirDestinoObj?.sigla || siglaUpper;

    const defaultGer = destGers.find((g: any) =>
      String(g.sigla).toUpperCase() === String(dirDestinoSigla).toUpperCase() ||
      String(g.nome).toLowerCase().includes("diretoria") ||
      String(g.nome).toLowerCase().includes("presidência") ||
      String(g.sigla).toUpperCase().includes("PRG")
    ) || destGers[0];

    const isGerValid = destGers.some(g => String(g.id) === String(requestedGerId));
    const effectiveTargetGerId = isGerValid
      ? requestedGerId
      : (defaultGer?.id || finalTargetDirId);

    const finalTargetGerIds = [effectiveTargetGerId];

    const finalCats = (selectedCategorias && selectedCategorias.length > 0)
      ? selectedCategorias
      : (selectedCategoria ? [selectedCategoria] : []);

    const finalContratos = (selectedContratos && selectedContratos.length > 0)
      ? selectedContratos
      : (selectedContrato ? [selectedContrato] : []);

    if (targetDirIds.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione ao menos uma diretoria de destino.",
        variant: "destructive",
      });
      return;
    }

    if (modo === "categoria" && finalCats.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione ao menos uma categoria a transferir.",
        variant: "destructive",
      });
      return;
    }

    if (modo === "contrato" && finalContratos.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione ao menos um contrato a transferir.",
        variant: "destructive",
      });
      return;
    }

    if (modo !== "categoria" && modo !== "contrato" && !effectiveTargetGerId) {
      return;
    }

    setTransferDialog((prev) => ({ ...prev, loading: true }));

    const gerenciaDestinoObj = (todasGerenciasData as any[]).find((g: any) => g.id === effectiveTargetGerId);
    const gerenciaDestinoSigla = gerenciaDestinoObj?.sigla 
      || (gerenciaMap[effectiveTargetGerId] && gerenciaMap[effectiveTargetGerId] !== "N/A" ? gerenciaMap[effectiveTargetGerId] : undefined)
      || (effectiveTargetGerId === finalTargetDirId ? dirDestinoSigla : undefined)
      || dirDestinoSigla 
      || "Gerência";
    const dirOrigemObj = (diretorias as any[]).find((d: any) => d.id === sourceDirId);
    const origemSiglaCalculada = dirOrigemObj?.sigla || siglaUpper;

    const siglasDestino = targetDirIds
      .map(id => (diretorias as any[]).find(d => d.id === id)?.sigla)
      .filter(Boolean)
      .join(", ");

    const formatCurrencyLocal = (val: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

    try {
      // Transferência de Categoria em Aquisição
      if (modo === "categoria" && finalCats.length > 0) {
        const comCusto = incluirCustoFinanceiro !== false;

        // Se veio de seleção pontual de itens em "Recebidos das Gerências"
        if (isBulk && bulkSource === "aquisicao_recebidos" && selectedItems.size > 0) {
          const selectedSet = new Set(finalCats.map(c => (c || "").trim().toLowerCase()));
          const itensFiltrados = items.filter(i => 
            selectedItems.has(i.id || String(i.codigo)) && 
            selectedSet.has((i.categoria || "").trim().toLowerCase())
          );
          const idsParaTransferir = itensFiltrados.map(i => i.id).filter((id): id is string => typeof id === "string");
          const totalValor = itensFiltrados.reduce((acc, i) => acc + (Number(i.qtdEstimada || 0) * Number(i.valorUnitario || 0)), 0);

          if (idsParaTransferir.length > 0) {
            const transferTask = (async () => {
              await transferirSolicitacoesParaGerenciaBulk(
                idsParaTransferir,
                effectiveTargetGerId,
                finalTargetDirId,
                siglaUpper,
                comCusto ? "aprovado" : "rascunho",
                true
              );
              if (!comCusto) {
                await updateSolicitacoesBulkData(idsParaTransferir, {
                  qtd_estimada: 0,
                  observacao: `[Transferido sem custo da Diretoria ${siglaUpper}]`,
                });
              }
            })();

            const logTask = registrarLogAtividade("TRANSFERIR", "solicitacoes", finalCats.join(", "), {
              acao: "transferir_categoria_aquisicao",
              categorias: finalCats,
              solicitacao_ids: idsParaTransferir,
              itens_origem_info: itensFiltrados.map(i => ({
                id: String(i.id),
                gerencia_id: String(i.gerencia_id || ""),
                diretoria_id: String(i.diretoria_id || sourceDirId || ""),
                status: String(i.status || "aprovado"),
              })),
              count: idsParaTransferir.length,
              totalValor: comCusto ? totalValor : 0,
              sourceDiretoriaId: sourceDirId,
              targetDiretoriaIds: targetDirIds,
              targetGerenciaId: effectiveTargetGerId,
              incluirCustoFinanceiro: comCusto,
            }).catch((e) => {
              console.warn("Erro ao registrar log de atividade:", e);
            });

            await Promise.all([transferTask, logTask]);

            const removeSet = new Set(idsParaTransferir);
            queryClient.setQueryData(solicitacoesQueryKey, (old: any) =>
              Array.isArray(old) ? old.filter((i: any) => !removeSet.has(i.id)) : old
            );
          }

          setSelectedItems(new Set());
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["solicitacoes"] }),
            queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey }),
            sourceDirId
              ? queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", sourceDirId] })
              : Promise.resolve(),
            ...targetDirIds.map((dirId) =>
              queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", dirId] })
            ),
            periodAtivo && effectiveTargetGerId
              ? queryClient.invalidateQueries({ queryKey: ["solicitacoes", effectiveTargetGerId, periodAtivo.id] })
              : Promise.resolve(),
          ]);

          const catsText = finalCats.length === 1 ? `"${finalCats[0]}"` : `${finalCats.length} categorias (${finalCats.join(", ")})`;
          const msgSucesso = comCusto
            ? `${idsParaTransferir.length} item(ns) das categoria(s) ${catsText} (${formatCurrencyLocal(totalValor)}) transferido(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`
            : `${idsParaTransferir.length} item(ns) das categoria(s) ${catsText} transferido(s) SEM custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`;

          toast({
            title: comCusto ? "Transferência com custo" : "Transferência sem custo",
            description: msgSucesso,
          });

          setTransferDialog({
            open: false,
            tipo: "aquisicao",
            item: null,
            isBulk: false,
            modo: "item",
            targetGerenciaId: "",
            targetDiretoriaIds: [],
            selectedCategorias: [],
            selectedContratos: [],
            loading: false,
          });
          return;
        }

        // Se veio de seleção pontual de itens em "Seus Itens"
        if (isBulk && bulkSource === "aquisicao_proprios" && selectedOwnItems.size > 0) {
          const selectedSet = new Set(finalCats.map(c => (c || "").trim().toLowerCase()));
          const itensFiltrados = itensProprios.filter(i => 
            selectedOwnItems.has(i.id || i.codigo) && 
            selectedSet.has((i.categoria || "").trim().toLowerCase())
          );
          const uuidIds: string[] = [];
          const codeItems: number[] = [];
          itensFiltrados.forEach(i => {
            if (i.id && typeof i.id === "string" && i.id.includes("-")) {
              uuidIds.push(i.id);
            } else if (i.codigo) {
              codeItems.push(i.codigo);
            }
          });
          const totalValor = itensFiltrados.reduce((acc, i) => acc + (Number(i.qtdEstimada || 0) * Number(i.valorUnitario || 0)), 0);

          const transferTask = (async () => {
            if (uuidIds.length > 0) {
              await transferirSolicitacoesParaGerenciaBulk(
                uuidIds,
                effectiveTargetGerId,
                finalTargetDirId,
                siglaUpper,
                comCusto ? "aprovado" : "rascunho",
                true
              );
              if (!comCusto) {
                await updateSolicitacoesBulkData(uuidIds, {
                  qtd_estimada: 0,
                  observacao: `[Transferido sem custo da Diretoria ${siglaUpper}]`,
                });
              }
            }

            if (codeItems.length > 0) {
              await Promise.all(
                codeItems.map((codigo) =>
                  ensureSolicitacaoDiretoria(codigo, {
                    status: comCusto ? "aprovado" : "rascunho",
                    qtdEstimada: comCusto ? undefined : 0,
                    observacao: `[Transferido da Diretoria ${siglaUpper}]`,
                  })
                )
              );
            }
          })();

          const logTask = registrarLogAtividade("TRANSFERIR", "solicitacoes", finalCats.join(", "), {
            acao: "transferir_categoria_aquisicao",
            categorias: finalCats,
            solicitacao_ids: uuidIds,
            itens_origem_info: itensFiltrados.map(i => ({
              id: String(i.id),
              gerencia_id: String(i.gerencia_id || ""),
              diretoria_id: String(i.diretoria_id || sourceDirId || ""),
              status: String(i.status || "aprovado"),
            })),
            count: itensFiltrados.length,
            totalValor: comCusto ? totalValor : 0,
            sourceDiretoriaId: sourceDirId,
            targetDiretoriaIds: targetDirIds,
            targetGerenciaId: effectiveTargetGerId,
            incluirCustoFinanceiro: comCusto,
          }).catch((e) => {
            console.warn("Erro ao registrar log de atividade:", e);
          });

          await Promise.all([transferTask, logTask]);

          if (uuidIds.length > 0) {
            const removeSet = new Set(uuidIds);
            queryClient.setQueryData(solicitacoesQueryKey, (old: any) =>
              Array.isArray(old) ? old.filter((i: any) => !removeSet.has(i.id)) : old
            );
          }

          setSelectedOwnItems(new Set());
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["solicitacoes"] }),
            queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey }),
            sourceDirId
              ? queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", sourceDirId] })
              : Promise.resolve(),
            ...targetDirIds.map((dirId) =>
              queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", dirId] })
            ),
            periodAtivo && effectiveTargetGerId
              ? queryClient.invalidateQueries({ queryKey: ["solicitacoes", effectiveTargetGerId, periodAtivo.id] })
              : Promise.resolve(),
          ]);

          const catsText = finalCats.length === 1 ? `"${finalCats[0]}"` : `${finalCats.length} categorias (${finalCats.join(", ")})`;
          const msgSucesso = comCusto
            ? `${itensFiltrados.length} item(ns) das categoria(s) ${catsText} (${formatCurrencyLocal(totalValor)}) transferido(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`
            : `${itensFiltrados.length} item(ns) das categoria(s) ${catsText} transferido(s) SEM custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`;

          toast({
            title: comCusto ? "Transferência com custo" : "Transferência sem custo",
            description: msgSucesso,
          });

          setTransferDialog({
            open: false,
            tipo: "aquisicao",
            item: null,
            isBulk: false,
            modo: "item",
            targetGerenciaId: "",
            targetDiretoriaIds: [],
            selectedCategorias: [],
            selectedContratos: [],
            loading: false,
          });
          return;
        }

        const res = await transferirCategoriaAquisicao({
          categorias: finalCats,
          sourceDiretoriaId: sourceDirId,
          targetDiretoriaId: finalTargetDirId,
          targetDiretoriaIds: targetDirIds,
          targetGerenciaId: effectiveTargetGerId,
          targetGerenciaIds: finalTargetGerIds,
          periodoId: periodAtivo?.id,
          origemSigla: origemSiglaCalculada,
          incluirCustoFinanceiro: comCusto,
          knownSolicitacoes: solicitacoes,
        });

        if (comCusto && res.transferredIds && res.transferredIds.length > 0) {
          const removeSet = new Set(res.transferredIds);
          queryClient.setQueryData(solicitacoesQueryKey, (old: any) =>
            Array.isArray(old) ? old.filter((i: any) => !removeSet.has(i.id)) : old
          );
        }

        setSelectedOwnItems(new Set());
        setSelectedItems(new Set());
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["solicitacoes"] }),
          queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey }),
          sourceDirId
            ? queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", sourceDirId] })
            : Promise.resolve(),
          ...targetDirIds.map((dirId) =>
            queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", dirId] })
          ),
          periodAtivo && effectiveTargetGerId
            ? queryClient.invalidateQueries({ queryKey: ["solicitacoes", effectiveTargetGerId, periodAtivo.id] })
            : Promise.resolve(),
        ]);

        const catsText = finalCats.length === 1 ? `"${finalCats[0]}"` : `${finalCats.length} categorias (${finalCats.join(", ")})`;
        const msgSucesso = comCusto
          ? `Categoria(s) ${catsText} (${res.count} itens, ${formatCurrencyLocal(res.totalValor)}) transferida(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`
          : `Categoria(s) ${catsText} (${res.count} itens) disponibilizada(s) para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla} SEM custo financeiro.`;

        toast({
          title: comCusto ? "Transferência de Categoria com custo" : "Transferência de Categoria sem custo",
          description: msgSucesso,
        });

        setTransferDialog({
          open: false,
          tipo: "aquisicao",
          item: null,
          isBulk: false,
          modo: "item",
          targetGerenciaId: "",
          targetDiretoriaIds: [],
          selectedCategorias: [],
          selectedContratos: [],
          loading: false,
        });
        return;
      }

      // Transferência de Contrato em Serviços
      if (modo === "contrato" && finalContratos.length > 0) {
        const comCusto = incluirCustoFinanceiro !== false;

        // Se veio de seleção pontual de serviços
        if (isBulk && (bulkSource === "servicos_recebidos" || bulkSource === "servicos_proprios") && selectedServicos.size > 0) {
          const baseList = bulkSource === "servicos_recebidos" ? servicosData : servicosProprios;
          const selectedSet = new Set(finalContratos.map(c => (c || "").trim()));
          const servicosFiltrados = (baseList as any[]).filter((s: any) => 
            selectedServicos.has(s.id || String(s.numero_termo || s.contrato)) && 
            selectedSet.has(String(s.numero_termo || s.contrato || "").trim())
          );
          const idsParaTransferir = servicosFiltrados.map((s: any) => s.id).filter(Boolean) as string[];
          const totalValor = servicosFiltrados.reduce((acc: number, s: any) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || s.estimativa_valor || 0), 0);

          if (idsParaTransferir.length > 0) {
            const transferTask = (async () => {
              await transferirServicosParaGerenciaBulk(
                idsParaTransferir,
                targetGerenciaId,
                finalTargetDirId,
                siglaUpper,
                comCusto ? "aprovado" : "rascunho",
                true
              );
              if (!comCusto) {
                await updateServicosBulkData(idsParaTransferir, {
                  dotacao_orcamentaria: 0,
                  estimativa_valor: 0,
                });
              }
            })();

            const logTask = registrarLogAtividade("TRANSFERIR", "servicos", finalContratos.join(", "), {
              acao: "transferir_contrato_servicos",
              contratos: finalContratos,
              servico_ids: idsParaTransferir,
              servicos_origem_info: servicosFiltrados.map((s: any) => ({
                id: String(s.id),
                gerencia_id: String(s.gerencia_id || ""),
                diretoria_id: String(s.diretoria_id || sourceDirId || ""),
                status: String(s.status || "aprovado"),
              })),
              count: idsParaTransferir.length,
              totalValor: comCusto ? totalValor : 0,
              sourceDiretoriaId: sourceDirId,
              targetDiretoriaIds: targetDirIds,
              targetGerenciaId: effectiveTargetGerId,
              incluirCustoFinanceiro: comCusto,
            }).catch((e) => {
              console.warn("Erro ao registrar log de atividade:", e);
            });

            await Promise.all([transferTask, logTask]);

            const removeSet = new Set(idsParaTransferir);
            queryClient.setQueryData(servicosQueryKey, (old: any) =>
              Array.isArray(old) ? old.filter((s: any) => !removeSet.has(s.id)) : old
            );
          }

          setSelectedServicos(new Set());
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: ["servicos"] }),
            queryClient.invalidateQueries({ queryKey: servicosQueryKey }),
            sourceDirId
              ? queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", sourceDirId] })
              : Promise.resolve(),
            ...targetDirIds.map((dirId) =>
              queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", dirId] })
            ),
            periodAtivo && effectiveTargetGerId
              ? queryClient.invalidateQueries({ queryKey: ["servicos", effectiveTargetGerId, periodAtivo.id] })
              : Promise.resolve(),
          ]);

          const contratosText = finalContratos.length === 1 ? `"${finalContratos[0]}"` : `${finalContratos.length} contratos (${finalContratos.join(", ")})`;
          const msgSucesso = comCusto
            ? `${idsParaTransferir.length} serviço(s) do(s) contrato(s) ${contratosText} (${formatCurrencyLocal(totalValor)}) transferido(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`
            : `${idsParaTransferir.length} serviço(s) do(s) contrato(s) ${contratosText} transferido(s) SEM custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`;

          toast({
            title: comCusto ? "Transferência com custo" : "Transferência sem custo",
            description: msgSucesso,
          });

          setTransferDialog({
            open: false,
            tipo: "aquisicao",
            item: null,
            isBulk: false,
            modo: "item",
            targetGerenciaId: "",
            targetDiretoriaIds: [],
            selectedCategorias: [],
            selectedContratos: [],
            loading: false,
          });
          return;
        }

        const res = await transferirContratoServicos({
          contratos: finalContratos,
          sourceDiretoriaId: sourceDirId,
          targetDiretoriaId: finalTargetDirId,
          targetDiretoriaIds: targetDirIds,
          targetGerenciaId: effectiveTargetGerId,
          targetGerenciaIds: finalTargetGerIds,
          periodoId: periodAtivo?.id,
          origemSigla: origemSiglaCalculada,
          incluirCustoFinanceiro: comCusto,
          knownServicos: servicosData,
        });

        if (comCusto && res.transferredIds && res.transferredIds.length > 0) {
          const removeSet = new Set(res.transferredIds);
          queryClient.setQueryData(servicosQueryKey, (old: any) =>
            Array.isArray(old) ? old.filter((s: any) => !removeSet.has(s.id)) : old
          );
        }

        setSelectedServicos(new Set());
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["servicos"] }),
          queryClient.invalidateQueries({ queryKey: servicosQueryKey }),
          sourceDirId
            ? queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", sourceDirId] })
            : Promise.resolve(),
          ...targetDirIds.map((dirId) =>
            queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", dirId] })
          ),
          periodAtivo && effectiveTargetGerId
            ? queryClient.invalidateQueries({ queryKey: ["servicos", effectiveTargetGerId, periodAtivo.id] })
            : Promise.resolve(),
        ]);

        const contratosText = finalContratos.length === 1 ? `"${finalContratos[0]}"` : `${finalContratos.length} contratos (${finalContratos.join(", ")})`;
        const msgSucesso = comCusto
          ? `Contrato(s) ${contratosText} (${res.count} serviços, ${formatCurrencyLocal(res.totalValor)}) transferido(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`
          : `Contrato(s) ${contratosText} (${res.count} serviços) disponibilizado(s) para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla} SEM custo financeiro.`;

        toast({
          title: comCusto ? "Transferência de Contrato com custo" : "Transferência de Contrato sem custo",
          description: msgSucesso,
        });

        setTransferDialog({
          open: false,
          tipo: "aquisicao",
          item: null,
          isBulk: false,
          modo: "item",
          targetGerenciaId: "",
          targetDiretoriaIds: [],
          selectedCategorias: [],
          selectedContratos: [],
          loading: false,
        });
        return;
      }

      if (isBulk) {
        if (bulkSource === "aquisicao_proprios") {
          const selectedArray = Array.from(selectedOwnItems);
          const uuidIds: string[] = [];
          const codeItems: number[] = [];

          for (const rawId of selectedArray) {
            const strId = String(rawId);
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strId);
            if (isUuid) {
              uuidIds.push(strId);
            } else {
              codeItems.push(Number(rawId));
            }
          }

          if (uuidIds.length > 0) {
            await transferirSolicitacoesParaGerenciaBulk(uuidIds, effectiveTargetGerId, finalTargetDirId, siglaUpper);
          }

          for (const codigo of codeItems) {
            await ensureSolicitacaoDiretoria(codigo, {
              status: "rascunho",
              gerencia_id: effectiveTargetGerId,
              diretoria_id: finalTargetDirId,
              observacao: `[Transferido da Diretoria ${siglaUpper}]`,
            });
          }

          setSelectedOwnItems(new Set());
          await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
          await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
          if (finalTargetDirId) {
            await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", finalTargetDirId] });
          }
          if (periodAtivo) {
            await queryClient.invalidateQueries({ queryKey: ["solicitacoes", effectiveTargetGerId, periodAtivo.id] });
          }

          toast({
            title: "Transferência em massa concluída",
            description: `${selectedArray.length} item(ns) transferido(s) para a Diretoria ${dirDestinoSigla} (${gerenciaDestinoSigla}) com sucesso.`,
          });
        } else if (bulkSource === "aquisicao_recebidos") {
          const ids = Array.from(selectedItems).filter((id): id is string => typeof id === "string");
          if (ids.length > 0) {
            await transferirSolicitacoesParaGerenciaBulk(ids, effectiveTargetGerId, finalTargetDirId, siglaUpper);
          }

          setSelectedItems(new Set());
          await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
          await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
          if (finalTargetDirId) {
            await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", finalTargetDirId] });
          }
          if (periodAtivo) {
            await queryClient.invalidateQueries({ queryKey: ["solicitacoes", effectiveTargetGerId, periodAtivo.id] });
          }

          toast({
            title: "Transferência em massa concluída",
            description: `${ids.length} item(ns) transferido(s) para a Diretoria ${dirDestinoSigla} (${gerenciaDestinoSigla}) com sucesso.`,
          });
        } else if (bulkSource === "servicos_proprios" || bulkSource === "servicos_recebidos") {
          const ids = Array.from(selectedServicos).filter(Boolean);
          if (ids.length > 0) {
            await transferirServicosParaGerenciaBulk(ids, effectiveTargetGerId, finalTargetDirId, siglaUpper);
          }

          setSelectedServicos(new Set());
          await queryClient.invalidateQueries({ queryKey: ["servicos"] });
          await queryClient.invalidateQueries({ queryKey: servicosQueryKey });
          if (finalTargetDirId) {
            await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", finalTargetDirId] });
          }
          if (periodAtivo) {
            await queryClient.invalidateQueries({ queryKey: ["servicos", effectiveTargetGerId, periodAtivo.id] });
          }

          toast({
            title: "Transferência em massa concluída",
            description: `${ids.length} serviço(s) transferido(s) para a Diretoria ${dirDestinoSigla} (${gerenciaDestinoSigla}) com sucesso.`,
          });
        }

        setTransferDialog({
          open: false,
          tipo: "aquisicao",
          item: null,
          isBulk: false,
          modo: "item",
          targetGerenciaId: "",
          loading: false,
        });
        return;
      }

      // Fluxo individual
      if (!item) return;

      const tagOrigem = `[Transferido da Diretoria ${siglaUpper}]`;

      if (tipo === "aquisicao") {
        const planItem = item as PlanItem;
        const itemId = planItem.id;
        const obsAtual = planItem.observacao || "";
        const novaObs = obsAtual.includes(tagOrigem) ? obsAtual : (obsAtual ? `${tagOrigem} ${obsAtual}` : tagOrigem);

        if (!itemId && planItem.codigo) {
          await ensureSolicitacaoDiretoria(planItem.codigo, {
            status: "rascunho",
            gerencia_id: effectiveTargetGerId,
            diretoria_id: finalTargetDirId,
            observacao: novaObs,
          });
        } else if (itemId) {
          await updateSolicitacao(itemId, {
            status: "rascunho",
            gerencia_id: effectiveTargetGerId,
            diretoria_id: finalTargetDirId,
            observacao: novaObs,
          });
        }

        await registrarLogAtividade("TRANSFERIR", "solicitacoes", itemId || String(planItem.codigo), {
          acao: "transferir_para_gerencia",
          item_codigo: planItem.codigo,
          descricao: planItem.descricao,
          diretoria_destino_id: finalTargetDirId,
          diretoria_destino_sigla: dirDestinoSigla,
          gerencia_destino_id: effectiveTargetGerId,
          gerencia_destino_sigla: gerenciaDestinoSigla,
          status_anterior: planItem.status,
          status_novo: "rascunho",
        });

        queryClient.setQueryData(solicitacoesQueryKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((i: any) =>
            i.id === itemId || (planItem.codigo && i.codigo === planItem.codigo)
              ? { ...i, status: "rascunho", diretoria_id: finalTargetDirId, gerencia_id: effectiveTargetGerId, gerencia: gerenciaDestinoSigla }
              : i
          );
        });

        await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
        await queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
        if (finalTargetDirId) {
          await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", finalTargetDirId] });
        }
        if (periodAtivo) {
          await queryClient.invalidateQueries({ queryKey: ["solicitacoes", effectiveTargetGerId, periodAtivo.id] });
        }

        toast({
          title: "Transferência realizada",
          description: `Item transferido para a Diretoria ${dirDestinoSigla} (${gerenciaDestinoSigla}) com sucesso.`,
        });
      } else {
        const servicoItem = item as ServicoItem;
        const servicoId = servicoItem.id;
        const obsAtual = servicoItem.observacao || "";
        const novaObs = obsAtual.includes(tagOrigem) ? obsAtual : (obsAtual ? `${tagOrigem} ${obsAtual}` : tagOrigem);

        if (!servicoId && servicoItem.item) {
          await ensureServicoDiretoria(servicoItem.item, {
            status: "rascunho",
            gerencia_id: effectiveTargetGerId,
            diretoria_id: finalTargetDirId,
            observacao: novaObs,
          });
        } else if (servicoId) {
          await updateServico(servicoId, {
            status: "rascunho",
            gerencia_id: effectiveTargetGerId,
            diretoria_id: finalTargetDirId,
            observacao: novaObs,
          });
        }

        await registrarLogAtividade("TRANSFERIR", "servicos", servicoId || String(servicoItem.item), {
          acao: "transferir_para_gerencia",
          item_numero: servicoItem.item,
          objeto: servicoItem.objeto,
          diretoria_destino_id: finalTargetDirId,
          diretoria_destino_sigla: dirDestinoSigla,
          gerencia_destino_id: effectiveTargetGerId,
          gerencia_destino_sigla: gerenciaDestinoSigla,
          status_anterior: servicoItem.status,
          status_novo: "rascunho",
        });

        queryClient.setQueryData(servicosQueryKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((s: any) =>
            s.id === servicoId || (servicoItem.item && s.item === servicoItem.item)
              ? { ...s, status: "rascunho", diretoria_id: finalTargetDirId, gerencia_id: effectiveTargetGerId, gerencia: gerenciaDestinoSigla }
              : s
          );
        });

        await queryClient.invalidateQueries({ queryKey: ["servicos"] });
        await queryClient.invalidateQueries({ queryKey: servicosQueryKey });
        if (finalTargetDirId) {
          await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", finalTargetDirId] });
        }
        if (periodAtivo) {
          await queryClient.invalidateQueries({ queryKey: ["servicos", effectiveTargetGerId, periodAtivo.id] });
        }

        toast({
          title: "Transferência realizada",
          description: `Serviço transferido para a Diretoria ${dirDestinoSigla} (${gerenciaDestinoSigla}) com sucesso.`,
        });
      }

      setTransferDialog({ open: false, tipo: "aquisicao", item: null, isBulk: false, modo: "item", targetGerenciaId: "", loading: false });
    } catch (error: any) {
      console.error("Erro ao transferir item/serviço:", error);
      toast({
        title: "Erro na transferência",
        description: error?.message || "Não foi possível transferir para a gerência.",
        variant: "destructive",
      });
      setTransferDialog((prev) => ({ ...prev, loading: false }));
    }
  };



  const renderTransferDialog = () => (
        <Dialog open={transferDialog.open} onOpenChange={(open) => !transferDialog.loading && setTransferDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                {transferDialog.modo === "categoria"
                  ? "Transferir Categoria para outra Diretoria"
                  : transferDialog.modo === "contrato"
                  ? "Transferir Contrato para outra Diretoria"
                  : transferDialog.isBulk
                  ? "Transferir Itens para outra Diretoria / Gerência"
                  : "Transferir para outra Diretoria / Gerência"}
              </DialogTitle>
              <DialogDescription>
                {transferDialog.modo === "categoria"
                  ? "Transfere todos os itens e o custo financeiro da categoria selecionada para outra Diretoria e Gerência."
                  : transferDialog.modo === "contrato"
                  ? "Transfere todos os serviços e o custo financeiro do contrato selecionado para outra Diretoria e Gerência."
                  : transferDialog.isBulk
                  ? `Os ${transferDialog.bulkCount} registros selecionados e seus respectivos custos serão transferidos para o destino.`
                  : "O registro selecionado e seu custo financeiro serão transferidos para a Diretoria e Gerência de destino."}
              </DialogDescription>
            </DialogHeader>
  
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-4">
              {/* Modo Categoria */}
              {transferDialog.modo === "categoria" && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-muted-foreground block">
                        Categoria(s) a Transferir (escolha uma ou mais):
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const listaCatsBase = (transferDialog.bulkSource === "aquisicao_recebidos")
                              ? ((categorias && categorias.length > 0) ? categorias : categoriasItensProprios)
                              : categoriasItensProprios;
                            setTransferDialog(prev => ({
                              ...prev,
                              selectedCategorias: [...listaCatsBase],
                              selectedCategoria: listaCatsBase[0] || "",
                            }));
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Todas ({((transferDialog.bulkSource === "aquisicao_recebidos") ? ((categorias && categorias.length > 0) ? categorias : categoriasItensProprios) : categoriasItensProprios).length})
                        </button>
                        <span className="text-[11px] text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferDialog(prev => ({
                              ...prev,
                              selectedCategorias: [],
                              selectedCategoria: "",
                            }));
                          }}
                          className="text-[11px] text-muted-foreground hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
  
                    {/* Input de filtro para categorias */}
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar categoria..."
                        value={filtroCategoriaTransfer}
                        onChange={(e) => setFiltroCategoriaTransfer(e.target.value)}
                        className="pl-8 h-8 text-xs bg-background"
                        disabled={transferDialog.loading}
                      />
                    </div>
  
                    {/* Lista com scroll e checkboxes */}
                    <div className="space-y-1 p-2 rounded-lg border bg-background max-h-40 overflow-y-auto">
                      {(() => {
                        const termo = filtroCategoriaTransfer.trim().toLowerCase();
                        const listaCatsBase = (transferDialog.bulkSource === "aquisicao_recebidos")
                          ? ((categorias && categorias.length > 0) ? categorias : categoriasItensProprios)
                          : categoriasItensProprios;
                        const categoriasFiltradas = listaCatsBase.filter(cat =>
                          !termo || cat.toLowerCase().includes(termo)
                        );
  
                        if (categoriasFiltradas.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Nenhuma categoria encontrada
                            </p>
                          );
                        }
  
                        const selectedList = transferDialog.selectedCategorias || (transferDialog.selectedCategoria ? [transferDialog.selectedCategoria] : []);
  
                        return categoriasFiltradas.map((cat: string) => {
                          const isSelected = selectedList.includes(cat);
                          return (
                            <label
                              key={cat}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                                isSelected
                                  ? "bg-blue-50/80 border-blue-400 text-blue-900 font-semibold"
                                  : "border-transparent hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setTransferDialog(prev => {
                                    const current = prev.selectedCategorias || (prev.selectedCategoria ? [prev.selectedCategoria] : []);
                                    const updated = checked
                                      ? [...new Set([...current, cat])]
                                      : current.filter(c => c !== cat);
                                    return {
                                      ...prev,
                                      selectedCategorias: updated,
                                      selectedCategoria: updated[0] || "",
                                    };
                                  });
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              <span className="truncate" title={cat}>
                                {cat}
                              </span>
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>
  
                  {(() => {
                    const selectedList = transferDialog.selectedCategorias || (transferDialog.selectedCategoria ? [transferDialog.selectedCategoria] : []);
                    const selectedSet = new Set(selectedList.map(c => (c || "").trim().toLowerCase()));
  
                    const baseItens = (transferDialog.bulkSource === "aquisicao_recebidos")
                      ? (selectedItems.size > 0 ? items.filter(i => selectedItems.has(i.id || String(i.codigo))) : items)
                      : [...items, ...itensProprios];
  
                    const itensDasCats = baseItens.filter(
                      (i) => selectedSet.has((i.categoria || "").trim().toLowerCase())
                    );
                    const itensComQtd = itensDasCats.filter((i) => i.qtdEstimada > 0);
                    const valorTotalCat = itensComQtd.reduce((acc, i) => acc + (i.qtdEstimada * i.valorUnitario), 0);
  
                    return (
                      <div className="rounded border bg-blue-50/60 border-blue-200 p-2.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                        <span>
                          Selecionadas: <strong>{selectedList.length}</strong> | Itens c/ quantidade: <strong>{itensComQtd.length}</strong> ({itensDasCats.length} no catálogo)
                        </span>
                        <span>
                          Custo Financeiro Total: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotalCat)}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
  
              {/* Modo Contrato */}
              {transferDialog.modo === "contrato" && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-muted-foreground block">
                        Contrato(s) a Transferir (escolha um ou mais):
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const listaContratosBase: string[] = (transferDialog.bulkSource === "servicos_recebidos")
                              ? Array.from(new Set((servicosData as any[]).map((s: any) => String(s.numero_termo || s.contrato || "")).filter(Boolean))).sort()
                              : contratosDisponiveis;
                            setTransferDialog(prev => ({
                              ...prev,
                              selectedContratos: [...listaContratosBase],
                              selectedContrato: listaContratosBase[0] || "",
                            }));
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Todos ({((transferDialog.bulkSource === "servicos_recebidos") ? Array.from(new Set((servicosData as any[]).map((s: any) => String(s.numero_termo || s.contrato || "")).filter(Boolean))) : contratosDisponiveis).length})
                        </button>
                        <span className="text-[11px] text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferDialog(prev => ({
                              ...prev,
                              selectedContratos: [],
                              selectedContrato: "",
                            }));
                          }}
                          className="text-[11px] text-muted-foreground hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
  
                    {/* Input de filtro para contratos */}
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar contrato..."
                        value={filtroContratoTransfer}
                        onChange={(e) => setFiltroContratoTransfer(e.target.value)}
                        className="pl-8 h-8 text-xs bg-background"
                        disabled={transferDialog.loading}
                      />
                    </div>
  
                    {/* Lista com scroll e checkboxes */}
                    <div className="space-y-1 p-2 rounded-lg border bg-background max-h-40 overflow-y-auto">
                      {(() => {
                        const termo = filtroContratoTransfer.trim().toLowerCase();
                        const listaContratosBase: string[] = (transferDialog.bulkSource === "servicos_recebidos")
                          ? Array.from(new Set((servicosData as any[]).map((s: any) => String(s.numero_termo || s.contrato || "")).filter(Boolean))).sort()
                          : contratosDisponiveis;
                        const contratosFiltrados = listaContratosBase.filter((c: string) =>
                          !termo || c.toLowerCase().includes(termo)
                        );
  
                        if (contratosFiltrados.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Nenhum contrato encontrado
                            </p>
                          );
                        }
  
                        const selectedList = transferDialog.selectedContratos || (transferDialog.selectedContrato ? [transferDialog.selectedContrato] : []);
  
                        return contratosFiltrados.map((c: string) => {
                          const isSelected = selectedList.includes(c);
                          return (
                            <label
                              key={c}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                                isSelected
                                  ? "bg-blue-50/80 border-blue-400 text-blue-900 font-semibold"
                                  : "border-transparent hover:bg-muted text-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setTransferDialog(prev => {
                                    const current = prev.selectedContratos || (prev.selectedContrato ? [prev.selectedContrato] : []);
                                    const updated = checked
                                      ? [...new Set([...current, c])]
                                      : current.filter(item => item !== c);
                                    return {
                                      ...prev,
                                      selectedContratos: updated,
                                      selectedContrato: updated[0] || "",
                                    };
                                  });
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                              />
                              <span className="truncate" title={`Contrato ${c}`}>
                                Contrato {c}
                              </span>
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>
  
                  {(() => {
                    const selectedList = transferDialog.selectedContratos || (transferDialog.selectedContrato ? [transferDialog.selectedContrato] : []);
                    const selectedSet = new Set(selectedList.map(c => (c || "").trim()));
  
                    const baseServicos = (transferDialog.bulkSource === "servicos_recebidos")
                      ? (selectedServicos.size > 0 ? (servicosData as any[]).filter((s: any) => selectedServicos.has(s.id || String(s.numero_termo || s.contrato))) : (servicosData as any[]))
                      : (servicosData as any[]);
  
                    const servicosDosContratos = baseServicos.filter(
                      (s: any) => selectedSet.has(String(s.contrato || s.numero_termo || "").trim())
                    );
                    const valorTotalContratos = servicosDosContratos.reduce(
                      (acc: number, s: any) => acc + (s.dotacaoOrcamentaria || s.estimativaValor || s.estimativa_valor || 0),
                      0
                    );
                    return (
                      <div className="rounded border bg-blue-50/60 border-blue-200 p-2.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                        <span>
                          Selecionados: <strong>{selectedList.length}</strong> | Serviços dos contratos: <strong>{servicosDosContratos.length}</strong>
                        </span>
                        <span>
                          Custo Financeiro Total: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotalContratos)}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
  
              {/* Modos Bulk ou Individual normais */}
              {transferDialog.modo !== "categoria" && transferDialog.modo !== "contrato" && (
                <>
                  {transferDialog.isBulk ? (
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase">
                        Registros Selecionados
                      </p>
                      <p className="font-medium text-foreground mt-0.5">
                        {transferDialog.bulkCount} {transferDialog.tipo === "aquisicao" ? "item(ns) de aquisição" : "serviço(s)"} selecionado(s)
                      </p>
                    </div>
                  ) : transferDialog.item ? (
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase">
                        {transferDialog.tipo === "aquisicao" ? "Item de Aquisição" : "Serviço"}
                      </p>
                      <p className="font-medium text-foreground mt-0.5">
                        {transferDialog.tipo === "aquisicao"
                          ? `${(transferDialog.item as PlanItem).codigo} - ${(transferDialog.item as PlanItem).descricao}`
                          : `Item ${(transferDialog.item as ServicoItem).item} - ${(transferDialog.item as ServicoItem).objeto}`}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
  
              {/* De: Diretoria de Origem */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                  De: Diretoria de Origem
                </label>
                <Select
                  value={transferDialog.sourceDiretoriaId || diretoria?.id}
                  onValueChange={(val) => {
                    setTransferDialog(prev => ({
                      ...prev,
                      sourceDiretoriaId: val,
                    }));
                  }}
                  disabled={transferDialog.loading}
                >
                  <SelectTrigger className="w-full bg-background font-medium">
                    <SelectValue placeholder="Selecione a diretoria de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {(diretorias as any[]).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        Diretoria {d.sigla} - {d.nome || d.sigla}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
  
              {/* Condições de Transferência (apenas para Categoria ou Contrato) */}
              {(transferDialog.modo === "categoria" || transferDialog.modo === "contrato") && (
                <div className="border-t border-border/50 pt-3">
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Escolha a condição de transferência:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                      onClick={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: true }))}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        transferDialog.incluirCustoFinanceiro !== false
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 ring-1 ring-blue-600"
                          : "border-border hover:border-muted-foreground/40 bg-card text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-xs sm:text-sm">
                        <input
                          type="radio"
                          name="condicaoFinanceira"
                          checked={transferDialog.incluirCustoFinanceiro !== false}
                          onChange={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: true }))}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>1. Com Custo Financeiro</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 leading-relaxed">
                        Transfere {transferDialog.modo === "categoria" ? "os itens" : "os serviços"} e o custo financeiro para a(s) diretoria(s) selecionada(s).
                      </p>
                    </div>
  
                    <div
                      onClick={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: false }))}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        transferDialog.incluirCustoFinanceiro === false
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 ring-1 ring-blue-600"
                          : "border-border hover:border-muted-foreground/40 bg-card text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-xs sm:text-sm">
                        <input
                          type="radio"
                          name="condicaoFinanceira"
                          checked={transferDialog.incluirCustoFinanceiro === false}
                          onChange={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: false }))}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>2. Sem Custo Financeiro</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 leading-relaxed">
                        Disponibiliza {transferDialog.modo === "categoria" ? "a categoria e itens" : "o contrato e serviços"} nas diretorias de destino sem enviar o custo (zerado).
                      </p>
                    </div>
                  </div>
                </div>
              )}
  
              <div className="border-t border-border/50 pt-3 space-y-4">
                {/* Para: Diretoria(s) de Destino */}
                {(transferDialog.modo === "categoria" || transferDialog.modo === "contrato") ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-muted-foreground block">
                        Para: Diretoria(s) de Destino (escolha uma ou mais):
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = (diretorias as any[]).map(d => d.id);
                            const firstDir = allIds[0] || "";
                            const firstDirObj = (diretorias as any[]).find(d => d.id === firstDir);
                            const defaultGerIds = allIds.map(dirId => {
                              const dirObj = (diretorias as any[]).find(d => d.id === dirId);
                              return dirObj?.id;
                            }).filter(Boolean);
                            setTransferDialog(prev => ({
                              ...prev,
                              targetDiretoriaIds: allIds,
                              targetDiretoriaId: firstDir,
                              targetGerenciaId: firstDirObj?.id || prev.targetGerenciaId,
                              targetGerenciaIds: defaultGerIds as string[],
                            }));
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Todas
                        </button>
                        <span className="text-[11px] text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferDialog(prev => ({ ...prev, targetDiretoriaIds: [], targetDiretoriaId: "", targetGerenciaId: "", targetGerenciaIds: [] }));
                          }}
                          className="text-[11px] text-muted-foreground hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-lg border bg-background max-h-36 overflow-y-auto">
                      {(diretorias as any[]).map((d: any) => {
                        const selectedList = transferDialog.targetDiretoriaIds || (transferDialog.targetDiretoriaId ? [transferDialog.targetDiretoriaId] : []);
                        const isSelected = selectedList.includes(d.id);
                        return (
                          <label
                            key={d.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                              isSelected
                                ? "bg-blue-50/80 border-blue-400 text-blue-900 font-semibold"
                                : "border-transparent hover:bg-muted text-muted-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setTransferDialog(prev => {
                                  const current = prev.targetDiretoriaIds || (prev.targetDiretoriaId ? [prev.targetDiretoriaId] : []);
                                  const updated = checked
                                    ? [...new Set([...current, d.id])]
                                    : current.filter(id => id !== d.id);
                                  const firstDir = updated[0] || "";
                                  const targetDir = (diretorias as any[]).find(dir => String(dir.id) === String(firstDir));
                                  const gers = (todasGerenciasData as any[]).filter(g => String(g.diretoria_id) === String(firstDir));
                                  const defaultGer = gers.find((g: any) =>
                                    String(g.sigla).toUpperCase() === String(targetDir?.sigla).toUpperCase() ||
                                    String(g.nome).toLowerCase().includes("diretoria") ||
                                    String(g.nome).toLowerCase().includes("presidência") ||
                                    String(g.sigla).toUpperCase().includes("PRG")
                                  ) || gers[0];
                                  const nextGerId = defaultGer?.id || targetDir?.id || "";

                                  const currentGerList = prev.targetGerenciaIds || (prev.targetGerenciaId ? [prev.targetGerenciaId] : []);
                                  const validGerList = currentGerList.filter(gid => {
                                    const isFromValidDir = (todasGerenciasData as any[]).some(g => String(g.id) === String(gid) && updated.includes(String(g.diretoria_id)));
                                    const isTargetDir = updated.includes(String(gid));
                                    return isFromValidDir || isTargetDir;
                                  });

                                  const finalGerList = validGerList.length > 0 ? validGerList : (nextGerId ? [nextGerId] : []);

                                  return {
                                    ...prev,
                                    targetDiretoriaIds: updated,
                                    targetDiretoriaId: firstDir,
                                    targetGerenciaId: finalGerList[0] || "",
                                    targetGerenciaIds: finalGerList,
                                  };
                                });
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span className="truncate" title={`Diretoria ${d.sigla} - ${d.nome || d.sigla}`}>
                              {d.sigla}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Para: Gerência(s) de Destino (escolha uma ou mais) */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-muted-foreground block">
                          Para: Gerência(s) de Destino (escolha uma ou mais):
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allGerIds = opcoesGerenciasDisponiveis.map(g => g.id);
                              setTransferDialog(prev => ({
                                ...prev,
                                targetGerenciaIds: allGerIds,
                                targetGerenciaId: allGerIds[0] || "",
                              }));
                            }}
                            className="text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            Todas
                          </button>
                          <span className="text-[11px] text-muted-foreground">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTransferDialog(prev => ({
                                ...prev,
                                targetGerenciaIds: [],
                                targetGerenciaId: "",
                              }));
                            }}
                            className="text-[11px] text-muted-foreground hover:underline"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      {opcoesGerenciasDisponiveis.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic p-2.5 border rounded-lg bg-muted/20">
                          Selecione ao menos uma diretoria de destino acima para visualizar as gerências.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-lg border bg-background max-h-40 overflow-y-auto">
                          {opcoesGerenciasDisponiveis.map((g) => {
                            const selectedList = transferDialog.targetGerenciaIds || (transferDialog.targetGerenciaId ? [transferDialog.targetGerenciaId] : []);
                            const isSelected = selectedList.includes(g.id);
                            return (
                              <label
                                key={g.id}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs border transition-colors ${
                                  isSelected
                                    ? "bg-blue-50/80 border-blue-400 text-blue-900 font-semibold"
                                    : "border-transparent hover:bg-muted text-muted-foreground"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setTransferDialog(prev => {
                                      const current = prev.targetGerenciaIds || (prev.targetGerenciaId ? [prev.targetGerenciaId] : []);
                                      const updated = checked
                                        ? [...new Set([...current, g.id])]
                                        : current.filter(id => id !== g.id);
                                      return {
                                        ...prev,
                                        targetGerenciaIds: updated,
                                        targetGerenciaId: updated[0] || "",
                                      };
                                    });
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 flex-shrink-0"
                                />
                                <span className="truncate" title={g.label}>
                                  {g.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Para: Diretoria de Destino (Modo Individual / Bulk) */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Para: Diretoria de Destino
                      </label>
                      <Select
                        value={transferDialog.targetDiretoriaId || diretoria?.id}
                        onValueChange={(val) => {
                          const gersDaDir = (todasGerenciasData as any[]).filter(g => g.diretoria_id === val);
                          const firstGerId = gersDaDir[0]?.id || "";
                          setTransferDialog(prev => ({
                            ...prev,
                            targetDiretoriaId: val,
                            targetGerenciaId: firstGerId,
                          }));
                        }}
                        disabled={transferDialog.loading}
                      >
                        <SelectTrigger className="w-full bg-background font-medium">
                          <SelectValue placeholder="Selecione a diretoria de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {(diretorias as any[]).map((d: any) => (
                            <SelectItem key={d.id} value={d.id}>
                              Diretoria {d.sigla} - {d.nome || d.sigla}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
  
                    {/* Para: Gerência de Destino (Modo Individual / Bulk) */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Para: Gerência de Destino
                      </label>
                      <Select
                        value={transferDialog.targetGerenciaId}
                        onValueChange={(val) => setTransferDialog(prev => ({ ...prev, targetGerenciaId: val }))}
                        disabled={transferDialog.loading}
                      >
                        <SelectTrigger className="w-full bg-background font-medium">
                          <SelectValue placeholder="Selecione a gerência de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const curTargetDirId = transferDialog.targetDiretoriaId || diretoria?.id;
                            const curTargetDirObj = (diretorias as any[]).find(d => String(d.id) === String(curTargetDirId));
                            return (
                              <>
                                {curTargetDirObj && (
                                  <SelectItem value={curTargetDirObj.id}>
                                    {curTargetDirObj.sigla} - Diretoria ({curTargetDirObj.nome || curTargetDirObj.sigla})
                                  </SelectItem>
                                )}
                                {gerenciasDisponiveisParaDestino
                                  .filter((g: any) => String(g.id) !== String(curTargetDirObj?.id))
                                  .map((g: any) => (
                                    <SelectItem key={g.id} value={g.id}>
                                      {g.sigla} - {g.nome}
                                    </SelectItem>
                                  ))}
                              </>
                            );
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>
  
            <DialogFooter className="flex justify-end gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setTransferDialog(prev => ({ ...prev, open: false }))}
                disabled={transferDialog.loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmTransfer}
                disabled={
                  transferDialog.loading ||
                  (transferDialog.modo === "categoria" &&
                    (((transferDialog.selectedCategorias?.length || (transferDialog.selectedCategoria ? 1 : 0)) === 0) ||
                      ((transferDialog.targetDiretoriaIds?.length || 0) === 0 && !transferDialog.targetDiretoriaId))) ||
                  (transferDialog.modo === "contrato" &&
                    (((transferDialog.selectedContratos?.length || (transferDialog.selectedContrato ? 1 : 0)) === 0) ||
                      ((transferDialog.targetDiretoriaIds?.length || 0) === 0 && !transferDialog.targetDiretoriaId))) ||
                  (transferDialog.modo !== "categoria" && transferDialog.modo !== "contrato" && !transferDialog.targetGerenciaId)
                }
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {transferDialog.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Confirmar transferência
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );

  const renderDesfazerTransferDialog = () => (
    <DesfazerTransferenciaDialog
      open={desfazerTransferDialog.open}
      onOpenChange={(open) => setDesfazerTransferDialog(prev => ({ ...prev, open }))}
      tipo={desfazerTransferDialog.tipo}
      diretoriaId={diretoria?.id}
      diretoriaSigla={siglaUpper}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
        queryClient.invalidateQueries({ queryKey: ["servicos"] });
        queryClient.invalidateQueries({ queryKey: solicitacoesQueryKey });
        queryClient.invalidateQueries({ queryKey: servicosQueryKey });
      }}
    />
  );

  if (isDiretoriasLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Carregando diretoria...</h1>
        </div>
      </div>
    );
  }

  if (!diretoria) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            {isDiretoriasError ? "Erro ao carregar diretorias" : "Diretoria não encontrada"}
          </h1>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  if (isPeriodExpired) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 relative flex items-center justify-center p-4 z-50">
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
        targetSigla={diretoria.sigla}
        targetDiretoriaId={diretoria.id}
      />
    );
  }

  // Tela de seleção: Aquisição ou Serviços
  if (!selectedOption) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 relative">
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
            onBack={() => navigate("/")}
            onHome={() => navigate("/")}
            crumbs={[
              { label: diretoria.sigla },
            ]}
          />

          {/* Header */}
          <div className="bg-linear-to-r from-blue-700 to-blue-900 px-6 py-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {getIconPath(diretoria.sigla) && (
                  <img src={getIconPath(diretoria.sigla)!} alt={diretoria.sigla} className="h-12 w-12 object-contain" />
                )}
                <Badge className="bg-white/20 text-white border-none text-xl font-bold">{diretoria.sigla}</Badge>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{diretoria.nome}</h1>
              <p className="text-white/80 text-lg">Selecione o tipo de solicitação</p>
              {orcamentoGeralDiretoria > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-medium">
                  <span>Orçamento Geral da Diretoria:</span>
                  <span className="font-bold text-amber-300">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orcamentoGeralDiretoria)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Opções: Aquisição e Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-lg font-semibold text-foreground mb-4">Selecione o painel para gestão da diretoria</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                {/* Cartão Visão Gerencial */}
                <button
                  onClick={() => {
                    setSelectedOption("visao_gerencial");
                  }}
                  className="group bg-card rounded-xl border-2 border-border hover:border-purple-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <span className="text-4xl">📊</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Visão Gerencial</h2>
                  <p className="text-muted-foreground">
                    Visão geral estratégica com gráficos e matriz de solicitações de aquisição e serviços por gerência
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de Visão Gerencial da Diretoria
  if (selectedOption === "visao_gerencial" && diretoria) {
    return (
      <DiretoriaVisaoGerencial
        diretoria={diretoria}
        gerenciasData={gerenciasData}
        solicitacoes={solicitacoes}
        itensProprios={itensProprios}
        servicosData={servicosData}
        servicosCatalogoSet={servicosCatalogoSet}
        orcamentoConfig={orcamentoConfig}
        onBack={() => setSelectedOption(null)}
      />
    );
  }

  // Tela de seleção: Serviços Existentes ou Novos Serviços (Diretoria)
  if (selectedOption === "servicos") {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 relative">
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
              { label: diretoria?.sigla || "", onClick: () => setSelectedOption(null) },
              { label: "Serviços", isActive: true },
            ]}
          />

          {/* Header */}
          <div className="bg-linear-to-r from-blue-700 to-blue-900 px-6 py-8">
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
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-80"
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
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-80"
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

    const renderServicosTable = (titulo: string, listaBase: ServicoItem[], fullLista?: ServicoItem[]) => {
      const targetLista = fullLista || listaBase;
      return (
        <SortableWrapper
          items={listaBase}
          render={(lista, sortConfig, requestSort) => {
            const ids = targetLista.map((s) => s.id || String(s.item));
            const allSelected = ids.length > 0 && ids.every((id) => selectedServicos.has(id));

      return (
        <div className="bg-white rounded-lg border overflow-hidden mb-4">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">{titulo} ({targetLista.length})</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAllServicosLista(targetLista)}
                    className="rounded"
                  />
                </th>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900 w-16" field="item" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Nº
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900 w-24" field="contrato" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Contrato
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900 w-32" field="contratada" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Contratada
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900" field="objeto" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Objeto / Justificativa
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900" field="gerencia" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Gerência
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:text-gray-900" field="estimativaValor" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Estimativa Valor
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900" field="grauPrioridade" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Prioridade
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900" field="status" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Status
                </SortableTableHead>
                <SortableTableHead className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:text-gray-900" field="vinculacao" sortConfig={sortConfig} onRequestSort={requestSort}>
                  Vinculação
                </SortableTableHead>
                <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((servico) => (
                <tr key={servico.id || `servico-${servico.item}-${servico.gerencia || "dg"}`} className="border-b hover:bg-gray-50">
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
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{servico.item}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{servico.contrato || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{servico.contratada || "-"}</td>
                  <td className="px-4 py-3 text-sm max-w-xs" title={servico.objeto}>
                    <p className="font-medium line-clamp-2">{servico.objeto}</p>
                    {servico.observacao && /\[Transferido [^\]]+\]/.test(servico.observacao) && (
                      <div className="mt-1">
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 gap-1 text-[11px] font-semibold py-0">
                          🔄 {servico.observacao.match(/\[Transferido ([^\]]+)\]/)?.[1] || "Transferido"}
                        </Badge>
                      </div>
                    )}
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
                  <td className="px-4 py-3 text-sm font-medium">
                    {(() => {
                      const dgGer = todasGerenciasDaDiretoria.find((g: any) => g.sigla === siglaUpper);
                      const isDirFilter = ownServicosGerenciaId === "diretoria" || ownServicosGerenciaId === diretoria?.id || (dgGer && ownServicosGerenciaId === dgGer.id);
                      if (isDirFilter || servico.gerencia === siglaUpper || servico.unidadeDemandante === siglaUpper) {
                        return siglaUpper;
                      }
                      return (gerenciaMap[servico.gerencia] && gerenciaMap[servico.gerencia] !== "N/A" ? gerenciaMap[servico.gerencia] : undefined) ||
                        (servico.gerencia && servico.gerencia !== "N/A" ? servico.gerencia : undefined) ||
                        diretoriaMap[(servico as any).diretoria_id]?.sigla ||
                        siglaUpper;
                    })()}
                  </td>
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
                        <SelectTrigger className="w-37.5 h-8">
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
                      {/* Botão Editar (lápis): visível em todos os itens não somente-leitura */}
                      {!isServicoReadOnly(servico) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Editar"
                          onClick={() => openServicoEditor(servico)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Botão Devolver para Rascunho (seta curvada): visível no filtro de aprovados ou para serviços aprovados */}
                      {(ownServicosShowOnlyAprovados || servico.status === "aprovado") &&
                        !ownServicosShowOnlyZerados &&
                        !ownServicosShowOnlyComValor &&
                        servico.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            title="Devolver para Rascunho"
                            onClick={() => handleDevolverServicoDiretoria(servico.id!)}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                      )}

                      {/* Botão Transferir para Gerência */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Transferir para Gerência"
                        onClick={() => handleOpenTransferDialog(servico, selectedOption === "servicos_novos" ? "servicos_novos" : "servicos_existentes")}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </Button>

                      {/* Botão Excluir (lixeira): visível apenas para novos serviços criados pela diretoria */}
                      {selectedOption === "servicos_novos" && servico.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Excluir"
                          onClick={() => handleDeleteServicoDiretoria(servico.id!)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
      }} />
      );
    };

    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 relative">
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
            onBack={() => setSelectedOption("servicos")}
            onHome={() => navigate("/")}
            crumbs={[
              { label: siglaUpper, onClick: () => setSelectedOption(null) },
              { label: "Serviços", onClick: () => setSelectedOption("servicos") },
              { label: selectedOption === "servicos_novos" ? "Novos Serviços" : "Serviços Existentes", isActive: true },
            ]}
            rightContent={
              <div className="flex items-center gap-2">
                {(isAnyServicosActionBlocked || isPeriodExpired) && (
                  <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-xs gap-1 py-1 px-3">
                    <Lock className="h-3 w-3" /> Somente leitura
                  </Badge>
                )}
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
                <Button
                  variant={(selectedOption as string) === "visao_gerencial" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedOption("visao_gerencial");
                  }}
                >
                  Visão Gerencial
                </Button>
              </div>
            }
          />

          <div className="bg-linear-to-r from-blue-600 to-blue-800 px-6 py-6">
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
            {/* Banner de restrição de serviços da diretoria */}
            {isAnyServicosActionBlocked && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-900 text-sm shadow-sm">
                <div className="p-2 bg-red-100 rounded-lg shrink-0">
                  <Lock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-red-800">Ações de Serviços da Diretoria Bloqueadas</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {getBlockReason("aprovacao", "aprovar") ||
                      getBlockReason("aprovacao", "reprovar") ||
                      getBlockReason("aprovacao", "enviar_compras") ||
                      getBlockReason("servicos_novos", "adicionar_novo_servico") ||
                      getBlockReason("aprovacao", "editar_item") ||
                      "Ações de aprovação e gerenciamento de serviços estão temporariamente bloqueadas para esta diretoria no período atual."}
                  </p>
                </div>
              </div>
            )}

            <BudgetConsumptionCard
              titulo={`Orçamento da Diretoria ${siglaUpper} (${selectedOption === "servicos_existentes" ? "serviços existentes" : "novos serviços"})`}
              orcamento={selectedOption === "servicos_existentes" ? orcamentoDiretoriaServicosExistentes : orcamentoDiretoriaServicosNovos}
              gasto={gastoServicosDiretoria}
              orcamentoGeral={orcamentoGeralDiretoria}
              isDiretoria={true}
              gastoAquisicao={gastoAquisicaoDiretoria}
              gastoServicosExistentes={gastoServicosExistentesDiretoria}
              gastoServicosNovos={gastoServicosNovosDiretoria}
            />

            {/* Seus Serviços - adicionados diretamente pela diretoria */}
            <div className="px-6 py-4 mt-6 bg-card rounded-lg border">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Seus Serviços</h3>
                  <p className="text-xs text-muted-foreground">Serviços adicionados pela diretoria</p>
                </div>
              </div>
              
              {/* Linha 1: Filtro de Gerência e Ações */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Gerência responsável:</span>
                  <Select value={ownServicosGerenciaId} onValueChange={(v) => { setOwnServicosGerenciaId(v); setOwnServicosCurrentPage(1); }}>
                    <SelectTrigger className="w-60 bg-card text-sm h-9">
                      <SelectValue placeholder="Selecione a gerência" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Gerências</SelectItem>
                      {!todasGerenciasDaDiretoria.some((g: any) => g.sigla === siglaUpper) && (
                        <SelectItem value="diretoria">Diretoria ({siglaUpper})</SelectItem>
                      )}
                      {todasGerenciasDaDiretoria.map((g: any) => (
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
                      if (!ownServicosShowOnlyZerados) {
                        setOwnServicosShowOnlyComValor(false);
                        setOwnServicosShowOnlyAprovados(false);
                      }
                    }}
                  >
                    {ownServicosShowOnlyZerados ? "Mostrando apenas zerados" : "Filtrar zerados"}
                  </Button>
                  <Button
                    variant={ownServicosShowOnlyComValor ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setOwnServicosShowOnlyComValor(!ownServicosShowOnlyComValor);
                      if (!ownServicosShowOnlyComValor) {
                        setOwnServicosShowOnlyZerados(false);
                        setOwnServicosShowOnlyAprovados(false);
                      }
                    }}
                  >
                    {ownServicosShowOnlyComValor ? "Mostrando apenas com valor" : "Filtrar com valor"}
                  </Button>
                  <Button
                    variant={ownServicosShowOnlyAprovados ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setOwnServicosShowOnlyAprovados(!ownServicosShowOnlyAprovados)}
                  >
                    {ownServicosShowOnlyAprovados ? "Mostrando apenas aprovados" : "Filtrar aprovados"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => handleOpenContratoTransferDialog()}
                    title="Transferir todos os serviços e custo financeiro de um Contrato para outra Diretoria"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transferir Contrato
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    onClick={() => setDesfazerTransferDialog({ open: true, tipo: "servicos" })}
                    title="Desfazer envio/transferência de contratos ou serviços"
                  >
                    <Undo2 className="h-4 w-4" />
                    Desfazer Transferência
                  </Button>
                  {selectedServicos.size > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => handleOpenBulkTransferDialog("servicos_proprios")}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Transferir para Gerência ({selectedServicos.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-muted-foreground"
                        disabled={isDevolverServicosBlocked || isPeriodExpired}
                        onClick={() => setActionServicosDialog({ open: true, action: "devolver" })}
                      >
                        <Undo2 className="h-4 w-4" />
                        Devolver para Rascunho ({selectedServicos.size})
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        disabled={isRejeitarServicosBlocked || isPeriodExpired}
                        onClick={() => setActionServicosDialog({ open: true, action: "rejeitar" })}
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar ({selectedServicos.size})
                      </Button>
                      {selectedOption !== "servicos_novos" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={isEditarServicosBlocked || isPeriodExpired}
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
                        disabled={isAprovarServicosBlocked || isPeriodExpired}
                        onClick={() => setActionServicosDialog({ open: true, action: "aprovar" })}
                      >
                        <Send className="h-4 w-4" />
                        Aprovar ({selectedServicos.size})
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Linha 2: Barra de Pesquisa destacada e responsiva */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
                <div className="relative flex-1 max-w-lg w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por contrato, contratada, objeto, justificativa ou valor..."
                    value={ownServicosSearchTerm}
                    onChange={(e) => {
                      setOwnServicosSearchTerm(e.target.value);
                      setOwnServicosCurrentPage(1);
                    }}
                    className="pl-9 pr-8 h-10 w-full bg-card"
                  />
                  {ownServicosSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setOwnServicosSearchTerm("");
                        setOwnServicosCurrentPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {servicosProprios.length === 0 ? (
                <div className="text-center py-8 bg-background rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">Nenhum serviço {ownServicosShowOnlyAprovados ? "aprovado" : "encontrado"} adicionado pela diretoria.</p>
                </div>
              ) : (
                <>
                  {renderServicosTable(selectedOption === "servicos_existentes" ? "Serviços Existentes" : "Novos Serviços", ownServicosPaginationData.paginatedItems, servicosProprios)}
                  {ownServicosPaginationData.totalPages > 1 && (
                    <SmartPagination
                      currentPage={ownServicosCurrentPage}
                      totalPages={ownServicosPaginationData.totalPages}
                      onPageChange={setOwnServicosCurrentPage}
                      totalItems={ownServicosPaginationData.totalItems}
                    />
                  )}
                </>
              )}

              {/* Botão Adicionar Novo Serviço da Diretoria */}
              {selectedOption === "servicos_novos" && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    className="gap-2 border-dashed border-green-400 text-green-700 hover:bg-green-50"
                    disabled={isAddNovoServicoBlocked || isPeriodExpired}
                    title={isAddNovoServicoBlocked ? "Criação de novos serviços bloqueada pelo administrador" : undefined}
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
                <div className="relative flex-1 min-w-60 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por item, objeto, justificativa ou gerência..."
                    value={servicosRecebidosSearchTerm}
                    onChange={(e) => setServicosRecebidosSearchTerm(e.target.value)}
                    className="pl-9 pr-8 bg-card text-sm"
                  />
                  {servicosRecebidosSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setServicosRecebidosSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Gerência:</span>
                  <Select value={selectedGerencia} onValueChange={setSelectedGerencia}>
                    <SelectTrigger className="w-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas ({servicosRecebidosPorTipo.length})</SelectItem>
                      {!todasGerenciasDaDiretoria.some((g: any) => g.sigla === siglaUpper) && (
                        <SelectItem value={siglaUpper}>
                          {siglaUpper} ({servicosRecebidosPorTipo.filter((s: ServicoItem) => s.gerencia === siglaUpper || s.unidadeDemandante === siglaUpper || s.diretoriaSigla === siglaUpper).length})
                        </SelectItem>
                      )}
                      {todasGerenciasDaDiretoria.map((g: any) => {
                        const count = servicosRecebidosPorTipo.filter((s: ServicoItem) => 
                          s.gerencia === g.sigla || 
                          s.unidadeDemandante === g.sigla || 
                          ((s as any).gerencia_id && gerenciaMap[(s as any).gerencia_id] === g.sigla)
                        ).length;
                        return (
                          <SelectItem key={g.id} value={g.sigla}>
                            {g.sigla} - {g.nome} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {countTransferidosServicos > 0 && (
                  <Button
                    variant={showOnlyTransferidosServicos ? "default" : "outline"}
                    size="sm"
                    className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                    onClick={() => setShowOnlyTransferidosServicos(!showOnlyTransferidosServicos)}
                    title="Filtrar apenas serviços transferidos"
                  >
                    🔄 {showOnlyTransferidosServicos ? "Mostrando apenas transferidos" : `Transferidos (${countTransferidosServicos})`}
                  </Button>
                )}
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
                  "Serviços com status Enviado ou Em análise: use os checkboxes ou Aprovar todos / Rejeitar. Itens já rejeitados ou em compras aparecem nas outras abas."}
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
                <div className="px-6 py-4 border-b">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={(() => {
                          const selectable = servicosFiltradasPorStatus.filter(s => Boolean(s.id) && !isServicoReadOnly(s));
                          return selectable.length > 0 && selectable.every(s => Boolean(s.id && selectedServicos.has(s.id!)));
                        })()}
                        onCheckedChange={toggleSelectAllServicos}
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
                          disabled={isAprovarServicosBlocked || isPeriodExpired}
                          onClick={() => setActionServicosDialog({ open: true, action: "aprovar" })}
                        >
                          {isAprovarServicosBlocked ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          Aprovar Selecionados ({selectedServicos.size})
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2"
                        onClick={() => setActionServicosDialog({ open: true, action: "enviar_compras" })}
                        disabled={selectedServicos.size === 0 || servicosStatusTab !== "aprovados" || isEnviarComprasBlocked || isPeriodExpired}
                      >
                        {isEnviarComprasBlocked ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
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
                          disabled={!servicosFiltradasPorStatus.some(isPendenteServicoAprovacao) || isAprovarServicosBlocked || isPeriodExpired}
                        >
                          {isAprovarServicosBlocked ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          Aprovar todos
                        </Button>
                      )}

                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="gap-2"
                        onClick={() => setActionServicosDialog({ open: true, action: "rejeitar" })}
                        disabled={selectedServicos.size === 0 || servicosStatusTab === "rejeitados" || isRejeitarServicosBlocked || isPeriodExpired}
                      >
                        {isRejeitarServicosBlocked ? <Lock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        Rejeitar ({selectedServicos.size})
                      </Button>

                      {(servicosStatusTab === "pendentes" || servicosStatusTab === "rejeitados" || servicosStatusTab === "aprovados") && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2 text-primary border-primary hover:bg-primary/10"
                            onClick={() => setBulkEditServicosOpen(true)}
                            disabled={selectedServicos.size === 0 || isEditarServicosBlocked || isPeriodExpired}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar Selecionados ({selectedServicos.size})
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => handleOpenBulkTransferDialog("servicos_recebidos")}
                            disabled={selectedServicos.size === 0 || isPeriodExpired}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                            Transferir para Gerência ({selectedServicos.size})
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                            onClick={() => setActionServicosDialog({ open: true, action: "devolver" })}
                            disabled={selectedServicos.size === 0 || isDevolverServicosBlocked || isPeriodExpired}
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
                            disabled={selectedServicos.size === 0 || isAprovarServicosBlocked || isPeriodExpired}
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
                        className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
                        onClick={exportServicosToExcel}
                        disabled={servicosFiltradasPorStatus.length === 0}
                      >
                        <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                        <span>Excel</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
                        onClick={exportServicosToPDF}
                        disabled={servicosFiltradasPorStatus.length === 0}
                      >
                        <FileDown className="h-4 w-4 text-slate-700" />
                        <span>PDF</span>
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
                    return renderServicosTable(titulo, servicosPaginados, servicosFiltradasPorStatus);
                  })()}

                  {/* Paginação Serviços */}
                  {totalPagesServicos > 1 && (
                    <SmartPagination
                      currentPage={servicosCurrentPage}
                      totalPages={totalPagesServicos}
                      onPageChange={setServicosCurrentPage}
                      totalItems={servicosFiltradasPorStatus.length}
                    />
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
                        value={novoServicoForm.contratada}
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
                    <div>
                      <label className="text-sm font-medium">Gerência responsável</label>
                      <select
                        value={novoServicoForm.gerenciaId}
                        onChange={(e) => setNovoServicoForm(f => ({ ...f, gerenciaId: e.target.value }))}
                        className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                      >
                        <option value="">Geral / Diretoria</option>
                        {todasGerenciasDaDiretoria.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.sigla} - {g.nome}</option>
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


          <ServicoEditDialog
            open={servicoEditOpen}
            onOpenChange={setServicoEditOpen}
            servico={servicoEdicao}
            onSave={async (item, updates) => {
              try {
                if (servicoEdicao?.id) {
                  await updateServico(servicoEdicao.id, updates);
                } else {
                  await ensureServicoDiretoria(item as number, updates);
                }
                setServicoEditOpen(false);
                setServicoEdicao(null);
                queryClient.invalidateQueries({ queryKey: ["servicos"] });
                queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", diretoria?.id, periodAtivo?.id] });
                toast({ title: "Serviço atualizado", description: "Informações do serviço salvas." });
              } catch (error) {
                console.error("Erro ao atualizar serviço:", error);
                toast({ title: "Erro ao atualizar", description: "Falha ao salvar serviço.", variant: "destructive" });
              }
            }}
            diretoriaLabel={diretoria?.sigla ? `${diretoria.sigla} - ${diretoria.nome}` : undefined}
            canEditStatus={true}
          />

          <BulkEditServicosDialog
            open={bulkEditServicosOpen}
            onOpenChange={setBulkEditServicosOpen}
            selectedCount={selectedServicos.size}
            onConfirm={handleBulkEditServicos}
            isUpdating={isBulkUpdating}
          />

          {renderTransferDialog()}
          {renderDesfazerTransferDialog()}
          
          </div>
        </div>
      );
    }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-blue-100 relative">
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
          { label: diretoria?.sigla || "", onClick: () => setSelectedOption(null) },
          { label: "Aquisição", isActive: true },
        ]}
        rightContent={
          <div className="flex items-center gap-2">
            {(isAnyAquisicaoActionBlocked || isPeriodExpired) && (
              <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-xs gap-1 py-1 px-3">
                <Lock className="h-3 w-3" /> Somente leitura
              </Badge>
            )}
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
            <Button
              variant={(selectedOption as string) === "visao_gerencial" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedOption("visao_gerencial");
              }}
            >
              Visão Gerencial
            </Button>
          </div>
        }
      />
      {/* Header */}
      <div className="bg-linear-to-r from-blue-700 to-blue-900 px-6 py-6">
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

      {/* Banner de restrição de aquisição da diretoria */}
      {isAnyAquisicaoActionBlocked && (
        <div className="mx-6 my-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-900 text-sm shadow-sm">
          <div className="p-2 bg-red-100 rounded-lg shrink-0">
            <Lock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-red-800">Ações da Diretoria Bloqueadas</p>
            <p className="text-xs text-red-700 mt-0.5">
              {getBlockReason("aprovacao", "aprovar") ||
                getBlockReason("aprovacao", "reprovar") ||
                getBlockReason("aprovacao", "enviar_compras") ||
                getBlockReason("aprovacao", "adicionar_item") ||
                getBlockReason("aprovacao", "editar_item") ||
                "Ações administrativas e de aprovação estão temporariamente bloqueadas para esta diretoria no período atual."}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards totalItens={summary.totalItens} valorTotal={summary.valorTotal} />

      <BudgetConsumptionCard
        titulo={`Orçamento da Diretoria ${siglaUpper} (aquisição)`}
        orcamento={orcamentoDiretoriaAquisicao}
        gasto={gastoAquisicaoDiretoria}
        orcamentoGeral={orcamentoGeralDiretoria}
        isDiretoria={true}
        gastoAquisicao={gastoAquisicaoDiretoria}
        gastoServicosExistentes={gastoServicosExistentesDiretoria}
        gastoServicosNovos={gastoServicosNovosDiretoria}
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
                <SelectTrigger className="w-60 bg-card">
                  <SelectValue placeholder="Selecione a gerência" />
                </SelectTrigger>
                <SelectContent>
                  {!todasGerenciasDaDiretoria.some((g: any) => g.sigla === siglaUpper) && (
                    <SelectItem value="diretoria">Diretoria ({siglaUpper})</SelectItem>
                  )}
                  {todasGerenciasDaDiretoria.map((g: any) => (
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
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => handleOpenCategoriaTransferDialog()}
                title="Transferir todos os dados e itens de uma Categoria para outra Diretoria"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferir Categoria
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => setDesfazerTransferDialog({ open: true, tipo: "aquisicao" })}
                title="Desfazer envio/transferência de itens ou categorias"
              >
                <Undo2 className="h-4 w-4" />
                Desfazer Transferência
              </Button>
              {selectedOwnItems.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => handleOpenBulkTransferDialog("aquisicao_proprios")}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Transferir para Gerência ({selectedOwnItems.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    disabled={isDevolverAquisicaoBlocked || isPeriodExpired}
                    onClick={() => setActionOwnDialog({ open: true, action: "devolver" })}
                  >
                    <Undo2 className="h-4 w-4" />
                    Devolver para Rascunho ({selectedOwnItems.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    disabled={isRejeitarAquisicaoBlocked || isPeriodExpired}
                    onClick={() => setActionOwnDialog({ open: true, action: "rejeitar" })}
                  >
                    <XCircle className="h-4 w-4" />
                    Rejeitar ({selectedOwnItems.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={isEditarAquisicaoBlocked || isPeriodExpired}
                    onClick={() => {
                      setEditingBulkOwn(true);
                      setBulkEditAquisicaoOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar ({selectedOwnItems.size})
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="gap-2 bg-success hover:bg-success/90 text-white"
                    disabled={isAprovarAquisicaoBlocked || isPeriodExpired}
                    onClick={() => setActionOwnDialog({ open: true, action: "aprovar" })}
                  >
                    <Send className="h-4 w-4" />
                    Aprovar ({selectedOwnItems.size})
                  </Button>
                </>
              )}
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

        {ownSearchTerm.trim() === "" && !ownShowOnlyComQuantidade && !ownShowOnlyZerados && !ownShowOnlyAprovados ? (
          <div className="text-center py-8 bg-card rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">🔍 Digite o código ou descrição para buscar itens do catálogo.</p>
          </div>
        ) : filteredOwnItems.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">Nenhum item encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <>
            <PlanTable
              items={ownPaginationData.paginatedItems}
              totalItems={filteredOwnItems.length}
              readOnly={isEditarAquisicaoBlocked || isAddPlanoProprioBlocked || isPeriodExpired}
              onUpdateQtdEstimada={handleUpdateQtdEstimadaDiretoria}
              onUpdateUnidade={handleUpdateUnidadeDiretoria}
              onUpdateObservacao={handleUpdateObservacaoDiretoria}
              onUpdatePrioridade={handleUpdatePrioridadeDiretoria}
              onDeleteItem={handleOwnDevolverIndividual}
              onTransferItem={(item) => handleOpenTransferDialog(item, "aquisicao")}
              onEditItem={openSolicitacaoEditor}
              valorTotal={filteredOwnItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0)}
              selectedItems={selectedOwnItems}
              onToggleSelect={(id) => {
                const newSet = new Set(selectedOwnItems);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                setSelectedOwnItems(newSet);
              }}
              onToggleSelectAll={() => {
                const validIds = filteredOwnItems.map(i => i.id || i.codigo).filter(Boolean);
                const allSelected = validIds.length > 0 && validIds.every(id => selectedOwnItems.has(id));
                const newSet = new Set(selectedOwnItems);
                if (allSelected) {
                  validIds.forEach(id => newSet.delete(id));
                } else {
                  validIds.forEach(id => newSet.add(id));
                }
                setSelectedOwnItems(newSet);
              }}
            />

            {ownPaginationData.totalPages > 1 && (
              <SmartPagination
                currentPage={ownCurrentPage}
                totalPages={ownPaginationData.totalPages}
                onPageChange={setOwnCurrentPage}
                totalItems={filteredOwnItems.length}
              />
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
                  {grupo.total === 0 && grupo.itensZerados > 0 && (
                    <div className="mt-1.5">
                      <span className="inline-flex items-center text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 font-medium">
                        ⚠️ {grupo.itensZerados} item(ns) com quantidade zerada
                      </span>
                    </div>
                  )}
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
          <div className="relative flex-1 min-w-60 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por código, descrição ou gerência..."
              value={recebidosSearchTerm}
              onChange={(e) => setRecebidosSearchTerm(e.target.value)}
              className="pl-9 pr-8 bg-card text-sm"
            />
            {recebidosSearchTerm && (
              <button
                type="button"
                onClick={() => setRecebidosSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Gerência:</span>
            <Select 
              value={selectedGerencia} 
              onValueChange={(val) => {
                setSelectedGerencia(val);
                setSelectedCategoria("todas");
              }}
            >
              <SelectTrigger className="w-50">
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
            <Select 
              value={selectedCategoria || "todas"} 
              onValueChange={setSelectedCategoria}
            >
              <SelectTrigger className="w-50">
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas ({categoriasRecebidosDisponiveis.total})</SelectItem>
                {categoriasRecebidosDisponiveis.lista.map((c) => (
                  <SelectItem key={c.nome} value={c.nome}>
                    {c.nome} ({c.count})
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
            {countTransferidos > 0 && (
              <Button
                variant={showOnlyTransferidos ? "default" : "outline"}
                size="sm"
                className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => setShowOnlyTransferidos(!showOnlyTransferidos)}
                title="Filtrar apenas itens transferidos"
              >
                🔄 {showOnlyTransferidos ? "Mostrando apenas transferidos" : `Transferidos (${countTransferidos})`}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              onClick={() => handleOpenCategoriaTransferDialogRecebidos()}
              title="Transferir itens e custo financeiro de categoria(s) recebidas para outra Diretoria"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transferir Categoria
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              onClick={() => setDesfazerTransferDialog({ open: true, tipo: "aquisicao" })}
              title="Desfazer envio/transferência de itens ou categorias"
            >
              <Undo2 className="h-4 w-4" />
              Desfazer Transferência
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
                  checked={selectableItems.length > 0 && selectableItems.every(item => item.id && selectedItems.has(item.id))}
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
                    disabled={isAprovarAquisicaoBlocked || isPeriodExpired}
                    onClick={() => setActionDialog({ open: true, action: "aprovar", isBulk: false })}
                  >
                    {isAprovarAquisicaoBlocked ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    Aprovar Selecionados ({selectedItems.size})
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setConfirmComprasOpen(true)}
                  disabled={selectedApprovedItems.length === 0 || recebidosStatusTab !== "aprovados" || isEnviarComprasBlocked || isPeriodExpired}
                >
                  {isEnviarComprasBlocked ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  Enviar para Compras ({selectedApprovedItems.length})
                </Button>

                {recebidosStatusTab === "pendentes" && selectedItems.size === 0 && (
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="gap-2"
                    onClick={() => setActionDialog({ open: true, action: "aprovar", isBulk: true })}
                    disabled={!filteredItems.some(isPendenteDiretoriaAprovacao) || isAprovarAquisicaoBlocked || isPeriodExpired}
                    title={isAprovarAquisicaoBlocked ? "Aprovação bloqueada pelo administrador" : undefined}
                  >
                    {isAprovarAquisicaoBlocked ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    Aprovar todos
                  </Button>
                )}

                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => setActionDialog({ open: true, action: "rejeitar", isBulk: false })}
                  disabled={selectedItems.size === 0 || recebidosStatusTab === "rejeitados" || isRejeitarAquisicaoBlocked || isPeriodExpired}
                >
                  {isRejeitarAquisicaoBlocked ? <Lock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  Rejeitar ({selectedItems.size})
                </Button>

                {(recebidosStatusTab === "pendentes" || recebidosStatusTab === "rejeitados" || recebidosStatusTab === "aprovados") && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-2 text-primary border-primary hover:bg-primary/10"
                      onClick={() => {
                        setEditingBulkOwn(false);
                        setBulkEditAquisicaoOpen(true);
                      }}
                      disabled={selectedItems.size === 0 || isEditarAquisicaoBlocked || isPeriodExpired}
                      title="Editar quantidades e campos dos itens selecionados em lote"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar Selecionados ({selectedItems.size})
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => handleOpenBulkTransferDialog("aquisicao_recebidos")}
                      disabled={selectedItems.size === 0 || isPeriodExpired}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Transferir para Gerência ({selectedItems.size})
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => setActionDialog({ open: true, action: "devolver", isBulk: false })}
                      disabled={selectedItems.size === 0 || isDevolverAquisicaoBlocked || isPeriodExpired}
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
                      disabled={selectedItems.size === 0 || isAprovarAquisicaoBlocked || isPeriodExpired}
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
                  className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
                  onClick={exportToExcel}
                  disabled={recebidosTableItems.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                  <span>Excel</span>
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
                  onClick={exportToPDF}
                  disabled={recebidosTableItems.length === 0}
                >
                  <FileDown className="h-4 w-4 text-slate-700" />
                  <span>PDF</span>
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
                <SortableWrapper items={paginatedItems} render={(sortedPaginatedItems, sortConfig, requestSort) => (
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 text-left w-12">
                        <Checkbox 
                          checked={selectableItems.length > 0 && selectableItems.every(item => item.id && selectedItems.has(item.id))}
                          onCheckedChange={toggleSelectAll}
                          disabled={selectableItems.length === 0}
                        />
                      </th>
                      <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="codigo" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Cód.
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="descricao" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Descrição
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="gerencia" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Gerência
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="status" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Status
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="prioridade" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Prioridade
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-center text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="qtdEstimada" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Qtd.
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="unidade" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Unidade
                      </SortableTableHead>
                      <SortableTableHead className="p-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground" field="valorUnitario" sortConfig={sortConfig} onRequestSort={requestSort}>
                        Valor Unit.
                      </SortableTableHead>
                      <th className="p-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                      <th className="p-3 text-center text-xs font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPaginatedItems.map((item, index) => (
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
                        <td className="p-3 text-sm font-mono">
                          {item.codigo && Number(item.codigo) > 0 ? (
                            item.codigo
                          ) : (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs font-medium font-sans inline-block">
                              Não identificado
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm max-w-sm" title={item.descricao}>
                          <p className="font-medium line-clamp-2">
                            {item.descricao && item.descricao.trim().toLowerCase() !== "material não especificado" && item.descricao.trim().toLowerCase() !== "não identificado" ? (
                              item.descricao
                            ) : (
                              <span className="text-muted-foreground italic font-normal">
                                Não identificado
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.categoria}</p>
                          {item.observacao && /\[Transferido [^\]]+\]/.test(item.observacao) && (
                            <div className="mt-1">
                              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 gap-1 text-[11px] font-semibold py-0">
                                🔄 {item.observacao.match(/\[Transferido ([^\]]+)\]/)?.[1] || "Transferido"}
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm font-medium">
                          {(item.gerencia_id && gerenciaMap[item.gerencia_id] && gerenciaMap[item.gerencia_id] !== "N/A" ? gerenciaMap[item.gerencia_id] : undefined) ||
                           (item.gerencia_id && globalGerenciaMap[item.gerencia_id]?.sigla && globalGerenciaMap[item.gerencia_id]?.sigla !== "N/A" ? globalGerenciaMap[item.gerencia_id]?.sigla : undefined) ||
                           (item.gerencia && gerenciaMap[item.gerencia] && gerenciaMap[item.gerencia] !== "N/A" ? gerenciaMap[item.gerencia] : undefined) ||
                           (item.gerencia && item.gerencia !== "N/A" ? item.gerencia : undefined) ||
                           (item.gerencia_id && diretoriaMap[item.gerencia_id]?.sigla) ||
                           (item.diretoria_id && diretoriaMap[item.diretoria_id]?.sigla) ||
                           siglaUpper}
                        </td>
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
                            <span className={item.qtdEstimada === 0 ? "text-amber-600 font-medium" : ""}>
                              {item.qtdEstimada}
                            </span>
                          ) : (
                            <Input
                              key={`${item.id}-${item.qtdEstimada}`}
                              type="number"
                              min={0}
                              placeholder="0"
                              defaultValue={item.qtdEstimada === 0 ? "" : item.qtdEstimada}
                              onBlur={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (val !== item.qtdEstimada) {
                                  handleUpdateQtdEstimada(item.id!, val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                              className={`w-16 h-8 text-sm ${item.qtdEstimada === 0 ? "border-amber-400 bg-amber-50/40 text-amber-900 placeholder:text-amber-400 font-medium focus:border-amber-500" : ""}`}
                              title={item.qtdEstimada === 0 ? "Quantidade zerada. Digite um valor para calcular o total." : undefined}
                            />
                          )}
                        </td>
                        <td className="p-3 text-sm">{item.unidade}</td>
                        <td className="p-3 text-right text-sm">
                          {formatCurrency(item.valorUnitario)}
                        </td>
                        <td className="p-3 text-right text-sm font-medium">
                          {item.qtdEstimada === 0 ? (
                            <span className="text-amber-600 text-xs font-normal" title="Preencha a quantidade para calcular o total">
                              R$ 0,00 <span className="text-[10px] text-amber-500">(qtd: 0)</span>
                            </span>
                          ) : (
                            formatCurrency((Number(item.qtdEstimada) || 0) * (Number(item.valorUnitario) || 0))
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
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
                                disabled={!item.id}
                                onClick={() => item.id && handleDeleteSolicitacao(item.id)}
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Transferir para Gerência"
                              onClick={() => handleOpenTransferDialog(item, "aquisicao")}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )} />
              </div>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <SmartPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={recebidosTableItems.length}
              />
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
                      {todasGerenciasDaDiretoria.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.sigla} - {g.nome}
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

      {/* Dialog de Ação para Seus Itens (Aquisição) */}
      <Dialog open={actionOwnDialog.open} onOpenChange={(open) => {
        if (!open) {
          setActionOwnDialog({ open: false, action: null });
          setJustificativa("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionOwnDialog.action === "aprovar" && "Aprovar Itens"}
              {actionOwnDialog.action === "rejeitar" && "Rejeitar Itens"}
              {actionOwnDialog.action === "devolver" && "Devolver Itens para Rascunho"}
              {actionOwnDialog.action === "analisar" && "Voltar Itens para Análise"}
            </DialogTitle>
            <DialogDescription>
              {actionOwnDialog.action === "aprovar" && `Tem certeza que deseja aprovar os ${selectedOwnItems.size} item(ns) selecionado(s)?`}
              {actionOwnDialog.action === "rejeitar" && `Por favor, forneça uma justificativa para a rejeição dos ${selectedOwnItems.size} item(ns) (opcional):`}
              {actionOwnDialog.action === "devolver" && `Tem certeza que deseja devolver os ${selectedOwnItems.size} item(ns) para Rascunho? Por favor, forneça uma justificativa:`}
              {actionOwnDialog.action === "analisar" && `Tem certeza que deseja retornar os ${selectedOwnItems.size} item(ns) para análise?`}
            </DialogDescription>
          </DialogHeader>

          {(actionOwnDialog.action === "rejeitar" || actionOwnDialog.action === "devolver") && (
            <div className="py-4">
              <Textarea
                placeholder="Motivo da devolução/rejeição..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionOwnDialog({ open: false, action: null });
              setJustificativa("");
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleActionOwnSubmit}
              disabled={(actionOwnDialog.action === "rejeitar" || actionOwnDialog.action === "devolver") && !justificativa.trim()}
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
            {selectedApprovedItems.filter(i => (Number(i.qtdEstimada) || 0) <= 0).length > 0 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                ⚠️ <strong>Atenção:</strong> {selectedApprovedItems.filter(i => (Number(i.qtdEstimada) || 0) <= 0).length} item(ns) selecionado(s) possuem <strong>quantidade zerada (Total R$ 0,00)</strong>. Recomenda-se informar as quantidades antes de encaminhar para Compras.
              </div>
            )}
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

      <ServicoEditDialog
        open={servicoEditOpen}
        onOpenChange={setServicoEditOpen}
        servico={servicoEdicao}
        onSave={async (item, updates) => {
          try {
            if (servicoEdicao?.id) {
              await updateServico(servicoEdicao.id, updates);
            } else {
              await ensureServicoDiretoria(item as number, updates);
            }
            setServicoEditOpen(false);
            setServicoEdicao(null);
            queryClient.invalidateQueries({ queryKey: ["servicos"] });
            queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", diretoria?.id, periodAtivo?.id] });
            toast({ title: "Serviço atualizado", description: "Informações do serviço salvas." });
          } catch (error) {
            console.error("Erro ao atualizar serviço:", error);
            toast({ title: "Erro ao atualizar", description: "Falha ao salvar serviço.", variant: "destructive" });
          }
        }}
        diretoriaLabel={diretoria?.sigla ? `${diretoria.sigla} - ${diretoria.nome}` : undefined}
        canEditStatus={true}
      />

      <AquisicaoEditDialog
        open={solicitacaoEditOpen}
        onOpenChange={setSolicitacaoEditOpen}
        aquisicao={solicitacaoEdicao}
        onSave={async (codigo, updates) => {
          try {
            if (solicitacaoEdicao?.id && !String(solicitacaoEdicao.id).startsWith("temp-")) {
              await updateSolicitacao(solicitacaoEdicao.id, updates);
            } else {
              await ensureSolicitacaoDiretoria(Number(codigo), updates);
            }
            setSolicitacaoEditOpen(false);
            setSolicitacaoEdicao(null);
            queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
            queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", diretoria?.id, periodAtivo?.id] });
            toast({ title: "Aquisição atualizada", description: "Informações salvas." });
          } catch (error) {
            console.error("Erro ao atualizar aquisição:", error);
            toast({ title: "Erro ao atualizar", description: "Falha ao salvar aquisição.", variant: "destructive" });
          }
        }}
        canEditStatus={true}
      />

      {renderTransferDialog()}
      {renderDesfazerTransferDialog()}
    </div>
    </div>
  );
};

export default DiretoriaAprovacao;
