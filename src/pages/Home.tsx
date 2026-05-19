import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Clock, AlertTriangle, ArrowRight, Shield, ShoppingBag, Users, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getDiretorias, getPeriodosAtivos } from "@/lib/services";
import { useQuery } from "@tanstack/react-query";
import { Diretoria } from "@/types/plan";
import { DIRETORIAS } from "@/data/diretorias";

const PERFIS = [
  {
    id: "diretoria",
    label: "Diretorias",
    descricao: "Acesse o plano da sua diretoria para aprovar solicitações",
    icon: Building2,
    cor: "bg-primary/10 text-primary",
    destaque: true,
  },
  {
    id: "compras",
    label: "Compras",
    descricao: "Gerencie itens aprovados",
    icon: ShoppingBag,
    cor: "bg-slate-100 text-slate-700",
    rota: "/compras",
  },
  {
    id: "admin",
    label: "Administrador",
    descricao: "Controle de períodos e configurações",
    icon: Shield,
    cor: "bg-slate-100 text-slate-700",
    rota: "/admin",
  },
];

const getDiretoriaIconPath = (sigla: string) => {
  const iconMap: Record<string, string> = {
    DC: "/assets/images/dc2.png",
    DE: "/assets/images/de2.png",
    DG: "/assets/images/gd2.png",
    DO: "/assets/images/do2.png",
    PR: "/assets/images/pr2.png",
  };
  return iconMap[sigla] || null;
};

