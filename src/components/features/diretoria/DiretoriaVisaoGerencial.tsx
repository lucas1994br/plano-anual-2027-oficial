import { Fragment, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  FileDown,
  Building2,
  TrendingUp,
  Layers,
  PieChart as PieIcon,
  Info,
  Landmark,
  Wallet,
  Eye,
  Search,
  Sparkles,
  Filter,
  X,
  ShoppingCart,
  Wrench,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [selectedGerenciaDetail, setSelectedGerenciaDetail] = useState<any | null>(null);
  const [detailSearchTerm, setDetailSearchTerm] = useState<string>("");
  const [detailActiveTab, setDetailActiveTab] = useState<string>("aquisicoes");

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
      const descricao = rawItem.descricao || rawItem.item?.descricao || rawItem.especificacao || "Sem descrição";
      const categoria = rawItem.categoria || rawItem.item?.categoria || "-";
      const unidade = rawItem.unidade || rawItem.item?.unidade || "UN";
      const prioridade = rawItem.prioridade || rawItem.grauPrioridade || "Média";

      const normalized = {
        ...rawItem,
        id: rawItem.id,
        codigo,
        descricao,
        categoria,
        unidade,
        prioridade,
        qtdEstimada: qtd,
        valorUnitario: valUnit,
        valorTotal: qtd * valUnit,
        status: st as SolicitacaoStatus,
        gerencia_id: gerenciaId,
        gerencia: gerenciaSigla,
        diretoriaSigla: rawItem.diretoriaSigla || rawItem.diretoriaOrcamentariaSigla || siglaUpper,
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
      const objeto = rawServico.objeto || rawServico.descricao || "Sem objeto informado";
      const tipoContratacao = rawServico.tipoContratacao || rawServico.tipo_contratacao || "-";
      const contrato = rawServico.contrato || "-";
      const contratada = rawServico.contratada || "-";
      const previsaoInicio = rawServico.previsaoInicio || rawServico.previsao_inicio || "-";
      const justificativa = rawServico.justificativa || "-";
      const grauPrioridade = rawServico.grauPrioridade || rawServico.grau_prioridade || "Médio";

      const normalized = {
        ...rawServico,
        itemKey,
        item: rawServico.item || rawServico.item_id || itemKey,
        objeto,
        tipoContratacao,
        contrato,
        contratada,
        previsaoInicio,
        justificativa,
        grauPrioridade,
        valor: val,
        status: st as SolicitacaoStatus,
        gerencia_id: gerenciaId,
        gerencia: gerenciaSigla,
        diretoriaSigla: rawServico.diretoriaSigla || rawServico.diretoria || siglaUpper,
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
      const aquisicaoItems = allAquisicao
        .filter((i) => isMatchGerencia(i.gerencia_id, i.gerencia))
        .map((i) => ({
          ...i,
          gerencia: i.gerencia || gSigla,
          diretoria: i.diretoriaSigla || siglaUpper,
        }));

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

      const servicosExistentes = servicosItems
        .filter((s) => servicosCatalogoSet.has(s.itemKey))
        .map((s) => ({
          ...s,
          gerencia: s.gerencia || gSigla,
          diretoria: s.diretoriaSigla || siglaUpper,
        }));

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

      const servicosNovos = servicosItems
        .filter((s) => !servicosCatalogoSet.has(s.itemKey))
        .map((s) => ({
          ...s,
          gerencia: s.gerencia || gSigla,
          diretoria: s.diretoriaSigla || siglaUpper,
        }));

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
        aquisicaoItems,
        servicosExistentes,
        servicosNovos,
        servicosItems,
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

  // Objeto consolidado do Total da Diretoria para o modal de detalhamento
  const totalDiretoriaDetailRow = useMemo(() => {
    const allAquisicao = gerenciaMatrix.flatMap((g) => g.aquisicaoItems || []);
    const allExistentes = gerenciaMatrix.flatMap((g) => g.servicosExistentes || []);
    const allNovos = gerenciaMatrix.flatMap((g) => g.servicosNovos || []);
    return {
      id: "total_diretoria",
      sigla: `TOTAL DIRETORIA ${siglaUpper}`,
      nome: `Diretoria ${diretoria?.nome || siglaUpper} (Consolidado Geral)`,
      aquisicaoItems: allAquisicao,
      servicosExistentes: allExistentes,
      servicosNovos: allNovos,
      qtdAquisicao: totals.qtdAquisicao,
      valorAquisicao: totals.valorAquisicao,
      qtdServicosExistentes: totals.qtdServicosExistentes,
      valorServicosExistentes: totals.valorServicosExistentes,
      qtdServicosNovos: totals.qtdServicosNovos,
      valorServicosNovos: totals.valorServicosNovos,
      totalSolicitacoes: totals.totalSolicitacoes,
      aprovadasCount: totals.aprovadasCount,
      pendentesCount: totals.pendentesCount,
      rejeitadasCount: totals.rejeitadasCount,
      valorTotalGeral: totals.valorTotalGeral,
      saldoGeralGerencia: totals.saldoGeralDiretoria,
    };
  }, [gerenciaMatrix, totals, siglaUpper, diretoria]);

  // Gerência atualmente filtrada
  const activeGerencia = useMemo(() => {
    if (!selectedGerenciaFilter || selectedGerenciaFilter === "todas") return null;
    return (
      gerenciaMatrix.find(
        (g) => g.id === selectedGerenciaFilter || g.sigla === selectedGerenciaFilter
      ) || null
    );
  }, [gerenciaMatrix, selectedGerenciaFilter]);

  // Totais exibidos nos KPIs e Gráficos (Filtrados ou Globais)
  const displayTotals = useMemo(() => {
    if (!activeGerencia) return totals;
    return {
      qtdAquisicao: activeGerencia.qtdAquisicao,
      valorAquisicao: activeGerencia.valorAquisicao,
      qtdServicosExistentes: activeGerencia.qtdServicosExistentes,
      valorServicosExistentes: activeGerencia.valorServicosExistentes,
      qtdServicosNovos: activeGerencia.qtdServicosNovos,
      valorServicosNovos: activeGerencia.valorServicosNovos,
      totalSolicitacoes: activeGerencia.totalSolicitacoes,
      aprovadasCount: activeGerencia.aprovadasCount,
      aprovadasValor: activeGerencia.aprovadasValor,
      aprovadasAquisicaoCount: activeGerencia.aprovadasAquisicaoCount,
      aprovadasAquisicaoValor: activeGerencia.aprovadasAquisicaoValor,
      aprovadasExistentesCount: activeGerencia.aprovadasExistentesCount,
      aprovadasExistentesValor: activeGerencia.aprovadasExistentesValor,
      aprovadasNovosCount: activeGerencia.aprovadasNovosCount,
      aprovadasNovosValor: activeGerencia.aprovadasNovosValor,
      pendentesCount: activeGerencia.pendentesCount,
      pendentesValor: activeGerencia.pendentesValor,
      pendentesAquisicaoCount: activeGerencia.pendentesAquisicaoCount,
      pendentesAquisicaoValor: activeGerencia.pendentesAquisicaoValor,
      pendentesExistentesCount: activeGerencia.pendentesExistentesCount,
      pendentesExistentesValor: activeGerencia.pendentesExistentesValor,
      pendentesNovosCount: activeGerencia.pendentesNovosCount,
      pendentesNovosValor: activeGerencia.pendentesNovosValor,
      rejeitadasCount: activeGerencia.rejeitadasCount,
      rejeitadasValor: activeGerencia.rejeitadasValor,
      rejeitadasAquisicaoCount: activeGerencia.rejeitadasAquisicaoCount,
      rejeitadasAquisicaoValor: activeGerencia.rejeitadasAquisicaoValor,
      rejeitadasExistentesCount: activeGerencia.rejeitadasExistentesCount,
      rejeitadasExistentesValor: activeGerencia.rejeitadasExistentesValor,
      rejeitadasNovosCount: activeGerencia.rejeitadasNovosCount,
      rejeitadasNovosValor: activeGerencia.rejeitadasNovosValor,
      valorTotalGeral: activeGerencia.valorTotalGeral,
      orcamentoTotalDiretoria: activeGerencia.orcamentoGerencia,
      saldoGeralDiretoria: activeGerencia.saldoGeralGerencia,
    };
  }, [activeGerencia, totals]);

  // 1. Dados para Gráfico de Pizza / Donut (Até 4 Status) com Detalhamento por Modalidade
  const pieData = useMemo(() => {
    return [
      {
        name: "Aprovadas",
        value: displayTotals.aprovadasCount,
        color: PIE_COLORS.aprovado,
        valor: displayTotals.aprovadasValor,
        aquisicaoCount: displayTotals.aprovadasAquisicaoCount,
        aquisicaoValor: displayTotals.aprovadasAquisicaoValor,
        existentesCount: displayTotals.aprovadasExistentesCount,
        existentesValor: displayTotals.aprovadasExistentesValor,
        novosCount: displayTotals.aprovadasNovosCount,
        novosValor: displayTotals.aprovadasNovosValor,
      },
      {
        name: "Pendentes de Aprovação",
        value: displayTotals.pendentesCount,
        color: PIE_COLORS.pendente,
        valor: displayTotals.pendentesValor,
        aquisicaoCount: displayTotals.pendentesAquisicaoCount,
        aquisicaoValor: displayTotals.pendentesAquisicaoValor,
        existentesCount: displayTotals.pendentesExistentesCount,
        existentesValor: displayTotals.pendentesExistentesValor,
        novosCount: displayTotals.pendentesNovosCount,
        novosValor: displayTotals.pendentesNovosValor,
      },
      {
        name: "Rejeitadas",
        value: displayTotals.rejeitadasCount,
        color: PIE_COLORS.rejeitado,
        valor: displayTotals.rejeitadasValor,
        aquisicaoCount: displayTotals.rejeitadasAquisicaoCount,
        aquisicaoValor: displayTotals.rejeitadasAquisicaoValor,
        existentesCount: displayTotals.rejeitadasExistentesCount,
        existentesValor: displayTotals.rejeitadasExistentesValor,
        novosCount: displayTotals.rejeitadasNovosCount,
        novosValor: displayTotals.rejeitadasNovosValor,
      },
    ].filter((item) => item.value > 0 || displayTotals.totalSolicitacoes === 0);
  }, [displayTotals]);

  // 2. Dados para Gráfico de Colunas Vertical (Valores por Modalidade) com Detalhamento por Status
  const verticalBarData = useMemo(() => {
    return [
      {
        modalidade: "Aquisição",
        valor: displayTotals.valorAquisicao,
        qtd: displayTotals.qtdAquisicao,
        fill: "#3b82f6",
        aprovadasCount: displayTotals.aprovadasAquisicaoCount,
        aprovadasValor: displayTotals.aprovadasAquisicaoValor,
        pendentesCount: displayTotals.pendentesAquisicaoCount,
        pendentesValor: displayTotals.pendentesAquisicaoValor,
        rejeitadasCount: displayTotals.rejeitadasAquisicaoCount,
        rejeitadasValor: displayTotals.rejeitadasAquisicaoValor,
      },
      {
        modalidade: "Serviços Existentes",
        valor: displayTotals.valorServicosExistentes,
        qtd: displayTotals.qtdServicosExistentes,
        fill: "#10b981",
        aprovadasCount: displayTotals.aprovadasExistentesCount,
        aprovadasValor: displayTotals.aprovadasExistentesValor,
        pendentesCount: displayTotals.pendentesExistentesCount,
        pendentesValor: displayTotals.pendentesExistentesValor,
        rejeitadasCount: displayTotals.rejeitadasExistentesCount,
        rejeitadasValor: displayTotals.rejeitadasExistentesValor,
      },
      {
        modalidade: "Novos Serviços",
        valor: displayTotals.valorServicosNovos,
        qtd: displayTotals.qtdServicosNovos,
        fill: "#8b5cf6",
        aprovadasCount: displayTotals.aprovadasNovosCount,
        aprovadasValor: displayTotals.aprovadasNovosValor,
        pendentesCount: displayTotals.pendentesNovosCount,
        pendentesValor: displayTotals.pendentesNovosValor,
        rejeitadasCount: displayTotals.rejeitadasNovosCount,
        rejeitadasValor: displayTotals.rejeitadasNovosValor,
      },
    ];
  }, [displayTotals]);

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

  // Filtros de busca no modal de detalhamento
  const filteredModalAquisicoes = useMemo(() => {
    if (!selectedGerenciaDetail?.aquisicaoItems) return [];
    const term = detailSearchTerm.trim().toLowerCase();
    if (!term) return selectedGerenciaDetail.aquisicaoItems;
    return selectedGerenciaDetail.aquisicaoItems.filter((item: any) => {
      return (
        String(item.codigo).toLowerCase().includes(term) ||
        String(item.descricao || "").toLowerCase().includes(term) ||
        String(item.categoria || "").toLowerCase().includes(term) ||
        String(item.unidade || "").toLowerCase().includes(term) ||
        String(item.status || "").toLowerCase().includes(term) ||
        String(item.prioridade || "").toLowerCase().includes(term) ||
        String(item.gerencia || "").toLowerCase().includes(term) ||
        String(item.diretoria || "").toLowerCase().includes(term)
      );
    });
  }, [selectedGerenciaDetail, detailSearchTerm]);

  const filteredModalServicosExistentes = useMemo(() => {
    if (!selectedGerenciaDetail?.servicosExistentes) return [];
    const term = detailSearchTerm.trim().toLowerCase();
    if (!term) return selectedGerenciaDetail.servicosExistentes;
    return selectedGerenciaDetail.servicosExistentes.filter((s: any) => {
      return (
        String(s.item).toLowerCase().includes(term) ||
        String(s.objeto || "").toLowerCase().includes(term) ||
        String(s.tipoContratacao || "").toLowerCase().includes(term) ||
        String(s.contrato || "").toLowerCase().includes(term) ||
        String(s.contratada || "").toLowerCase().includes(term) ||
        String(s.status || "").toLowerCase().includes(term) ||
        String(s.grauPrioridade || "").toLowerCase().includes(term) ||
        String(s.gerencia || "").toLowerCase().includes(term) ||
        String(s.diretoria || "").toLowerCase().includes(term)
      );
    });
  }, [selectedGerenciaDetail, detailSearchTerm]);

  const filteredModalServicosNovos = useMemo(() => {
    if (!selectedGerenciaDetail?.servicosNovos) return [];
    const term = detailSearchTerm.trim().toLowerCase();
    if (!term) return selectedGerenciaDetail.servicosNovos;
    return selectedGerenciaDetail.servicosNovos.filter((s: any) => {
      return (
        String(s.item).toLowerCase().includes(term) ||
        String(s.objeto || "").toLowerCase().includes(term) ||
        String(s.justificativa || "").toLowerCase().includes(term) ||
        String(s.tipoContratacao || "").toLowerCase().includes(term) ||
        String(s.previsaoInicio || "").toLowerCase().includes(term) ||
        String(s.status || "").toLowerCase().includes(term) ||
        String(s.grauPrioridade || "").toLowerCase().includes(term) ||
        String(s.gerencia || "").toLowerCase().includes(term) ||
        String(s.diretoria || "").toLowerCase().includes(term)
      );
    });
  }, [selectedGerenciaDetail, detailSearchTerm]);

  // Badges visuais para o modal
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "aprovado":
      case "em_compra":
      case "concluido":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Aprovado</Badge>;
      case "enviado":
      case "em_analise":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pendente</Badge>;
      case "rejeitado":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejeitado</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-600">{status || "Rascunho"}</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    const p = String(priority || "").toLowerCase();
    if (p.includes("alta") || p.includes("alto")) {
      return <Badge className="bg-red-50 text-red-700 border-red-200">Alta</Badge>;
    }
    if (p.includes("méd") || p.includes("med")) {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Média</Badge>;
    }
    return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Baixa</Badge>;
  };

  // Exportar Detalhamento da Gerência/Diretoria para Excel
  const handleExportDetailExcel = async () => {
    if (!selectedGerenciaDetail) return;
    try {
      const XLSXModule = await import("xlsx-js-style");
      const XLSX = XLSXModule.default;
      const wb = XLSX.utils.book_new();

      const titleStyle = {
        font: { bold: true, sz: 13, color: { rgb: "0F172A" } },
      };
      const headerStyle = {
        fill: { fgColor: { rgb: "1E293B" } },
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
      };
      const totalRowStyle = {
        fill: { fgColor: { rgb: "F1F5F9" } },
        font: { bold: true, sz: 10, color: { rgb: "0F172A" } },
        alignment: { vertical: "center" },
      };

      const gSigla = selectedGerenciaDetail.sigla || "";
      const gNome = selectedGerenciaDetail.nome || "";

      // 1. Aba Aquisições
      const aquisicoes = selectedGerenciaDetail.aquisicaoItems || [];
      const aqHeaders = [
        "Gerência",
        "ID_DIRETORIA",
        "Código",
        "Descrição do Item",
        "Categoria",
        "Unidade",
        "Quantidade",
        "Valor Unitário (R$)",
        "Valor Total (R$)",
        "Prioridade",
        "Status",
        "Observação",
        "Justificativa Rejeição",
      ];
      const aqRows = aquisicoes.map((i: any) => [
        i.gerencia || gSigla,
        i.diretoria || siglaUpper,
        i.codigo,
        i.descricao,
        i.categoria,
        i.unidade,
        i.qtdEstimada,
        i.valorUnitario,
        i.valorTotal || i.qtdEstimada * i.valorUnitario,
        i.prioridade || "-",
        i.status || "rascunho",
        i.observacao || "",
        i.justificativaRejeicao || "",
      ]);
      const totalQtdAq = aquisicoes.reduce((acc: number, cur: any) => acc + (cur.qtdEstimada || 0), 0);
      const totalValAq = aquisicoes.reduce(
        (acc: number, cur: any) => acc + (cur.valorTotal || cur.qtdEstimada * cur.valorUnitario || 0),
        0
      );
      const aqTotalRow = [
        "TOTAL",
        "",
        `${aquisicoes.length} item(ns)`,
        "",
        "",
        "",
        totalQtdAq,
        "",
        totalValAq,
        "",
        "",
        "",
        "",
      ];

      const wsAq = XLSX.utils.aoa_to_sheet([
        [`Plano Anual 2027 - Aquisições: ${gSigla} (${gNome})`],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        aqHeaders,
        ...aqRows,
        aqTotalRow,
      ]);
      wsAq["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 45 },
        { wch: 25 },
        { wch: 10 },
        { wch: 14 },
        { wch: 20 },
        { wch: 20 },
        { wch: 14 },
        { wch: 15 },
        { wch: 30 },
        { wch: 30 },
      ];
      if (wsAq["A1"]) wsAq["A1"].s = titleStyle;
      for (let c = 0; c < aqHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c });
        if (wsAq[cellRef]) wsAq[cellRef].s = headerStyle;
      }
      const aqTotalIdx = 4 + aqRows.length;
      for (let c = 0; c < aqHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: aqTotalIdx, c });
        if (wsAq[cellRef]) wsAq[cellRef].s = totalRowStyle;
      }
      XLSX.utils.book_append_sheet(wb, wsAq, "Aquisições");

      // 2. Aba Serviços Existentes
      const servExistentes = selectedGerenciaDetail.servicosExistentes || [];
      const seHeaders = [
        "Gerência",
        "ID_DIRETORIA",
        "Item",
        "Objeto do Serviço",
        "Tipo de Contratação",
        "Contrato",
        "Contratada",
        "Valor Estimado / Dotação (R$)",
        "Grau Prioridade",
        "Status",
        "Observação",
        "Justificativa Rejeição",
      ];
      const seRows = servExistentes.map((s: any) => [
        s.gerencia || gSigla,
        s.diretoria || siglaUpper,
        s.item,
        s.objeto,
        s.tipoContratacao,
        s.contrato || "-",
        s.contratada || "-",
        s.valor || 0,
        s.grauPrioridade || "-",
        s.status || "rascunho",
        s.observacao || "",
        s.justificativaRejeicao || "",
      ]);
      const totalValSE = servExistentes.reduce((acc: number, cur: any) => acc + (cur.valor || 0), 0);
      const seTotalRow = [
        "TOTAL",
        "",
        `${servExistentes.length} serviço(s)`,
        "",
        "",
        "",
        "",
        totalValSE,
        "",
        "",
        "",
        "",
      ];

      const wsSE = XLSX.utils.aoa_to_sheet([
        [`Plano Anual 2027 - Serviços Existentes: ${gSigla} (${gNome})`],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        seHeaders,
        ...seRows,
        seTotalRow,
      ]);
      wsSE["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 10 },
        { wch: 45 },
        { wch: 22 },
        { wch: 16 },
        { wch: 25 },
        { wch: 22 },
        { wch: 16 },
        { wch: 15 },
        { wch: 30 },
        { wch: 30 },
      ];
      if (wsSE["A1"]) wsSE["A1"].s = titleStyle;
      for (let c = 0; c < seHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c });
        if (wsSE[cellRef]) wsSE[cellRef].s = headerStyle;
      }
      const seTotalIdx = 4 + seRows.length;
      for (let c = 0; c < seHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: seTotalIdx, c });
        if (wsSE[cellRef]) wsSE[cellRef].s = totalRowStyle;
      }
      XLSX.utils.book_append_sheet(wb, wsSE, "Serviços Existentes");

      // 3. Aba Novos Serviços
      const servNovos = selectedGerenciaDetail.servicosNovos || [];
      const snHeaders = [
        "Gerência",
        "ID_DIRETORIA",
        "Item",
        "Objeto do Novo Serviço",
        "Justificativa da Demanda",
        "Tipo de Contratação",
        "Previsão Início",
        "Estimativa de Valor (R$)",
        "Grau Prioridade",
        "Status",
        "Observação",
        "Justificativa Rejeição",
      ];
      const snRows = servNovos.map((s: any) => [
        s.gerencia || gSigla,
        s.diretoria || siglaUpper,
        s.item,
        s.objeto,
        s.justificativa || "-",
        s.tipoContratacao,
        s.previsaoInicio || "-",
        s.valor || 0,
        s.grauPrioridade || "-",
        s.status || "rascunho",
        s.observacao || "",
        s.justificativaRejeicao || "",
      ]);
      const totalValSN = servNovos.reduce((acc: number, cur: any) => acc + (cur.valor || 0), 0);
      const snTotalRow = [
        "TOTAL",
        "",
        `${servNovos.length} novo(s) serviço(s)`,
        "",
        "",
        "",
        "",
        totalValSN,
        "",
        "",
        "",
        "",
      ];

      const wsSN = XLSX.utils.aoa_to_sheet([
        [`Plano Anual 2027 - Novos Serviços: ${gSigla} (${gNome})`],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        snHeaders,
        ...snRows,
        snTotalRow,
      ]);
      wsSN["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 10 },
        { wch: 45 },
        { wch: 40 },
        { wch: 22 },
        { wch: 16 },
        { wch: 22 },
        { wch: 16 },
        { wch: 15 },
        { wch: 30 },
        { wch: 30 },
      ];
      if (wsSN["A1"]) wsSN["A1"].s = titleStyle;
      for (let c = 0; c < snHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c });
        if (wsSN[cellRef]) wsSN[cellRef].s = headerStyle;
      }
      const snTotalIdx = 4 + snRows.length;
      for (let c = 0; c < snHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: snTotalIdx, c });
        if (wsSN[cellRef]) wsSN[cellRef].s = totalRowStyle;
      }
      XLSX.utils.book_append_sheet(wb, wsSN, "Novos Serviços");

      // 4. Aba Resumo
      const resumoHeaders = ["Métrica", "Valor"];
      const resumoRows = [
        ["Unidade / Gerência", `${gSigla} - ${gNome}`],
        ["Total de Solicitações", selectedGerenciaDetail.totalSolicitacoes || 0],
        ["Aquisições (Quantidade)", `${aquisicoes.length} itens`],
        ["Aquisições (Valor Total R$)", selectedGerenciaDetail.valorAquisicao || 0],
        ["Serviços Existentes (Quantidade)", `${servExistentes.length} serviços`],
        ["Serviços Existentes (Valor Total R$)", selectedGerenciaDetail.valorServicosExistentes || 0],
        ["Novos Serviços (Quantidade)", `${servNovos.length} serviços`],
        ["Novos Serviços (Valor Total R$)", selectedGerenciaDetail.valorServicosNovos || 0],
        ["Valor Total Geral (R$)", selectedGerenciaDetail.valorTotalGeral || 0],
        ["Orçamento Gerência (R$)", selectedGerenciaDetail.orcamentoGerencia || 0],
        ["Saldo Geral Gerência (R$)", selectedGerenciaDetail.saldoGeralGerencia || 0],
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet([
        [`Resumo Geral - ${gSigla}`],
        [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        resumoHeaders,
        ...resumoRows,
      ]);
      wsResumo["!cols"] = [{ wch: 35 }, { wch: 35 }];
      if (wsResumo["A1"]) wsResumo["A1"].s = titleStyle;
      for (let c = 0; c < resumoHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c });
        if (wsResumo[cellRef]) wsResumo[cellRef].s = headerStyle;
      }
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      const fileSafeSigla = gSigla.toLowerCase().replace(/[^a-z0-9]/g, "_");
      XLSX.writeFile(
        wb,
        `detalhamento_${fileSafeSigla}_plano_2027_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch (error) {
      console.error("Erro ao exportar Excel do detalhamento:", error);
    }
  };

  // Exportar Detalhamento da Gerência/Diretoria para PDF
  const handleExportDetailPDF = async () => {
    if (!selectedGerenciaDetail) return;
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ orientation: "landscape", format: "a4" });
      const gSigla = selectedGerenciaDetail.sigla || "";
      const gNome = selectedGerenciaDetail.nome || "";

      // Cabeçalho Principal
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`Detalhamento de Solicitações - ${gSigla} (${gNome})`, 14, 14);

      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Plano Anual 2027 | Diretoria ${siglaUpper} | Gerado em: ${new Date().toLocaleString("pt-BR")}`,
        14,
        20
      );

      // Linha de Resumo
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Total de Solicitações: ${selectedGerenciaDetail.totalSolicitacoes || 0}  |  Aquisições: ${selectedGerenciaDetail.aquisicaoItems?.length || 0} itens (${formatCurrency(selectedGerenciaDetail.valorAquisicao || 0)})  |  Serv. Existentes: ${selectedGerenciaDetail.servicosExistentes?.length || 0} serv. (${formatCurrency(selectedGerenciaDetail.valorServicosExistentes || 0)})  |  Novos Serviços: ${selectedGerenciaDetail.servicosNovos?.length || 0} serv. (${formatCurrency(selectedGerenciaDetail.valorServicosNovos || 0)})  |  VALOR TOTAL GERAL: ${formatCurrency(selectedGerenciaDetail.valorTotalGeral || 0)}`,
        14,
        26
      );

      let currentY = 32;

      // 1. Tabela de Aquisições
      const aquisicoes = selectedGerenciaDetail.aquisicaoItems || [];
      if (aquisicoes.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(29, 78, 216);
        doc.text(`1. Aquisições (${aquisicoes.length} itens - Total: ${formatCurrency(selectedGerenciaDetail.valorAquisicao || 0)})`, 14, currentY);
        currentY += 4;

        const aqHeaders = ["Gerência", "ID_DIRETORIA", "Código", "Descrição do Item", "Categoria", "Unid.", "Qtd", "Valor Unit.", "Valor Total", "Prioridade", "Status"];
        const aqRows = aquisicoes.map((i: any) => [
          String(i.gerencia || gSigla),
          String(i.diretoria || siglaUpper),
          String(i.codigo),
          String(i.descricao || ""),
          String(i.categoria || "-"),
          String(i.unidade || "UN"),
          String(i.qtdEstimada || 0),
          formatCurrency(i.valorUnitario || 0),
          formatCurrency(i.valorTotal || i.qtdEstimada * i.valorUnitario || 0),
          String(i.prioridade || "-"),
          String(i.status || "rascunho"),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [aqHeaders],
          body: aqRows,
          theme: "grid",
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
          },
          styles: {
            fontSize: 7,
            cellPadding: 2,
            valign: "middle",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 16 },
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "center", cellWidth: 14 },
            3: { halign: "left" },
            4: { halign: "left", cellWidth: 32 },
            5: { halign: "center", cellWidth: 10 },
            6: { halign: "center", cellWidth: 12, fontStyle: "bold" },
            7: { halign: "right", cellWidth: 20 },
            8: { halign: "right", cellWidth: 22, fontStyle: "bold" },
            9: { halign: "center", cellWidth: 16 },
            10: { halign: "center", cellWidth: 18 },
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      // 2. Tabela de Serviços Existentes
      const servExistentes = selectedGerenciaDetail.servicosExistentes || [];
      if (servExistentes.length > 0) {
        if (currentY > 165) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFontSize(10);
        doc.setTextColor(4, 120, 87);
        doc.text(`2. Serviços Existentes (${servExistentes.length} serviços - Total: ${formatCurrency(selectedGerenciaDetail.valorServicosExistentes || 0)})`, 14, currentY);
        currentY += 4;

        const seHeaders = ["Gerência", "ID_DIRETORIA", "Item", "Objeto do Serviço", "Tipo Contratação", "Contrato / Contratada", "Valor Estimado / Dotação", "Prioridade", "Status"];
        const seRows = servExistentes.map((s: any) => [
          String(s.gerencia || gSigla),
          String(s.diretoria || siglaUpper),
          String(s.item || "-"),
          String(s.objeto || ""),
          String(s.tipoContratacao || "-"),
          `${s.contrato || "-"}\n${s.contratada || "-"}`,
          formatCurrency(s.valor || 0),
          String(s.grauPrioridade || "-"),
          String(s.status || "rascunho"),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [seHeaders],
          body: seRows,
          theme: "grid",
          headStyles: {
            fillColor: [6, 95, 70],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
          },
          styles: {
            fontSize: 7,
            cellPadding: 2,
            valign: "middle",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 16 },
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "center", cellWidth: 12 },
            3: { halign: "left" },
            4: { halign: "left", cellWidth: 35 },
            5: { halign: "left", cellWidth: 38 },
            6: { halign: "right", cellWidth: 28, fontStyle: "bold" },
            7: { halign: "center", cellWidth: 18 },
            8: { halign: "center", cellWidth: 20 },
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      // 3. Tabela de Novos Serviços
      const servNovos = selectedGerenciaDetail.servicosNovos || [];
      if (servNovos.length > 0) {
        if (currentY > 165) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFontSize(10);
        doc.setTextColor(109, 40, 217);
        doc.text(`3. Novos Serviços (${servNovos.length} novos serviços - Total: ${formatCurrency(selectedGerenciaDetail.valorServicosNovos || 0)})`, 14, currentY);
        currentY += 4;

        const snHeaders = ["Gerência", "ID_DIRETORIA", "Item", "Objeto do Novo Serviço", "Justificativa da Demanda", "Tipo Contratação", "Previsão Início", "Estimativa de Valor", "Prioridade", "Status"];
        const snRows = servNovos.map((s: any) => [
          String(s.gerencia || gSigla),
          String(s.diretoria || siglaUpper),
          String(s.item || "-"),
          String(s.objeto || ""),
          String(s.justificativa || "-"),
          String(s.tipoContratacao || "-"),
          String(s.previsaoInicio || "-"),
          formatCurrency(s.valor || 0),
          String(s.grauPrioridade || "-"),
          String(s.status || "rascunho"),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [snHeaders],
          body: snRows,
          theme: "grid",
          headStyles: {
            fillColor: [91, 33, 182],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
          },
          styles: {
            fontSize: 7,
            cellPadding: 2,
            valign: "middle",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 16 },
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "center", cellWidth: 12 },
            3: { halign: "left" },
            4: { halign: "left", cellWidth: 38 },
            5: { halign: "left", cellWidth: 30 },
            6: { halign: "center", cellWidth: 20 },
            7: { halign: "right", cellWidth: 28, fontStyle: "bold" },
            8: { halign: "center", cellWidth: 16 },
            9: { halign: "center", cellWidth: 18 },
          },
        });
      }

      // Rodapé de páginas
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${pageCount} | Plano Anual 2027 - ${gSigla}`,
          doc.internal.pageSize.getWidth() - 65,
          doc.internal.pageSize.getHeight() - 8
        );
      }

      const fileSafeSigla = gSigla.toLowerCase().replace(/[^a-z0-9]/g, "_");
      doc.save(
        `detalhamento_${fileSafeSigla}_plano_2027_${new Date().toISOString().split("T")[0]}.pdf`
      );
    } catch (error) {
      console.error("Erro ao exportar PDF do detalhamento:", error);
    }
  };

  // Exportar Excel
  const handleExportExcel = async () => {
    try {
      const XLSXModule = await import("xlsx-js-style");
      const XLSX = XLSXModule.default;

      const wb = XLSX.utils.book_new();

      const headerStyle = {
        fill: { fgColor: { rgb: "1E293B" } },
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
      };

      const titleStyle = {
        font: { bold: true, sz: 13, color: { rgb: "0F172A" } },
      };

      const totalRowStyle = {
        fill: { fgColor: { rgb: "F1F5F9" } },
        font: { bold: true, sz: 10, color: { rgb: "0F172A" } },
        alignment: { vertical: "center" },
      };

      // 1. Aba Matriz Gerencial
      const matrizHeaders = [
        "Gerência / Unidade",
        "Nome da Gerência",
        "Aquisição (Qtd)",
        "Aquisição (Valor R$)",
        "Serv. Existentes (Qtd)",
        "Serv. Existentes (Valor R$)",
        "Serv. Novos (Qtd)",
        "Serv. Novos (Valor R$)",
        "Total Solicitações",
        "Aprovadas (Qtd)",
        "Pendentes (Qtd)",
        "Rejeitadas (Qtd)",
        "Valor Total Geral (R$)",
        "Orçamento Gerência (R$)",
        "Saldo Geral Gerência (R$)",
      ];

      const matrizRows = filteredMatrix.map((g) => [
        g.sigla,
        g.nome,
        g.qtdAquisicao,
        g.valorAquisicao,
        g.qtdServicosExistentes,
        g.valorServicosExistentes,
        g.qtdServicosNovos,
        g.valorServicosNovos,
        g.totalSolicitacoes,
        g.aprovadasCount,
        g.pendentesCount,
        g.rejeitadasCount,
        g.valorTotalGeral,
        g.orcamentoGerencia,
        g.saldoGeralGerencia,
      ]);

      const matrizTotalRow = [
        `TOTAL DIRETORIA ${siglaUpper}`,
        `Diretoria ${diretoria?.nome || siglaUpper}`,
        totals.qtdAquisicao,
        totals.valorAquisicao,
        totals.qtdServicosExistentes,
        totals.valorServicosExistentes,
        totals.qtdServicosNovos,
        totals.valorServicosNovos,
        totals.totalSolicitacoes,
        totals.aprovadasCount,
        totals.pendentesCount,
        totals.rejeitadasCount,
        totals.valorTotalGeral,
        totals.orcamentoTotalDiretoria,
        totals.saldoGeralDiretoria,
      ];

      const wsMatriz = XLSX.utils.aoa_to_sheet([
        [`Painel Estratégico da Diretoria ${siglaUpper} - Visão Gerencial`],
        [`Plano Anual 2027 | Gerado em: ${new Date().toLocaleString("pt-BR")}`],
        [],
        matrizHeaders,
        ...matrizRows,
        matrizTotalRow,
      ]);

      wsMatriz["!cols"] = [
        { wch: 20 },
        { wch: 32 },
        { wch: 16 },
        { wch: 22 },
        { wch: 20 },
        { wch: 24 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
      ];

      if (wsMatriz["A1"]) wsMatriz["A1"].s = titleStyle;

      for (let c = 0; c < matrizHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c });
        if (wsMatriz[cellRef]) wsMatriz[cellRef].s = headerStyle;
      }

      const totalRowIndex = 4 + matrizRows.length;
      for (let c = 0; c < matrizHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: totalRowIndex, c });
        if (wsMatriz[cellRef]) wsMatriz[cellRef].s = totalRowStyle;
      }

      XLSX.utils.book_append_sheet(wb, wsMatriz, "Matriz Gerencial");

      // 2. Aba Distribuição de Status
      const statusHeaders = [
        "Status",
        "Qtd Solicitações",
        "Valor Total (R$)",
        "Aquisição (Qtd)",
        "Aquisição (R$)",
        "Serv. Existentes (Qtd)",
        "Serv. Existentes (R$)",
        "Serv. Novos (Qtd)",
        "Serv. Novos (R$)",
      ];
      const statusRows = pieData.map((p) => [
        p.name,
        p.value,
        p.valor,
        p.aquisicaoCount,
        p.aquisicaoValor,
        p.existentesCount,
        p.existentesValor,
        p.novosCount,
        p.novosValor,
      ]);

      const wsStatus = XLSX.utils.aoa_to_sheet([
        [`Distribuição de Status - Diretoria ${siglaUpper}`],
        [],
        statusHeaders,
        ...statusRows,
      ]);
      wsStatus["!cols"] = statusHeaders.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
      if (wsStatus["A1"]) wsStatus["A1"].s = titleStyle;
      for (let c = 0; c < statusHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 2, c });
        if (wsStatus[cellRef]) wsStatus[cellRef].s = headerStyle;
      }
      XLSX.utils.book_append_sheet(wb, wsStatus, "Status Solicitações");

      // 3. Aba Modalidades de Gasto
      const modalidadeHeaders = [
        "Modalidade",
        "Qtd Total",
        "Valor Total (R$)",
        "Aprovadas (Qtd)",
        "Aprovadas (R$)",
        "Pendentes (Qtd)",
        "Pendentes (R$)",
        "Rejeitadas (Qtd)",
        "Rejeitadas (R$)",
      ];
      const modalidadeRows = verticalBarData.map((m) => [
        m.modalidade,
        m.qtd,
        m.valor,
        m.aprovadasCount,
        m.aprovadasValor,
        m.pendentesCount,
        m.pendentesValor,
        m.rejeitadasCount,
        m.rejeitadasValor,
      ]);

      const wsModalidades = XLSX.utils.aoa_to_sheet([
        [`Gasto Total por Modalidade - Diretoria ${siglaUpper}`],
        [],
        modalidadeHeaders,
        ...modalidadeRows,
      ]);
      wsModalidades["!cols"] = modalidadeHeaders.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
      if (wsModalidades["A1"]) wsModalidades["A1"].s = titleStyle;
      for (let c = 0; c < modalidadeHeaders.length; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: 2, c });
        if (wsModalidades[cellRef]) wsModalidades[cellRef].s = headerStyle;
      }
      XLSX.utils.book_append_sheet(wb, wsModalidades, "Gastos por Modalidade");

      XLSX.writeFile(
        wb,
        `visao_gerencial_${siglaUpper.toLowerCase()}_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
    }
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ orientation: "landscape", format: "a4" });

      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(`Painel Estratégico da Diretoria ${siglaUpper} - Visão Gerencial`, 14, 15);

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Plano Anual 2027 | Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 21);

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Solicitações Totais: ${totals.totalSolicitacoes}  |  Aprovadas: ${totals.aprovadasCount} (${formatCurrency(totals.aprovadasValor)})  |  Pendentes: ${totals.pendentesCount} (${formatCurrency(totals.pendentesValor)})  |  Rejeitadas: ${totals.rejeitadasCount} (${formatCurrency(totals.rejeitadasValor)})`,
        14,
        27
      );
      doc.text(
        `Valor Total Geral: ${formatCurrency(totals.valorTotalGeral)}  |  Saldo Geral Diretoria: ${formatCurrency(totals.saldoGeralDiretoria)}`,
        14,
        32
      );

      const headers = [
        "Gerência / Unidade",
        "Aquisição (Qtd / R$)",
        "Serv. Existentes (Qtd / R$)",
        "Serv. Novos (Qtd / R$)",
        "Total Solic.",
        "Status (A / P / R)",
        "Valor Total (R$)",
        "Saldo Geral (R$)",
      ];

      const rows = filteredMatrix.map((row) => [
        `${row.sigla}\n${row.nome}`,
        `${row.qtdAquisicao} item(ns)\n${formatCurrency(row.valorAquisicao)}`,
        `${row.qtdServicosExistentes} serv.\n${formatCurrency(row.valorServicosExistentes)}`,
        `${row.qtdServicosNovos} serv.\n${formatCurrency(row.valorServicosNovos)}`,
        `${row.totalSolicitacoes}`,
        `✓ ${row.aprovadasCount} | ⏳ ${row.pendentesCount} | ✕ ${row.rejeitadasCount}`,
        formatCurrency(row.valorTotalGeral),
        formatCurrency(row.saldoGeralGerencia),
      ]);

      const totalRow = [
        `TOTAL DIRETORIA ${siglaUpper}`,
        `${totals.qtdAquisicao} item(ns)\n${formatCurrency(totals.valorAquisicao)}`,
        `${totals.qtdServicosExistentes} serv.\n${formatCurrency(totals.valorServicosExistentes)}`,
        `${totals.qtdServicosNovos} serv.\n${formatCurrency(totals.valorServicosNovos)}`,
        `${totals.totalSolicitacoes}`,
        `✓ ${totals.aprovadasCount} | ⏳ ${totals.pendentesCount} | ✕ ${totals.rejeitadasCount}`,
        formatCurrency(totals.valorTotalGeral),
        formatCurrency(totals.saldoGeralDiretoria),
      ];

      autoTable(doc, {
        startY: 37,
        head: [headers],
        body: [...rows, totalRow],
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: "middle",
        },
        columnStyles: {
          0: { halign: "left", cellWidth: 42 },
          1: { halign: "center" },
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center", fontStyle: "bold" },
          5: { halign: "center" },
          6: { halign: "right", fontStyle: "bold" },
          7: { halign: "right", fontStyle: "bold" },
        },
        didParseCell: function (data) {
          if (data.row.index === rows.length) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      doc.save(
        `visao_gerencial_${siglaUpper.toLowerCase()}_${new Date().toISOString().split("T")[0]}.pdf`
      );
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
    }
  };

  // Renderizador do Detalhamento Inline (exibido diretamente na tabela da Matriz Gerencial)
  const renderDetailContainer = () => {
    if (!selectedGerenciaDetail) return null;
    return (
      <div className="rounded-2xl border border-slate-300 shadow-xl overflow-hidden bg-white my-2 animate-in fade-in slide-in-from-top-2 duration-200">
        {/* Header do Detalhamento Inline */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-5 sm:p-6 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/30 text-blue-200 border-blue-400/30 text-xs">
                  Detalhamento de Solicitações
                </Badge>
                <span className="text-white/60 text-xs font-medium">Plano Anual 2027</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {selectedGerenciaDetail?.sigla}
              </h2>
              <p className="text-xs text-white/70 mt-0.5 font-normal">
                {selectedGerenciaDetail?.nome}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* Mini cards de resumo no topo do detalhamento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 sm:flex-initial">
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15 text-center">
                  <p className="text-[10px] text-white/70 uppercase font-semibold">Total Geral</p>
                  <p className="text-xs font-bold text-amber-300">
                    {formatCurrency(selectedGerenciaDetail?.valorTotalGeral || 0)}
                  </p>
                  <p className="text-[10px] text-white/60">
                    {selectedGerenciaDetail?.totalSolicitacoes || 0} solicitações
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15 text-center">
                  <p className="text-[10px] text-white/70 uppercase font-semibold">Aquisição</p>
                  <p className="text-xs font-bold text-blue-300">
                    {formatCurrency(selectedGerenciaDetail?.valorAquisicao || 0)}
                  </p>
                  <p className="text-[10px] text-white/60">
                    {selectedGerenciaDetail?.aquisicaoItems?.length || 0} itens
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15 text-center">
                  <p className="text-[10px] text-white/70 uppercase font-semibold">Serv. Existentes</p>
                  <p className="text-xs font-bold text-emerald-300">
                    {formatCurrency(selectedGerenciaDetail?.valorServicosExistentes || 0)}
                  </p>
                  <p className="text-[10px] text-white/60">
                    {selectedGerenciaDetail?.servicosExistentes?.length || 0} serv.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/15 text-center">
                  <p className="text-[10px] text-white/70 uppercase font-semibold">Novos Serviços</p>
                  <p className="text-xs font-bold text-purple-300">
                    {formatCurrency(selectedGerenciaDetail?.valorServicosNovos || 0)}
                  </p>
                  <p className="text-[10px] text-white/60">
                    {selectedGerenciaDetail?.servicosNovos?.length || 0} serv.
                  </p>
                </div>
              </div>

              {/* Botão fechar/recolher */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGerenciaDetail(null);
                }}
                className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-2 text-xs transition-colors shrink-0"
                title="Recolher detalhamento"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Abas e Barra de Pesquisa */}
        <Tabs
          value={detailActiveTab}
          onValueChange={setDetailActiveTab}
          className="flex flex-col"
        >
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <TabsList className="bg-slate-200/80 p-1 rounded-xl h-auto flex flex-wrap">
              <TabsTrigger
                value="aquisicoes"
                className="rounded-lg text-xs font-semibold py-2 px-3 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Aquisições</span>
                <Badge variant="secondary" className="ml-1 text-[10px] h-4.5 px-1.5 bg-blue-100 text-blue-800">
                  {selectedGerenciaDetail?.aquisicaoItems?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="existentes"
                className="rounded-lg text-xs font-semibold py-2 px-3 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>Serviços Existentes</span>
                <Badge variant="secondary" className="ml-1 text-[10px] h-4.5 px-1.5 bg-emerald-100 text-emerald-800">
                  {selectedGerenciaDetail?.servicosExistentes?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="novos"
                className="rounded-lg text-xs font-semibold py-2 px-3 data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Novos Serviços</span>
                <Badge variant="secondary" className="ml-1 text-[10px] h-4.5 px-1.5 bg-purple-100 text-purple-800">
                  {selectedGerenciaDetail?.servicosNovos?.length || 0}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Botões Exportar Excel e PDF do Detalhamento */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDetailExcel}
                  className="bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 border-slate-300 shadow-2xs gap-1.5 rounded-lg font-medium px-3 h-9 text-xs transition-colors"
                  title="Exportar todas as listas desta unidade para Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Excel</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportDetailPDF}
                  className="bg-white hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 text-slate-700 border-slate-300 shadow-2xs gap-1.5 rounded-lg font-medium px-3 h-9 text-xs transition-colors"
                  title="Exportar relatório completo desta unidade para PDF (.pdf)"
                >
                  <FileDown className="h-4 w-4 text-rose-600" />
                  <span>PDF</span>
                </Button>
              </div>

              {/* Campo de Busca Rápida */}
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar nesta lista..."
                  value={detailSearchTerm}
                  onChange={(e) => setDetailSearchTerm(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs bg-white border-slate-300 rounded-lg"
                />
                {detailSearchTerm && (
                  <button
                    onClick={() => setDetailSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Conteúdo Aba 1: Aquisições */}
          <TabsContent value="aquisicoes" className="m-0 p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {filteredModalAquisicoes.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <ShoppingCart className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Nenhum item de aquisição encontrado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detailSearchTerm ? "Tente ajustar o termo de pesquisa." : "Esta unidade não possui itens de aquisição registrados."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="text-[11px] text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-3 font-bold text-center w-24">Gerência</th>
                      <th className="px-3.5 py-3 font-bold text-center w-24">ID_Diretoria</th>
                      <th className="px-3.5 py-3 font-bold text-center w-16">Código</th>
                      <th className="px-3.5 py-3 font-bold">Descrição do Item</th>
                      <th className="px-3.5 py-3 font-bold">Categoria</th>
                      <th className="px-3.5 py-3 font-bold text-center w-16">Unid.</th>
                      <th className="px-3.5 py-3 font-bold text-center w-20">Qtd</th>
                      <th className="px-3.5 py-3 font-bold text-right">Valor Unit. (R$)</th>
                      <th className="px-3.5 py-3 font-bold text-right">Valor Total (R$)</th>
                      <th className="px-3.5 py-3 font-bold text-center w-24">Prioridade</th>
                      <th className="px-3.5 py-3 font-bold text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredModalAquisicoes.map((item: any, idx: number) => (
                      <tr key={item.id || idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 border border-slate-200">
                            {item.gerencia || selectedGerenciaDetail.sigla}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                          <span className="bg-blue-50 px-2 py-0.5 rounded text-[11px] font-semibold text-blue-900 border border-blue-200/60">
                            {item.diretoria || siglaUpper}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-800">
                          {item.codigo}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-semibold text-slate-900 block">{item.descricao}</span>
                          {item.observacao && (
                            <span className="text-[10px] text-slate-500 italic block mt-0.5">
                              Obs: {item.observacao}
                            </span>
                          )}
                          {item.justificativaRejeicao && (
                            <span className="text-[10px] text-red-600 font-medium block mt-0.5">
                              Motivo rejeição: {item.justificativaRejeicao}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">{item.categoria}</td>
                        <td className="px-3.5 py-2.5 text-center text-slate-600">{item.unidade}</td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-900">{item.qtdEstimada}</td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700">
                          {formatCurrency(item.valorUnitario)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-blue-700">
                          {formatCurrency(item.valorTotal || item.qtdEstimada * item.valorUnitario)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">{getPriorityBadge(item.prioridade)}</td>
                        <td className="px-3.5 py-2.5 text-center">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={6} className="px-3.5 py-2.5 text-left text-xs uppercase">
                        Total Aquisições Exibidas ({filteredModalAquisicoes.length} itens)
                      </td>
                      <td className="px-3.5 py-2.5 text-center text-xs">
                        {filteredModalAquisicoes.reduce((acc: number, cur: any) => acc + (cur.qtdEstimada || 0), 0)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-xs">-</td>
                      <td className="px-3.5 py-2.5 text-right text-xs text-blue-800 font-black">
                        {formatCurrency(
                          filteredModalAquisicoes.reduce(
                            (acc: number, cur: any) => acc + (cur.valorTotal || cur.qtdEstimada * cur.valorUnitario || 0),
                            0
                          )
                        )}
                      </td>
                      <td colSpan={2} className="px-3.5 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Conteúdo Aba 2: Serviços Existentes */}
          <TabsContent value="existentes" className="m-0 p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {filteredModalServicosExistentes.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Nenhum serviço existente encontrado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detailSearchTerm ? "Tente ajustar o termo de pesquisa." : "Esta unidade não possui serviços existentes cadastrados."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="text-[11px] text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-3 font-bold text-center w-24">Gerência</th>
                      <th className="px-3.5 py-3 font-bold text-center w-24">ID_Diretoria</th>
                      <th className="px-3.5 py-3 font-bold text-center w-16">Item</th>
                      <th className="px-3.5 py-3 font-bold">Objeto do Serviço</th>
                      <th className="px-3.5 py-3 font-bold">Tipo Contratação</th>
                      <th className="px-3.5 py-3 font-bold">Contrato / Contratada</th>
                      <th className="px-3.5 py-3 font-bold text-right">Valor Estimado / Dotação (R$)</th>
                      <th className="px-3.5 py-3 font-bold text-center w-24">Prioridade</th>
                      <th className="px-3.5 py-3 font-bold text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredModalServicosExistentes.map((servico: any, idx: number) => (
                      <tr key={servico.id || idx} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 border border-slate-200">
                            {servico.gerencia || selectedGerenciaDetail.sigla}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                          <span className="bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold text-emerald-900 border border-emerald-200/60">
                            {servico.diretoria || siglaUpper}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-800">
                          {servico.item}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-semibold text-slate-900 block">{servico.objeto}</span>
                          {servico.observacao && (
                            <span className="text-[10px] text-slate-500 italic block mt-0.5">
                              Obs: {servico.observacao}
                            </span>
                          )}
                          {servico.justificativaRejeicao && (
                            <span className="text-[10px] text-red-600 font-medium block mt-0.5">
                              Motivo rejeição: {servico.justificativaRejeicao}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">{servico.tipoContratacao}</td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-medium text-slate-800 block">{servico.contrato || "-"}</span>
                          <span className="text-[10px] text-muted-foreground block">{servico.contratada || "-"}</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-emerald-700">
                          {formatCurrency(servico.valor)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">{getPriorityBadge(servico.grauPrioridade)}</td>
                        <td className="px-3.5 py-2.5 text-center">{getStatusBadge(servico.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={6} className="px-3.5 py-2.5 text-left text-xs uppercase">
                        Total Serviços Existentes ({filteredModalServicosExistentes.length} serviços)
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-xs text-emerald-800 font-black">
                        {formatCurrency(
                          filteredModalServicosExistentes.reduce((acc: number, cur: any) => acc + (cur.valor || 0), 0)
                        )}
                      </td>
                      <td colSpan={2} className="px-3.5 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Conteúdo Aba 3: Novos Serviços */}
          <TabsContent value="novos" className="m-0 p-4 space-y-4 max-h-[500px] overflow-y-auto">
            {filteredModalServicosNovos.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Nenhum novo serviço encontrado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detailSearchTerm ? "Tente ajustar o termo de pesquisa." : "Esta unidade não possui novos serviços solicitados."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="text-[11px] text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-3 font-bold text-center w-24">Gerência</th>
                      <th className="px-3.5 py-3 font-bold text-center w-24">ID_Diretoria</th>
                      <th className="px-3.5 py-3 font-bold text-center w-16">Item</th>
                      <th className="px-3.5 py-3 font-bold">Objeto do Novo Serviço</th>
                      <th className="px-3.5 py-3 font-bold">Justificativa da Demanda</th>
                      <th className="px-3.5 py-3 font-bold">Tipo Contratação</th>
                      <th className="px-3.5 py-3 font-bold text-center">Previsão Início</th>
                      <th className="px-3.5 py-3 font-bold text-right">Estimativa Valor (R$)</th>
                      <th className="px-3.5 py-3 font-bold text-center w-24">Prioridade</th>
                      <th className="px-3.5 py-3 font-bold text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredModalServicosNovos.map((servico: any, idx: number) => (
                      <tr key={servico.id || idx} className="hover:bg-purple-50/40 transition-colors">
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-800 border border-slate-200">
                            {servico.gerencia || selectedGerenciaDetail.sigla}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                          <span className="bg-purple-50 px-2 py-0.5 rounded text-[11px] font-semibold text-purple-900 border border-purple-200/60">
                            {servico.diretoria || siglaUpper}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-800">
                          {servico.item}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-semibold text-slate-900 block">{servico.objeto}</span>
                          {servico.observacao && (
                            <span className="text-[10px] text-slate-500 italic block mt-0.5">
                              Obs: {servico.observacao}
                            </span>
                          )}
                          {servico.justificativaRejeicao && (
                            <span className="text-[10px] text-red-600 font-medium block mt-0.5">
                              Motivo rejeição: {servico.justificativaRejeicao}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">{servico.justificativa}</td>
                        <td className="px-3.5 py-2.5 text-slate-600">{servico.tipoContratacao}</td>
                        <td className="px-3.5 py-2.5 text-center text-slate-600">{servico.previsaoInicio || "-"}</td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-purple-700">
                          {formatCurrency(servico.valor)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">{getPriorityBadge(servico.grauPrioridade)}</td>
                        <td className="px-3.5 py-2.5 text-center">{getStatusBadge(servico.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={7} className="px-3.5 py-2.5 text-left text-xs uppercase">
                        Total Novos Serviços ({filteredModalServicosNovos.length} serviços)
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-xs text-purple-800 font-black">
                        {formatCurrency(
                          filteredModalServicosNovos.reduce((acc: number, cur: any) => acc + (cur.valor || 0), 0)
                        )}
                      </td>
                      <td colSpan={2} className="px-3.5 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer do Detalhamento */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-2 justify-between items-center text-xs">
          <span className="text-muted-foreground">
            Total consolidado de solicitações: <strong>{selectedGerenciaDetail?.totalSolicitacoes || 0}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDetailExcel}
              className="bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 border-slate-300 h-8 px-3 rounded-lg text-xs font-medium gap-1.5"
              title="Exportar detalhamento desta unidade para Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exportar Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDetailPDF}
              className="bg-white hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 text-slate-700 border-slate-300 h-8 px-3 rounded-lg text-xs font-medium gap-1.5"
              title="Exportar detalhamento desta unidade para PDF (.pdf)"
            >
              <FileDown className="h-3.5 w-3.5 text-rose-600" />
              <span>Exportar PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedGerenciaDetail(null)}
              className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 h-8 px-4 rounded-lg text-xs font-medium"
            >
              Recolher Detalhamento
            </Button>
          </div>
        </div>
      </div>
    );
  };

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

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtro Gerência no Topo (Visão Gerencial - Conforme Imagem 1) */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
                <span className="text-xs text-white/80 font-medium whitespace-nowrap flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-blue-300" />
                  Filtrar Gerência:
                </span>
                <select
                  value={selectedGerenciaFilter}
                  onChange={(e) => setSelectedGerenciaFilter(e.target.value)}
                  className="h-8 rounded-lg border border-white/20 bg-slate-800 text-white text-xs px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer font-medium"
                >
                  <option value="todas" className="bg-slate-900 text-white">Todas as Gerências</option>
                  {gerenciaMatrix.map((g) => (
                    <option key={g.id} value={g.id} className="bg-slate-900 text-white">
                      {g.sigla}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botões Exportar Excel e PDF (Imagem 2) */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
                  title="Exportar Visão Gerencial para Excel"
                >
                  <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                  <span>Excel</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="bg-white hover:bg-slate-100 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3.5 py-1.5 h-9 transition-colors"
                  title="Exportar Visão Gerencial para PDF"
                >
                  <FileDown className="h-4 w-4 text-slate-700" />
                  <span>PDF</span>
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Valor Total Geral</p>
                  <p className="text-lg font-bold text-amber-300">{formatCurrency(displayTotals.valorTotalGeral)}</p>
                </div>
              </div>

              {displayTotals.orcamentoTotalDiretoria > 0 && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15">
                  <Wallet className="h-5 w-5 text-amber-300" />
                  <div>
                    <p className="text-[11px] text-white/70 uppercase tracking-wider font-semibold">Saldo Geral</p>
                    <p className={`text-lg font-bold ${displayTotals.saldoGeralDiretoria < 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {formatCurrency(displayTotals.saldoGeralDiretoria)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* Banner de Filtro Ativo */}
          {activeGerencia && (
            <div className="bg-blue-50 border border-blue-200 text-blue-950 px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs text-blue-700 font-medium block">Filtro de Gerência Ativo</span>
                  <p className="text-sm font-bold text-blue-900">
                    Exibindo dados de: {activeGerencia.sigla} - {activeGerencia.nome}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedGerenciaFilter("todas")}
                className="bg-white hover:bg-blue-100/60 text-blue-800 border-blue-200 text-xs h-8 gap-1.5 rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
                Ver todas as gerências
              </Button>
            </div>
          )}

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
                      <p className="text-2xl font-bold text-slate-800 mt-1">{displayTotals.totalSolicitacoes}</p>
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
                    <span className="font-semibold text-blue-400">{displayTotals.qtdAquisicao} itens ({formatCurrency(displayTotals.valorAquisicao)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                    <span className="font-semibold text-emerald-400">{displayTotals.qtdServicosExistentes} serv. ({formatCurrency(displayTotals.valorServicosExistentes)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🚀 Novos Serviços:</span>
                    <span className="font-semibold text-purple-400">{displayTotals.qtdServicosNovos} serv. ({formatCurrency(displayTotals.valorServicosNovos)})</span>
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
                      <p className="text-2xl font-bold text-emerald-700 mt-1">{displayTotals.aprovadasCount}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-2">
                    {formatCurrency(displayTotals.aprovadasValor)}
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
                    <span className="font-semibold text-blue-400">{displayTotals.aprovadasAquisicaoCount} itens ({formatCurrency(displayTotals.aprovadasAquisicaoValor)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                    <span className="font-semibold text-emerald-400">{displayTotals.aprovadasExistentesCount} serv. ({formatCurrency(displayTotals.aprovadasExistentesValor)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🚀 Novos Serviços:</span>
                    <span className="font-semibold text-purple-400">{displayTotals.aprovadasNovosCount} serv. ({formatCurrency(displayTotals.aprovadasNovosValor)})</span>
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
                      <p className="text-2xl font-bold text-amber-700 mt-1">{displayTotals.pendentesCount}</p>
                    </div>
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-amber-700 mt-2">
                    {formatCurrency(displayTotals.pendentesValor)}
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
                    <span className="font-semibold text-blue-400">{displayTotals.pendentesAquisicaoCount} itens ({formatCurrency(displayTotals.pendentesAquisicaoValor)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                    <span className="font-semibold text-emerald-400">{displayTotals.pendentesExistentesCount} serv. ({formatCurrency(displayTotals.pendentesExistentesValor)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🚀 Novos Serviços:</span>
                    <span className="font-semibold text-purple-400">{displayTotals.pendentesNovosCount} serv. ({formatCurrency(displayTotals.pendentesNovosValor)})</span>
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
                      <p className="text-2xl font-bold text-red-700 mt-1">{displayTotals.rejeitadasCount}</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg text-red-600">
                      <XCircle className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-red-700 mt-2">
                    {formatCurrency(displayTotals.rejeitadasValor)}
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
                    <span className="font-semibold text-blue-400">{displayTotals.rejeitadasAquisicaoCount} itens ({formatCurrency(displayTotals.rejeitadasAquisicaoValor)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                    <span className="font-semibold text-emerald-400">{displayTotals.rejeitadasExistentesCount} serv. ({formatCurrency(displayTotals.rejeitadasExistentesValor)})</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🚀 Novos Serviços:</span>
                    <span className="font-semibold text-purple-400">{displayTotals.rejeitadasNovosCount} serv. ({formatCurrency(displayTotals.rejeitadasNovosValor)})</span>
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
                      <p className="text-xl font-bold text-indigo-900 mt-1">{formatCurrency(displayTotals.valorTotalGeral)}</p>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                  </div>
                  <p className={`text-[11px] font-bold mt-2 ${displayTotals.saldoGeralDiretoria < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    Saldo Geral: {formatCurrency(displayTotals.saldoGeralDiretoria)}
                  </p>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-3 bg-slate-900 text-white max-w-xs space-y-2 border border-slate-700 shadow-xl">
                <p className="font-bold text-xs border-b border-slate-700 pb-1 text-indigo-300 flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5" /> Balanço Financeiro & Saldo Geral
                </p>
                <div className="space-y-1.5 text-xs">
                  {displayTotals.orcamentoTotalDiretoria > 0 && (
                    <div className="flex justify-between gap-4 border-b border-slate-800 pb-1">
                      <span className="text-slate-300 font-medium">🏛️ Orçamento Definido:</span>
                      <span className="font-bold text-blue-300">{formatCurrency(displayTotals.orcamentoTotalDiretoria)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">📦 Gasto Aquisição:</span>
                    <span className="font-semibold text-blue-400">{formatCurrency(displayTotals.valorAquisicao)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🛠️ Serv. Existentes:</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(displayTotals.valorServicosExistentes)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-300">🚀 Novos Serviços:</span>
                    <span className="font-semibold text-purple-400">{formatCurrency(displayTotals.valorServicosNovos)}</span>
                  </div>
                  <div className="flex justify-between gap-4 pt-1.5 border-t border-slate-700">
                    <span className="text-slate-200 font-bold">💳 Saldo Geral:</span>
                    <span className={`font-extrabold ${displayTotals.saldoGeralDiretoria < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {formatCurrency(displayTotals.saldoGeralDiretoria)}
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

              <div className="flex items-center gap-3 flex-wrap">
                {/* Botões Exportar Excel e PDF */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3 py-1.5 h-9 transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-slate-700" />
                    <span>Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                    className="bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm gap-2 rounded-lg font-medium px-3 py-1.5 h-9 transition-colors"
                  >
                    <FileDown className="h-4 w-4 text-slate-700" />
                    <span>PDF</span>
                  </Button>
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
                  {filteredMatrix.map((row) => {
                    const isExpanded = selectedGerenciaDetail?.id === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          onClick={() => {
                            if (isExpanded) {
                              setSelectedGerenciaDetail(null);
                            } else {
                              setSelectedGerenciaDetail(row);
                              setDetailActiveTab("aquisicoes");
                              setDetailSearchTerm("");
                            }
                          }}
                          className={cn(
                            "hover:bg-blue-50/70 transition-colors cursor-pointer group",
                            isExpanded && "bg-blue-50/80 border-l-4 border-l-blue-600"
                          )}
                          title={
                            isExpanded
                              ? "Clique para recolher o detalhamento"
                              : "Clique para ver todas as aquisições e serviços detalhados"
                          }
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                                  {row.sigla}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-normal block">
                                  {row.nome}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isExpanded) {
                                    setSelectedGerenciaDetail(null);
                                  } else {
                                    setSelectedGerenciaDetail(row);
                                    setDetailActiveTab("aquisicoes");
                                    setDetailSearchTerm("");
                                  }
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1 text-[10px] rounded px-2 py-1 font-semibold transition-all shadow-2xs",
                                  isExpanded
                                    ? "text-white bg-blue-600 hover:bg-blue-700"
                                    : "text-blue-700 bg-blue-50 border border-blue-200/80 hover:bg-blue-100"
                                )}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    Recolher
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-3 w-3" />
                                    Ver itens
                                  </>
                                )}
                              </button>
                            </div>
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

                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b-2 border-indigo-200">
                            <td colSpan={8} className="p-3 sm:p-4 bg-slate-100/60">
                              {renderDetailContainer()}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                  <tr
                    onClick={() => {
                      if (selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id) {
                        setSelectedGerenciaDetail(null);
                      } else {
                        setSelectedGerenciaDetail(totalDiretoriaDetailRow);
                        setDetailActiveTab("aquisicoes");
                        setDetailSearchTerm("");
                      }
                    }}
                    className={cn(
                      "hover:bg-slate-200/90 transition-colors cursor-pointer group",
                      selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id && "bg-slate-200 border-l-4 border-l-indigo-600"
                    )}
                    title={
                      selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id
                        ? "Clique para recolher o detalhamento consolidado"
                        : "Clique para ver o detalhamento consolidado de toda a diretoria"
                    }
                  >
                    <td className="px-4 py-3.5 text-sm uppercase">
                      <div className="flex items-center justify-between gap-2">
                        <span>Total Diretoria {siglaUpper}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id) {
                              setSelectedGerenciaDetail(null);
                            } else {
                              setSelectedGerenciaDetail(totalDiretoriaDetailRow);
                              setDetailActiveTab("aquisicoes");
                              setDetailSearchTerm("");
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] rounded px-2 py-1 font-semibold transition-all normal-case shadow-2xs",
                            selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id
                              ? "text-white bg-indigo-600 hover:bg-indigo-700"
                              : "text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"
                          )}
                        >
                          {selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              Recolher
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" />
                              Ver Consolidado
                            </>
                          )}
                        </button>
                      </div>
                    </td>
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

                  {selectedGerenciaDetail?.id === totalDiretoriaDetailRow.id && (
                    <tr className="bg-slate-50/90 border-t-2 border-indigo-200">
                      <td colSpan={8} className="p-3 sm:p-4 bg-slate-100/60">
                        {renderDetailContainer()}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        
      </div>
    </TooltipProvider>
  );
}
