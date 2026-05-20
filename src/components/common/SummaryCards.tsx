import { Package, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card.tsx";

interface SummaryCardsProps {
  totalItens: number;
  valorTotal: number;
}

export function SummaryCards({ totalItens, valorTotal }: SummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
      <Card className="p-5 card-shadow bg-card border-l-4 border-l-primary">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total de Itens</p>
            <p className="text-3xl font-bold text-foreground mt-1">{totalItens}</p>
          </div>
          <div className="bg-primary/10 p-3 rounded-full">
            <Package className="h-6 w-6 text-primary" />
          </div>
        </div>
      </Card>

      <Card className="p-5 card-shadow bg-card border-l-4 border-l-info">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Valor Total Estimado</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">(valores sujeitos a atualização conforme pesquisa de mercado)</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(valorTotal)}</p>
          </div>
          <div className="bg-info/10 p-3 rounded-full">
            <DollarSign className="h-6 w-6 text-info" />
          </div>
        </div>
      </Card>
    </div>
  );
}
