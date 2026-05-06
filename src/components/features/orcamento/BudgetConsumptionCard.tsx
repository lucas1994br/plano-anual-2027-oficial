import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BudgetConsumptionCardProps {
  titulo: string;
  orcamento: number;
  gasto: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export function BudgetConsumptionCard({ titulo, orcamento, gasto }: BudgetConsumptionCardProps) {
  const saldo = orcamento - gasto;
  const percentual = orcamento > 0 ? (gasto / orcamento) * 100 : 0;

  const badgeVariant =
    percentual >= 100 ? "destructive" : percentual >= 80 ? "warning" : "default";

  return (
    <div className="px-6 pb-2">
      <Card className="p-4 card-shadow border-l-4 border-l-amber-500">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold text-foreground">{titulo}</h3>
          <Badge variant={badgeVariant as "default" | "secondary" | "destructive" | "outline"}>
            {percentual.toFixed(1)}% utilizado
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded border p-3 bg-blue-50">
            <p className="text-muted-foreground">Orçamento definido</p>
            <p className="font-bold text-blue-700">{formatCurrency(orcamento)}</p>
          </div>
          <div className="rounded border p-3 bg-red-50">
            <p className="text-muted-foreground">Gasto atual</p>
            <p className="font-bold text-red-700">{formatCurrency(gasto)}</p>
          </div>
          <div className="rounded border p-3 bg-emerald-50">
            <p className="text-muted-foreground">Saldo disponível</p>
            <p className={`font-bold ${saldo < 0 ? "text-red-700" : "text-emerald-700"}`}>
              {formatCurrency(saldo)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
