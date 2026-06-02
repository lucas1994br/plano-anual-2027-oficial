import { useState, useEffect } from 'react';
import erpService from '@/lib/services-erp.ts';
import type { CategoriaItem, PlanoItem } from '@/types/erp.ts';
import { Card } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { CurrencyInput } from '@/components/ui/currency-input.tsx';
import { toast } from '@/hooks/use-toast.ts';

interface PlanejamentoFormProps {
  planoDiretoriaId: string;
  onItemAdicionado?: (item: PlanoItem) => void;
}

export function PlanejamentoForm({ planoDiretoriaId, onItemAdicionado }: PlanejamentoFormProps) {
  const [itens, setItens] = useState<PlanoItem[]>([]);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Form
  const [form, setForm] = useState<{
    item_catalogo_id: string;
    quantidade_prevista: number;
    valor_unit_previsto: number;
    justificativa: string;
    prioridade: 1 | 2 | 3;
    meta_mes: number;
  }>({
    item_catalogo_id: '',
    quantidade_prevista: 0,
    valor_unit_previsto: 0,
    justificativa: '',
    prioridade: 2,
    meta_mes: 1,
  });

  useEffect(() => {
    carregarDados();
  }, [planoDiretoriaId]);

  async function carregarDados() {
    try {
      const [itemsData, categoriasData] = await Promise.all([
        erpService.listarPlanosItens(planoDiretoriaId),
        erpService.listarCategorias(),
      ]);
      setItens(itemsData);
      setCategorias(categoriasData);
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados',
        variant: 'destructive',
      });
    }
  }

  async function handleAdicionarItem(e: React.FormEvent) {
    e.preventDefault();
    
    if (!form.item_catalogo_id || form.quantidade_prevista <= 0) {
      toast({
        title: 'Validação',
        description: 'Preencha tous os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCarregando(true);
      const novoItem = await erpService.criarPlanoItem({
        plano_diretoria_id: planoDiretoriaId,
        item_catalogo_id: form.item_catalogo_id,
        quantidade_prevista: form.quantidade_prevista,
        valor_unit_previsto: form.valor_unit_previsto || undefined,
        justificativa: form.justificativa || undefined,
        prioridade: form.prioridade,
        meta_mes: form.meta_mes || undefined,
        centro_custo_id: '', // Será preenchido pela regra automaticamente
      });

      setItens([...itens, novoItem]);
      setForm({
        item_catalogo_id: '',
        quantidade_prevista: 0,
        valor_unit_previsto: 0,
        justificativa: '',
        prioridade: 2,
        meta_mes: 1,
      });

      toast({
        title: 'Sucesso',
        description: 'Item adicionado ao plano',
      });

      onItemAdicionado?.(novoItem);
    } catch (erro) {
      console.error('Erro ao adicionar item:', erro);
      toast({
        title: 'Erro',
        description: 'Falha ao adicionar item',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  }

  async function handleDeletarItem(itemId: string) {
    try {
      await erpService.deletarPlanoItem(itemId);
      setItens(itens.filter(i => i.id !== itemId));
      toast({
        title: 'Sucesso',
        description: 'Item removido',
      });
    } catch (erro) {
      console.error('Erro ao deletar item:', erro);
      toast({
        title: 'Erro',
        description: 'Falha ao remover item',
        variant: 'destructive',
      });
    }
  }

  const prioridadeLabels = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Adicionar Item ao Plano</h2>
        <form onSubmit={handleAdicionarItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Item Catálogo*</label>
              <select
                value={form.item_catalogo_id}
                onChange={(e) => setForm({ ...form, item_catalogo_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Selecione um item</option>
                {/* Aqui você carrega os itens do catálogo */}
                <option value="1">Item 1 - Papel A4</option>
                <option value="2">Item 2 - Caneta Azul</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Quantidade*</label>
              <Input
                type="number"
                min="1"
                value={form.quantidade_prevista}
                onChange={(e) => setForm({ ...form, quantidade_prevista: Number(e.target.value) })}
                placeholder="Ex: 100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Valor Unitário</label>
              <CurrencyInput
                value={form.valor_unit_previsto}
                onChange={(e) => setForm({ ...form, valor_unit_previsto: Number(e.target.value) })}
                placeholder="Ex: 50,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Prioridade</label>
              <select
                value={form.prioridade}
                onChange={(e) => setForm({ ...form, prioridade: Number(e.target.value) as 1 | 2 | 3 })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="1">Alta</option>
                <option value="2">Média</option>
                <option value="3">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mês de Execução</label>
              <select
                value={form.meta_mes}
                onChange={(e) => setForm({ ...form, meta_mes: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={m}>{new Date(2026, m-1).toLocaleString('pt-BR', {month: 'long'})}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Justificativa</label>
            <textarea
              value={form.justificativa}
              onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
              placeholder="Por que este item é necessário?"
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={carregando}>
            {carregando ? 'Adicionando...' : 'Adicionar Item'}
          </Button>
        </form>
      </Card>

      {/* Lista de Itens */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Itens do Plano ({itens.length})</h2>
        {itens.length === 0 ? (
          <p className="text-gray-500">Nenhum item adicionado ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Quantidade</th>
                  <th className="px-4 py-2 text-left">Valor Unit.</th>
                  <th className="px-4 py-2 text-left">Total</th>
                  <th className="px-4 py-2 text-left">Prioridade</th>
                  <th className="px-4 py-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{item.item_catalogo_id}</td>
                    <td className="px-4 py-2">{item.quantidade_prevista}</td>
                    <td className="px-4 py-2">
                      {item.valor_unit_previsto ? `R$ ${item.valor_unit_previsto.toLocaleString('pt-BR')}` : '-'}
                    </td>
                    <td className="px-4 py-2">
                      {item.valor_unit_previsto 
                        ? `R$ ${(item.quantidade_prevista * item.valor_unit_previsto).toLocaleString('pt-BR')}`
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {prioridadeLabels[item.prioridade || 2] || 'Média'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => item.id && handleDeletarItem(item.id)}
                      >
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {itens.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="font-bold">
              Total Planejado: R$ {itens.reduce((sum, item) => sum + (item.valor_unit_previsto ? item.quantidade_prevista * item.valor_unit_previsto : 0), 0).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
