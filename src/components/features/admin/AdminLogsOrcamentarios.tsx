import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Eye, FileSpreadsheet, Trash2, MoreHorizontal, FileDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { SortableTableHead } from "@/components/ui/sortable-table-head.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination.tsx";
import { useSortableTable } from "@/hooks/useSortableTable.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { toast } from "sonner";
import { getLogsOrcamentarios, deleteLogOrcamentario, deleteLogsOrcamentarioBulk } from "@/lib/services.ts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

type LogOrcamentario = {
  id: string;
  acao: string;
  valor: number;
  referencia_tipo: string;
  referencia_id: string;
  created_at: string;
  ano: number;
  centro_custo?: {
    codigo: string;
    nome: string;
  };
  [key: string]: unknown;
};

export function AdminLogsOrcamentarios() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<LogOrcamentario | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["logs-orcamentarios"],
    queryFn: getLogsOrcamentarios,
  });

  const getActionBadgeColor = (acao: string) => {
    switch (acao) {
      case "reservar":
        return "bg-amber-100 text-amber-800";
      case "executar":
        return "bg-green-100 text-green-800";
      case "estornar_reserva":
      case "estornar_execucao":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getActionFriendlyName = (acao: string) => {
    switch (acao) {
      case "reservar": return "Reserva Orçamentária";
      case "executar": return "Execução (Pagamento)";
      case "estornar_reserva": return "Estorno de Reserva";
      case "estornar_execucao": return "Estorno de Execução";
      default: return acao;
    }
  };

  const getRefTypeFriendly = (refType: string) => {
    switch (refType) {
      case "solicitacao_compra": return "Solicitação";
      case "plano_item": return "Item do Plano";
      case "compra": return "Compra";
      default: return refType;
    }
  };

  const filteredLogs = logs.filter((log: LogOrcamentario) => {
    const term = searchTerm.toLowerCase();
    const ccText = log.centro_custo ? `${log.centro_custo.codigo} - ${log.centro_custo.nome}`.toLowerCase() : "";
    return (
      ccText.includes(term) ||
      log.acao.toLowerCase().includes(term) ||
      log.referencia_tipo.toLowerCase().includes(term) ||
      (log.referencia_id && log.referencia_id.toLowerCase().includes(term))
    );
  });

  const { sortedItems, requestSort, sortConfig } = useSortableTable(filteredLogs);

  const paginationData = React.useMemo(() => {
    const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = sortedItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    return {
      paginatedItems,
      totalPages,
      totalFiltered: sortedItems.length
    };
  }, [sortedItems, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const toggleSelectAll = () => {
    const paginatedIds = paginationData.paginatedItems.map((log: LogOrcamentario) => log.id);
    const allSelected = paginatedIds.length > 0 && paginatedIds.every((id: string) => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !paginatedIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const newSet = new Set([...prev, ...paginatedIds]);
        return Array.from(newSet);
      });
    }
  };

  const toggleSelectLog = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Funções de CRUD
  const deleteMutation = useMutation({
    mutationFn: deleteLogOrcamentario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-orcamentarios"] });
      toast.success("Log orçamentário excluído com sucesso");
      setSelectedIds([]);
    },
    onError: () => toast.error("Erro ao excluir log")
  });

  const deleteBulkMutation = useMutation({
    mutationFn: deleteLogsOrcamentarioBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-orcamentarios"] });
      toast.success(`${selectedIds.length} logs orçamentários excluídos com sucesso`);
      setSelectedIds([]);
    },
    onError: () => toast.error("Erro ao excluir logs")
  });

  // Funções de Exportação
  const exportToExcel = () => {
    try {
      const dataToExport = filteredLogs.map((log: LogOrcamentario) => ({
        "Data/Hora": format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
        "Centro de Custo": log.centro_custo ? `${log.centro_custo.codigo} - ${log.centro_custo.nome}` : "-",
        "Ação": getActionFriendlyName(log.acao),
        "Valor (R$)": log.valor,
        "Referência (Tipo)": getRefTypeFriendly(log.referencia_tipo),
        "Referência (ID)": log.referencia_id,
        "Ano Base": log.ano
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Log Orçamentário");
      XLSX.writeFile(workbook, `Trilha_Orcamentaria_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
      toast.success("Relatório Excel exportado com sucesso");
    } catch (_e) {
      toast.error("Erro ao exportar Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text("Trilha Financeira (Log Orçamentário)", 14, 15);
      
      const tableColumn = ["Data/Hora", "Centro de Custo", "Ação", "Referência", "Valor (R$)"];
      const tableRows = filteredLogs.map((log: LogOrcamentario) => {
        return [
          format(new Date(log.created_at), "dd/MM/yyyy"),
          log.centro_custo ? log.centro_custo.codigo : "-",
          getActionFriendlyName(log.acao),
          getRefTypeFriendly(log.referencia_tipo),
          formatCurrency(log.valor)
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
      });

      doc.save(`Trilha_Orcamentaria_${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.success("Relatório PDF exportado com sucesso");
    } catch (_e) {
      toast.error("Erro ao exportar PDF");
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Trilha Financeira</h2>
          <p className="text-muted-foreground">
            Monitoramento de reservas, execuções e estornos do orçamento.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar CC, referência ou ação..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="flex items-center gap-2" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button variant="outline" className="flex items-center gap-2" onClick={exportToPDF}>
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-muted p-2 rounded-md mb-4 flex items-center justify-between">
          <span className="text-sm ml-2 font-medium">
            {selectedIds.length} item(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8 flex items-center gap-1"
              onClick={() => deleteBulkMutation.mutate(selectedIds)}
              disabled={deleteBulkMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Excluir Selecionados
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={paginationData.paginatedItems.length > 0 && paginationData.paginatedItems.every((log: LogOrcamentario) => selectedIds.includes(log.id))}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="created_at" sortConfig={sortConfig} onRequestSort={requestSort}>Data</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="centro_custo" sortConfig={sortConfig} onRequestSort={requestSort}>Centro de Custo</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="acao" sortConfig={sortConfig} onRequestSort={requestSort}>Ação</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="referencia_tipo" sortConfig={sortConfig} onRequestSort={requestSort}>Referência</SortableTableHead>
              <SortableTableHead className="text-right cursor-pointer hover:text-slate-900" field="valor" sortConfig={sortConfig} onRequestSort={requestSort}>Valor</SortableTableHead>
              <TableHead className="text-right">Opções</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingLogs ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  Carregando log financeiro...
                </TableCell>
              </TableRow>
            ) : paginationData.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  Nenhuma movimentação financeira encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginationData.paginatedItems.map((log: LogOrcamentario) => (
                <TableRow key={log.id} data-state={selectedIds.includes(log.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(log.id)}
                      onCheckedChange={() => toggleSelectLog(log.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">
                        {log.centro_custo ? log.centro_custo.codigo : "-"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {log.centro_custo ? log.centro_custo.nome : "Centro de custo não encontrado"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionBadgeColor(log.acao)}>
                      {getActionFriendlyName(log.acao)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {getRefTypeFriendly(log.referencia_tipo)}
                      </span>
                      <span className="text-xs text-muted-foreground max-w-[120px] truncate" title={log.referencia_id}>
                        {log.referencia_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-600">
                    {formatCurrency(log.valor)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem 
                          onSelect={() => {
                            setTimeout(() => setSelectedLog(log), 150);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-600 focus:bg-red-50 focus:text-red-600"
                          onClick={() => deleteMutation.mutate(log.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir Registro
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {paginationData.totalPages > 1 && (
        <div className="py-4 border-t mt-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground ml-2">
            Página {currentPage} de {paginationData.totalPages} • Exibindo {paginationData.totalFiltered} registros
          </span>
          <Pagination className="w-auto mx-0">
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
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(Math.min(paginationData.totalPages, currentPage + 1))}
                  className={currentPage === paginationData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Movimentação Financeira</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold">Tipo de Movimentação</p>
                  <Badge variant="outline" className={`mt-1 ${getActionBadgeColor(selectedLog.acao)}`}>
                    {getActionFriendlyName(selectedLog.acao)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold">Valor</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">
                    {formatCurrency(selectedLog.valor)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Data da Operação</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Ano Base</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedLog.ano}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-semibold mb-2">Origem da Movimentação</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Centro de Custo</p>
                    <p className="text-sm font-medium">
                      {selectedLog.centro_custo ? `${selectedLog.centro_custo.codigo} - ${selectedLog.centro_custo.nome}` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo de Referência</p>
                    <p className="text-sm font-medium">
                      {getRefTypeFriendly(selectedLog.referencia_tipo)}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">ID da Referência (Sistema)</p>
                  <code className="text-xs bg-muted p-1 rounded mt-1 block">
                    {selectedLog.referencia_id}
                  </code>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">ID do Registro (Auditoria)</p>
                  <code className="text-xs bg-muted p-1 rounded mt-1 block">
                    {selectedLog.id}
                  </code>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
