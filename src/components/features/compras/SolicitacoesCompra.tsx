import { useState, useEffect } from 'react';
import erpService from '@/lib/services-erp';
import type { SolicitacaoCompra } from '@/types/erp';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface SolicitacoesCompraProps {
  diretoriaId: string;
  onSolicitacaoSelecionada?: (solicitacao: SolicitacaoCompra) => void;
}

export function SolicitacoesCompra({ diretoriaId, onSolicitacaoSelecionada }: SolicitacoesCompraProps) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mostraFormulario, setMostraFormulario] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState('');

  useEffect(() => {
    carregarSolicitacoes();
  }, [diretoriaId]);

  async function carregarSolicitacoes() {
    try {
      setCarregando(true);
      const dados = await erpService.listarSolicitacoesPorDiretoria(diretoriaId);
      setSolicitacoes(dados);
    } catch (erro) {
      console.error('Erro ao carregar solicitações:', erro);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar solicitações',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  }

  async function handleCriarSolicitacao(e: React.FormEvent) {
    e.preventDefault();

    if (!novaDescricao.trim()) {
      toast({
        title: 'Validação',
        description: 'Descrição é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCarregando(true);
      // TODO: Precisa do centro_custo_id também
      const novaSolicitacao = await erpService.criarSolicitacaoCompra(
        diretoriaId,
        'centro-custo-id', // Você precisa selecionar isso no formulário
        novaDescricao
      );

      setSolicitacoes([novaSolicitacao, ...solicitacoes]);
      setNovaDescricao('');
      setMostraFormulario(false);

      toast({
        title: 'Sucesso',
        description: 'Solicitação criada',
      });
    } catch (erro) {
      console.error('Erro ao criar solicitação:', erro);
      toast({
        title: 'Erro',
        description: 'Falha ao criar solicitação',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  }

  async function handleMudarStatus(solicitacaoId: string, novoStatus: string) {
    try {
      const solicitacaoAtualizada = await erpService.atualizarStatusSolicitacao(
        solicitacaoId,
        novoStatus
      );

      setSolicitacoes(
        solicitacoes.map(s => s.id === solicitacaoId ? solicitacaoAtualizada : s)
      );

      toast({
        title: 'Sucesso',
        description: `Status atualizado para ${novoStatus}`,
      });
    } catch (erro) {
      console.error('Erro ao atualizar status:', erro);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar status',
        variant: 'destructive',
      });
    }
  }

  const statusBadgeColor: Record<string, string> = {
    'aberta': 'bg-blue-100 text-blue-800',
    'aprovada': 'bg-green-100 text-green-800',
    'rejeitada': 'bg-red-100 text-red-800',
    'em_cotacao': 'bg-yellow-100 text-yellow-800',
    'comprada': 'bg-purple-100 text-purple-800',
    'cancelada': 'bg-gray-100 text-gray-800',
  };

  const statusProximos: Record<string, string[]> = {
    'aberta': ['aprovada', 'rejeitada', 'em_cotacao'],
    'em_cotacao': ['aprovada', 'rejeitada'],
    'aprovada': ['comprada', 'cancelada'],
    'comprada': [],
    'rejeitada': [],
    'cancelada': [],
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Solicitações de Compra</h2>
        <Button onClick={() => setMostraFormulario(!mostraFormulario)}>
          + Nova Solicitação
        </Button>
      </div>

      {/* Formulário de Nova Solicitação */}
      {mostraFormulario && (
        <Card className="p-6">
          <form onSubmit={handleCriarSolicitacao} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Descrição*</label>
              <textarea
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Descreva a solicitação de compra"
                className="w-full px-3 py-2 border rounded-md"
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={carregando}>
                {carregando ? 'Criando...' : 'Criar Solicitação'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMostraFormulario(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de Solicitações */}
      {carregando && solicitacoes.length === 0 ? (
        <div className="text-center py-8">Carregando...</div>
      ) : solicitacoes.length === 0 ? (
        <Card className="p-6 text-center text-gray-500">
          Nenhuma solicitação encontrada
        </Card>
      ) : (
        <div className="grid gap-4">
          {solicitacoes.map((solicitacao) => (
            <Card key={solicitacao.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{solicitacao.descricao}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(solicitacao.created_at || '').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Badge className={statusBadgeColor[solicitacao.status] || ''}>
                  {solicitacao.status}
                </Badge>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                <p>Centro de Custo: {solicitacao.centro_custo_id}</p>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSolicitacaoSelecionada?.(solicitacao)}
                >
                  Detalhar
                </Button>

                {statusProximos[solicitacao.status]?.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleMudarStatus(solicitacao.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-2 py-1 text-sm border rounded"
                  >
                    <option value="">Mudar Status para...</option>
                    {statusProximos[solicitacao.status].map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
