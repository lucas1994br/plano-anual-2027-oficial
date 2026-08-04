import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Shield, Home } from "lucide-react";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PlanHeader } from "@/components/layout/PlanHeader.tsx";
import { SummaryCards } from "@/components/common/SummaryCards.tsx";
import { PlanFilters } from "@/components/forms/PlanFilters.tsx";
import { PlanTable } from "@/components/tables/PlanTable.tsx";
import { Diretoria, Gerencia } from "@/types/plan.ts";
import { PlanItem } from "@/types/plan.ts";
import { resolveGerenciaNome } from "@/data/gerencias.ts";
import getItensCatalogo, { getDiretorias, getGerenciasByDiretoria, getPeriodosAtivos, getSolicitacoesByDiretoria } from "@/lib/services.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import DOMPurify from 'dompurify';
type TipoPlano = "aquisicao" | "servicos" | null;

// Mapeamento de ícones por sigla
const getIconPath = (sigla: string) => {
  const iconMap: Record<string, string> = {
    'DC': '/assets/images/dc2.png',
    'DE': '/assets/images/de2.png',
    'DG': '/assets/images/gd2.png',
    'DO': '/assets/images/do2.png',
    'PR': '/assets/images/pr2.png'
  };
  return iconMap[sigla] || null;
};

