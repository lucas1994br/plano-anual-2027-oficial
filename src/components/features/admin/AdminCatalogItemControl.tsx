import { useState, useMemo } from "react";
import { PlusCircle, Pencil, Trash2, Search, FileDown, FileSpreadsheet } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

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
import { SortableTableHead } from "@/components/ui/sortable-table-head.tsx";
import { useSortableTable } from "@/hooks/useSortableTable.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { CATEGORIAS_ITEM_PREDEFINIDAS, UNIDADES_ITEM_PREDEFINIDAS } from "@/lib/catalogMetadata.ts";
import { 
  createItemCatalogoAndDistribuir,
  updateItemCatalogoAdmin,
  deleteItemCatalogoAdmin 
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

  // Filtrar itens
  const filteredItens = useMemo(() => {
    if (!searchTerm) return itens;
    const term = searchTerm.toLowerCase();
    return (itens as ItemCatalogo[]).filter(item => 
      String(item.codigo).toLowerCase().includes(term) ||
      item.descricao.toLowerCase().includes(term) ||
      item.categoria.toLowerCase().includes(term)
    );
  }, [itens, searchTerm]);

  const { sortedItems, requestSort, sortConfig } = useSortableTable(filteredItens as ItemCatalogo[]);

  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedItems = sortedItems.slice(startIdx, endIdx);
    return { totalPages, currentPage, paginatedItems, totalFiltered: sortedItems.length };
  }, [sortedItems, currentPage]);

  const summary = useMemo(() => {
    const totalItens = itens.length;
    const somaValores = (itens as ItemCatalogo[]).reduce((acc, item) => acc + (item.valor_unitario || 0), 0);
    const mediaValor = totalItens > 0 ? somaValores / totalItens : 0;
    
    return {
      totalItens,
      mediaValor,
      somaTotal: somaValores,
    };
  }, [itens]);

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
      await deleteItemCatalogoAdmin(deletingItem.id);
      setDeletingItem(null);
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
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
      await Promise.all(selectedIds.map(id => deleteItemCatalogoAdmin(id)));
      setSelectedIds([]);
      await refetchItens();
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
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
      const updates: Partial<ItemCatalogo> = {};
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
      toast.success(`${selectedIds.length} itens atualizados com sucesso.`);
    } catch (_error: unknown) {
      toast.error("Ocorreu um erro ao atualizar um ou mais itens.");
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginationData.paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginationData.paginatedItems.map((item: ItemCatalogo) => item.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: (string | number | undefined)[][] = [];

    wsData.push([`Plano Anual de Contratações 2027 — Catálogo de Aquisições`]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);
    wsData.push(["Código", "Descrição", "Categoria", "Unidade", "Valor Unitário"]);

    (filteredItens as ItemCatalogo[]).forEach((item) => {
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
      body: (filteredItens as ItemCatalogo[]).map((item) => [
        item.codigo,
        item.descricao.length > 60 ? item.descricao.substring(0, 60) + "…" : item.descricao,
        item.categoria,
        item.unidade,
        formatCurrency(item.valor_unitario),
      ]) as import("jspdf-autotable").RowInput[],
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
                  setSelectedIds([]);
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
            </div>
            {selectedIds.length > 0 && (
              <>
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
                      checked={selectedIds.length === paginationData.paginatedItems.length && paginationData.paginatedItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos os itens da página"
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
                {paginationData.paginatedItems.map((item: ItemCatalogo) => (
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
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_ITEM_PREDEFINIDAS.map((cat) => (
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
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_ITEM_PREDEFINIDAS.map((uni) => (
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_ITEM_PREDEFINIDAS.map((cat) => (
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_ITEM_PREDEFINIDAS.map((uni) => (
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
    </div>
  );
}

