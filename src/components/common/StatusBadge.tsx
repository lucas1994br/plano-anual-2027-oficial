import { Badge } from "@/components/ui/badge.tsx";
import { SolicitacaoStatus } from "@/types/plan.ts";

const STATUS_CONFIG: Record<SolicitacaoStatus, { label: string; variant: string; className: string }> = {
  rascunho: { label: "Rascunho", variant: "outline", className: "border-blue-300 text-blue-600 bg-blue-50" },
  enviado: { label: "Enviado", variant: "default", className: "bg-info text-info-foreground" },
  em_analise: { label: "Em Análise", variant: "default", className: "bg-warning text-warning-foreground" },
  aprovado: { label: "Aprovado", variant: "default", className: "bg-success text-success-foreground" },
  rejeitado: { label: "Rejeitado", variant: "destructive", className: "" },
  em_compra: { label: "Em Compra", variant: "default", className: "bg-primary text-primary-foreground" },
  concluido: { label: "Concluído", variant: "default", className: "bg-success text-success-foreground" },
};

export function StatusBadge({ status }: { status: SolicitacaoStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}
