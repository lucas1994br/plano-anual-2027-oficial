import { Target, BarChart3, Activity, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
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
  Line,
  ComposedChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";

const COLORS = ['#4f46e5', '#38bdf8', '#fbbf24', '#f43f5e', '#10b981', '#8b5cf6', '#f97316', '#06b6d4'];

interface DashboardChartsProps {
  filtroAno: string;
  visao: "diretoria" | "gerencias";
  filtroCategoria: string;
  dynamicEvolutionData: any[];
  dynamicGerenciaData: any[];
  dynamicPieData: any[];
  radarData: any[];
  statusPieData: any[];
  limiteAquisicao: number;
  kpiNfAquisicoes: number;
  onComposedChartClick: (data: any) => void;
  onBarClick: (data: any) => void;
  onPieClick: (data: any) => void;
  formatCurrency: (val: number) => string;
  getChartDataKey: () => string;
}

const DashboardCharts = ({
  filtroAno,
  visao,
  filtroCategoria,
  dynamicEvolutionData,
  dynamicGerenciaData,
  dynamicPieData,
  radarData,
  statusPieData,
  limiteAquisicao,
  kpiNfAquisicoes,
  onComposedChartClick,
  onBarClick,
  onPieClick,
  formatCurrency,
  getChartDataKey
}: DashboardChartsProps) => {
  return (
    <>
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
                <ComposedChart data={dynamicEvolutionData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }} onClick={(e) => onComposedChartClick(e as any)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f1f5f9' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  {filtroAno === "2026" ? (
                    <>
                      <Bar dataKey="realizadoPrevisto" name="Realizado Previsto" fill={COLORS[0]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                      <Bar dataKey="naoPrevisto" name="Não Previsto" fill={COLORS[1]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                    </>
                  ) : (
                    <Bar dataKey="orcamentoExecutado" name="Realizado (Barra)" fill={COLORS[0]} radius={[4, 4, 0, 0]} className="cursor-pointer hover:opacity-80" />
                  )}
                  <Line type="monotone" dataKey="orcamentoPlanejado" name="Orçamento Base (Linha)" stroke={COLORS[3]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} className="cursor-pointer hover:opacity-80" />
                </ComposedChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ORÇAMENTO AQUISIÇÃO vs REALIZADO (Apenas 2026) */}
        {filtroAno === "2026" && (
          <Card className="col-span-1 lg:col-span-3 shadow-sm border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-700">
                <BarChart3 className="h-5 w-5 text-teal-500" />
                Orçamento Aquisição vs Realizado
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Orçamento Aquisição", valor: limiteAquisicao, fill: COLORS[3] },
                  { name: "NF Aquisições", valor: kpiNfAquisicoes, fill: COLORS[0] }
                ]} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {
                      [
                        { fill: COLORS[3] },
                        { fill: COLORS[0] }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

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
              <BarChart data={dynamicGerenciaData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} onClick={(e) => e?.activePayload && onBarClick(e.activePayload[0].payload as any)}>
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

      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-6">
        {/* PIE CHART (INTERATIVO) */}
        <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <PieChartIcon className="h-5 w-5 text-emerald-500" />
              Top Subcategorias
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart onClick={(e) => e && onPieClick(e as any)}>
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
                  {dynamicPieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={entry.opacity} className="hover:opacity-80 transition-opacity" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* STATUS PIE CHART */}
        <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <Activity className="h-5 w-5 text-blue-500" />
              Status de Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusPieData.map((entry: any, index: number) => (
                    <Cell key={`status-cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default DashboardCharts;
