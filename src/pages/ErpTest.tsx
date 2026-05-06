// src/pages/ErpTest.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export default function ErpTest() {
  const [ano] = useState(2026);
  
  // Dados mockados para teste
  const orcamentosMock = [
    {
      id: '1',
      nome: 'CC-ADM-DG',
      valor_aprovado: 50000,
      valor_reservado: 15000,
      valor_executado: 10000,
      disponivel: 25000,
      taxa_comprometimento: 50,
    },
    {
      id: '2',
      nome: 'CC-OPER-DTI',
      valor_aprovado: 100000,
      valor_reservado: 30000,
      valor_executado: 20000,
      disponivel: 50000,
      taxa_comprometimento: 50,
    },
    {
      id: '3',
      nome: 'CC-PESSOAL-DO',
      valor_aprovado: 75000,
      valor_reservado: 45000,
      valor_executado: 15000,
      disponivel: 15000,
      taxa_comprometimento: 80,
    },
  ];

  const statusBadge = (percentual: number) => {
    if (percentual >= 90) return <Badge className="bg-red-500 text-white">Crítico</Badge>;
    if (percentual >= 75) return <Badge className="bg-yellow-500 text-white">Alto</Badge>;
    if (percentual >= 50) return <Badge className="bg-blue-500 text-white">Médio</Badge>;
    return <Badge className="bg-green-500 text-white">Baixo</Badge>;
  };

  return (
    <div className="w-full p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard de Orçamento ERP</h1>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-blue-600 text-white">
            {ano}
          </button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm">
          ✅ <strong>Sistema ERP funcionando!</strong> Este é um teste com dados mockados. 
          Configure o Supabase para ver dados reais.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {orcamentosMock.map(orcamento => (
          <Card key={orcamento.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{orcamento.nome}</h3>
                <p className="text-sm text-gray-500">Centro de Custo</p>
              </div>
              {statusBadge(orcamento.taxa_comprometimento)}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Aprovado:</span>
                <span className="font-semibold">
                  R$ {orcamento.valor_aprovado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Reservado:</span>
                <span className="text-orange-600 font-semibold">
                  R$ {orcamento.valor_reservado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Executado:</span>
                <span className="text-red-600 font-semibold">
                  R$ {orcamento.valor_executado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>

              <div className="border-t pt-3 flex justify-between text-sm font-bold">
                <span>Disponível:</span>
                <span className="text-green-600">
                  R$ {orcamento.disponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs text-gray-600 mb-1">
                Comprometimento: {orcamento.taxa_comprometimento.toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(orcamento.taxa_comprometimento, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-6 bg-gray-50 border rounded">
        <h2 className="font-bold text-lg mb-4">📊 Sistema Original Continua Funcionando</h2>
        <p className="mb-4">O sistema ERP é <strong>adicional</strong>. Suas telas originais continuam:</p>
        <div className="grid grid-cols-2 gap-2">
          <a href="/" className="text-blue-600 hover:underline">🏠 Home (Diretorias)</a>
          <a href="/admin" className="text-blue-600 hover:underline">⚙️ Admin Panel</a>
          <a href="/compras" className="text-blue-600 hover:underline">🛒 Compras</a>
          <a href="/diretoria/DG" className="text-blue-600 hover:underline">📋 Plano DG</a>
        </div>
      </div>
    </div>
  );
}