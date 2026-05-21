import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, TrendingUp, FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
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
import { getDiretorias, getPeriodosAtivos, getSolicitacoesCompras, getServicosCompras } from "@/lib/services.ts";
import { getPrioridadeBadgeVariant } from "@/lib/prioridade.ts";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ComprasPanel = () => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"aquisicao" | "servicos" | "servicos_existentes" | "servicos_novos" | null>(null);
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("todas");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedServicos, setSelectedServicos] = useState<Set<string>>(new Set());
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [servicosPage, setServicosPage] = useState(1);
  const [servicosPerPage, setServicosPerPage] = useState(25);

  // Buscar diretorias
  const { data: diretorias = [] } = useQuery({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
  });

  const { data: periodos = [] } = useQuery({
    queryKey: ["periodos"],
    queryFn: getPeriodosAtivos,
  });

  const periodAtivo = periodos[0] as any;

  const { data: solicitacoesCompras = [] } = useQuery({
    queryKey: ["solicitacoes-compras", periodAtivo?.id],
    queryFn: () => (periodAtivo ? getSolicitacoesCompras(periodAtivo.id) : []),
    enabled: !!periodAtivo,
  });

  const { data: servicosCompras = [] } = useQuery({
    queryKey: ["servicos-compras", periodAtivo?.id],
    queryFn: () => (periodAtivo ? getServicosCompras(periodAtivo.id) : []),
    enabled: !!periodAtivo,
  });

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

  const allServicos: ServicoItem[] = useMemo(() => servicosCompras.map((s: any) => ({
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
  })), [servicosCompras, diretoriasById]);

  const normalizeFilterValue = (value?: string | null) =>
    (value || "").trim().toUpperCase();

  const filteredItems = useMemo(() => {
    const diretoriaSelecionada = normalizeFilterValue(selectedDiretoria);
    const categoriaSelecionada = selectedCategoria.trim();

    return allApprovedItems.filter((item) => {
      const matchesDiretoria =
        diretoriaSelecionada === "TODAS" ||
        normalizeFilterValue(item.diretoriaSigla) === diretoriaSelecionada;
      const matchesCategoria =
        categoriaSelecionada === "todas" ||
        (item.categoria || "").trim() === categoriaSelecionada;
      return matchesDiretoria && matchesCategoria;
    });
  }, [allApprovedItems, selectedDiretoria, selectedCategoria]);

  const categorias = useMemo(
    () => Array.from(new Set(allApprovedItems.map(item => item.categoria).filter(Boolean))).sort(),
    [allApprovedItems]
  );

  const filteredServicos = useMemo(() => allServicos.filter((servico) => {
    const diretoriaSelecionada = normalizeFilterValue(selectedDiretoria);
    const matchesDiretoria =
      diretoriaSelecionada === "TODAS" ||
      normalizeFilterValue(servico.diretoriaSigla) === diretoriaSelecionada;

    const matchesTipo = selectedOption === "servicos_novos"
      ? (servico.tipoContratacao ?? (servico as any).tipo_contratacao) === "Novo"
      : (servico.tipoContratacao ?? (servico as any).tipo_contratacao) !== "Novo";

    return matchesDiretoria && matchesTipo;
  }), [allServicos, selectedDiretoria, selectedOption]);

  const isServicoReadOnly = (servico: ServicoItem) => servico.status !== "rascunho";

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
  }, [selectedDiretoria, selectedCategoria, itemsPerPage]);

  useEffect(() => {
    setServicosPage(1);
  }, [selectedDiretoria, servicosPerPage]);

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
                  className="group bg-card rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-blue-50 group-hover:bg-blue-100 transition-colors border">
                      <img
                        src="/assets/images/servico_existente.png"
                        alt="Serviços Existentes"
                        className="w-16 h-16 object-contain"
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
                  className="group bg-card rounded-xl border-2 border-border hover:border-green-500 hover:shadow-xl transition-all duration-200 p-8 text-center flex flex-col items-center"
                >
                  <div className="mb-4 flex justify-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-green-50 group-hover:bg-green-100 transition-colors border">
                      <img
                        src="/assets/images/novo_servico_gerado.png"
                        alt="Novos Serviços"
                        className="w-16 h-16 object-contain"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <ShoppingBag className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Serviços</p>
                    <p className="text-2xl font-bold">{filteredServicos.length}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold">{formatCurrency(totalServicos)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Filtros e Exports */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
                <SelectTrigger className="w-48">
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
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportServicosExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportServicosPDF}>
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>

            {/* Tabela de Serviços */}
            <div className="bg-white rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableHead className="text-center">Estimativa Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServicos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum serviço em compras
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedServicos.map((servico) => (
                      <TableRow key={servico.id} className={isServicoReadOnly(servico) ? "opacity-75" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={servico.id ? selectedServicos.has(servico.id) : false}
                            onCheckedChange={() => servico.id && !isServicoReadOnly(servico) && toggleSelectServico(servico.id)}
                            disabled={isServicoReadOnly(servico)}
                          />
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{servico.objeto}</TableCell>
                        <TableCell>{servico.gerencia}</TableCell>
                        <TableCell><Badge variant="outline">{servico.diretoriaSigla}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{servico.justificativa || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={getPrioridadeBadgeVariant(servico.grauPrioridade) as any}>
                            {servico.grauPrioridade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">
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
      <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 card-shadow border-l-4 border-l-success">
          <p className="text-sm text-muted-foreground">Itens Aprovados</p>
          <p className="text-2xl font-bold">{filteredItems.length}</p>
        </Card>
        <Card className="p-4 card-shadow border-l-4 border-l-info">
          <p className="text-sm text-muted-foreground">Valor Total</p>
          <p className="text-2xl font-bold">{formatCurrency(totalValor)}</p>
        </Card>
        <Card className="p-4 card-shadow border-l-4 border-l-primary">
          <p className="text-sm text-muted-foreground">Diretorias</p>
          <p className="text-2xl font-bold">{diretorias.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-6 pb-4 flex gap-3">
        <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
          <SelectTrigger className="w-[250px] bg-card">
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
          <SelectTrigger className="w-[250px] bg-card">
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
          <Button variant="outline" onClick={() => setSelectedCategoria("todas")}>
            Limpar categoria
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            Nenhum item encontrado com a categoria selecionada.
          </div>
        ) : (
          <Card className="card-shadow overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-foreground">
                Itens de Compras ({filteredItems.length})
              </h2>
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{selectedItems.size} selecionado(s)</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
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
                  <TableHead className="min-w-[180px]">Obs.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((item) => (
                  <TableRow key={`${item.codigo}`} className="hover:bg-muted/30">
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

