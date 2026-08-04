import { Table as TableIcon, Filter, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";

interface DashboardTableProps {
  filteredMatrix: any[];
  crossFilterGerencia: string | null;
  crossFilterSubcat: string | null;
  crossFilterMes: string | null;
  handleExportExcel: () => void;
  limparFiltros: () => void;
  onTableRowClick: (row: any) => void;
  formatCurrency: (val: number) => string;
}

const DashboardTable = ({
  filteredMatrix,
  crossFilterGerencia,
  crossFilterSubcat,
  crossFilterMes,
  handleExportExcel,
  limparFiltros,
  onTableRowClick,
  formatCurrency
}: DashboardTableProps) => {
  return (
    <Card className="shadow-sm border-slate-200 mb-12 overflow-hidden mt-6">
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
                {filteredMatrix.map((row: any, idx: number) => (
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
  );
};

export default DashboardTable;
