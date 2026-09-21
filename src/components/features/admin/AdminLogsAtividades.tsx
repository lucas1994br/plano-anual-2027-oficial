import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Eye, FileSpreadsheet, Trash2, MoreHorizontal, FileDown, ArchiveRestore, AlertTriangle } from "lucide-react";
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
import { SmartPagination } from "@/components/common/SmartPagination.tsx";
import { useSortableTable } from "@/hooks/useSortableTable.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
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
import { getLogsAtividades, getLixeiraLogsAtividades, getFuncionariosNomes, deleteLogAtividade, deleteLogsAtividadeBulk, restoreLogAtividade, restoreLogsAtividadeBulk, hardDeleteLogAtividade, hardDeleteLogsAtividadeBulk, getRecordDetails } from "@/lib/services.ts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";

const toTitleCase = (str: unknown) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

function formatSafeDate(dateVal: any, formatPattern = "dd/MM/yyyy HH:mm:ss", options?: any): string {
  if (!dateVal) return "-";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return format(d, formatPattern, options);
  } catch {
    return "-";
  }
}

type FuncionarioInfo = { nome: string; diretoria_id?: string; gerencia_id?: string; [key: string]: unknown };

function LogNarrative({ log, funcionariosMap, getFuncNome }: Readonly<{ log: Record<string, unknown>, funcionariosMap: Record<string, FuncionarioInfo>, getFuncNome: (mat: unknown) => string | undefined }>) {
  if (!log) return null;

  const record: Record<string, any> = (() => {
    if (!log.detalhes) return {};
    if (typeof log.detalhes === "object") return log.detalhes as Record<string, any>;
    if (typeof log.detalhes === "string") {
      try {
        const parsed = JSON.parse(log.detalhes);
        return typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  })();

  const matStr = String(log.matricula ?? "");
  const funcName = toTitleCase(getFuncNome(matStr) || "Desconhecido");
  let texto: React.ReactNode = null;

  // Tenta extrair status novo se houver
  let statusText = "";
  if (record.status_novo) {
    const s = record.status_novo;
    let statusFriendly = String(s);
    if (s === 'aprovado') statusFriendly = 'Aprovado';
    else if (s === 'enviado') statusFriendly = 'Enviado para Aprovação';
    else if (s === 'reprovado') statusFriendly = 'Reprovado';
    statusText = statusFriendly;
  }
  
  const cargo = (() => {
    const firstName = String(funcName.split(" ")[0] || "").toLowerCase();
    
    let isFeminino = false;
    if (firstName.endsWith('a') || firstName.endsWith('elle') || firstName.endsWith('ele') || firstName.endsWith('ete') || firstName.endsWith('y') || firstName.endsWith('i') || firstName.endsWith('is')) {
      if (!['luca', 'caua', 'cauã', 'joshua', 'noa', 'yuri', 'davi', 'levi', 'kaui', 'rui', 'luis', 'luís'].includes(firstName)) {
        isFeminino = true;
      }
    }
    if (['carmen', 'iris', 'lais', 'laís', 'elis', 'ruth', 'ester', 'raquel', 'miriam', 'sueli', 'cleide', 'ivone'].includes(firstName)) {
      isFeminino = true;
    }

    if (matStr === 'admin123' || matStr === 'admin') return isFeminino ? "A Administradora do Sistema" : "O Administrador do Sistema";
    const func = funcionariosMap[matStr];
    if (!func) return isFeminino ? "A Funcionária" : "O Funcionário";
    if (func.diretoria_id && !func.gerencia_id) return isFeminino ? "A Diretora" : "O Diretor";
    if (func.gerencia_id) return isFeminino ? "A Gerente" : "O Gerente";
    return isFeminino ? "A Funcionária" : "O Funcionário";
  })();

  let actionVerb = "alterou";
  if (statusText === 'Aprovado') actionVerb = "aprovou";
  else if (statusText === 'Enviado para Aprovação') actionVerb = "enviou para aprovação";
  else if (statusText === 'Reprovado') actionVerb = "reprovou";

  const gerenciaText = record.gerencia ? ` da gerência ${record.gerencia}` : "";

  if (log.tabela_afetada === "solicitacoes" && (record.codigo || record.descricao || record.objeto)) {
    const itemName = record.descricao || record.objeto || "Item não especificado";
    texto = <>{cargo} {funcName} {actionVerb} a solicitação{gerenciaText} referente ao item "{itemName}"{record.codigo ? ` do código ${record.codigo}` : ""}, com quantidade {record.qtd_estimada || 1}.</>;
  } else if (log.tabela_afetada === "itens_catalogo" && record.descricao) {
    texto = <>{cargo} {funcName} atualizou o item de catálogo "{record.descricao}"{statusText ? <>. O status foi atualizado para <strong>{statusText}</strong></> : ""}.</>;
  } else if (log.tabela_afetada === "servicos_catalogo" && record.objeto) {
    texto = <>{cargo} {funcName} atualizou o serviço "{record.objeto}"{statusText ? <>. O status foi atualizado para <strong>{statusText}</strong></> : ""}.</>;
  } else if (log.tabela_afetada === "servicos") {
    const itemName = record.objeto || record.descricao || "Serviço Existente não especificado";
    texto = <>{cargo} {funcName} {actionVerb} o serviço existente "{itemName}" (Item {record.item || record.id || "N/A"}){statusText ? <>. O status foi atualizado para <strong>{statusText}</strong></> : ""}.</>;
  } else if (log.tabela_afetada === "aquisicoes") {
    const itemName = record.objeto || record.descricao || "Aquisição Existente não especificada";
    texto = <>{cargo} {funcName} {actionVerb} a aquisição existente "{itemName}" (Item {record.item || record.id || "N/A"}){statusText ? <>. O status foi atualizado para <strong>{statusText}</strong></> : ""}.</>;
  } else if (log.tabela_afetada === "restricoes_atividades") {
    const mod = record.modulo ? String(record.modulo).replace(/_/g, " ") : "módulo";
    const act = record.atividade ? String(record.atividade).replace(/_/g, " ") : "atividade";
    const st = record.status === "bloqueado" ? "bloqueou" : "liberou";
    const escopo = record.gerencia_sigla
      ? `para a Gerência ${record.gerencia_sigla}`
      : record.diretoria_sigla
      ? `para a Diretoria ${record.diretoria_sigla}`
      : record.escopo_tipo === "perfil"
      ? `para o Perfil ${record.perfil}`
      : "para todos os setores";
    const per = record.periodo_nome ? ` no período "${record.periodo_nome}"` : "";

    if (log.acao === "ATIVAR") {
      texto = <>{cargo} {funcName} ativou a restrição da atividade "{act}" ({mod}) {escopo}{per}.</>;
    } else if (log.acao === "DESATIVAR") {
      texto = <>{cargo} {funcName} desativou a restrição da atividade "{act}" ({mod}) {escopo}{per}.</>;
    } else if (log.acao === "EXCLUIR") {
      texto = <>{cargo} {funcName} excluiu a regra de restrição da atividade "{act}" ({mod}) {escopo}{per}.</>;
    } else {
      texto = <>{cargo} {funcName} {st} a atividade "{act}" ({mod}) {escopo}{per}.</>;
    }
  } else {
    texto = <>{cargo} {funcName} realizou uma alteração no registro ID {String(log.registro_id ?? "").substring(0, 8)}{statusText ? <>. O status foi atualizado para <strong>{statusText}</strong></> : ""}.</>;
  }

  return (
    <div className="bg-blue-50/50 p-4 rounded-md border border-blue-100 text-sm text-blue-900 mb-4 leading-relaxed">
      <strong>Resumo da Ação:</strong> {texto}
    </div>
  );
}

export function AdminLogsAtividades() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<Record<string, unknown> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("ativos");

  // Estado para o AlertDialog de confirmação de exclusão permanente
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);

  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["logs-atividades"],
    queryFn: getLogsAtividades,
  });

  const { data: lixeiraLogs = [], isLoading: isLoadingLixeira } = useQuery({
    queryKey: ["lixeira-logs-atividades"],
    queryFn: getLixeiraLogsAtividades,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-nomes"],
    queryFn: getFuncionariosNomes,
  });

  const funcionariosMap = (funcionarios as FuncionarioInfo[]).reduce((acc: Record<string, FuncionarioInfo>, func: FuncionarioInfo & { matricula?: string | number }) => {
    if (func && func.matricula !== undefined && func.matricula !== null && String(func.matricula).trim() !== "") {
      acc[String(func.matricula).trim()] = func;
    }
    return acc;
  }, {});

  const getFuncNome = (matricula: unknown): string | undefined => {
    if (matricula === null || matricula === undefined || String(matricula).trim() === "") return undefined;
    const cleanMat = String(matricula).trim();
    return funcionariosMap[cleanMat]?.nome;
  };

  const getHierarquia = (matricula: unknown) => {
    const matStr = String(matricula ?? "").trim();
    if (matStr === 'admin123' || matStr === 'admin') return "Administrador do Sistema";
    const func = funcionariosMap[matStr];
    if (!func) return "Desconhecido";
    if (func.diretoria_id && !func.gerencia_id) return "Diretoria";
    if (func.gerencia_id) return "Gerência";
    return "Funcionário";
  };

  const getActionBadgeColor = (acao: unknown) => {
    switch (String(acao ?? "").toUpperCase()) {
      case "CRIAR":
        return "bg-green-100 text-green-800";
      case "EDITAR":
        return "bg-blue-100 text-blue-800";
      case "EXCLUIR":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTableNameFriendly = (tableName: unknown) => {
    const name = String(tableName ?? "");
    switch (name) {
      case "itens_catalogo": return "Catálogo";
      case "solicitacoes": return "Solicitações";
      case "servicos_catalogo": return "Serviços";
      default: return name;
    }
  };

  const getFieldNameFriendly = (fieldName: unknown) => {
    const name = String(fieldName ?? "");
    const fieldMap: Record<string, string> = {
      "qtd_estimada": "Quantidade Estimada",
      "valor_estimado": "Valor Estimado",
      "valor_unitario": "Valor Unitário",
      "valor_total": "Valor Total",
      "descricao": "Descrição",
      "status": "Status",
      "diretoria_id": "ID Diretoria",
      "gerencia_id": "ID Gerência",
      "periodo_id": "ID Período",
      "centro_custo": "Centro de Custo",
      "tipo": "Tipo",
      "matricula": "Matrícula",
      "nome": "Nome",
      "codigo_hash": "Código Hash",
      "ativo": "Ativo",
      "created_at": "Data de Criação",
      "updated_at": "Última Atualização",
      "escopo": "Escopo",
      "unidade_medida": "Unidade de Medida",
      "natureza_despesa": "Natureza da Despesa",
      "meta_estrategica": "Meta Estratégica",
      "mes_previsto": "Mês Previsto",
      "acao": "Ação Realizada",
      "status_novo": "Novo Status",
      "status_anterior": "Status Anterior"
    };
    return fieldMap[name] || toTitleCase(name.replaceAll(/_/g, " "));
  };

  const getFieldValueFriendly = (key: string, value: unknown) => {
    if (key === "acao") {
      const actionMap: Record<string, string> = {
        updateSolicitacaoStatusBulk: "Atualização em Massa de Status",
        updateSolicitacaoStatus: "Atualização de Status",
      };
      return actionMap[String(value ?? "")] || String(value ?? "");
    }
    
    const keyLower = String(key ?? "").toLowerCase();
    if ((keyLower.includes("valor") || keyLower.includes("dotacao")) && !Number.isNaN(Number.parseFloat(String(value ?? "")))) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value as string | number));
    }

    if (typeof value === "string") {
      if (value === "aprovado") return "Aprovado";
      if (value === "enviado") return "Enviado para Aprovação";
      if (value === "rascunho") return "Rascunho";
      if (value === "reprovado") return "Reprovado";
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value ?? "");
  };

  const currentLogs = activeTab === "ativos" ? logs : lixeiraLogs;
  const isLoadingCurrent = activeTab === "ativos" ? isLoadingLogs : isLoadingLixeira;

  const filteredLogs = currentLogs.filter((log: Record<string, unknown>) => {
    const term = searchTerm.toLowerCase();
    const mat = String(log.matricula ?? "");
    const acao = String(log.acao ?? "");
    const tab = String(log.tabela_afetada ?? "");
    const funcName = String(getFuncNome(mat) ?? "").toLowerCase();
    return (
      mat.toLowerCase().includes(term) ||
      funcName.includes(term) ||
      acao.toLowerCase().includes(term) ||
      tab.toLowerCase().includes(term)
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
  }, [searchTerm, activeTab]);

  const toggleSelectAll = () => {
    const paginatedIds = paginationData.paginatedItems.map((log: Record<string, unknown>) => log.id as string);
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
    mutationFn: activeTab === "ativos" ? deleteLogAtividade : hardDeleteLogAtividade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["lixeira-logs-atividades"] });
      toast.success(activeTab === "ativos" ? "Log movido para lixeira" : "Log excluído permanentemente");
      setSelectedIds([]);
      setConfirmDeleteId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir log");
      setConfirmDeleteId(null);
    }
  });

  // Handler para iniciar exclusão: na Lixeira pede confirmação, nos Ativos soft-deleta direto
  const handleDeleteSingle = (id: string) => {
    if (activeTab === "lixeira") {
      setConfirmDeleteId(id);
    } else {
      deleteMutation.mutate(id);
    }
  };

  // Handler para exclusão em massa: na Lixeira pede confirmação
  const handleDeleteBulk = () => {
    if (activeTab === "lixeira") {
      setConfirmDeleteBulk(true);
    } else {
      deleteBulkMutation.mutate(selectedIds);
    }
  };

  const deleteBulkMutation = useMutation({
    mutationFn: activeTab === "ativos" ? deleteLogsAtividadeBulk : hardDeleteLogsAtividadeBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["lixeira-logs-atividades"] });
      toast.success(`${selectedIds.length} logs ${activeTab === "ativos" ? "movidos para lixeira" : "excluídos permanentemente"}`);
      setSelectedIds([]);
      setConfirmDeleteBulk(false);
    },
    onError: () => {
      toast.error("Erro ao excluir logs");
      setConfirmDeleteBulk(false);
    }
  });

  const restoreMutation = useMutation({
    mutationFn: restoreLogAtividade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["lixeira-logs-atividades"] });
      toast.success("Log restaurado com sucesso");
      setSelectedIds([]);
    },
    onError: () => toast.error("Erro ao restaurar log")
  });

  const restoreBulkMutation = useMutation({
    mutationFn: restoreLogsAtividadeBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["lixeira-logs-atividades"] });
      toast.success(`${selectedIds.length} logs restaurados com sucesso`);
      setSelectedIds([]);
    },
    onError: () => toast.error("Erro ao restaurar logs")
  });

  // Funções de Exportação
  const exportToExcel = () => {
    try {
      const dataToExport = filteredLogs.map((log: Record<string, unknown>) => {
        const mat = String(log.matricula ?? "");
        return {
          "Data/Hora": formatSafeDate(log.created_at, "dd/MM/yyyy HH:mm:ss"),
          "Funcionário": mat === 'admin123' || mat === 'admin' ? "Administrador do Sistema" : (toTitleCase(getFuncNome(mat) || "Nome não encontrado")),
          "Matrícula": mat,
          "Ação": toTitleCase(log.acao),
          "Tabela Afetada": getTableNameFriendly(log.tabela_afetada),
          "ID Registro": String(log.registro_id ?? ""),
          "Detalhes Payload": JSON.stringify(log.detalhes || {})
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Logs de Atividades");
      XLSX.writeFile(workbook, `Logs_Atividades_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
      toast.success("Relatório Excel exportado com sucesso");
    } catch (_e) {
      console.error("Erro ao exportar Excel:", _e);
      toast.error("Erro ao exportar Excel");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text("Relatório de Logs de Atividades", 14, 15);
      
      const tableColumn = ["Data/Hora", "Funcionário", "Ação", "Tabela", "ID Registro"];
      const tableRows = filteredLogs.map((log: Record<string, unknown>) => {
        const mat = String(log.matricula ?? "");
        const nome = mat === 'admin123' || mat === 'admin' ? "Administrador" : (toTitleCase(getFuncNome(mat) || "Desconhecido"));
        return [
          formatSafeDate(log.created_at, "dd/MM/yyyy HH:mm:ss"),
          nome,
          toTitleCase(log.acao),
          getTableNameFriendly(log.tabela_afetada),
          log.registro_id ? String(log.registro_id).substring(0, 8) + "..." : "-"
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
      });

      doc.save(`Logs_Atividades_${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.success("Relatório PDF exportado com sucesso");
    } catch (_e) {
      console.error("Erro ao exportar PDF:", _e);
      toast.error("Erro ao exportar PDF");
    }
  };

  return (
    <Card className="p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Logs de Atividades</h2>
            <p className="text-muted-foreground">
              Acompanhe o registro de todas as alterações feitas no sistema.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
              <TabsTrigger value="lixeira">Lixeira</TabsTrigger>
            </TabsList>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar matrícula, nome ou tabela..."
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
            {activeTab === "lixeira" && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 flex items-center gap-1"
                onClick={() => restoreBulkMutation.mutate(selectedIds)}
                disabled={restoreBulkMutation.isPending}
              >
                <ArchiveRestore className="h-4 w-4" />
                Devolver Selecionados
              </Button>
            )}
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8 flex items-center gap-1"
              onClick={handleDeleteBulk}
              disabled={deleteBulkMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {activeTab === "lixeira" ? "Excluir Permanentemente" : "Excluir Selecionados"}
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
                  checked={paginationData.paginatedItems.length > 0 && paginationData.paginatedItems.every((log: Record<string, unknown>) => selectedIds.includes(log.id as string))}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="created_at" sortConfig={sortConfig} onRequestSort={requestSort}>Data / Hora</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="matricula" sortConfig={sortConfig} onRequestSort={requestSort}>Funcionário</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="acao" sortConfig={sortConfig} onRequestSort={requestSort}>Ação</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="tabela_afetada" sortConfig={sortConfig} onRequestSort={requestSort}>Tabela</SortableTableHead>
              <SortableTableHead className="cursor-pointer hover:text-slate-900" field="registro_id" sortConfig={sortConfig} onRequestSort={requestSort}>ID Registro</SortableTableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              if (isLoadingCurrent) {
                return (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                );
              }
              
              if (paginationData.paginatedItems.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                );
              }
              
              return paginationData.paginatedItems.map((log: Record<string, unknown>) => (
                <TableRow key={log.id as string} data-state={selectedIds.includes(log.id as string) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(log.id as string)}
                      onCheckedChange={() => toggleSelectLog(log.id as string)}
                    />
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatSafeDate(log.created_at, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm flex items-center gap-2">
                          {String(log.matricula ?? "") === 'admin123' || String(log.matricula ?? "") === 'admin' ? (
                            <span className="text-primary flex items-center gap-1">
                              Administrador do Sistema
                            </span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-primary flex items-center gap-1 cursor-help">
                                  {toTitleCase(getFuncNome(String(log.matricula ?? "")) || "Nome não encontrado")}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{getHierarquia(String(log.matricula ?? ""))}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Mat: {String(log.matricula ?? "")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionBadgeColor(log.acao)}>
                      {toTitleCase(log.acao)}
                    </Badge>
                  </TableCell>
                  <TableCell>{getTableNameFriendly(log.tabela_afetada)}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate" title={String(log.registro_id ?? "")}>
                    {String(log.registro_id ?? "-")}
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
                          onSelect={(_e) => {
                            // Deixa o menu fechar completamente antes de abrir o modal
                            // Isso evita o bug de travamento de cliques (pointer-events) do Radix UI
                            setTimeout(() => setSelectedLog(log), 150);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {activeTab === "lixeira" && (
                          <DropdownMenuItem 
                            onClick={() => restoreMutation.mutate(log.id as string)}
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Devolver Log
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-red-600 focus:bg-red-50 focus:text-red-600"
                          onClick={() => handleDeleteSingle(log.id as string)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {activeTab === "lixeira" ? "Excluir Permanentemente" : "Mover para Lixeira"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>
      </div>

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

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold">Ação</p>
                  <Badge variant="outline" className={getActionBadgeColor(selectedLog.acao)}>
                    {toTitleCase(selectedLog.acao)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold">Data</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {formatSafeDate(selectedLog.created_at, "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Funcionário</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {String(selectedLog.matricula ?? "") === 'admin123' || String(selectedLog.matricula ?? "") === 'admin' 
                      ? "Administrador do Sistema" 
                      : toTitleCase(getFuncNome(String(selectedLog.matricula ?? "")) || "Desconhecido")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Nível / Hierarquia</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {String(selectedLog.matricula ?? "") === 'admin123' || String(selectedLog.matricula ?? "") === 'admin' 
                      ? "Administração do Sistema"
                      : getHierarquia(String(selectedLog.matricula ?? ""))}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Matrícula</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {String(selectedLog.matricula ?? "")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Tabela Afetada</p>
                  <p className="mt-1 text-primary font-medium text-sm">{String(selectedLog.tabela_afetada ?? "")}</p>
                </div>
                
                {(() => {
                  let parsedDetalhes: Record<string, unknown> = {};
                  try {
                    if (selectedLog.detalhes) {
                      if (typeof selectedLog.detalhes === 'object') {
                        parsedDetalhes = selectedLog.detalhes as Record<string, unknown>;
                      } else if (typeof selectedLog.detalhes === 'string') {
                        const parsed = JSON.parse(selectedLog.detalhes);
                        if (typeof parsed === 'object' && parsed !== null) {
                          parsedDetalhes = parsed;
                        } else {
                          parsedDetalhes = { valor: String(parsed) };
                        }
                      }
                    }
                  } catch (_e) {
                    parsedDetalhes = { erro_parse: "Não foi possível exibir detalhes estruturados.", original: String(selectedLog.detalhes) };
                  }
                  
                  const hasDetails = parsedDetalhes && typeof parsedDetalhes === 'object' && Object.keys(parsedDetalhes).length > 0;
                  
                  return (
                    <div className="col-span-1 md:col-span-2">
                      <LogNarrative log={selectedLog} funcionariosMap={funcionariosMap} getFuncNome={getFuncNome} />
                      {hasDetails && (
                        <>
                          <p className="text-sm font-semibold mb-2">Dados Modificados / Inseridos</p>
                          <div className="rounded-md border bg-muted/10 overflow-x-auto">
                            <Table className="min-w-[400px]">
                              <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="h-8 py-2 text-sm font-semibold text-foreground">Campo Afetado</TableHead>
                                  <TableHead className="h-8 py-2 text-sm font-semibold text-foreground">Novo Valor Registrado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {Object.entries(parsedDetalhes)
                                  .filter(([key]) => !key.toLowerCase().endsWith('_id') && key.toLowerCase() !== 'id')
                                  .map(([key, value]) => (
                                  <TableRow key={key}>
                                    <TableCell className="font-semibold text-sm py-2">
                                      {getFieldNameFriendly(key)}
                                    </TableCell>
                                    <TableCell className="text-sm py-2 font-medium text-primary">
                                      {value === null || value === undefined 
                                        ? <span className="text-muted-foreground italic">Vazio (Nulo)</span> 
                                        : getFieldValueFriendly(key, value)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação para exclusão permanente individual */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. O registro de log será excluído permanentemente da base de dados e não poderá ser recuperado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Sim, Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmação para exclusão permanente em massa */}
      <AlertDialog open={confirmDeleteBulk} onOpenChange={(open) => !open && setConfirmDeleteBulk(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir {selectedIds.length} registro(s) permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Os {selectedIds.length} registro(s) de log selecionados serão excluídos permanentemente e não poderão ser recuperados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBulkMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBulkMutation.isPending}
              onClick={() => deleteBulkMutation.mutate(selectedIds)}
            >
              {deleteBulkMutation.isPending ? "Excluindo..." : `Sim, Excluir ${selectedIds.length} Permanentemente`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </Tabs>
    </Card>
  );
}
