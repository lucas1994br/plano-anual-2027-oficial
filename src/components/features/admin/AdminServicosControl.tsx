// deno-lint-ignore-file no-explicit-any
// AdminServicosControl.tsx - Versão CORRIGIDA SEM ANY
import { useState, useMemo } from "react";
import { PlusCircle, Pencil, Trash2, Search, FileDown, FileSpreadsheet, ArrowRightLeft, Loader2, Undo2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import { formatContratoMask } from "@/lib/utils";
import { DesfazerTransferenciaDialog } from "@/components/common/DesfazerTransferenciaDialog.tsx";

import { Button } from "@/components/ui/button.tsx";
import { SmartPagination } from "@/components/common/SmartPagination.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { CurrencyInput } from "@/components/ui/currency-input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  getServicosCatalogo,
  createServicoCatalogoAndDistribuir,
  updateServicoCatalogoAdmin,
  deleteServicoCatalogoAdmin,
  deleteServicosCatalogoBulkAdmin,
  getDiretorias,
  getGerenciasByDiretoria,
  getTodasGerencias,
  transferirContratoServicos,
  transferirServicosParaGerenciaBulk,
  supabase
} from "@/lib/services.ts";
import { GrauPrioridade } from "@/types/plan.ts";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination.tsx";
import { SortableTableHead } from "@/components/ui/sortable-table-head.tsx";
import { useSortableTable } from "@/hooks/useSortableTable.ts";

// ==================== TIPOS ====================
type ServicoCatalogo = {
  id: string;
  item: number;
  tipo_contratacao: string;
  objeto: string;
  justificativa: string | null;
  grau_prioridade: GrauPrioridade;
  estimativa_valor: number;
  vinculacao: "Sim" | "Não";
  dependencia_descricao: string | null;
  diretoria_id: string;
  gerencia_id: string;
  ativo: boolean;
  contrato: string | null;
  contratada: string | null;
  created_at: string;
  updated_at: string;
};

type Diretoria = {
  id: string;
  sigla: string;
  nome: string;
};

type Gerencia = {
  id: string;
  sigla: string;
  nome: string;
  diretoria_id: string;
};

// Tipo para o retorno da API de diretorias
type DiretoriaAPI = {
  id: string;
  sigla: string;
  nome: string | null;
};

// Tipo para o retorno da API de gerências
type GerenciaAPI = {
  id: string;
  sigla: string;
  nome: string | null;
  diretoria_id: string;
};

