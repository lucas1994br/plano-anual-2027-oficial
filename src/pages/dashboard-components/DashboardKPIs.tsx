import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Progress } from "@/components/ui/progress.tsx";

interface DashboardKPIsProps {
  filtroAno: string;
  limiteTotal: number;
  limiteAquisicao: number;
  limiteServicosExistentes: number;
  totalPlanejado: number;
  totalRealizado: number;
  totalExecutado: number;
  execucaoMedia: number;
  kpiRealizadoPrevisto: number;
  kpiSomaItensServicos: number;
  kpiQtdOc: number;
  kpiQtdFornecedores: number;
  kpiNaoPrevistoPlanejado: number;
  formatCurrency: (val: number) => string;
  setFiltroCategoria: (val: string) => void;
  setFiltroGerencia: (val: string) => void;
  setFiltroSubcategoria: (val: string) => void;
  setCrossFilterSubcat: (val: string | null) => void;
  limparFiltros: () => void;
}

export const DashboardKPIs = ({
  filtroAno,
  limiteTotal,
  limiteAquisicao,
  limiteServicosExistentes,
  totalPlanejado,
  totalRealizado,
  totalExecutado,
  execucaoMedia,
  kpiRealizadoPrevisto,
  kpiSomaItensServicos,
  kpiQtdOc,
  kpiQtdFornecedores,
  kpiNaoPrevistoPlanejado,
  formatCurrency,
  setFiltroCategoria,
  setFiltroGerencia,
  setFiltroSubcategoria,
  setCrossFilterSubcat,
  limparFiltros
}: DashboardKPIsProps) => {
  return (
    <>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${filtroAno === "2026" ? "lg:grid-cols-5" : "lg:grid-cols-5"}`}>
        <Card className="border-l-4 border-l-indigo-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-indigo-50" onClick={() => setFiltroCategoria("todas")} title="Clique para resetar Categoria">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-slate-500">
              {filtroAno === "2026" ? "Orçamento Aprovado" : "Limite Orçamentário (Admin)"}
            </CardDescription>
            <CardTitle className="text-lg xl:text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(limiteTotal || 0)}</CardTitle>
          </CardHeader>
        </Card>
        
        {filtroAno === "2026" ? (
           <>
             <Card className="border-l-4 border-l-teal-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-teal-50" onClick={() => setFiltroCategoria("Aquisição")}>
               <CardHeader className="pb-2">
                 <CardDescription className="font-medium text-slate-500">Orçamento Aquisição</CardDescription>
                 <CardTitle className="text-lg xl:text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(limiteAquisicao || 0)}</CardTitle>
               </CardHeader>
             </Card>
             <Card className="border-l-4 border-l-blue-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-blue-50" onClick={() => setFiltroCategoria("Serviço Existente")}>
               <CardHeader className="pb-2">
                 <CardDescription className="font-medium text-slate-500">Orçamento Serviços</CardDescription>
                 <CardTitle className="text-lg xl:text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(limiteServicosExistentes || 0)}</CardTitle>
               </CardHeader>
             </Card>
           </>
        ) : (
           <>
             <Card className="border-l-4 border-l-cyan-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-cyan-50" onClick={() => setFiltroGerencia("todas")} title="Clique para resetar Gerência">
               <CardHeader className="pb-2">
                 <CardDescription className="font-medium text-slate-500">Orçamento Planejado</CardDescription>
                 <CardTitle className="text-lg xl:text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(totalPlanejado)}</CardTitle>
               </CardHeader>
             </Card>
             <Card className="border-l-4 border-l-orange-500 shadow-sm transition-all hover:shadow-md cursor-pointer hover:bg-orange-50" onClick={() => setFiltroGerencia("todas")} title="Clique para resetar Gerência">
               <CardHeader className="pb-2">
                 <CardDescription className="font-medium text-slate-500">Gasto Real (Aprovado)</CardDescription>
                 <CardTitle className="text-lg xl:text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(totalRealizado)}</CardTitle>
               </CardHeader>
             </Card>
           </>
        )}
        
        <Card className={`border-l-4 shadow-sm transition-all hover:shadow-md cursor-pointer ${limiteTotal - (filtroAno === "2026" ? totalExecutado : totalRealizado) >= 0 ? 'border-l-emerald-500 hover:bg-emerald-50' : 'border-l-rose-500 hover:bg-rose-50'}`} onClick={() => { setFiltroSubcategoria("todas"); setCrossFilterSubcat(null); }} title="Clique para resetar Subcategoria">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium text-slate-500">{limiteTotal - (filtroAno === "2026" ? totalExecutado : totalRealizado) >= 0 ? "Saldo Disponível" : "Excedente Orçamentário"}</CardDescription>
            <CardTitle className={`text-lg xl:text-xl font-bold tracking-tight ${limiteTotal - (filtroAno === "2026" ? totalExecutado : totalRealizado) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(Math.abs((limiteTotal || 0) - (filtroAno === "2026" ? totalExecutado : totalPlanejado)))}
            </CardTitle>
            {limiteTotal > 0 && <div className="text-xs text-slate-500 mt-1 font-medium">{Math.abs(((filtroAno === "2026" ? totalExecutado : totalRealizado) / limiteTotal) * 100).toFixed(1)}% do limite consumido</div>}
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

      {/* Novos KPIs de Operação */}
      {filtroAno === "2026" && (
        <div className="flex flex-col gap-4 mt-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-slate-200 bg-slate-100/50 border-l-4 border-l-teal-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">VALOR TOTAL DE AQUISIÇÃO</CardDescription>
                <CardTitle className="text-xl font-bold text-teal-800">{formatCurrency(kpiRealizadoPrevisto)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200 bg-slate-100/50 border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">VALOR TOTAL DE SERVIÇOS EXISTENTES</CardDescription>
                <CardTitle className="text-xl font-bold text-blue-800">{formatCurrency(kpiSomaItensServicos)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200 bg-slate-100/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">QTD. ORDENS DE COMPRA</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-800">{kpiQtdOc}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="shadow-sm border-slate-200 bg-slate-100/50">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">QTD. FORNECEDORES</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-800">{kpiQtdFornecedores}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 w-1/3">
            <Card className="shadow-sm border-slate-200 bg-slate-100/50 border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">NÃO PREVISTO (ORÇADO)</CardDescription>
                <CardTitle className="text-xl font-bold text-amber-800">{formatCurrency(kpiNaoPrevistoPlanejado)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};
