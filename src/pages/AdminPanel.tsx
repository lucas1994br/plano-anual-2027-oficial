import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DIRETORIA_GERENCIAS: Record<string, string[]> = {
  "DG": ["GCFI", "GCON", "GEPE", "GESL", "GSAD"],
  "DE": ["EMAR", "EOBR", "EPRE", "EPRO"],
  "DC": ["CCRC", "CCRF", "CCRR"],
  "DO": ["ODCD", "OCNI", "OCNA", "OCNE", "OCNM", "OCND", "OCNC", "OCNP", "OCNB", "OCSZ", "OCSC", "OCSD", "OCSJ", "OCSI", "OCSU", "OCST"],
  "PR": ["ASCOM", "AUDIT", "PRJ", "PRL", "PRO", "PRR", "UEP", "UTIN"]
};
import { ArrowLeft, Calendar, Save, Shield, Users, Clock, RefreshCw, Plus } from "lucide-react";
import { Button } from "../components/ui/button.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Card } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.tsx";
import { AccessCodeScreen } from "../components/ui/AccessCodeScreen.tsx";
import { AdminBudgetControl } from "../components/features/admin/AdminBudgetControl.tsx";
import { AdminCatalogItemControl } from "../components/features/admin/AdminCatalogItemControl.tsx";
import { AdminServicosControl } from "../components/features/admin/AdminServicosControl.tsx";
import { getDiretoriasComDetalhes, getTodosPeriodos, createPeriodo, updatePeriodo, cleanupDuplicatePeriodos } from "../lib/services.ts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Periodo {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  ativo: boolean;
}

