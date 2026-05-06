import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Save, RotateCcw, TrendingDown, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { getDiretoriasComDetalhes } from "@/lib/services";
import servicesERP from "@/lib/services-erp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrcamentoEditar {
  centro_custo_id: string;
  codigo: string;
  nome: string;
  valor_aprovado: number;
}

interface OrcamentoManagerProps {
  role?: string; // 'admin' | 'gerencia' | other
}

const OrcamentoManager = ({ role }: OrcamentoManagerProps) => {
  const queryClient = useQueryClient();
  const [diretoriaAtual, setDiretoriaAtual] = useState<string>("");
  const [anoAtual, setAnoAtual] = useState<number>(new Date().getFullYear());
  const [orcamentosEditando, setOrcamentosEditando] = useState<OrcamentoEditar[]>([]);
  const [orcamentosOriginais, setOrcamentosOriginais] = useState<OrcamentoEditar[]>([]);

  // Carregar diretorias
  const { data: diretorias = [] } = useQuery({
    queryKey: ["diretorias-para-orcamento"],
    queryFn: getDiretoriasComDetalhes,
  });

  // Carregar orçamento com consumo
  const { data: orcamentoDiretoria, isLoading } = useQuery({
    queryKey: ["orcamento-diretoria-consumo", diretoriaAtual, anoAtual],
    queryFn: async () => {
      if (!diretoriaAtual) return null;
      return servicesERP.obterOrcamentoDiretoriaComConsumo(diretoriaAtual, anoAtual);
    },
    enabled: !!diretoriaAtual,
  });

  // Mutation para atualizar orçamento
  const { mutate: atualizarOrcamento, isPending } = useMutation({
    mutationFn: () =>
      servicesERP.atualizarOrcamentoDiretoria(
        anoAtual,
        diretoriaAtual,
        orcamentosEditando.map(o => ({
          centro_custo_id: o.centro_custo_id,
          valor_aprovado: o.valor_aprovado,
        })),
        userRole // pass the role so edge function can check
      ),
    onSuccess: () => {
      toast.success("Orçamentos atualizados com sucesso!");
      setOrcamentosOriginais(orcamentosEditando);
      queryClient.invalidateQueries({ queryKey: ["orcamento-diretoria-consumo"] });
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar orçamento: ${String((error as { message?: string })?.message || error)}`);
    },
  });

  // Sincronizar dados quando orçamento carrega
  useEffect(() => {
    if (orcamentoDiretoria?.centros_custo && orcamentosEditando.length === 0) {
      const orcModificaveis = orcamentoDiretoria.centros_custo.map(cc => ({
        centro_custo_id: cc.id,
        codigo: cc.codigo,
        nome: cc.nome,
        valor_aprovado: cc.valor_aprovado || 0,
      }));
      setOrcamentosEditando(orcModificaveis);
      setOrcamentosOriginais(orcModificaveis);
    }
  }, [orcamentoDiretoria?.centros_custo]);

  const handleChangeValor = (centroCustoId: string, novoValor: number) => {
    setOrcamentosEditando(prev =>
      prev.map(o =>
        o.centro_custo_id === centroCustoId
          ? { ...o, valor_aprovado: novoValor }
          : o
      )
    );
  };

  const handleResetar = () => {
    setOrcamentosEditando(orcamentosOriginais);
    toast.info("Valores resetados");
  };

  // role is provided by parent (AdminPanel) based on the access code
  const userRole = role;
  const podeEditar = userRole === 'admin' || userRole === 'gerencia';

  const handleSalvar = () => {
    if (!diretoriaAtual) {
      toast.error("Selecione uma diretoria");
      return;
    }
    if (!podeEditar) {
      toast.error("Você não tem permissão para editar orçamentos");
      return;
    }
    atualizarOrcamento();
  };

  const temMudancas = JSON.stringify(orcamentosEditando) !== JSON.stringify(orcamentosOriginais);

  // se a pessoa não pode editar, não permitir "Salvar"
  const botaoDisabled = !temMudancas || !podeEditar;

  // Se nenhuma diretoria foi selecionada
  if (!diretoriaAtual) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Gerenciar Orçamentos</CardTitle>
          <CardDescription>Configure os orçamentos anuais por diretoria e visualize consumo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Selecione uma Diretoria</Label>
              <Select value={diretoriaAtual} onValueChange={setDiretoriaAtual}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Escolha a diretoria..." />
                </SelectTrigger>
                <SelectContent>
                  {diretorias.map(dir => (
                    <SelectItem key={dir.id} value={dir.id}>
                      {dir.sigla} - {dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-gray-500">Carregando orçamento...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const diretoriaSelecionada = diretorias.find(d => d.id === diretoriaAtual);

  return (
    <div className="w-full space-y-6">
      {/* Header com Informações */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                {diretoriaSelecionada?.sigla} - {diretoriaSelecionada?.nome}
              </CardTitle>
              <CardDescription>Visualize e gerencie os saldos orçamentários</CardDescription>
            </div>
            <Badge variant="outline">{anoAtual}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Seleção de Diretoria e Ano */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="diretoria">Diretoria</Label>
          <Select value={diretoriaAtual} onValueChange={setDiretoriaAtual}>
            <SelectTrigger id="diretoria" className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {diretorias.map(dir => (
                <SelectItem key={dir.id} value={dir.id}>
                  {dir.sigla} - {dir.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ano">Ano</Label>
          <Input
            id="ano"
            type="number"
            value={anoAtual}
            onChange={(e) => setAnoAtual(parseInt(e.target.value))}
            className="mt-2"
          />
        </div>
      </div>

      {/* Resumo do Saldo Total */}
      {orcamentoDiretoria && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-600">Orçamento Total Aprovado</p>
                <p className="text-2xl font-bold text-blue-900">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(orcamentoDiretoria.valor_total_aprovado || 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-600 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  Total Consumido
                </p>
                <p className="text-2xl font-bold text-red-900">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(orcamentoDiretoria.valor_total_executado || 0)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-600">Saldo Disponível</p>
                <p className="text-2xl font-bold text-green-900">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(orcamentoDiretoria.saldo_total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Abas: Configurar vs Histórico */}
      <Tabs defaultValue="configurar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configurar">Configurar Orçamentos</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Consumo</TabsTrigger>
        </TabsList>

        {/* Aba: Configurar Orçamentos */}
        <TabsContent value="configurar" className="space-y-4">
          {orcamentosEditando.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Centros de Custo</CardTitle>
                <CardDescription>Edite os valores aprovados para cada centro de custo</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Valor Aprovado</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orcamentosEditando.map((orc) => {
                      const original = orcamentosOriginais.find(
                        o => o.centro_custo_id === orc.centro_custo_id
                      );
                      const mudou = original?.valor_aprovado !== orc.valor_aprovado;
                      const centroCustoData = orcamentoDiretoria?.centros_custo.find(
                        cc => cc.id === orc.centro_custo_id
                      );

                      return (
                        <TableRow key={orc.centro_custo_id} className={mudou ? "bg-yellow-50" : ""}>
                          <TableCell className="font-medium">{orc.nome}</TableCell>
                          <TableCell className="text-sm text-gray-600">{orc.codigo}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="font-mono">
                              {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              }).format(centroCustoData?.saldo || 0)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={orc.valor_aprovado}
                              onChange={(e) =>
                                handleChangeValor(
                                  orc.centro_custo_id,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              placeholder="0.00"
                              className="w-40 text-right"
                              disabled={isPending}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {mudou && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                Alterado
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Botões de Ação */}
                <div className="flex flex-col gap-2 pt-4 border-t mt-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSalvar}
                      disabled={botaoDisabled || isPending}
                      className="flex-1"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isPending ? "Salvando..." : "Salvar Orçamentos"}
                    </Button>
                    <Button
                      onClick={handleResetar}
                      disabled={!temMudancas || isPending}
                      variant="outline"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Resetar
                    </Button>
                  </div>
                  {!podeEditar && (
                    <Badge variant="destructive" className="self-start">
                      Somente admin/gerência pode editar
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum centro de custo encontrado</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba: Histórico de Consumo */}
        <TabsContent value="historico" className="space-y-4">
          {orcamentoDiretoria?.centros_custo && orcamentoDiretoria.centros_custo.length > 0 ? (
            <div className="space-y-4">
              {orcamentoDiretoria.centros_custo.map((centro) => (
                <Card key={centro.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{centro.nome}</CardTitle>
                        <CardDescription className="text-xs mt-1">{centro.codigo}</CardDescription>
                      </div>
                      <Badge variant="outline">
                        Saldo: {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(centro.saldo || 0)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {centro.historico && centro.historico.length > 0 ? (
                      <div className="space-y-2">
                        {centro.historico.map((consumo, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                            <div className="flex items-center gap-3 flex-1">
                              <TrendingDown className="w-4 h-4 text-red-600" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">Consumo</p>
                                <p className="text-xs text-gray-500">
                                  {consumo.created_at ? format(new Date(consumo.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Data não disponível"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">
                                -{new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(consumo.valor || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-gray-500">Nenhum consumo registrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum histórico disponível</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrcamentoManager;
