

import { useEffect, useMemo, useState } from "react";
import { Save, Waypoints, Wallet, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  getAdminMiniErpConfigDb,
  getCategoryBudgetOwnerRules,
  getGerenciasByDiretoria,
  saveAdminMiniErpConfigDb,
  saveCategoryBudgetOwnerRules,
} from "@/lib/services.ts";
import {
  AdminBudgetConfig,
  DEFAULT_BUDGET_OWNER,
  RoutingRule,
  loadAdminBudgetConfig,
  saveAdminBudgetConfig,
} from "@/lib/adminBudgetConfig.ts";
import { CATEGORIAS_ITEM_PREDEFINIDAS } from "@/lib/catalogMetadata.ts";
import { MATERIAL_DESCRIPTION_BY_CODE } from "@/data/materialDescriptionByCode.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DiretoriaResumo {
  id: string;
  sigla: string;
  nome: string;
}

interface GerenciaResumo {
  id: string;
  sigla: string;
  nome: string;
  diretoria_id: string;
}

interface GerenciaGrupo {
  titulo: string;
  gerencias: GerenciaResumo[];
}

const DO_GROUPS: Array<{ titulo: string; siglas: string[] }> = [
  { titulo: "Sede", siglas: ["ODCD"] },
  { titulo: "Norte", siglas: ["OCNI", "OCNA", "OCNE", "OCNM", "OCND", "OCNC", "OCNP", "OCNB"] },
  { titulo: "Sul", siglas: ["OCSZ", "OCSC", "OCSD", "OCSJ", "OCSI", "OCSU", "OCST"] },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const toNumber = (raw: string) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildGerenciaGroups = (siglaDiretoria: string, gerencias: GerenciaResumo[]): GerenciaGrupo[] => {
  const sortedGerencias = [...gerencias].sort((a, b) => a.sigla.localeCompare(b.sigla));

  if (siglaDiretoria !== "DO") {
    return [{ titulo: `Gerências da ${siglaDiretoria}`, gerencias: sortedGerencias }];
  }

  const porSigla = new Map(sortedGerencias.map((g) => [g.sigla, g]));

  const grupos = DO_GROUPS.map((grupo) => ({
    titulo: grupo.titulo,
    gerencias: grupo.siglas.map((sigla) => porSigla.get(sigla)).filter(Boolean) as GerenciaResumo[],
  }));

  const siglasConhecidas = new Set(DO_GROUPS.flatMap((g) => g.siglas));
  const outras = sortedGerencias.filter((g) => !siglasConhecidas.has(g.sigla));

  if (outras.length > 0) {
    grupos.push({ titulo: "Outras", gerencias: outras });
  }

  return grupos.filter((grupo) => grupo.gerencias.length > 0);
};

export function AdminBudgetControl({ diretorias }: { diretorias: DiretoriaResumo[] }) {
  const queryClient = useQueryClient();
  const [diretoriaBudgetsAquisicao, setDiretoriaBudgetsAquisicao] = useState<Record<string, number>>({});
  const [diretoriaBudgetsServicos, setDiretoriaBudgetsServicos] = useState<Record<string, number>>({});
  const [gerenciaBudgetsAquisicao, setGerenciaBudgetsAquisicao] = useState<Record<string, number>>({});
  const [gerenciaBudgetsServicos, setGerenciaBudgetsServicos] = useState<Record<string, number>>({});
  const [routingRules, setRoutingRules] = useState<Record<string, RoutingRule>>({});
  const [categoryBudgetOwners, setCategoryBudgetOwners] = useState<Record<string, string>>({});
  const [categorySearch, setCategorySearch] = useState("");

  const { data: gerencias = [], isLoading: isLoadingGerencias } = useQuery({
    queryKey: ["admin-mini-erp-gerencias", diretorias.map((d) => d.id).join("|")],
    queryFn: async () => {
      const all = await Promise.all(diretorias.map((dir) => getGerenciasByDiretoria(dir.id)));
      return all.flat() as unknown as GerenciaResumo[];
    },
    enabled: diretorias.length > 0,
  });

  const { data: categoryOwnersFromDb = {} } = useQuery({
    queryKey: ["category-budget-owners-db"],
    queryFn: getCategoryBudgetOwnerRules,
  });

  const { data: miniConfigFromDb = {} } = useQuery({
    queryKey: ["admin-mini-erp-config-db"],
    queryFn: getAdminMiniErpConfigDb,
  });

  const diretoriaMap = useMemo(() => {
    const map: Record<string, DiretoriaResumo> = {};
    diretorias.forEach((dir) => {
      map[dir.id] = dir;
    });
    return map;
  }, [diretorias]);

  const gerenciasByDiretoria = useMemo(() => {
    const map: Record<string, GerenciaResumo[]> = {};
    gerencias.forEach((ger) => {
      if (!map[ger.diretoria_id]) {
        map[ger.diretoria_id] = [];
      }
      map[ger.diretoria_id].push(ger);
    });
    return map;
  }, [gerencias]);

  const categoriasOrcamentarias = useMemo(() => {
    const categoriasDaPlanilha = Object.values(MATERIAL_DESCRIPTION_BY_CODE);
    const categoriasSalvasNoBanco = Object.keys(categoryOwnersFromDb || {});
    const categoriasSalvasLocal = Object.keys(loadAdminBudgetConfig()?.categoryBudgetOwners || {});

    const all = new Set<string>([
      ...CATEGORIAS_ITEM_PREDEFINIDAS,
      ...categoriasDaPlanilha,
      ...categoriasSalvasNoBanco,
      ...categoriasSalvasLocal,
    ]);

    return Array.from(all)
      .filter((categoria) => typeof categoria === "string" && categoria.trim() !== "")
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categoryOwnersFromDb]);

  const categoriasOrcamentariasFiltradas = useMemo(() => {
    const termo = categorySearch.trim().toLowerCase();

    if (!termo) {
      return categoriasOrcamentarias;
    }

    return categoriasOrcamentarias.filter((categoria) =>
      categoria.toLowerCase().includes(termo)
    );
  }, [categoriasOrcamentarias, categorySearch]);

  useEffect(() => {
    if (diretorias.length === 0) return;

    const saved = loadAdminBudgetConfig();

    const defaultDirBudgetsAquisicao = diretorias.reduce<Record<string, number>>((acc, dir) => {
      acc[dir.id] =
        ((miniConfigFromDb as { diretoriaBudgetsAquisicao?: Record<string, number> })?.diretoriaBudgetsAquisicao?.[dir.id]) ??
        saved?.diretoriaBudgetsAquisicao?.[dir.id] ??
        saved?.diretoriaBudgets?.[dir.id] ??
        0;
      return acc;
    }, {});

    const defaultDirBudgetsServicos = diretorias.reduce<Record<string, number>>((acc, dir) => {
      acc[dir.id] =
        ((miniConfigFromDb as { diretoriaBudgetsServicos?: Record<string, number> })?.diretoriaBudgetsServicos?.[dir.id]) ??
        saved?.diretoriaBudgetsServicos?.[dir.id] ??
        0;
      return acc;
    }, {});

    const defaultGerBudgetsAquisicao = gerencias.reduce<Record<string, number>>((acc, ger) => {
      acc[ger.id] =
        ((miniConfigFromDb as { gerenciaBudgetsAquisicao?: Record<string, number> })?.gerenciaBudgetsAquisicao?.[ger.id]) ??
        saved?.gerenciaBudgetsAquisicao?.[ger.id] ??
        saved?.gerenciaBudgets?.[ger.id] ??
        0;
      return acc;
    }, {});

    const defaultGerBudgetsServicos = gerencias.reduce<Record<string, number>>((acc, ger) => {
      acc[ger.id] =
        ((miniConfigFromDb as { gerenciaBudgetsServicos?: Record<string, number> })?.gerenciaBudgetsServicos?.[ger.id]) ??
        saved?.gerenciaBudgetsServicos?.[ger.id] ??
        0;
      return acc;
    }, {});

    const defaultRules = gerencias.reduce<Record<string, RoutingRule>>((acc, ger) => {
      acc[ger.id] = ((miniConfigFromDb as { routingRules?: Record<string, RoutingRule> })?.routingRules?.[ger.id]) ?? saved?.routingRules?.[ger.id] ?? {
        destinoTipo: "diretoria",
        destinoId: ger.diretoria_id,
      };
      return acc;
    }, {});

    const defaultCategoryBudgetOwners = categoriasOrcamentarias.reduce<Record<string, string>>((acc, categoria) => {
      acc[categoria] = categoryOwnersFromDb?.[categoria] ?? saved?.categoryBudgetOwners?.[categoria] ?? DEFAULT_BUDGET_OWNER;
      return acc;
    }, {});

    setDiretoriaBudgetsAquisicao(defaultDirBudgetsAquisicao);
    setDiretoriaBudgetsServicos(defaultDirBudgetsServicos);
    setGerenciaBudgetsAquisicao(defaultGerBudgetsAquisicao);
    setGerenciaBudgetsServicos(defaultGerBudgetsServicos);
    setRoutingRules(defaultRules);
    setCategoryBudgetOwners(defaultCategoryBudgetOwners);
  }, [diretorias, gerencias, categoryOwnersFromDb, miniConfigFromDb, categoriasOrcamentarias]);

  const handleSaveConfig = async () => {
    const payload: AdminBudgetConfig = {
      diretoriaBudgetsAquisicao,
      diretoriaBudgetsServicos,
      gerenciaBudgetsAquisicao,
      gerenciaBudgetsServicos,
      // Compatibilidade com leitura legada
      diretoriaBudgets: diretoriaBudgetsAquisicao,
      gerenciaBudgets: gerenciaBudgetsAquisicao,
      routingRules,
      categoryBudgetOwners,
      updatedAt: new Date().toISOString(),
    };
    try {
      await Promise.all([
        saveAdminMiniErpConfigDb({
          diretoriaBudgetsAquisicao,
          diretoriaBudgetsServicos,
          gerenciaBudgetsAquisicao,
          gerenciaBudgetsServicos,
          routingRules,
        }),
        saveCategoryBudgetOwnerRules(categoryBudgetOwners),
      ]);
      saveAdminBudgetConfig(payload);
      queryClient.invalidateQueries({ queryKey: ["admin-mini-erp-config-db"] });
      queryClient.invalidateQueries({ queryKey: ["category-budget-owners-db"] });
      toast.success("Configurações de orçamento e fluxo salvas no Admin e no banco.");
    } catch (error: unknown) {
      const rawMessage = String(error instanceof Error ? error.message : "");
      const message = rawMessage.includes("Sessão admin não encontrada") || rawMessage.includes("Sessao admin nao encontrada")
        ? "Sessão admin expirada. Entre novamente no painel admin."
        : "Não foi possível salvar as regras orçamentárias no banco.";
      toast.error(message);
    }
  };

  const totalDiretoriasAquisicao = useMemo(
    () => Object.values(diretoriaBudgetsAquisicao).reduce((acc, value) => acc + value, 0),
    [diretoriaBudgetsAquisicao],
  );

  const totalDiretoriasServicos = useMemo(
    () => Object.values(diretoriaBudgetsServicos).reduce((acc, value) => acc + value, 0),
    [diretoriaBudgetsServicos],
  );

  const totalGerenciasAquisicao = useMemo(
    () => Object.values(gerenciaBudgetsAquisicao).reduce((acc, value) => acc + value, 0),
    [gerenciaBudgetsAquisicao],
  );

  const totalGerenciasServicos = useMemo(
    () => Object.values(gerenciaBudgetsServicos).reduce((acc, value) => acc + value, 0),
    [gerenciaBudgetsServicos],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Orçamento Central
        </h2>
        <Button onClick={handleSaveConfig} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar configurações
        </Button>
      </div>

      {/* CARD AQUISIÇÃO */}
      <Card className="p-6 card-shadow border-l-4 border-l-blue-500">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-foreground">Aquisição</h3>
          <Badge className="bg-blue-100 text-blue-700">Compras de itens</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border p-4 bg-blue-50">
            <p className="text-xs text-muted-foreground mb-1">Diretorias (Aquisição)</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(totalDiretoriasAquisicao)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-amber-50">
            <p className="text-xs text-muted-foreground mb-1">Gerências (Aquisição)</p>
            <p className="text-lg font-bold text-amber-700">{formatCurrency(totalGerenciasAquisicao)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Badge variant={totalDiretoriasAquisicao >= totalGerenciasAquisicao ? "default" : "destructive"}>
            {totalDiretoriasAquisicao >= totalGerenciasAquisicao ? "Equilibrada" : "Acima do limite"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Saldo: {formatCurrency(totalDiretoriasAquisicao - totalGerenciasAquisicao)}
          </span>
        </div>

        <div className="space-y-4">
          {diretorias.map((dir) => {
            const gerenciasDaDiretoria = gerenciasByDiretoria[dir.id] || [];
            const gerenciasAgrupadas = buildGerenciaGroups(dir.sigla, gerenciasDaDiretoria);
            const totalGerenciasDirAquisicao = gerenciasDaDiretoria.reduce(
              (acc, ger) => acc + (gerenciaBudgetsAquisicao[ger.id] || 0),
              0,
            );

            return (
              <div key={dir.id} className="rounded-lg border p-4 bg-muted/20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-1">
                    <Label htmlFor={`dir-acq-${dir.id}`} className="text-xs font-semibold">
                      {dir.sigla} - Orçamento Aquisição
                    </Label>
                    <Input
                      id={`dir-acq-${dir.id}`}
                      type="number"
                      min={0}
                      value={diretoriaBudgetsAquisicao[dir.id] === 0 ? "" : String(diretoriaBudgetsAquisicao[dir.id] ?? "")}
                      placeholder="0"
                      onChange={(e) => {
                        const value = toNumber(e.target.value);
                        setDiretoriaBudgetsAquisicao((prev) => ({ ...prev, [dir.id]: value }));
                      }}
                    />
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2 text-sm space-y-1">
                    <p className="text-muted-foreground font-medium">{dir.sigla}</p>
                    <p className="text-xs">Gerências: {formatCurrency(totalGerenciasDirAquisicao)}</p>
                    <p className="text-xs">Saldo: {formatCurrency((diretoriaBudgetsAquisicao[dir.id] || 0) - totalGerenciasDirAquisicao)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-primary" />
                    Gerências da {dir.sigla}
                  </div>
                  {isLoadingGerencias ? (
                    <div className="text-sm text-muted-foreground">Carregando gerências...</div>
                  ) : gerenciasDaDiretoria.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma gerência cadastrada.</div>
                  ) : (
                    <div className="space-y-4">
                      {gerenciasAgrupadas.map((grupo) => (
                        <div key={`${dir.sigla}-acq-${grupo.titulo}`} className="space-y-2">
                          {dir.sigla === "DO" && (
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground">DO - {grupo.titulo}</p>
                              <Badge variant="secondary" className="text-[10px]">
                                {grupo.gerencias.length}
                              </Badge>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {grupo.gerencias.map((ger) => (
                              <div key={`${ger.id}-acq`} className="space-y-1 rounded-md border bg-background p-3">
                                <Label htmlFor={`ger-acq-${ger.id}`} className="text-xs font-medium">
                                  {ger.sigla}
                                </Label>
                                <Input
                                  id={`ger-acq-${ger.id}`}
                                  type="number"
                                  min={0}
                                  value={gerenciaBudgetsAquisicao[ger.id] === 0 ? "" : String(gerenciaBudgetsAquisicao[ger.id] ?? "")}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const value = toNumber(e.target.value);
                                    setGerenciaBudgetsAquisicao((prev) => ({ ...prev, [ger.id]: value }));
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* CARD SERVIÇOS */}
      <Card className="p-6 card-shadow border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-foreground">Serviços</h3>
          <Badge className="bg-emerald-100 text-emerald-700">Contratações de serviços</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border p-4 bg-emerald-50">
            <p className="text-xs text-muted-foreground mb-1">Diretorias (Serviços)</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalDiretoriasServicos)}</p>
          </div>
          <div className="rounded-lg border p-4 bg-violet-50">
            <p className="text-xs text-muted-foreground mb-1">Gerências (Serviços)</p>
            <p className="text-lg font-bold text-violet-700">{formatCurrency(totalGerenciasServicos)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Badge variant={totalDiretoriasServicos >= totalGerenciasServicos ? "default" : "destructive"}>
            {totalDiretoriasServicos >= totalGerenciasServicos ? "Equilibrada" : "Acima do limite"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Saldo: {formatCurrency(totalDiretoriasServicos - totalGerenciasServicos)}
          </span>
        </div>

        <div className="space-y-4">
          {diretorias.map((dir) => {
            const gerenciasDaDiretoria = gerenciasByDiretoria[dir.id] || [];
            const gerenciasAgrupadas = buildGerenciaGroups(dir.sigla, gerenciasDaDiretoria);
            const totalGerenciasDirServicos = gerenciasDaDiretoria.reduce(
              (acc, ger) => acc + (gerenciaBudgetsServicos[ger.id] || 0),
              0,
            );

            return (
              <div key={`${dir.id}-serv`} className="rounded-lg border p-4 bg-muted/20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-1">
                    <Label htmlFor={`dir-serv-${dir.id}`} className="text-xs font-semibold">
                      {dir.sigla} - Orçamento Serviços
                    </Label>
                    <Input
                      id={`dir-serv-${dir.id}`}
                      type="number"
                      min={0}
                      value={diretoriaBudgetsServicos[dir.id] === 0 ? "" : String(diretoriaBudgetsServicos[dir.id] ?? "")}
                      placeholder="0"
                      onChange={(e) => {
                        const value = toNumber(e.target.value);
                        setDiretoriaBudgetsServicos((prev) => ({ ...prev, [dir.id]: value }));
                      }}
                    />
                  </div>
                  <div className="rounded-md border bg-background px-3 py-2 text-sm space-y-1">
                    <p className="text-muted-foreground font-medium">{dir.sigla}</p>
                    <p className="text-xs">Gerências: {formatCurrency(totalGerenciasDirServicos)}</p>
                    <p className="text-xs">Saldo: {formatCurrency((diretoriaBudgetsServicos[dir.id] || 0) - totalGerenciasDirServicos)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-primary" />
                    Gerências da {dir.sigla}
                  </div>
                  {isLoadingGerencias ? (
                    <div className="text-sm text-muted-foreground">Carregando gerências...</div>
                  ) : gerenciasDaDiretoria.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhuma gerência cadastrada.</div>
                  ) : (
                    <div className="space-y-4">
                      {gerenciasAgrupadas.map((grupo) => (
                        <div key={`${dir.sigla}-serv-${grupo.titulo}`} className="space-y-2">
                          {dir.sigla === "DO" && (
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground">DO - {grupo.titulo}</p>
                              <Badge variant="secondary" className="text-[10px]">
                                {grupo.gerencias.length}
                              </Badge>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {grupo.gerencias.map((ger) => (
                              <div key={`${ger.id}-serv`} className="space-y-1 rounded-md border bg-background p-3">
                                <Label htmlFor={`ger-serv-${ger.id}`} className="text-xs font-medium">
                                  {ger.sigla}
                                </Label>
                                <Input
                                  id={`ger-serv-${ger.id}`}
                                  type="number"
                                  min={0}
                                  value={gerenciaBudgetsServicos[ger.id] === 0 ? "" : String(gerenciaBudgetsServicos[ger.id] ?? "")}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const value = toNumber(e.target.value);
                                    setGerenciaBudgetsServicos((prev) => ({ ...prev, [ger.id]: value }));
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* CARD CATEGORIAS ORÇAMENTÁRIAS */}
      <Card className="p-6 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-base font-semibold text-foreground">Diretoria Orçamentária por Categoria</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Defina qual diretoria vai bancar cada categoria. Quando uma gerência solicitar um item, a aprovação seguirá para a diretoria orçamentária definida abaixo.
        </p>
        <div className="mb-4 space-y-2">
          <Input
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder="Buscar categoria..."
            className="max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            Exibindo {categoriasOrcamentariasFiltradas.length} de {categoriasOrcamentarias.length} categorias.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoriasOrcamentariasFiltradas.map((categoria) => (
            <div key={categoria} className="rounded-md border p-3 bg-muted/20 space-y-2">
              <p className="text-xs font-medium text-foreground">{categoria}</p>
              <Select
                value={categoryBudgetOwners[categoria] ?? DEFAULT_BUDGET_OWNER}
                onValueChange={(value) => {
                  setCategoryBudgetOwners((prev) => ({
                    ...prev,
                    [categoria]: value,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a diretoria orçamentária" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_BUDGET_OWNER}>Mesma diretoria solicitante</SelectItem>
                  {diretorias.map((dir) => (
                    <SelectItem key={dir.id} value={dir.id}>
                      {dir.sigla} - {dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {categoriasOrcamentariasFiltradas.length === 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Nenhuma categoria encontrada para a busca informada.
          </div>
        )}
      </Card>

      {/* CARD CONTROLE DE FLUXO */}
      <Card className="p-6 card-shadow">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <Waypoints className="h-5 w-5 text-primary" />
          Controle de Fluxo (Roteamento de Solicitações)
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure para onde as gerências devem enviar suas solicitações (para a diretoria, para compras direto, ou para admin).
        </p>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Diretoria</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gerencias.map((ger) => {
                const rule = routingRules[ger.id];
                const dir = diretoriaMap[ger.diretoria_id];
                const destinoLabel =
                  rule?.destinoTipo === "diretoria"
                    ? diretoriaMap[rule.destinoId]?.sigla || "Diretoria"
                    : rule?.destinoTipo === "compras"
                      ? "Compras"
                      : "Admin";

                return (
                  <TableRow key={ger.id}>
                    <TableCell className="font-medium">{ger.sigla}</TableCell>
                    <TableCell>{dir?.sigla ?? "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={`${rule?.destinoTipo ?? "diretoria"}|${rule?.destinoId ?? ger.diretoria_id}`}
                        onValueChange={(value) => {
                          const [destinoTipo, destinoId] = value.split("|");
                          setRoutingRules((prev) => ({
                            ...prev,
                            [ger.id]: {
                              destinoTipo: destinoTipo as RoutingRule["destinoTipo"],
                              destinoId,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={`diretoria|${ger.diretoria_id}`}>
                            Diretoria {dir?.sigla ?? ""}
                          </SelectItem>
                          <SelectItem value="compras|compras">Compras</SelectItem>
                          <SelectItem value="admin|admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ger.sigla} envia para {destinoLabel}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
