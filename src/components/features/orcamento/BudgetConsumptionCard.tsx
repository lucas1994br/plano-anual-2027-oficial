import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Landmark, Layers } from "lucide-react";

interface BudgetConsumptionCardProps {
  titulo: string;
  orcamento: number;
  gasto: number;
  orcamentoGeral?: number;
  orcamentoBase?: number;
  subtitulo?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export function BudgetConsumptionCard({
  titulo,
  orcamento,
  gasto,
  orcamentoGeral = 0,
  orcamentoBase,
  subtitulo,
}: BudgetConsumptionCardProps) {
  const saldo = orcamento - gasto;
  const percentual = orcamento > 0 ? (gasto / orcamento) * 100 : 0;

  const badgeVariant =
    percentual >= 100 ? "destructive" : percentual >= 80 ? "warning" : "default";

  const baseCalc = orcamentoBase !== undefined ? orcamentoBase : Math.max(0, orcamento - orcamentoGeral);

  return (
    <div className="px-6 pb-2">
      <Card className="p-4 card-shadow border-l-4 border-l-amber-500 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4 text-amber-600" />
              {titulo}
            </h3>
            {subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>}
          </div>
          <div className="flex items-center gap-2">
            {orcamentoGeral > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 gap-1.5 py-1">
                <Layers className="h-3 w-3 text-amber-600" />
                Orçamento Geral: {formatCurrency(orcamentoGeral)}
              </Badge>
            )}
            <Badge variant={badgeVariant as "default" | "secondary" | "destructive" | "outline"}>
              {percentual.toFixed(1)}% utilizado
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded border p-3 bg-blue-50/70 border-blue-200">
            <p className="text-muted-foreground text-xs font-medium">Orçamento Definido</p>
            <p className="font-bold text-blue-700 text-base">{formatCurrency(orcamento)}</p>
            {orcamentoGeral > 0 && (
              <p className="text-[11px] text-blue-600/80 mt-0.5 font-medium">
                Modalidade: {formatCurrency(baseCalc)} + Geral: {formatCurrency(orcamentoGeral)}
              </p>
            )}
          </div>
          <div className="rounded border p-3 bg-red-50/70 border-red-200">
            <p className="text-muted-foreground text-xs font-medium">Gasto Atual</p>
            <p className="font-bold text-red-700 text-base">{formatCurrency(gasto)}</p>
          </div>
          <div className="rounded border p-3 bg-emerald-50/70 border-emerald-200">
            <p className="text-muted-foreground text-xs font-medium">Saldo Disponível</p>
            <p className={`font-bold text-base ${saldo < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {formatCurrency(saldo)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
