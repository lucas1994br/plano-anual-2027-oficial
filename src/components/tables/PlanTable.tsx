 
import { useRef, useState } from "react";
import { MessageSquare, FileDown, FileSpreadsheet, Undo2, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover.tsx";
import { SortableTableHead } from "@/components/ui/sortable-table-head.tsx";
import { useSortableTable } from "@/hooks/useSortableTable.ts";
import { PlanItem } from "@/types/plan.ts";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade.ts";
// XLSX is loaded lazily inside the export handler to avoid bundling Node-only deps.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
interface PlanTableProps {
  items: PlanItem[];
  totalItems?: number;
  onUpdateQtdEstimada: (codigo: number, qtdEstimada: number) => void;
  onUpdateUnidade: (codigo: number, unidade: string) => void;
  onUpdateObservacao: (codigo: number, observacao: string) => void;
  onUpdatePrioridade: (codigo: number, prioridade: PlanItem["prioridade"]) => void;
  onDeleteItem?: (itemId: string) => void;
  onEditItem?: (item: PlanItem) => void;
  valorTotal?: number;
  selectedItems?: Set<string | number>;
  onToggleSelect?: (id: string | number) => void;
  onToggleSelectAll?: () => void;
}

import { Checkbox } from "@/components/ui/checkbox.tsx";

export function PlanTable({ items, totalItems, onUpdateQtdEstimada, onUpdateUnidade: _onUpdateUnidade, onUpdateObservacao, onUpdatePrioridade, onDeleteItem, onEditItem, valorTotal, selectedItems, onToggleSelect, onToggleSelectAll }: PlanTableProps) {
  const [editingCodigo, setEditingCodigo] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const _editInputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurSaveRef = useRef(false);
  const [observacaoText, setObservacaoText] = useState<string>("");
  const [observacaoOpen, setObservacaoOpen] = useState<number | null>(null);

  const { sortedItems, sortConfig, requestSort } = useSortableTable(items);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const _handleStartEdit = (item: PlanItem) => {
    setEditingCodigo(item.codigo);
    setEditValue(item.qtdEstimada === 0 ? "" : String(item.qtdEstimada));
  };

  const _handleConfirmEdit = (rawValue?: string) => {
    if (editingCodigo !== null) {
      const normalizedValue = (rawValue ?? editValue).replace(/^0+(?=\d)/, "");
      onUpdateQtdEstimada(editingCodigo, Number(normalizedValue || 0));
      setEditingCodigo(null);
    }
    skipBlurSaveRef.current = false;
  };

  const _handleCancelEdit = () => {
    setEditingCodigo(null);
    skipBlurSaveRef.current = false;
  };


  const handleOpenObservacao = (item: PlanItem) => {
    setObservacaoText(item.observacao || "");
    setObservacaoOpen(item.codigo);
  };

  const handleSaveObservacao = () => {
    if (observacaoOpen !== null) {
      onUpdateObservacao(observacaoOpen, observacaoText);
      setObservacaoOpen(null);
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: unknown[][] = [];

    const diretoriaName = items[0]?.diretoriaSigla ? `Diretoria: ${items[0].diretoriaSigla}` : "CAEMA";
    wsData.push(["Plano Anual de Contratações - PAC 2027"]);
    wsData.push([diretoriaName]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);

    const headers = ["Código", "Descrição", "Categoria", "Unidade", "Qtd. Estimada", "Valor Unitário", "Total Item", "Prioridade", "Gerência", "Observação"];
    wsData.push(headers);

    items.forEach((item) => {
      wsData.push([
        item.codigo, item.descricao, item.categoria, item.unidade,
        item.qtdEstimada, item.valorUnitario,
        item.qtdEstimada * item.valorUnitario,
        item.prioridade, item.gerencia, item.observacao || "",
      ]);
    });

    // Adicionar linha de total se valorTotal foi fornecido
    if (valorTotal !== undefined) {
      wsData.push([]);
      wsData.push(["", "", "", "", "", "", "", "", "VALOR TOTAL:", valorTotal]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 10 }, { wch: 40 }, { wch: 25 }, { wch: 10 }, { wch: 14 },
      { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
    ];

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
    ];

    const titleStyle = { font: { bold: true, sz: 16, color: { rgb: "1E3A5F" } }, alignment: { horizontal: "center" as const } };
    const subtitleStyle = { font: { bold: true, sz: 12, color: { rgb: "3B82F6" } }, alignment: { horizontal: "center" as const } };
    const dateStyle = { font: { sz: 10, color: { rgb: "666666" } }, alignment: { horizontal: "center" as const } };

    for (let c = 0; c <= 9; c++) {
      const cell0 = XLSX.utils.encode_cell({ r: 0, c });
      const cell1 = XLSX.utils.encode_cell({ r: 1, c });
      const cell2 = XLSX.utils.encode_cell({ r: 2, c });
      if (ws[cell0]) ws[cell0].s = titleStyle;
      if (ws[cell1]) ws[cell1].s = subtitleStyle;
      if (ws[cell2]) ws[cell2].s = dateStyle;
    }

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "3B82F6" } },
      alignment: { horizontal: "center" as const, vertical: "center" as const },
      border: { bottom: { style: "thin" as const, color: { rgb: "2563EB" } } },
    };
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 4, c });
      if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }

    const prioridadeColors: Record<string, string> = { Alta: "FECACA", Média: "FEF3C7", Baixa: "D1FAE5" };
    const prioridadeFontColors: Record<string, string> = { Alta: "DC2626", Média: "D97706", Baixa: "059669" };

    for (let r = 0; r < items.length; r++) {
      const rowIdx = r + 5;
      const item = items[r];

      const prioCell = XLSX.utils.encode_cell({ r: rowIdx, c: 6 });
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

      for (const c of [0, 3, 4, 8]) {
        const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
        if (ws[ref]) {
          ws[ref].s = { ...(ws[ref].s || {}), alignment: { horizontal: "center" as const } };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Plano Anual");
    const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `PAC_2027_${hoje}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Plano Anual de Contratações - PAC 2027", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);

    const tableData = items.map((item) => [
      item.codigo, item.descricao, item.categoria, item.unidade,
      item.qtdEstimada, formatCurrency(item.valorUnitario),
      formatCurrency(item.qtdEstimada * item.valorUnitario),
      item.prioridade, item.gerencia,
    ]);

    if (valorTotal !== undefined) {
      tableData.push(["", "", "", "", "", "", "", "VALOR TOTAL:", formatCurrency(valorTotal)]);
    }

    const getPrioridadeColor = (prioridade: string): [number, number, number] => {
      switch (prioridade) {
        case "Alta": return [239, 68, 68];
        case "Média": return [245, 158, 11];
        case "Baixa": return [37, 167, 132];
        default: return [100, 100, 100];
      }
    };

    autoTable(doc, {
      startY: 28,
      head: [["Cód.", "Descrição", "Categoria", "Unid.", "Qtd. Est.", "Valor Unit.", "Total Item", "Prior.", "Gerência"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 55 },
        2: { cellWidth: 40 },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
        6: { cellWidth: 28, halign: "right", fontStyle: "bold" },
        7: { cellWidth: 18, halign: "center" },
        8: { cellWidth: 22, halign: "center" },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: function (data) {
        if (data.column.index === 7 && data.section === 'body') {
          const prioridade = data.cell.raw as string;
          const color = getPrioridadeColor(prioridade);
          data.cell.styles.fillColor = color;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    doc.save(`PAC_2027_${hoje}.pdf`);
  };

  return (
    <div className="px-6 pb-6">
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-semibold text-foreground">
            {totalItems !== undefined ? totalItems : items.length} item(ns) encontrado(s)
          </h2>
          <span className="text-xs text-muted-foreground">
            Total: {formatCurrency(valorTotal || 0)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {onToggleSelectAll && (
                  <TableHead className="w-[40px] px-4 text-center">
                    <Checkbox
                      checked={items.length > 0 && items.filter(i => i.id).length > 0 && selectedItems?.size === items.filter(i => i.id).length}
                      onCheckedChange={onToggleSelectAll}
                      disabled={items.filter(i => i.id).length === 0}
                    />
                  </TableHead>
                )}
                <SortableTableHead className="w-[80px]" field="codigo" sortConfig={sortConfig} onRequestSort={requestSort}>Código</SortableTableHead>
                <SortableTableHead className="min-w-[200px]" field="descricao" sortConfig={sortConfig} onRequestSort={requestSort}>Descrição</SortableTableHead>
                <SortableTableHead className="text-center w-[90px]" field="unidade" sortConfig={sortConfig} onRequestSort={requestSort}>Unid.</SortableTableHead>
                <SortableTableHead className="text-center w-[100px]" field="qtdEstimada" sortConfig={sortConfig} onRequestSort={requestSort}>Quantidade</SortableTableHead>
                <SortableTableHead className="text-right w-[100px]" field="valorUnitario" sortConfig={sortConfig} onRequestSort={requestSort}>Valor Unit.</SortableTableHead>
                <TableHead className="text-right w-[110px]">Total Item</TableHead>
                <SortableTableHead className="text-center w-[100px]" field="prioridade" sortConfig={sortConfig} onRequestSort={requestSort}>Prioridade</SortableTableHead>
                <SortableTableHead className="text-center w-[80px]" field="gerencia" sortConfig={sortConfig} onRequestSort={requestSort}>Gerência</SortableTableHead>
                <TableHead className="text-center w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onToggleSelectAll ? 10 : 9} className="text-center py-8 text-muted-foreground">
                    Nenhum item encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((item) => (
                <TableRow key={item.codigo} className="hover:bg-muted/30">
                  {onToggleSelect && (
                    <TableCell className="px-4 text-center">
                      <Checkbox
                        checked={selectedItems?.has(item.id || item.codigo) || false}
                        onCheckedChange={() => onToggleSelect(item.id || item.codigo)}
                        disabled={!item.id}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium text-primary">
                    {item.codigo}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{item.descricao}</p>
                      <p className="text-xs text-primary">{item.categoria}</p>
                      {item.diretoriaOrcamentariaSigla && (
                        <p className="text-xs text-amber-700 mt-1">
                          Orçamento: {item.diretoriaOrcamentariaSigla} • {formatCurrency(item.qtdEstimada * item.valorUnitario)}
                        </p>
                      )}
                      {item.isOrcamentoCompartilhado && item.diretoriaSigla && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Item será analisado pela diretoria orçamentária {item.diretoriaOrcamentariaSigla}.
                        </p>
                      )}
                      {item.observacao && (
                        <p className="text-xs text-success mt-1 flex items-center gap-1">
                          💬 {item.observacao}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">{item.unidade}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      key={`${item.codigo}-${item.qtdEstimada}`}
                      type="number"
                      min="0"
                      defaultValue={item.qtdEstimada || ""}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val !== item.qtdEstimada && onUpdateQtdEstimada) {
                          onUpdateQtdEstimada(item.codigo, val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-20 h-8 text-center"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.valorUnitario)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {formatCurrency(item.qtdEstimada * item.valorUnitario)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Select
                      value={item.prioridade}
                      onValueChange={(value: PlanItem["prioridade"]) =>
                        onUpdatePrioridade(item.codigo, value)
                      }
                    >
                      <SelectTrigger className="h-8 w-[100px] mx-auto border-none bg-transparent p-0 justify-center">
                        <Badge variant={getPrioridadeBadgeVariant(item.prioridade) as "default" | "secondary" | "destructive" | "outline"} className="cursor-pointer">
                          {item.prioridade}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Baixa">Baixa</SelectItem>
                        <SelectItem value="Média">Média</SelectItem>
                        <SelectItem value="Alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{item.gerencia}</Badge>
                  </TableCell>
                  <TableCell className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      {onEditItem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Editar item"
                          onClick={() => onEditItem(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Popover
                        open={observacaoOpen === item.codigo}
                        onOpenChange={(open) => {
                          if (open) handleOpenObservacao(item);
                          else setObservacaoOpen(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Observação">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Observação</h4>
                            <Textarea
                              value={observacaoText}
                              onChange={(e) => setObservacaoText(e.target.value)}
                              placeholder="Digite a observação..."
                              rows={3}
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setObservacaoOpen(null)}>
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={handleSaveObservacao}>
                                Salvar
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      {onDeleteItem && item.id && item.status !== "rascunho" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          title="Devolver para Rascunho"
                          onClick={() => onDeleteItem(item.id!)}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                      {item.status && (
                        <Badge
                          variant={
                            item.status === "enviado" || item.status === "em_analise"
                              ? "secondary"
                              : item.status === "aprovado"
                              ? "success"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {item.status === "rascunho"
                            ? "Rascunho"
                            : item.status === "enviado"
                            ? "Enviado"
                            : item.status === "aprovado"
                            ? "Aprovado"
                            : item.status}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