// ==================== COMPONENTE PRINCIPAL ====================
export function AdminServicosControl() {
  const queryClient = useQueryClient();

  // Estados para os diálogos
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<ServicoCatalogo | null>(null);
  const [deletingServico, setDeletingServico] = useState<ServicoCatalogo | null>(null);
  
  // Estados de loading
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState("");
  const [bulkEditValue, setBulkEditValue] = useState("");

  // Estados de busca e seleção
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categoriaServico, setCategoriaServico] = useState<"existentes" | "novos" | "todos">("existentes");
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Formulário de criação
  const [formData, setFormData] = useState({
    tipo_contratacao: "Renovação",
    objeto: "",
    justificativa: "",
    grau_prioridade: "Médio" as GrauPrioridade,
    estimativa_valor: "",
    vinculacao: "Não" as "Sim" | "Não",
    dependencia_descricao: "",
    contrato: "",
    contratada: "",
    diretoria_id: "",
    gerencia_id: "",
  });

  // Formulário de edição
  const [editFormData, setEditFormData] = useState({
    tipo_contratacao: "",
    objeto: "",
    justificativa: "",
    grau_prioridade: "Médio" as GrauPrioridade,
    estimativa_valor: "",
    vinculacao: "Não" as "Sim" | "Não",
    dependencia_descricao: "",
    contrato: "",
    contratada: "",
    item: 0,
    diretoria_id: "",
    gerencia_id: "",
  });

  // Buscar serviços do catálogo
  const { data: servicos = [], isLoading, refetch: refetchServicos } = useQuery({
    queryKey: ["servicos-catalogo"],
    queryFn: getServicosCatalogo,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar diretorias (sem any)
  const { data: diretorias = [] } = useQuery({
    queryKey: ["diretorias"],
    queryFn: async (): Promise<Diretoria[]> => {
      const result = await getDiretorias();
      return (result as any[]).map((dir: any): Diretoria => ({
        id: dir.id,
        sigla: dir.sigla,
        nome: dir.nome || dir.sigla,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar todas as gerências (para exibição na tabela)
  const { data: todasGerencias = [] } = useQuery({
    queryKey: ["todas-gerencias-admin"],
    queryFn: async (): Promise<Gerencia[]> => {
      const result = await getTodasGerencias();
      return (result as any[]).map((ger: any): Gerencia => ({
        id: ger.id,
        sigla: ger.sigla,
        nome: ger.nome || ger.sigla,
        diretoria_id: ger.diretoria_id,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar gerências quando diretoria for selecionada (para criação)
  const { data: gerenciasCreate = [] } = useQuery({
    queryKey: ["gerencias-create", formData.diretoria_id],
    queryFn: (): Promise<Gerencia[]> => 
      formData.diretoria_id 
        ? getGerenciasByDiretoria(formData.diretoria_id).then((result: any[]) =>
            result.map((ger: any): Gerencia => ({
              id: ger.id,
              sigla: ger.sigla,
              nome: ger.nome || ger.sigla,
              diretoria_id: ger.diretoria_id,
            }))
          )
        : Promise.resolve([]),
    enabled: !!formData.diretoria_id && createDialogOpen,
  });

  // Buscar gerências para edição
  const { data: gerenciasEdit = [] } = useQuery({
    queryKey: ["gerencias-edit", editFormData.diretoria_id],
    queryFn: (): Promise<Gerencia[]> => 
      editFormData.diretoria_id 
        ? getGerenciasByDiretoria(editFormData.diretoria_id).then((result: any[]) =>
            result.map((ger: any): Gerencia => ({
              id: ger.id,
              sigla: ger.sigla,
              nome: ger.nome || ger.sigla,
              diretoria_id: ger.diretoria_id,
            }))
          )
        : Promise.resolve([]),
    enabled: !!editFormData.diretoria_id && !!editingServico,
  });

  const isNovoServico = (s: ServicoCatalogo) => {
    const tipo = (s.tipo_contratacao || "").trim().toLowerCase();
    const itemNum = Number(s.item);
    return tipo === "novo" || (!isNaN(itemNum) && itemNum >= 9000000);
  };

  const servicosDaCategoria = useMemo(() => {
    if (categoriaServico === "existentes") {
      return (servicos as ServicoCatalogo[]).filter((s) => !isNovoServico(s));
    }
    if (categoriaServico === "novos") {
      return (servicos as ServicoCatalogo[]).filter((s) => isNovoServico(s));
    }
    return (servicos as ServicoCatalogo[]);
  }, [servicos, categoriaServico]);

  const filteredServicos = useMemo(() => {
    if (!searchTerm) return servicosDaCategoria;
    const term = searchTerm.toLowerCase();
    return servicosDaCategoria.filter(servico => 
      String(servico.item).toLowerCase().includes(term) ||
      servico.objeto.toLowerCase().includes(term) ||
      (servico.contrato && servico.contrato.toLowerCase().includes(term)) ||
      (servico.contratada && servico.contratada.toLowerCase().includes(term)) ||
      servico.tipo_contratacao.toLowerCase().includes(term)
    );
  }, [servicosDaCategoria, searchTerm]);

  const { sortedItems, requestSort, sortConfig } = useSortableTable(filteredServicos as ServicoCatalogo[]);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = sortedItems.slice(startIdx, endIdx);
    return { totalPages, currentPage, paginatedItems, totalFiltered: sortedItems.length };
  }, [sortedItems, currentPage]);

  const tiposContratacaoDisponiveis = useMemo(() => {
    const set = new Set<string>(["Novo", "Renovação", "Prorrogação", "Contínuo", "Outros"]);
    (servicos as any[]).forEach((s) => {
      if (s.tipo_contratacao && String(s.tipo_contratacao).trim()) {
        set.add(String(s.tipo_contratacao).trim());
      }
    });
    if (editFormData?.tipo_contratacao && editFormData.tipo_contratacao.trim()) {
      set.add(editFormData.tipo_contratacao.trim());
    }
    if (formData?.tipo_contratacao && formData.tipo_contratacao.trim()) {
      set.add(formData.tipo_contratacao.trim());
    }
    return Array.from(set);
  }, [servicos, editFormData?.tipo_contratacao, formData?.tipo_contratacao]);

  const summary = useMemo(() => {
    const totalItens = servicosDaCategoria.length;
    const somaValores = servicosDaCategoria.reduce((acc, servico) => acc + (servico.estimativa_valor || 0), 0);
    const mediaValor = totalItens > 0 ? somaValores / totalItens : 0;
    
    return {
      totalItens,
      mediaValor,
      somaTotal: somaValores,
    };
  }, [servicosDaCategoria]);

  const resetForm = () => {
    setFormData({
      tipo_contratacao: categoriaServico === "novos" ? "Novo" : "Renovação",
      objeto: "",
      justificativa: "",
      grau_prioridade: "Médio",
      estimativa_valor: "",
      vinculacao: "Não",
      dependencia_descricao: "",
      contrato: "",
      contratada: "",
      diretoria_id: "",
      gerencia_id: "",
    });
  };

  // Estado do diálogo de transferência
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    modo: "contrato" | "bulk" | "item";
    selectedContrato: string;
    selectedContratos?: string[];
    item: ServicoCatalogo | null;
    sourceDiretoriaId?: string;
    targetDiretoriaId: string;
    targetDiretoriaIds?: string[];
    targetGerenciaId: string;
    incluirCustoFinanceiro?: boolean;
    loading: boolean;
  }>({
    open: false,
    modo: "contrato",
    selectedContrato: "",
    selectedContratos: [],
    item: null,
    sourceDiretoriaId: "",
    targetDiretoriaId: "",
    targetDiretoriaIds: [],
    targetGerenciaId: "",
    incluirCustoFinanceiro: true,
    loading: false,
  });

  const [filtroContratoAdminTransfer, setFiltroContratoAdminTransfer] = useState("");
  const [desfazerTransferOpen, setDesfazerTransferOpen] = useState(false);

  const contratosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (servicos as ServicoCatalogo[]).forEach((s) => {
      const c = String(s.contrato || "").trim();
      if (c && c !== "-" && c !== "null" && c !== "undefined") {
        set.add(c);
      }
    });
    return Array.from(set).sort();
  }, [servicos]);

  const gerenciasAlvo = useMemo(() => {
    if (!transferDialog.targetDiretoriaId) return todasGerencias;
    const gers = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === transferDialog.targetDiretoriaId);
    return gers.length > 0 ? gers : todasGerencias;
  }, [transferDialog.targetDiretoriaId, todasGerencias]);

  const handleOpenContratoTransfer = () => {
    const firstDir = (diretorias as Diretoria[])[0]?.id || "";
    const secondDir = (diretorias as Diretoria[])[1]?.id || firstDir;
    const gers = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === secondDir);
    setFiltroContratoAdminTransfer("");
    setTransferDialog({
      open: true,
      modo: "contrato",
      selectedContrato: contratosDisponiveis[0] || "",
      selectedContratos: contratosDisponiveis[0] ? [contratosDisponiveis[0]] : [],
      item: null,
      sourceDiretoriaId: firstDir,
      targetDiretoriaId: secondDir,
      targetDiretoriaIds: secondDir ? [secondDir] : [],
      targetGerenciaId: gers[0]?.id || "",
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleOpenBulkTransfer = () => {
    const firstDir = (diretorias as Diretoria[])[0]?.id || "";
    const secondDir = (diretorias as Diretoria[])[1]?.id || firstDir;
    const gers = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === secondDir);
    setTransferDialog({
      open: true,
      modo: "bulk",
      selectedContrato: "",
      item: null,
      sourceDiretoriaId: firstDir,
      targetDiretoriaId: secondDir,
      targetDiretoriaIds: [secondDir],
      targetGerenciaId: gers[0]?.id || "",
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleOpenItemTransfer = (item: ServicoCatalogo) => {
    const firstDir = (diretorias as Diretoria[])[0]?.id || "";
    const secondDir = (diretorias as Diretoria[])[1]?.id || firstDir;
    const gers = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === secondDir);
    setTransferDialog({
      open: true,
      modo: "item",
      selectedContrato: "",
      item,
      sourceDiretoriaId: firstDir,
      targetDiretoriaId: secondDir,
      targetDiretoriaIds: [secondDir],
      targetGerenciaId: gers[0]?.id || "",
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleConfirmTransferAdmin = async () => {
    const { modo, selectedContrato, selectedContratos, item, sourceDiretoriaId, targetDiretoriaId, targetDiretoriaIds, targetGerenciaId, incluirCustoFinanceiro } = transferDialog;

    const targetDirIds = (targetDiretoriaIds && targetDiretoriaIds.length > 0)
      ? targetDiretoriaIds
      : targetDiretoriaId ? [targetDiretoriaId] : [];

    const finalContratos = (selectedContratos && selectedContratos.length > 0)
      ? selectedContratos
      : (selectedContrato ? [selectedContrato] : []);

    if (targetDirIds.length === 0) {
      toast.error("Selecione ao menos uma diretoria de destino.");
      return;
    }

    let finalTargetGerId = targetGerenciaId;
    if (!finalTargetGerId && targetDirIds.length > 0) {
      const gersDaDir = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === targetDirIds[0]);
      finalTargetGerId = gersDaDir[0]?.id || "";
    }

    if (modo !== "contrato" && !finalTargetGerId) {
      toast.error("Selecione a diretoria e gerência de destino.");
      return;
    }

    setTransferDialog(prev => ({ ...prev, loading: true }));
    const dirOrigemSigla = (diretorias as Diretoria[]).find(d => d.id === sourceDiretoriaId)?.sigla;
    const dirDestinoSigla = (diretorias as Diretoria[]).find(d => d.id === targetDirIds[0])?.sigla || "Diretoria";
    const gerDestinoSigla = (todasGerencias as Gerencia[]).find(g => g.id === finalTargetGerId)?.sigla || "Gerência";
    const tagOrigem = dirOrigemSigla || "ADMIN";

    const siglasDestino = targetDirIds
      .map(id => (diretorias as Diretoria[]).find(d => d.id === id)?.sigla)
      .filter(Boolean)
      .join(", ");

    try {
      if (modo === "contrato") {
        const comCusto = incluirCustoFinanceiro !== false;
        const res = await transferirContratoServicos({
          contrato: finalContratos[0] || selectedContrato,
          contratos: finalContratos,
          sourceDiretoriaId: sourceDiretoriaId || undefined,
          targetDiretoriaId: targetDirIds[0],
          targetDiretoriaIds: targetDirIds,
          targetGerenciaId: finalTargetGerId,
          origemSigla: tagOrigem,
          incluirCustoFinanceiro: comCusto,
        });

        await queryClient.invalidateQueries({ queryKey: ["servicos"] });
        await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
        for (const dirId of targetDirIds) {
          await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", dirId] });
        }
        refetchServicos();

        const contratosLabel = finalContratos.length === 1 ? `"${finalContratos[0]}"` : `${finalContratos.length} contratos (${finalContratos.join(", ")})`;
        if (comCusto) {
          toast.success(`Contrato(s) ${contratosLabel} (${res.count} serviços, ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(res.totalValor)}) transferido(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`);
        } else {
          toast.success(`Contrato(s) ${contratosLabel} (${res.count} serviços) disponibilizado(s) para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla} SEM custo financeiro.`);
        }
      } else {
        const itemsToTransfer: ServicoCatalogo[] = modo === "item" && item
          ? [item]
          : (servicos as ServicoCatalogo[]).filter(s => selectedIds.includes(s.id));

        const itemNumbers = itemsToTransfer.map(s => s.item);

        let query = supabase.from("servicos").select("id, item");
        if (sourceDiretoriaId) {
          query = query.eq("diretoria_id", sourceDiretoriaId);
        }
        query = query.in("item", itemNumbers);

        const { data: existingServicos } = await query;

        const servIds = (existingServicos || []).map((s: any) => s.id);
        if (servIds.length > 0) {
          await transferirServicosParaGerenciaBulk(servIds, targetGerenciaId, targetDiretoriaId, tagOrigem);
        }

        for (const s of itemsToTransfer) {
          await supabase
            .from("servicos_catalogo")
            .update({
              diretoria_id: targetDiretoriaId,
              gerencia_id: targetGerenciaId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", s.id);
        }

        setSelectedIds([]);
        await queryClient.invalidateQueries({ queryKey: ["servicos"] });
        await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
        refetchServicos();
        toast.success(`${itemsToTransfer.length} serviço(s) transferido(s)${dirOrigemSigla ? ` de ${dirOrigemSigla}` : ""} para a Diretoria ${dirDestinoSigla} (${gerDestinoSigla}) com sucesso.`);
      }

      setTransferDialog(prev => ({ ...prev, open: false, loading: false }));
    } catch (err: any) {
      console.error("Erro na transferência de serviços (Admin):", err);
      toast.error(err?.message || "Erro ao transferir serviço/contrato.");
      setTransferDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleOpenCreateDialog = () => {
    setFormData(prev => ({
      ...prev,
      tipo_contratacao: categoriaServico === "novos" ? "Novo" : "Renovação",
    }));
    setCreateDialogOpen(true);
  };

  const resetEditForm = () => {
    setEditFormData({
      tipo_contratacao: "",
      objeto: "",
      justificativa: "",
      grau_prioridade: "Médio",
      estimativa_valor: "",
      vinculacao: "Não",
      dependencia_descricao: "",
      contrato: "",
      contratada: "",
      item: 0,
      diretoria_id: "",
      gerencia_id: "",
    });
  };

  const handleCreate = async () => {
    if (!formData.objeto.trim()) {
      toast.error("Preencha o objeto do serviço.");
      return;
    }

    if (!formData.justificativa.trim()) {
      toast.error("Preencha a justificativa do serviço.");
      return;
    }

    if (!formData.diretoria_id) {
      toast.error("Selecione uma diretoria.");
      return;
    }

    if (!formData.gerencia_id) {
      toast.error("Selecione uma gerência.");
      return;
    }

    const estimativaValor = parseFloat(formData.estimativa_valor);
    if (isNaN(estimativaValor) || estimativaValor <= 0) {
      toast.error("Informe um valor estimativo válido.");
      return;
    }

    setIsCreating(true);
    try {
      await createServicoCatalogoAndDistribuir({
        tipo_contratacao: formData.tipo_contratacao,
        objeto: formData.objeto.trim(),
        justificativa: formData.justificativa.trim(),
        grau_prioridade: formData.grau_prioridade,
        estimativa_valor: estimativaValor,
        vinculacao: formData.vinculacao,
        contrato: formData.contrato.trim() || null,
        contratada: formData.contratada.trim() || null,
        dependencia_descricao: formData.dependencia_descricao.trim() || undefined,
        diretoria_id: formData.diretoria_id,
        gerencia_id: formData.gerencia_id,
      });

      resetForm();
      setCreateDialogOpen(false);
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast.success("Serviço criado e distribuído com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível criar o serviço.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (servico: ServicoCatalogo) => {
    setEditingServico(servico);
    setEditFormData({
      tipo_contratacao: servico.tipo_contratacao,
      objeto: servico.objeto,
      justificativa: servico.justificativa || "",
      grau_prioridade: servico.grau_prioridade,
      estimativa_valor: String(servico.estimativa_valor),
      vinculacao: servico.vinculacao,
      contrato: servico.contrato || "",
      contratada: servico.contratada || "",
      dependencia_descricao: servico.dependencia_descricao || "",
      item: servico.item,
      diretoria_id: servico.diretoria_id || "",
      gerencia_id: servico.gerencia_id || "",
    });
  };

  const handleUpdate = async () => {
    if (!editingServico) return;

    const estimativaValor = parseFloat(editFormData.estimativa_valor);
    if (isNaN(estimativaValor) || estimativaValor <= 0) {
      toast.error("Informe um valor estimativo válido.");
      return;
    }

    setIsUpdating(true);
    try {
      await updateServicoCatalogoAdmin(editingServico.id, {
        tipo_contratacao: editFormData.tipo_contratacao,
        objeto: editFormData.objeto.trim(),
        justificativa: editFormData.justificativa.trim() || null,
        grau_prioridade: editFormData.grau_prioridade,
        estimativa_valor: estimativaValor,
        vinculacao: editFormData.vinculacao,
        contrato: editFormData.contrato.trim() || null,
        contratada: editFormData.contratada.trim() || null,
        dependencia_descricao: editFormData.dependencia_descricao.trim() || null,
        item: editFormData.item,
        diretoria_id: editFormData.diretoria_id,
        gerencia_id: editFormData.gerencia_id,
      });

      setEditingServico(null);
      resetEditForm();
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast.success("Serviço atualizado com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o serviço.";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingServico) return;

    setIsDeleting(true);
    try {
      await deleteServicoCatalogoAdmin(deletingServico.id, deletingServico.item);
      setDeletingServico(null);
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast.success("Serviço removido com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível remover o serviço.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} serviços? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      const selectedItems = selectedIds.map(id => {
        const s = (servicos as ServicoCatalogo[]).find(item => item.id === id);
        return s ? s.item : undefined;
      }).filter((it): it is number => it !== undefined && it > 0);

      await deleteServicosCatalogoBulkAdmin(selectedIds, selectedItems);
      setSelectedIds([]);
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast.success(`${selectedIds.length} serviços removidos com sucesso.`);
    } catch (_error: unknown) {
      toast.error("Ocorreu um erro ao excluir um ou mais serviços.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedIds.length === 0 || !bulkEditField || !bulkEditValue) return;

    setIsUpdatingBulk(true);
    try {
      const updates: any = {};
      if (bulkEditField === "tipo_contratacao") updates.tipo_contratacao = bulkEditValue;
      if (bulkEditField === "grau_prioridade") updates.grau_prioridade = bulkEditValue;
      if (bulkEditField === "vinculacao") updates.vinculacao = bulkEditValue;
      if (bulkEditField === "contratada") updates.contratada = bulkEditValue;
      if (bulkEditField === "contrato") updates.contrato = bulkEditValue;
      if (bulkEditField === "item") updates.item = parseInt(bulkEditValue, 10);
      if (bulkEditField === "diretoria_id") updates.diretoria_id = bulkEditValue;
      if (bulkEditField === "gerencia_id") updates.gerencia_id = bulkEditValue;

      await Promise.all(selectedIds.map(id => updateServicoCatalogoAdmin(id, updates)));
      
      setBulkEditOpen(false);
      setBulkEditField("");
      setBulkEditValue("");
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
      toast.success(`${selectedIds.length} serviços atualizados com sucesso.`);
    } catch (_error: unknown) {
      toast.error("Ocorreu um erro ao atualizar um ou mais serviços.");
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    const allIds = sortedItems.map((s: ServicoCatalogo) => s.id);
    const allSelected = allIds.length > 0 && allIds.every((id: string) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const getDiretoriaSigla = (diretoriaId: string | null): string => {
    if (!diretoriaId) return "-";
    const dir = diretorias.find((d: Diretoria) => d.id === diretoriaId);
    return dir?.sigla || diretoriaId;
  };

  const getGerenciaSigla = (gerenciaId: string | null): string => {
    if (!gerenciaId) return "-";
    const ger = todasGerencias.find((g: Gerencia) => g.id === gerenciaId);
    return ger?.sigla || gerenciaId.slice(0, 8);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number | undefined)[][] = [];

    const catLabel = categoriaServico === "novos" ? "Novos Serviços" : categoriaServico === "existentes" ? "Serviços Existentes" : "Todos os Serviços";
    wsData.push([`Plano Anual de Contratações 2027 — Catálogo de Serviços (${catLabel})`]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);
    wsData.push(["Item", "Contrato", "Contratada", "Objeto", "Tipo", "Prioridade", "Estimativa Valor", "Vinculação", "Diretoria", "Gerência", "Status"]);

    (filteredServicos as ServicoCatalogo[]).forEach((s) => {
      wsData.push([
        s.item,
        s.contrato || "-",
        s.contratada || "-",
        s.objeto,
        s.tipo_contratacao,
        s.grau_prioridade,
        s.estimativa_valor,
        s.vinculacao,
        getDiretoriaSigla(s.diretoria_id),
        getGerenciaSigla(s.gerencia_id),
        s.ativo ? "Ativo" : "Inativo"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Serviços");
    const fileSuffix = categoriaServico === "novos" ? "Novos_Servicos" : categoriaServico === "existentes" ? "Servicos_Existentes" : "Servicos";
    XLSX.writeFile(wb, `PAC_2027_Catalogo_${fileSuffix}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    const catLabel = categoriaServico === "novos" ? "Novos Serviços" : categoriaServico === "existentes" ? "Serviços Existentes" : "Serviços";
    doc.setFontSize(14);
    doc.text(`PAC 2027 — Catálogo de ${catLabel}`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    
    const formatCurrency = (value?: number) =>
      value != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
        : "—";

    autoTable(doc, {
      head: [["Item", "Contrato", "Objeto", "Tipo", "Estimativa", "Diretoria", "Gerência"]],
      body: (filteredServicos as ServicoCatalogo[]).map((s) => [
        s.item,
        s.contrato || "-",
        s.objeto.length > 50 ? s.objeto.substring(0, 50) + "…" : s.objeto,
        s.tipo_contratacao,
        formatCurrency(s.estimativa_valor),
        getDiretoriaSigla(s.diretoria_id),
        getGerenciaSigla(s.gerencia_id),
      ]) as import("jspdf-autotable").RowInput[],
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 250, 246] },
    });
    const fileSuffix = categoriaServico === "novos" ? "Novos_Servicos" : categoriaServico === "existentes" ? "Servicos_Existentes" : "Servicos";
    doc.save(`PAC_2027_Catalogo_${fileSuffix}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const getPrioridadeColor = (prioridade: GrauPrioridade): string => {
    const colors: Record<GrauPrioridade, string> = {
      "Baixo": "bg-blue-100 text-blue-800",
      "Médio": "bg-yellow-100 text-yellow-800",
      "Alto": "bg-orange-100 text-orange-800",
    };
    return colors[prioridade] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Card principal com seletor de tipo de serviço e botão Novo Serviço */}
      <Card className="p-6 card-shadow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="space-y-2 w-full sm:w-64">
              <Label className="text-sm font-medium">Tipo de Serviço</Label>
              <Select
                value={categoriaServico}
                onValueChange={(val: "existentes" | "novos" | "todos") => {
                  setCategoriaServico(val);
                  setCurrentPage(1);
                  setSelectedIds([]);
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existentes">Serviços Existentes</SelectItem>
                  <SelectItem value="novos">Novos Serviços</SelectItem>
                  <SelectItem value="todos">Todos os Serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="hidden sm:block h-12 w-[1px] bg-border"></div>
            <div>
              <div className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  {categoriaServico === "novos"
                    ? "Cadastrar novo serviço"
                    : categoriaServico === "existentes"
                    ? "Cadastrar serviço existente"
                    : "Cadastrar serviço no catálogo"}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ao cadastrar, o serviço entra no catálogo e já é distribuído para todas as gerências ativas como rascunho.
              </p>
            </div>
          </div>
          <Button onClick={handleOpenCreateDialog} className="gap-2 shrink-0 self-start md:self-auto">
            <PlusCircle className="h-4 w-4" />
            Novo Serviço
          </Button>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 flex flex-col justify-center relative overflow-hidden card-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 rounded-l-lg"></div>
          <p className="text-sm text-muted-foreground font-medium z-10">
            Total de Serviços {categoriaServico === "novos" ? "(Novos)" : categoriaServico === "existentes" ? "(Existentes)" : ""}
          </p>
          <p className="text-3xl font-bold text-slate-800 z-10 mt-1">{summary.totalItens}</p>
        </Card>
        <Card className="p-6 flex flex-col justify-center relative overflow-hidden card-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 rounded-l-lg"></div>
          <p className="text-sm text-muted-foreground font-medium z-10">Média de Valor</p>
          <p className="text-2xl font-bold text-slate-800 z-10 mt-1">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary.mediaValor)}
          </p>
        </Card>
        <Card className="p-6 flex flex-col justify-center relative overflow-hidden card-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500 rounded-l-lg"></div>
          <p className="text-sm text-muted-foreground font-medium z-10">Soma Total</p>
          <p className="text-2xl font-bold text-slate-800 z-10 mt-1">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary.somaTotal)}
          </p>
        </Card>
      </div>

      {/* Lista de Serviços */}
      <Card className="p-6 card-shadow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {categoriaServico === "novos"
                ? "Novos Serviços Cadastrados"
                : categoriaServico === "existentes"
                ? "Serviços Existentes Cadastrados"
                : "Serviços Cadastrados"}
            </h2>
            <Badge variant="outline" className="font-normal text-xs">
              {summary.totalItens} {summary.totalItens === 1 ? "item" : "itens"}
            </Badge>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por código, descrição, contrato e contratada"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
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
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={handleOpenContratoTransfer}
                title="Transferir um Contrato inteiro e seu custo financeiro para uma Diretoria"
              >
                <ArrowRightLeft className="h-4 w-4" />Transferir Contrato
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => setDesfazerTransferOpen(true)}
                title="Desfazer envio/transferência de contratos ou serviços"
              >
                <Undo2 className="h-4 w-4" />Desfazer Transferência
              </Button>
            </div>
            {selectedIds.length > 0 && (
              <>
                <Button 
                  variant="outline"
                  className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap w-full sm:w-auto"
                  onClick={handleOpenBulkTransfer}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferir ({selectedIds.length})
                </Button>
                <Button 
                  variant="outline"
                  className="gap-2 text-primary border-primary hover:bg-primary/10 whitespace-nowrap w-full sm:w-auto"
                  onClick={() => setBulkEditOpen(true)}
                  disabled={isUpdatingBulk}
                >
                  <Pencil className="h-4 w-4" />
                  Editar ({selectedIds.length})
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                  className="whitespace-nowrap w-full sm:w-auto gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeletingBulk ? "Excluindo..." : `Excluir (${selectedIds.length})`}
                </Button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando serviços...</div>
        ) : filteredServicos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum serviço encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={sortedItems.length > 0 && sortedItems.every((s: ServicoCatalogo) => selectedIds.includes(s.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos os serviços"
                    />
                  </TableHead>
                  <SortableTableHead className="w-16 cursor-pointer hover:text-slate-900" field="item" sortConfig={sortConfig} onRequestSort={requestSort}>Item</SortableTableHead>
                  <SortableTableHead className="w-24 cursor-pointer hover:text-slate-900" field="contrato" sortConfig={sortConfig} onRequestSort={requestSort}>Contrato</SortableTableHead>
                  <SortableTableHead className="w-32 cursor-pointer hover:text-slate-900" field="contratada" sortConfig={sortConfig} onRequestSort={requestSort}>Contratada</SortableTableHead>
                  <SortableTableHead className="cursor-pointer hover:text-slate-900" field="objeto" sortConfig={sortConfig} onRequestSort={requestSort}>Objeto</SortableTableHead>
                  <SortableTableHead className="w-32 cursor-pointer hover:text-slate-900" field="tipo_contratacao" sortConfig={sortConfig} onRequestSort={requestSort}>Tipo</SortableTableHead>
                  <SortableTableHead className="w-28 cursor-pointer hover:text-slate-900" field="grau_prioridade" sortConfig={sortConfig} onRequestSort={requestSort}>Prioridade</SortableTableHead>
                  <SortableTableHead className="w-32 cursor-pointer hover:text-slate-900" field="estimativa_valor" sortConfig={sortConfig} onRequestSort={requestSort}>Estimativa (R$)</SortableTableHead>
                  <SortableTableHead className="w-24 cursor-pointer hover:text-slate-900" field="vinculacao" sortConfig={sortConfig} onRequestSort={requestSort}>Vinculação</SortableTableHead>
                  <SortableTableHead className="w-24 cursor-pointer hover:text-slate-900" field="diretoria_id" sortConfig={sortConfig} onRequestSort={requestSort}>Diretoria</SortableTableHead>
                  <SortableTableHead className="w-24 cursor-pointer hover:text-slate-900" field="gerencia_id" sortConfig={sortConfig} onRequestSort={requestSort}>Gerência</SortableTableHead>
                  <SortableTableHead className="w-24 cursor-pointer hover:text-slate-900" field="ativo" sortConfig={sortConfig} onRequestSort={requestSort}>Status</SortableTableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginationData.paginatedItems.map((servico: ServicoCatalogo) => (
                  <TableRow key={servico.id} className={selectedIds.includes(servico.id) ? "bg-muted/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedIds.includes(servico.id)}
                        onCheckedChange={() => toggleSelect(servico.id)}
                        aria-label={`Selecionar serviço ${servico.item}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{servico.item}</TableCell>
                    <TableCell className="font-medium text-muted-foreground whitespace-nowrap">{servico.contrato || "-"}</TableCell>
                    <TableCell className="font-medium text-muted-foreground whitespace-nowrap">{servico.contratada || "-"}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="font-medium truncate">{servico.objeto}</p>
                      {servico.justificativa && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {servico.justificativa.substring(0, 80)}...
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{servico.tipo_contratacao}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPrioridadeColor(servico.grau_prioridade)}>
                        {servico.grau_prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                        .format(servico.estimativa_valor)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={servico.vinculacao === "Sim" ? "default" : "secondary"}>
                        {servico.vinculacao}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDiretoriaSigla(servico.diretoria_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getGerenciaSigla(servico.gerencia_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={servico.ativo ? "default" : "destructive"}>
                        {servico.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Transferir para Diretoria"
                          onClick={() => handleOpenItemTransfer(servico)}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(servico)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletingServico(servico)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Controles de Paginação */}
        {paginationData.totalPages > 1 && (
          <div className="py-4 border-t mt-4">
            <SmartPagination
              currentPage={currentPage}
              totalPages={paginationData.totalPages}
              onPageChange={setCurrentPage}
              totalItems={paginationData.totalFiltered}
            />
          </div>
        )}
      </Card>

      {/* ==================== DIALOG CRIAR SERVIÇO ==================== */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {categoriaServico === "novos" ? "Cadastrar Novo Serviço" : "Cadastrar Serviço Existente"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do serviço. Após cadastrado, será distribuído para todas as gerências ativas como rascunho.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Objeto */}
            <div>
              <Label className="text-sm font-medium">Objeto *</Label>
              <Textarea
                value={formData.objeto}
                onChange={(e) => setFormData(prev => ({ ...prev, objeto: e.target.value }))}
                placeholder="Descreva o objeto do serviço..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Justificativa */}
            <div>
              <Label className="text-sm font-medium">Justificativa *</Label>
              <Textarea
                value={formData.justificativa}
                onChange={(e) => setFormData(prev => ({ ...prev, justificativa: e.target.value }))}
                placeholder="Fundamentação técnica e administrativa..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Contrato */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Contrato {categoriaServico === "novos" ? "(Opcional)" : ""}</Label>
                <Input
                  value={formData.contrato}
                  onChange={(e) => setFormData(prev => ({ ...prev, contrato: formatContratoMask(e.target.value) }))}
                  placeholder="Ex: 028/2021"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Contratada {categoriaServico === "novos" ? "(Opcional)" : ""}</Label>
                <Input
                  value={formData.contratada}
                  onChange={(e) => setFormData(prev => ({ ...prev, contratada: e.target.value }))}
                  placeholder="Nome da empresa contratada"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Tipo de Contratação</Label>
                <Select
                  value={formData.tipo_contratacao}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_contratacao: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {tiposContratacaoDisponiveis.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Grau de Prioridade</Label>
                <Select
                  value={formData.grau_prioridade}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, grau_prioridade: value as GrauPrioridade }))}
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
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Estimativa de Valor (R$) *</Label>
                <CurrencyInput
                  value={formData.estimativa_valor}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimativa_valor: e.target.value }))}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Vinculação</Label>
                <Select
                  value={formData.vinculacao}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vinculacao: value as "Sim" | "Não" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dependência (condicional) */}
            {formData.vinculacao === "Sim" && (
              <div>
                <Label className="text-sm font-medium">Descrição da Vinculação</Label>
                <Textarea
                  value={formData.dependencia_descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, dependencia_descricao: e.target.value }))}
                  placeholder="Descreva a dependência ou vinculação..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            )}

            {/* Diretoria e Gerência */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Diretoria *</Label>
                <Select
                  value={formData.diretoria_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, diretoria_id: value, gerencia_id: "" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {diretorias.map((dir: Diretoria) => (
                      <SelectItem key={dir.id} value={dir.id}>
                        {dir.sigla} - {dir.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Gerência *</Label>
                <Select
                  value={formData.gerencia_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gerencia_id: value }))}
                  disabled={!formData.diretoria_id}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {gerenciasCreate.map((ger: Gerencia) => (
                      <SelectItem key={ger.id} value={ger.id}>
                        {ger.sigla} - {ger.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Criando..." : "Criar Serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG EDITAR SERVIÇO ==================== */}
      <Dialog open={!!editingServico} onOpenChange={(open) => {
        if (!open) {
          setEditingServico(null);
          resetEditForm();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
            <DialogDescription>
              Altere os dados do serviço. As alterações serão aplicadas em todo o sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Item</Label>
                <Input
                  type="number"
                  value={editFormData.item}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, item: parseInt(e.target.value, 10) || 0 }))}
                  className="mt-1"
                />
              </div>
            </div>
            {/* Objeto */}
            <div>
              <Label className="text-sm font-medium">Objeto *</Label>
              <Textarea
                value={editFormData.objeto}
                onChange={(e) => setEditFormData(prev => ({ ...prev, objeto: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Justificativa */}
            <div>
              <Label className="text-sm font-medium">Justificativa</Label>
              <Textarea
                value={editFormData.justificativa}
                onChange={(e) => setEditFormData(prev => ({ ...prev, justificativa: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Contrato */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Contrato</Label>
                <Input
                  value={editFormData.contrato}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, contrato: formatContratoMask(e.target.value) }))}
                  placeholder="Ex: 028/2021"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Contratada</Label>
                <Input
                  value={editFormData.contratada}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, contratada: e.target.value }))}
                  placeholder="Nome da empresa contratada"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Tipo de Contratação</Label>
                <Select
                  value={editFormData.tipo_contratacao}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, tipo_contratacao: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {tiposContratacaoDisponiveis.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Grau de Prioridade</Label>
                <Select
                  value={editFormData.grau_prioridade}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, grau_prioridade: value as GrauPrioridade }))}
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
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Estimativa de Valor (R$) *</Label>
                <CurrencyInput
                  value={editFormData.estimativa_valor}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, estimativa_valor: e.target.value }))}
                  className="mt-1"
                  placeholder="0,00"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Vinculação</Label>
                <Select
                  value={editFormData.vinculacao}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, vinculacao: value as "Sim" | "Não" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dependência (condicional) */}
            {editFormData.vinculacao === "Sim" && (
              <div>
                <Label className="text-sm font-medium">Descrição da Vinculação</Label>
                <Textarea
                  value={editFormData.dependencia_descricao}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, dependencia_descricao: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>
            )}

            {/* Diretoria e Gerência */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Diretoria *</Label>
                <Select
                  value={editFormData.diretoria_id}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, diretoria_id: value, gerencia_id: "" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {diretorias.map((dir: Diretoria) => (
                      <SelectItem key={dir.id} value={dir.id}>
                        {dir.sigla} - {dir.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Gerência *</Label>
                <Select
                  value={editFormData.gerencia_id}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, gerencia_id: value }))}
                  disabled={!editFormData.diretoria_id}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {gerenciasEdit.map((ger: Gerencia) => (
                      <SelectItem key={ger.id} value={ger.id}>
                        {ger.sigla} - {ger.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingServico(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG CONFIRMAR EXCLUSÃO ==================== */}
      <Dialog open={!!deletingServico} onOpenChange={(open) => {
        if (!open) setDeletingServico(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir permanentemente este serviço?
              {deletingServico && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="font-medium">{deletingServico.objeto}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Item #{deletingServico.item} · {deletingServico.tipo_contratacao}
                  </p>
                </div>
              )}
              <p className="mt-3 text-destructive">Esta ação não pode ser desfeita.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingServico(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Sim, Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG EDITAR EM LOTE ==================== */}
      <Dialog open={bulkEditOpen} onOpenChange={(open) => {
        setBulkEditOpen(open);
        if (!open) {
          setBulkEditField("");
          setBulkEditValue("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selectedIds.length} serviços em lote</DialogTitle>
            <DialogDescription>
              Selecione o campo que deseja alterar para todos os serviços selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campo a editar</Label>
              <Select value={bulkEditField} onValueChange={setBulkEditField}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tipo_contratacao">Tipo de Contratação</SelectItem>
                  <SelectItem value="grau_prioridade">Grau de Prioridade</SelectItem>
                  <SelectItem value="vinculacao">Vinculação</SelectItem>
                  <SelectItem value="contratada">Contratada</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="diretoria_id">Diretoria</SelectItem>
                  <SelectItem value="gerencia_id">Gerência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkEditField && (
              <div className="space-y-2">
                <Label>Novo valor</Label>
                {bulkEditField === "tipo_contratacao" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Novo">Novo</SelectItem>
                      <SelectItem value="Renovação">Renovação</SelectItem>
                      <SelectItem value="Prorrogação">Prorrogação</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkEditField === "grau_prioridade" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Baixo">Baixo</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Alto">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkEditField === "vinculacao" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                ) : bulkEditField === "diretoria_id" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione a diretoria..." /></SelectTrigger>
                    <SelectContent>
                      {diretorias.map((dir: Diretoria) => (
                        <SelectItem key={dir.id} value={dir.id}>
                          {dir.sigla} - {dir.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : bulkEditField === "gerencia_id" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione a gerência..." /></SelectTrigger>
                    <SelectContent>
                      {todasGerencias.map((ger: Gerencia) => (
                        <SelectItem key={ger.id} value={ger.id}>
                          {ger.sigla} - {ger.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : bulkEditField === "item" ? (
                  <Input
                    type="number"
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    placeholder="Número do item"
                  />
                ) : bulkEditField === "contrato" ? (
                  <Input
                    type="text"
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    placeholder="Ex: 028/2021"
                  />
                ) : bulkEditField === "contratada" ? (
                  <Input
                    type="text"
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    placeholder="Nome da empresa contratada"
                  />
                ) : null}
              </div>
            )}
            <Button className="w-full" disabled={!bulkEditField || !bulkEditValue || isUpdatingBulk} onClick={handleBulkEdit}>
              {isUpdatingBulk ? "Salvando..." : "Aplicar a todos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG TRANSFERÊNCIA DE SERVIÇOS (ADMIN) ==================== */}
      <Dialog
        open={transferDialog.open}
        onOpenChange={(open) => !transferDialog.loading && setTransferDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              {transferDialog.modo === "contrato"
                ? "Transferir Contrato de Serviço para uma Diretoria"
                : transferDialog.modo === "bulk"
                ? `Transferir ${selectedIds.length} Serviços para uma Diretoria`
                : "Transferir Serviço para uma Diretoria"}
            </DialogTitle>
            <DialogDescription>
              {transferDialog.modo === "contrato"
                ? "Transfere todos os serviços e o custo financeiro do contrato selecionado para a Diretoria e Gerência de destino."
                : "Transfere os serviços selecionados e seus respectivos custos para a Diretoria e Gerência de destino."}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-4">
            {transferDialog.modo === "contrato" ? (
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
                          setTransferDialog(prev => ({
                            ...prev,
                            selectedContratos: [...contratosDisponiveis],
                            selectedContrato: contratosDisponiveis[0] || "",
                          }));
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Todos ({contratosDisponiveis.length})
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
                      value={filtroContratoAdminTransfer}
                      onChange={(e) => setFiltroContratoAdminTransfer(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                      disabled={transferDialog.loading}
                    />
                  </div>

                  {/* Lista com scroll e checkboxes */}
                  <div className="space-y-1 p-2 rounded-lg border bg-background max-h-40 overflow-y-auto">
                    {(() => {
                      const termo = filtroContratoAdminTransfer.trim().toLowerCase();
                      const contratosFiltrados = contratosDisponiveis.filter(c =>
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

                  const servicosDosContratos = (servicos as ServicoCatalogo[]).filter(
                    s => selectedSet.has(String(s.contrato || "").trim())
                  );
                  const valorTotalContrato = servicosDosContratos.reduce(
                    (acc, s) => acc + (s.estimativa_valor || 0),
                    0
                  );
                  return (
                    <div className="rounded border bg-blue-50/60 border-blue-200 p-2.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                      <span>
                        Selecionados: <strong>{selectedList.length}</strong> | Serviços dos contratos: <strong>{servicosDosContratos.length}</strong>
                      </span>
                      <span>
                        Custo Financeiro Total: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotalContrato)}</strong>
                      </span>
                    </div>
                  );
                })()}
              </div>
            ) : transferDialog.modo === "item" && transferDialog.item ? (
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Serviço Selecionado</p>
                <p className="font-medium text-foreground mt-0.5">
                  Item {transferDialog.item.item} - {transferDialog.item.objeto}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Contrato: {transferDialog.item.contrato || "-"} • Valor: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(transferDialog.item.estimativa_valor)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Serviços Selecionados</p>
                <p className="font-medium text-foreground mt-0.5">
                  {selectedIds.length} serviço(s) selecionado(s)
                </p>
              </div>
            )}

            {/* De: Diretoria de Origem */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                De: Diretoria de Origem
              </label>
              <Select
                value={transferDialog.sourceDiretoriaId || "todas"}
                onValueChange={(val) => setTransferDialog(prev => ({ ...prev, sourceDiretoriaId: val === "todas" ? "" : val }))}
                disabled={transferDialog.loading}
              >
                <SelectTrigger className="w-full bg-background font-medium">
                  <SelectValue placeholder="Selecione a diretoria de origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Diretorias (Geral)</SelectItem>
                  {(diretorias as Diretoria[]).map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      Diretoria {d.sigla} - {d.nome || d.sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condições de Transferência (apenas para Contrato) */}
            {transferDialog.modo === "contrato" && (
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
                        name="condicaoFinanceiraAdminServicos"
                        checked={transferDialog.incluirCustoFinanceiro !== false}
                        onChange={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: true }))}
                        className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>1. Com Custo Financeiro</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 leading-relaxed">
                      Transfere os serviços e o custo financeiro para a(s) diretoria(s) selecionada(s).
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
                        name="condicaoFinanceiraAdminServicos"
                        checked={transferDialog.incluirCustoFinanceiro === false}
                        onChange={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: false }))}
                        className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>2. Sem Custo Financeiro</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 leading-relaxed">
                      Disponibiliza o contrato e serviços nas diretorias de destino sem enviar o custo (zerado).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border/50 pt-3 space-y-4">
              {/* Para: Diretoria(s) de Destino */}
              {transferDialog.modo === "contrato" ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-muted-foreground block">
                      Para: Diretoria(s) de Destino (escolha uma ou mais):
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = (diretorias as Diretoria[]).map(d => d.id);
                          setTransferDialog(prev => ({ ...prev, targetDiretoriaIds: allIds, targetDiretoriaId: allIds[0] || "" }));
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Todas
                      </button>
                      <span className="text-[11px] text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTransferDialog(prev => ({ ...prev, targetDiretoriaIds: [], targetDiretoriaId: "" }));
                        }}
                        className="text-[11px] text-muted-foreground hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 rounded-lg border bg-background max-h-36 overflow-y-auto">
                    {(diretorias as Diretoria[]).map((d: Diretoria) => {
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
                                const targetDir = (diretorias as Diretoria[]).find(dir => String(dir.id) === String(firstDir));
                                const gers = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === firstDir);
                                const nextGerId = (updated.length === 1 && targetDir?.id)
                                  ? targetDir.id
                                  : (gers[0]?.id || prev.targetGerenciaId || "");
                                return {
                                  ...prev,
                                  targetDiretoriaIds: updated,
                                  targetDiretoriaId: firstDir,
                                  targetGerenciaId: nextGerId,
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

                  {((transferDialog.targetDiretoriaIds || []).length === 1 || (!transferDialog.targetDiretoriaIds?.length && transferDialog.targetDiretoriaId)) && (
                    <div className="mt-3">
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
                            const curTargetDirId = (transferDialog.targetDiretoriaIds && transferDialog.targetDiretoriaIds[0]) || transferDialog.targetDiretoriaId;
                            const curTargetDirObj = (diretorias as Diretoria[]).find(d => String(d.id) === String(curTargetDirId));
                            return (
                              <>
                                {curTargetDirObj && (
                                  <SelectItem value={curTargetDirObj.id}>
                                    {curTargetDirObj.sigla} - Diretoria ({curTargetDirObj.nome || curTargetDirObj.sigla})
                                  </SelectItem>
                                )}
                                {gerenciasAlvo
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
                  )}

                  {((transferDialog.targetDiretoriaIds || []).length > 1) && (
                    <p className="text-[11px] text-muted-foreground mt-2 bg-blue-50/50 p-2 rounded border border-blue-200/60">
                      ℹ️ O envio será direcionado às gerências principais de cada uma das {(transferDialog.targetDiretoriaIds || []).length} diretorias selecionadas.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Para: Diretoria de Destino (Modo Item / Bulk) */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                      Para: Diretoria de Destino
                    </label>
                    <Select
                      value={transferDialog.targetDiretoriaId}
                      onValueChange={(val) => {
                        const gers = (todasGerencias as Gerencia[]).filter(g => g.diretoria_id === val);
                        setTransferDialog(prev => ({
                          ...prev,
                          targetDiretoriaId: val,
                          targetGerenciaId: gers[0]?.id || "",
                        }));
                      }}
                      disabled={transferDialog.loading}
                    >
                      <SelectTrigger className="w-full bg-background font-medium">
                        <SelectValue placeholder="Selecione a diretoria de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {(diretorias as Diretoria[]).map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            Diretoria {d.sigla} - {d.nome || d.sigla}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Para: Gerência de Destino (Modo Item / Bulk) */}
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
                          const curTargetDirId = transferDialog.targetDiretoriaId;
                          const curTargetDirObj = (diretorias as Diretoria[]).find(d => String(d.id) === String(curTargetDirId));
                          return (
                            <>
                              {curTargetDirObj && (
                                <SelectItem value={curTargetDirObj.id}>
                                  {curTargetDirObj.sigla} - Diretoria ({curTargetDirObj.nome || curTargetDirObj.sigla})
                                </SelectItem>
                              )}
                              {gerenciasAlvo
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
              onClick={handleConfirmTransferAdmin}
              disabled={
                transferDialog.loading ||
                (transferDialog.modo === "contrato" &&
                  (((transferDialog.selectedContratos?.length || (transferDialog.selectedContrato ? 1 : 0)) === 0) ||
                    ((transferDialog.targetDiretoriaIds?.length || 0) === 0 && !transferDialog.targetDiretoriaId))) ||
                (transferDialog.modo !== "contrato" && (!transferDialog.targetGerenciaId || !transferDialog.targetDiretoriaId))
              }
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {transferDialog.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Confirmar transferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DesfazerTransferenciaDialog
        open={desfazerTransferOpen}
        onOpenChange={setDesfazerTransferOpen}
        tipo="servicos"
        onSuccess={() => {
          refetchServicos();
          queryClient.invalidateQueries({ queryKey: ["servicos"] });
        }}
      />
    </div>
  );
}