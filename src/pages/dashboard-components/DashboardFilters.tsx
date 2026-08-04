import { Filter, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";

const TRIMESTRES = ["1º Trimestre", "2º Trimestre", "3º Trimestre", "4º Trimestre"];
const BIMESTRES = ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre", "5º Bimestre", "6º Bimestre"];
const SEMANAS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];
const ANOS = ["2026", "2027", "2028"];
const MOCK_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DashboardFiltersProps {
  REAL_DIRETORIAS: string[];
  filtroDiretoria: string;
  handleDiretoriaChange: (val: string) => void;
  filtroGerencia: string;
  setFiltroGerencia: (val: string) => void;
  gerenciasAtuais: string[];
  crossFilterGerencia: string | null;
  setCrossFilterGerencia: (val: string | null) => void;
  filtroCategoria: string;
  setFiltroCategoria: (val: string) => void;
  filtroSubcategoria: string;
  setFiltroSubcategoria: (val: string) => void;
  crossFilterSubcat: string | null;
  setCrossFilterSubcat: (val: string | null) => void;
  getSubcategoriasOptions: () => string[];
  filtroAno: string;
  setFiltroAno: (val: string) => void;
  filtroTrimestre: string;
  setFiltroTrimestre: (val: string) => void;
  filtroBimestre: string;
  setFiltroBimestre: (val: string) => void;
  filtroMes: string;
  setFiltroMes: (val: string) => void;
  crossFilterMes: string | null;
  setCrossFilterMes: (val: string | null) => void;
  filtroSemana: string;
  setFiltroSemana: (val: string) => void;
  limparFiltros: () => void;
  visao: "diretoria" | "gerencias";
  setVisao: (v: "diretoria" | "gerencias") => void;
}

export const DashboardFilters = ({
  REAL_DIRETORIAS,
  filtroDiretoria,
  handleDiretoriaChange,
  filtroGerencia,
  setFiltroGerencia,
  gerenciasAtuais,
  crossFilterGerencia,
  setCrossFilterGerencia,
  filtroCategoria,
  setFiltroCategoria,
  filtroSubcategoria,
  setFiltroSubcategoria,
  crossFilterSubcat,
  setCrossFilterSubcat,
  getSubcategoriasOptions,
  filtroAno,
  setFiltroAno,
  filtroTrimestre,
  setFiltroTrimestre,
  filtroBimestre,
  setFiltroBimestre,
  filtroMes,
  setFiltroMes,
  crossFilterMes,
  setCrossFilterMes,
  filtroSemana,
  setFiltroSemana,
  limparFiltros,
  visao,
  setVisao
}: DashboardFiltersProps) => {
  return (
    <>
      <div className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex flex-col gap-4 transition-all">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold">
            <Filter className="h-5 w-5" /> Painel de Segmentação Visual
          </div>
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-slate-500 hover:text-indigo-600 h-8">
            Limpar Todos os Filtros
          </Button>
        </div>
        
        {/* LINHA 1: SLICERS DE BOTÃO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-bold text-indigo-700">📌 Diretoria</label>
            <Select value={filtroDiretoria} onValueChange={handleDiretoriaChange}>
              <SelectTrigger className="bg-indigo-50 border-indigo-200 text-indigo-800 font-semibold"><SelectValue placeholder="Diretoria" /></SelectTrigger>
              <SelectContent>
                {REAL_DIRETORIAS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 lg:col-span-5 lg:border-l lg:pl-4">
            <label className="text-xs font-medium text-slate-500">Segmentação de Gerências (Visível)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant={filtroGerencia === "todas" ? "default" : "outline"} className={`cursor-pointer px-3 py-1 text-sm transition-all hover:scale-105 ${filtroGerencia === "todas" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 bg-white"}`} onClick={() => { setFiltroGerencia("todas"); setCrossFilterGerencia(null); }}>
                Todas
              </Badge>
              {gerenciasAtuais.map((g: string) => (
                <Badge key={g} variant={filtroGerencia === g ? "default" : "outline"} className={`cursor-pointer px-3 py-1 text-sm transition-all hover:scale-105 ${filtroGerencia === g ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 bg-white"} ${crossFilterGerencia === g ? 'ring-2 ring-amber-400' : ''}`} onClick={() => { setFiltroGerencia(g === filtroGerencia ? "todas" : g); setCrossFilterGerencia(null); }} title={g}>
                  {g.split(" - ")[0]}
                </Badge>
              ))}
            </div>
          </div>

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

        {/* LINHA 2: TEMPO E SUBCATEGORIAS */}
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

      <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-slate-200">
        <Tabs value={visao} onValueChange={(v) => setVisao(v as "diretoria" | "gerencias")} className="w-full lg:w-auto">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-slate-100">
            <TabsTrigger value="diretoria" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Visão Consolidada</TabsTrigger>
            <TabsTrigger value="gerencias" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Visão por Gerência</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="hidden lg:flex items-center text-sm text-slate-500 gap-2 pr-4">
          <CalendarDays className="h-4 w-4" /> Dados sincronizados da Diretoria {filtroDiretoria}
        </div>
      </div>
    </>
  );
};
