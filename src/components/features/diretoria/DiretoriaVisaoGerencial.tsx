import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ArrowLeft, BarChart3, CheckCircle2, Clock, XCircle, FileSpreadsheet, Building2, TrendingUp, Layers, PieChart as PieIcon, Info, Landmark, Wallet } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PlanItem, ServicoItem, Diretoria, SolicitacaoStatus } from "@/types/plan";
import { getTotalDiretoriaBudget, getTotalGerenciaBudget } from "@/lib/adminBudgetConfig";

interface DiretoriaVisaoGerencialProps {
  diretoria: Diretoria;
  gerenciasData: any[];
  solicitacoes: PlanItem[];
  itensProprios: PlanItem[];
  servicosData: ServicoItem[];
  servicosCatalogoSet: Set<string>;
  orcamentoConfig?: any;
  onBack: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const PIE_COLORS = {
  aprovado: "#10b981", // Emerald
  pendente: "#f59e0b", // Amber
  rejeitado: "#ef4444", // Red
  rascunho: "#3b82f6",  // Blue
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
        <p className="font-bold text-slate-900 text-sm">{data.gerencia}</p>
        <p className="text-[10px] text-muted-foreground font-normal">{data.gerenciaNome}</p>
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

export function DiretoriaVisaoGerencial({
  diretoria,
  gerenciasData,
  solicitacoes,
  itensProprios,
  servicosData,
  servicosCatalogoSet,
  orcamentoConfig,
  onBack,
}: DiretoriaVisaoGerencialProps) {
  const [selectedGerenciaFilter, setSelectedGerenciaFilter] = useState<string>("todas");

  const siglaUpper = (diretoria?.sigla || "").toUpperCase();

  // Statuses válidos para contabilização de solicitações submetidas / processadas no painel
  const VALID_STATUSES = useMemo(() => new Set(["enviado", "em_analise", "aprovado", "rejeitado", "em_compra", "concluido"]), []);

  // Helper para converter valores numéricos com segurança
  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const num = typeof val === "number" ? val : Number(val);
    return isNaN(num) ? 0 : num;
  };

  // Consolidação por Gerência
  const gerenciaMatrix = useMemo(() => {
    const listGerencias = [...gerenciasData];
    if (!listGerencias.some((g) => g.sigla === siglaUpper)) {
      listGerencias.unshift({
        id: "diretoria",
        sigla: `DIRETORIA (${siglaUpper})`,
        nome: `Diretoria ${diretoria.nome}`,
      });
    }

    // Deduplica e padroniza os itens de aquisição válidos (status no fluxo de aprovação e quantidade > 0)
    const uniqueAquisicaoMap = new Map<string, any>();
    [...solicitacoes, ...itensProprios].forEach((rawItem: any) => {
      const st = rawItem.status || "rascunho";
      if (!VALID_STATUSES.has(st)) return;

      const qtd = parseNum(rawItem.qtdEstimada !== undefined ? rawItem.qtdEstimada : rawItem.qtd_estimada);
      if (qtd <= 0) return;

      const valUnit = parseNum(
        rawItem.valorUnitario !== undefined
          ? rawItem.valorUnitario
          : (rawItem.valor_unitario || rawItem.item?.valor_unitario)
      );
      const codigo = Number(rawItem.codigo ?? rawItem.item?.codigo) || 0;
      const gerenciaId = rawItem.gerencia_id || rawItem.gerenciaId;
      const gerenciaSigla = rawItem.gerencia || rawItem.gerenciaSigla;

      const normalized = {
        ...rawItem,
        id: rawItem.id,
        codigo,
        qtdEstimada: qtd,
        valorUnitario: valUnit,
        status: st as SolicitacaoStatus,
        gerencia_id: gerenciaId,
        gerencia: gerenciaSigla,
      };

      const key = rawItem.id ? String(rawItem.id) : `cod-${codigo}-${gerenciaId || gerenciaSigla}`;
      if (!uniqueAquisicaoMap.has(key)) {
        uniqueAquisicaoMap.set(key, normalized);
      }
    });

    const allAquisicao = Array.from(uniqueAquisicaoMap.values());

    // Deduplica e padroniza serviços válidos (status no fluxo de aprovação)
    const uniqueServicosMap = new Map<string, any>();
    servicosData.forEach((rawServico: any) => {
      const st = rawServico.status || "rascunho";
      if (!VALID_STATUSES.has(st)) return;

      const val = parseNum(
        rawServico.dotacaoOrcamentaria ||
        rawServico.estimativaValor ||
        rawServico.estimativa_valor ||
        rawServico.valor_total ||
        rawServico.valorTotal
      );
      const itemKey = String(rawServico.item || "").trim();
      const gerenciaId = rawServico.gerencia_id || rawServico.gerenciaId;
      const gerenciaSigla = rawServico.gerencia || rawServico.unidadeDemandante;

      const normalized = {
        ...rawServico,
        itemKey,
        valor: val,
        status: st as SolicitacaoStatus,
        gerencia_id: gerenciaId,
        gerencia: gerenciaSigla,
      };

      const key = rawServico.id ? String(rawServico.id) : `serv-${itemKey}-${gerenciaId || gerenciaSigla}`;
      if (!uniqueServicosMap.has(key)) {
        uniqueServicosMap.set(key, normalized);
      }
    });

    const allServicos = Array.from(uniqueServicosMap.values());

    return listGerencias.map((g) => {
      const gId = g.id;
      const gSigla = g.sigla;

      const isMatchGerencia = (itemGerenciaId?: string, itemGerenciaSigla?: string) => {
        const itemGId = itemGerenciaId ? String(itemGerenciaId) : "";
        const itemGSiglaUpper = itemGerenciaSigla ? String(itemGerenciaSigla).toUpperCase() : "";

        if (gId === "diretoria" || gSigla?.toUpperCase().includes("DIRETORIA")) {
          return (
            itemGId === diretoria.id ||
            itemGId === "diretoria" ||
            itemGSiglaUpper === siglaUpper ||
            itemGSiglaUpper === `DIRETORIA (${siglaUpper})` ||
            itemGSiglaUpper === `DIRETORIA ${siglaUpper}` ||
            itemGSiglaUpper === `DC - DIRETORIA` ||
            itemGSiglaUpper.includes("DIRETORIA")
          );
        }

        return (
          itemGId === gId ||
          itemGSiglaUpper === String(gSigla).toUpperCase() ||
          (g.nome && itemGSiglaUpper === g.nome.toUpperCase())
        );
      };

      // Aquisição da gerência
      const aquisicaoItems = allAquisicao.filter((i) =>
        isMatchGerencia(i.gerencia_id, i.gerencia)
      );

      let aprovadasAquisicaoCount = 0;
      let aprovadasAquisicaoValor = 0;
      let pendentesAquisicaoCount = 0;
      let pendentesAquisicaoValor = 0;
      let rejeitadasAquisicaoCount = 0;
      let rejeitadasAquisicaoValor = 0;

      aquisicaoItems.forEach((i) => {
        const val = i.qtdEstimada * i.valorUnitario;
        const st = i.status;
        if (st === "aprovado" || st === "em_compra" || st === "concluido") {
          aprovadasAquisicaoCount++;
          aprovadasAquisicaoValor += val;
        } else if (st === "rejeitado") {
          rejeitadasAquisicaoCount++;
          rejeitadasAquisicaoValor += val;
        } else if (st === "enviado" || st === "em_analise") {
          pendentesAquisicaoCount++;
          pendentesAquisicaoValor += val;
        }
      });

      const qtdAquisicao = aprovadasAquisicaoCount + pendentesAquisicaoCount + rejeitadasAquisicaoCount;
      const valorAquisicao = aprovadasAquisicaoValor + pendentesAquisicaoValor + rejeitadasAquisicaoValor;

      // Serviços da gerência
      const servicosItems = allServicos.filter((s) =>
        isMatchGerencia(s.gerencia_id || s.gerencia, s.gerencia || s.unidadeDemandante)
      );

      const servicosExistentes = servicosItems.filter((s) =>
        servicosCatalogoSet.has(s.itemKey)
      );

      let aprovadasExistentesCount = 0;
      let aprovadasExistentesValor = 0;
      let pendentesExistentesCount = 0;
      let pendentesExistentesValor = 0;
      let rejeitadasExistentesCount = 0;
      let rejeitadasExistentesValor = 0;

      servicosExistentes.forEach((s) => {
        const val = s.valor;
        const st = s.status;
        if (st === "aprovado" || st === "em_compra" || st === "concluido") {
          aprovadasExistentesCount++;
          aprovadasExistentesValor += val;
        } else if (st === "rejeitado") {
          rejeitadasExistentesCount++;
          rejeitadasExistentesValor += val;
        } else if (st === "enviado" || st === "em_analise") {
          pendentesExistentesCount++;
          pendentesExistentesValor += val;
        }
      });

      const qtdServicosExistentes = aprovadasExistentesCount + pendentesExistentesCount + rejeitadasExistentesCount;
      const valorServicosExistentes = aprovadasExistentesValor + pendentesExistentesValor + rejeitadasExistentesValor;

      const servicosNovos = servicosItems.filter((s) =>
        !servicosCatalogoSet.has(s.itemKey)
      );

      let aprovadasNovosCount = 0;
      let aprovadasNovosValor = 0;
      let pendentesNovosCount = 0;
      let pendentesNovosValor = 0;
      let rejeitadasNovosCount = 0;
      let rejeitadasNovosValor = 0;

      servicosNovos.forEach((s) => {
        const val = s.valor;
        const st = s.status;
        if (st === "aprovado" || st === "em_compra" || st === "concluido") {
          aprovadasNovosCount++;
          aprovadasNovosValor += val;
        } else if (st === "rejeitado") {
          rejeitadasNovosCount++;
          rejeitadasNovosValor += val;
        } else if (st === "enviado" || st === "em_analise") {
          pendentesNovosCount++;
          pendentesNovosValor += val;
        }
      });

      const qtdServicosNovos = aprovadasNovosCount + pendentesNovosCount + rejeitadasNovosCount;
      const valorServicosNovos = aprovadasNovosValor + pendentesNovosValor + rejeitadasNovosValor;

      const aprovadasCount = aprovadasAquisicaoCount + aprovadasExistentesCount + aprovadasNovosCount;
      const aprovadasValor = aprovadasAquisicaoValor + aprovadasExistentesValor + aprovadasNovosValor;

      const pendentesCount = pendentesAquisicaoCount + pendentesExistentesCount + pendentesNovosCount;
      const pendentesValor = pendentesAquisicaoValor + pendentesExistentesValor + pendentesNovosValor;

      const rejeitadasCount = rejeitadasAquisicaoCount + rejeitadasExistentesCount + rejeitadasNovosCount;
      const rejeitadasValor = rejeitadasAquisicaoValor + rejeitadasExistentesValor + rejeitadasNovosValor;

      const totalSolicitacoes = qtdAquisicao + qtdServicosExistentes + qtdServicosNovos;
      const valorTotalGeral = valorAquisicao + valorServicosExistentes + valorServicosNovos;

      const orcamentoGerencia =
        gId === "diretoria"
          ? (diretoria?.id ? getTotalDiretoriaBudget(orcamentoConfig, diretoria.id) : 0)
          : (gId ? getTotalGerenciaBudget(orcamentoConfig, gId) : 0);
      const saldoGeralGerencia = orcamentoGerencia - valorTotalGeral;

      return {
        id: gId,
        sigla: gSigla,
        nome: g.nome || gSigla,
        qtdAquisicao,
        valorAquisicao,
        qtdServicosExistentes,
        valorServicosExistentes,
        qtdServicosNovos,
        valorServicosNovos,
        totalSolicitacoes,
        aprovadasCount,
        aprovadasValor,
        aprovadasAquisicaoCount,
        aprovadasAquisicaoValor,
        aprovadasExistentesCount,
        aprovadasExistentesValor,
        aprovadasNovosCount,
        aprovadasNovosValor,
        pendentesCount,
        pendentesValor,
        pendentesAquisicaoCount,
        pendentesAquisicaoValor,
        pendentesExistentesCount,
        pendentesExistentesValor,
        pendentesNovosCount,
        pendentesNovosValor,
        rejeitadasCount,
        rejeitadasValor,
        rejeitadasAquisicaoCount,
        rejeitadasAquisicaoValor,
        rejeitadasExistentesCount,
        rejeitadasExistentesValor,
        rejeitadasNovosCount,
        rejeitadasNovosValor,
        valorTotalGeral,
        orcamentoGerencia,
        saldoGeralGerencia,
      };
    });
  }, [gerenciasData, solicitacoes, itensProprios, servicosData, servicosCatalogoSet, diretoria, siglaUpper, orcamentoConfig, VALID_STATUSES]);

  // Totais Gerais da Diretoria
  const totals = useMemo(() => {
    const base = gerenciaMatrix.reduce(
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
        qtdAquisicao: 0,
        valorAquisicao: 0,
        qtdServicosExistentes: 0,
        valorServicosExistentes: 0,
        qtdServicosNovos: 0,
        valorServicosNovos: 0,
        totalSolicitacoes: 0,
        aprovadasCount: 0,
        aprovadasValor: 0,
        aprovadasAquisicaoCount: 0,
        aprovadasAquisicaoValor: 0,
        aprovadasExistentesCount: 0,
        aprovadasExistentesValor: 0,
        aprovadasNovosCount: 0,
        aprovadasNovosValor: 0,
        pendentesCount: 0,
        pendentesValor: 0,
        pendentesAquisicaoCount: 0,
        pendentesAquisicaoValor: 0,
        pendentesExistentesCount: 0,
        pendentesExistentesValor: 0,
        pendentesNovosCount: 0,
        pendentesNovosValor: 0,
        rejeitadasCount: 0,
        rejeitadasValor: 0,
        rejeitadasAquisicaoCount: 0,
        rejeitadasAquisicaoValor: 0,
        rejeitadasExistentesCount: 0,
        rejeitadasExistentesValor: 0,
        rejeitadasNovosCount: 0,
        rejeitadasNovosValor: 0,
        valorTotalGeral: 0,
      }
    );

    const orcamentoTotalDiretoria = diretoria?.id
      ? getTotalDiretoriaBudget(orcamentoConfig, diretoria.id)
      : 0;

    const saldoGeralDiretoria = orcamentoTotalDiretoria - base.valorTotalGeral;

    return {
      ...base,
      orcamentoTotalDiretoria,
      saldoGeralDiretoria,
    };
  }, [gerenciaMatrix, diretoria, orcamentoConfig]);

