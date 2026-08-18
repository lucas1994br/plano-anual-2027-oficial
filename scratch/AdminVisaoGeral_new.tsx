import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { Activity, TrendingUp, ShieldCheck, Filter } from "lucide-react";
import { 
  getDiretorias, 
  getTodasGerencias, 
  getPeriodosAtivos,
  getSolicitacoesResumoByPeriodo,
  getServicosResumoByPeriodo,
  getAdminMiniErpConfigDb
} from "@/lib/services.ts";
import { AdminDiretoriaDashboard } from "@/pages/AdminDiretoriaDashboard.tsx";

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#64748b"];

export const AdminVisaoGeral = () => {
  const [activeTab, setActiveTab] = useState("consolidado");
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>("");
  const [expandedDir, setExpandedDir] = useState<string | null>(null);

  // Filters
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterDiretoria, setFilterDiretoria] = useState<string>("all");
  const [filterGerencia, setFilterGerencia] = useState<string>("all");

  // --- Data Fetching ---
  const { data: periodosAtivos, isLoading: isLoadingPer } = useQuery({ 
    queryKey: ["periodos-ativos"], 
    queryFn: getPeriodosAtivos,
    staleTime: 5 * 60 * 1000,
  });
  const periodoAtivoId = periodosAtivos?.[0]?.id as string | undefined;

  const { data: diretorias = [], isLoading: isLoadingDir } = useQuery({ 
    queryKey: ["diretorias"], 
    queryFn: getDiretorias,
    staleTime: 5 * 60 * 1000,
  });

  const { data: gerencias = [], isLoading: isLoadingGer } = useQuery({ 
    queryKey: ["todas-gerencias"], 
    queryFn: getTodasGerencias,
    staleTime: 5 * 60 * 1000,
  });

  const { data: solicitacoes = [], isLoading: isLoadingSol } = useQuery({
    queryKey: ["todas-solicitacoes-resumo", periodoAtivoId],
    queryFn: () => getSolicitacoesResumoByPeriodo({ periodoId: periodoAtivoId! }),
    enabled: !!periodoAtivoId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: servicos = [], isLoading: isLoadingSer } = useQuery({
    queryKey: ["todos-servicos-resumo", periodoAtivoId],
    queryFn: () => getServicosResumoByPeriodo({ periodoId: periodoAtivoId! }),
    enabled: !!periodoAtivoId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: adminConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["admin-config-db"],
    queryFn: getAdminMiniErpConfigDb,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingPer || isLoadingDir || isLoadingGer || isLoadingConfig || (!!periodoAtivoId && (isLoadingSol || isLoadingSer));


  const { kpis, chartDataDiretorias, chartDataStatus, chartDataCategory, chartDataMonth, chartDataVolumeGeral, chartDataRadar } = useMemo(() => {
    // 1. Initialize data structures
    const diretoriaMap = new Map<string, any>();
    diretorias.forEach(d => {
      diretoriaMap.set(d.id, {
        id: d.id,
        sigla: d.sigla,
        nome: d.nome,
        aquisicao: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
        servicoExistente: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
        servicoNovo: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
        totalGeral: 0,
        valorTotalGeral: 0,
        gerencias: new Map<string, any>()
      });
    });

    const getDiretoriaId = (gerId: string | null, sigla: string | null) => {
      if (!gerId && !sigla) return null;
      if (gerId) {
        const g = gerencias.find(x => x.id === gerId);
        if (g?.diretoria_id) return g.diretoria_id;
      }
      if (sigla) {
        const d = diretorias.find(x => x.sigla === sigla);
        if (d) return d.id;
      }
      return null;
    };

    // Filter data based on selected filters
    const filterByDateAndStructure = (item: any) => {
      if (filterDiretoria !== "all") {
        const dirId = item.diretoria_id || item.diretoriaId || getDiretoriaId(item.gerencia_id, item.diretoriaSigla);
        if (dirId !== filterDiretoria) return false;
      }
      if (filterGerencia !== "all" && item.gerencia_id !== filterGerencia) return false;

      if (filterYear !== "all" || filterMonth !== "all" || filterDay !== "all") {
        if (!item.created_at) return false;
        const [y, m, d] = item.created_at.substring(0, 10).split("-");
        if (filterYear !== "all" && y !== filterYear) return false;
        if (filterMonth !== "all" && m !== filterMonth) return false;
        if (filterDay !== "all" && d !== filterDay) return false;
      }
      return true;
    };

    const solicitacoesFiltradas = solicitacoes.filter(filterByDateAndStructure);
    const servicosFiltrados = servicos.filter(filterByDateAndStructure);

    const categorizeStatus = (status: string) => {
      if (!status) return "pendente";
      const s = status.toLowerCase();
      if (s.includes("aprov") || s.includes("conclu") || s.includes("valid")) return "aprovado";
      if (s.includes("reprov") || s.includes("cancel") || s.includes("devolv")) return "reprovado";
      return "pendente";
    };

    let totalAquisicao = { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 };
    let totalServExistente = { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 };
    let totalServNovo = { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 };
    let orcamentoPlanejado = 0;

    // Process categories
    const categoryMap = new Map<string, { count: number, valorTotal: number }>();

    // Process Monthly Volume
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthMap = new Map<string, { name: string, planejado: number, realizado: number }>();
    for (let i = 1; i <= 12; i++) {
      const numStr = i.toString().padStart(2, '0');
      monthMap.set(numStr, { name: monthNames[i - 1], planejado: 0, realizado: 0 }); // We use planejado for Orçamento Base, Realizado for actual R$ volume
    }

    // 2. Process Solicitacoes
    solicitacoesFiltradas.forEach(sol => {
      const statusGroup = categorizeStatus(sol.status);
      const val = (Number(sol.valor_unitario) || 0) * (Number(sol.qtd_estimada) || 0);

      totalAquisicao[statusGroup as keyof typeof totalAquisicao]++;
      totalAquisicao.total++;
      totalAquisicao.valorTotal += val;
      orcamentoPlanejado += val;

      const dirId = sol.diretoria_id || sol.diretoriaId || getDiretoriaId(sol.gerencia_id, sol.diretoriaSigla) as string | null;
      if (dirId && diretoriaMap.has(dirId)) {
        const d = diretoriaMap.get(dirId);
        d.aquisicao[statusGroup]++;
        d.aquisicao.total++;
        d.aquisicao.valorTotal += val;
        d.totalGeral++;
        d.valorTotalGeral += val;

        if (sol.gerencia_id) {
          if (!d.gerencias.has(sol.gerencia_id)) {
            const gerObj = gerencias.find(g => g.id === sol.gerencia_id);
            d.gerencias.set(sol.gerencia_id, {
              id: sol.gerencia_id,
              sigla: gerObj?.sigla || "N/A",
              nome: gerObj?.nome || "Não Atribuída",
              aquisicao: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
              servicoExistente: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
              servicoNovo: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
              totalGeral: 0,
              valorTotalGeral: 0
            });
          }
          const g = d.gerencias.get(sol.gerencia_id);
          g.aquisicao[statusGroup]++;
          g.aquisicao.total++;
          g.aquisicao.valorTotal += val;
          g.totalGeral++;
          g.valorTotalGeral += val;
        }
      }

      const cat = sol.categoria || "Não Classificado";
      const catEntry = categoryMap.get(cat) || { count: 0, valorTotal: 0 };
      catEntry.count++;
      catEntry.valorTotal += val;
      categoryMap.set(cat, catEntry);

      if (sol.created_at) {
        const m = sol.created_at.substring(5, 7);
        if (monthMap.has(m)) monthMap.get(m)!.realizado += val;
      }
    });

    // 3. Process Servicos
    servicosFiltrados.forEach(srv => {
      const statusGroup = categorizeStatus(srv.status);
      const isNovo = (srv.tipoContratacao || srv.tipo_contratacao) === "Novo";
      const val = Number(srv.estimativa_valor) || 0;
      
      if (isNovo) {
        totalServNovo[statusGroup as keyof typeof totalServNovo]++;
        totalServNovo.total++;
        totalServNovo.valorTotal += val;
      } else {
        totalServExistente[statusGroup as keyof typeof totalServExistente]++;
        totalServExistente.total++;
        totalServExistente.valorTotal += val;
      }
      orcamentoPlanejado += val;

      const dirId = srv.diretoria_id || srv.diretoriaId || getDiretoriaId(srv.gerencia_id, srv.diretoriaSigla) as string | null;
      if (dirId && diretoriaMap.has(dirId)) {
        const d = diretoriaMap.get(dirId);
        if (isNovo) {
          d.servicoNovo[statusGroup]++;
          d.servicoNovo.total++;
          d.servicoNovo.valorTotal += val;
        } else {
          d.servicoExistente[statusGroup]++;
          d.servicoExistente.total++;
          d.servicoExistente.valorTotal += val;
        }
        d.totalGeral++;
        d.valorTotalGeral += val;

        if (srv.gerencia_id) {
          if (!d.gerencias.has(srv.gerencia_id)) {
            const gerObj = gerencias.find(g => g.id === srv.gerencia_id);
            d.gerencias.set(srv.gerencia_id, {
              id: srv.gerencia_id,
              sigla: gerObj?.sigla || "N/A",
              nome: gerObj?.nome || "Não Atribuída",
              aquisicao: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
              servicoExistente: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
              servicoNovo: { aprovado: 0, reprovado: 0, pendente: 0, total: 0, valorTotal: 0 },
              totalGeral: 0,
              valorTotalGeral: 0
            });
          }
          const g = d.gerencias.get(srv.gerencia_id);
          if (isNovo) {
            g.servicoNovo[statusGroup]++;
            g.servicoNovo.total++;
            g.servicoNovo.valorTotal += val;
          } else {
            g.servicoExistente[statusGroup]++;
            g.servicoExistente.total++;
            g.servicoExistente.valorTotal += val;
          }
          g.totalGeral++;
          g.valorTotalGeral += val;
        }
      }

      if (srv.created_at) {
        const m = srv.created_at.substring(5, 7);
        if (monthMap.has(m)) monthMap.get(m)!.realizado += val;
      }
    });

    // 4. Calculate Limits & Formatting
    let limiteOrcamentario = 0;
    if (adminConfig?.diretoriaBudgetsOrcamentoGeral) {
      if (filterDiretoria !== "all") {
        limiteOrcamentario = adminConfig.diretoriaBudgetsOrcamentoGeral[filterDiretoria] || 0;
      } else {
        limiteOrcamentario = Object.values(adminConfig.diretoriaBudgetsOrcamentoGeral).reduce((a, b) => a + b, 0);
      }
    }
    const saldoDisponivel = limiteOrcamentario - orcamentoPlanejado;
    const eficienciaGeral = limiteOrcamentario > 0 ? (orcamentoPlanejado / limiteOrcamentario) * 100 : 0;

    // Simulate "Orçamento Base" for the monthly chart just to have a double line like the screenshot
    const chartDataMonth = Array.from(monthMap.values()).map(m => ({
      ...m,
      planejado: (limiteOrcamentario / 12) // Just a flat line as "Orçamento Base"
    }));

    // Top Subcategories Chart (By Value)
    const chartDataCategory = Array.from(categoryMap.entries())
      .map(([name, val]) => ({ name, value: val.valorTotal }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, idx) => ({ ...entry, color: COLORS[idx % COLORS.length] }));

    // Status de Execução Donut
    const chartDataStatus = [
      { name: "Planejado", value: orcamentoPlanejado, color: "#f59e0b" },
      { name: "Restante", value: Math.max(0, saldoDisponivel), color: "#f1f5f9" } // Grey for unused
    ];

    // Volume Geral (Bar/Area) and Radar
    const diretoriaList = Array.from(diretoriaMap.values());
    const chartDataVolumeGeral = diretoriaList
      .sort((a, b) => b.valorTotalGeral - a.valorTotalGeral)
      .map(d => ({
        name: d.sigla,
        "Aquisições": d.aquisicao.valorTotal,
        "Serviços Novos": d.servicoNovo.valorTotal,
        "Serv. Existentes": d.servicoExistente.valorTotal
      }));
      
    const chartDataRadar = diretoriaList
      .sort((a, b) => b.valorTotalGeral - a.valorTotalGeral)
      .slice(0, 5) // Top 5 for Radar
      .map(d => ({
        subject: d.sigla,
        "Aquisições": d.aquisicao.valorTotal,
        "Serviços": d.servicoNovo.valorTotal + d.servicoExistente.valorTotal,
        fullMark: Math.max(d.aquisicao.valorTotal, d.servicoNovo.valorTotal + d.servicoExistente.valorTotal) * 1.2
      }));

    const chartDataDiretorias = diretoriaList.map(d => {
      const gerenciasList = Array.from(d.gerencias.values()).sort((a: any, b: any) => b.valorTotalGeral - a.valorTotalGeral);
      return {
        id: d.id,
        name: d.sigla,
        "Aquis. Aprov.": d.aquisicao.aprovado,
        "Aquis. Pend.": d.aquisicao.pendente,
        "Serv. Exist. Aprov.": d.servicoExistente.aprovado,
        "Serv. Exist. Pend.": d.servicoExistente.pendente,
        "Serv. Novo Aprov.": d.servicoNovo.aprovado,
        "Serv. Novo Pend.": d.servicoNovo.pendente,
        total: d.totalGeral,
        valorTotalGeral: d.valorTotalGeral,
        raw: { ...d, gerenciasList }
      };
    }).sort((a, b) => b.valorTotalGeral - a.valorTotalGeral); // Sort by total finance

    return {
      kpis: {
        limiteOrcamentario,
        orcamentoPlanejado,
        saldoDisponivel,
        eficienciaGeral,
      },
      chartDataDiretorias,
      chartDataStatus,
      chartDataCategory,
      chartDataMonth,
      chartDataVolumeGeral,
      chartDataRadar
    };
  }, [solicitacoes, servicos, diretorias, gerencias, filterDiretoria, filterGerencia, filterYear, filterMonth, filterDay, adminConfig]);
\n  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const KPICard = ({ title, data, icon: Icon, colorClass }: any) => (
    <Card className="p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          <p className="text-2xl font-bold mt-1 text-slate-800">{data.total}</p>
        </div>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col items-center p-1 bg-green-50 rounded">
          <span className="text-green-600 font-semibold">{data.aprovado}</span>
          <span className="text-slate-500">Aprov</span>
        </div>
        <div className="flex flex-col items-center p-1 bg-amber-50 rounded">
          <span className="text-amber-600 font-semibold">{data.pendente}</span>
          <span className="text-slate-500">Pend</span>
        </div>
        <div className="flex flex-col items-center p-1 bg-red-50 rounded">
          <span className="text-red-600 font-semibold">{data.reprovado}</span>
          <span className="text-slate-500">Repr</span>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
          <p className="text-slate-500">Acompanhamento consolidado de todas as diretorias e categorias.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 text-sm bg-primary/5 border-primary/20 text-primary">
          Total de Requisições: {kpis.totalGeral}
        </Badge>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end mb-6">
        <div className="flex items-center gap-2 text-slate-500 font-medium mb-1 md:mb-0 md:mr-2">
          <Filter className="w-5 h-5" />
          Filtros
        </div>
        
        <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Ano</label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Mês</label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Array.from({ length: 12 }).map((_, i) => {
                  const m = (i + 1).toString().padStart(2, '0');
                  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                  return <SelectItem key={m} value={m}>{monthNames[i]}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Dia</label>
            <Select value={filterDay} onValueChange={setFilterDay}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Dia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Array.from({ length: 31 }).map((_, i) => {
                  const d = (i + 1).toString().padStart(2, '0');
                  return <SelectItem key={d} value={d}>{d}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Diretoria</label>
            <Select value={filterDiretoria} onValueChange={setFilterDiretoria}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Diretoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {diretorias.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.sigla}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Gerência</label>
            <Select value={filterGerencia} onValueChange={setFilterGerencia}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Gerência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {gerencias.filter((g: any) => filterDiretoria === "all" || g.diretoria_id === filterDiretoria).map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.sigla}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="consolidado">Visão Consolidada</TabsTrigger>
          <TabsTrigger value="por-diretoria">Visão por Diretoria</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidado" className="space-y-6">
          {/* --- KPI CARDS --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard 
              title="Aquisições" 
              data={kpis.aquisicao} 
              icon={Activity} 
              colorClass="bg-blue-100 text-blue-600" 
            />
            <KPICard 
              title="Serviços Existentes" 
              data={kpis.servicoExistente} 
              icon={ShieldCheck} 
              colorClass="bg-indigo-100 text-indigo-600" 
            />
            <KPICard 
              title="Serviços Novos" 
              data={kpis.servicoNovo} 
              icon={TrendingUp} 
              colorClass="bg-purple-100 text-purple-600" 
            />
          </div>

          {/* --- CHARTS --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Volume por Diretoria</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataDiretorias} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Aquis. Aprov." stackId="a" fill="#3b82f6" />
                <Bar dataKey="Aquis. Pend." stackId="a" fill="#93c5fd" />
                <Bar dataKey="Serv. Exist. Aprov." stackId="a" fill="#4f46e5" />
                <Bar dataKey="Serv. Exist. Pend." stackId="a" fill="#a5b4fc" />
                <Bar dataKey="Serv. Novo Aprov." stackId="a" fill="#9333ea" />
                <Bar dataKey="Serv. Novo Pend." stackId="a" fill="#d8b4fe" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Status Geral</h3>
          <div className="h-72 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartDataStatus.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-slate-800">{kpis.totalGeral}</span>
              <span className="text-xs text-slate-500 font-medium">TOTAL</span>
            </div>
            
            <div className="absolute bottom-0 w-full flex justify-center gap-4 text-xs font-medium">
              {chartDataStatus.map(s => (
                <div key={s.name} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-600">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Evolução por Mês</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="aquisicoes" name="Aquisições" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="servicos" name="Serviços" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Categorias (Aquisições)</h3>
          <div className="h-72 w-full">
            {chartDataCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartDataCategory.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '11px', maxWidth: '150px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">Nenhuma categoria encontrada</div>
            )}
          </div>
        </Card>
      </div>

      {/* --- DETAILED TABLE --- */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Detalhamento por Diretoria</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Diretoria</th>
                <th className="px-4 py-3 text-center border-l border-slate-200" colSpan={3}>Aquisições</th>
                <th className="px-4 py-3 text-center border-l border-slate-200" colSpan={3}>Serv. Existentes</th>
                <th className="px-4 py-3 text-center border-l border-slate-200" colSpan={3}>Serv. Novos</th>
                <th className="px-4 py-3 text-right border-l border-slate-200">Total</th>
              </tr>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="px-4 py-2"></th>
                <th className="px-2 py-2 text-center border-l border-slate-200">Aprov.</th>
                <th className="px-2 py-2 text-center">Pend.</th>
                <th className="px-2 py-2 text-center">Repr.</th>
                <th className="px-2 py-2 text-center border-l border-slate-200">Aprov.</th>
                <th className="px-2 py-2 text-center">Pend.</th>
                <th className="px-2 py-2 text-center">Repr.</th>
                <th className="px-2 py-2 text-center border-l border-slate-200">Aprov.</th>
                <th className="px-2 py-2 text-center">Pend.</th>
                <th className="px-2 py-2 text-center">Repr.</th>
                <th className="px-4 py-2 text-right border-l border-slate-200">Reqs.</th>
              </tr>
            </thead>
            <tbody>
              {chartDataDiretorias.map((d, i) => (
                <React.Fragment key={i}>
                  <tr 
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    onClick={() => setExpandedDir(expandedDir === d.id ? null : d.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-primary/10 group-hover:text-primary transition-colors flex items-center justify-center text-xs font-bold text-slate-600">
                          {d.name}
                        </div>
                        <span className="hidden sm:inline text-xs text-slate-500 truncate max-w-[120px]" title={d.raw.nome}>
                          {d.raw.nome}
                        </span>
                      </div>
                    </td>
                    
                    {/* Aquisicoes */}
                    <td className="px-2 py-3 text-center border-l border-slate-100 text-green-600 font-medium">{d.raw.aquisicao.aprovado > 0 ? d.raw.aquisicao.aprovado : "-"}</td>
                    <td className="px-2 py-3 text-center text-amber-600">{d.raw.aquisicao.pendente > 0 ? d.raw.aquisicao.pendente : "-"}</td>
                    <td className="px-2 py-3 text-center text-red-500">{d.raw.aquisicao.reprovado > 0 ? d.raw.aquisicao.reprovado : "-"}</td>

                    {/* Existentes */}
                    <td className="px-2 py-3 text-center border-l border-slate-100 text-green-600 font-medium">{d.raw.servicoExistente.aprovado > 0 ? d.raw.servicoExistente.aprovado : "-"}</td>
                    <td className="px-2 py-3 text-center text-amber-600">{d.raw.servicoExistente.pendente > 0 ? d.raw.servicoExistente.pendente : "-"}</td>
                    <td className="px-2 py-3 text-center text-red-500">{d.raw.servicoExistente.reprovado > 0 ? d.raw.servicoExistente.reprovado : "-"}</td>

                    {/* Novos */}
                    <td className="px-2 py-3 text-center border-l border-slate-100 text-green-600 font-medium">{d.raw.servicoNovo.aprovado > 0 ? d.raw.servicoNovo.aprovado : "-"}</td>
                    <td className="px-2 py-3 text-center text-amber-600">{d.raw.servicoNovo.pendente > 0 ? d.raw.servicoNovo.pendente : "-"}</td>
                    <td className="px-2 py-3 text-center text-red-500">{d.raw.servicoNovo.reprovado > 0 ? d.raw.servicoNovo.reprovado : "-"}</td>

                    {/* Total */}
                    <td className="px-4 py-3 text-right border-l border-slate-100 font-bold text-slate-800">
                      {d.total}
                    </td>
                  </tr>

                  {expandedDir === d.id && d.raw.gerenciasList.map((g: any, gIdx: number) => (
                    <tr key={`ger-${i}-${gIdx}`} className="border-b border-slate-50 bg-slate-50/30 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2 pl-12 font-medium text-slate-600 text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                        {g.sigla} - <span className="text-slate-400 font-normal truncate max-w-[150px]">{g.nome}</span>
                      </td>
                      
                      {/* Aquisicoes */}
                      <td className="px-2 py-2 text-center border-l border-slate-100 text-green-600 font-medium text-xs">{g.aquisicao.aprovado > 0 ? g.aquisicao.aprovado : "-"}</td>
                      <td className="px-2 py-2 text-center text-amber-600 text-xs">{g.aquisicao.pendente > 0 ? g.aquisicao.pendente : "-"}</td>
                      <td className="px-2 py-2 text-center text-red-500 text-xs">{g.aquisicao.reprovado > 0 ? g.aquisicao.reprovado : "-"}</td>

                      {/* Existentes */}
                      <td className="px-2 py-2 text-center border-l border-slate-100 text-green-600 font-medium text-xs">{g.servicoExistente.aprovado > 0 ? g.servicoExistente.aprovado : "-"}</td>
                      <td className="px-2 py-2 text-center text-amber-600 text-xs">{g.servicoExistente.pendente > 0 ? g.servicoExistente.pendente : "-"}</td>
                      <td className="px-2 py-2 text-center text-red-500 text-xs">{g.servicoExistente.reprovado > 0 ? g.servicoExistente.reprovado : "-"}</td>

                      {/* Novos */}
                      <td className="px-2 py-2 text-center border-l border-slate-100 text-green-600 font-medium text-xs">{g.servicoNovo.aprovado > 0 ? g.servicoNovo.aprovado : "-"}</td>
                      <td className="px-2 py-2 text-center text-amber-600 text-xs">{g.servicoNovo.pendente > 0 ? g.servicoNovo.pendente : "-"}</td>
                      <td className="px-2 py-2 text-center text-red-500 text-xs">{g.servicoNovo.reprovado > 0 ? g.servicoNovo.reprovado : "-"}</td>

                      {/* Total */}
                      <td className="px-4 py-2 text-right border-l border-slate-100 font-semibold text-slate-700 text-xs">
                        {g.totalGeral}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              
              {chartDataDiretorias.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                    Nenhum dado encontrado para o período atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      </TabsContent>

      <TabsContent value="por-diretoria" className="space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Selecione uma Diretoria</h3>
          <Select value={selectedDiretoria} onValueChange={setSelectedDiretoria}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Escolha a Diretoria..." />
            </SelectTrigger>
            <SelectContent>
              {diretorias.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.sigla} - {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {selectedDiretoria ? (
          <AdminDiretoriaDashboard diretoriaId={selectedDiretoria} />
        ) : (
          <div className="flex justify-center items-center h-48 border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
            Selecione uma diretoria acima para visualizar os resultados específicos.
          </div>
        )}
      </TabsContent>
      </Tabs>
    </div>
  );
};
