import { useState, useEffect } from 'react';
import erpService from '@/lib/services-erp.ts';
import type { OrcamentoDisponivel } from '@/types/erp.ts';
import { Card } from '@/components/ui/card.tsx';
import { Badge } from '@/components/ui/badge.tsx';

export function OrcamentoDashboard() {
  const [ano, setAno] = useState(2026);
  const [orcamentos, setOrcamentos] = useState<OrcamentoDisponivel[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarOrcamentos();
  }, [ano]);

  async function carregarOrcamentos() {
    try {
      setCarregando(true);
      const dados = await erpService.listarOrcamentosPorAno(ano);
      
      // Montar os dados com cálculos
      
      const orcamentosFormatados = dados.map(o => {
        const disponivel = o.valor_aprovado - o.valor_reservado - o.valor_executado;
        const taxa_execucao_pct = (o.valor_executado / o.valor_aprovado) * 100;
        const taxa_comprometimento_pct = ((o.valor_reservado + o.valor_executado) / o.valor_aprovado) * 100;
        
        return {
          ...o,
          disponivel,
          taxa_execucao_pct,
          taxa_comprometimento_pct,
        } as OrcamentoDisponivel;
      });
      
      setOrcamentos(orcamentosFormatados);
    } catch (erro) {
      console.error('Erro ao carregar orçamentos:', erro);
    } finally {
      setCarregando(false);
    }
  }

  const statusBadge = (percentual: number) => {
    if (percentual >= 90) return <Badge className="bg-red-500">Crítico</Badge>;
    if (percentual >= 75) return <Badge className="bg-yellow-500">Alto</Badge>;
    if (percentual >= 50) return <Badge className="bg-blue-500">Médio</Badge>;
    return <Badge className="bg-green-500">Baixo</Badge>;
  };

  return (
    <div className="w-full p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard de Orçamento</h1>
        <div className="flex gap-2">
          {[2026, 2027].map(y => (
            <button
              key={y}
              onClick={() => setAno(y)}
              className={`px-4 py-2 rounded ${
                ano === y 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {orcamentos.map(orcamento => (
            <Card key={orcamento.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{orcamento.centro_custo_id}</h3>
                  <p className="text-sm text-gray-500">Centro de Custo</p>
                </div>
                {statusBadge(orcamento.taxa_comprometimento_pct)}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Aprovado:</span>
                  <span className="font-semibold">R$ {orcamento.valor_aprovado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Reservado:</span>
                  <span className="text-orange-600 font-semibold">R$ {orcamento.valor_reservado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>Executado:</span>
                  <span className="text-red-600 font-semibold">R$ {orcamento.valor_executado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>

                <div className="border-t pt-3 flex justify-between text-sm font-bold">
                  <span>Disponível:</span>
                  <span className="text-green-600">R$ {orcamento.disponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="mt-4">
                <div className="text-xs text-gray-600 mb-1">Comprometimento: {orcamento.taxa_comprometimento_pct.toFixed(1)}%</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(orcamento.taxa_comprometimento_pct, 100)}%` }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
