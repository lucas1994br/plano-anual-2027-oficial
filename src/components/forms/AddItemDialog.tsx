import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlanItem } from "@/types/plan";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "Editar Item" : "Adicionar Novo Item"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Input
                id="valorUnitario"
                type="number"
                min="0"
                step="0.01"
                value={formData.valorUnitario}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    valorUnitario: Number(e.target.value),
                  })
                }
                required
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
            >
              Cancelar
            </Button>
            <Button type="submit">
              {editingItem ? "Salvar Alterações" : "Adicionar Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}