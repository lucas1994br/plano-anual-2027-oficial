import { useState, useMemo } from "react";
import { addDays } from "date-fns";
import { PlanHeader } from "@/components/layout/PlanHeader.tsx";
import { SummaryCards } from "@/components/common/SummaryCards.tsx";
import { PlanFilters } from "@/components/forms/PlanFilters.tsx";
import { PlanTable } from "@/components/tables/PlanTable.tsx";
import { PlanItem } from "@/types/plan.ts";
import { CATEGORIAS, GERENCIAS, initialItems } from "@/data/mockData.ts";

const Index = () => {
  const [items, setItems] = useState<PlanItem[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoria, setCategoria] = useState("");
  const [gerencia, setGerencia] = useState("todas");
  const [prioridade, setPrioridade] = useState("todas");

  const filteredItems = useMemo(() => {
    if (!categoria || categoria === "") {
      return [];
    }

    return items.filter((item) => {
      const matchesSearch = searchTerm === "" || item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || item.codigo.toString().includes(searchTerm);
      const matchesCategoria = item.categoria === categoria;
      const matchesGerencia = gerencia === "todas" || item.gerencia === gerencia;
      const matchesPrioridade = prioridade === "todas" || item.prioridade === prioridade;
      return matchesSearch && matchesCategoria && matchesGerencia && matchesPrioridade;
    });
  }, [items, searchTerm, categoria, gerencia, prioridade]);

  const summary = useMemo(() => {
    const totalItens = filteredItems.length;
    const valorTotal = filteredItems.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0);
    return { totalItens, valorTotal };
  }, [filteredItems]);

  const handleUpdateQtdEstimada = (codigo: number, qtdEstimada: number) => {
    setItems((prev) => prev.map((item) => (item.codigo === codigo ? { ...item, qtdEstimada } : item)));
  };

  const handleUpdateUnidade = (codigo: number, unidade: string) => {
    setItems((prev) => prev.map((item) => (item.codigo === codigo ? { ...item, unidade } : item)));
  };

  const handleUpdateObservacao = (codigo: number, observacao: string) => {
    setItems((prev) => prev.map((item) => (item.codigo === codigo ? { ...item, observacao } : item)));
  };

  const handleUpdatePrioridade = (codigo: number, prioridade: PlanItem["prioridade"]) => {
    setItems((prev) => prev.map((item) => (item.codigo === codigo ? { ...item, prioridade } : item)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <PlanHeader title="Plano Anual de Contratações" diretoria="Diretoria de Comercialização" ano={2027} prazo={addDays(new Date(), 15)} />
      <SummaryCards totalItens={summary.totalItens} valorTotal={summary.valorTotal} />
      <PlanFilters searchTerm={searchTerm} onSearchChange={setSearchTerm} categoria={categoria} onCategoriaChange={setCategoria} gerencia={gerencia} onGerenciaChange={setGerencia} prioridade={prioridade} onPrioridadeChange={setPrioridade} categorias={CATEGORIAS} gerencias={GERENCIAS} />
      {categoria === "" ? (
        <div className="px-6 py-8 text-center text-muted-foreground">Selecione uma categoria para exibir os itens.</div>
      ) : filteredItems.length === 0 ? (
        <div className="px-6 py-8 text-center text-muted-foreground">Nenhum item encontrado na categoria selecionada.</div>
      ) : (
        <PlanTable items={filteredItems} onUpdateQtdEstimada={handleUpdateQtdEstimada} onUpdateUnidade={handleUpdateUnidade} onUpdateObservacao={handleUpdateObservacao} onUpdatePrioridade={handleUpdatePrioridade} />
      )}
    </div>
  );
};

export default Index;
