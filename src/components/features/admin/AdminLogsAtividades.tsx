import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Eye, FileSpreadsheet, Trash2, MoreHorizontal, FileDown, ArchiveRestore } from "lucide-react";
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

const toTitleCase = (str: string) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

type FuncionarioInfo = { nome: string; diretoria_id?: string; gerencia_id?: string; [key: string]: unknown };

function LogNarrative({ log, funcionariosMap, getFuncNome }: Readonly<{ log: Record<string, unknown>, funcionariosMap: Record<string, FuncionarioInfo>, getFuncNome: (mat: string) => string }>) {
  const { data: record } = useQuery({
    queryKey: ["record-details", log?.tabela_afetada, log?.registro_id],
    queryFn: () => getRecordDetails(log.tabela_afetada as string, log.registro_id as string),
    enabled: !!log?.registro_id && !!log?.tabela_afetada
  });

  if (!record || !log) return null;

  const funcName = toTitleCase(getFuncNome(log.matricula as string) || "Desconhecido");
  let texto: React.ReactNode = null;

  // Tenta extrair status novo se houver
  let statusText = "";
  try {
    const detalhes = typeof log.detalhes === 'string' ? JSON.parse(log.detalhes) : log.detalhes;
    if (detalhes?.status_novo) {
      const s = detalhes.status_novo;
      let statusFriendly = String(s);
      if (s === 'aprovado') statusFriendly = 'Aprovado';
      else if (s === 'enviado') statusFriendly = 'Enviado para Aprovação';
      else if (s === 'reprovado') statusFriendly = 'Reprovado';
      statusText = statusFriendly;
    }
  } catch (_e) {
    console.warn("Não foi possível parsear detalhes:", _e);
  }
  
  const cargo = (() => {
    const mat = log.matricula as string;
    const firstName = funcName.split(" ")[0].toLowerCase();
    
    let isFeminino = false;
    if (firstName.endsWith('a') || firstName.endsWith('elle') || firstName.endsWith('ele') || firstName.endsWith('ete') || firstName.endsWith('y') || firstName.endsWith('i') || firstName.endsWith('is')) {
      if (!['luca', 'caua', 'cauã', 'joshua', 'noa', 'yuri', 'davi', 'levi', 'kaui', 'rui', 'luis', 'luís'].includes(firstName)) {
        isFeminino = true;
      }
    }
    if (['carmen', 'iris', 'lais', 'laís', 'elis', 'ruth', 'ester', 'raquel', 'miriam', 'sueli', 'cleide', 'ivone'].includes(firstName)) {
      isFeminino = true;
    }

    if (mat === 'admin123' || mat === 'admin') return isFeminino ? "A Administradora do Sistema" : "O Administrador do Sistema";
    const func = funcionariosMap[mat];
    if (!func) return isFeminino ? "A Funcionária" : "O Funcionário";
    if (func.diretoria_id && !func.gerencia_id) return isFeminino ? "A Diretora" : "O Diretor";
    if (func.gerencia_id) return isFeminino ? "A Gerente" : "O Gerente";
    return isFeminino ? "A Funcionária" : "O Funcionário";
  })();

  let actionVerb = "alterou";
  if (statusText === 'Aprovado') actionVerb = "aprovou";
  else if (statusText === 'Enviado para Aprovação') actionVerb = "enviou para aprovação";
  else if (statusText === 'Reprovado') actionVerb = "reprovou";

  const gerenciaText = record?.gerencia ? ` da gerência ${record.gerencia}` : "";

  if (log.tabela_afetada === "solicitacoes" && record.codigo) {
    const itemName = record.descricao || record.objeto || "Item não especificado";
    texto = <>{cargo} {funcName} {actionVerb} a solicitação{gerenciaText} referente ao item "{itemName}" do código {record.codigo}, com quantidade {record.qtd_estimada || 1}.</>;
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
    let detalhesObj: any = {};
    try {
      detalhesObj = typeof log.detalhes === 'string' ? JSON.parse(log.detalhes) : (log.detalhes || {});
    } catch {
      detalhesObj = {};
    }
    const mod = detalhesObj.modulo ? (detalhesObj.modulo.replace(/_/g, " ")) : "módulo";
    const act = detalhesObj.atividade ? (detalhesObj.atividade.replace(/_/g, " ")) : "atividade";
    const st = detalhesObj.status === "bloqueado" ? "bloqueou" : "liberou";
    const escopo = detalhesObj.gerencia_sigla
      ? `para a Gerência ${detalhesObj.gerencia_sigla}`
      : detalhesObj.diretoria_sigla
      ? `para a Diretoria ${detalhesObj.diretoria_sigla}`
      : detalhesObj.escopo_tipo === "perfil"
      ? `para o Perfil ${detalhesObj.perfil}`
      : "para todos os setores";
    const per = detalhesObj.periodo_nome ? ` no período "${detalhesObj.periodo_nome}"` : "";

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
    texto = <>{cargo} {funcName} realizou uma alteração no registro ID {String(log.registro_id).substring(0, 8)}{statusText ? <>. O status foi atualizado para <strong>{statusText}</strong></> : ""}.</>;
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

  const funcionariosMap = (funcionarios as FuncionarioInfo[]).reduce((acc: Record<string, FuncionarioInfo>, func: FuncionarioInfo & { matricula?: string }) => {
    if (func.matricula) acc[func.matricula] = func;
    return acc;
  }, {});

  const getFuncNome = (matricula: string) => funcionariosMap[matricula]?.nome;

  const getHierarquia = (matricula: string) => {
    if (matricula === 'admin123' || matricula === 'admin') return "Administrador do Sistema";
    const func = funcionariosMap[matricula];
    if (!func) return "Desconhecido";
    if (func.diretoria_id && !func.gerencia_id) return "Diretoria";
    if (func.gerencia_id) return "Gerência";
    return "Funcionário";
  };

  const getActionBadgeColor = (acao: string) => {
    switch (acao) {
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

  const getTableNameFriendly = (tableName: string) => {
    switch (tableName) {
      case "itens_catalogo": return "Catálogo";
      case "solicitacoes": return "Solicitações";
      case "servicos_catalogo": return "Serviços";
      default: return tableName;
    }
  };

  const getFieldNameFriendly = (fieldName: string) => {
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
    return fieldMap[fieldName] || toTitleCase(fieldName.replaceAll(/_/g, " "));
  };

  const getFieldValueFriendly = (key: string, value: unknown) => {
    if (key === "acao") {
      const actionMap: Record<string, string> = {
        updateSolicitacaoStatusBulk: "Atualização em Massa de Status",
        updateSolicitacaoStatus: "Atualização de Status",
      };
      return actionMap[value as string] || String(value);
    }
    
    const keyLower = key.toLowerCase();
    if ((keyLower.includes("valor") || keyLower.includes("dotacao")) && !Number.isNaN(Number.parseFloat(value as string))) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value as string | number));
    }

    if (typeof value === "string") {
      if (value === "aprovado") return "Aprovado";
      if (value === "enviado") return "Enviado para Aprovação";
      if (value === "rascunho") return "Rascunho";
      if (value === "reprovado") return "Reprovado";
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  };

  const currentLogs = activeTab === "ativos" ? logs : lixeiraLogs;
  const isLoadingCurrent = activeTab === "ativos" ? isLoadingLogs : isLoadingLixeira;

  const filteredLogs = currentLogs.filter((log: Record<string, unknown>) => {
    const term = searchTerm.toLowerCase();
    const mat = (log.matricula as string) || "";
    const acao = (log.acao as string) || "";
    const tab = (log.tabela_afetada as string) || "";
    const funcName = getFuncNome(mat)?.toLowerCase() || "";
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
    },
    onError: () => toast.error("Erro ao excluir log")
  });

  const deleteBulkMutation = useMutation({
    mutationFn: activeTab === "ativos" ? deleteLogsAtividadeBulk : hardDeleteLogsAtividadeBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logs-atividades"] });
      queryClient.invalidateQueries({ queryKey: ["lixeira-logs-atividades"] });
      toast.success(`${selectedIds.length} logs ${activeTab === "ativos" ? "movidos para lixeira" : "excluídos permanentemente"}`);
      setSelectedIds([]);
    },
    onError: () => toast.error("Erro ao excluir logs")
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
      const dataToExport = filteredLogs.map((log: Record<string, unknown>) => ({
        "Data/Hora": format(new Date(log.created_at as string), "dd/MM/yyyy HH:mm:ss"),
        "Funcionário": log.matricula === 'admin123' || log.matricula === 'admin' ? "Administrador do Sistema" : (toTitleCase(getFuncNome(log.matricula as string) || "Nome não encontrado")),
        "Matrícula": log.matricula,
        "Ação": toTitleCase(log.acao as string),
        "Tabela Afetada": getTableNameFriendly(log.tabela_afetada as string),
        "ID Registro": log.registro_id || "",
        "Detalhes Payload": JSON.stringify(log.detalhes || {})
      }));

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
        const nome = log.matricula === 'admin123' || log.matricula === 'admin' ? "Administrador" : (toTitleCase(getFuncNome(log.matricula as string) || "Desconhecido"));
        return [
          format(new Date(log.created_at as string), "dd/MM/yyyy HH:mm:ss"),
          nome,
          toTitleCase(log.acao as string),
          getTableNameFriendly(log.tabela_afetada as string),
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
                    {format(new Date(log.created_at as string), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm flex items-center gap-2">
                          {log.matricula === 'admin123' || log.matricula === 'admin' ? (
                            <span className="text-primary flex items-center gap-1">
                              Administrador do Sistema
                            </span>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-primary flex items-center gap-1 cursor-help">
                                  {toTitleCase(getFuncNome(log.matricula as string) || "Nome não encontrado")}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{getHierarquia(log.matricula as string)}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Mat: {log.matricula as string}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionBadgeColor(log.acao as string)}>
                      {toTitleCase(log.acao as string)}
                    </Badge>
                  </TableCell>
                  <TableCell>{getTableNameFriendly(log.tabela_afetada as string)}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate" title={log.registro_id as string}>
                    {(log.registro_id as string) || "-"}
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
                          onClick={() => deleteMutation.mutate(log.id as string)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir Registro
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
                  <Badge variant="outline" className={getActionBadgeColor(selectedLog.acao as string)}>
                    {toTitleCase(selectedLog.acao as string)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold">Data</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {format(new Date(selectedLog.created_at as string), "dd/MM/yyyy HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Funcionário</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {selectedLog.matricula === 'admin123' || selectedLog.matricula === 'admin' 
                      ? "Administrador do Sistema" 
                      : toTitleCase(getFuncNome(selectedLog.matricula as string) || "Desconhecido")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Nível / Hierarquia</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {selectedLog.matricula === 'admin123' || selectedLog.matricula === 'admin' 
                      ? "Administração do Sistema"
                      : getHierarquia(selectedLog.matricula as string)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Matrícula</p>
                  <p className="mt-1 text-primary font-medium text-sm">
                    {selectedLog.matricula as string}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Tabela Afetada</p>
                  <p className="mt-1 text-primary font-medium text-sm">{selectedLog.tabela_afetada as string}</p>
                </div>
                
                {(() => {
                  let parsedDetalhes: Record<string, unknown> = {};
                  try {
                    parsedDetalhes = typeof selectedLog.detalhes === 'string' 
                      ? JSON.parse(selectedLog.detalhes) 
                      : selectedLog.detalhes;
                  } catch (_e) {
                    parsedDetalhes = { erro_parse: "Não foi possível exibir detalhes estruturados.", original: selectedLog.detalhes };
                  }
                  
                  return parsedDetalhes && Object.keys(parsedDetalhes).length > 0 && (
                  <div className="col-span-1 md:col-span-2">
                    <LogNarrative log={selectedLog} funcionariosMap={funcionariosMap} getFuncNome={getFuncNome} />
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
                  </div>
                )})()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </Tabs>
    </Card>
  );
}
