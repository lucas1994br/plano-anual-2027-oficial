// deno-lint-ignore-file no-explicit-any
import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, BarChart3, TrendingUp, PieChart as PieChartIcon, Table as TableIcon, Filter, CalendarDays, Activity, Target } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Line
} from "recharts";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils.ts";

// ==================== SIMULATED DATA FOR DASHBOARD ====================
const REAL_DIRETORIAS = ["DG", "DE", "DC", "DO", "PR"];

// Mapeamento em CASCATA: Cada Diretoria tem suas próprias gerências reais
const DIRETORIA_GERENCIAS: Record<string, string[]> = {
  "DG": ["GCFI", "GCON", "GEPE", "GESL", "GSAD"],
  "DE": ["EMAR", "EOBR", "EPRE", "EPRO"],
  "DC": ["CCRC", "CCRF", "CCRR"],
  "DO": ["ODCD", "OCNI", "OCNA", "OCNE", "OCNM", "OCND", "OCNC", "OCNP", "OCNB", "OCSZ", "OCSC", "OCSD", "OCSJ", "OCSI", "OCSU", "OCST"],
  "PR": ["ASCOM", "AUDIT", "PRJ", "PRL", "PRO", "PRR", "UEP", "UTIN"]
};

const MOCK_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const COLORS = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#3B82F6"];

const TRIMESTRES = ["1º Trimestre", "2º Trimestre", "3º Trimestre", "4º Trimestre"];
const BIMESTRES = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre", "5º Bimestre", "6º Bimestre"];
const SEMANAS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];
const ANOS = ["2026", "2027", "2028"];

const generateMockData = (diretoriaId: string) => {
  const dirIdUpper = diretoriaId.toUpperCase();
  const gerenciasAtuais = DIRETORIA_GERENCIAS[dirIdUpper] || DIRETORIA_GERENCIAS["DC"];

  const evolutionData = MOCK_MESES.map(mes => ({
    name: mes,
    aquisicoes: Math.floor(Math.random() * 500000) + 100000,
    servicosNovos: Math.floor(Math.random() * 300000) + 50000,
    servicosExistentes: Math.floor(Math.random() * 800000) + 200000,
    orcamentoPlanejado: Math.floor(Math.random() * 1500000) + 500000,
  }));

  const gerenciaData = gerenciasAtuais.map(ger => ({
    name: ger.split(" - ")[0],
    fullName: ger,
    aquisicoes: Math.floor(Math.random() * 2000000) + 500000,
    servicosNovos: Math.floor(Math.random() * 1000000) + 200000,
    servicosExistentes: Math.floor(Math.random() * 3000000) + 1000000,
    eficiencia: Math.floor(Math.random() * 100),
    agilidade: Math.floor(Math.random() * 100),
    conformidade: Math.floor(Math.random() * 100),
  }));

  const pieData = [
    { name: "Equipamentos de TI", value: 400, tipo: "Aquisição" },
    { name: "Material de Escritório", value: 300, tipo: "Aquisição" },
    { name: "Móveis", value: 300, tipo: "Aquisição" },
    { name: "Consultoria", value: 200, tipo: "Serviço Novo" },
    { name: "Limpeza", value: 100, tipo: "Serviço Existente" },
    { name: "Manutenção", value: 150, tipo: "Serviço Existente" },
  ];

  const matrixData = Array.from({ length: 50 }).map((_, i) => {
    const isAquisicao = Math.random() > 0.4;
    const isNovo = Math.random() > 0.5;
    const tipo = isAquisicao ? "Aquisição" : (isNovo ? "Serviço Novo" : "Serviço Existente");
    
    const subcategoria = isAquisicao 
      ? ["Equipamentos de TI", "Móveis", "Material de Escritório"][Math.floor(Math.random() * 3)]
      : ["Consultoria", "Limpeza", "Manutenção"][Math.floor(Math.random() * 3)];

    const progresso = Math.floor(Math.random() * 100);
    const statusIdx = progresso === 100 ? 2 : progresso > 30 ? 1 : 0;
    
    const orcamentoPlanejado = Math.floor(Math.random() * 150000) + 5000;
    let orcamentoExecutado = 0;
    if (progresso === 100) {
      orcamentoExecutado = orcamentoPlanejado * (Math.random() * 0.4 + 0.8);
    } else {
      orcamentoExecutado = orcamentoPlanejado * (progresso / 100) * (Math.random() * 0.2 + 0.9);
    }
    
    const variacao = orcamentoPlanejado - orcamentoExecutado;
    
    return {
      id: `REQ-${dirIdUpper}-${1000 + i}`,
      gerencia: gerenciasAtuais[Math.floor(Math.random() * gerenciasAtuais.length)],
      tipo: tipo,
      subcategoria: subcategoria,
      status: ["Planejado", "Em Execução", "Concluído"][statusIdx],
      orcamentoPlanejado,
      orcamentoExecutado,
      variacao,
      mes: MOCK_MESES[Math.floor(Math.random() * 12)],
      ano: "2027",
      trimestre: TRIMESTRES[Math.floor(Math.random() * 4)],
      bimestre: BIMESTRES[Math.floor(Math.random() * 6)],
      semana: SEMANAS[Math.floor(Math.random() * 4)],
      progresso: progresso,
      tendencia: variacao >= 0 ? "down" : "up"
    };
  });

  return { evolutionData, gerenciaData, pieData, matrixData, gerenciasAtuais };
};

