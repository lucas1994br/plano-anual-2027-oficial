import { useState, useMemo } from "react";
import { PlusCircle, Pencil, Trash2, Search, FileDown, FileSpreadsheet, ArrowRightLeft, Loader2, Undo2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DesfazerTransferenciaDialog } from "@/components/common/DesfazerTransferenciaDialog.tsx";

import { Button } from "@/components/ui/button.tsx";
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
import { CATEGORIAS_ITEM_PREDEFINIDAS, UNIDADES_ITEM_PREDEFINIDAS } from "@/lib/catalogMetadata.ts";
import { 
  createItemCatalogoAndDistribuir,
  updateItemCatalogoAdmin,
  deleteItemCatalogoAdmin,
  deleteItensCatalogoBulkAdmin,
  getDiretorias,
  getTodasGerencias,
  transferirCategoriaAquisicao,
  transferirSolicitacoesParaGerenciaBulk,
  supabase
} from "@/lib/services.ts";
import getItensCatalogo from "@/lib/services.ts";

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
type ItemCatalogo = {
  id: string;
  codigo: number;
  descricao: string;
  categoria: string;
  unidade: string;
  valor_unitario: number;
  created_at?: string;
};

// ==================== COMPONENTE PRINCIPAL ====================
export function AdminCatalogItemControl() {
  const queryClient = useQueryClient();

  // Estados para os diálogos
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemCatalogo | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItemCatalogo | null>(null);
  
  // Estados de busca e seleção
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Estados de loading
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState("");
  const [bulkEditValue, setBulkEditValue] = useState("");
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Formulário de criação
  const [novoItem, setNovoItem] = useState({
    codigo: "",
    descricao: "",
    categoria: "",
    unidade: "",
    valorUnitario: "",
  });

  // Formulário de edição
  const [editFormData, setEditFormData] = useState({
    codigo: "",
    descricao: "",
    categoria: "",
    unidade: "",
    valorUnitario: "",
  });

  // Buscar itens do catálogo
  const { data: itens = [], isLoading, refetch: refetchItens } = useQuery({
    queryKey: ["itens-catalogo"],
    queryFn: getItensCatalogo,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar diretorias
  const { data: diretorias = [] } = useQuery<any[]>({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
    staleTime: 10 * 60 * 1000,
  });

  // Buscar todas as gerências
  const { data: todasGerencias = [] } = useQuery<any[]>({
    queryKey: ["todas-gerencias"],
    queryFn: getTodasGerencias,
    staleTime: 5 * 60 * 1000,
  });

  // Estado do diálogo de transferência
  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    modo: "categoria" | "bulk" | "item";
    selectedCategoria: string;
    selectedCategorias?: string[];
    item: ItemCatalogo | null;
    sourceDiretoriaId?: string;
    targetDiretoriaId: string;
    targetDiretoriaIds?: string[];
    targetGerenciaId: string;
    incluirCustoFinanceiro?: boolean;
    loading: boolean;
  }>({
    open: false,
    modo: "categoria",
    selectedCategoria: "",
    selectedCategorias: [],
    item: null,
    sourceDiretoriaId: "",
    targetDiretoriaId: "",
    targetDiretoriaIds: [],
    targetGerenciaId: "",
    incluirCustoFinanceiro: true,
    loading: false,
  });

  const [filtroCategoriaAdminTransfer, setFiltroCategoriaAdminTransfer] = useState("");
  const [desfazerTransferOpen, setDesfazerTransferOpen] = useState(false);

  // Deduplica itens por código único para proteger contra duplicações na planilha/banco
  const uniqueItens = useMemo(() => {
    const seen = new Set<number>();
    return (itens as ItemCatalogo[]).filter(item => {
      const cod = Number(item.codigo);
      if (!isNaN(cod) && cod > 0) {
        if (seen.has(cod)) return false;
        seen.add(cod);
      }
      return true;
    });
  }, [itens]);

  const categoriasCatalogo = useMemo(() => {
    const set = new Set<string>();
    uniqueItens.forEach((i) => {
      if (i.categoria && i.categoria.trim()) set.add(i.categoria.trim());
    });
    CATEGORIAS_ITEM_PREDEFINIDAS.forEach(c => {
      if (c && c.trim()) set.add(c.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [uniqueItens]);

  const todasCategoriasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    categoriasCatalogo.forEach(c => set.add(c));
    CATEGORIAS_ITEM_PREDEFINIDAS.forEach(c => {
      if (c && c.trim()) set.add(c.trim());
    });
    if (editFormData?.categoria && editFormData.categoria.trim()) {
      set.add(editFormData.categoria.trim());
    }
    if (novoItem?.categoria && novoItem.categoria.trim()) {
      set.add(novoItem.categoria.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categoriasCatalogo, editFormData?.categoria, novoItem?.categoria]);

  const todasUnidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    UNIDADES_ITEM_PREDEFINIDAS.forEach(u => set.add(u));
    uniqueItens.forEach((i) => {
      if (i.unidade && i.unidade.trim()) set.add(i.unidade.trim().toUpperCase());
    });
    if (editFormData?.unidade && editFormData.unidade.trim()) {
      set.add(editFormData.unidade.trim().toUpperCase());
    }
    if (novoItem?.unidade && novoItem.unidade.trim()) {
      set.add(novoItem.unidade.trim().toUpperCase());
    }
    return Array.from(set).sort();
  }, [uniqueItens, editFormData?.unidade, novoItem?.unidade]);

  const gerenciasAlvo = useMemo(() => {
    if (!transferDialog.targetDiretoriaId) return todasGerencias;
    const gers = (todasGerencias as any[]).filter(g => g.diretoria_id === transferDialog.targetDiretoriaId);
    return gers.length > 0 ? gers : (todasGerencias as any[]);
  }, [transferDialog.targetDiretoriaId, todasGerencias]);

  const handleOpenCategoriaTransfer = () => {
    const firstDir = (diretorias as any[])[0]?.id || "";
    const secondDir = (diretorias as any[])[1]?.id || firstDir;
    const gers = (todasGerencias as any[]).filter(g => g.diretoria_id === secondDir);
    setFiltroCategoriaAdminTransfer("");
    setTransferDialog({
      open: true,
      modo: "categoria",
      selectedCategoria: categoriasCatalogo[0] || "",
      selectedCategorias: categoriasCatalogo[0] ? [categoriasCatalogo[0]] : [],
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
    const firstDir = (diretorias as any[])[0]?.id || "";
    const secondDir = (diretorias as any[])[1]?.id || firstDir;
    const gers = (todasGerencias as any[]).filter(g => g.diretoria_id === secondDir);
    setTransferDialog({
      open: true,
      modo: "bulk",
      selectedCategoria: "",
      item: null,
      sourceDiretoriaId: firstDir,
      targetDiretoriaId: secondDir,
      targetDiretoriaIds: [secondDir],
      targetGerenciaId: gers[0]?.id || "",
      incluirCustoFinanceiro: true,
      loading: false,
    });
  };

  const handleOpenItemTransfer = (item: ItemCatalogo) => {
    const firstDir = (diretorias as any[])[0]?.id || "";
    const secondDir = (diretorias as any[])[1]?.id || firstDir;
    const gers = (todasGerencias as any[]).filter(g => g.diretoria_id === secondDir);
    setTransferDialog({
      open: true,
      modo: "item",
      selectedCategoria: "",
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
    const { modo, selectedCategoria, selectedCategorias, item, sourceDiretoriaId, targetDiretoriaId, targetDiretoriaIds, targetGerenciaId, incluirCustoFinanceiro } = transferDialog;
    
    const targetDirIds = (targetDiretoriaIds && targetDiretoriaIds.length > 0)
      ? targetDiretoriaIds
      : targetDiretoriaId ? [targetDiretoriaId] : [];

    const finalCats = (selectedCategorias && selectedCategorias.length > 0)
      ? selectedCategorias
      : (selectedCategoria ? [selectedCategoria] : []);

    if (targetDirIds.length === 0) {
      toast.error("Selecione ao menos uma diretoria de destino.");
      return;
    }

    let finalTargetGerId = targetGerenciaId;
    if (!finalTargetGerId && targetDirIds.length > 0) {
      const gersDaDir = (todasGerencias as any[]).filter(g => g.diretoria_id === targetDirIds[0]);
      finalTargetGerId = gersDaDir[0]?.id || "";
    }

    if (modo !== "categoria" && !finalTargetGerId) {
      toast.error("Selecione a diretoria e gerência de destino.");
      return;
    }

    setTransferDialog(prev => ({ ...prev, loading: true }));
    const dirOrigemSigla = (diretorias as any[]).find(d => d.id === sourceDiretoriaId)?.sigla;
    const dirDestinoSigla = (diretorias as any[]).find(d => d.id === targetDirIds[0])?.sigla || "Diretoria";
    const gerDestinoSigla = (todasGerencias as any[]).find(g => g.id === finalTargetGerId)?.sigla || "Gerência";
    const tagOrigem = dirOrigemSigla || "ADMIN";

    const siglasDestino = targetDirIds
      .map(id => (diretorias as any[]).find(d => d.id === id)?.sigla)
      .filter(Boolean)
      .join(", ");

    try {
      if (modo === "categoria") {
        const comCusto = incluirCustoFinanceiro !== false;
        const res = await transferirCategoriaAquisicao({
          categoria: finalCats[0] || selectedCategoria,
          categorias: finalCats,
          sourceDiretoriaId: sourceDiretoriaId || undefined,
          targetDiretoriaId: targetDirIds[0],
          targetDiretoriaIds: targetDirIds,
          targetGerenciaId: finalTargetGerId,
          origemSigla: tagOrigem,
          incluirCustoFinanceiro: comCusto,
        });

        await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
        for (const dirId of targetDirIds) {
          await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", dirId] });
        }

        const catsLabel = finalCats.length === 1 ? `"${finalCats[0]}"` : `${finalCats.length} categorias (${finalCats.join(", ")})`;
        if (comCusto) {
          toast.success(`Categoria(s) ${catsLabel} (${res.count} itens, ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(res.totalValor)}) transferida(s) com custo financeiro para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla}.`);
        } else {
          toast.success(`Categoria(s) ${catsLabel} (${res.count} itens) disponibilizada(s) para a(s) Diretoria(s) ${siglasDestino || dirDestinoSigla} SEM custo financeiro.`);
        }
      } else {
        const itemsToTransfer: ItemCatalogo[] = modo === "item" && item
          ? [item]
          : uniqueItens.filter(i => selectedIds.includes(i.id));

        const codigos = itemsToTransfer.map(i => i.codigo);

        let query = supabase.from("solicitacoes").select("id, codigo");
        if (sourceDiretoriaId) {
          query = query.eq("diretoria_id", sourceDiretoriaId);
        }
        query = query.in("codigo", codigos);

        const { data: existingSols } = await query;

        const solIds = (existingSols || []).map((s: any) => s.id);
        if (solIds.length > 0) {
          await transferirSolicitacoesParaGerenciaBulk(solIds, targetGerenciaId, targetDiretoriaId, tagOrigem);
        }

        setSelectedIds([]);
        await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
        toast.success(`${itemsToTransfer.length} item(ns) transferido(s)${dirOrigemSigla ? ` de ${dirOrigemSigla}` : ""} para a Diretoria ${dirDestinoSigla} (${gerDestinoSigla}) com sucesso.`);
      }

      setTransferDialog(prev => ({ ...prev, open: false, loading: false }));
    } catch (err: any) {
      console.error("Erro na transferência (Admin):", err);
      toast.error(err?.message || "Erro ao transferir item/categoria.");
      setTransferDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // Filtrar itens
  const filteredItens = useMemo(() => {
    if (!searchTerm) return uniqueItens;
    const term = searchTerm.toLowerCase();
    return uniqueItens.filter(item => 
      String(item.codigo).toLowerCase().includes(term) ||
      item.descricao.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term)
    );
  }, [uniqueItens, searchTerm]);

  const { sortedItems, requestSort, sortConfig } = useSortableTable(filteredItens as ItemCatalogo[]);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = (sortedItems as ItemCatalogo[]).slice(startIdx, endIdx);
    return { totalPages, currentPage, paginatedItems, totalFiltered: sortedItems.length };
  }, [sortedItems, currentPage]);

  const summary = useMemo(() => {
    const totalItens = uniqueItens.length;
    const somaValores = uniqueItens.reduce((acc, item) => acc + (item.valor_unitario || 0), 0);
    const mediaValor = totalItens > 0 ? somaValores / totalItens : 0;
    
    return {
      totalItens,
      mediaValor,
      somaTotal: somaValores,
    };
  }, [uniqueItens]);

  const resetForm = () => {
    setNovoItem({ codigo: "", descricao: "", categoria: "", unidade: "", valorUnitario: "" });
  };

  const resetEditForm = () => {
    setEditFormData({ codigo: "", descricao: "", categoria: "", unidade: "", valorUnitario: "" });
  };

  const handleCreate = async () => {
    if (!novoItem.codigo || !novoItem.descricao || !novoItem.categoria || !novoItem.unidade || !novoItem.valorUnitario) {
      toast.error("Preencha todos os campos do novo item.");
      return;
    }

    setIsCreating(true);
    try {
      await createItemCatalogoAndDistribuir({
        codigo: Number(novoItem.codigo),
        descricao: novoItem.descricao.trim(),
        categoria: novoItem.categoria,
        unidade: novoItem.unidade,
        valorUnitario: Number(novoItem.valorUnitario),
      });

      resetForm();
      setCreateDialogOpen(false);
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast.success("Item criado e distribuído com sucesso.");
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : String(error || "");
      const message = rawMessage.includes("duplicate")
        ? "Código já existe no catálogo. Informe outro código."
        : rawMessage.includes("Sessão admin não encontrada")
          ? "Sessão admin expirada. Entre novamente no painel admin."
          : rawMessage.includes("Edge Function")
            ? "A função de cadastro retornou erro."
            : rawMessage || "Não foi possível criar o item.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (item: ItemCatalogo) => {
    setEditingItem(item);
    setEditFormData({
      codigo: String(item.codigo),
      descricao: item.descricao,
      categoria: item.categoria,
      unidade: item.unidade,
      valorUnitario: String(item.valor_unitario),
    });
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    if (!editFormData.codigo || !editFormData.descricao || !editFormData.categoria || !editFormData.unidade || !editFormData.valorUnitario) {
      toast.error("Preencha todos os campos.");
      return;
    }

    setIsUpdating(true);
    try {
      await updateItemCatalogoAdmin(editingItem.id, {
        codigo: Number(editFormData.codigo),
        descricao: editFormData.descricao.trim(),
        categoria: editFormData.categoria,
        unidade: editFormData.unidade,
        valor_unitario: Number(editFormData.valorUnitario),
      });

      setEditingItem(null);
      resetEditForm();
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast.success("Item atualizado com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o item.";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      await deleteItemCatalogoAdmin(deletingItem.id, deletingItem.codigo);
      setDeletingItem(null);
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast.success("Item removido com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível remover o item.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} itens? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      const selectedCodigos = selectedIds.map(id => {
        const it = (uniqueItens as ItemCatalogo[]).find(item => item.id === id);
        return it ? it.codigo : undefined;
      }).filter((c): c is number => c !== undefined && c > 0);

      await deleteItensCatalogoBulkAdmin(selectedIds, selectedCodigos);
      setSelectedIds([]);
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast.success(`${selectedIds.length} itens removidos com sucesso.`);
    } catch (_error: unknown) {
      toast.error("Ocorreu um erro ao excluir um ou mais itens.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkEdit = async () => {
    if (selectedIds.length === 0 || !bulkEditField || !bulkEditValue) return;

    setIsUpdatingBulk(true);
    try {
      const updates: any = {};
      if (bulkEditField === "categoria") updates.categoria = bulkEditValue;
      if (bulkEditField === "unidade") updates.unidade = bulkEditValue;
      if (bulkEditField === "valorUnitario") updates.valor_unitario = Number(bulkEditValue);

      await Promise.all(selectedIds.map(id => updateItemCatalogoAdmin(id, updates)));
      
      setBulkEditOpen(false);
      setBulkEditField("");
      setBulkEditValue("");
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      toast.success(`${selectedIds.length} itens atualizados com sucesso.`);
    } catch (_error: unknown) {
      toast.error("Ocorreu um erro ao atualizar um ou mais itens.");
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    const allIds = (sortedItems as ItemCatalogo[]).map(item => item.id);
    const allSelected = allIds.length > 0 && allIds.every((id: string) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExportExcel = async () => {
    // @ts-ignore
    const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js");
    const XLSX = xlsxModule.default ?? xlsxModule;
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    wsData.push([`Plano Anual de Contratações 2027 — Catálogo de Aquisições`]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);
    wsData.push(["Código", "Descrição", "Categoria", "Unidade", "Valor Unitário"]);

    (filteredItens as any[]).forEach((item) => {
      wsData.push([
        item.codigo,
        item.descricao,
        item.categoria,
        item.unidade,
        item.valor_unitario
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 10 }, { wch: 45 }, { wch: 20 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, `PAC_2027_Catalogo_Aquisicoes_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", format: "a4" });
    doc.setFontSize(14);
    doc.text(`PAC 2027 — Catálogo de Aquisições`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);
    
    const formatCurrency = (value?: number) =>
      value != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
        : "—";

    autoTable(doc, {
      head: [["Cód.", "Descrição", "Categoria", "Unid.", "Valor Unit."]],
      body: (filteredItens as any[]).map((item) => [
        item.codigo,
        item.descricao.length > 60 ? item.descricao.substring(0, 60) + "…" : item.descricao,
        item.categoria,
        item.unidade,
        formatCurrency(item.valor_unitario),
      ]) as any,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 254] },
    });
    doc.save(`PAC_2027_Catalogo_Aquisicoes_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Card principal com botão Novo Item */}
      <Card className="p-6 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Cadastrar novo item para o plano anual</h2>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Novo Item
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ao cadastrar, o item entra na lista e já é distribuído para todas as gerências ativas como rascunho.
        </p>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 flex flex-col justify-center relative overflow-hidden card-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 rounded-l-lg"></div>
          <p className="text-sm text-muted-foreground font-medium z-10">Total de Itens</p>
          <p className="text-3xl font-bold text-slate-800 z-10 mt-1">{summary.totalItens}</p>
        </Card>
        <Card className="p-6 flex flex-col justify-center relative overflow-hidden card-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 rounded-l-lg"></div>
          <p className="text-sm text-muted-foreground font-medium z-10">Média do Valor Unitário</p>
          <p className="text-2xl font-bold text-slate-800 z-10 mt-1">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary.mediaValor)}
          </p>
        </Card>
        <Card className="p-6 flex flex-col justify-center relative overflow-hidden card-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500 rounded-l-lg"></div>
          <p className="text-sm text-muted-foreground font-medium z-10">Soma</p>
          <p className="text-2xl font-bold text-slate-800 z-10 mt-1">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(summary.somaTotal)}
          </p>
        </Card>
      </div>

      {/* Lista de Itens */}
      <Card className="p-6 card-shadow">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Itens Cadastrados</h2>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item..."
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
                disabled={filteredItens.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4" />Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExportPDF}
                disabled={filteredItens.length === 0}
              >
                <FileDown className="h-4 w-4" />PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={handleOpenCategoriaTransfer}
                title="Transferir uma Categoria inteira para uma Diretoria"
              >
                <ArrowRightLeft className="h-4 w-4" />Transferir Categoria
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => setDesfazerTransferOpen(true)}
                title="Desfazer envio/transferência de categorias ou itens"
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
          <div className="text-center py-8 text-muted-foreground">Carregando itens...</div>
        ) : filteredItens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum item encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={sortedItems.length > 0 && (sortedItems as ItemCatalogo[]).every(item => selectedIds.includes(item.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos os itens"
                    />
                  </TableHead>
                  <SortableTableHead className="w-24 cursor-pointer hover:text-slate-900" field="codigo" sortConfig={sortConfig} onRequestSort={requestSort}>Código</SortableTableHead>
                  <SortableTableHead className="cursor-pointer hover:text-slate-900" field="descricao" sortConfig={sortConfig} onRequestSort={requestSort}>Descrição</SortableTableHead>
                  <SortableTableHead className="w-48 cursor-pointer hover:text-slate-900" field="categoria" sortConfig={sortConfig} onRequestSort={requestSort}>Categoria</SortableTableHead>
                  <SortableTableHead className="w-32 cursor-pointer hover:text-slate-900" field="unidade" sortConfig={sortConfig} onRequestSort={requestSort}>Unidade</SortableTableHead>
                  <SortableTableHead className="w-32 text-right cursor-pointer hover:text-slate-900" field="valor_unitario" sortConfig={sortConfig} onRequestSort={requestSort}>Valor Unitário</SortableTableHead>
                  <TableHead className="w-20 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginationData.paginatedItems.map((item) => (
                  <TableRow key={item.id} className={selectedIds.includes(item.id) ? "bg-muted/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        aria-label={`Selecionar item ${item.codigo}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{item.codigo}</TableCell>
                    <TableCell className="font-medium">{item.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.categoria}</Badge>
                    </TableCell>
                    <TableCell>{item.unidade}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                        .format(item.valor_unitario)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Transferir para Diretoria"
                          onClick={() => handleOpenItemTransfer(item)}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletingItem(item)}
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
          <div className="py-6 border-t mt-4">
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
                    <PaginationLink onClick={() => setCurrentPage(currentPage - 1)} className="cursor-pointer">
                      {currentPage - 1}
                    </PaginationLink>
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink isActive>{currentPage}</PaginationLink>
                </PaginationItem>
                {currentPage < paginationData.totalPages && (
                  <PaginationItem>
                    <PaginationLink onClick={() => setCurrentPage(currentPage + 1)} className="cursor-pointer">
                      {currentPage + 1}
                    </PaginationLink>
                  </PaginationItem>
                )}
                {currentPage < paginationData.totalPages - 1 && (
                  <PaginationItem><PaginationEllipsis /></PaginationItem>
                )}
                {currentPage < paginationData.totalPages - 1 && (
                  <PaginationItem>
                    <PaginationLink onClick={() => setCurrentPage(paginationData.totalPages)} className="cursor-pointer">
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
              Página {currentPage} de {paginationData.totalPages} • Exibindo {paginationData.totalFiltered} itens
            </div>
          </div>
        )}
      </Card>

      {/* ==================== DIALOG CRIAR ITEM ==================== */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Item</DialogTitle>
            <DialogDescription>
              Preencha os dados do item. Após cadastrado, ele entrará na lista para todas as gerências ativas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Código *</Label>
              <Input
                type="number"
                min={1}
                value={novoItem.codigo}
                onChange={(e) => setNovoItem(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="Ex: 99999"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Descrição *</Label>
              <Input
                value={novoItem.descricao}
                onChange={(e) => setNovoItem(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Nome do item"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Categoria *</Label>
              <Select
                value={novoItem.categoria}
                onValueChange={(value) => setNovoItem(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {todasCategoriasDisponiveis.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Unidade *</Label>
              <Select
                value={novoItem.unidade}
                onValueChange={(value) => setNovoItem(prev => ({ ...prev, unidade: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {todasUnidadesDisponiveis.map((uni) => (
                    <SelectItem key={uni} value={uni}>{uni}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Valor unitário (R$) *</Label>
              <CurrencyInput
                value={novoItem.valorUnitario}
                onChange={(e) => setNovoItem(prev => ({ ...prev, valorUnitario: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Cadastrando..." : "Cadastrar Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG EDITAR ITEM ==================== */}
      <Dialog open={!!editingItem} onOpenChange={(open) => {
        if (!open) {
          setEditingItem(null);
          resetEditForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>
              Altere os dados do item. As alterações serão aplicadas a todas as solicitações pendentes deste item.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Código *</Label>
              <Input
                type="number"
                min={1}
                value={editFormData.codigo}
                onChange={(e) => setEditFormData(prev => ({ ...prev, codigo: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Descrição *</Label>
              <Input
                value={editFormData.descricao}
                onChange={(e) => setEditFormData(prev => ({ ...prev, descricao: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Categoria *</Label>
              <Select
                value={editFormData.categoria}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {todasCategoriasDisponiveis.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Unidade *</Label>
              <Select
                value={editFormData.unidade}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, unidade: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {todasUnidadesDisponiveis.map((uni) => (
                    <SelectItem key={uni} value={uni}>{uni}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Valor unitário (R$) *</Label>
              <CurrencyInput
                value={editFormData.valorUnitario}
                onChange={(e) => setEditFormData(prev => ({ ...prev, valorUnitario: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG EXCLUIR ITEM ==================== */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir permanentemente o item <strong>{deletingItem?.codigo} - {deletingItem?.descricao}</strong>?
              <br/><br/>
              Esta ação não pode ser desfeita. Se o item já tiver sido solicitado por alguma gerência, a exclusão poderá falhar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)} disabled={isDeleting}>
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
            <DialogTitle>Editar {selectedIds.length} itens em lote</DialogTitle>
            <DialogDescription>
              Selecione o campo que deseja alterar para todos os itens selecionados.
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
                  <SelectItem value="categoria">Categoria</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                  <SelectItem value="valorUnitario">Valor Unitário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkEditField && (
              <div className="space-y-2">
                <Label>Novo valor</Label>
                {bulkEditField === "categoria" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_ITEM_PREDEFINIDAS.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : bulkEditField === "unidade" ? (
                  <Select value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES_ITEM_PREDEFINIDAS.map(uni => <SelectItem key={uni} value={uni}>{uni}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <CurrencyInput value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} />
                )}
              </div>
            )}
            <Button className="w-full" disabled={!bulkEditField || !bulkEditValue || isUpdatingBulk} onClick={handleBulkEdit}>
              {isUpdatingBulk ? "Salvando..." : "Aplicar a todos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG TRANSFERÊNCIA (ADMIN) ==================== */}
      <Dialog
        open={transferDialog.open}
        onOpenChange={(open) => !transferDialog.loading && setTransferDialog(prev => ({ ...prev, open }))}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
              {transferDialog.modo === "categoria"
                ? "Transferir Categoria para uma Diretoria"
                : transferDialog.modo === "bulk"
                ? `Transferir ${selectedIds.length} Itens para uma Diretoria`
                : "Transferir Item para uma Diretoria"}
            </DialogTitle>
            <DialogDescription>
              {transferDialog.modo === "categoria"
                ? "Transfere todos os itens e custo financeiro da categoria selecionada para a Diretoria e Gerência de destino."
                : "Transfere os itens selecionados e seus respectivos custos para a Diretoria e Gerência de destino."}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-4">
            {transferDialog.modo === "categoria" ? (
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
                          setTransferDialog(prev => ({
                            ...prev,
                            selectedCategorias: [...categoriasCatalogo],
                            selectedCategoria: categoriasCatalogo[0] || "",
                          }));
                        }}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Todas ({categoriasCatalogo.length})
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
                      value={filtroCategoriaAdminTransfer}
                      onChange={(e) => setFiltroCategoriaAdminTransfer(e.target.value)}
                      className="pl-8 h-8 text-xs bg-background"
                      disabled={transferDialog.loading}
                    />
                  </div>

                  {/* Lista com scroll e checkboxes */}
                  <div className="space-y-1 p-2 rounded-lg border bg-background max-h-40 overflow-y-auto">
                    {(() => {
                      const termo = filtroCategoriaAdminTransfer.trim().toLowerCase();
                      const categoriasFiltradas = categoriasCatalogo.filter(cat =>
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

                  const itensDasCats = uniqueItens.filter(
                    (i) => selectedSet.has((i.categoria || "").trim().toLowerCase())
                  );
                  const valorTotalCat = itensDasCats.reduce((acc, i) => acc + (i.valor_unitario || 0), 0);

                  return (
                    <div className="rounded border bg-blue-50/60 border-blue-200 p-2.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                      <span>
                        Selecionadas: <strong>{selectedList.length}</strong> | Total de itens: <strong>{itensDasCats.length}</strong>
                      </span>
                      <span>
                        Total referencial: <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotalCat)}</strong>
                      </span>
                    </div>
                  );
                })()}
              </div>
            ) : transferDialog.modo === "item" && transferDialog.item ? (
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Item Selecionado</p>
                <p className="font-medium text-foreground mt-0.5">
                  {transferDialog.item.codigo} - {transferDialog.item.descricao}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Categoria: {transferDialog.item.categoria} • Valor Unit.: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(transferDialog.item.valor_unitario)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase">Itens Selecionados</p>
                <p className="font-medium text-foreground mt-0.5">
                  {selectedIds.length} item(ns) de aquisição selecionado(s)
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
                  {(diretorias as any[]).map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      Diretoria {d.sigla} - {d.nome || d.sigla}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condições de Transferência (apenas para Categoria) */}
            {transferDialog.modo === "categoria" && (
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
                        name="condicaoFinanceiraAdmin"
                        checked={transferDialog.incluirCustoFinanceiro !== false}
                        onChange={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: true }))}
                        className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>1. Com Custo Financeiro</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 leading-relaxed">
                      Transfere os itens e o custo financeiro para a(s) diretoria(s) selecionada(s).
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
                        name="condicaoFinanceiraAdmin"
                        checked={transferDialog.incluirCustoFinanceiro === false}
                        onChange={() => setTransferDialog(prev => ({ ...prev, incluirCustoFinanceiro: false }))}
                        className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>2. Sem Custo Financeiro</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 leading-relaxed">
                      Disponibiliza a categoria e os itens nas diretorias de destino sem enviar o custo (zerado).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border/50 pt-3 space-y-4">
              {/* Para: Diretoria(s) de Destino */}
              {transferDialog.modo === "categoria" ? (
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
                                const gers = (todasGerencias as any[]).filter(g => g.diretoria_id === firstDir);
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
                            const curTargetDirObj = (diretorias as any[]).find(d => String(d.id) === String(curTargetDirId));
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
                        const gers = (todasGerencias as any[]).filter(g => g.diretoria_id === val);
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
                        {(diretorias as any[]).map(d => (
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
                          const curTargetDirObj = (diretorias as any[]).find(d => String(d.id) === String(curTargetDirId));
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
                (transferDialog.modo === "categoria" &&
                  (((transferDialog.selectedCategorias?.length || (transferDialog.selectedCategoria ? 1 : 0)) === 0) ||
                    ((transferDialog.targetDiretoriaIds?.length || 0) === 0 && !transferDialog.targetDiretoriaId))) ||
                (transferDialog.modo !== "categoria" && (!transferDialog.targetGerenciaId || !transferDialog.targetDiretoriaId))
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
        tipo="aquisicao"
        onSuccess={() => {
          refetchItens();
          queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
          queryClient.invalidateQueries({ queryKey: ["itens_catalogo"] });
        }}
      />
    </div>
  );
}