  // 1. Dados para Gráfico de Pizza / Donut (Até 4 Status) com Detalhamento por Modalidade
  const pieData = useMemo(() => {
    return [
      {
        name: "Aprovadas",
        value: totals.aprovadasCount,
        color: PIE_COLORS.aprovado,
        valor: totals.aprovadasValor,
        aquisicaoCount: totals.aprovadasAquisicaoCount,
        aquisicaoValor: totals.aprovadasAquisicaoValor,
        existentesCount: totals.aprovadasExistentesCount,
        existentesValor: totals.aprovadasExistentesValor,
        novosCount: totals.aprovadasNovosCount,
        novosValor: totals.aprovadasNovosValor,
      },
      {
        name: "Pendentes de Aprovação",
        value: totals.pendentesCount,
        color: PIE_COLORS.pendente,
        valor: totals.pendentesValor,
        aquisicaoCount: totals.pendentesAquisicaoCount,
        aquisicaoValor: totals.pendentesAquisicaoValor,
        existentesCount: totals.pendentesExistentesCount,
        existentesValor: totals.pendentesExistentesValor,
        novosCount: totals.pendentesNovosCount,
        novosValor: totals.pendentesNovosValor,
      },
      {
        name: "Rejeitadas",
        value: totals.rejeitadasCount,
        color: PIE_COLORS.rejeitado,
        valor: totals.rejeitadasValor,
        aquisicaoCount: totals.rejeitadasAquisicaoCount,
        aquisicaoValor: totals.rejeitadasAquisicaoValor,
        existentesCount: totals.rejeitadasExistentesCount,
        existentesValor: totals.rejeitadasExistentesValor,
        novosCount: totals.rejeitadasNovosCount,
        novosValor: totals.rejeitadasNovosValor,
      },
    ].filter((item) => item.value > 0 || totals.totalSolicitacoes === 0);
  }, [totals]);

