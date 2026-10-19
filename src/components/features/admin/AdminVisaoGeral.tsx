import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip.tsx";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Filter, BarChart3, CheckCircle2, Clock, XCircle, FileSpreadsheet, FileDown, Building2, TrendingUp, Layers, PieChart as PieIcon, Info, Landmark, Wallet } from "lucide-react";
import { 
  getDiretorias, 
  getTodasGerencias, 
  getPeriodosAtivos,
  getSolicitacoesResumoByPeriodo,
  getServicosResumoByPeriodo,
  getAdminMiniErpConfigDb
} from "@/lib/services.ts";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const PIE_COLORS = {
  aprovado: "#10b981", // Emerald
  pendente: "#f59e0b", // Amber
  rejeitado: "#ef4444", // Red
};

/* Tooltips Customizadas dos Gráficos */
const PieCustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white text-slate-800 text-xs p-3.5 rounded-xl border border-slate-200 shadow-xl space-y-2 min-w-[240px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 font-bold">
        <span className="text-slate-900 text-sm">{data.name}</span>
        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold text-xs">{data.value} solicitações</span>
      </div>
      <p className="text-xs font-semibold text-slate-700">
        Valor Total: <span className="font-extrabold text-slate-900">{formatCurrency(data.valor)}</span>
      </p>
      <div className="pt-1.5 border-t border-slate-100 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-slate-600 font-medium">📦 Aquisição:</span>
          <span className="font-semibold text-blue-600">{data.aquisicaoCount} itens ({formatCurrency(data.aquisicaoValor)})</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-600 font-medium">🛠️ Serv. Existentes:</span>
          <span className="font-semibold text-emerald-600">{data.existentesCount} serv. ({formatCurrency(data.existentesValor)})</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-600 font-medium">🚀 Novos Serviços:</span>
          <span className="font-semibold text-purple-600">{data.novosCount} serv. ({formatCurrency(data.novosValor)})</span>
        </div>
      </div>
    </div>
  );
};

const VerticalBarCustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white text-slate-800 text-xs p-3.5 rounded-xl border border-slate-200 shadow-xl space-y-2 min-w-[250px]">
      <p className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1">
        {data.modalidade}
      </p>
      <p className="font-semibold text-slate-700 text-xs">
        Valor Total : <span className="font-extrabold text-slate-900">{formatCurrency(data.valor)}</span> <span className="text-muted-foreground font-normal">({data.qtd} solicitações)</span>
      </p>
      <div className="pt-1.5 border-t border-slate-100 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-emerald-700 font-medium">✓ Aprovadas:</span>
          <span className="font-semibold text-emerald-700">{data.aprovadasCount} solic. ({formatCurrency(data.aprovadasValor)})</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-amber-700 font-medium">⏳ Pendentes:</span>
          <span className="font-semibold text-amber-700">{data.pendentesCount} solic. ({formatCurrency(data.pendentesValor)})</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-red-700 font-medium">✕ Rejeitadas:</span>
          <span className="font-semibold text-red-700">{data.rejeitadasCount} solic. ({formatCurrency(data.rejeitadasValor)})</span>
        </div>
      </div>
    </div>
  );
};

const HorizontalBarCustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white text-slate-800 text-xs p-3.5 rounded-xl border border-slate-200 shadow-xl space-y-2 min-w-[260px]">
      <div className="border-b border-slate-100 pb-1">
        <p className="font-bold text-slate-900 text-sm">{data.unidade}</p>
        <p className="text-[10px] text-muted-foreground font-normal">{data.unidadeNome}</p>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-slate-600 font-medium">📦 Aquisição:</span>
          <span className="font-semibold text-blue-600">{formatCurrency(data["Aquisição"])} ({data.aquisicaoQtd} itens)</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-600 font-medium">🛠️ Serv. Existentes:</span>
          <span className="font-semibold text-emerald-600">{formatCurrency(data["Serviços Existentes"])} ({data.existentesQtd} serv.)</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-600 font-medium">🚀 Novos Serviços:</span>
          <span className="font-semibold text-purple-600">{formatCurrency(data["Novos Serviços"])} ({data.novosQtd} serv.)</span>
        </div>
        <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-100 font-bold text-slate-900 text-xs">
          <span>Valor Total Acumulado:</span>
          <span className="text-indigo-900">{formatCurrency(data.total)}</span>
        </div>
      </div>
    </div>
  );
};

