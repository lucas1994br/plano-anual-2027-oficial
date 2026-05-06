export function getPrioridadeBadgeVariant(prioridade: string) {
  switch (prioridade) {
    case "Muito Alto":
      return "destructive";
    case "Alta":
    case "Alto":
      return "warning";
    case "Média":
    case "Médio":
      return "default";
    case "Baixa":
    case "Baixo":
      return "success";
    case "Muito Baixo":
      return "outline";
    default:
      return "secondary";
  }
}