  // 2. Dados para Gráfico de Colunas Vertical (Valores por Modalidade) com Detalhamento por Status
  const verticalBarData = useMemo(() => {
    return [
      {
        modalidade: "Aquisição",
        valor: totals.valorAquisicao,
        qtd: totals.qtdAquisicao,
        fill: "#3b82f6",
        aprovadasCount: totals.aprovadasAquisicaoCount,
        aprovadasValor: totals.aprovadasAquisicaoValor,
        pendentesCount: totals.pendentesAquisicaoCount,
        pendentesValor: totals.pendentesAquisicaoValor,
        rejeitadasCount: totals.rejeitadasAquisicaoCount,
        rejeitadasValor: totals.rejeitadasAquisicaoValor,
      },
      {
        modalidade: "Serviços Existentes",
        valor: totals.valorServicosExistentes,
        qtd: totals.qtdServicosExistentes,
        fill: "#10b981",
        aprovadasCount: totals.aprovadasExistentesCount,
        aprovadasValor: totals.aprovadasExistentesValor,
        pendentesCount: totals.pendentesExistentesCount,
        pendentesValor: totals.pendentesExistentesValor,
        rejeitadasCount: totals.rejeitadasExistentesCount,
        rejeitadasValor: totals.rejeitadasExistentesValor,
      },
      {
        modalidade: "Novos Serviços",
        valor: totals.valorServicosNovos,
        qtd: totals.qtdServicosNovos,
        fill: "#8b5cf6",
        aprovadasCount: totals.aprovadasNovosCount,
        aprovadasValor: totals.aprovadasNovosValor,
        pendentesCount: totals.pendentesNovosCount,
        pendentesValor: totals.pendentesNovosValor,
        rejeitadasCount: totals.rejeitadasNovosCount,
        rejeitadasValor: totals.rejeitadasNovosValor,
      },
    ];
  }, [totals]);