interface Diretoria {
  id: string;
  sigla: string;
  nome: string;
  totalItens: number;
  totalGerencias: number;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedDir, setExpandedDir] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const { data: diretorias = [], isLoading: isLoadingDiretorias } = useQuery({
    queryKey: ["diretorias-detalhes"],
    queryFn: getDiretoriasComDetalhes,
    enabled: authenticated,
  });

  const { data: periodosRaw = [], isLoading: isLoadingPeriodos, refetch: refetchPeriodos } = useQuery({
    queryKey: ["todos-periodos"],
    queryFn: getTodosPeriodos,
    enabled: authenticated,
    staleTime: 0,
    gcTime: 0,
  });

  const periodos = periodosRaw as unknown as Periodo[];

  const [novoPeriodo, setNovoPeriodo] = useState({ nome: "", inicio: "", fim: "" });
  const [isCreatingPeriodo, setIsCreatingPeriodo] = useState(false);
  const [editingPeriodoId, setEditingPeriodoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", inicio: "", fim: "" });
  const [isUpdatingPeriodo, setIsUpdatingPeriodo] = useState(false);

  useEffect(() => {
    if (authenticated) {
      queryClient.refetchQueries({ queryKey: ["todos-periodos"] });
      queryClient.refetchQueries({ queryKey: ["diretorias-detalhes"] });
    }
  }, [authenticated, queryClient]);

  const handleAddPeriodo = async () => {
    if (!novoPeriodo.nome || !novoPeriodo.inicio || !novoPeriodo.fim) {
      toast.error("Preencha todos os campos do período.");
      return;
    }
    
    const inicioDate = new Date(novoPeriodo.inicio);
    const fimDate = new Date(novoPeriodo.fim);
    
    if (inicioDate >= fimDate) {
      toast.error("A data de fim deve ser posterior à data de início.");
      return;
    }

    setIsCreatingPeriodo(true);
    try {
      await createPeriodo({
        nome: novoPeriodo.nome,
        inicio: novoPeriodo.inicio,
        fim: novoPeriodo.fim,
      });
      setNovoPeriodo({ nome: "", inicio: "", fim: "" });
      await refetchPeriodos();
      toast.success("Período criado com sucesso!");
    } catch (error) {
      console.error("Erro ao criar período:", error);
      toast.error("Erro ao criar período.");
    } finally {
      setIsCreatingPeriodo(false);
    }
  };

  const handleStartEditPeriodo = (periodo: Periodo) => {
    setEditingPeriodoId(periodo.id);
    setEditForm({
      nome: periodo.nome,
      inicio: periodo.inicio,
      fim: periodo.fim,
    });
  };

  const handleSaveEditPeriodo = async () => {
    if (!editingPeriodoId) return;
    
    const inicioDate = new Date(editForm.inicio);
    const fimDate = new Date(editForm.fim);
    
    if (inicioDate >= fimDate) {
      toast.error("A data de fim deve ser posterior à data de início.");
      return;
    }

    setIsUpdatingPeriodo(true);
    try {
      await updatePeriodo(editingPeriodoId, editForm);
      await queryClient.invalidateQueries({ queryKey: ["todos-periodos"] });
      await refetchPeriodos();
      setEditingPeriodoId(null);
      toast.success("Período atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar período:", error);
      const message = error instanceof Error ? error.message : "Erro ao atualizar período.";
      toast.error(message);
    } finally {
      setIsUpdatingPeriodo(false);
    }
  };

  const handleCleanupPeriodos = async () => {
    try {
      await cleanupDuplicatePeriodos();
      toast.success("Períodos limpos! Recarregando...");
      setTimeout(() => {
        queryClient.clear();
        globalThis.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Erro ao limpar períodos:", error);
      toast.error("Erro ao limpar períodos.");
    }
  };

  if (!authenticated) {
    return (
      <AccessCodeScreen
        title="Administração do Sistema"
        subtitle="Controle de períodos e configurações"
        gradientClass="from-gray-800 to-gray-950"
        icon="⚙️"
        onAccessGranted={() => setAuthenticated(true)}
        onBack={() => navigate("/")}
        scope="admin"
      />
    );
  }

  const periodoAtivo = periodos.find((p: Periodo) => p.ativo);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{ top: "200px" }}
      >
        <img
          src="/assets/images/caema-logo.png"
          alt="CAEMA"
          className="w-full max-w-3xl opacity-[0.08]"
        />
      </div>
      <div className="relative z-10">
        <div className="px-6 py-3 bg-card border-b">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Badge variant="outline" className="text-xs gap-1">
              <Shield className="h-3 w-3" /> Administrador
            </Badge>
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-800 to-gray-950 px-6 py-6">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Painel Administrativo</h1>
              <p className="text-white/80 text-sm">Controle de períodos, acessos e configurações do PAC 2027</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6">
          <Tabs defaultValue="periodos" className="w-full">
            <TabsList className="mb-5">
              <TabsTrigger value="periodos">Períodos e Diretorias</TabsTrigger>
              <TabsTrigger value="orcamento">Orçamentos</TabsTrigger>
              <TabsTrigger value="catalogo">Aquisição</TabsTrigger>
              <TabsTrigger value="servicos">Serviços</TabsTrigger>
            </TabsList>

            <TabsContent value="periodos" className="space-y-6">
              <Card className="p-6 card-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Período Ativo
                  </h2>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        refetchPeriodos();
                        queryClient.refetchQueries({ queryKey: ["diretorias-detalhes"] });
                        toast.success("Dados recarregados!");
                      }}
                      className="gap-1"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Atualizar
                    </Button>
                    {periodos.length > 1 && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={handleCleanupPeriodos}
                      >
                        Limpar {periodos.length} períodos
                      </Button>
                    )}
                  </div>
                </div>

                {isLoadingPeriodos ? (
                  <div className="text-center text-muted-foreground py-4">Carregando período...</div>
                ) : periodos.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">Nenhum período ativo.</div>
                ) : (
                  <>
                    {periodoAtivo && (
                      <div className="p-4 rounded-lg border-2 border-success/20 bg-success/5">
                        {editingPeriodoId === periodoAtivo.id ? (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="edit-nome" className="text-sm">Nome do Período</Label>
                              <Input
                                id="edit-nome"
                                value={editForm.nome}
                                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="edit-inicio" className="text-sm">Data Início</Label>
                                <Input
                                  id="edit-inicio"
                                  type="date"
                                  value={editForm.inicio}
                                  onChange={(e) => setEditForm({ ...editForm, inicio: e.target.value })}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-fim" className="text-sm">Data Fim</Label>
                                <Input
                                  id="edit-fim"
                                  type="date"
                                  value={editForm.fim}
                                  onChange={(e) => setEditForm({ ...editForm, fim: e.target.value })}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm"
                                onClick={handleSaveEditPeriodo}
                                disabled={isUpdatingPeriodo}
                                className="gap-2"
                              >
                                <Save className="h-4 w-4" />
                                {isUpdatingPeriodo ? "Salvando..." : "Salvar"}
                              </Button>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingPeriodoId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-lg text-foreground">{periodoAtivo.nome}</p>
                              <p className="text-sm text-muted-foreground mt-2">
                                <Clock className="h-4 w-4 inline mr-2" />
                                {format(new Date(periodoAtivo.inicio + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} até{" "}
                                {format(new Date(periodoAtivo.fim + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-success text-success-foreground">Ativo</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEditPeriodo(periodoAtivo)}
                              >
                                Editar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>

              <Card className="p-6 card-shadow">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Plus className="h-5 w-5 text-primary" />
                  Adicionar Novo Período
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="add-nome">Nome do Período</Label>
                    <Input
                      id="add-nome"
                      placeholder="Ex: PAC 2028 - Preenchimento Anual"
                      value={novoPeriodo.nome}
                      onChange={(e) => setNovoPeriodo({ ...novoPeriodo, nome: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="add-inicio">Data de Início</Label>
                      <Input
                        id="add-inicio"
                        type="date"
                        value={novoPeriodo.inicio}
                        onChange={(e) => setNovoPeriodo({ ...novoPeriodo, inicio: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="add-fim">Data de Término</Label>
                      <Input
                        id="add-fim"
                        type="date"
                        value={novoPeriodo.fim}
                        onChange={(e) => setNovoPeriodo({ ...novoPeriodo, fim: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleAddPeriodo}
                    disabled={isCreatingPeriodo || !novoPeriodo.nome || !novoPeriodo.inicio || !novoPeriodo.fim}
                    className="w-full"
                  >
                    {isCreatingPeriodo ? "Criando..." : "Criar Período"}
                  </Button>
                </div>
              </Card>

              <Card className="p-6 card-shadow">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-primary" />
                  Visão Geral das Diretorias
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {isLoadingDiretorias ? (
                    <div className="col-span-full text-center text-muted-foreground">Carregando diretorias...</div>
                  ) : diretorias.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground">Nenhuma diretoria encontrada.</div>
                  ) : (
                    diretorias.map((dir: Diretoria) => (
                      <React.Fragment key={dir.sigla}>
                        <div 
                          className={`flex items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group ${expandedDir === dir.sigla ? 'ring-2 ring-primary border-primary' : ''}`}
                          onClick={() => setExpandedDir(expandedDir === dir.sigla ? null : dir.sigla)}
                        >
                          <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-bold">{dir.sigla}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{dir.nome}</p>
                            <div className="flex gap-3 mt-2 text-xs font-medium">
                              <span className="text-primary">{dir.totalItens} itens</span>
                              <span className="text-blue-600">{dir.totalGerencias} gerências</span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/diretoria/${dir.id}`); }}
                            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          >
                            Ir para Dashboard
                          </Button>
                        </div>

                        {expandedDir === dir.sigla && (
                          <div className="col-span-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200 mt-2 animate-in fade-in slide-in-from-top-2">
                            <div className="col-span-full flex items-center justify-between mb-1">
                               <span className="text-sm font-semibold text-slate-700">
                                 Selecione a Gerência (Visão Específica)
                               </span>
                               <Button variant="link" size="sm" onClick={() => navigate(`/admin/diretoria/${dir.id}`)} className="text-xs text-indigo-600">
                                 Acessar Visão Geral ({dir.sigla})
                               </Button>
                            </div>
                            {(DIRETORIA_GERENCIAS[dir.sigla] || ["Geral"]).map(ger => (
                              <div 
                                key={ger} 
                                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-white shadow-sm hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer group text-center"
                                onClick={() => navigate(`/admin/diretoria/${dir.id}?gerencia=${encodeURIComponent(ger)}`)}
                              >
                                <Badge variant="outline" className="text-indigo-700 bg-indigo-50 border-indigo-200 text-sm font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                  {ger.split(" - ")[0]}
                                </Badge>
                                <span className="text-xs text-slate-500 font-medium line-clamp-2">
                                  {ger.split(" - ")[1] || ger}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="orcamento">
              <AdminBudgetControl
                diretorias={diretorias.map((dir: Diretoria) => ({
                  id: dir.id,
                  sigla: dir.sigla,
                  nome: dir.nome,
                }))}
              />
            </TabsContent>

            <TabsContent value="catalogo">
              <AdminCatalogItemControl />
            </TabsContent>

            <TabsContent value="servicos">
              <AdminServicosControl />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;