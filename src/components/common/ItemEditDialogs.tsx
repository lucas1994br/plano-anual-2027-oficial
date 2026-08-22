import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatContratoMask } from "@/lib/utils";
import { ServicoItem, PlanItem } from "@/types/plan";

// --- SERVIÇO EDIT DIALOG ---
interface ServicoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servico: ServicoItem | null;
  onSave: (servicoId: string | number, updates: Partial<ServicoItem>) => Promise<void>;
  diretoriaLabel?: string;
  gerenciaLabel?: string;
  canEditStatus?: boolean;
}

export const ServicoEditDialog = ({
  open,
  onOpenChange,
  servico,
  onSave,
  diretoriaLabel,
  gerenciaLabel,
  canEditStatus = false,
}: ServicoEditDialogProps) => {
  const [formData, setFormData] = useState<Partial<ServicoItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sincronizar estado local quando o serviço mudar ou o modal abrir
  useEffect(() => {
    if (open && servico) {
      setFormData({
        objeto: servico.objeto || "",
        justificativa: servico.justificativa || "",
        observacao: servico.observacao || "",
        estimativaValor: servico.estimativaValor || 0,
        dotacaoOrcamentaria: servico.dotacaoOrcamentaria || 0,
        grauPrioridade: servico.grauPrioridade || "Baixo",
        vinculacao: servico.vinculacao || "Não",
        dependenciaDescricao: servico.dependenciaDescricao || "",
        contrato: servico.contrato || "",
        contratada: servico.contratada || "",
        tipoContratacao: servico.tipoContratacao || "Contínuo",
        status: servico.status || "rascunho",
      });
    }
  }, [open, servico]);

  const handleSave = async () => {
    if (!servico) return;
    setIsSaving(true);
    try {
      const payload = { ...formData };
      if (!canEditStatus) {
        delete payload.status;
      }
      await onSave(servico.item, payload);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof ServicoItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!servico) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Serviço</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-medium">Objeto <span className="text-destructive">*</span></label>
            <textarea
              className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background min-h-[60px]"
              value={formData.objeto || ""}
              onChange={(e) => handleChange("objeto", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Justificativa <span className="text-destructive">*</span></label>
            <textarea
              className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background min-h-[60px]"
              value={formData.justificativa || ""}
              onChange={(e) => handleChange("justificativa", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Contrato</label>
              <input
                type="text"
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                value={formData.contrato || ""}
                onChange={(e) => handleChange("contrato", formatContratoMask(e.target.value))}
                placeholder="Ex: 028/2021"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contratada</label>
              <input
                type="text"
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                value={formData.contratada || ""}
                onChange={(e) => handleChange("contratada", e.target.value)}
                placeholder="Nome da empresa contratada"
              />
            </div>
          </div>
          <div className={canEditStatus ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
            <div>
              <label className="text-sm font-medium">Tipo de Contratação</label>
              <select
                value={formData.tipoContratacao || "Contínuo"}
                onChange={(e) => handleChange("tipoContratacao", e.target.value)}
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
              >
                <option value="Contínuo">Contínuo</option>
                <option value="Renovação">Renovação</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Grau de Prioridade</label>
              <Select
                value={formData.grauPrioridade || "Baixo"}
                onValueChange={(v: any) => handleChange("grauPrioridade", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixo">Baixo</SelectItem>
                  <SelectItem value="Médio">Médio</SelectItem>
                  <SelectItem value="Alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canEditStatus && (
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status || "rascunho"}
                  onValueChange={(v: any) => handleChange("status", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    <SelectItem value="em_compra">Em Compra</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Estimativa de Valor (R$) <span className="text-destructive">*</span></label>
              <CurrencyInput
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                value={formData.estimativaValor?.toString() || ""}
                onChange={(e) => handleChange("estimativaValor", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Vinculação</label>
              <Select
                value={formData.vinculacao || "Não"}
                onValueChange={(v: any) => handleChange("vinculacao", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Descrição da Vinculação</label>
            <textarea
              className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background min-h-[60px]"
              value={formData.dependenciaDescricao || ""}
              onChange={(e) => handleChange("dependenciaDescricao", e.target.value)}
              disabled={formData.vinculacao !== "Sim"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Diretoria</label>
              <input
                type="text"
                value={diretoriaLabel || servico.diretoriaSigla || ""}
                disabled
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Gerência</label>
              <input
                type="text"
                value={gerenciaLabel || servico.gerencia || ""}
                disabled
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// --- AQUISIÇÃO EDIT DIALOG ---
interface AquisicaoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aquisicao: PlanItem | null;
  onSave: (codigo: number, updates: Partial<PlanItem>) => Promise<void>;
  canEditStatus?: boolean;
}

export const AquisicaoEditDialog = ({
  open,
  onOpenChange,
  aquisicao,
  onSave,
  canEditStatus = false,
}: AquisicaoEditDialogProps) => {
  const [formData, setFormData] = useState<Partial<PlanItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && aquisicao) {
      setFormData({
        descricao: aquisicao.descricao || "",
        categoria: aquisicao.categoria || "",
        unidade: aquisicao.unidade || "",
        qtdEstimada: aquisicao.qtdEstimada || 0,
        prioridade: aquisicao.prioridade || "Baixa",
        observacao: aquisicao.observacao || "",
        status: aquisicao.status || "rascunho",
      });
    }
  }, [open, aquisicao]);

  const handleSave = async () => {
    if (!aquisicao) return;
    setIsSaving(true);
    try {
      const payload = { ...formData };
      if (!canEditStatus) {
        delete payload.status;
      }
      await onSave(aquisicao.codigo, payload);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof PlanItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!aquisicao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar Solicitação de Aquisição</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <textarea
              className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background min-h-[60px]"
              value={formData.descricao || ""}
              onChange={(e) => handleChange("descricao", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Quantidade Estimada</label>
              <input
                type="number"
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                value={formData.qtdEstimada || 0}
                onChange={(e) => handleChange("qtdEstimada", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Unidade de Medida</label>
              <input
                type="text"
                className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background"
                value={formData.unidade || ""}
                onChange={(e) => handleChange("unidade", e.target.value)}
              />
            </div>
          </div>
          <div className={canEditStatus ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <Select
                value={formData.prioridade || "Baixa"}
                onValueChange={(v: any) => handleChange("prioridade", v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canEditStatus && (
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status || "rascunho"}
                  onValueChange={(v: any) => handleChange("status", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    <SelectItem value="em_compra">Em Compra</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Observação</label>
            <textarea
              className="w-full mt-1 text-sm border rounded px-3 py-2 bg-background min-h-[60px]"
              value={formData.observacao || ""}
              onChange={(e) => handleChange("observacao", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