  // 3. Dados para Gráfico de Colunas Horizontal (Comparativo por Gerência)
  const horizontalBarData = useMemo(() => {
    return gerenciaMatrix.map((g) => ({
      gerencia: g.sigla,
      gerenciaNome: g.nome,
      "Aquisição": g.valorAquisicao,
      aquisicaoQtd: g.qtdAquisicao,
      "Serviços Existentes": g.valorServicosExistentes,
      existentesQtd: g.qtdServicosExistentes,
      "Novos Serviços": g.valorServicosNovos,
      novosQtd: g.qtdServicosNovos,
      total: g.valorTotalGeral,
      totalQtd: g.totalSolicitacoes,
    }));
  }, [gerenciaMatrix]);

  // Filtro de tabela
  const filteredMatrix = useMemo(() => {
    if (selectedGerenciaFilter === "todas") return gerenciaMatrix;
    return gerenciaMatrix.filter((g) => g.id === selectedGerenciaFilter || g.sigla === selectedGerenciaFilter);
  }, [gerenciaMatrix, selectedGerenciaFilter]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-slate-50/60 pb-16">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white px-6 py-6 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/30 text-blue-200 border-blue-400/30">Visão Gerencial</Badge>
                  <span className="text-white/60 text-sm font-medium">Plano Anual 2027</span>
                </div>
                <h1 className="text-2xl font-bold text-white mt-1">
                  Painel Estratégico da Diretoria {siglaUpper}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Valor Total Geral</p>
                  <p className="text-lg font-bold text-amber-300">{formatCurrency(totals.valorTotalGeral)}</p>
                </div>
              </div>

              {totals.orcamentoTotalDiretoria > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15">
                  <Wallet className="h-5 w-5 text-amber-300" />
                  <div>
                    <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Saldo Geral</p>
                    <p className={`text-lg font-bold ${totals.saldoGeralDiretoria < 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {formatCurrency(totals.saldoGeralDiretoria)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Cartões KPI no Topo com Tooltips Detalhadas */}
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
                  <p className={`text-[11px] font-bold mt-2 ${totals.saldoGeralDiretoria < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    Saldo Geral: {formatCurrency(totals.saldoGeralDiretoria)}
                  </p>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
                <p className="font-bold text-xs border-b border-slate-700 pb-1 text-indigo-300 flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5" /> Balanço Financeiro & Saldo Geral
                </p>
                <div className="space-y-1.5 text-xs">
                  {totals.orcamentoTotalDiretoria > 0 && (
                    <div className="flex justify-between gap-4 border-b border-slate-800 pb-1">
                      <span className="text-slate-300 font-medium">🏛️ Orçamento Definido:</span>
                      <span className="font-bold text-blue-300">{formatCurrency(totals.orcamentoTotalDiretoria)}</span>
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
                  <div className="flex justify-between gap-4 pt-1.5 border-t border-slate-700">
                    <span className="text-slate-200 font-bold">💳 Saldo Geral:</span>
                    <span className={`font-extrabold ${totals.saldoGeralDiretoria < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {formatCurrency(totals.saldoGeralDiretoria)}
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

          </div>

          {/* Seção de Gráficos com Custom Tooltips */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Gráfico de Pizza / Donut (Até 4 Status) com Tooltip Detalhado */}
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

            {/* 2. Gráfico de Colunas Vertical (Valores por Modalidade) com Tooltip Detalhado */}
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

          {/* 3. Gráfico de Colunas Horizontal (Comparativo por Gerência) com Tooltip Detalhado */}
          <Card className="p-6 bg-white shadow-sm border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-slate-800 text-base">Comparativo de Gastos por Gerência (R$)</h3>
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
                  <YAxis dataKey="gerencia" type="category" tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }} />
                  <RechartsTooltip content={<HorizontalBarCustomTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="Aquisição" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Serviços Existentes" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Novos Serviços" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 4. Tabela de Matriz (Matrix Table com Coluna Saldo Geral) */}
          <Card className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                  Matriz Gerencial de Acompanhamento
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visão detalhada por gerência, quantidade de solicitações, status, valores por modalidade e saldo geral
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Filtrar Gerência:</span>
                <select
                  value={selectedGerenciaFilter}
                  onChange={(e) => setSelectedGerenciaFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white text-xs px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todas">Todas as Gerências</option>
                  {gerenciaMatrix.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.sigla}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="text-[11px] text-slate-500 uppercase bg-slate-100/80 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 font-bold">Gerência / Unidade</th>
                    <th scope="col" className="px-4 py-3.5 text-center font-bold text-blue-700">Aquisição (Qtd / R$)</th>
                    <th scope="col" className="px-4 py-3.5 text-center font-bold text-emerald-700">Serv. Existentes (Qtd / R$)</th>
                    <th scope="col" className="px-4 py-3.5 text-center font-bold text-purple-700">Serv. Novos (Qtd / R$)</th>
                    <th scope="col" className="px-4 py-3.5 text-center font-bold">Solicitações</th>
                    <th scope="col" className="px-4 py-3.5 text-center font-bold">Status (Aprov / Pend / Rej)</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-bold text-slate-900">Valor Total (R$)</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-bold text-emerald-800 bg-emerald-50/50">Saldo Geral (R$)</th>
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
                      <td className={`px-4 py-3 text-right font-bold text-sm bg-slate-50/50 ${row.saldoGeralGerencia < 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {formatCurrency(row.saldoGeralGerencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr>
                    <td className="px-4 py-3.5 text-sm uppercase">Total Diretoria {siglaUpper}</td>
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
                    <td className={`px-4 py-3.5 text-right text-base font-black bg-emerald-100/40 ${totals.saldoGeralDiretoria < 0 ? "text-red-700" : "text-emerald-800"}`}>
                      {formatCurrency(totals.saldoGeralDiretoria)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
