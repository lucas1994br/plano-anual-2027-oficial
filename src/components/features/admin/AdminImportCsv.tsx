import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { getPeriodosAtivos } from "@/lib/services";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

type ImportType = "aquisicao" | "servicos";

interface ImportData {
  headers: string[];
  rows: any[];
  errors: { row: number; col: string; message: string }[];
}

export function AdminImportCsv() {
  const { toast } = useToast();
  const [importType, setImportType] = useState<ImportType>("aquisicao");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [gerenciasList, setGerenciasList] = useState<{ id: string, diretoria_id: string, sigla: string }[]>([]);
  const [diretoriasMap, setDiretoriasMap] = useState<Record<string, string>>({});
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);

  useEffect(() => {
    async function loadDependencies() {
      try {
        const periodos = await getPeriodosAtivos();
        if (periodos && periodos.length > 0) {
          setActivePeriodId(periodos[0].id as string);
        }

        const { data: gerencias } = await supabase
          .from("gerencias")
          .select("id, sigla, diretoria_id")
          .eq("ativa", true);
          
        if (gerencias) {
          setGerenciasList(gerencias as any[]);
        }

        const { data: diretorias } = await supabase
          .from("diretorias")
          .select("id, sigla");
          
        if (diretorias) {
          const map: Record<string, string> = {};
          diretorias.forEach((d: any) => {
            if (d.sigla) map[d.sigla.toUpperCase().trim()] = d.id;
          });
          setDiretoriasMap(map);
        }
      } catch (err) {
        console.error("Erro ao carregar dependências para importação", err);
      }
    }
    loadDependencies();
  }, []);

  const aquisicaoHeaders = [
    "codigo", "descricao", "categoria", "unidade", "valor_unitario"
  ];

  const aquisicaoOptionalHeaders = [];

  const servicosHeaders = [
    "item", "contrato", "contratada", "objeto", "tipo", "prioridade", "vinculação", "diretoria", "status"
  ];


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const fileName = uploadedFile.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo .csv, .xlsx ou .xls válido",
        variant: "destructive"
      });
      return;
    }

    setFile(uploadedFile);
    setData(null);
    processFile(uploadedFile, importType);
    
    if (e.target) {
      e.target.value = "";
    }
  };

  const validateAndSetData = (headers: string[], rawRows: any[], type: ImportType) => {
    const requiredHeaders = type === "aquisicao" ? aquisicaoHeaders : servicosHeaders;
    
    const errors: { row: number; col: string; message: string }[] = [];
    const rows: any[] = [];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push({
        row: 0,
        col: "Cabeçalho",
        message: `Cabeçalhos ausentes: ${missingHeaders.join(", ")}`
      });
      setData({ headers, rows: [], errors });
      setIsProcessing(false);
      return;
    }

    rawRows.forEach((row: any, index: number) => {
      const rowNum = index + 2; 
      let hasError = false;
      const processedRow = { ...row };

      const parseNumber = (val: any, col: string) => {
        if (val === undefined || val === null || val === "") return 0;
        if (typeof val === "number") return val;
        const cleanVal = val.toString().replace(/R\$\s*/g, "").replace(/\./g, "").replace(/,/g, ".");
        const num = parseFloat(cleanVal);
        if (isNaN(num)) {
          errors.push({ row: rowNum, col, message: `Valor numérico inválido: ${val}` });
          hasError = true;
        }
        return num;
      };

      if (type === "servicos") {
        const diretoriaSigla = row.diretoria?.toString().toUpperCase().trim();
        if (!diretoriaSigla) {
          errors.push({ row: rowNum, col: "diretoria", message: "Sigla da diretoria não informada" });
          hasError = true;
        } else if (!diretoriasMap[diretoriaSigla]) {
          errors.push({ row: rowNum, col: "diretoria", message: `Diretoria '${diretoriaSigla}' não encontrada` });
          hasError = true;
        } else {
          processedRow._diretoria_id = diretoriasMap[diretoriaSigla];
        }

        if (!row.item) { errors.push({ row: rowNum, col: "item", message: "Item numérico obrigatório" }); hasError = true; }
        
        processedRow.item = parseNumber(row.item, "item");
        
        if (!["Baixo", "Médio", "Alto"].includes(row.prioridade)) {
          errors.push({ row: rowNum, col: "prioridade", message: "Deve ser: Baixo, Médio ou Alto" });
          hasError = true;
        }
        if (!["Sim", "Não"].includes(row.vinculação)) {
          errors.push({ row: rowNum, col: "vinculação", message: "Deve ser: Sim ou Não" });
          hasError = true;
        }

        processedRow._ativo = row.status?.toString().toLowerCase().trim() !== "inativo";
      }

      if (!hasError) {
        rows.push(processedRow);
      }
    });

    setData({ headers, rows, errors });
    setIsProcessing(false);
  };

  const processFile = (fileToProcess: File, type: ImportType) => {
    setIsProcessing(true);
    
    const fileName = fileToProcess.name.toLowerCase();
    if (fileName.endsWith(".csv")) {
      Papa.parse(fileToProcess, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          validateAndSetData(headers, results.data, type);
        },
        error: (error: any) => {
          toast({
            title: "Erro ao ler CSV",
            description: error.message,
            variant: "destructive"
          });
          setIsProcessing(false);
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          const headers = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [];
          
          validateAndSetData(headers, rawData, type);
        } catch (error: any) {
          toast({
            title: "Erro ao ler Excel",
            description: error.message,
            variant: "destructive"
          });
          setIsProcessing(false);
        }
      };
      reader.onerror = () => {
        toast({
          title: "Erro de Leitura",
          description: "Não foi possível ler o arquivo Excel.",
          variant: "destructive"
        });
        setIsProcessing(false);
      };
      reader.readAsArrayBuffer(fileToProcess);
    }
  };

  const handleConfirmImport = async () => {
    if (!data || data.rows.length === 0 || !activePeriodId) return;
    
    setIsUploading(true);
    
    try {
      if (importType === "aquisicao") {
        const payload = data.rows.map(row => ({
          codigo: row.codigo,
          descricao: row.descricao,
          categoria: row.categoria,
          unidade: row.unidade,
          valor_unitario: row.valor_unitario
        }));

        const { error } = await supabase.from("itens_catalogo").insert(payload);
        if (error) throw error;
      } else {
        const catalogoPayload = data.rows.map(row => ({
          item: row.item,
          tipo_contratacao: row.tipo || "Novo",
          objeto: row.objeto,
          justificativa: null,
          grau_prioridade: row.prioridade,
          estimativa_valor: 0,
          vinculacao: row.vinculação,
          contrato: row.contrato || null,
          contratada: row.contratada || null,
          dependencia_descricao: null,
          diretoria_id: row._diretoria_id,
          gerencia_id: null,
          ativo: row._ativo
        }));

        const { error: catalogoError } = await supabase.from("servicos_catalogo").insert(catalogoPayload);
        if (catalogoError) throw catalogoError;

        const servicosPayload: any[] = [];
        data.rows.forEach(row => {
          gerenciasList.forEach(g => {
            servicosPayload.push({
              periodo_id: activePeriodId,
              diretoria_id: g.diretoria_id,
              gerencia_id: g.id,
              item: row.item,
              tipo_contratacao: row.tipo || "Novo",
              unidade_demandante: g.sigla || "N/A",
              objeto: row.objeto,
              justificativa: null,
              previsao_inicio: null,
              estimativa_valor: 0,
              dotacao_orcamentaria: 0,
              grau_prioridade: row.prioridade,
              vinculacao: row.vinculação,
              dependencia_descricao: null,
              contrato: row.contrato || null,
              contratada: row.contratada || null,
              observacao: null,
              status: "rascunho"
            });
          });
        });

        for (let i = 0; i < servicosPayload.length; i += 500) {
          const chunk = servicosPayload.slice(i, i + 500);
          const { error: servicosError } = await supabase.from("servicos").insert(chunk);
          if (servicosError) throw servicosError;
        }
      }
      
      toast({
        title: "Importação concluída!",
        description: `${data.rows.length} registros inseridos com sucesso.`,
      });
      
      setFile(null);
      setData(null);
    } catch (err: any) {
      console.error("Erro na importação:", err);
      toast({
        title: "Erro ao salvar no banco",
        description: err.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setData(null);
  };

  const getTemplateExcel = () => {
    const headers = importType === "aquisicao" ? [...aquisicaoHeaders] : [...servicosHeaders];
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    
    XLSX.writeFile(workbook, `modelo_importacao_${importType}.xlsx`);
  };

  return (
    <Card className="shadow-sm border border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importação de Dados
        </CardTitle>
        <CardDescription>
          Faça o upload de um arquivo CSV ou Excel para incluir Aquisições ou Serviços em lote.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!activePeriodId && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">Nenhum período ativo encontrado. Não é possível importar dados no momento.</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Importação</label>
              <Select 
                value={importType} 
                onValueChange={(v: ImportType) => {
                  setImportType(v);
                  resetForm();
                }}
                disabled={isProcessing || isUploading || !!file}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aquisicao">Aquisições (Itens Catálogo)</SelectItem>
                  <SelectItem value="servicos">Serviços Existentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!file && activePeriodId && (
              <div className="pt-2">
                <Button variant="outline" className="w-full gap-2" onClick={getTemplateExcel}>
                  <Download className="h-4 w-4" />
                  Baixar Modelo Excel
                </Button>
              </div>
            )}
          </div>

          <div className="w-full md:w-2/3">
            {!file ? (
              <div className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center transition-colors ${!activePeriodId ? 'opacity-50 pointer-events-none' : 'hover:bg-muted/50 border-primary/20'}`}>
                <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">Selecione o arquivo (CSV ou Excel)</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Apenas arquivos com extensão .csv, .xlsx ou .xls
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  id="csv-upload"
                  onChange={handleFileUpload}
                  disabled={!activePeriodId}
                />
                <Button onClick={() => document.getElementById("csv-upload")?.click()} disabled={!activePeriodId}>
                  Procurar Arquivo
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-muted/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-md">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={resetForm} disabled={isUploading}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>

                {isProcessing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-center text-muted-foreground">Analisando arquivo...</p>
                    <Progress value={undefined} className="h-1" />
                  </div>
                ) : data && (
                  <div className="space-y-4">
                    <div className="flex gap-4 mb-2">
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-full text-xs font-medium">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {data.rows.length} registros válidos
                      </div>
                      {data.errors.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full text-xs font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {data.errors.length} erros encontrados
                        </div>
                      )}
                    </div>

                    {data.errors.length > 0 && (
                      <div className="bg-destructive/5 border border-destructive/20 rounded-md overflow-hidden">
                        <div className="bg-destructive/10 px-3 py-2 border-b border-destructive/10 font-medium text-destructive text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Detalhes dos erros
                        </div>
                        <ScrollArea className="h-32">
                          <div className="p-2 space-y-1">
                            {data.errors.map((err, i) => (
                              <div key={i} className="text-xs text-destructive/80 px-2 py-1">
                                <span className="font-bold mr-1">Linha {err.row}:</span>
                                [{err.col}] {err.message}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {file && data && data.errors.length === 0 && data.rows.length > 0 && (
        <CardFooter className="bg-muted/30 border-t flex justify-end gap-3 px-6 py-4">
          <Button variant="outline" onClick={resetForm} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmImport} disabled={isUploading} className="gap-2">
            {isUploading ? (
              <>Salvando dados...</>
            ) : (
              <>Confirmar Importação ({data.rows.length})</>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