export const AdminVisaoGeral = () => {
  // Filters
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterDiretoria, setFilterDiretoria] = useState<string>("all");
  const [filterGerencia, setFilterGerencia] = useState<string>("all");
  const [selectedUnidadeFilter, setSelectedUnidadeFilter] = useState<string>("todas");

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
    staleTime: 2 * 60 * 1000,
  });

  const { data: servicos = [], isLoading: isLoadingSer } = useQuery({
    queryKey: ["todos-servicos-resumo", periodoAtivoId],
    queryFn: () => getServicosResumoByPeriodo({ periodoId: periodoAtivoId! }),
    enabled: !!periodoAtivoId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: adminConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["admin-config-db"],
    queryFn: getAdminMiniErpConfigDb,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = isLoadingPer || isLoadingDir || isLoadingGer || isLoadingConfig || (!!periodoAtivoId && (isLoadingSol || isLoadingSer));

  const { 
    totals,
    pieData,
    verticalBarData,
    horizontalBarData,
    unidadeMatrix
  } = useMemo(() => {
    
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

    const VALID_STATUSES = new Set(["enviado", "em_analise", "aprovado", "rejeitado", "em_compra", "concluido"]);

    const categorizeStatus = (status: string) => {
      if (!status) return null;
      const s = status.toLowerCase();
      if (!VALID_STATUSES.has(s)) return null;
      if (s === "aprovado" || s === "em_compra" || s === "concluido") return "aprovado";
      if (s === "rejeitado") return "rejeitado";
      return "pendente";
    };

    // Determine the grouping units (Diretorias if filterDiretoria === "all", otherwise Gerencias of the selected Diretoria)
    const groupingUnits = filterDiretoria === "all" 
      ? diretorias.map((d: any) => ({ id: d.id as string, sigla: d.sigla, nome: d.nome, isDiretoria: true }))
      : (() => {
          const d = diretorias.find((x: any) => x.id === filterDiretoria);
          const gerList = gerencias.filter((g: any) => g.diretoria_id === filterDiretoria).map((g: any) => ({ id: g.id as string, sigla: g.sigla, nome: g.nome, isDiretoria: false }));
          if (d) {
            gerList.unshift({ id: d.id as string, sigla: d.sigla, nome: `Diretoria`, isDiretoria: true });
          }
          return gerList;
        })();

    const unitMap = new Map<string, any>();
    groupingUnits.forEach(u => {
      unitMap.set(u.id, {
        id: u.id,
        sigla: u.sigla,
        nome: u.nome,
        isDiretoria: u.isDiretoria,
        qtdAquisicao: 0, valorAquisicao: 0,
        qtdServicosExistentes: 0, valorServicosExistentes: 0,
        qtdServicosNovos: 0, valorServicosNovos: 0,
        aprovadasCount: 0, aprovadasValor: 0,
        aprovadasAquisicaoCount: 0, aprovadasAquisicaoValor: 0,
        aprovadasExistentesCount: 0, aprovadasExistentesValor: 0,
        aprovadasNovosCount: 0, aprovadasNovosValor: 0,
        pendentesCount: 0, pendentesValor: 0,
        pendentesAquisicaoCount: 0, pendentesAquisicaoValor: 0,
        pendentesExistentesCount: 0, pendentesExistentesValor: 0,
        pendentesNovosCount: 0, pendentesNovosValor: 0,
        rejeitadasCount: 0, rejeitadasValor: 0,
        rejeitadasAquisicaoCount: 0, rejeitadasAquisicaoValor: 0,
        rejeitadasExistentesCount: 0, rejeitadasExistentesValor: 0,
        rejeitadasNovosCount: 0, rejeitadasNovosValor: 0,
      });
    });

    const getUnitId = (item: any) => {
      if (filterDiretoria === "all") {
        return item.diretoria_id || item.diretoriaId || getDiretoriaId(item.gerencia_id, item.diretoriaSigla);
      } else {
        const gSigla = String(item.gerenciaSigla || item.gerencia || "").toUpperCase();
        if (!item.gerencia_id || item.gerencia_id === filterDiretoria || gSigla.includes("DIRETORIA")) {
          return filterDiretoria;
        }
        return item.gerencia_id;
      }
    };

    const processItem = (item: any, isServico: boolean, isNovo: boolean) => {
      const statusGroup = categorizeStatus(item.status);
      if (!statusGroup) return; // Ignore invalid statuses (like rascunho)

      const val = isServico 
        ? (Number(item.dotacaoOrcamentaria) || Number(item.estimativaValor) || Number(item.estimativa_valor) || Number(item.valorTotal) || Number(item.valor_total) || 0)
        : ((Number(item.valorUnitario) || Number(item.valor_unitario) || Number(item.item?.valor_unitario) || 0) * (Number(item.qtdEstimada) || Number(item.qtd_estimada) || 1));
      
      const qtd = isServico ? 1 : (Number(item.qtdEstimada) || Number(item.qtd_estimada) || 1);
      if (qtd <= 0 && !isServico) return; // Ignore 0 qtd
      
      const uId = getUnitId(item);
      let u = unitMap.get(uId);
      if (!u && uId) {
        // Fallback for unmapped units
        u = {
          id: uId, sigla: isServico ? item.unidadeDemandante || "N/A" : item.gerenciaSigla || "N/A", nome: "Não Atribuída",
          qtdAquisicao: 0, valorAquisicao: 0, qtdServicosExistentes: 0, valorServicosExistentes: 0, qtdServicosNovos: 0, valorServicosNovos: 0,
          aprovadasCount: 0, aprovadasValor: 0, aprovadasAquisicaoCount: 0, aprovadasAquisicaoValor: 0, aprovadasExistentesCount: 0, aprovadasExistentesValor: 0, aprovadasNovosCount: 0, aprovadasNovosValor: 0,
          pendentesCount: 0, pendentesValor: 0, pendentesAquisicaoCount: 0, pendentesAquisicaoValor: 0, pendentesExistentesCount: 0, pendentesExistentesValor: 0, pendentesNovosCount: 0, pendentesNovosValor: 0,
          rejeitadasCount: 0, rejeitadasValor: 0, rejeitadasAquisicaoCount: 0, rejeitadasAquisicaoValor: 0, rejeitadasExistentesCount: 0, rejeitadasExistentesValor: 0, rejeitadasNovosCount: 0, rejeitadasNovosValor: 0,
        };
        unitMap.set(uId, u);
      }

      if (u) {
        if (!isServico) {
          u.qtdAquisicao++;
          u.valorAquisicao += val;
          if (statusGroup === "aprovado") { u.aprovadasAquisicaoCount++; u.aprovadasAquisicaoValor += val; }
          else if (statusGroup === "rejeitado") { u.rejeitadasAquisicaoCount++; u.rejeitadasAquisicaoValor += val; }
          else { u.pendentesAquisicaoCount++; u.pendentesAquisicaoValor += val; }
        } else if (isServico && !isNovo) {
          u.qtdServicosExistentes++;
          u.valorServicosExistentes += val;
          if (statusGroup === "aprovado") { u.aprovadasExistentesCount++; u.aprovadasExistentesValor += val; }
          else if (statusGroup === "rejeitado") { u.rejeitadasExistentesCount++; u.rejeitadasExistentesValor += val; }
          else { u.pendentesExistentesCount++; u.pendentesExistentesValor += val; }
        } else if (isServico && isNovo) {
          u.qtdServicosNovos++;
          u.valorServicosNovos += val;
          if (statusGroup === "aprovado") { u.aprovadasNovosCount++; u.aprovadasNovosValor += val; }
          else if (statusGroup === "rejeitado") { u.rejeitadasNovosCount++; u.rejeitadasNovosValor += val; }
          else { u.pendentesNovosCount++; u.pendentesNovosValor += val; }
        }

        if (statusGroup === "aprovado") { u.aprovadasCount++; u.aprovadasValor += val; }
        else if (statusGroup === "rejeitado") { u.rejeitadasCount++; u.rejeitadasValor += val; }
        else { u.pendentesCount++; u.pendentesValor += val; }
      }
    };

    const uniqueAquisicaoMap = new Map<string, any>();
    solicitacoesFiltradas.forEach((rawItem: any) => {
      const codigo = Number(rawItem.codigo ?? rawItem.item?.codigo) || 0;
      const gerenciaId = rawItem.gerencia_id || rawItem.gerenciaId;
      const gerenciaSigla = rawItem.gerencia || rawItem.gerenciaSigla;
      const key = rawItem.id ? String(rawItem.id) : `cod-${codigo}-${gerenciaId || gerenciaSigla}`;
      if (!uniqueAquisicaoMap.has(key)) {
        uniqueAquisicaoMap.set(key, rawItem);
      }
    });

    const uniqueServicosMap = new Map<string, any>();
    servicosFiltrados.forEach((rawServico: any) => {
      const itemKey = String(rawServico.item || "").trim();
      const gerenciaId = rawServico.gerencia_id || rawServico.gerenciaId;
      const gerenciaSigla = rawServico.gerencia || rawServico.unidadeDemandante;
      const key = rawServico.id ? String(rawServico.id) : `serv-${itemKey}-${gerenciaId || gerenciaSigla}`;
      if (!uniqueServicosMap.has(key)) {
        uniqueServicosMap.set(key, rawServico);
      }
    });

    Array.from(uniqueAquisicaoMap.values()).forEach(sol => processItem(sol, false, false));
    Array.from(uniqueServicosMap.values()).forEach(srv => {
      const isNovo = (srv.tipoContratacao || srv.tipo_contratacao) === "Novo" || Number(srv.item) >= 9000000;
      processItem(srv, true, isNovo);
    });

    const unidadeMatrix = Array.from(unitMap.values()).map(u => {
      const totalSolicitacoes = u.qtdAquisicao + u.qtdServicosExistentes + u.qtdServicosNovos;
      const valorTotalGeral = u.valorAquisicao + u.valorServicosExistentes + u.valorServicosNovos;
      
      let orcamentoUnidade = 0;
      if (u.isDiretoria && adminConfig?.diretoriaBudgetsOrcamentoGeral) {
        orcamentoUnidade = adminConfig.diretoriaBudgetsOrcamentoGeral[u.id] || 0;
      }
      // Se for gerência, não temos orçamento por gerência no admin facilmente aqui (só se estiver em orcamentoConfig, que precisaria ser buscado via API de budget ou no config geral)
      // Simplificação: vamos deixar 0 por enquanto para gerências na tela admin

      const saldoGeralUnidade = orcamentoUnidade > 0 ? (orcamentoUnidade - valorTotalGeral) : 0;

      return {
        ...u,
        totalSolicitacoes,
        valorTotalGeral,
        orcamentoUnidade,
        saldoGeralUnidade
      };
    }).sort((a, b) => b.valorTotalGeral - a.valorTotalGeral); // sort by total value desc

    let orcamentoTotal = 0;
    if (adminConfig?.diretoriaBudgetsOrcamentoGeral) {
      if (filterDiretoria !== "all") {
        orcamentoTotal = adminConfig.diretoriaBudgetsOrcamentoGeral[filterDiretoria] || 0;
      } else {
        orcamentoTotal = Object.values(adminConfig.diretoriaBudgetsOrcamentoGeral).reduce((a:any, b:any) => a + b, 0) as number;
      }
    }

    const t = unidadeMatrix.reduce(
      (acc, curr) => ({
        qtdAquisicao: acc.qtdAquisicao + curr.qtdAquisicao,
        valorAquisicao: acc.valorAquisicao + curr.valorAquisicao,
        qtdServicosExistentes: acc.qtdServicosExistentes + curr.qtdServicosExistentes,
        valorServicosExistentes: acc.valorServicosExistentes + curr.valorServicosExistentes,
        qtdServicosNovos: acc.qtdServicosNovos + curr.qtdServicosNovos,
        valorServicosNovos: acc.valorServicosNovos + curr.valorServicosNovos,
        totalSolicitacoes: acc.totalSolicitacoes + curr.totalSolicitacoes,

        aprovadasCount: acc.aprovadasCount + curr.aprovadasCount,
        aprovadasValor: acc.aprovadasValor + curr.aprovadasValor,
        aprovadasAquisicaoCount: acc.aprovadasAquisicaoCount + curr.aprovadasAquisicaoCount,
        aprovadasAquisicaoValor: acc.aprovadasAquisicaoValor + curr.aprovadasAquisicaoValor,
        aprovadasExistentesCount: acc.aprovadasExistentesCount + curr.aprovadasExistentesCount,
        aprovadasExistentesValor: acc.aprovadasExistentesValor + curr.aprovadasExistentesValor,
        aprovadasNovosCount: acc.aprovadasNovosCount + curr.aprovadasNovosCount,
        aprovadasNovosValor: acc.aprovadasNovosValor + curr.aprovadasNovosValor,

        pendentesCount: acc.pendentesCount + curr.pendentesCount,
        pendentesValor: acc.pendentesValor + curr.pendentesValor,
        pendentesAquisicaoCount: acc.pendentesAquisicaoCount + curr.pendentesAquisicaoCount,
        pendentesAquisicaoValor: acc.pendentesAquisicaoValor + curr.pendentesAquisicaoValor,
        pendentesExistentesCount: acc.pendentesExistentesCount + curr.pendentesExistentesCount,
        pendentesExistentesValor: acc.pendentesExistentesValor + curr.pendentesExistentesValor,
        pendentesNovosCount: acc.pendentesNovosCount + curr.pendentesNovosCount,
        pendentesNovosValor: acc.pendentesNovosValor + curr.pendentesNovosValor,

        rejeitadasCount: acc.rejeitadasCount + curr.rejeitadasCount,
        rejeitadasValor: acc.rejeitadasValor + curr.rejeitadasValor,
        rejeitadasAquisicaoCount: acc.rejeitadasAquisicaoCount + curr.rejeitadasAquisicaoCount,
        rejeitadasAquisicaoValor: acc.rejeitadasAquisicaoValor + curr.rejeitadasAquisicaoValor,
        rejeitadasExistentesCount: acc.rejeitadasExistentesCount + curr.rejeitadasExistentesCount,
        rejeitadasExistentesValor: acc.rejeitadasExistentesValor + curr.rejeitadasExistentesValor,
        rejeitadasNovosCount: acc.rejeitadasNovosCount + curr.rejeitadasNovosCount,
        rejeitadasNovosValor: acc.rejeitadasNovosValor + curr.rejeitadasNovosValor,

        valorTotalGeral: acc.valorTotalGeral + curr.valorTotalGeral,
      }),
      {
        qtdAquisicao: 0, valorAquisicao: 0, qtdServicosExistentes: 0, valorServicosExistentes: 0, qtdServicosNovos: 0, valorServicosNovos: 0,
        totalSolicitacoes: 0, aprovadasCount: 0, aprovadasValor: 0, aprovadasAquisicaoCount: 0, aprovadasAquisicaoValor: 0, aprovadasExistentesCount: 0, aprovadasExistentesValor: 0, aprovadasNovosCount: 0, aprovadasNovosValor: 0,
        pendentesCount: 0, pendentesValor: 0, pendentesAquisicaoCount: 0, pendentesAquisicaoValor: 0, pendentesExistentesCount: 0, pendentesExistentesValor: 0, pendentesNovosCount: 0, pendentesNovosValor: 0,
        rejeitadasCount: 0, rejeitadasValor: 0, rejeitadasAquisicaoCount: 0, rejeitadasAquisicaoValor: 0, rejeitadasExistentesCount: 0, rejeitadasExistentesValor: 0, rejeitadasNovosCount: 0, rejeitadasNovosValor: 0,
        valorTotalGeral: 0,
      }
    );

    const saldoGeral = orcamentoTotal - t.valorTotalGeral;

    const totalsObj = {
      ...t,
      orcamentoTotal,
      saldoGeral,
    };

    const pieDataList = [
      {
        name: "Aprovadas", value: totalsObj.aprovadasCount, color: PIE_COLORS.aprovado, valor: totalsObj.aprovadasValor,
        aquisicaoCount: totalsObj.aprovadasAquisicaoCount, aquisicaoValor: totalsObj.aprovadasAquisicaoValor,
        existentesCount: totalsObj.aprovadasExistentesCount, existentesValor: totalsObj.aprovadasExistentesValor,
        novosCount: totalsObj.aprovadasNovosCount, novosValor: totalsObj.aprovadasNovosValor,
      },
      {
        name: "Pendentes de Aprovação", value: totalsObj.pendentesCount, color: PIE_COLORS.pendente, valor: totalsObj.pendentesValor,
        aquisicaoCount: totalsObj.pendentesAquisicaoCount, aquisicaoValor: totalsObj.pendentesAquisicaoValor,
        existentesCount: totalsObj.pendentesExistentesCount, existentesValor: totalsObj.pendentesExistentesValor,
        novosCount: totalsObj.pendentesNovosCount, novosValor: totalsObj.pendentesNovosValor,
      },
      {
        name: "Rejeitadas", value: totalsObj.rejeitadasCount, color: PIE_COLORS.rejeitado, valor: totalsObj.rejeitadasValor,
        aquisicaoCount: totalsObj.rejeitadasAquisicaoCount, aquisicaoValor: totalsObj.rejeitadasAquisicaoValor,
        existentesCount: totalsObj.rejeitadasExistentesCount, existentesValor: totalsObj.rejeitadasExistentesValor,
        novosCount: totalsObj.rejeitadasNovosCount, novosValor: totalsObj.rejeitadasNovosValor,
      },
    ].filter((item) => item.value > 0 || totalsObj.totalSolicitacoes === 0);

    const vertBarData = [
      {
        modalidade: "Aquisição", valor: totalsObj.valorAquisicao, qtd: totalsObj.qtdAquisicao, fill: "#3b82f6",
        aprovadasCount: totalsObj.aprovadasAquisicaoCount, aprovadasValor: totalsObj.aprovadasAquisicaoValor,
        pendentesCount: totalsObj.pendentesAquisicaoCount, pendentesValor: totalsObj.pendentesAquisicaoValor,
        rejeitadasCount: totalsObj.rejeitadasAquisicaoCount, rejeitadasValor: totalsObj.rejeitadasAquisicaoValor,
      },
      {
        modalidade: "Serviços Existentes", valor: totalsObj.valorServicosExistentes, qtd: totalsObj.qtdServicosExistentes, fill: "#10b981",
        aprovadasCount: totalsObj.aprovadasExistentesCount, aprovadasValor: totalsObj.aprovadasExistentesValor,
        pendentesCount: totalsObj.pendentesExistentesCount, pendentesValor: totalsObj.pendentesExistentesValor,
        rejeitadasCount: totalsObj.rejeitadasExistentesCount, rejeitadasValor: totalsObj.rejeitadasExistentesValor,
      },
      {
        modalidade: "Novos Serviços", valor: totalsObj.valorServicosNovos, qtd: totalsObj.qtdServicosNovos, fill: "#8b5cf6",
        aprovadasCount: totalsObj.aprovadasNovosCount, aprovadasValor: totalsObj.aprovadasNovosValor,
        pendentesCount: totalsObj.pendentesNovosCount, pendentesValor: totalsObj.pendentesNovosValor,
        rejeitadasCount: totalsObj.rejeitadasNovosCount, rejeitadasValor: totalsObj.rejeitadasNovosValor,
      },
    ];

    const horizBarData = unidadeMatrix.map((u) => ({
      unidade: u.sigla, unidadeNome: u.nome,
      "Aquisição": u.valorAquisicao, aquisicaoQtd: u.qtdAquisicao,
      "Serviços Existentes": u.valorServicosExistentes, existentesQtd: u.qtdServicosExistentes,
      "Novos Serviços": u.valorServicosNovos, novosQtd: u.qtdServicosNovos,
      total: u.valorTotalGeral, totalQtd: u.totalSolicitacoes,
    }));

    return { totals: totalsObj, pieData: pieDataList, verticalBarData: vertBarData, horizontalBarData: horizBarData, unidadeMatrix };
  }, [solicitacoes, servicos, diretorias, gerencias, filterDiretoria, filterGerencia, filterYear, filterMonth, filterDay, adminConfig]);

  const filteredMatrix = useMemo(() => {
    if (selectedUnidadeFilter === "todas") return unidadeMatrix;
    return unidadeMatrix.filter((u) => u.id === selectedUnidadeFilter);
  }, [unidadeMatrix, selectedUnidadeFilter]);

  // Export placeholders since admin might have a different logic or no need right now
  const handleExportExcel = () => { console.log("Exportar Excel"); };
  const handleExportPDF = () => { console.log("Exportar PDF"); };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
            <p className="text-slate-500">Acompanhamento consolidado de todas as diretorias e categorias.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-slate-700" />
              <span>Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
            >
              <FileDown className="h-4 w-4 text-slate-700" />
              <span>PDF</span>
            </Button>
          </div>
        </div>

        {/* Top Filters block preserved from original */}
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

        {/* KPIs idênticos à Visão Gerencial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* KPI 1: Total Solicitações */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="p-4 border-l-4 border-l-blue-500 bg-white shadow-sm hover:shadow-md transition-all cursor-help relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      Total Solicitações
                      <Info className="h-3 w-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{totals.totalSolicitacoes}</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 font-medium">Todas as modalidades</p>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
              <p className="font-bold text-xs border-b border-slate-700 pb-1 text-blue-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Detalhamento de Solicitações
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">📦 Aquisição:</span>
                  <span className="font-semibold text-blue-400">{totals.qtdAquisicao} itens ({formatCurrency(totals.valorAquisicao)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                  <span className="font-semibold text-emerald-400">{totals.qtdServicosExistentes} serv. ({formatCurrency(totals.valorServicosExistentes)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🚀 Novos Serviços:</span>
                  <span className="font-semibold text-purple-400">{totals.qtdServicosNovos} serv. ({formatCurrency(totals.valorServicosNovos)})</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* KPI 2: Aprovadas */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="p-4 border-l-4 border-l-emerald-500 bg-white shadow-sm hover:shadow-md transition-all cursor-help relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      Aprovadas
                      <Info className="h-3 w-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{totals.aprovadasCount}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-700 mt-2">
                  {formatCurrency(totals.aprovadasValor)}
                </p>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
              <p className="font-bold text-xs border-b border-slate-700 pb-1 text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Detalhamento de Aprovadas
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">📦 Aquisição:</span>
                  <span className="font-semibold text-blue-400">{totals.aprovadasAquisicaoCount} itens ({formatCurrency(totals.aprovadasAquisicaoValor)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                  <span className="font-semibold text-emerald-400">{totals.aprovadasExistentesCount} serv. ({formatCurrency(totals.aprovadasExistentesValor)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🚀 Novos Serviços:</span>
                  <span className="font-semibold text-purple-400">{totals.aprovadasNovosCount} serv. ({formatCurrency(totals.aprovadasNovosValor)})</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* KPI 3: Pendentes */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="p-4 border-l-4 border-l-amber-500 bg-white shadow-sm hover:shadow-md transition-all cursor-help relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      Pendentes
                      <Info className="h-3 w-3 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    </p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{totals.pendentesCount}</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-amber-700 mt-2">
                  {formatCurrency(totals.pendentesValor)}
                </p>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
              <p className="font-bold text-xs border-b border-slate-700 pb-1 text-amber-300 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Detalhamento de Pendências
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">📦 Aquisição:</span>
                  <span className="font-semibold text-blue-400">{totals.pendentesAquisicaoCount} itens ({formatCurrency(totals.pendentesAquisicaoValor)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                  <span className="font-semibold text-emerald-400">{totals.pendentesExistentesCount} serv. ({formatCurrency(totals.pendentesExistentesValor)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🚀 Novos Serviços:</span>
                  <span className="font-semibold text-purple-400">{totals.pendentesNovosCount} serv. ({formatCurrency(totals.pendentesNovosValor)})</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* KPI 4: Rejeitadas */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="p-4 border-l-4 border-l-red-500 bg-white shadow-sm hover:shadow-md transition-all cursor-help relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      Rejeitadas
                      <Info className="h-3 w-3 text-slate-400 group-hover:text-red-500 transition-colors" />
                    </p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{totals.rejeitadasCount}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg text-red-600">
                    <XCircle className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-red-700 mt-2">
                  {formatCurrency(totals.rejeitadasValor)}
                </p>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
              <p className="font-bold text-xs border-b border-slate-700 pb-1 text-red-300 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Detalhamento de Rejeitadas
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">📦 Aquisição:</span>
                  <span className="font-semibold text-blue-400">{totals.rejeitadasAquisicaoCount} itens ({formatCurrency(totals.rejeitadasAquisicaoValor)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                  <span className="font-semibold text-emerald-400">{totals.rejeitadasExistentesCount} serv. ({formatCurrency(totals.rejeitadasExistentesValor)})</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🚀 Novos Serviços:</span>
                  <span className="font-semibold text-purple-400">{totals.rejeitadasNovosCount} serv. ({formatCurrency(totals.rejeitadasNovosValor)})</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* KPI 5: Total em R$ & Saldo Geral */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="p-4 border-l-4 border-l-indigo-500 bg-white shadow-sm hover:shadow-md transition-all cursor-help relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                      Total em R$
                      <Info className="h-3 w-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </p>
                    <p className="text-xl font-bold text-indigo-900 mt-1">{formatCurrency(totals.valorTotalGeral)}</p>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                </div>
                {totals.orcamentoTotal > 0 && (
                  <p className={`text-[11px] font-bold mt-2 ${totals.saldoGeral < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    Saldo Geral: {formatCurrency(totals.saldoGeral)}
                  </p>
                )}
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
              <p className="font-bold text-xs border-b border-slate-700 pb-1 text-indigo-300 flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" /> Balanço Financeiro & Saldo Geral
              </p>
              <div className="space-y-1.5 text-xs">
                {totals.orcamentoTotal > 0 && (
                  <div className="flex justify-between gap-4 border-b border-slate-800 pb-1">
                    <span className="text-slate-300 font-medium">🏛️ Orçamento Definido:</span>
                    <span className="font-bold text-blue-300">{formatCurrency(totals.orcamentoTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">📦 Gasto Aquisição:</span>
                  <span className="font-semibold text-blue-400">{formatCurrency(totals.valorAquisicao)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(totals.valorServicosExistentes)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-300">🚀 Novos Serviços:</span>
                  <span className="font-semibold text-purple-400">{formatCurrency(totals.valorServicosNovos)}</span>
                </div>
                {totals.orcamentoTotal > 0 && (
                  <div className="flex justify-between gap-4 pt-1.5 border-t border-slate-700">
                    <span className="text-slate-200 font-bold">💳 Saldo Geral:</span>
                    <span className={`font-extrabold ${totals.saldoGeral < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {formatCurrency(totals.saldoGeral)}
                    </span>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

        </div>

        {/* Seção de Gráficos com Custom Tooltips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Gráfico de Pizza / Donut */}
          <Card className="p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800 text-base">Distribuição de Status das Solicitações</h3>
              </div>
              <Badge variant="outline" className="text-xs text-slate-600 bg-slate-50">Visualização Geral</Badge>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PieCustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 2. Gráfico de Colunas Vertical */}
          <Card className="p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800 text-base">Gasto Total por Modalidade (R$)</h3>
              </div>
              <Badge variant="outline" className="text-xs text-blue-700 bg-blue-50 border-blue-200">Comparativo</Badge>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={verticalBarData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="modalidade" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <RechartsTooltip content={<VerticalBarCustomTooltip />} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {verticalBarData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 3. Gráfico de Colunas Horizontal */}
        <Card className="p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-slate-800 text-base">Comparativo de Gastos por Unidade (R$)</h3>
            </div>
            <Badge variant="outline" className="text-xs text-purple-700 bg-purple-50 border-purple-200">Por Unidade</Badge>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={horizontalBarData}
                margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis dataKey="unidade" type="category" tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }} />
                <RechartsTooltip content={<HorizontalBarCustomTooltip />} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="Aquisição" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Serviços Existentes" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Novos Serviços" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 4. Tabela de Matriz */}
        <Card className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                Matriz Gerencial de Acompanhamento
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visão detalhada por unidade, quantidade de solicitações, status e valores
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Filtrar Unidade:</span>
              <select
                value={selectedUnidadeFilter}
                onChange={(e) => setSelectedUnidadeFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white text-xs px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todas">Todas as Unidades</option>
                {unidadeMatrix.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.sigla}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="text-[11px] text-slate-500 uppercase bg-slate-100/80 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3.5 font-bold">Unidade</th>
                  <th scope="col" className="px-4 py-3.5 text-center font-bold text-blue-700">Aquisição (Qtd / R$)</th>
                  <th scope="col" className="px-4 py-3.5 text-center font-bold text-emerald-700">Serv. Existentes (Qtd / R$)</th>
                  <th scope="col" className="px-4 py-3.5 text-center font-bold text-purple-700">Serv. Novos (Qtd / R$)</th>
                  <th scope="col" className="px-4 py-3.5 text-center font-bold">Solicitações</th>
                  <th scope="col" className="px-4 py-3.5 text-center font-bold">Status (Aprov / Pend / Rej)</th>
                  <th scope="col" className="px-4 py-3.5 text-right font-bold text-slate-900">Valor Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatrix.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 flex flex-col">
                      <span>{row.sigla}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">{row.nome}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-slate-800">{row.qtdAquisicao}</span>
                      <span className="block text-[11px] text-blue-600/90 font-medium">
                        {formatCurrency(row.valorAquisicao)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-slate-800">{row.qtdServicosExistentes}</span>
                      <span className="block text-[11px] text-emerald-600/90 font-medium">
                        {formatCurrency(row.valorServicosExistentes)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-slate-800">{row.qtdServicosNovos}</span>
                      <span className="block text-[11px] text-purple-600/90 font-medium">
                        {formatCurrency(row.valorServicosNovos)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800 text-sm">
                      {row.totalSolicitacoes}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-[10px] px-1.5 py-0.5">
                          ✓ {row.aprovadasCount}
                        </Badge>
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-[10px] px-1.5 py-0.5">
                          ⏳ {row.pendentesCount}
                        </Badge>
                        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 text-[10px] px-1.5 py-0.5">
                          ✕ {row.rejeitadasCount}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-slate-900 text-sm">
                      {formatCurrency(row.valorTotalGeral)}
                    </td>
                  </tr>
                ))}
                {filteredMatrix.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhum dado encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredMatrix.length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td className="px-4 py-3.5 text-sm uppercase">Total</td>
                    <td className="px-4 py-3.5 text-center text-blue-700">
                      <div>{totals.qtdAquisicao} itens</div>
                      <div className="text-[11px]">{formatCurrency(totals.valorAquisicao)}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-emerald-700">
                      <div>{totals.qtdServicosExistentes} serv.</div>
                      <div className="text-[11px]">{formatCurrency(totals.valorServicosExistentes)}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-purple-700">
                      <div>{totals.qtdServicosNovos} serv.</div>
                      <div className="text-[11px]">{formatCurrency(totals.valorServicosNovos)}</div>
                    </td>
                    <td className="px-4 py-3.5 text-center text-base">{totals.totalSolicitacoes}</td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-emerald-700 font-bold">{totals.aprovadasCount}</span> /
                        <span className="text-amber-700 font-bold">{totals.pendentesCount}</span> /
                        <span className="text-red-700 font-bold">{totals.rejeitadasCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right text-base text-blue-900 font-black">
                      {formatCurrency(totals.valorTotalGeral)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
};
