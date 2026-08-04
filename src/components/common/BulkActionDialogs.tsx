import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface BulkEditAquisicaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (updates: any) => Promise<void>;
  isUpdating: boolean;
}

export function BulkEditAquisicaoDialog({ open, onOpenChange, selectedCount, onConfirm, isUpdating }: BulkEditAquisicaoDialogProps) {
  const [field, setField] = useState<string>("");
  const [value, setValue] = useState<string>("");

  const handleConfirm = async () => {
    const updates: any = {};
    if (field === "prioridade") updates.prioridade = value;
    if (field === "observacao") updates.observacao = value;
    if (field === "unidade") updates.unidade = value;
    if (field === "qtdEstimada") updates.qtdEstimada = Number(value);
    
    await onConfirm(updates);
    setField("");
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {selectedCount} itens (Aquisição)</DialogTitle>
          <DialogDescription>Selecione um campo para atualizar em todos os itens selecionados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Campo a editar</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prioridade">Prioridade</SelectItem>
                <SelectItem value="observacao">Observação</SelectItem>
                <SelectItem value="unidade">Unidade</SelectItem>
                <SelectItem value="qtdEstimada">Quantidade Estimada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {field && (
            <div className="space-y-2">
              <Label>Novo valor</Label>
              {field === "prioridade" ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              ) : field === "qtdEstimada" ? (
                <Input type="number" value={value} onChange={e => setValue(e.target.value)} />
              ) : (
                <Input value={value} onChange={e => setValue(e.target.value)} />
              )}
            </div>
          )}
          <Button className="w-full" disabled={!field || !value || isUpdating} onClick={handleConfirm}>
            {isUpdating ? "Salvando..." : "Aplicar a todos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BulkEditServicosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (updates: any) => Promise<void>;
  isUpdating: boolean;
}

export function BulkEditServicosDialog({ open, onOpenChange, selectedCount, onConfirm, isUpdating }: BulkEditServicosDialogProps) {
  const [field, setField] = useState<string>("");
  const [value, setValue] = useState<string>("");

  const handleConfirm = async () => {
    const updates: any = {};
    if (field === "grauPrioridade") updates.grauPrioridade = value;
    if (field === "justificativa") updates.justificativa = value;
    if (field === "estimativaValor") updates.estimativaValor = Number(value);
    if (field === "tipoContratacao") updates.tipoContratacao = value;
    if (field === "unidadeDemandante") updates.unidadeDemandante = value;
    
    await onConfirm(updates);
    setField("");
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {selectedCount} serviços</DialogTitle>
          <DialogDescription>Selecione um campo para atualizar em todos os serviços selecionados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Campo a editar</Label>
            <Select value={field} onValueChange={setField}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grauPrioridade">Grau de Prioridade</SelectItem>
                <SelectItem value="tipoContratacao">Tipo de Contratação (Categoria)</SelectItem>
                <SelectItem value="unidadeDemandante">Unidade Demandante</SelectItem>
                <SelectItem value="justificativa">Justificativa</SelectItem>
                <SelectItem value="estimativaValor">Estimativa de Valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {field && (
            <div className="space-y-2">
              <Label>Novo valor</Label>
              {field === "grauPrioridade" ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Alto">Alto</SelectItem>
                  </SelectContent>
                </Select>
              ) : field === "estimativaValor" ? (
                <Input type="number" value={value} onChange={e => setValue(e.target.value)} />
              ) : (
                <Input value={value} onChange={e => setValue(e.target.value)} />
              )}
            </div>
          )}
          <Button className="w-full" disabled={!field || !value || isUpdating} onClick={handleConfirm}>
            {isUpdating ? "Salvando..." : "Aplicar a todos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