const DiretoriaPlano = () => {
  const { sigla } = useParams<{ sigla: string }>();
  const navigate = useNavigate();
  const siglaUpper = (sigla || "").toUpperCase();

  const [tipoPlano, setTipoPlano] = useState<TipoPlano>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoria, setCategoria] = useState("");
  const [gerencia, setGerencia] = useState("todas");
  const [prioridade, setPrioridade] = useState("todas");

  // Buscar diretoria
  const { data: diretorias = [] } = useQuery<any[]>({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
  });

  const diretoria = (diretorias as any[]).find((d: any) => d.sigla === siglaUpper);

  // Buscar gerências
  const { data: gerenciasData = [] } = useQuery<any[]>({
    queryKey: ["gerencias", diretoria?.id],
    queryFn: () => diretoria ? getGerenciasByDiretoria(diretoria.id) : Promise.resolve([]),
    enabled: !!diretoria,
  });

  const { data: periodos = [] } = useQuery<any[]>({
    queryKey: ["periodos"],
    queryFn: getPeriodosAtivos,
  });

  const periodAtivo = periodos[0];
  const prazo = periodAtivo ? new Date(periodAtivo.fim as string) : null;

  const queryClient = useQueryClient();

  useEffect(() => {
    if (diretoria?.id && periodAtivo?.id) {
      queryClient.prefetchQuery({
        queryKey: ["solicitacoes-diretoria", diretoria.id, periodAtivo.id],
        queryFn: () => getSolicitacoesByDiretoria(diretoria.id, periodAtivo.id),
      });
      queryClient.prefetchQuery({
        queryKey: ["itens-catalogo"],
        queryFn: getItensCatalogo,
      });
    }
  }, [diretoria, periodAtivo, queryClient]);

  // Dados mockados por enquanto
  const items: PlanItem[] = [];
  const categorias: string[] = [];

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = searchTerm === "" || item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || item.codigo.toString().includes(searchTerm);
      const matchesCategoria = item.categoria === categoria;
      const matchesGerencia = gerencia === "todas" || item.gerencia === gerencia;
      const matchesPrioridade = prioridade === "todas" || item.prioridade === prioridade;
      return matchesSearch && matchesCategoria && matchesGerencia && matchesPrioridade;
    });
  }, [items, searchTerm, categoria, gerencia, prioridade]);

  const summary = useMemo(() => ({
    totalItens: items.length,
    valorTotal: items.reduce((acc, item) => acc + item.qtdEstimada * item.valorUnitario, 0),
  }), [items]);

  const gerenciasSemDiretoria = useMemo(
    () => (gerenciasData as any[]).filter((ger: any) => ger.sigla !== siglaUpper),
    [gerenciasData, siglaUpper]
  );

  const doGerenciasAgrupadas = useMemo(() => {
    if (siglaUpper !== "DO") return [];

    const gruposBase = [
      { titulo: "Sede", siglas: ["ODCD"] },
      { titulo: "Norte", siglas: ["OCNI", "OCNA", "OCNE", "OCNM", "OCND", "OCNC", "OCNP", "OCNB"] },
      { titulo: "Sul", siglas: ["OCSZ", "OCSC", "OCSD", "OCSJ", "OCSI", "OCSU", "OCST"] },
    ];

    const porSigla = new Map(gerenciasSemDiretoria.map((g: any) => [g.sigla, g]));

    const grupos = gruposBase.map((grupo) => ({
      titulo: grupo.titulo,
      gerencias: grupo.siglas.map((sigla) => porSigla.get(sigla)).filter(Boolean) as any[],
    }));

    const siglasConhecidas = new Set(gruposBase.flatMap((g) => g.siglas));
    const outras = gerenciasSemDiretoria
      .filter((g: any) => !siglasConhecidas.has(g.sigla))
      .sort((a: any, b: any) => a.sigla.localeCompare(b.sigla));

    if (outras.length > 0) {
      grupos.push({ titulo: "Outras", gerencias: outras });
    }

    return grupos.filter((grupo) => grupo.gerencias.length > 0);
  }, [gerenciasSemDiretoria, siglaUpper]);

  const handleUpdateQtdEstimada = (codigo: number, qtdEstimada: number) => {
    // TODO: Atualizar no Supabase
  };
  const handleUpdateUnidade = (codigo: number, unidade: string) => {
    // TODO: Atualizar no Supabase
  };
  const handleUpdateObservacao = (codigo: number, observacao: string) => {
    // TODO: Atualizar no Supabase
  };
  const handleUpdatePrioridade = (codigo: number, prioridade: PlanItem["prioridade"]) => {
    // TODO: Atualizar no Supabase
  };

  if (!diretoria) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Diretoria não encontrada</h1>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  if (!tipoPlano) {
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
        <PageBreadcrumb
          onBack={() => navigate("/")}
          onHome={() => navigate("/")}
          crumbs={[
            { label: diretoria.sigla },
          ]}
        />
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              {getIconPath(diretoria.sigla) && (
                <img src={getIconPath(diretoria.sigla)!} alt={diretoria.sigla} className="h-10 w-10 object-contain" />
              )}
              <Badge className="bg-white/20 text-white border-none text-lg font-bold">
                {diretoria.sigla}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{diretoria.nome}</h1>
            <p className="text-white/80">Plano Anual de Contratações 2027</p>
          </div>
        </div>

        {/* Acesso por Gerência */}
        <div className="max-w-3xl mx-auto px-6 pt-8">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            Acesso por Gerência
          </h2>
          {siglaUpper === "DO" ? (
            <div className="space-y-5 mb-6">
              {doGerenciasAgrupadas.map((grupo) => (
                <div key={grupo.titulo}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">DO - {grupo.titulo}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {grupo.gerencias.length} gerências
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {grupo.gerencias.map((ger: any) => (
                      <Card
                        key={ger.id}
                        className="p-4 card-shadow cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 text-center"
                        onClick={() => navigate(`/diretoria/${sigla}/gerencia/${ger.sigla.toLowerCase()}`)}
                      >
                        <Badge variant="outline" className="text-sm font-bold mb-1">{ger.sigla}</Badge>
                        <p className="text-xs text-muted-foreground line-clamp-2">{resolveGerenciaNome(ger.sigla, ger.nome)}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {gerenciasSemDiretoria.map((ger: any) => (
                <Card
                  key={ger.id}
                  className="p-4 card-shadow cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 text-center"
                  onClick={() => navigate(`/diretoria/${sigla}/gerencia/${ger.sigla.toLowerCase()}`)}
                >
                  <Badge variant="outline" className="text-sm font-bold mb-1">{ger.sigla}</Badge>
                  <p className="text-xs text-muted-foreground line-clamp-2">{resolveGerenciaNome(ger.sigla, ger.nome)}</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Aprovação da Diretoria */}
        <div className="max-w-3xl mx-auto px-6 pb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            Acesso por Diretoria
          </h2>
          <Card
            className="p-4 card-shadow cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
            onClick={() => navigate(`/diretoria/${sigla}/aprovacao`)}
          >
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-lg">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">Painel de Aprovação - Diretoria</h3>
                <p className="text-xs text-muted-foreground">Aprovar ou rejeitar solicitações das gerências</p>
              </div>
            </div>
          </Card>
        </div>

        </div>
      </div>
    );
  }

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
      <PageBreadcrumb
        onBack={() => navigate("/")}
        onHome={() => navigate("/")}
        crumbs={[
          { label: diretoria.sigla },
          { label: tipoPlano === "aquisicao" ? "Aquisição" : "Serviços", isActive: true },
        ]}
      />
      <PlanHeader title="Plano Anual de Contratações" diretoria={`${diretoria.sigla} - ${diretoria.nome}`} ano={2026} prazo={prazo} />
      <SummaryCards totalItens={summary.totalItens} valorTotal={summary.valorTotal} />
      <PlanFilters searchTerm={searchTerm} onSearchChange={setSearchTerm} categoria={categoria} onCategoriaChange={setCategoria} gerencia={gerencia} onGerenciaChange={setGerencia} prioridade={prioridade} onPrioridadeChange={setPrioridade} categorias={categorias} gerencias={(gerenciasData as any[]).map((g: any) => g.sigla)} />
      <PlanTable items={filteredItems} onUpdateQtdEstimada={handleUpdateQtdEstimada} onUpdateUnidade={handleUpdateUnidade} onUpdateObservacao={handleUpdateObservacao} onUpdatePrioridade={handleUpdatePrioridade} />
      </div>
    </div>
  );
};

export default DiretoriaPlano;

