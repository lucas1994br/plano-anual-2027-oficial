import { Package, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlanHeaderProps {
  title: string;
  diretoria: string;
  ano: number;
  prazo: Date | null;
}

export function PlanHeader({ title, diretoria, ano, prazo }: PlanHeaderProps) {
  const diasRestantes = prazo ? differenceInDays(prazo, new Date()) : null;

  const getStatusPrazo = () => {
    if (diasRestantes === null) {
      return {
        tipo: "carregando",
        cor: "bg-muted",
        texto: "Carregando prazo...",
        subtexto: "Aguardando período ativo.",
      };
    }

    if (diasRestantes < 0) return { tipo: "vencido", cor: "bg-destructive", texto: "Prazo encerrado!", subtexto: "O link de acesso foi bloqueado. O período de preenchimento foi finalizado." };
    if (diasRestantes === 0) return { tipo: "hoje", cor: "bg-destructive", texto: "Último dia!", subtexto: "Hoje é o último dia para preenchimento. Após hoje, o link será bloqueado." };
    if (diasRestantes <= 7) return { tipo: "urgente", cor: "bg-warning", texto: `${diasRestantes} dias restantes`, subtexto: "Após a finalização do prazo, o link de acesso será bloqueado." };
    if (diasRestantes <= 30) return { tipo: "atencao", cor: "bg-warning", texto: `${diasRestantes} dias restantes`, subtexto: "Após a finalização do prazo, o link de acesso será bloqueado." };
    return { tipo: "ok", cor: "bg-success", texto: `${diasRestantes} dias restantes`, subtexto: "Após a finalização do prazo, o link de acesso será bloqueado." };
  };

  const status = getStatusPrazo();

  return (
    <header className="gradient-header px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-lg">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            <p className="text-white/80 text-sm">
              {diretoria} - PAC {ano}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-white/80 text-xs mr-2">
            <span>
              Prazo: {prazo ? format(prazo, "dd/MM/yyyy", { locale: ptBR }) : "carregando..."}
            </span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-destructive/60 text-destructive-foreground">
            {status.tipo === "vencido" || status.tipo === "hoje" || status.tipo === "urgente" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-bold">{status.texto}</span>
              <span className="text-[10px] opacity-90 max-w-[250px] leading-tight">{status.subtexto}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
