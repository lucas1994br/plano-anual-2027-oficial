import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { CurrencyInput } from "@/components/ui/currency-input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { PlanItem } from "@/types/plan.ts";
import { useToast } from "@/hooks/use-toast.ts";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: Omit<PlanItem, "codigo" | "saldo">) => void;
  editingItem?: PlanItem | null;
  categorias: string[];
  gerencias: string[];
}

export function AddItemDialog({
  open,
  onOpenChange,
  onSave,
  editingItem,
  categorias,
  gerencias,
}: AddItemDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    descricao: "",
    categoria: "",
    unidade: "unid",
    qtdEstimada: 0,
    valorUnitario: 0,
    prioridade: "Baixa" as "Baixa" | "Média" | "Alta",
    gerencia: "",
    observacao: "",
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        descricao: editingItem.descricao,
        categoria: editingItem.categoria,
        unidade: editingItem.unidade,
        qtdEstimada: editingItem.qtdEstimada,
        valorUnitario: editingItem.valorUnitario,
        prioridade: editingItem.prioridade,
        gerencia: editingItem.gerencia,
        observacao: editingItem.observacao || "",
      });
    } else {
      setFormData({
        descricao: "",
        categoria: "",
        unidade: "unid",
        qtdEstimada: 0,
        valorUnitario: 0,
        prioridade: "Baixa",
        gerencia: "",
        observacao: "",
      });
    }
  }, [editingItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.descricao || !formData.categoria || formData.qtdEstimada <= 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a descrição, categoria e quantidade.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "Editar Item" : "Adicionar Novo Item"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) =>
                  setFormData({ ...formData, descricao: e.target.value })
                }
                placeholder="Nome do item"
                required
              />
            </div>

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) =>
                  setFormData({ ...formData, categoria: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="gerencia">Gerência</Label>
              <Select
                value={formData.gerencia}
                onValueChange={(value) =>
                  setFormData({ ...formData, gerencia: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a gerência" />
                </SelectTrigger>
                <SelectContent>
                  {gerencias.map((ger) => (
                    <SelectItem key={ger} value={ger}>
                      {ger}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="qtdEstimada">Quantidade Estimada</Label>
              <Input
                id="qtdEstimada"
                type="number"
                min="0"
                value={formData.qtdEstimada}
                onChange={(e) =>
                  setFormData({ ...formData, qtdEstimada: Number(e.target.value) })
                }
                required
              />
            </div>


            <div>
              <Label htmlFor="valorUnitario">Valor Unitário (R$)</Label>
              <CurrencyInput
                id="valorUnitario"
                value={formData.valorUnitario}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    valorUnitario: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value: "Baixa" | "Média" | "Alta") =>
                  setFormData({ ...formData, prioridade: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) =>
                  setFormData({ ...formData, observacao: e.target.value })
                }
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            {!isSubmitting ? (
              <Button type="submit">
                {editingItem ? "Salvar Alterações" : "Adicionar Item"}
              </Button>
            ) : (
              <Button disabled className="opacity-50 cursor-not-allowed">
                Salvando...
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}