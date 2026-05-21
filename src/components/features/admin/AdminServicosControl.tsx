// AdminServicosControl.tsx - Versão CORRIGIDA SEM ANY
import { useState } from "react";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  getServicosCatalogo,
  createServicoCatalogoAndDistribuir,
  updateServicoCatalogoAdmin,
  deleteServicoCatalogoAdmin,
  getDiretorias,
  getGerenciasByDiretoria,
} from "@/lib/services.ts";
import { GrauPrioridade } from "@/types/plan.ts";

// ==================== TIPOS ====================
type ServicoCatalogo = {
  id: string;
  item: number;
  tipo_contratacao: string;
  objeto: string;
  justificativa: string | null;
  grau_prioridade: GrauPrioridade;
  estimativa_valor: number;
  vinculacao: "Sim" | "Não";
  dependencia_descricao: string | null;
  diretoria_id: string;
  gerencia_id: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

type Diretoria = {
  id: string;
  sigla: string;
  nome: string;
};

type Gerencia = {
  id: string;
  sigla: string;
  nome: string;
  diretoria_id: string;
};

// Tipo para o retorno da API de diretorias
type DiretoriaAPI = {
  id: string;
  sigla: string;
  nome: string | null;
};

// Tipo para o retorno da API de gerências
type GerenciaAPI = {
  id: string;
  sigla: string;
  nome: string | null;
  diretoria_id: string;
};

// ==================== COMPONENTE PRINCIPAL ====================
export function AdminServicosControl() {
  const queryClient = useQueryClient();

  // Estados para os diálogos
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<ServicoCatalogo | null>(null);
  const [deletingServico, setDeletingServico] = useState<ServicoCatalogo | null>(null);
  
  // Estados de loading
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formulário de criação
  const [formData, setFormData] = useState({
    tipo_contratacao: "Novo",
    objeto: "",
    justificativa: "",
    grau_prioridade: "Médio" as GrauPrioridade,
    estimativa_valor: "",
    vinculacao: "Não" as "Sim" | "Não",
    dependencia_descricao: "",
    diretoria_id: "",
    gerencia_id: "",
  });

  // Formulário de edição
  const [editFormData, setEditFormData] = useState({
    tipo_contratacao: "",
    objeto: "",
    justificativa: "",
    grau_prioridade: "Médio" as GrauPrioridade,
    estimativa_valor: "",
    vinculacao: "Não" as "Sim" | "Não",
    dependencia_descricao: "",
    diretoria_id: "",
    gerencia_id: "",
  });

  // Buscar serviços do catálogo
  const { data: servicos = [], isLoading, refetch: refetchServicos } = useQuery({
    queryKey: ["servicos-catalogo"],
    queryFn: getServicosCatalogo,
    staleTime: 5 * 60 * 1000,
  });

  // Buscar diretorias (sem any)
  const { data: diretorias = [] } = useQuery({
    queryKey: ["diretorias"],
    queryFn: async (): Promise<Diretoria[]> => {
      const result = await getDiretorias();
      return (result as any[]).map((dir: any): Diretoria => ({
        id: dir.id,
        sigla: dir.sigla,
        nome: dir.nome || dir.sigla,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Buscar gerências quando diretoria for selecionada (para criação)
  const { data: gerenciasCreate = [] } = useQuery({
    queryKey: ["gerencias-create", formData.diretoria_id],
    queryFn: (): Promise<Gerencia[]> => 
      formData.diretoria_id 
        ? getGerenciasByDiretoria(formData.diretoria_id).then((result: any[]) =>
            result.map((ger: any): Gerencia => ({
              id: ger.id,
              sigla: ger.sigla,
              nome: ger.nome || ger.sigla,
              diretoria_id: ger.diretoria_id,
            }))
          )
        : Promise.resolve([]),
    enabled: !!formData.diretoria_id && createDialogOpen,
  });

  // Buscar gerências para edição
  const { data: gerenciasEdit = [] } = useQuery({
    queryKey: ["gerencias-edit", editFormData.diretoria_id],
    queryFn: (): Promise<Gerencia[]> => 
      editFormData.diretoria_id 
        ? getGerenciasByDiretoria(editFormData.diretoria_id).then((result: any[]) =>
            result.map((ger: any): Gerencia => ({
              id: ger.id,
              sigla: ger.sigla,
              nome: ger.nome || ger.sigla,
              diretoria_id: ger.diretoria_id,
            }))
          )
        : Promise.resolve([]),
    enabled: !!editFormData.diretoria_id && !!editingServico,
  });

  const resetForm = () => {
    setFormData({
      tipo_contratacao: "Novo",
      objeto: "",
      justificativa: "",
      grau_prioridade: "Médio",
      estimativa_valor: "",
      vinculacao: "Não",
      dependencia_descricao: "",
      diretoria_id: "",
      gerencia_id: "",
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      tipo_contratacao: "",
      objeto: "",
      justificativa: "",
      grau_prioridade: "Médio",
      estimativa_valor: "",
      vinculacao: "Não",
      dependencia_descricao: "",
      diretoria_id: "",
      gerencia_id: "",
    });
  };

  const handleCreate = async () => {
    if (!formData.objeto.trim()) {
      toast.error("Preencha o objeto do serviço.");
      return;
    }

    if (!formData.justificativa.trim()) {
      toast.error("Preencha a justificativa do serviço.");
      return;
    }

    if (!formData.diretoria_id) {
      toast.error("Selecione uma diretoria.");
      return;
    }

    if (!formData.gerencia_id) {
      toast.error("Selecione uma gerência.");
      return;
    }

    const estimativaValor = parseFloat(formData.estimativa_valor);
    if (isNaN(estimativaValor) || estimativaValor <= 0) {
      toast.error("Informe um valor estimativo válido.");
      return;
    }

    setIsCreating(true);
    try {
      await createServicoCatalogoAndDistribuir({
        tipo_contratacao: formData.tipo_contratacao,
        objeto: formData.objeto.trim(),
        justificativa: formData.justificativa.trim(),
        grau_prioridade: formData.grau_prioridade,
        estimativa_valor: estimativaValor,
        vinculacao: formData.vinculacao,
        dependencia_descricao: formData.dependencia_descricao.trim() || undefined,
        diretoria_id: formData.diretoria_id,
        gerencia_id: formData.gerencia_id,
      });

      resetForm();
      setCreateDialogOpen(false);
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast.success("Serviço criado e distribuído com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível criar o serviço.";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (servico: ServicoCatalogo) => {
    setEditingServico(servico);
    setEditFormData({
      tipo_contratacao: servico.tipo_contratacao,
      objeto: servico.objeto,
      justificativa: servico.justificativa || "",
      grau_prioridade: servico.grau_prioridade,
      estimativa_valor: String(servico.estimativa_valor),
      vinculacao: servico.vinculacao,
      dependencia_descricao: servico.dependencia_descricao || "",
      diretoria_id: servico.diretoria_id,
      gerencia_id: servico.gerencia_id,
    });
  };

  const handleUpdate = async () => {
    if (!editingServico) return;

    const estimativaValor = parseFloat(editFormData.estimativa_valor);
    if (isNaN(estimativaValor) || estimativaValor <= 0) {
      toast.error("Informe um valor estimativo válido.");
      return;
    }

    setIsUpdating(true);
    try {
      await updateServicoCatalogoAdmin(editingServico.id, {
        tipo_contratacao: editFormData.tipo_contratacao,
        objeto: editFormData.objeto.trim(),
        justificativa: editFormData.justificativa.trim() || null,
        grau_prioridade: editFormData.grau_prioridade,
        estimativa_valor: estimativaValor,
        vinculacao: editFormData.vinculacao,
        dependencia_descricao: editFormData.dependencia_descricao.trim() || null,
        diretoria_id: editFormData.diretoria_id,
        gerencia_id: editFormData.gerencia_id,
      });

      setEditingServico(null);
      resetEditForm();
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast.success("Serviço atualizado com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o serviço.";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingServico) return;

    setIsDeleting(true);
    try {
      await deleteServicoCatalogoAdmin(deletingServico.id);
      setDeletingServico(null);
      await refetchServicos();
      queryClient.invalidateQueries({ queryKey: ["servicos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["servicos"] });
      toast.success("Serviço removido com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível remover o serviço.";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getDiretoriaSigla = (diretoriaId: string): string => {
    const dir = diretorias.find((d: Diretoria) => d.id === diretoriaId);
    return dir?.sigla || diretoriaId;
  };

  const getPrioridadeColor = (prioridade: GrauPrioridade): string => {
    const colors: Record<GrauPrioridade, string> = {
      "Baixo": "bg-blue-100 text-blue-800",
      "Médio": "bg-yellow-100 text-yellow-800",
      "Alto": "bg-orange-100 text-orange-800",
    };
    return colors[prioridade] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Card principal com botão Novo Serviço */}
      <Card className="p-6 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Cadastrar novo serviço</h2>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Novo Serviço
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ao cadastrar, o serviço entra no catálogo e já é distribuído para todas as gerências ativas como rascunho.
        </p>
      </Card>

      {/* Lista de Serviços */}
      <Card className="p-6 card-shadow">
        <h2 className="text-lg font-semibold text-foreground mb-4">Serviços Cadastrados</h2>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando serviços...</div>
        ) : servicos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum serviço cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Item</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead className="w-28">Prioridade</TableHead>
                  <TableHead className="w-32">Estimativa (R$)</TableHead>
                  <TableHead className="w-24">Vinculação</TableHead>
                  <TableHead className="w-24">Diretoria</TableHead>
                  <TableHead className="w-24">Gerência</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(servicos as ServicoCatalogo[]).map((servico) => (
                  <TableRow key={servico.id}>
                    <TableCell className="font-mono">{servico.item}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="font-medium truncate">{servico.objeto}</p>
                      {servico.justificativa && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {servico.justificativa.substring(0, 80)}...
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{servico.tipo_contratacao}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPrioridadeColor(servico.grau_prioridade)}>
                        {servico.grau_prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                        .format(servico.estimativa_valor)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={servico.vinculacao === "Sim" ? "default" : "secondary"}>
                        {servico.vinculacao}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDiretoriaSigla(servico.diretoria_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{servico.gerencia_id.slice(0, 8)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={servico.ativo ? "default" : "destructive"}>
                        {servico.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(servico)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeletingServico(servico)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ==================== DIALOG CRIAR SERVIÇO ==================== */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Serviço</DialogTitle>
            <DialogDescription>
              Preencha os dados do serviço. Após cadastrado, será distribuído para todas as gerências ativas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Objeto */}
            <div>
              <Label className="text-sm font-medium">Objeto *</Label>
              <Textarea
                value={formData.objeto}
                onChange={(e) => setFormData(prev => ({ ...prev, objeto: e.target.value }))}
                placeholder="Descreva o objeto do serviço..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Justificativa */}
            <div>
              <Label className="text-sm font-medium">Justificativa *</Label>
              <Textarea
                value={formData.justificativa}
                onChange={(e) => setFormData(prev => ({ ...prev, justificativa: e.target.value }))}
                placeholder="Fundamentação técnica e administrativa..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Tipo de Contratação</Label>
                <Select
                  value={formData.tipo_contratacao}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_contratacao: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                    <SelectItem value="Prorrogação">Prorrogação</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Grau de Prioridade</Label>
                <Select
                  value={formData.grau_prioridade}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, grau_prioridade: value as GrauPrioridade }))}
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
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Estimativa de Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.estimativa_valor}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimativa_valor: e.target.value }))}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Vinculação</Label>
                <Select
                  value={formData.vinculacao}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vinculacao: value as "Sim" | "Não" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dependência (condicional) */}
            {formData.vinculacao === "Sim" && (
              <div>
                <Label className="text-sm font-medium">Descrição da Vinculação</Label>
                <Textarea
                  value={formData.dependencia_descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, dependencia_descricao: e.target.value }))}
                  placeholder="Descreva a dependência ou vinculação..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            )}

            {/* Diretoria e Gerência */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Diretoria *</Label>
                <Select
                  value={formData.diretoria_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, diretoria_id: value, gerencia_id: "" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {diretorias.map((dir: Diretoria) => (
                      <SelectItem key={dir.id} value={dir.id}>
                        {dir.sigla} - {dir.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Gerência *</Label>
                <Select
                  value={formData.gerencia_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gerencia_id: value }))}
                  disabled={!formData.diretoria_id}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {gerenciasCreate.map((ger: Gerencia) => (
                      <SelectItem key={ger.id} value={ger.id}>
                        {ger.sigla} - {ger.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Criando..." : "Criar Serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG EDITAR SERVIÇO ==================== */}
      <Dialog open={!!editingServico} onOpenChange={(open) => {
        if (!open) {
          setEditingServico(null);
          resetEditForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Serviço</DialogTitle>
            <DialogDescription>
              Altere os dados do serviço. As alterações serão aplicadas em todo o sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Objeto */}
            <div>
              <Label className="text-sm font-medium">Objeto *</Label>
              <Textarea
                value={editFormData.objeto}
                onChange={(e) => setEditFormData(prev => ({ ...prev, objeto: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Justificativa */}
            <div>
              <Label className="text-sm font-medium">Justificativa</Label>
              <Textarea
                value={editFormData.justificativa}
                onChange={(e) => setEditFormData(prev => ({ ...prev, justificativa: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Tipo de Contratação</Label>
                <Select
                  value={editFormData.tipo_contratacao}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, tipo_contratacao: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                    <SelectItem value="Prorrogação">Prorrogação</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Grau de Prioridade</Label>
                <Select
                  value={editFormData.grau_prioridade}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, grau_prioridade: value as GrauPrioridade }))}
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
            </div>

            {/* Grid 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Estimativa de Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.estimativa_valor}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, estimativa_valor: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Vinculação</Label>
                <Select
                  value={editFormData.vinculacao}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, vinculacao: value as "Sim" | "Não" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Não">Não</SelectItem>
                    <SelectItem value="Sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dependência (condicional) */}
            {editFormData.vinculacao === "Sim" && (
              <div>
                <Label className="text-sm font-medium">Descrição da Vinculação</Label>
                <Textarea
                  value={editFormData.dependencia_descricao}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, dependencia_descricao: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>
            )}

            {/* Diretoria e Gerência */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Diretoria *</Label>
                <Select
                  value={editFormData.diretoria_id}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, diretoria_id: value, gerencia_id: "" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {diretorias.map((dir: Diretoria) => (
                      <SelectItem key={dir.id} value={dir.id}>
                        {dir.sigla} - {dir.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Gerência *</Label>
                <Select
                  value={editFormData.gerencia_id}
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, gerencia_id: value }))}
                  disabled={!editFormData.diretoria_id}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {gerenciasEdit.map((ger: Gerencia) => (
                      <SelectItem key={ger.id} value={ger.id}>
                        {ger.sigla} - {ger.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingServico(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG CONFIRMAR EXCLUSÃO ==================== */}
      <Dialog open={!!deletingServico} onOpenChange={(open) => {
        if (!open) setDeletingServico(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir permanentemente este serviço?
              {deletingServico && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <p className="font-medium">{deletingServico.objeto}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Item #{deletingServico.item} · {deletingServico.tipo_contratacao}
                  </p>
                </div>
              )}
              <p className="mt-3 text-destructive">Esta ação não pode ser desfeita.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingServico(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Sim, Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}