const renderDiretoriaIcon = (sigla: string, icone?: string) => {
  const iconPath = getDiretoriaIconPath(sigla);
  if (iconPath) {
    return (
      <img
        src={iconPath}
        alt={`Ícone ${sigla}`}
        className="h-10 w-10 object-contain"
      />
    );
  }

  return (
    <div className="flex items-center justify-center rounded-full bg-white/10 h-12 w-12 text-center">
      <span className="text-2xl leading-none">{icone || sigla}</span>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const diretoriasFallback = useMemo(
    () =>
      DIRETORIAS.map((dir) => ({
        id: dir.sigla,
        sigla: dir.sigla,
        nome: dir.nome,
        descricao: dir.descricao,
        icone: dir.icone,
      })),
    []
  );

  const { data: diretoriasDb = [], isFetching: fetchingDiretorias } = useQuery<Diretoria[]>({
    queryKey: ["diretorias"],
    queryFn: getDiretorias,
    placeholderData: diretoriasFallback,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const diretorias = diretoriasDb.length > 0 ? diretoriasDb : diretoriasFallback;

  const { data: periodos = [] } = useQuery({
    queryKey: ["periodos"],
    queryFn: getPeriodosAtivos,
  });

  const prazo = useMemo(() => {
    if (!periodos[0]?.fim) return null;
    return new Date(periodos[0].fim);
  }, [periodos]);

  const diasRestantes = useMemo(() => {
    if (!prazo) return null;
    return differenceInDays(prazo, new Date());
  }, [prazo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 relative">
      {/* Logo CAEMA como marca d'água de fundo */}
      <div 
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        style={{
          top: '200px',
        }}
      >
        <img 
          src="/assets/images/caema-logo.png" 
          alt="CAEMA" 
          className="w-full max-w-3xl opacity-[0.08]"
        />
      </div>

      {/* Content Wrapper */}
      <div className="relative z-10">
        {/* Header */}
        <header className="gradient-header px-6 py-8 relative overflow-hidden">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="flex items-center justify-center gap-3 mb-4">
              
            </div>
             <div className="flex justify-center">
              <img 
                src="/assets/images/caema-logo.png" 
                alt="CAEMA - Companhia de Saneamento Ambiental do Maranhão" 
                className="h-16 w-auto opacity-90"
              />
            </div>
            <br></br>
            <h1 className="text-3xl font-bold text-white mb-4">
              Plano Anual de Contratações 2027
            </h1>
           
          </div>
        </header>

      {/* Info + Prazo */}
      <div className="max-w-5xl mx-auto px-6 mt-6">
        <Card className="p-6 card-shadow border-l-4 border-l-destructive bg-card">
          <div className="flex items-start gap-4">
            <div className="bg-destructive/10 p-3 rounded-full shrink-0">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Informações Importantes
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                O Plano Anual de Contratações (PAC) 2027 está aberto para preenchimento pelas diretorias. Cada diretoria deve acessar seu respectivo formulário, e cada gerência deverá preencher as quantidades solicitadas, 
                definir as prioridades e adicionar observações pertinentes aos itens do plano.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/60 text-destructive-foreground">
                  <Clock className="h-5 w-5" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">
                      {prazo
                        ? `Prazo: ${format(prazo, "dd/MM/yyyy", { locale: ptBR })} — ${diasRestantes} dias restantes`
                        : "Prazo: carregando..."}
                    </span>
                    <span className="text-[13.5px] opacity-90 leading-tight">
                      Após a finalização do prazo, o link de acesso será bloqueado. Fique atento ao prazo!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Diretorias */}
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <br />
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Selecione a Diretoria
        </h2>
        {diretorias.length > 0 ? (
          <>
          {fetchingDiretorias && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">Sincronizando diretorias...</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 [&>*:last-child:nth-child(3n-2)]:md:col-start-2 [&>*:last-child:nth-child(3n-2)]:lg:col-start-2">
            {diretorias.map((dir) => (
              <Card
                key={dir.sigla}
                className="p-0 overflow-hidden card-shadow cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group"
                onClick={() => navigate(`/diretoria/${dir.sigla.toLowerCase()}`)}
              >
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4">
                  <div className="flex items-center justify-between">
                    {renderDiretoriaIcon(dir.sigla, dir.icone)}
                    <Badge className="bg-white/20 text-white border-none text-lg font-bold">
                      {dir.sigla}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-sm mb-1 leading-tight">
                    {dir.nome}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {dir.descricao}
                  </p>
                  <div className="flex items-center text-primary text-sm font-medium group-hover:gap-2 transition-all">
                    Acessar plano <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 bg-muted/30 rounded-lg border border-destructive/30">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Carregando...</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              O banco de dados pode não estar configurado ainda. Siga os passos de setup:
            </p>
            <div className="bg-background rounded-lg p-4 text-sm text-left space-y-2 border border-border w-full max-w-md mb-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0 font-bold text-primary">1.</div>
                <div>
                  <p className="font-medium">Criar tabelas no Supabase</p>
                  <p className="text-xs text-muted-foreground">Execute <code className="bg-muted px-1 rounded">supabase/schema.sql</code> no SQL Editor</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 font-bold text-primary">2.</div>
                <div>
                  <p className="font-medium">Popular dados iniciais</p>
                  <p className="text-xs text-muted-foreground">Execute <code className="bg-muted px-1 rounded">supabase/seed.sql</code> no SQL Editor</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 font-bold text-primary">3.</div>
                <div>
                  <p className="font-medium">Deploy da Edge Function</p>
                  <p className="text-xs text-muted-foreground">Execute <code className="bg-muted px-1 rounded">supabase functions deploy validate-access-code</code></p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              ↻ Recarregar página
            </button>
          </div>
        )}
      </div>
      </div> {/* Fim do Content Wrapper */}

      
      {/* Acesso Rápido por Perfil */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Acesso por Perfil</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PERFIS.filter((p) => !p.destaque).map((perfil) => (
            <Card
              key={perfil.id}
              className="p-4 card-shadow cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group"
              onClick={() => perfil.rota && navigate(perfil.rota)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${perfil.cor}`}>
                  <perfil.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">{perfil.label}</h3>
                  <p className="text-xs text-muted-foreground">{perfil.descricao}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
    
  );
};

export default Home;

