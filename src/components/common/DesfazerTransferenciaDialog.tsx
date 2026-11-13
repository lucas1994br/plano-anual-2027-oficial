import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Undo2, Loader2, ArrowRight, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import {
  getHistoricoTransferencias,
  desfazerTransferenciaAquisicao,
  desfazerTransferenciaServicos,
  HistoricoTransferenciaItem,
} from "@/lib/services.ts";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DesfazerTransferenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "aquisicao" | "servicos";
  diretoriaId?: string;
  diretoriaSigla?: string;
  onSuccess?: () => void;
}

export const DesfazerTransferenciaDialog: React.FC<DesfazerTransferenciaDialogProps> = ({
  open,
  onOpenChange,
  tipo,
  diretoriaId,
  diretoriaSigla,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoTransferenciaItem[]>([]);

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const itens = await getHistoricoTransferencias({
        tipo,
        diretoriaId,
        limit: 15,
      });
      setHistorico(itens);
    } catch (err) {
      console.error("Erro ao carregar histórico de transferências:", err);
      toast.error("Não foi possível carregar o histórico de transferências.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      carregarHistorico();
    }
  }, [open, tipo, diretoriaId]);

  const handleDesfazer = async (item: HistoricoTransferenciaItem) => {
    const confirmou = typeof window !== "undefined" && window.confirm
      ? window.confirm(
          `Deseja realmente desfazer a transferência "${item.titulo}"?\nOs itens/serviços retornarão para a Diretoria ${item.sourceDiretoriaSigla || "de Origem"}.`
        )
      : true;
    if (!confirmou) return;

    setDesfazendoId(item.id);
    try {
      let res: { count: number; restoredToDiretoria: string };

      if (tipo === "aquisicao") {
        res = await desfazerTransferenciaAquisicao({
          logId: item.id,
          categorias: item.detalhes?.categorias,
          sourceDiretoriaId: item.sourceDiretoriaId,
          targetDiretoriaIds: item.targetDiretoriaIds,
          incluirCustoFinanceiro: item.incluirCustoFinanceiro,
          origemSigla: item.sourceDiretoriaSigla,
          solicitacaoIds: item.detalhes?.solicitacao_ids,
        });

        await queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
        await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria"] });
        await queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
        await queryClient.invalidateQueries({ queryKey: ["catalogo"] });
        if (item.sourceDiretoriaId) {
          await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", item.sourceDiretoriaId] });
        }
        if (item.targetDiretoriaIds) {
          for (const dId of item.targetDiretoriaIds) {
            await queryClient.invalidateQueries({ queryKey: ["solicitacoes-diretoria", dId] });
          }
        }
      } else {
        res = await desfazerTransferenciaServicos({
          logId: item.id,
          contratos: item.detalhes?.contratos,
          sourceDiretoriaId: item.sourceDiretoriaId,
          targetDiretoriaIds: item.targetDiretoriaIds,
          incluirCustoFinanceiro: item.incluirCustoFinanceiro,
          origemSigla: item.sourceDiretoriaSigla,
          servicoIds: item.detalhes?.servico_ids,
        });

        await queryClient.invalidateQueries({ queryKey: ["servicos"] });
        await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria"] });
        await queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
        if (item.sourceDiretoriaId) {
          await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", item.sourceDiretoriaId] });
        }
        if (item.targetDiretoriaIds) {
          for (const dId of item.targetDiretoriaIds) {
            await queryClient.invalidateQueries({ queryKey: ["servicos-diretoria", dId] });
          }
        }
      }

      if (res.count > 0) {
        toast.success(
          `Transferência desfeita com sucesso! ${res.count} registro(s) retornado(s) para a Diretoria ${item.sourceDiretoriaSigla || "de Origem"}.`
        );
      } else {
        toast.info(
          `A transferência foi desfeita. Registros sincronizados com a Diretoria ${item.sourceDiretoriaSigla || "de Origem"}.`
        );
      }

      // Atualização otimista imediata: remove o item desfeito da lista
      setHistorico(prev => prev.filter(h => h.id !== item.id));

      await queryClient.invalidateQueries({ queryKey: ["logs-atividades"] });
      await queryClient.invalidateQueries({ queryKey: ["logs"] });

      // Recarrega lista atualizada do backend e sincroniza a tela
      await carregarHistorico();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Erro ao desfazer transferência:", err);
      toast.error(err?.message || "Erro ao desfazer a transferência.");
    } finally {
      setDesfazendoId(null);
    }
  };

  const formatarData = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  const formatarMoeda = (valor?: number) => {
    if (!valor) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Desfazer Transferência / Desfazer Envio ({tipo === "aquisicao" ? "Aquisição" : "Serviços"})
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={carregarHistorico}
              disabled={loading}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {diretoriaSigla
              ? `Visualize as transferências recentes envolvendo a Diretoria ${diretoriaSigla} e reverta com 1 clique o envio de itens ou contratos.`
              : "Visualize as transferências recentes do PAC e reverta o envio de itens ou contratos para restaurar à diretoria de origem."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              <p className="text-xs">Buscando transferências recentes...</p>
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center border rounded-lg bg-muted/20 space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">Nenhuma transferência recente registrada</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Não foram encontrados envios recentes de {tipo === "aquisicao" ? "itens/categorias de aquisição" : "serviços/contratos"} passíveis de retorno no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {historico.map((item) => {
                const isDesfazendo = desfazendoId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm truncate">
                          {item.titulo}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            item.incluirCustoFinanceiro
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                          }`}
                        >
                          {item.incluirCustoFinanceiro ? "Com Custo Financeiro" : "Sem Custo Financeiro"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                        <span className="font-medium text-foreground">
                          De: Diretoria {item.sourceDiretoriaSigla || "Origem"}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          Para: {item.targetDiretoriaSiglas?.join(", ") || "Destino"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground text-[11px] flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatarData(item.created_at)}
                        </span>
                        {item.count !== undefined && item.count > 0 && (
                          <span>
                            • <strong>{item.count}</strong> {tipo === "aquisicao" ? "item(ns)" : "serviço(s)"}
                          </span>
                        )}
                        {item.incluirCustoFinanceiro && item.totalValor !== undefined && item.totalValor > 0 && (
                          <span>
                            • Valor: <strong>{formatarMoeda(item.totalValor)}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sm:self-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDesfazer(item)}
                        disabled={isDesfazendo || desfazendoId !== null}
                        className="w-full sm:w-auto gap-1.5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium"
                      >
                        {isDesfazendo ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Desfazendo...
                          </>
                        ) : (
                          <>
                            <Undo2 className="h-3.5 w-3.5" />
                            Desfazer Envio
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t mt-2 flex justify-between items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Ao desfazer, os itens retornam com status <strong>rascunho</strong> para a gerência principal da diretoria de origem.
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={desfazendoId !== null}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

