/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { Pencil, MessageSquare, FileDown, FileSpreadsheet, Check, X, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { PlanItem } from "@/types/plan.ts";
import { UNIDADES } from "@/data/mockData.ts";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade.ts";
// XLSX is loaded lazily inside the export handler to avoid bundling Node-only deps.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PlanTableProps {
  items: PlanItem[];
  onUpdateQtdEstimada: (codigo: number, qtdEstimada: number) => void;
  onUpdateUnidade: (codigo: number, unidade: string) => void;
  onUpdateObservacao: (codigo: number, observacao: string) => void;
  onUpdatePrioridade: (codigo: number, prioridade: PlanItem["prioridade"]) => void;
  onDeleteItem?: (itemId: string) => void;
  valorTotal?: number;
}

export function PlanTable({ items, onUpdateQtdEstimada, onUpdateUnidade, onUpdateObservacao, onUpdatePrioridade, onDeleteItem, valorTotal }: PlanTableProps) {
  const [editingCodigo, setEditingCodigo] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurSaveRef = useRef(false);
  const [observacaoText, setObservacaoText] = useState<string>("");
  const [observacaoOpen, setObservacaoOpen] = useState<number | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleStartEdit = (item: PlanItem) => {
    setEditingCodigo(item.codigo);
    setEditValue(item.qtdEstimada === 0 ? "" : String(item.qtdEstimada));
  };

  const handleConfirmEdit = (rawValue?: string) => {
    if (editingCodigo !== null) {
      const normalizedValue = (rawValue ?? editValue).replace(/^0+(?=\d)/, "");
      onUpdateQtdEstimada(editingCodigo, Number(normalizedValue || 0));
      setEditingCodigo(null);
    }
    skipBlurSaveRef.current = false;
  };

  const handleCancelEdit = () => {
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

  const handleExportExcel = async () => {
    const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js");
    const XLSX = (xlsxModule as any).default ?? xlsxModule;
    const wb = XLSX.utils.book_new();
    const wsData: unknown[][] = [];

    wsData.push(["Plano Anual de Contratações - PAC 2027"]);
    wsData.push(["Diretoria de Comercialização"]);
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
      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">
            Itens do Plano ({items.length})
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead className="min-w-[200px]">Descrição</TableHead>
                <TableHead className="text-center w-[90px]">Unid.</TableHead>
                <TableHead className="text-center w-[100px]">Quantidade</TableHead>
                <TableHead className="text-right w-[100px]">Valor Unit.</TableHead>
                <TableHead className="text-right w-[110px]">Total Item</TableHead>
                <TableHead className="text-center w-[100px]">Prioridade</TableHead>
                <TableHead className="text-center w-[80px]">Gerência</TableHead>
                <TableHead className="text-center w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.codigo} className="hover:bg-muted/30">
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
                    {editingCodigo === item.codigo ? (
                      <Input
                        ref={editInputRef}
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const normalized = raw.replace(/^0+(?=\d)/, "");
                          setEditValue(normalized);
                        }}
                        onBlur={() => {
                          if (skipBlurSaveRef.current) {
                            skipBlurSaveRef.current = false;
                            return;
                          }
                          handleConfirmEdit(editInputRef.current?.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleConfirmEdit((e.currentTarget as HTMLInputElement).value);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        className="w-20 h-8 text-center"
                        autoFocus
                      />
                    ) : (
                      item.qtdEstimada
                    )}
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
                        <Badge variant={getPrioridadeBadgeVariant(item.prioridade) as any} className="cursor-pointer">
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
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {editingCodigo === item.codigo ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-success"
                            title="Salvar"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              skipBlurSaveRef.current = true;
                            }}
                            onClick={() => handleConfirmEdit(editInputRef.current?.value)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onMouseDown={() => {
                              skipBlurSaveRef.current = true;
                            }}
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Popover
                            open={observacaoOpen === item.codigo}
                            onOpenChange={(open) => {
                              if (open) handleOpenObservacao(item);
                              else setObservacaoOpen(null);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                          {item.status === "rascunho" && onDeleteItem && item.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Excluir item"
                              onClick={() => onDeleteItem(item.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
