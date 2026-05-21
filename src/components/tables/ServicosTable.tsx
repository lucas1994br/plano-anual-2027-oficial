import { useState } from "react";
import { MessageSquare, FileDown, FileSpreadsheet, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { useToast } from "@/hooks/use-toast.ts";
import { useQueryClient } from "@tanstack/react-query";
import { deleteServico } from "@/lib/services.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { ServicoItem, GrauPrioridade } from "@/types/plan.ts";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade.ts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ServicosTableProps {
  servicos: ServicoItem[];
  onUpdateGrauPrioridade: (item: number, grauPrioridade: GrauPrioridade) => void;
  onUpdateObservacao: (item: number, observacao: string) => void;
}

export function ServicosTable({ servicos, onUpdateGrauPrioridade, onUpdateObservacao }: ServicosTableProps) {
  const [observacaoText, setObservacaoText] = useState<string>("");
  const [observacaoOpen, setObservacaoOpen] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formatCurrency = (value?: number) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handleDeleteServico = async (servicoId: string) => {
    if (!confirm("Excluir este serviço permanentemente?")) return;

    try {
      await deleteServico(servicoId);
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast({ title: "Serviço excluído", description: "Serviço removido com sucesso." });
    } catch (_error) {
      toast({ title: "Erro", description: "Não foi possível excluir o serviço.", variant: "destructive" });
    }
  };

  const handleOpenObservacao = (servico: ServicoItem) => {
    setObservacaoText(servico.observacao || "");
    setObservacaoOpen(servico.item);
  };

  const handleSaveObservacao = () => {
    if (observacaoOpen !== null) {
      onUpdateObservacao(observacaoOpen, observacaoText);
      setObservacaoOpen(null);
    }
  };

  const handleExportExcel = async () => {
    // @ts-ignore
    const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js");
    type ExcelModule = {
      utils: {
        book_new: () => unknown;
        aoa_to_sheet: (data: unknown[][]) => unknown;
        book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
      };
      writeFile: (wb: unknown, filename: string) => void;
    };
    const XLSX = (((xlsxModule as { default?: unknown }).default ?? xlsxModule) as ExcelModule);
    const wb = XLSX.utils.book_new();
    const wsData: unknown[][] = [];

    wsData.push(["Plano Anual de Contratações - PAC 2027 (Serviços)"]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);

    const headers = [
      "Item",
      "Tipo de Contratação",
      "Unidade Demandante",
      "Objeto",
      "Justificativa",
      "Previsão Início",
      "Estimativa Valor",
      "Dotação Orçamentária",
      "Grau Prioridade",
      "Vinculação",
      "Observação"
    ];
    wsData.push(headers);

    servicos.forEach((s) => {
      wsData.push([
        s.item,
        s.tipoContratacao,
        s.unidadeDemandante,
        s.objeto,
        s.justificativa,
        s.previsaoInicio || "",
        s.estimativaValor || 0,
        s.dotacaoOrcamentaria || 0,
        s.grauPrioridade,
        s.vinculacao,
        s.observacao || ""
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData) as any;

    // Larguras das colunas
    const colWidths = [
      { wch: 8 },   // Item
      { wch: 20 },  // Tipo
      { wch: 20 },  // Unidade
      { wch: 40 },  // Objeto
      { wch: 40 },  // Justificativa
      { wch: 15 },  // Previsão
      { wch: 15 },  // Estimativa
      { wch: 15 },  // Dotação
      { wch: 15 },  // Prioridade
      { wch: 12 },  // Vinculação
      { wch: 30 }   // Observação
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Serviços");
    XLSX.writeFile(wb, `PAC_2027_Servicos_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4" });

    doc.setFontSize(16);
    doc.text("Plano Anual de Contratações 2027 - Serviços", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    const tableData = servicos.map((s) => [
      s.item,
      s.tipoContratacao,
      s.unidadeDemandante,
      s.objeto.substring(0, 40) + (s.objeto.length > 40 ? "..." : ""),
      formatCurrency(s.estimativaValor),
      s.grauPrioridade,
    ]);

    autoTable(doc, {
      head: [["Item", "Tipo", "Unidade", "Objeto", "Estimativa", "Prioridade"]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`PAC_2027_Servicos_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Botões de exportação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">Item</TableHead>
                <TableHead className="w-34">Tipo de Contratação</TableHead>
                <TableHead className="w-32">Unidade Demandante</TableHead>
                <TableHead className="min-w-[300px]">Objeto</TableHead>
                <TableHead className="w-34">Estimativa de Valor</TableHead>
                <TableHead className="w-32">Dotação Orcamentária</TableHead>
                <TableHead className="w-32">Prioridade</TableHead>
                <TableHead className="w-20 text-center">Justificativa</TableHead>
                <TableHead className="w-34 text-center">Vinculação com outro item</TableHead>
                <TableHead className="w-20 text-center">Obs</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum serviço cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                servicos.map((servico) => (
                  <TableRow key={servico.item} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{servico.item}</TableCell>
                    <TableCell className="text-sm">{servico.tipoContratacao}</TableCell>
                    <TableCell className="text-sm">{servico.unidadeDemandante}</TableCell>
                    <TableCell className="text-sm">
                      <div className="max-w-[300px] overflow-hidden text-ellipsis">
                        {servico.objeto}
                      </div>
                      {servico.justificativa && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {servico.justificativa}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(servico.estimativaValor)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCurrency(servico.dotacaoOrcamentaria)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={servico.grauPrioridade}
                        onValueChange={(value) => onUpdateGrauPrioridade(servico.item, value as GrauPrioridade)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            <Badge variant={getPrioridadeBadgeVariant(servico.grauPrioridade)}>
                              {servico.grauPrioridade}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Baixo">
                            <Badge variant="secondary">Baixo</Badge>
                          </SelectItem>
                          <SelectItem value="Médio">
                            <Badge variant="default">Médio</Badge>
                          </SelectItem>
                          <SelectItem value="Alto">
                            <Badge variant="warning">Alto</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Popover
                        open={observacaoOpen === servico.item}
                        onOpenChange={(open) => {
                          if (open) handleOpenObservacao(servico);
                          else setObservacaoOpen(null);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant={servico.observacao ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-3">
                            <h4 className="font-semibold">Observações - Item {servico.item}</h4>
                            <Textarea
                              placeholder="Adicione observações sobre este serviço..."
                              value={observacaoText}
                              onChange={(e) => setObservacaoText(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <Button onClick={handleSaveObservacao} size="sm" className="w-full">
                              Salvar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="text-right">
                      {servico.id ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteServico(servico.id!)}
                          title="Excluir serviço"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Resumo */}
      {servicos.length > 0 && (
        <div className="flex justify-end">
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between gap-6">
              <span className="text-sm text-muted-foreground">Total de Serviços:</span>
              <span className="font-semibold">{servicos.length}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-sm text-muted-foreground">Estimativa Total:</span>
              <span className="font-semibold">
                {formatCurrency(
                  servicos.reduce((acc, s) => acc + (s.estimativaValor || 0), 0)
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-sm text-muted-foreground">Dotação Total:</span>
              <span className="font-semibold">
                {formatCurrency(
                  servicos.reduce((acc, s) => acc + (s.dotacaoOrcamentaria || 0), 0)
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
