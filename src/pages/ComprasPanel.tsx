import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, TrendingUp, FileDown, FileSpreadsheet, Search } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { AccessCodeScreen } from "@/components/ui/AccessCodeScreen.tsx";
import { PlanItem, SolicitacaoStatus, ServicoItem, GrauPrioridade } from "@/types/plan.ts";
import { getDiretorias, getPeriodosAtivos, getSolicitacoesCompras, getServicosCompras, updateSolicitacaoStatusBulk, updateServicoStatusBulk } from "@/lib/services.ts";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade.ts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ComprasPanel = () => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | "servicos_existentes" | "servicos_novos" | null>(null);
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("todas");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedServicos, setSelectedServicos] = useState<Set<string>>(new Set());
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [servicosPage, setServicosPage] = useState(1);
  const [servicosPerPage, setServicosPerPage] = useState(25);

  // Buscar diretorias
  const { data: diretorias = [], isLoading: loadingDir } = useQuery({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
  });

  const { data: periodos = [], isLoading: loadingPer } = useQuery({
    queryKey: ["periodos"],
    queryFn: getPeriodosAtivos,
  });

  const periodAtivo = periodos[0] as any;

  const { data: solicitacoesCompras = [], isLoading: loadingSol } = useQuery({
    queryKey: ["solicitacoes-compras", periodAtivo?.id],
    queryFn: () => (periodAtivo ? getSolicitacoesCompras(periodAtivo.id) : []),
    enabled: !!periodAtivo,
  });

  const { data: servicosCompras = [], isLoading: loadingSer } = useQuery({
    queryKey: ["servicos-compras", periodAtivo?.id],
    queryFn: () => (periodAtivo ? getServicosCompras(periodAtivo.id) : []),
    enabled: !!periodAtivo,
  });

  const isLoading = loadingDir || loadingPer || (!!periodAtivo && (loadingSol || loadingSer));

  const queryClient = useQueryClient();
  const diretoriasById = useMemo(() => {
    const entries = diretorias.map((dir: any) => [dir.id, dir.sigla]);
    return new Map<string, string>(entries as any);
  }, [diretorias]);

  const allApprovedItems: PlanItem[] = useMemo(() => solicitacoesCompras.map((s: any) => ({
    id: s.id,
    codigo: s.codigo,
    descricao: s.descricao,
    categoria: s.categoria || "diversos",
    unidade: s.unidade || "un",
    qtdEstimada: s.qtd_estimada || 0,
    valorUnitario: s.valor_unitario || 0,
    prioridade: s.prioridade || "Média",
    gerencia: s.gerencias?.sigla || "N/A",
    diretoriaSigla: diretoriasById.get(s.diretoria_id) || s.diretorias?.sigla || "N/A",
    observacao: s.observacao || "",
    status: s.status as SolicitacaoStatus,
  })), [solicitacoesCompras, diretoriasById]);

  const mapServico = (s: any): ServicoItem => ({
    id: s.id,
    item: s.item,
    tipoContratacao: s.tipo_contratacao,
    unidadeDemandante: s.unidade_demandante,
    objeto: s.objeto,
    justificativa: s.justificativa || "",
    previsaoInicio: s.previsao_inicio,
    estimativaValor: s.estimativa_valor,
    dotacaoOrcamentaria: s.dotacao_orcamentaria,
    grauPrioridade: s.grau_prioridade as GrauPrioridade,
    vinculacao: s.vinculacao as "Sim" | "Não",
    dependenciaDescricao: s.dependencia_descricao,
    gerencia: s.gerencias?.sigla || "N/A",
    diretoriaSigla: diretoriasById.get(s.diretoria_id) || s.diretorias?.sigla || "N/A",
    status: s.status as SolicitacaoStatus,
    observacao: s.observacao,
  });

  const allServicosNovos: ServicoItem[] = useMemo(() => servicosCompras.filter((s: any) => s.tipo_contratacao === "Novo").map(mapServico), [servicosCompras, diretoriasById]);
  const allServicosCatalogo: ServicoItem[] = useMemo(() => servicosCompras.filter((s: any) => s.tipo_contratacao !== "Novo").map(mapServico), [servicosCompras, diretoriasById]);

  const normalizeFilterValue = (value?: string | null) =>
    (value || "").trim().toUpperCase();

  const filteredItems = useMemo(() => {
    const diretoriaSelecionada = normalizeFilterValue(selectedDiretoria);
    const categoriaSelecionada = selectedCategoria.trim();
    const termo = searchTerm.trim().toLowerCase();

    return allApprovedItems.filter((item) => {
      const matchesDiretoria =
        diretoriaSelecionada === "TODAS" ||
        normalizeFilterValue(item.diretoriaSigla) === diretoriaSelecionada;
      const matchesCategoria =
        categoriaSelecionada === "todas" ||
        (item.categoria || "").trim() === categoriaSelecionada;
        
      const matchesSearch = termo === "" ||
        String(item.codigo).toLowerCase().includes(termo) ||
        item.descricao.toLowerCase().includes(termo) ||
        (item.observacao || "").toLowerCase().includes(termo);

      return matchesDiretoria && matchesCategoria && matchesSearch;
    });
  }, [allApprovedItems, selectedDiretoria, selectedCategoria, searchTerm]);

  const categorias = useMemo(
    () => Array.from(new Set(allApprovedItems.map(item => item.categoria).filter(Boolean))).sort(),
    [allApprovedItems]
  );

  const filteredServicos = useMemo(() => {
    const sourceList = selectedOption === "servicos_novos" ? allServicosNovos : allServicosCatalogo;
    const termo = searchTerm.trim().toLowerCase();

    return sourceList.filter((servico) => {
      const diretoriaSelecionada = normalizeFilterValue(selectedDiretoria);
      const matchesDiretoria =
        diretoriaSelecionada === "TODAS" ||
        normalizeFilterValue(servico.diretoriaSigla) === diretoriaSelecionada;

      const matchesSearch = termo === "" ||
        servico.objeto.toLowerCase().includes(termo) ||
        (servico.justificativa || "").toLowerCase().includes(termo);

      return matchesDiretoria && matchesSearch;
    });
  }, [allServicosNovos, allServicosCatalogo, selectedOption, selectedDiretoria, searchTerm]);

  const updateSolicitacoesMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: SolicitacaoStatus }) => {
      await updateSolicitacaoStatusBulk(ids, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-compras"] });
      setSelectedItems(new Set());
    }
  });

  const updateServicosMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: SolicitacaoStatus }) => {
      await updateServicoStatusBulk(ids, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servicos-compras"] });
      setSelectedServicos(new Set());
    }
  });

  const handleMarcarConcluidoAquisicoes = (isRevert = false) => {
    if (selectedItems.size === 0) return;
    const idsToUpdate = Array.from(selectedItems).map(idStr => {
      const item = allApprovedItems.find(i => String(i.codigo) === idStr);
      return item?.id;
    }).filter(Boolean) as string[];
    
    updateSolicitacoesMutation.mutate({ ids: idsToUpdate, status: isRevert ? "em_compra" : "concluido" });
  };

  const handleMarcarConcluidoServicos = (isRevert = false) => {
    if (selectedServicos.size === 0) return;
    updateServicosMutation.mutate({ ids: Array.from(selectedServicos), status: isRevert ? "em_compra" : "concluido" });
  };

  const selectedAquisicoesAreCompleted = useMemo(() => {
    if (selectedItems.size === 0) return false;
    const selected = Array.from(selectedItems).map(idStr => allApprovedItems.find(i => String(i.codigo) === idStr));
    return selected.every(i => i?.status === 'concluido');
  }, [selectedItems, allApprovedItems]);

  const selectedAquisicoesAreMixed = useMemo(() => {
    if (selectedItems.size === 0) return false;
    const statuses = Array.from(selectedItems).map(idStr => allApprovedItems.find(i => String(i.codigo) === idStr)?.status);
    return statuses.includes('concluido') && statuses.includes('em_compra');
  }, [selectedItems, allApprovedItems]);

  const selectedServicosAreCompleted = useMemo(() => {
    if (selectedServicos.size === 0) return false;
    const selected = Array.from(selectedServicos).map(id => filteredServicos.find(s => s.id === id));
    return selected.every(s => s?.status === 'concluido');
  }, [selectedServicos, filteredServicos]);

  const selectedServicosAreMixed = useMemo(() => {
    if (selectedServicos.size === 0) return false;
    const statuses = Array.from(selectedServicos).map(id => filteredServicos.find(s => s.id === id)?.status);
    return statuses.includes('concluido') && statuses.includes('em_compra');
  }, [selectedServicos, filteredServicos]);

  const isServicoReadOnly = (servico: ServicoItem) => false;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const totalValor = useMemo(
    () => filteredItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
    [filteredItems]
  );
  const totalServicos = useMemo(
    () => filteredServicos.reduce((acc, servico) => acc + (servico.estimativaValor || 0), 0),
    [filteredServicos]
  );

  useEffect(() => {
    setItemsPage(1);
  }, [selectedDiretoria, selectedCategoria, searchTerm, itemsPerPage]);

  useEffect(() => {
    setServicosPage(1);
  }, [selectedDiretoria, searchTerm, servicosPerPage]);

  const totalItemsPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const totalServicosPages = Math.max(1, Math.ceil(filteredServicos.length / servicosPerPage));

  const paginatedItems = useMemo(() => {
    const start = (itemsPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, itemsPage, itemsPerPage]);

  const paginatedServicos = useMemo(() => {
    const start = (servicosPage - 1) * servicosPerPage;
    return filteredServicos.slice(start, start + servicosPerPage);
  }, [filteredServicos, servicosPage, servicosPerPage]);

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => `${item.codigo}`)));
    }
  };

  const toggleSelectServico = (id: string) => {
    const newSelected = new Set(selectedServicos);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedServicos(newSelected);
  };

  const toggleSelectAllServicos = () => {
    if (selectedServicos.size === filteredServicos.length && filteredServicos.length > 0) {
      setSelectedServicos(new Set());
    } else {
      setSelectedServicos(new Set(filteredServicos.filter(s => s.id).map(s => s.id!)));
    }
  };

  const handleExportExcel = async () => {
    // @ts-ignore
    const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js");
    const XLSX = (xlsxModule as any).default ?? xlsxModule;
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    wsData.push(["Painel de Compras"]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);
    wsData.push(["Codigo", "Descricao", "Diretoria", "Gerencia", "Qtd", "Valor Unit", "Total", "Observacao"]);

    filteredItems.forEach((item) => {
      wsData.push([
        item.codigo,
        item.descricao,
        item.diretoriaSigla || "-",
        item.gerencia,
        item.qtdEstimada,
        item.valorUnitario,
        item.qtdEstimada * item.valorUnitario,
        item.observacao || "",
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Compras");
    const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `Compras_${hoje}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Painel de Compras - Itens aprovados", 14, 12);

    const tableData = filteredItems.map((item) => ([
      item.codigo,
      item.descricao,
      item.diretoriaSigla || "-",
      item.gerencia,
      item.qtdEstimada,
      formatCurrency(item.valorUnitario),
      formatCurrency(item.qtdEstimada * item.valorUnitario),
      item.observacao || "",
    ]));

    autoTable(doc, {
      startY: 18,
      head: [["Codigo", "Descricao", "Dir", "Ger", "Qtd", "Valor Unit", "Total", "Obs"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 50 },
        2: { cellWidth: 10, halign: "center" },
        3: { cellWidth: 10, halign: "center" },
        4: { cellWidth: 10, halign: "center" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 40 },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    doc.save(`Compras_${hoje}.pdf`);
  };

  const handleExportServicosExcel = async () => {
    // @ts-ignore
    const xlsxModule = await import("xlsx-js-style/dist/xlsx.min.js");
    const XLSX = (xlsxModule as any).default ?? xlsxModule;
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    const isNovos = selectedOption === "servicos_novos";
    const categoryTitle = isNovos ? "Novos Serviços" : "Serviços Existentes";
    const categoryFile = isNovos ? "Novos_Servicos" : "Servicos_Existentes";

    wsData.push([`Painel de Compras - ${categoryTitle}`]);
    wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`]);
    wsData.push([]);
    wsData.push(["Objeto", "Diretoria", "Gerencia", "Justificativa", "Prioridade", "Estimativa Valor"]);

    filteredServicos.forEach((servico) => {
      wsData.push([
        servico.objeto,
        servico.diretoriaSigla || "-",
        servico.gerencia,
        servico.justificativa || "",
        servico.grauPrioridade,
        servico.estimativaValor || 0,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 50 }, { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Servicos");
    const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(wb, `Compras_${categoryFile}_${hoje}.xlsx`);
  };

  const handleExportServicosPDF = () => {
    const isNovos = selectedOption === "servicos_novos";
    const categoryTitle = isNovos ? "Novos Serviços" : "Serviços Existentes";
    const categoryFile = isNovos ? "Novos_Servicos" : "Servicos_Existentes";

    const doc = new jsPDF({ orientation: "landscape", format: "a4" });
    doc.setFontSize(14);
    doc.text(`PAC 2027 - ${categoryTitle}`, 14, 18);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 25);

    autoTable(doc, {
      head: [["Objeto", "Diretoria", "Gerência", "Justificativa", "Prioridade", "Estimativa"]],
      body: filteredServicos.map((s) => [
        s.objeto.length > 50 ? s.objeto.substring(0, 50) + "…" : s.objeto,
        s.diretoriaSigla || "-",
        s.gerencia,
        (s.justificativa || "-").substring(0, 40),
        s.grauPrioridade,
        formatCurrency(s.estimativaValor || 0),
      ]),
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 250, 246] },
    });

    const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    doc.save(`PAC_2027_${categoryFile}_${hoje}.pdf`);
  };

  if (!authenticated) {
    return (
      <AccessCodeScreen
        title="Setor de Compras"
        subtitle="Gestão de itens aprovados"
        gradientClass="from-slate-700 to-slate-900"
        icon="🛒"
        onAccessGranted={() => setAuthenticated(true)}
        onBack={() => navigate("/")}
        scope="compras"
      />
    );
  }

  // Tela de seleção: Aquisição ou Serviços
  if (!selectedOption) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ top: "200px" }}
        >
          <img
            src="/assets/images/caema-logo.png"
            alt="CAEMA"
            className="w-full max-w-3xl opacity-[0.08]"
          />
        </div>
        <div className="relative z-10">
          {/* Top Bar */}
          <div className="px-6 py-3 bg-card border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </div>
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-5xl">🛒</span>
                <Badge className="bg-white/20 text-white border-none text-xl font-bold">Compras</Badge>
              </div>
              <p className="text-white/80 text-lg">Selecione o tipo de solicitação</p>
            </div>
          </div>

          {/* Opções: Aquisição e Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cartão Aquisição */}
                <button
                  onClick={() => setSelectedOption("aquisicao")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <span className="text-4xl">📦</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Aquisição</h2>
                  <p className="text-muted-foreground">
                    Gerenciar itens aprovados para aquisição de materiais e equipamentos
                  </p>
                </button>

                {/* Cartão Serviços */}
                <button
                  onClick={() => setSelectedOption("servicos")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <span className="text-4xl">🛠️</span>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Serviços</h2>
                  <p className="text-muted-foreground">
                    Gerenciar solicitações de serviços e manutenções
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de seleção: Serviços Existentes ou Novos Serviços
  if (selectedOption === "servicos") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 relative">
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ top: "200px" }}
        >
          <img
            src="/assets/images/caema-logo.png"
            alt="CAEMA"
            className="w-full max-w-3xl opacity-[0.08]"
          />
        </div>
        <div className="relative z-10">
          {/* Top Bar */}
          <div className="px-6 py-3 bg-card border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption(null)}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </div>
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-8">
            <div className="max-w-7xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-5xl">🛠️</span>
                <Badge className="bg-white/20 text-white border-none text-xl font-bold">Serviços</Badge>
              </div>
              <p className="text-white/80 text-lg">Selecione o tipo de serviço que deseja visualizar</p>
            </div>
          </div>

          {/* Opções: Serviços Existentes e Novos Serviços */}
          <div className="px-6 py-12">
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cartão Serviços Existentes */}
                <button
                  onClick={() => setSelectedOption("servicos_existentes")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-[320px]"
                >
                  <div className="mb-4 flex justify-center w-full">
                    <div className="w-48 h-32 bg-amber-50 rounded-lg overflow-hidden flex items-center justify-center border border-amber-100 group-hover:bg-amber-100 transition-colors">
                      <img
                        src="/assets/images/servicos_existentes.png"
                        alt="Serviços Existentes"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Serviços Existentes</h2>
                  <p className="text-muted-foreground">
                    Visualizar contratações recorrentes e serviços já existentes
                  </p>
                </button>

                {/* Cartão Novos Serviços */}
                <button
                  onClick={() => setSelectedOption("servicos_novos")}
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center justify-between min-h-[320px]"
                >
                  <div className="mb-4 flex justify-center w-full">
                    <div className="w-48 h-32 bg-purple-50 rounded-lg overflow-hidden flex items-center justify-center border border-purple-100 group-hover:bg-purple-100 transition-colors">
                      <img
                        src="/assets/images/novos_servicos.png"
                        alt="Novos Serviços"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Novos Serviços</h2>
                  <p className="text-muted-foreground">
                    Visualizar novos serviços e novas demandas de contratação
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se escolheu uma das opções de "Serviços", mostrar tabela de serviços
  if (selectedOption === "servicos_existentes" || selectedOption === "servicos_novos") {
    const isNovos = selectedOption === "servicos_novos";
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl shadow-lg border">
              <div className="h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-semibold text-slate-700">Processando Serviços...</p>
            </div>
          </div>
        )}
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ top: "200px" }}
        >
          <img
            src="/assets/images/caema-logo.png"
            alt="CAEMA"
            className="w-full max-w-3xl opacity-[0.08]"
          />
        </div>
        <div className="relative z-10">
          {/* Top Bar */}
          <div className="px-6 py-3 bg-card border-b">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption("servicos")}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <Badge variant="outline" className="text-xs">
                {isNovos ? "Novos Serviços" : "Serviços Existentes"}
              </Badge>
            </div>
          </div>

          {/* Header */}
          <div className={`bg-gradient-to-r ${isNovos ? "from-emerald-600 to-emerald-800" : "from-blue-600 to-blue-800"} px-6 py-6`}>
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold text-white mb-2">
                {isNovos ? "Gestão de Novos Serviços - Compras" : "Gestão de Serviços Existentes - Compras"}
              </h1>
              <p className="text-white/80 text-sm">
                {isNovos 
                  ? "Novos serviços cadastrados e aprovados para processamento" 
                  : "Serviços existentes planejados e aprovados para processamento"}
              </p>
            </div>
          </div>

          {/* Filtros e Stats */}
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 -mt-10 relative z-10">
              <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:-translate-y-1 hover:bg-emerald-50/50 bg-white/95 backdrop-blur">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total de Serviços</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{filteredServicos.length}</p>
                  </div>
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-l-indigo-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:-translate-y-1 hover:bg-indigo-50/50 bg-white/95 backdrop-blur">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Valor Total</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{formatCurrency(totalServicos)}</p>
                  </div>
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Filtros e Exports */}
            <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md">
              <div className="flex flex-1 items-center gap-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por objeto..."
                    className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
                  <SelectTrigger className="w-[220px] bg-slate-50 border-slate-200 text-sm h-10">
                    <SelectValue placeholder="Filtrar por Diretoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Diretorias</SelectItem>
                    {diretorias.map((dir: any) => (
                      <SelectItem key={dir.id} value={dir.sigla}>
                        {dir.sigla}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedServicos.size > 0 && !selectedServicosAreMixed && (
                  <Button 
                    className={`shadow-md gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${selectedServicosAreCompleted ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-none" : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-none"}`}
                    onClick={() => handleMarcarConcluidoServicos(selectedServicosAreCompleted)}
                    disabled={updateServicosMutation.isPending}
                  >
                    {updateServicosMutation.isPending 
                      ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processando...
                          </span>
                        ) 
                      : selectedServicosAreCompleted 
                        ? `Reverter ${selectedServicos.size} para Fila` 
                        : `Marcar ${selectedServicos.size} como Concluído`}
                  </Button>
                )}
                {selectedServicosAreMixed && (
                  <p className="text-sm text-amber-600 font-medium bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">Seleção mista inválida.</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={handleExportServicosExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={handleExportServicosPDF}>
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            {/* Tabela de Serviços */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wide hover:bg-slate-100">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedServicos.size === filteredServicos.length && filteredServicos.length > 0}
                        onCheckedChange={toggleSelectAllServicos}
                      />
                    </TableHead>
                    <TableHead>Objeto</TableHead>
                    <TableHead>Gerência</TableHead>
                    <TableHead>Diretoria</TableHead>
                    <TableHead>Justificativa</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Estimativa Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServicos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        <div className="flex flex-col items-center">
                          <Search className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="text-lg">Nenhum serviço encontrado com a configuração atual.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedServicos.map((servico) => (
                      <TableRow key={servico.id} className={`transition-colors group hover:shadow-inner hover:bg-slate-50/80 ${servico.status === 'concluido' ? 'bg-slate-50/50 opacity-90' : 'bg-white'} ${isServicoReadOnly(servico) ? 'opacity-75' : ''}`}>
                        <TableCell>
                          <Checkbox
                            checked={servico.id ? selectedServicos.has(servico.id) : false}
                            onCheckedChange={() => servico.id && !isServicoReadOnly(servico) && toggleSelectServico(servico.id)}
                            disabled={isServicoReadOnly(servico)}
                          />
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-medium text-slate-700">{servico.objeto}</TableCell>
                        <TableCell>{servico.gerencia}</TableCell>
                        <TableCell><Badge variant="outline">{servico.diretoriaSigla}</Badge></TableCell>
                        <TableCell className="text-sm text-slate-500 max-w-xs truncate">{servico.justificativa || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getPrioridadeBadgeVariant(servico.grauPrioridade) as any}>
                            {servico.grauPrioridade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={servico.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                            {servico.status === 'concluido' ? 'Concluído' : 'Em Compra'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-slate-700 font-medium">
                          {formatCurrency(servico.estimativaValor || 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredServicos.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-t bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Itens por página</span>
                  <Select value={String(servicosPerPage)} onValueChange={(v) => setServicosPerPage(Number(v))}>
                    <SelectTrigger className="w-[90px] bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-sm text-muted-foreground">Página {servicosPage} de {totalServicosPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={servicosPage <= 1}
                    onClick={() => setServicosPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={servicosPage >= totalServicosPages}
                    onClick={() => setServicosPage((p) => Math.min(totalServicosPages, p + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900/10 z-50 flex items-center justify-center backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 bg-white/90 p-8 rounded-2xl shadow-2xl border border-white/20">
            <div className="relative">
              <div className="h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
              </div>
            </div>
            <p className="font-medium text-slate-700 tracking-wide text-sm uppercase">Processando Dados...</p>
          </div>
        </div>
      )}
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{ top: "200px" }}
      >
        <img
          src="/assets/images/caema-logo.png"
          alt="CAEMA"
          className="w-full max-w-3xl opacity-[0.08]"
        />
      </div>
      <div className="relative z-10">
      <div className="px-6 py-3 bg-card border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedOption(null)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Badge variant="outline" className="text-xs">Painel de Compras</Badge>
          <Badge variant="outline" className="text-xs bg-blue-50">Aquisição</Badge>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-lg">
            <ShoppingBag className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Plano Anual 2027</h1>
            <p className="text-white/80 text-sm">Itens aprovados pela diretoria para processo de aquisição — PAC 2027</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      {/* Summary */}
      <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 -mt-6">
        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:-translate-y-1 hover:bg-emerald-50/50 bg-white/95 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Itens Aprovados</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{filteredItems.length}</p>
            </div>
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><ShoppingBag className="w-5 h-5" /></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-indigo-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:-translate-y-1 hover:bg-indigo-50/50 bg-white/95 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Valor Total</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{formatCurrency(totalValor)}</p>
            </div>
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><ArrowLeft className="w-5 h-5 -rotate-45" /></div>
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-l-cyan-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:-translate-y-1 hover:bg-cyan-50/50 bg-white/95 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Diretorias</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{diretorias.length}</p>
            </div>
            <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg"><Search className="w-5 h-5" /></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      {/* Filters */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-3 items-center transition-all hover:shadow-md">
          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por código ou descrição..."
              className="pl-9 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
            <SelectTrigger className="w-[220px] bg-slate-50 border-slate-200 text-sm h-10">
              <SelectValue placeholder="Filtrar por Diretoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Diretorias</SelectItem>
              {diretorias.map((dir: any) => (
                <SelectItem key={dir.sigla} value={dir.sigla}>{dir.sigla} - {dir.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
            <SelectTrigger className="w-[220px] bg-slate-50 border-slate-200 text-sm h-10">
              <SelectValue placeholder="Filtrar por Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Categorias</SelectItem>
              {categorias.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCategoria !== "todas" && (
            <Button variant="ghost" className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 h-10 px-3 text-sm" onClick={() => setSelectedCategoria("todas")}>
            Limpar categoria
          </Button>
        )}
        
        {selectedItems.size > 0 && !selectedAquisicoesAreMixed && (
          <Button 
            className={`shadow-md gap-2 ml-auto transition-all hover:shadow-lg hover:-translate-y-0.5 ${selectedAquisicoesAreCompleted ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-none" : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-none"}`}
            onClick={() => handleMarcarConcluidoAquisicoes(selectedAquisicoesAreCompleted)}
            disabled={updateSolicitacoesMutation.isPending}
          >
            {updateSolicitacoesMutation.isPending 
              ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </span>
                )
              : selectedAquisicoesAreCompleted 
                ? `Reverter ${selectedItems.size} para Fila` 
                : `Marcar ${selectedItems.size} como Concluído`}
          </Button>
        )}
        {selectedAquisicoesAreMixed && (
          <p className="text-sm text-amber-600 font-medium ml-auto bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">Seleção mista inválida.</p>
        )}
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center bg-white rounded-xl shadow-sm border border-slate-200">
            <Search className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-lg">Nenhum item encontrado com a configuração atual.</p>
          </div>
        ) : (
          <Card className="shadow-sm border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-slate-50">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-indigo-500" />
                Itens de Compras ({filteredItems.length})
              </h2>
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">{selectedItems.size} selecionado(s)</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 text-slate-600 font-semibold text-xs uppercase tracking-wide hover:bg-slate-100">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[70px]">Código</TableHead>
                  <TableHead className="min-w-[200px]">Descrição</TableHead>
                  <TableHead className="text-center w-[60px]">Dir.</TableHead>
                  <TableHead className="text-center w-[70px]">Ger.</TableHead>
                  <TableHead className="text-center w-[60px]">Qtd.</TableHead>
                  <TableHead className="text-right w-[100px]">Valor Unit.</TableHead>
                  <TableHead className="text-right w-[100px]">Total</TableHead>
                  <TableHead className="text-center w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[180px]">Obs.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow key={`${item.codigo}`} className={`transition-colors group hover:shadow-inner hover:bg-slate-50/80 ${item.status === 'concluido' ? 'bg-slate-50/50 opacity-90' : 'bg-white'}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(`${item.codigo}`)}
                        onCheckedChange={() => toggleSelectItem(`${item.codigo}`)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-primary">{item.codigo}</TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground text-sm">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">{item.categoria}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">{item.diretoriaSigla || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px]">{item.gerencia}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{item.qtdEstimada}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.qtdEstimada * item.valorUnitario)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={item.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                        {item.status === 'concluido' ? 'Concluído' : 'Em Compra'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.observacao || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-t bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Itens por página</span>
              <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-[90px] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-sm text-muted-foreground">Página {itemsPage} de {totalItemsPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={itemsPage <= 1}
                onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={itemsPage >= totalItemsPages}
                onClick={() => setItemsPage((p) => Math.min(totalItemsPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
            <div className="flex gap-2 md:ml-auto">
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
        </Card>
      )}
      </div>
      </div>
    </div>
  );
};

export default ComprasPanel;