// ==================== DASHBOARD COMPONENT ====================
const AdminDiretoriaDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const currentDirUpper = (id || "DC").toUpperCase();

  const [visao, setVisao] = useState<"diretoria" | "gerencias">("diretoria");

  const [searchParams] = useSearchParams();
  const gerenciaQuery = searchParams.get("gerencia");

  // Slicer States (Filtros Normais)
  const [filtroDiretoria, setFiltroDiretoria] = useState<string>(currentDirUpper);
  const [filtroGerencia, setFiltroGerencia] = useState<string>(gerenciaQuery || "todas");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string>("todas");
  const [filtroAno, setFiltroAno] = useState<string>("2027");
  const [filtroTrimestre, setFiltroTrimestre] = useState<string>("todos");
  const [filtroBimestre, setFiltroBimestre] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroSemana, setFiltroSemana] = useState<string>("todas");

  // Cross-Filtering States (Interatividade Deep Power BI)
  const [crossFilterGerencia, setCrossFilterGerencia] = useState<string | null>(null);
  const [crossFilterSubcat, setCrossFilterSubcat] = useState<string | null>(null);
  const [crossFilterMes, setCrossFilterMes] = useState<string | null>(null);

  useEffect(() => {
    if (id && id.toUpperCase() !== filtroDiretoria) {
      setFiltroDiretoria(id.toUpperCase());
      
      // Se a URL trouxer uma gerência, seta ela. Se não, reseta pra todas
      const validGerencias = DIRETORIA_GERENCIAS[id.toUpperCase()] || [];
      const novaGerencia = gerenciaQuery && validGerencias.some(g => g.startsWith(gerenciaQuery)) 
        ? validGerencias.find(g => g.startsWith(gerenciaQuery)) || "todas"
        : "todas";

      setFiltroGerencia(novaGerencia);
      setCrossFilterGerencia(null);
    } else if (gerenciaQuery && !id) {
       // Apenas em caso de mudança de query na mesma diretoria (opcional)
       const validGerencias = DIRETORIA_GERENCIAS[filtroDiretoria] || [];
       const novaGerencia = validGerencias.find(g => g.startsWith(gerenciaQuery));
       if (novaGerencia) setFiltroGerencia(novaGerencia);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gerenciaQuery]);

  const handleDiretoriaChange = (val: string) => {
    setFiltroDiretoria(val);
    setFiltroGerencia("todas");
    setCrossFilterGerencia(null);
    navigate(`/admin/diretoria/${val.toLowerCase()}`);
  };

  const rawData = useMemo(() => generateMockData(filtroDiretoria), [filtroDiretoria]);

  const filteredMatrix = useMemo(() => {
    return rawData.matrixData.filter(item => {
      // Slicers Button & Select
      if (filtroGerencia !== "todas" && item.gerencia !== filtroGerencia) return false;
      if (filtroCategoria !== "todas" && item.tipo !== filtroCategoria) return false;
      if (filtroSubcategoria !== "todas" && item.subcategoria !== filtroSubcategoria) return false;
      if (filtroAno !== "todos" && item.ano !== filtroAno) return false;
      if (filtroTrimestre !== "todos" && item.trimestre !== filtroTrimestre) return false;
      if (filtroBimestre !== "todos" && item.bimestre !== filtroBimestre) return false;
      if (filtroMes !== "todos" && item.mes !== filtroMes) return false;
      if (filtroSemana !== "todas" && item.semana !== filtroSemana) return false;
      
      // Deep Cross-Filters (Cliques nos Gráficos e Tabelas)
      if (crossFilterGerencia && item.gerencia !== crossFilterGerencia) return false;
      if (crossFilterSubcat && item.subcategoria !== crossFilterSubcat) return false;
      if (crossFilterMes && item.mes !== crossFilterMes) return false;

      return true;
    });
  }, [rawData.matrixData, filtroGerencia, filtroCategoria, filtroSubcategoria, filtroAno, filtroTrimestre, filtroBimestre, filtroMes, filtroSemana, crossFilterGerencia, crossFilterSubcat, crossFilterMes]);

  const dynamicGerenciaData = useMemo(() => {
    return rawData.gerenciaData
      .filter(g => filtroGerencia === "todas" || g.fullName === filtroGerencia)
      .map(g => {
        const isFaded = crossFilterGerencia && crossFilterGerencia !== g.fullName;
        const opacityMult = isFaded ? 0.3 : 1;

        const mulAq = filtroCategoria === "todas" || filtroCategoria === "Aquisição" ? 1 : 0;
        const mulSn = filtroCategoria === "todas" || filtroCategoria === "Serviço Novo" ? 1 : 0;
        const mulSe = filtroCategoria === "todas" || filtroCategoria === "Serviço Existente" ? 1 : 0;
        
        return {
          ...g,
          aquisicoes: g.aquisicoes * mulAq * opacityMult,
          servicosNovos: g.servicosNovos * mulSn * opacityMult,
          servicosExistentes: g.servicosExistentes * mulSe * opacityMult,
          opacity: opacityMult
        };
      });
  }, [rawData.gerenciaData, filtroGerencia, filtroCategoria, crossFilterGerencia]);

  const dynamicEvolutionData = useMemo(() => {
    return rawData.evolutionData.filter(e => (filtroMes === "todos" && !crossFilterMes) || e.name === filtroMes || e.name === crossFilterMes).map(e => {
       const mulAq = filtroCategoria === "todas" || filtroCategoria === "Aquisição" ? 1 : 0;
       const mulSn = filtroCategoria === "todas" || filtroCategoria === "Serviço Novo" ? 1 : 0;
       const mulSe = filtroCategoria === "todas" || filtroCategoria === "Serviço Existente" ? 1 : 0;
       
       const isFaded = crossFilterMes && crossFilterMes !== e.name;

       return {
         ...e,
         aquisicoes: e.aquisicoes * mulAq * (isFaded ? 0.3 : 1),
         servicosNovos: e.servicosNovos * mulSn * (isFaded ? 0.3 : 1),
         servicosExistentes: e.servicosExistentes * mulSe * (isFaded ? 0.3 : 1),
         orcamentoPlanejado: e.orcamentoPlanejado * (isFaded ? 0.3 : 1)
       };
    });
  }, [rawData.evolutionData, filtroMes, filtroCategoria, crossFilterMes]);

  const dynamicPieData = useMemo(() => {
    return rawData.pieData
      .filter(p => filtroSubcategoria === "todas" || p.name === filtroSubcategoria)
      .filter(p => filtroCategoria === "todas" || p.tipo === filtroCategoria || p.tipo.includes(filtroCategoria.split(" ")[0]))
      .map(p => {
        const factor = crossFilterGerencia ? 0.4 : 1;
        return {
          ...p,
          value: p.value * factor * (Math.random() * 0.5 + 0.5),
          opacity: (crossFilterSubcat && crossFilterSubcat !== p.name) ? 0.3 : 1
        };
      });
  }, [rawData.pieData, filtroSubcategoria, filtroCategoria, crossFilterGerencia, crossFilterSubcat]);

  const radarData = useMemo(() => {
    return rawData.gerenciaData.filter(g => (!crossFilterGerencia && (filtroGerencia === "todas" || g.fullName === filtroGerencia)) || g.fullName === crossFilterGerencia);
  }, [rawData.gerenciaData, crossFilterGerencia, filtroGerencia]);


  const formatCurrency = (value: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const totalPlanejado = filteredMatrix.reduce((acc, curr) => acc + curr.orcamentoPlanejado, 0);
  const totalExecutado = filteredMatrix.reduce((acc, curr) => acc + curr.orcamentoExecutado, 0);
  const variacaoTotal = totalPlanejado - totalExecutado;
  const variacaoPercGlobal = totalPlanejado ? (variacaoTotal / totalPlanejado) * 100 : 0;

  const totalItens = filteredMatrix.length;
  const execucaoMedia = Math.floor(filteredMatrix.reduce((acc, curr) => acc + curr.progresso, 0) / (totalItens || 1));

  const getChartDataKey = () => {
    switch (filtroCategoria) {
      case "Aquisição": return "aquisicoes";
      case "Serviço Novo": return "servicosNovos";
      case "Serviço Existente": return "servicosExistentes";
      default: return "aquisicoes";
    }
  };

  const handleExportExcel = () => exportToExcel(filteredMatrix, `Relatorio_${currentDirUpper}`, `Relatório Detalhado - Diretoria ${currentDirUpper}`);
  const handleExportPDF = () => exportToPDF(filteredMatrix, `Relatorio_${currentDirUpper}`, `Matriz de Dados - Diretoria ${currentDirUpper}`);

  const limparFiltros = () => {
    setFiltroGerencia("todas");
    setFiltroCategoria("todas");
    setFiltroSubcategoria("todas");
    setFiltroAno("2027");
    setFiltroTrimestre("todos");
    setFiltroBimestre("todos");
    setFiltroMes("todos");
    setFiltroSemana("todas");
    setCrossFilterGerencia(null);
    setCrossFilterSubcat(null);
    setCrossFilterMes(null);
  };

  const getSubcategoriasOptions = () => {
    if (filtroCategoria === "Aquisição") return ["Equipamentos de TI", "Móveis", "Material de Escritório"];
    if (filtroCategoria.includes("Serviço")) return ["Consultoria", "Limpeza", "Manutenção"];
    return ["Equipamentos de TI", "Móveis", "Material de Escritório", "Consultoria", "Limpeza", "Manutenção"];
  };

  // Click Handlers (DEEP Power BI Interactivity)
  const onBarClick = (data: any) => {
    if (crossFilterGerencia === data.fullName) setCrossFilterGerencia(null);
    else setCrossFilterGerencia(data.fullName);
  };
  const onPieClick = (data: any) => {
    if (crossFilterSubcat === data.name) setCrossFilterSubcat(null);
    else setCrossFilterSubcat(data.name);
  };
  const onComposedChartClick = (data: any) => {
    if (data?.activeLabel) {
      if (crossFilterMes === data.activeLabel) setCrossFilterMes(null);
      else setCrossFilterMes(data.activeLabel);
    }
  };
  const onTableRowClick = (row: any) => {
    setCrossFilterGerencia(crossFilterGerencia === row.gerencia ? null : row.gerencia);
    setCrossFilterSubcat(crossFilterSubcat === row.subcategoria ? null : row.subcategoria);
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-12">
      {/* HEADER GRADIENTE */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-8 text-white shadow-lg">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 mb-4 px-0" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para o Painel Principal
          </Button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="bg-white/20 text-white border-white/30 px-3 py-1 text-sm">
                  Ambiente Analítico
                </Badge>
                {crossFilterGerencia || crossFilterSubcat || crossFilterMes ? (
                  <Badge className="bg-amber-500 hover:bg-amber-600 animate-pulse">Deep Cross-Filter Ativo</Badge>
                ) : (
                  <Badge className="bg-green-500 hover:bg-green-600">Tempo Real</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard Avançado (BI)</h1>
              <p className="text-blue-200 mt-1">Interatividade Máxima: Clique EM QUALQUER LUGAR (tabelas, gráficos, KPIs) para segmentar.</p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                <FileText className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button onClick={handleExportPDF} className="bg-rose-600 hover:bg-rose-700 text-white shadow-md">
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        
        {/* SLICER BAR (POWER BI STYLE BUTTON SLICERS) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex flex-col gap-4 sticky top-4 z-10 transition-all">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-indigo-700 font-semibold">
              <Filter className="h-5 w-5" /> Painel de Segmentação Visual
            </div>
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-slate-500 hover:text-indigo-600 h-8">
              Limpar Todos os Filtros
            </Button>
          </div>
          
          {/* LINHA 1: SLICERS DE BOTÃO (Aparecem automaticamente, sem dropdown para as principais dimensões) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Diretoria */}
            <div className="space-y-1 lg:col-span-2">
              <label className="text-xs font-bold text-indigo-700">📌 Diretoria</label>
              <Select value={filtroDiretoria} onValueChange={handleDiretoriaChange}>
                <SelectTrigger className="bg-indigo-50 border-indigo-200 text-indigo-800 font-semibold"><SelectValue placeholder="Diretoria" /></SelectTrigger>
                <SelectContent>
                  {REAL_DIRETORIAS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Gerência Button Slicer */}
            <div className="space-y-1 lg:col-span-5 lg:border-l lg:pl-4">
              <label className="text-xs font-medium text-slate-500">Segmentação de Gerências (Visível)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant={filtroGerencia === "todas" ? "default" : "outline"} className={`cursor-pointer px-3 py-1 text-sm transition-all hover:scale-105 ${filtroGerencia === "todas" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 bg-white"}`} onClick={() => { setFiltroGerencia("todas"); setCrossFilterGerencia(null); }}>
                  Todas
                </Badge>
                {rawData.gerenciasAtuais.map(g => (
                  <Badge key={g} variant={filtroGerencia === g ? "default" : "outline"} className={`cursor-pointer px-3 py-1 text-sm transition-all hover:scale-105 ${filtroGerencia === g ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 bg-white"} ${crossFilterGerencia === g ? 'ring-2 ring-amber-400' : ''}`} onClick={() => { setFiltroGerencia(g === filtroGerencia ? "todas" : g); setCrossFilterGerencia(null); }} title={g}>
                    {g.split(" - ")[0]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Categoria Button Slicer */}
            <div className="space-y-1 lg:col-span-5 lg:border-l lg:pl-4">
              <label className="text-xs font-medium text-slate-500">Categoria Geral</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["todas", "Aquisição", "Serviço Novo", "Serviço Existente"].map(cat => (
                  <Badge key={cat} variant={filtroCategoria === cat ? "default" : "outline"} className={`cursor-pointer px-3 py-1 text-sm transition-all hover:scale-105 ${filtroCategoria === cat ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 bg-white"}`} onClick={() => { setFiltroCategoria(cat); setFiltroSubcategoria("todas"); setCrossFilterSubcat(null); }}>
                    {cat === "todas" ? "Todas" : cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* LINHA 2: TEMPO E SUBCATEGORIAS (Selects) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pt-3 border-t mt-1">
             <div className="space-y-1 lg:col-span-2">
              <label className="text-xs font-medium text-slate-500">Subcategoria (Dependente)</label>
              <Select value={filtroSubcategoria} onValueChange={(val) => { setFiltroSubcategoria(val); setCrossFilterSubcat(null); }}>
                <SelectTrigger className={`bg-slate-50 border-slate-200 h-8 text-xs ${crossFilterSubcat ? 'border-amber-400 bg-amber-50' : ''}`}><SelectValue placeholder="Item" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos os Itens</SelectItem>
                  {getSubcategoriasOptions().map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
             </div>
             
             <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Ano</label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="bg-slate-50 border-slate-200 h-8 text-xs"><SelectValue placeholder="Ano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ANOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-medium text-slate-500">Trimestre</label>
               <Select value={filtroTrimestre} onValueChange={(val) => { setFiltroTrimestre(val); setFiltroBimestre("todos"); }}>
                 <SelectTrigger className="bg-slate-50 border-slate-200 h-8 text-xs"><SelectValue placeholder="Trimestre" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="todos">Sem Filtro</SelectItem>
                   {TRIMESTRES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Bimestre</label>
                <Select value={filtroBimestre} onValueChange={(val) => { setFiltroBimestre(val); setFiltroTrimestre("todos"); }}>
                  <SelectTrigger className="bg-slate-50 border-slate-200 h-8 text-xs"><SelectValue placeholder="Bimestre" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Sem Filtro</SelectItem>
                    {BIMESTRES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
             </div>
             <div className="space-y-1 relative">
               <label className="text-xs font-medium text-slate-500">Mês</label>
               <Select value={filtroMes} onValueChange={(val) => { setFiltroMes(val); setCrossFilterMes(null); }}>
                 <SelectTrigger className={`bg-slate-50 border-slate-200 h-8 text-xs ${crossFilterMes ? 'border-amber-400 bg-amber-50' : ''}`}><SelectValue placeholder="Mês" /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="todos">Todos</SelectItem>
                   {MOCK_MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Semana</label>
                <Select value={filtroSemana} onValueChange={setFiltroSemana}>
                  <SelectTrigger className="bg-slate-50 border-slate-200 h-8 text-xs"><SelectValue placeholder="Semana" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {SEMANAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
             </div>
          </div>
        </div>

        {/* CONTROLES (Visão) */}
        <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <Tabs value={visao} onValueChange={(v) => setVisao(v as any)} className="w-full lg:w-auto">
            <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-slate-100">
              <TabsTrigger value="diretoria" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Visão Consolidada</TabsTrigger>
              <TabsTrigger value="gerencias" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Visão por Gerência</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="hidden lg:flex items-center text-sm text-slate-500 gap-2 pr-4">
            <CalendarDays className="h-4 w-4" /> Dados sincronizados da Diretoria {filtroDiretoria}
          </div>
        </div>

        {/* KPIs (Now React to Deep Filters and act as reset buttons) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-indigo-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-indigo-50" onClick={() => setFiltroCategoria("todas")} title="Clique para resetar Categoria">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-slate-500">Orçamento Planejado</CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-800">{formatCurrency(totalPlanejado)}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-l-4 border-l-cyan-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-cyan-50" onClick={() => setFiltroGerencia("todas")} title="Clique para resetar Gerência">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-slate-500">Orçamento Executado</CardDescription>
              <CardTitle className="text-3xl font-bold text-slate-800">{formatCurrency(totalExecutado)}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className={`border-l-4 shadow-sm transition-all hover:shadow-md cursor-pointer ${variacaoTotal >= 0 ? 'border-l-emerald-500 hover:bg-emerald-50' : 'border-l-rose-500 hover:bg-rose-50'}`} onClick={() => { setFiltroSubcategoria("todas"); setCrossFilterSubcat(null); }} title="Clique para resetar Subcategoria">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-slate-500">{variacaoTotal >= 0 ? "Economia Gerada" : "Excedente (Estouro)"}</CardDescription>
              <CardTitle className={`text-2xl font-bold ${variacaoTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(Math.abs(variacaoTotal))}
              </CardTitle>
              <div className="text-xs text-slate-500 mt-1 font-medium">{Math.abs(variacaoPercGlobal).toFixed(1)}% do planejado</div>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm bg-gradient-to-br from-white to-amber-50 transition-all hover:shadow-md cursor-pointer" onClick={limparFiltros} title="Clique para resetar TODOS os filtros">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-amber-800">Eficiência Geral</CardDescription>
              <div className="flex items-center gap-3">
                <CardTitle className="text-3xl font-bold text-amber-600">{execucaoMedia}%</CardTitle>
                <Progress value={execucaoMedia} className="h-2 w-full bg-amber-200 [&>div]:bg-amber-600" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* CHARTS AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COMPOSED CHART - PREVISTO vs REALIZADO */}
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <Target className="h-5 w-5 text-indigo-500" />
                Orçamento Planejado x Realizado Diário (Clique na barra para Filtrar Mês)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dynamicEvolutionData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }} onClick={(e: any) => onComposedChartClick(e)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="aquisicoes" name="Realizado (Barra)" fill={COLORS[0]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                    <Line type="monotone" dataKey="orcamentoPlanejado" name="Orçamento Base (Linha)" stroke={COLORS[3]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} className="cursor-pointer hover:opacity-80" />
                  </ComposedChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* RADAR CHART - PERFORMANCE GERENCIAL */}
          <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <Activity className="h-5 w-5 text-rose-500" />
                Performance Qualitativa
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData.length > 0 ? radarData.slice(0,3) : []}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Eficiência" dataKey="eficiencia" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.4} />
                  <Radar name="Agilidade" dataKey="agilidade" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.4} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* BAR CHART - CLUSTERIZADO (INTERATIVO) */}
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <BarChart3 className="h-5 w-5 text-cyan-500" />
                {visao === "gerencias" ? "Volume por Gerência (Clique para Filtrar Cruzado)" : "Volume Geral (Clique para Filtrar)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicGerenciaData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} onClick={(e: any) => e?.activePayload && onBarClick(e.activePayload[0].payload)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `R$ ${val / 1000000}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f1f5f9' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  {visao === "diretoria" && filtroCategoria === "todas" ? (
                    <>
                      <Bar dataKey="aquisicoes" name="Aquisições" fill={COLORS[0]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                      <Bar dataKey="servicosNovos" name="Serviços Novos" fill={COLORS[1]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                      <Bar dataKey="servicosExistentes" name="Serv. Existentes" fill={COLORS[2]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                    </>
                  ) : (
                    <Bar dataKey={getChartDataKey()} name="Valor" fill={COLORS[0]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* PIE CHART (INTERATIVO) */}
          <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <PieChartIcon className="h-5 w-5 text-emerald-500" />
                Subcategorias (Clique na Fatia)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart onClick={(e: any) => e && onPieClick(e)}>
                  <Pie
                    data={dynamicPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    className="cursor-pointer"
                  >
                    {dynamicPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={entry.opacity} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>

        {/* MATRIZ DE DADOS (AGORA COM DEEP CROSS-FILTERING ON CLICK) */}
        <Card className="shadow-sm border-slate-200 mb-12 overflow-hidden">
          <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b">
            <div>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <TableIcon className="h-5 w-5 text-slate-500" />
                Matriz Analítica Interativa (Clique na Linha)
                {crossFilterGerencia && <Badge variant="destructive" className="ml-3 animate-pulse">{crossFilterGerencia.split(" - ")[0]}</Badge>}
                {crossFilterSubcat && <Badge variant="secondary" className="ml-2 animate-pulse">{crossFilterSubcat}</Badge>}
                {crossFilterMes && <Badge variant="outline" className="ml-2 animate-pulse bg-indigo-50">{crossFilterMes}</Badge>}
              </CardTitle>
              <CardDescription>
                Exibindo {filteredMatrix.length} registros. Clique em qualquer linha para aplicar Filtro Cruzado no Dashboard inteiro.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <FileText className="h-4 w-4" /> Exportar Visão Cruzada
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {filteredMatrix.length === 0 ? (
               <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                 <Filter className="h-10 w-10 text-slate-300 mb-3" />
                 <p className="text-lg">Nenhum dado encontrado para a combinação atual.</p>
                 <Button variant="link" onClick={limparFiltros} className="mt-2 text-indigo-600">Remover Filtros</Button>
               </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b text-xs">
                    <tr>
                      <th className="px-4 py-3">Código / ID</th>
                      <th className="px-4 py-3">Gerência</th>
                      <th className="px-4 py-3">Subcategoria</th>
                      <th className="px-4 py-3">Progresso de Execução (KPI)</th>
                      <th className="px-4 py-3 text-right">Planejado</th>
                      <th className="px-4 py-3 text-right">Executado</th>
                      <th className="px-4 py-3 text-right">Variação Financeira</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMatrix.map((row, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => onTableRowClick(row)}
                        className={`transition-colors group cursor-pointer hover:shadow-inner ${
                          crossFilterGerencia === row.gerencia || crossFilterSubcat === row.subcategoria 
                            ? 'bg-amber-50/50 hover:bg-amber-100/50 border-l-2 border-l-amber-400' 
                            : 'hover:bg-slate-100 border-l-2 border-l-transparent'
                        }`}
                        title="Clique na linha para aplicar Filtro Cruzado Global!"
                      >
                        <td className="px-4 py-3 font-mono text-slate-600 group-hover:text-indigo-600 transition-colors text-xs">{row.id}</td>
                        <td className="px-4 py-3 font-medium text-xs" title={row.gerencia}>
                          {row.gerencia.split(" - ")[0]}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-700 text-xs">{row.subcategoria}</span>
                            <Badge variant="outline" className={`w-fit text-[10px] px-1 py-0 ${row.tipo === 'Aquisição' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {row.tipo}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5 w-[140px]">
                            <div className="flex justify-between items-center text-xs">
                               <span className={`font-medium ${row.progresso === 100 ? 'text-green-600' : row.progresso > 30 ? 'text-amber-600' : 'text-rose-600'}`}>
                                 {row.status}
                               </span>
                               <span className="text-slate-500 font-mono">{row.progresso}%</span>
                            </div>
                            <Progress 
                               value={row.progresso} 
                               className={`h-2 ${row.progresso === 100 ? '[&>div]:bg-green-500 bg-green-100' : row.progresso > 30 ? '[&>div]:bg-amber-500 bg-amber-100' : '[&>div]:bg-rose-500 bg-rose-100'}`} 
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-500 text-xs">
                          {formatCurrency(row.orcamentoPlanejado)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800 text-xs">
                          {formatCurrency(row.orcamentoExecutado)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-xs">
                          <div className={`flex items-center justify-end gap-1 ${row.tendencia === "up" ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {row.tendencia === "up" ? (
                              <span title="Estouro Orçamentário"><TrendingUp className="h-3 w-3" /></span>
                            ) : (
                              <span title="Economia Orçamentária"><TrendingUp className="h-3 w-3 rotate-180" /></span>
                            )}
                            {formatCurrency(Math.abs(row.variacao))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AdminDiretoriaDashboard;
