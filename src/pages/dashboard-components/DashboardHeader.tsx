import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";

interface DashboardHeaderProps {
  filtroDiretoria: string;
  crossFilterGerencia: string | null;
  crossFilterSubcat: string | null;
  crossFilterMes: string | null;
  isLimitedData: boolean;
  handleExportExcel: () => void;
  handleExportPDF: () => void;
  navigate: (path: string) => void;
}

export const DashboardHeader = ({
  crossFilterGerencia,
  crossFilterSubcat,
  crossFilterMes,
  isLimitedData,
  handleExportExcel,
  handleExportPDF,
  navigate
}: DashboardHeaderProps) => {
  return (
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
            {isLimitedData && (
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400 text-amber-200 px-3 py-1.5 rounded-md text-sm font-medium">
                ⚠️ Aviso: Apenas os 2.000 registros mais recentes foram carregados para evitar travamentos. Os totais financeiros abaixo representam apenas esta amostra.
              </div>
            )}
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
  );
};
