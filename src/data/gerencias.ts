export const GERENCIA_NOME_POR_SIGLA: Record<string, string> = {
  CCRR: "Gerência de Relacionamento com Cliente",
  CCRF: "Gerência de Faturamento e Arrecadação",
  CCRC: "Gerência de Operações Comerciais",

  EPRO: "Gerência de Projetos",
  EOBR: "Gerência de Obras",
  EMAR: "Gerência de Meio Ambiente e Recursos Hídricos",
  EPRE: "Gerência de Projetos e Obras Especiais",

  GCFI: "Gerência Contábil e Financeira",
  GSAD: "Gerência de Suporte Administrativo",
  GEPE: "Gerência de Pessoas",
  GCON: "Gerência de Contratos e Convênios",
  GESL: "Gerência de Suprimentos e Logística",

  ODCD: "Gerência de Desenvolvimento e Controle Operacional",
  OCNI: "Gerência de Produção de Água do Sistema Italuís",
  OCNA: "Gerência de Produção de Água do Sistema Metropolitano",
  OCNE: "Gerência de Operação de Estação Elevatória de Esgoto da Região Metropolitana",
  OCNM: "Gerência de Planejamento Gestão e Manutenção Metropolitana",
  OCND: "Gerência de Operação do Sistema Distribuidor Metropolitano",
  OCNC: "Gerência de Operação do Sistema Coletor Metropolitano",
  OCNP: "Gerência de Serviços e Negócios de Pinheiro",
  OCNB: "Gerência de Serviços e Negócios de Barreirinha",
  OCSZ: "Gerência Especial de Imperatriz",
  OCSC: "Gerência de Serviços e Negócios de Chapadinha",
  OCSD: "Gerência de Serviços e Negócios de Pedreiras",
  OCSJ: "Gerência de Serviços e Negócios de São João dos Patos",
  OCSI: "Gerência de Serviços e Negócios de Santa Inês",
  OCSU: "Gerência de Serviços e Negócios de Itapecuru Mirim",
  OCST: "Gerência de Serviços e Negócios de Presidente Dutra",

  UTIN: "Gerência de Tecnologia da Informação e Suporte a Usuários",
  UEP: "Unidade Especial de Planejamento, Controle e Inovação",
  AUDIT: "Auditoria Interna",
  PRO: "Ouvidoria",
  ASCOM: "Assessoria de Comunicação",
  PRJ: "Procuradoria Jurídica",
  PRL: "Central de Licitação",
  PRR: "Assessoria de Governança e Regulação",
};

export function resolveGerenciaNome(sigla?: string, nome?: string | null) {
  const nomeTrim = String(nome || "").trim();
  if (nomeTrim.length > 0) return nomeTrim;

  const siglaUpper = String(sigla || "").trim().toUpperCase();
  if (!siglaUpper) return "Acessar painel";

  return GERENCIA_NOME_POR_SIGLA[siglaUpper] || "Acessar painel";
}