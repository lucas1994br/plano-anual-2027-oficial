import { useEffect, useMemo, useState } from "react";
import { Save, Waypoints, Wallet, Building2, CheckCircle2, TrendingUp, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { CurrencyInput } from "@/components/ui/currency-input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  getAdminMiniErpConfigDb,
  getCategoryBudgetOwnerRules,
  getGerenciasByDiretoria,
  saveAdminMiniErpConfigDb,
  saveCategoryBudgetOwnerRules,
  criarOrcamento,
  enviarOrcamento,
  deletarOrcamento
} from "@/lib/services.ts";
import {
  AdminBudgetConfig,
  DEFAULT_BUDGET_OWNER,
  RoutingRule,
  loadAdminBudgetConfig,
  saveAdminBudgetConfig,
} from "@/lib/adminBudgetConfig.ts";
import { CATEGORIAS_ITEM_PREDEFINIDAS } from "@/lib/catalogMetadata.ts";
import { MATERIAL_DESCRIPTION_BY_CODE } from "@/data/materialDescriptionByCode.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";

interface DiretoriaResumo {
  id: string;
  sigla: string;
  nome: string;
}

interface GerenciaResumo {
  id: string;
  sigla: string;
  nome: string;
  diretoria_id: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const toNumber = (raw: string | number) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function AdminBudgetControl({ diretorias }: { diretorias: DiretoriaResumo[] }) {
  const queryClient = useQueryClient();
  const [diretoriaBudgetsAquisicao, setDiretoriaBudgetsAquisicao] = useState<Record<string, number>>({});
  const [diretoriaBudgetsServicos, setDiretoriaBudgetsServicos] = useState<Record<string, number>>({});
  const [diretoriaBudgetsServicosNovos, setDiretoriaBudgetsServicosNovos] = useState<Record<string, number>>({});
  const [diretoriaBudgetsServicosExistentes, setDiretoriaBudgetsServicosExistentes] = useState<Record<string, number>>({});

  const [gerenciaBudgetsAquisicao, setGerenciaBudgetsAquisicao] = useState<Record<string, number>>({});
  const [gerenciaBudgetsServicos, setGerenciaBudgetsServicos] = useState<Record<string, number>>({});
  const [gerenciaBudgetsServicosNovos, setGerenciaBudgetsServicosNovos] = useState<Record<string, number>>({});
  const [gerenciaBudgetsServicosExistentes, setGerenciaBudgetsServicosExistentes] = useState<Record<string, number>>({});

  const [routingRules, setRoutingRules] = useState<Record<string, RoutingRule>>({});
  const [categoryBudgetOwners, setCategoryBudgetOwners] = useState<Record<string, string>>({});
  
  const [selectedDirId, setSelectedDirId] = useState<string | null>(diretorias[0]?.id || null);
  const [activeTab, setActiveTab] = useState<"aquisicao" | "servicos_novos" | "servicos_existentes">("aquisicao");
  const [isSaving, setIsSaving] = useState(false);

  const { data: gerencias = [], isLoading: isLoadingGerencias } = useQuery({
    queryKey: ["admin-mini-erp-gerencias", diretorias.map((d) => d.id).join("|")],
    queryFn: async () => {
      const all = await Promise.all(diretorias.map((dir) => getGerenciasByDiretoria(dir.id)));
      return all.flat() as unknown as GerenciaResumo[];
    },
    enabled: diretorias.length > 0,
  });

  const { data: categoryOwnersFromDb = {} } = useQuery({
    queryKey: ["category-budget-owners-db"],
    queryFn: getCategoryBudgetOwnerRules,
  });

  const { data: miniConfigFromDb = {} } = useQuery({
    queryKey: ["admin-mini-erp-config-db"],
    queryFn: getAdminMiniErpConfigDb,
  });

  const diretoriaMap = useMemo(() => {
    const map: Record<string, DiretoriaResumo> = {};
    diretorias.forEach((dir) => {
      map[dir.id] = dir;
    });
    return map;
  }, [diretorias]);

  const gerenciasByDiretoria = useMemo(() => {
    const map: Record<string, GerenciaResumo[]> = {};
    gerencias.forEach((ger) => {
      if (!map[ger.diretoria_id]) {
        map[ger.diretoria_id] = [];
      }
      map[ger.diretoria_id].push(ger);
    });
    return map;
  }, [gerencias]);

  useEffect(() => {
    if (diretorias.length === 0) return;
    const saved = loadAdminBudgetConfig();

    const dirAquisicao: Record<string, number> = {};
    const dirServicos: Record<string, number> = {};
    const dirServicosNovos: Record<string, number> = {};
    const dirServicosExistentes: Record<string, number> = {};
    const gerAquisicao: Record<string, number> = {};
    const gerServicos: Record<string, number> = {};
    const gerServicosNovos: Record<string, number> = {};
    const gerServicosExistentes: Record<string, number> = {};

    diretorias.forEach(dir => {
        dirAquisicao[dir.id] = (miniConfigFromDb as any)?.diretoriaBudgetsAquisicao?.[dir.id] || 0;
        dirServicos[dir.id] = (miniConfigFromDb as any)?.diretoriaBudgetsServicos?.[dir.id] || 0;
        dirServicosNovos[dir.id] = (miniConfigFromDb as any)?.diretoriaBudgetsServicosNovos?.[dir.id] || 0;
        dirServicosExistentes[dir.id] = (miniConfigFromDb as any)?.diretoriaBudgetsServicosExistentes?.[dir.id] || 0;
    });

    gerencias.forEach(ger => {
        gerAquisicao[ger.id] = (miniConfigFromDb as any)?.gerenciaBudgetsAquisicao?.[ger.id] || 0;
        gerServicos[ger.id] = (miniConfigFromDb as any)?.gerenciaBudgetsServicos?.[ger.id] || 0;
        gerServicosNovos[ger.id] = (miniConfigFromDb as any)?.gerenciaBudgetsServicosNovos?.[ger.id] || 0;
        gerServicosExistentes[ger.id] = (miniConfigFromDb as any)?.gerenciaBudgetsServicosExistentes?.[ger.id] || 0;
    });

    setDiretoriaBudgetsAquisicao(dirAquisicao);
    setDiretoriaBudgetsServicos(dirServicos);
    setDiretoriaBudgetsServicosNovos(dirServicosNovos);
    setDiretoriaBudgetsServicosExistentes(dirServicosExistentes);
    setGerenciaBudgetsAquisicao(gerAquisicao);
    setGerenciaBudgetsServicos(gerServicos);
    setGerenciaBudgetsServicosNovos(gerServicosNovos);
    setGerenciaBudgetsServicosExistentes(gerServicosExistentes);

    const defaultRules = gerencias.reduce<Record<string, RoutingRule>>((acc, ger) => {
      acc[ger.id] = ((miniConfigFromDb as any)?.routingRules?.[ger.id]) ?? saved?.routingRules?.[ger.id] ?? {
        destinoTipo: "diretoria",
        destinoId: ger.diretoria_id,
      };
      return acc;
    }, {});
    setRoutingRules(defaultRules);

    const categoriasOrcamentarias = Array.from(new Set([
        ...CATEGORIAS_ITEM_PREDEFINIDAS,
        ...Object.values(MATERIAL_DESCRIPTION_BY_CODE),
        ...Object.keys(categoryOwnersFromDb || {})
    ])).filter(Boolean);

    const defaultCategoryBudgetOwners = categoriasOrcamentarias.reduce<Record<string, string>>((acc, categoria) => {
      acc[categoria] = categoryOwnersFromDb?.[categoria] ?? DEFAULT_BUDGET_OWNER;
      return acc;
    }, {});
    setCategoryBudgetOwners(defaultCategoryBudgetOwners);
  }, [diretorias, gerencias, categoryOwnersFromDb, miniConfigFromDb]);

  const totalDiretoriasAquisicao = useMemo(() => Object.values(diretoriaBudgetsAquisicao).reduce((acc, v) => acc + v, 0), [diretoriaBudgetsAquisicao]);
  const totalGerenciasAquisicao = useMemo(() => Object.values(gerenciaBudgetsAquisicao).reduce((acc, v) => acc + v, 0), [gerenciaBudgetsAquisicao]);
  const fundoGlobalAquisicao = totalDiretoriasAquisicao + totalGerenciasAquisicao;

  const totalDiretoriasServicos = useMemo(() => Object.values(diretoriaBudgetsServicos).reduce((acc, v) => acc + v, 0), [diretoriaBudgetsServicos]);
  const totalGerenciasServicos = useMemo(() => Object.values(gerenciaBudgetsServicos).reduce((acc, v) => acc + v, 0), [gerenciaBudgetsServicos]);
  
  const totalDiretoriasServicosNovos = useMemo(() => Object.values(diretoriaBudgetsServicosNovos).reduce((acc, v) => acc + v, 0), [diretoriaBudgetsServicosNovos]);
  const totalGerenciasServicosNovos = useMemo(() => Object.values(gerenciaBudgetsServicosNovos).reduce((acc, v) => acc + v, 0), [gerenciaBudgetsServicosNovos]);
  const fundoGlobalServicosNovos = totalDiretoriasServicosNovos + totalGerenciasServicosNovos;

  const totalDiretoriasServicosExistentes = useMemo(() => Object.values(diretoriaBudgetsServicosExistentes).reduce((acc, v) => acc + v, 0), [diretoriaBudgetsServicosExistentes]);
  const totalGerenciasServicosExistentes = useMemo(() => Object.values(gerenciaBudgetsServicosExistentes).reduce((acc, v) => acc + v, 0), [gerenciaBudgetsServicosExistentes]);
  const fundoGlobalServicosExistentes = totalDiretoriasServicosExistentes + totalGerenciasServicosExistentes;

  const fundoGlobalAcumulado = fundoGlobalAquisicao + fundoGlobalServicosNovos + fundoGlobalServicosExistentes;

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Como as novas Edge Functions (enviarOrcamento) podem não estar em produção
      // e para evitar 10+ requisições sequenciais, utilizamos o batching nativo
      // já publicado e funcional para garantir que a UI funcione.
      await saveAdminMiniErpConfigDb({
          diretoriaBudgetsAquisicao,
          diretoriaBudgetsServicos,
          diretoriaBudgetsServicosNovos,
          diretoriaBudgetsServicosExistentes,
          gerenciaBudgetsAquisicao,
          gerenciaBudgetsServicos,
          gerenciaBudgetsServicosNovos,
          gerenciaBudgetsServicosExistentes,
          routingRules
      });
      
      await saveCategoryBudgetOwnerRules(categoryBudgetOwners);

      queryClient.invalidateQueries({ queryKey: ["admin-mini-erp-config-db"] });
      queryClient.invalidateQueries({ queryKey: ["category-budget-owners-db"] });
      toast.success("Orçamentos e repasses configurados com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar orçamentos. Verifique os logs.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedDir = diretoriaMap[selectedDirId || ""];
  const gerenciasOfSelectedDir = gerenciasByDiretoria[selectedDir?.id || ""] || [];

  const retidoDirAquisicao = diretoriaBudgetsAquisicao[selectedDir?.id || ""] || 0;
  const repassadoGerenciasAquisicao = gerenciasOfSelectedDir.reduce((acc, g) => acc + (gerenciaBudgetsAquisicao[g.id] || 0), 0);
  const fundoDCAquisicao = retidoDirAquisicao + repassadoGerenciasAquisicao;

  const retidoDirServicosNovos = diretoriaBudgetsServicosNovos[selectedDir?.id || ""] || 0;
  const repassadoGerenciasServicosNovos = gerenciasOfSelectedDir.reduce((acc, g) => acc + (gerenciaBudgetsServicosNovos[g.id] || 0), 0);
  const fundoDCServicosNovos = retidoDirServicosNovos + repassadoGerenciasServicosNovos;

  const retidoDirServicosExistentes = diretoriaBudgetsServicosExistentes[selectedDir?.id || ""] || 0;
  const repassadoGerenciasServicosExistentes = gerenciasOfSelectedDir.reduce((acc, g) => acc + (gerenciaBudgetsServicosExistentes[g.id] || 0), 0);
  const fundoDCServicosExistentes = retidoDirServicosExistentes + repassadoGerenciasServicosExistentes;

  const currentFundo = activeTab === "aquisicao" ? fundoDCAquisicao : (activeTab === "servicos_novos" ? fundoDCServicosNovos : fundoDCServicosExistentes);
  const currentRetido = activeTab === "aquisicao" ? retidoDirAquisicao : (activeTab === "servicos_novos" ? retidoDirServicosNovos : retidoDirServicosExistentes);
  const currentRepassado = activeTab === "aquisicao" ? repassadoGerenciasAquisicao : (activeTab === "servicos_novos" ? repassadoGerenciasServicosNovos : repassadoGerenciasServicosExistentes);
  const currentGerenciaBudgets = activeTab === "aquisicao" ? gerenciaBudgetsAquisicao : (activeTab === "servicos_novos" ? gerenciaBudgetsServicosNovos : gerenciaBudgetsServicosExistentes);
  
  const handleRetidoChange = (val: number) => {
      if (activeTab === "aquisicao") {
          setDiretoriaBudgetsAquisicao(prev => ({ ...prev, [selectedDir.id]: val }));
      } else if (activeTab === "servicos_novos") {
          setDiretoriaBudgetsServicosNovos(prev => ({ ...prev, [selectedDir.id]: val }));
      } else {
          setDiretoriaBudgetsServicosExistentes(prev => ({ ...prev, [selectedDir.id]: val }));
      }
  };

  const handleGerenciaChange = (gerId: string, val: number) => {
      if (activeTab === "aquisicao") {
          setGerenciaBudgetsAquisicao(prev => ({ ...prev, [gerId]: val }));
      } else if (activeTab === "servicos_novos") {
          setGerenciaBudgetsServicosNovos(prev => ({ ...prev, [gerId]: val }));
      } else {
          setGerenciaBudgetsServicosExistentes(prev => ({ ...prev, [gerId]: val }));
      }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#1f2937] rounded-xl p-6 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Painel de Orçamentos</h2>
            <p className="text-white/70 text-sm mt-1">Gerencie fundos, defina a pirâmide de repasses e roteamento.</p>
          </div>
        </div>
        <Button 
            onClick={handleSaveConfig} 
            disabled={isSaving}
            className="bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20 border-0 rounded-lg font-medium px-6 py-5 gap-2 transition-all hover:scale-105"
        >
          {isSaving ? "Salvando..." : (
              <>
                  <Save className="h-4 w-4" />
                  Gravar Configurações
              </>
          )}
        </Button>
      </div>

      {/* Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 rounded-2xl shadow-sm border-0 ring-1 ring-slate-200 bg-white relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 text-slate-100/50 pointer-events-none">
                <span className="text-[120px] font-black tracking-tighter leading-none">$</span>
            </div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Fundo Acumulado</p>
            <p className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(fundoGlobalAcumulado)}</p>
            <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1.5 py-1 px-2 text-[10px]">
                    <TrendingUp className="h-3 w-3" />
                    Ativo p/ 2027
                </Badge>
            </div>
        </Card>
        
        <Card className="p-6 rounded-2xl shadow-sm border-0 ring-1 ring-slate-200 bg-[#f8fafc] relative overflow-hidden">
            <div className="h-1.5 w-16 bg-blue-500/20 rounded-full absolute bottom-6 left-6"></div>
            <p className="text-[10px] font-bold tracking-widest text-blue-500/70 uppercase mb-2">Fundos: Aquisição</p>
            <p className="text-xl font-bold text-blue-900 tracking-tight">{formatCurrency(fundoGlobalAquisicao)}</p>
        </Card>

        <Card className="p-6 rounded-2xl shadow-sm border-0 ring-1 ring-emerald-100 bg-[#ecfdf5] relative overflow-hidden">
            <div className="h-1.5 w-16 bg-emerald-500/40 rounded-full absolute bottom-6 left-6"></div>
            <p className="text-[10px] font-bold tracking-widest text-emerald-600/70 uppercase mb-2">Fundos: Novos Serv.</p>
            <p className="text-xl font-bold text-emerald-800 tracking-tight">{formatCurrency(fundoGlobalServicosNovos)}</p>
        </Card>
        
        <Card className="p-6 rounded-2xl shadow-sm border-0 ring-1 ring-teal-100 bg-teal-50 relative overflow-hidden">
            <div className="h-1.5 w-16 bg-teal-500/40 rounded-full absolute bottom-6 left-6"></div>
            <p className="text-[10px] font-bold tracking-widest text-teal-600/70 uppercase mb-2">Fundos: Serv. Existentes</p>
            <p className="text-xl font-bold text-teal-800 tracking-tight">{formatCurrency(fundoGlobalServicosExistentes)}</p>
        </Card>
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar - Diretorias */}
        <div className="w-full md:w-64 flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2 px-2 py-3">
                <Building2 className="h-5 w-5 text-slate-400" />
                <span className="font-bold tracking-widest text-xs text-slate-500 uppercase">Diretoria</span>
            </div>
            <div className="space-y-3">
                {diretorias.map(dir => (
                    <button
                        key={dir.id}
                        onClick={() => setSelectedDirId(dir.id)}
                        className={cn(
                            "w-full text-left px-5 py-4 rounded-xl text-sm font-medium transition-all duration-200 border",
                            selectedDirId === dir.id 
                                ? "bg-[#1f2937] text-white border-transparent shadow-lg shadow-slate-800/10 scale-[1.02]" 
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                    >
                        <div className="font-bold mb-1">{dir.sigla} - {dir.nome}</div>
                    </button>
                ))}
            </div>
        </div>

        {/* Right Content - Tabs and Pirâmide */}
        <div className="flex-1 min-w-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <div className="bg-white rounded-t-2xl px-6 pt-6 border-b border-slate-200">
                    <TabsList className="bg-transparent h-auto p-0 border-b-0 space-x-6">
                        <TabsTrigger 
                            value="aquisicao" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-slate-800 rounded-none px-2 py-3 text-sm font-semibold text-slate-500 data-[state=active]:text-slate-900 transition-none"
                        >
                            Aquisição de Itens
                        </TabsTrigger>
                        <TabsTrigger 
                            value="servicos_novos" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 rounded-none px-2 py-3 text-sm font-semibold text-slate-500 data-[state=active]:text-emerald-700 transition-none"
                        >
                            Novos Serviços
                        </TabsTrigger>
                        <TabsTrigger 
                            value="servicos_existentes" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none px-2 py-3 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 transition-none"
                        >
                            Serviços Existentes
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="bg-white rounded-b-2xl border border-t-0 border-slate-200 p-8 shadow-sm">
                    {selectedDir && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-start justify-between mb-8 pb-8 border-b border-slate-100">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Waypoints className={cn("h-5 w-5", activeTab === "aquisicao" ? "text-blue-500" : "text-emerald-500")} />
                                        Pirâmide de Repasses
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">Configure o fundo total da {selectedDir.sigla} e distribua os repasses.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-1">Fundo {selectedDir.sigla}</p>
                                    <p className={cn("text-3xl font-black tracking-tight", activeTab === "aquisicao" ? "text-slate-800" : (activeTab === "servicos_novos" ? "text-emerald-600" : "text-teal-600"))}>
                                        {formatCurrency(currentFundo)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-8 items-start relative">
                                {/* Retido na Diretoria */}
                                <div className="w-full lg:w-1/3 bg-slate-50 rounded-2xl p-6 border-l-4 border-l-[#1f2937] ring-1 ring-slate-200 shadow-sm relative z-10">
                                    <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-4">Retido na Diretoria ({selectedDir.sigla})</p>
                                    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-2 shadow-inner">
                                        <CurrencyInput
                                            className="text-xl font-bold border-0 bg-transparent focus-visible:ring-0 shadow-none px-3"
                                            value={currentRetido === 0 ? "" : String(currentRetido)}
                                            placeholder="0,00"
                                            onChange={(e) => handleRetidoChange(toNumber(e.target.value))}
                                        />
                                    </div>
                                    <div className="mt-4 flex items-center justify-between text-sm">
                                        <span className="text-slate-500 font-medium">% do Fundo</span>
                                        <Badge variant="secondary" className="bg-slate-200/50 text-slate-700 hover:bg-slate-200/50">
                                            {currentFundo > 0 ? ((currentRetido / currentFundo) * 100).toFixed(1) : "0"}%
                                        </Badge>
                                    </div>
                                </div>

                                {/* Seta indicativa */}
                                <div className="hidden lg:flex items-center justify-center h-full absolute left-1/3 top-1/2 -translate-y-1/2 -translate-x-4 z-0 text-slate-300">
                                    <ChevronRight className="h-8 w-8" />
                                </div>

                                {/* Repasses para Gerências */}
                                <div className="w-full lg:w-2/3 space-y-4 relative z-10">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">Repasses para Gerências</p>
                                        <p className="text-xs font-medium text-slate-400 lowercase">total repassado: {formatCurrency(currentRepassado)}</p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {gerenciasOfSelectedDir.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                                Nenhuma gerência cadastrada nesta diretoria.
                                            </div>
                                        ) : (
                                            gerenciasOfSelectedDir.map(ger => {
                                                const val = currentGerenciaBudgets[ger.id] || 0;
                                                const pct = currentFundo > 0 ? ((val / currentFundo) * 100).toFixed(1) : "0.0";
                                                
                                                return (
                                                    <div key={ger.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                                                        <div className="w-20">
                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 w-full justify-center text-xs font-bold py-1 px-0">
                                                                {ger.sigla}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex-1 bg-slate-50 rounded-lg ring-1 ring-slate-200/60 p-1">
                                                            <CurrencyInput
                                                                className="text-right font-medium border-0 bg-transparent focus-visible:ring-0 shadow-none h-8"
                                                                value={val === 0 ? "" : String(val)}
                                                                placeholder="0,00"
                                                                onChange={(e) => handleGerenciaChange(ger.id, toNumber(e.target.value))}
                                                            />
                                                        </div>
                                                        <div className="w-24 text-right">
                                                            <p className="text-[10px] text-slate-400 font-medium mb-0.5">% do Fundo</p>
                                                            <Badge variant="outline" className="text-slate-600 bg-slate-50 justify-center w-16">
                                                                {pct}%
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Tabs>
        </div>
      </div>
    </div>
  );
}
