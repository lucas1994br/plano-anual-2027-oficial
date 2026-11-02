import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle, X, Download, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { 
  getPeriodosAtivos, 
  getAllGerencias, 
  getDiretorias,
  getItensCatalogo,
  getServicosCatalogo,
  updateItensCatalogoBulkAdmin,
  updateServicosCatalogoBulkAdmin,
  deleteItensCatalogoBulkAdmin,
  deleteServicosCatalogoBulkAdmin
} from "@/lib/services";
import { isGoogleSheetsActive, gsBulkInsert, GOOGLE_SPREADSHEET_URL } from "@/lib/googleSheetsClient";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ImportType = "aquisicao" | "servicos" | "servicos_novos";
type OperationType = "create" | "update" | "delete";

interface ImportData {
  headers: string[];
  rows: any[];
  errors: { row: number; col: string; message: string }[];
}

export function AdminImportCsv() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [operation, setOperation] = useState<OperationType>("create");
  const [importType, setImportType] = useState<ImportType>("aquisicao");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ImportData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  
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

        const gerencias = await getAllGerencias();
        if (gerencias) {
          setGerenciasList(gerencias as any[]);
        }

        const diretorias = await getDiretorias();
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

  const servicosHeaders = [
    "item", "contrato", "contratada", "objeto", "tipo", "prioridade", "vinculação", "diretoria", "status"
  ];

  const servicosNovosHeaders = [
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
    processFile(uploadedFile, importType, operation);
    
    if (e.target) {
      e.target.value = "";
    }
  };

  const normalizeHeader = (val: string): string => {
    return String(val || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");
  };

  const validateAndSetData = (
    headers: string[], 
    rawRows: any[], 
    type: ImportType, 
    op: OperationType = operation
  ) => {
    const normalizedHeaders = headers.map(h => String(h || "").trim().toLowerCase());
    const errors: { row: number; col: string; message: string }[] = [];
    const rows: any[] = [];

    const parseNumber = (val: any, col: string, rowNum: number) => {
      if (val === undefined || val === null || val === "") return 0;
      if (typeof val === "number") return isNaN(val) ? 0 : val;
      const str = String(val).replace(/R\$\s*/g, "").trim();
      if (!str) return 0;

      let cleanVal = str;
      if (str.includes(",") && str.includes(".")) {
        if (str.indexOf(".") < str.indexOf(",")) {
          // pt-BR: 1.250,50
          cleanVal = str.replace(/\./g, "").replace(",", ".");
        } else {
          // en-US: 1,250.50
          cleanVal = str.replace(/,/g, "");
        }
      } else if (str.includes(",")) {
        // Ex: 26,1 -> 26.1
        cleanVal = str.replace(",", ".");
      }

      const num = parseFloat(cleanVal);
      if (isNaN(num)) {
        errors.push({ row: rowNum, col, message: `Valor numérico inválido: ${val}` });
        return 0;
      }
      return num;
    };

    // ========================================================
    // CASO 1: OPERAÇÃO DELETE EM MASSA
    // ========================================================
    if (op === "delete") {
      const requiredKey = type === "aquisicao" ? "codigo" : "item";
      const hasKey = normalizedHeaders.includes(requiredKey) || normalizedHeaders.includes("id");

      if (!hasKey) {
        errors.push({
          row: 0,
          col: "Cabeçalho",
          message: `Cabeçalho identificador ausente: a planilha deve conter a coluna '${requiredKey}' (ou 'id')`
        });
        setData({ headers, rows: [], errors });
        setIsProcessing(false);
        return;
      }

      rawRows.forEach((row: any, index: number) => {
        const rowNum = index + 2;
        const rowKeys = Object.keys(row);
        const keyProp = rowKeys.find(k => k.trim().toLowerCase() === requiredKey);
        const idProp = rowKeys.find(k => k.trim().toLowerCase() === "id");
        const val = keyProp ? row[keyProp] : (idProp ? row[idProp] : undefined);

        if (val === undefined || val === null || String(val).trim() === "") {
          errors.push({ row: rowNum, col: requiredKey, message: `Campo '${requiredKey}' obrigatório para exclusão` });
          return;
        }

        const numVal = parseNumber(val, requiredKey, rowNum);
        if (numVal <= 0 && (!idProp || !row[idProp])) {
          errors.push({ row: rowNum, col: requiredKey, message: `Identificador '${val}' inválido` });
          return;
        }

        const processed: any = { ...row };
        if (type === "aquisicao") {
          processed.codigo = numVal || row.codigo;
        } else {
          processed.item = numVal || row.item;
        }
        if (idProp && row[idProp]) processed.id = String(row[idProp]).trim();
        rows.push(processed);
      });

      setData({ headers, rows, errors });
      setIsProcessing(false);
      return;
    }

    // ========================================================
    // CASO 2: OPERAÇÃO UPDATE EM MASSA
    // ========================================================
    if (op === "update") {
      const requiredKey = type === "aquisicao" ? "codigo" : "item";
      const normHeaders = headers.map(normalizeHeader);
      const hasKey = normHeaders.some(h => 
        h === requiredKey || 
        h === "id" || 
        (type === "aquisicao" && (h.startsWith("codigo") || h === "cod")) ||
        (type !== "aquisicao" && (h.startsWith("item") || h === "n_item" || h === "num_item"))
      );

      if (!hasKey) {
        errors.push({
          row: 0,
          col: "Cabeçalho",
          message: `Cabeçalho identificador ausente: a planilha deve conter a coluna '${requiredKey}' (ou 'id') para atualizar dados em massa`
        });
        setData({ headers, rows: [], errors });
        setIsProcessing(false);
        return;
      }

      rawRows.forEach((row: any, index: number) => {
        const rowNum = index + 2;
        let hasError = false;
        const processedRow: any = { ...row };
        const rowKeys = Object.keys(row);

        const findVal = (possibleKeys: string[]) => {
          for (const key of rowKeys) {
            const normK = normalizeHeader(key);
            if (possibleKeys.includes(normK)) {
              return row[key];
            }
          }
          return undefined;
        };

        if (type === "aquisicao") {
          const rawCodigo = findVal(["codigo", "cod", "codigo_do_item", "cod_item", "id_codigo"]);
          const rawId = findVal(["id", "item_id", "_id"]);

          if (rawId) {
            processedRow.id = String(rawId).trim();
          }

          if (rawCodigo === undefined || rawCodigo === null || String(rawCodigo).trim() === "") {
            if (!rawId) {
              errors.push({ row: rowNum, col: "codigo", message: "Código numérico do item é obrigatório" });
              hasError = true;
            }
          } else {
            const num = parseNumber(rawCodigo, "codigo", rowNum);
            if (num <= 0 && !rawId) {
              errors.push({ row: rowNum, col: "codigo", message: "Código inválido" });
              hasError = true;
            } else {
              processedRow.codigo = num;
            }
          }

          const rawDesc = findVal(["descricao", "descricao_do_item", "descricao_material", "material", "objeto", "nome"]);
          if (rawDesc !== undefined && String(rawDesc).trim() !== "") {
            processedRow.descricao = String(rawDesc).trim();
          }

          const rawCat = findVal(["categoria", "grupo", "classe"]);
          if (rawCat !== undefined && String(rawCat).trim() !== "") {
            processedRow.categoria = String(rawCat).trim();
          }

          const rawUn = findVal(["unidade", "un", "und", "unidade_de_medida"]);
          if (rawUn !== undefined && String(rawUn).trim() !== "") {
            processedRow.unidade = String(rawUn).trim();
          }

          const rawValUnit = findVal(["valor_unitario", "valorunitario", "valor", "preco", "preco_unitario", "val_unit"]);
          if (rawValUnit !== undefined && String(rawValUnit).trim() !== "") {
            processedRow.valor_unitario = parseNumber(rawValUnit, "valor_unitario", rowNum);
          }
        } else {
          // servicos ou servicos_novos
          const rawItem = findVal(["item", "n_item", "numero_item", "num_item", "numero", "cod"]);
          const rawId = findVal(["id", "servico_id", "_id"]);

          if (rawId) {
            processedRow.id = String(rawId).trim();
          }

          if (rawItem === undefined || rawItem === null || String(rawItem).trim() === "") {
            if (!rawId) {
              errors.push({ row: rowNum, col: "item", message: "Item numérico do serviço é obrigatório" });
              hasError = true;
            }
          } else {
            const num = parseNumber(rawItem, "item", rowNum);
            if (num <= 0 && !rawId) {
              errors.push({ row: rowNum, col: "item", message: "Item numérico inválido" });
              hasError = true;
            } else {
              processedRow.item = num;
            }
          }

          const rawObjeto = findVal(["objeto", "descricao", "servico", "especificacao"]);
          if (rawObjeto !== undefined && String(rawObjeto).trim() !== "") {
            processedRow.objeto = String(rawObjeto).trim();
          }

          const rawTipo = findVal(["tipo", "tipo_contratacao", "tipo_de_contratacao"]);
          if (rawTipo !== undefined && String(rawTipo).trim() !== "") {
            processedRow.tipo = String(rawTipo).trim();
          }

          const rawContrato = findVal(["contrato", "num_contrato", "numero_contrato"]);
          if (rawContrato !== undefined) {
            processedRow.contrato = String(rawContrato).trim() || null;
          }

          const rawContratada = findVal(["contratada", "empresa", "fornecedor"]);
          if (rawContratada !== undefined) {
            processedRow.contratada = String(rawContratada).trim() || null;
          }

          const rawDir = findVal(["diretoria", "sigla_diretoria", "dir"]);
          if (rawDir && String(rawDir).trim() !== "") {
            const diretoriaSigla = String(rawDir).toUpperCase().trim();
            if (!diretoriasMap[diretoriaSigla]) {
              errors.push({ row: rowNum, col: "diretoria", message: `Diretoria '${diretoriaSigla}' não encontrada` });
              hasError = true;
            } else {
              processedRow._diretoria_id = diretoriasMap[diretoriaSigla];
              processedRow.diretoria_id = diretoriasMap[diretoriaSigla];
            }
          }

          const prioridadeVal = findVal(["prioridade", "grau_prioridade", "grau_de_prioridade"])?.toString().trim();
          if (prioridadeVal) {
            const normPrio = prioridadeVal.charAt(0).toUpperCase() + prioridadeVal.slice(1).toLowerCase();
            const mappedPrio = normPrio === "Medio" ? "Médio" : normPrio;
            if (!["Baixo", "Médio", "Alto"].includes(mappedPrio)) {
              errors.push({ row: rowNum, col: "prioridade", message: "Deve ser: Baixo, Médio ou Alto" });
              hasError = true;
            } else {
              processedRow.prioridade = mappedPrio;
            }
          }

          const rawVinc = findVal(["vinculacao", "vinculacao_pac", "vinculado"]);
          if (rawVinc !== undefined && String(rawVinc).trim() !== "") {
            const normVinc = String(rawVinc).trim().toLowerCase();
            const mappedVinc = (normVinc === "sim" || normVinc === "s" || normVinc === "true") ? "Sim" : "Não";
            processedRow.vinculacao = mappedVinc;
            processedRow.vinculação = mappedVinc;
          }

          const rawStatus = findVal(["status", "ativo", "situacao"]);
          if (rawStatus !== undefined && String(rawStatus).trim() !== "") {
            const strStatus = String(rawStatus).toLowerCase().trim();
            processedRow._ativo = strStatus !== "inativo" && strStatus !== "false" && strStatus !== "desativado";
            processedRow.ativo = processedRow._ativo;
          }

          const rawEstimativa = findVal(["estimativa_valor", "valor_estimado", "valor", "estimativa"]);
          if (rawEstimativa !== undefined && String(rawEstimativa).trim() !== "") {
            processedRow.estimativa_valor = parseNumber(rawEstimativa, "estimativa_valor", rowNum);
          }

          const rawJust = findVal(["justificativa", "motivo"]);
          if (rawJust !== undefined) {
            processedRow.justificativa = String(rawJust).trim() || null;
          }
        }

        if (!hasError) {
          rows.push(processedRow);
        }
      });

      setData({ headers, rows, errors });
      setIsProcessing(false);
      return;
    }

    // ========================================================
    // CASO 3: OPERAÇÃO CREATE (Lógica original 100% preservada)
    // ========================================================
    const requiredHeaders = 
      type === "aquisicao" 
        ? aquisicaoHeaders 
        : type === "servicos_novos"
        ? ["item", "objeto", "prioridade", "vinculação", "diretoria"]
        : servicosHeaders;
    
    const missingHeaders = requiredHeaders.filter(h => !normalizedHeaders.includes(h));
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

      if (type === "servicos" || type === "servicos_novos") {
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
        
        processedRow.item = parseNumber(row.item, "item", rowNum);
        
        const prioridadeVal = row.prioridade?.toString().trim();
        if (prioridadeVal && !["Baixo", "Médio", "Alto"].includes(prioridadeVal)) {
          errors.push({ row: rowNum, col: "prioridade", message: "Deve ser: Baixo, Médio ou Alto" });
          hasError = true;
        } else if (!prioridadeVal) {
          processedRow.prioridade = "Médio";
        }

        const vinculacaoVal = row.vinculação?.toString().trim() || row.vinculacao?.toString().trim();
        if (vinculacaoVal && !["Sim", "Não"].includes(vinculacaoVal)) {
          errors.push({ row: rowNum, col: "vinculação", message: "Deve ser: Sim ou Não" });
          hasError = true;
        } else if (!vinculacaoVal) {
          processedRow.vinculação = "Não";
        }

        if (!row.objeto || !row.objeto.toString().trim()) {
          errors.push({ row: rowNum, col: "objeto", message: "Objeto do serviço é obrigatório" });
          hasError = true;
        }

        processedRow._ativo = row.status?.toString().toLowerCase().trim() !== "inativo";
        if (type === "servicos_novos") {
          processedRow.tipo = row.tipo?.toString().trim() || "Novo";
        }
      }

      if (!hasError) {
        rows.push(processedRow);
      }
    });

    setData({ headers, rows, errors });
    setIsProcessing(false);
  };

  const processFile = (fileToProcess: File, type: ImportType, op: OperationType = operation) => {
    setIsProcessing(true);
    
    const fileName = fileToProcess.name.toLowerCase();
    if (fileName.endsWith(".csv")) {
      Papa.parse(fileToProcess, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = (results.meta.fields || []).map(h => String(h || "").trim());
          validateAndSetData(headers, results.data, type, op);
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
          const dataBuffer = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(dataBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const aoa: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          let headerIndex = 0;
          for (let i = 0; i < Math.min(aoa.length, 10); i++) {
            const rowVals = (aoa[i] || []).map(cell => normalizeHeader(String(cell)));
            if (rowVals.some(v => v === "codigo" || v === "item" || v === "id" || v.startsWith("codigo") || v.startsWith("item"))) {
              headerIndex = i;
              break;
            }
          }

          const rawHeaders = (aoa[headerIndex] || []).map(h => String(h || "").trim());
          const headers = rawHeaders;

          let rawData: any[] = [];
          if (headerIndex > 0) {
            for (let r = headerIndex + 1; r < aoa.length; r++) {
              const rowVals = aoa[r];
              if (!rowVals || rowVals.length === 0 || rowVals.every(c => c === "" || c === null || c === undefined)) continue;
              const obj: Record<string, any> = {};
              rawHeaders.forEach((h, colIdx) => {
                if (h) obj[h] = rowVals[colIdx] ?? "";
              });
              rawData.push(obj);
            }
          } else {
            rawData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          }

          validateAndSetData(headers, rawData, type, op);
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
      // ========================================================
      // CASO 1: EXECUÇÃO DE EXCLUSÃO EM MASSA (DELETE)
      // ========================================================
      if (operation === "delete") {
        if (importType === "aquisicao") {
          const codigosToDelete = data.rows
            .map(r => parseInt(r.codigo, 10))
            .filter(c => !isNaN(c) && c > 0);

          let existingCatalog: any[] = [];
          try {
            existingCatalog = (await getItensCatalogo()) || [];
          } catch (e) {
            console.warn("Could not fetch catalog for delete mapping:", e);
          }
          const idMap = new Map<number, string>();
          existingCatalog.forEach((item: any) => {
            const code = parseInt(item.codigo, 10);
            if (!isNaN(code) && item.id) {
              idMap.set(code, String(item.id));
            }
          });

          const itemIds = codigosToDelete.map(c => idMap.get(c) || ("item-" + c));
          await deleteItensCatalogoBulkAdmin(itemIds, codigosToDelete);

          queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
          queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
          queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });

          toast({
            title: "Exclusão em massa concluída!",
            description: `${codigosToDelete.length} itens de aquisições excluídos com sucesso do catálogo e das listas.`,
          });
        } else {
          // servicos ou servicos_novos
          const itemsToDelete = data.rows
            .map(r => parseInt(r.item, 10))
            .filter(it => !isNaN(it) && it > 0);

          let existingServicos: any[] = [];
          try {
            existingServicos = (await getServicosCatalogo()) || [];
          } catch (e) {
            console.warn("Could not fetch servicos catalog for delete mapping:", e);
          }
          const idMap = new Map<number, string>();
          existingServicos.forEach((s: any) => {
            const itNum = parseInt(s.item, 10);
            if (!isNaN(itNum) && s.id) {
              idMap.set(itNum, String(s.id));
            }
          });

          const servicoIds = itemsToDelete.map(it => idMap.get(it) || String(it));
          await deleteServicosCatalogoBulkAdmin(servicoIds, itemsToDelete);

          queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
          queryClient.invalidateQueries({ queryKey: ["servicos"] });
          queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });

          toast({
            title: "Exclusão em massa concluída!",
            description: `${itemsToDelete.length} serviços excluídos com sucesso do catálogo e das listas da gerência e diretoria.`,
          });
        }

        setFile(null);
        setData(null);
        setShowConfirmDeleteModal(false);
        return;
      }

      // ========================================================
      // CASO 2: EXECUÇÃO DE ATUALIZAÇÃO EM MASSA (UPDATE)
      // ========================================================
      if (operation === "update") {
        if (importType === "aquisicao") {
          let existingCatalog: any[] = [];
          try {
            existingCatalog = (await getItensCatalogo()) || [];
          } catch (e) {
            console.warn("Could not fetch catalog for update mapping:", e);
          }
          const idMap = new Map<number, string>();
          existingCatalog.forEach((item: any) => {
            const code = parseInt(item.codigo, 10);
            if (!isNaN(code) && item.id) {
              idMap.set(code, String(item.id));
            }
          });

          const payload = data.rows.map(row => {
            const codNum = parseInt(row.codigo, 10);
            const p: any = {
              codigo: codNum
            };
            const resolvedId = row.id || idMap.get(codNum) || (codNum ? "item-" + codNum : undefined);
            if (resolvedId) p.id = String(resolvedId).trim();

            if (row.descricao !== undefined && row.descricao !== "") p.descricao = String(row.descricao).trim();
            if (row.categoria !== undefined && row.categoria !== "") p.categoria = String(row.categoria).trim();
            if (row.unidade !== undefined && row.unidade !== "") p.unidade = String(row.unidade).trim();
            if (row.valor_unitario !== undefined && row.valor_unitario !== "") {
              p.valor_unitario = Number(row.valor_unitario) || 0;
            }
            return p;
          });

          await updateItensCatalogoBulkAdmin(payload);

          queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
          queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
          queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });

          toast({
            title: "Atualização em massa concluída!",
            description: `${payload.length} itens de aquisições atualizados com sucesso no catálogo e refletidos nas listas.`,
          });
        } else {
          // servicos ou servicos_novos
          const isNovos = importType === "servicos_novos";
          let existingServicos: any[] = [];
          try {
            existingServicos = (await getServicosCatalogo()) || [];
          } catch (e) {
            console.warn("Could not fetch servicos catalog for update mapping:", e);
          }
          const idMap = new Map<number, string>();
          existingServicos.forEach((s: any) => {
            const itNum = parseInt(s.item, 10);
            if (!isNaN(itNum) && s.id) {
              idMap.set(itNum, String(s.id));
            }
          });

          const payload = data.rows.map(row => {
            const itemNum = parseInt(row.item, 10);
            const s: any = {
              item: itemNum
            };
            const resolvedId = row.id || idMap.get(itemNum) || (itemNum ? String(itemNum) : undefined);
            if (resolvedId) s.id = String(resolvedId).trim();

            if (row.tipo !== undefined && row.tipo !== "") s.tipo_contratacao = String(row.tipo).trim();
            else if (isNovos) s.tipo_contratacao = "Novo";
            if (row.objeto !== undefined && row.objeto !== "") s.objeto = String(row.objeto).trim();
            if (row.contrato !== undefined) s.contrato = row.contrato ? String(row.contrato).trim() : null;
            if (row.contratada !== undefined) s.contratada = row.contratada ? String(row.contratada).trim() : null;
            if (row.prioridade !== undefined && row.prioridade !== "") s.grau_prioridade = String(row.prioridade).trim();
            if (row.vinculação !== undefined && row.vinculação !== "") s.vinculacao = String(row.vinculação).trim();
            if (row.vinculacao !== undefined && row.vinculacao !== "") s.vinculacao = String(row.vinculacao).trim();
            if (row._diretoria_id) s.diretoria_id = row._diretoria_id;
            else if (row.diretoria_id) s.diretoria_id = row.diretoria_id;
            if (row.status !== undefined && row.status !== "") {
              s.ativo = String(row.status).toLowerCase().trim() !== "inativo";
            } else if (row.ativo !== undefined) {
              s.ativo = Boolean(row.ativo);
            }
            if (row.estimativa_valor !== undefined && row.estimativa_valor !== "") {
              s.estimativa_valor = Number(row.estimativa_valor) || 0;
            }
            if (row.justificativa !== undefined) s.justificativa = row.justificativa ? String(row.justificativa).trim() : null;
            return s;
          });

          await updateServicosCatalogoBulkAdmin(payload);

          queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
          queryClient.invalidateQueries({ queryKey: ["servicos"] });
          queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });

          toast({
            title: "Atualização em massa concluída!",
            description: `${payload.length} serviços atualizados com sucesso no catálogo e sincronizados nos painéis da gerência e diretoria.`,
          });
        }

        setFile(null);
        setData(null);
        return;
      }

      // ========================================================
      // CASO 3: EXECUÇÃO DE CADASTRO/INSERÇÃO EM MASSA (CREATE)
      // ========================================================
      if (importType === "aquisicao") {
        const payload = data.rows.map(row => ({
          codigo: row.codigo,
          descricao: row.descricao,
          categoria: row.categoria,
          unidade: row.unidade,
          valor_unitario: row.valor_unitario
        }));

        if (isGoogleSheetsActive()) {
          await gsBulkInsert("itens_catalogo", payload);
        } else {
          const { error } = await supabase.from("itens_catalogo").insert(payload);
          if (error) throw error;
        }
      } else {
        const isNovos = importType === "servicos_novos";
        const catalogoPayload = data.rows.map(row => ({
          item: row.item,
          tipo_contratacao: row.tipo || (isNovos ? "Novo" : "Renovação"),
          objeto: row.objeto,
          justificativa: row.justificativa || null,
          grau_prioridade: row.prioridade || "Médio",
          estimativa_valor: row.estimativa_valor ? Number(row.estimativa_valor) : 0,
          vinculacao: row.vinculação || "Não",
          contrato: row.contrato || null,
          contratada: row.contratada || null,
          dependencia_descricao: null,
          diretoria_id: row._diretoria_id,
          gerencia_id: null,
          ativo: row._ativo
        }));

        if (isGoogleSheetsActive()) {
          await gsBulkInsert("servicos_catalogo", catalogoPayload);
        } else {
          const { error: catalogoError } = await supabase.from("servicos_catalogo").insert(catalogoPayload);
          if (catalogoError) throw catalogoError;
        }

        const servicosPayload: any[] = [];
        data.rows.forEach(row => {
          gerenciasList.forEach(g => {
            servicosPayload.push({
              periodo_id: activePeriodId,
              diretoria_id: g.diretoria_id,
              gerencia_id: g.id,
              item: row.item,
              tipo_contratacao: row.tipo || (isNovos ? "Novo" : "Renovação"),
              unidade_demandante: g.sigla || "N/A",
              objeto: row.objeto,
              justificativa: row.justificativa || null,
              previsao_inicio: null,
              estimativa_valor: 0,
              dotacao_orcamentaria: 0,
              grau_prioridade: row.prioridade || "Médio",
              vinculacao: row.vinculação || "Não",
              dependencia_descricao: null,
              contrato: row.contrato || null,
              contratada: row.contratada || null,
              observacao: null,
              status: "rascunho"
            });
          });
        });

        if (isGoogleSheetsActive()) {
          for (let i = 0; i < servicosPayload.length; i += 500) {
            const chunk = servicosPayload.slice(i, i + 500);
            await gsBulkInsert("servicos", chunk);
          }
        } else {
          for (let i = 0; i < servicosPayload.length; i += 500) {
            const chunk = servicosPayload.slice(i, i + 500);
            const { error: servicosError } = await supabase.from("servicos").insert(chunk);
            if (servicosError) throw servicosError;
          }
        }
      }
      
      if (importType === "aquisicao") {
        queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
        queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
        queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
        queryClient.invalidateQueries({ queryKey: ["servicos"] });
        queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
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
        title: "Erro ao processar dados",
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
    let headers: string[] = [];

    if (operation === "delete") {
      headers = importType === "aquisicao" ? ["codigo"] : ["item"];
    } else {
      if (importType === "aquisicao") headers = aquisicaoHeaders;
      if (importType === "servicos") headers = servicosHeaders;
      if (importType === "servicos_novos") headers = servicosNovosHeaders;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    
    const opPrefix = operation === "create" ? "cadastro" : operation === "update" ? "atualizacao" : "exclusao";
    XLSX.writeFile(workbook, `modelo_${opPrefix}_${importType}.xlsx`);
  };

  return (
    <Card className="shadow-sm border border-border/50">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importação e Gestão em Massa de Dados
          </CardTitle>
          <CardDescription>
            {operation === "create" && "Faça o upload de um arquivo CSV ou Excel para incluir Aquisições, Serviços Existentes ou Novos Serviços em lote."}
            {operation === "update" && "Faça o upload de um arquivo CSV ou Excel para atualizar dados existentes em lote (identificados por código ou item)."}
            {operation === "delete" && "Faça o upload de um arquivo CSV ou Excel com os códigos ou itens para excluir em massa do catálogo e das listas da gerência e diretoria."}
          </CardDescription>
        </div>
        <a
          href={GOOGLE_SPREADSHEET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors w-fit self-start sm:self-auto"
          title="Abrir Planilha Google Oficial (PAC 2027)"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>Abrir Planilha Google Oficial</span>
        </a>
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
              <label className="text-sm font-medium">Operação em Massa</label>
              <Select 
                value={operation} 
                onValueChange={(v: OperationType) => {
                  setOperation(v);
                  resetForm();
                }}
                disabled={isProcessing || isUploading || !!file}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operação..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Cadastrar / Inserir (Create)</SelectItem>
                  <SelectItem value="update">Atualizar Dados em Massa (Update)</SelectItem>
                  <SelectItem value="delete">Deletar Dados em Massa (Delete)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Dados</label>
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
                  <SelectItem value="servicos_novos">Novos Serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!file && activePeriodId && (
              <div className="pt-2">
                <Button variant="outline" className="w-full gap-2" onClick={getTemplateExcel}>
                  <Download className="h-4 w-4" />
                  {operation === "create" && "Baixar Modelo Excel (Cadastro)"}
                  {operation === "update" && "Baixar Modelo Excel (Atualização)"}
                  {operation === "delete" && "Baixar Modelo Excel (Exclusão)"}
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
                  {operation === "delete" 
                    ? "Planilha com a coluna 'codigo' (para Aquisições) ou 'item' (para Serviços)"
                    : operation === "update"
                    ? "Planilha com a coluna identificadora ('codigo' ou 'item') e os dados atualizados"
                    : "Planilha completa seguindo as colunas do modelo"}
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
                      <p className="font-medium text-sm truncate max-w-50">{file.name}</p>
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

          {operation === "delete" ? (
            <Button 
              variant="destructive" 
              onClick={() => setShowConfirmDeleteModal(true)} 
              disabled={isUploading} 
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isUploading ? "Excluindo dados..." : `Confirmar Exclusão em Massa (${data.rows.length})`}
            </Button>
          ) : operation === "update" ? (
            <Button 
              onClick={handleConfirmImport} 
              disabled={isUploading} 
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isUploading ? "animate-spin" : ""}`} />
              {isUploading ? "Atualizando dados..." : `Confirmar Atualização em Massa (${data.rows.length})`}
            </Button>
          ) : (
            <Button onClick={handleConfirmImport} disabled={isUploading} className="gap-2">
              {isUploading ? (
                <>Salvando dados...</>
              ) : (
                <>Confirmar Importação ({data.rows.length})</>
              )}
            </Button>
          )}
        </CardFooter>
      )}

      {/* Modal de confirmação para exclusão em massa */}
      <AlertDialog open={showConfirmDeleteModal} onOpenChange={setShowConfirmDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão em Massa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir em massa <strong>{data?.rows.length}</strong> registro(s) de{" "}
              <strong>
                {importType === "aquisicao" 
                  ? "Aquisições (Itens Catálogo)" 
                  : importType === "servicos" 
                  ? "Serviços Existentes" 
                  : "Novos Serviços"}
              </strong>?
              <br /><br />
              Esta operação removerá os itens correspondentes do catálogo e sincronizará a exclusão de todas as solicitações correspondentes nas listas das gerências e da diretoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleConfirmImport}
              disabled={isUploading}
            >
              {isUploading ? "Excluindo..." : "Sim, Excluir em Massa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
