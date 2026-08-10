export type SolicitacaoStatus = 
  | "rascunho"
  | "enviado"
  | "em_analise"
  | "aprovado"
  | "rejeitado"
  | "em_compra"
  | "concluido";

export interface PlanItem {
  id?: string;
  codigo: number;
  descricao: string;
  categoria: string;
  unidade: string;
  qtdEstimada: number;
  valorUnitario: number;
  valorTotal?: number;
  prioridade: "Baixa" | "Média" | "Alta";
  gerencia: string;
  observacao?: string;
  status?: SolicitacaoStatus;
  justificativaRejeicao?: string;
  diretoriaSigla?: string;
  diretoriaOrcamentariaId?: string;
  diretoriaOrcamentariaSigla?: string;
  isOrcamentoCompartilhado?: boolean;
  gerencia_id?: string;
}

export interface PlanSummary {
  totalItens: number;
  valorTotal: number;
  saldoDisponivel: number;
  utilizacao: number;
}

// Tipos e interfaces para Serviços
export type GrauPrioridade = 
  | "Baixo"
  | "Médio"
  | "Alto";

export interface ServicoItem {
  id?: string;
  item: number;
  tipoContratacao: string;
  unidadeDemandante: string;
  objeto: string;
  justificativa: string;
  previsaoInicio?: string;
  estimativaValor?: number;
  dotacaoOrcamentaria?: number;
  grauPrioridade: GrauPrioridade;
  vinculacao: "Sim" | "Não";
  dependenciaDescricao?: string;
  gerencia: string;
  diretoriaSigla?: string;
  status?: SolicitacaoStatus;
  observacao?: string;
  justificativaRejeicao?: string;
  justificativa_rejeicao?: string;
  contrato?: string;
  created_at?: string;
  updated_at?: string;
}


export interface Diretoria {
  id: string;
  sigla: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
  ativa: boolean;
}

export interface Gerencia {
  id: string;
  sigla: string;
  nome: string;
  diretoria_id: string;
  ativa: boolean;
}
