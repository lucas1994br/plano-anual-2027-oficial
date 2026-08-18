import React, { useMemo, useState } from "react";
import { Activity, ShieldCheck, TrendingUp, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  getPeriodosAtivos,
  getDiretorias,
  getTodasGerencias,
  getSolicitacoesByDiretoria,
  getServicosByDiretoria
} from "@/lib/services.ts";

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#64748b"];

interface AdminDiretoriaDashboardProps {
  diretoriaId: string;
  filterGerencia?: string;
  filterYear?: string;
  filterMonth?: string;
  filterDay?: string;
  adminConfig?: any;
}

export const AdminDiretoriaDashboard = ({ 
  diretoriaId,
  filterGerencia = "all",
  filterYear = "all",
  filterMonth = "all",
  filterDay = "all",
  adminConfig
}: AdminDiretoriaDashboardProps) => {
  const [activeTab, setActiveTab] = useState("resultados");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

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
  const diretoria = diretorias.find(d => d.id === diretoriaId);

  const { data: gerencias = [], isLoading: isLoadingGer } = useQuery({
    queryKey: ["todas-gerencias"],
    queryFn: getTodasGerencias,
    staleTime: 5 * 60 * 1000,
  });
  const gerenciasAtuais = useMemo(() => gerencias.filter((g: any) => g.diretoria_id === diretoriaId), [gerencias, diretoriaId]);

  const { data: solicitacoes = [], isLoading: isLoadingSol } = useQuery({
    queryKey: ["solicitacoes-diretoria", periodoAtivoId, diretoriaId],
    queryFn: () => getSolicitacoesByDiretoria(diretoriaId, periodoAtivoId!),
    enabled: !!periodoAtivoId && !!diretoriaId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: servicos = [], isLoading: isLoadingSer } = useQuery({
    queryKey: ["servicos-diretoria", periodoAtivoId, diretoriaId],
    queryFn: () => getServicosByDiretoria(diretoriaId, periodoAtivoId!),
    enabled: !!periodoAtivoId && !!diretoriaId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingPer || isLoadingDir || isLoadingGer || (!!periodoAtivoId && (isLoadingSol || isLoadingSer));

  // --- Data Processing ---
  const { kpis, chartDataGerencias, chartDataStatus, unifiedList } = useMemo(() => {
    const filterByDateAndStructure = (item: any) => {
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

    const solDir = solicitacoes.filter(filterByDateAndStructure);
    const serDir = servicos.filter(filterByDateAndStructure);

    const categorizeStatus = (status?: string) => {
      if (!status) return "pendente";
      const s = status.toLowerCase();
      if (s.includes("aprov") || s.includes("conclu") || s.includes("valid") || s === "em_compra") return "aprovado";
      if (s.includes("reprov") || s.includes("cancel") || s.includes("devolv") || s === "rejeitado") return "reprovado";
      return "pendente";
    };

    const gerenciaMap = new Map<string, any>();
    gerenciasAtuais.forEach((g: any) => {
      gerenciaMap.set(g.id, {
        sigla: g.sigla,
        nome: g.nome,
        aquisicao: { aprovado: 0, reprovado: 0, pendente: 0, total: 0 },
        servicoExistente: { aprovado: 0, reprovado: 0, pendente: 0, total: 0 },
        servicoNovo: { aprovado: 0, reprovado: 0, pendente: 0, total: 0 },
        totalGeral: 0
      });
    });

    const getGerenciaId = (gerenciaId?: string) => {
      if (gerenciaId && gerenciaMap.has(gerenciaId)) return gerenciaId;
      return null;
    };

    const totalAquisicao = { aprovado: 0, reprovado: 0, pendente: 0, total: 0 };
    let orcamentoPlanejado = 0;
    const list: any[] = [];

    solDir.forEach((sol: any) => {
      const statusGroup = categorizeStatus(sol.status);
      totalAquisicao[statusGroup as keyof typeof totalAquisicao]++;
      totalAquisicao.total++;

      const gerId = getGerenciaId(sol.gerencia_id);
      if (gerId) {
        const g = gerenciaMap.get(gerId);
        g.aquisicao[statusGroup]++;
        g.aquisicao.total++;
        g.totalGeral++;
      }

      list.push({
        id: `REQ-${sol.codigo || sol.id?.substring(0, 6)}`,
        tipo: "Aquisição",
        descricao: sol.descricao,
        gerencia: gerencias.find(g => g.id === sol.gerencia_id)?.sigla || sol.gerencia || "-",
        status: sol.status || "rascunho",
        statusGroup,
        valor: (sol.qtdEstimada || sol.qtd_estimada || 0) * (sol.valorUnitario || sol.valor_unitario || 0),
        data: sol.created_at
      });
      orcamentoPlanejado += (sol.qtdEstimada || sol.qtd_estimada || 0) * (sol.valorUnitario || sol.valor_unitario || 0);
    });

    const totalServExistente = { aprovado: 0, reprovado: 0, pendente: 0, total: 0 };
    const totalServNovo = { aprovado: 0, reprovado: 0, pendente: 0, total: 0 };

    serDir.forEach((srv: any) => {
      const statusGroup = categorizeStatus(srv.status);
      const isNovo = (srv.tipoContratacao || srv.tipo_contratacao) === "Novo";
      const tipoStr = isNovo ? "Serviço Novo" : "Serviço Existente";

      if (isNovo) {
        totalServNovo[statusGroup as keyof typeof totalServNovo]++;
        totalServNovo.total++;
      } else {
        totalServExistente[statusGroup as keyof typeof totalServExistente]++;
        totalServExistente.total++;
      }

      const gerId = getGerenciaId(srv.gerencia_id);
      if (gerId) {
        const g = gerenciaMap.get(gerId);
        if (isNovo) {
          g.servicoNovo[statusGroup]++;
          g.servicoNovo.total++;
        } else {
          g.servicoExistente[statusGroup]++;
          g.servicoExistente.total++;
        }
        g.totalGeral++;
      }

      list.push({
        id: `SRV-${srv.item || srv.id?.substring(0, 6)}`,
        tipo: tipoStr,
        descricao: srv.objeto,
        gerencia: gerencias.find(g => g.id === srv.gerencia_id)?.sigla || srv.gerencia || "-",
        status: srv.status || "rascunho",
        statusGroup,
        valor: srv.estimativaValor || srv.estimativa_valor || 0,
        data: srv.created_at
      });
      orcamentoPlanejado += Number(srv.estimativaValor || srv.estimativa_valor || 0);
    });

    const chartGer = Array.from(gerenciaMap.values()).map(g => ({
      name: g.sigla,
      "Aquis. Aprov.": g.aquisicao.aprovado,
      "Aquis. Pend.": g.aquisicao.pendente,
      "Serv. Exist. Aprov.": g.servicoExistente.aprovado,
      "Serv. Exist. Pend.": g.servicoExistente.pendente,
      "Serv. Novo Aprov.": g.servicoNovo.aprovado,
      "Serv. Novo Pend.": g.servicoNovo.pendente,
      total: g.totalGeral
    })).sort((a, b) => b.total - a.total);

    const chartStat = [
      { name: "Aprovados", value: totalAquisicao.aprovado + totalServExistente.aprovado + totalServNovo.aprovado, color: COLORS[0] },
      { name: "Reprovados", value: totalAquisicao.reprovado + totalServExistente.reprovado + totalServNovo.reprovado, color: COLORS[1] },
      { name: "Pendentes", value: totalAquisicao.pendente + totalServExistente.pendente + totalServNovo.pendente, color: COLORS[2] },
    ];

    const totalValorDiretoria = list.reduce((acc, curr) => acc + curr.valor, 0);
    const listWithPercent = list.map(item => ({
      ...item,
      percentual: totalValorDiretoria > 0 ? (item.valor / totalValorDiretoria) * 100 : 0
    }));

    const limiteOrcamentario = Number(adminConfig?.diretoriaBudgetsOrcamentoGeral?.[diretoriaId] || 0);
    const saldoDisponivel = limiteOrcamentario - orcamentoPlanejado;
    const eficienciaGeral = limiteOrcamentario > 0 ? (orcamentoPlanejado / limiteOrcamentario) * 100 : 0;

    return {
      kpis: {
        limiteOrcamentario,
        orcamentoPlanejado,
        saldoDisponivel,
        eficienciaGeral,
        totalGeral: totalAquisicao.total + totalServExistente.total + totalServNovo.total
      },
      chartDataGerencias: chartGer,
      chartDataStatus: chartStat,
      unifiedList: listWithPercent.sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())
    };
  }, [solicitacoes, servicos, gerenciasAtuais, diretoriaId, gerencias, filterGerencia, filterYear, filterMonth, filterDay, adminConfig]);

  const filteredList = useMemo(() => {
    const result = unifiedList.filter(item => {
      const matchesSearch = item.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTipo = filterTipo === "todos" || item.tipo === filterTipo;
      const matchesStatus = filterStatus === "todos" || item.statusGroup === filterStatus;
      return matchesSearch && matchesTipo && matchesStatus;
    });

    if (sortConfig !== null) {
      result.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [unifiedList, searchTerm, filterTipo, filterStatus, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  if (isLoading || !diretoria) {
    return (
      <div className="w-full flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Old KPICard component removed as we will use financial cards inline

  return (
    <div className="w-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <TabsList>
            <TabsTrigger value="resultados">Visão de Resultados</TabsTrigger>
            <TabsTrigger value="solicitacoes">Tabela de Solicitações</TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="mt-4 sm:mt-0 px-3 py-1 bg-indigo-50 border-indigo-200 text-indigo-700">
            Total de Requisições ({diretoria.sigla}): {kpis.totalGeral}
          </Badge>
        </div>

        <TabsContent value="resultados" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 flex flex-col justify-center border-l-4 border-l-purple-500">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Limite Orçamentário</h3>
              <p className="text-2xl font-bold text-slate-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.limiteOrcamentario)}</p>
            </Card>
            
            <Card className="p-4 flex flex-col justify-center border-l-4 border-l-blue-500">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Orçamento Planejado</h3>
              <p className="text-2xl font-bold text-slate-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.orcamentoPlanejado)}</p>
            </Card>

            <Card className="p-4 flex flex-col justify-center border-l-4 border-l-green-500">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Saldo Disponível</h3>
              <p className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.saldoDisponivel)}</p>
              <p className="text-xs text-slate-400 mt-1">{kpis.eficienciaGeral.toFixed(1)}% do limite consumido</p>
            </Card>

            <Card className="p-4 flex flex-col justify-center border-l-4 border-l-amber-400">
              <h3 className="text-sm font-medium text-slate-500 mb-2">Eficiência</h3>
              <p className="text-2xl font-bold text-amber-500 mb-2">{kpis.eficienciaGeral.toFixed(0)}%</p>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${Math.min(100, kpis.eficienciaGeral)}%` }}></div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-4 lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Volume por Gerência</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataGerencias} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                    <Bar dataKey="Aquis. Aprov." stackId="a" fill="#3b82f6" />
                    <Bar dataKey="Aquis. Pend." stackId="a" fill="#93c5fd" />
                    <Bar dataKey="Serv. Exist. Aprov." stackId="a" fill="#4f46e5" />
                    <Bar dataKey="Serv. Exist. Pend." stackId="a" fill="#a5b4fc" />
                    <Bar dataKey="Serv. Novo Aprov." stackId="a" fill="#9333ea" />
                    <Bar dataKey="Serv. Novo Pend." stackId="a" fill="#d8b4fe" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 flex flex-col">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Status Geral ({diretoria.sigla})</h3>
              <div className="flex-1 min-h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartDataStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={1}
                    >
                      {chartDataStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip itemStyle={{ color: '#1e293b' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-[-20px]">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-slate-800">
                      {chartDataStatus.reduce((acc, curr) => acc + curr.value, 0)}
                    </p>
                    <p className="text-xs text-slate-500 uppercase font-medium">Total</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4">
          <Card className="p-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por ID ou Descrição..." 
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <UISelect value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="Aquisição">Aquisição</SelectItem>
                <SelectItem value="Serviço Existente">Serviço Existente</SelectItem>
                <SelectItem value="Serviço Novo">Serviço Novo</SelectItem>
              </SelectContent>
            </UISelect>
            <UISelect value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="reprovado">Reprovados</SelectItem>
              </SelectContent>
            </UISelect>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm text-left relative">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>
                      <div className="flex items-center gap-1">ID <SortIcon columnKey="id" /></div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('tipo')}>
                      <div className="flex items-center gap-1">Tipo <SortIcon columnKey="tipo" /></div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('descricao')}>
                      <div className="flex items-center gap-1">Descrição / Objeto <SortIcon columnKey="descricao" /></div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('gerencia')}>
                      <div className="flex items-center gap-1">Gerência <SortIcon columnKey="gerencia" /></div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">Status <SortIcon columnKey="status" /></div>
                    </th>
                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('valor')}>
                      <div className="flex items-center justify-end gap-1">Valor Est. <SortIcon columnKey="valor" /></div>
                    </th>
                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('percentual')}>
                      <div className="flex items-center justify-end gap-1">% do Orç. <SortIcon columnKey="percentual" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((item, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{item.id}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          item.tipo === "Aquisição" ? "bg-blue-50 text-blue-700" :
                          item.tipo === "Serviço Novo" ? "bg-purple-50 text-purple-700" :
                          "bg-indigo-50 text-indigo-700"
                        }>
                          {item.tipo}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-xs" title={item.descricao}>
                        {item.descricao || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.gerencia}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.statusGroup === "aprovado" ? "bg-green-100 text-green-700" :
                          item.statusGroup === "reprovado" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, item.percentual)}%` }}></div>
                          </div>
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{item.percentual.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhum item encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default AdminDiretoriaDashboard;
