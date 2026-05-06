// ============================================
// TIPOS TYPESCRIPT - MODELO ERP
// ============================================

// ============================================
// TIPOS BÁSICOS / CONFIGURAÇÃO
// ============================================

export type CategoriaItem = {
  id: string;
  nome: string;
  descricao?: string;
  ativa: boolean;
  created_at?: string;
};

export type CentroCusto = {
  id: string;
  codigo: string;
  nome: string;
  diretoria_id: string;
  ativo: boolean;
  created_at?: string;
};

export type RegraCategoriaCentroCusto = {
  id: string;
  categoria_id: string;
  centro_custo_id: string;
  vigencia_inicio: string; // date
  vigencia_fim?: string; // date | null
  ativo: boolean;
  created_at?: string;
};

export type Fornecedor = {
  id: string;
  cnpj?: string;
  razao_social: string;
  nome_fantasia?: string;
  ativo: boolean;
  created_at?: string;
};

// ============================================
// PLANEJAMENTO ANUAL
// ============================================

export type PlanoAnualStatus = 'rascunho' | 'em_aprovacao' | 'aprovado' | 'encerrado';

export type PlanoAnual = {
  id: string;
  ano: number;
  status: PlanoAnualStatus;
  descricao?: string;
  criado_por?: string;
  created_at?: string;
};

export type PlanoDiretoriaStatus = 'rascunho' | 'enviado' | 'aprovado' | 'devolvido';

export type PlanoDiretoria = {
  id: string;
  plano_anual_id: string;
  diretoria_id: string;
  status: PlanoDiretoriaStatus;
  observacoes?: string;
  submitted_at?: string;
  approved_at?: string;
  created_at?: string;
};

export type PlanoItem = {
  id: string;
  plano_diretoria_id: string;
  item_catalogo_id: string;
  quantidade_prevista: number;
  valor_unit_previsto?: number;
  justificativa?: string;
  prioridade?: 1 | 2 | 3; // 1 = Alta, 2 = Média, 3 = Baixa
  centro_custo_id: string;
  meta_mes?: number; // 1-12
  created_at?: string;
};

// ============================================
// ORÇAMENTO
// ============================================

export type OrcamentoAnual = {
  id: string;
  ano: number;
  centro_custo_id: string;
  valor_aprovado: number;
  valor_reservado: number;
  valor_executado: number;
  updated_at?: string;
};

// Tipo auxiliar para exibição
export type OrcamentoDisponivel = OrcamentoAnual & {
  disponivel: number;
  taxa_execucao_pct: number;
  taxa_comprometimento_pct: number;
};

// Orçamento agregado por Diretoria (para painel admin)
export type OrcamentoDiretoria = {
  diretoria_id: string;
  diretoria_sigla: string;
  ano: number;
  valor_total_aprovado: number;
  valor_total_reservado: number;
  valor_total_executado: number;
  valor_disponivel: number;
  taxa_execucao_pct: number;
  centros_custo: CentroCustoComOrcamento[];
};

// Centro de custo com orçamento (detalhes)
export type CentroCustoComOrcamento = CentroCusto & {
  diretoria_sigla: string;
  orcamento: OrcamentoDisponivel;
};

// ============================================
// EXECUÇÃO - SOLICITAÇÕES DE COMPRA
// ============================================

export type SolicitacaoCompraStatus = 
  | 'aberta' 
  | 'aprovada' 
  | 'rejeitada' 
  | 'em_cotacao' 
  | 'comprada' 
  | 'cancelada';

export type SolicitacaoCompra = {
  id: string;
  diretoria_solicitante_id: string;
  centro_custo_id: string;
  status: SolicitacaoCompraStatus;
  descricao: string;
  created_at?: string;
};

export type SolicitacaoItem = {
  id: string;
  solicitacao_compra_id: string;
  item_catalogo_id: string;
  quantidade: number;
  valor_unit_estimado?: number;
  valor_unit_final?: number;
  plano_item_id?: string;
  created_at?: string;
};

// ============================================
// APROVAÇÃO / WORKFLOW
// ============================================

export type AprovacaoTipo = 'plano_diretoria' | 'solicitacao_compra';
export type AprovacaoStatus = 'pendente' | 'aprovado' | 'rejeitado';

export type Aprovacao = {
  id: string;
  tipo: AprovacaoTipo;
  referencia_id: string;
  etapa: number;
  aprovado_por?: string;
  status: AprovacaoStatus;
  comentario?: string;
  created_at?: string;
};

// ============================================
// LOG DE TRILHA ORÇAMENTÁRIA
// ============================================

export type LogOrcamentarioAcao = 
  | 'reservar' 
  | 'estornar_reserva' 
  | 'executar' 
  | 'estornar_execucao';

export type LogOrcamentarioRefTipo = 'plano_item' | 'solicitacao_compra' | 'compra';

export type LogOrcamentario = {
  id: string;
  ano: number;
  centro_custo_id: string;
  referencia_tipo: LogOrcamentarioRefTipo;
  referencia_id: string;
  acao: LogOrcamentarioAcao;
  valor: number;
  created_at?: string;
};

// ============================================
// TIPOS COMPOSTOS / VIEWs
// ============================================

// Dashboard de orçamento por diretoria
export type DashboardOrcamentoDiretoria = {
  diretoria: string; // sigla
  qtd_centros: number;
  total_aprovado: number;
  total_reservado: number;
  total_executado: number;
  disponivel: number;
};

// Plano completo com itens e status
export type PlanoDiretoriaCompleto = PlanoDiretoria & {
  diretoria_sigla: string;
  itens: PlanoItemCompleto[];
  total_planejado: number;
};

// Item planejado com detalhes
export type PlanoItemCompleto = PlanoItem & {
  item_descricao: string;
  centro_custo_nome: string;
  categoria_nome: string;
  valor_total: number;
  status_desenvolvimento: 'planejado' | 'parcialmente_solicitado' | 'totalmente_solicitado' | 'em_compra' | 'entregue';
};

// Solicitação de compra completa com itens
export type SolicitacaoCompraCompleta = SolicitacaoCompra & {
  diretoria_solicitante_sigla: string;
  centro_custo_nome: string;
  itens: SolicitacaoItemCompleto[];
  valor_total: number;
  qtd_itens: number;
};

// Item de solicitação com detalhes
export type SolicitacaoItemCompleto = SolicitacaoItem & {
  item_descricao: string;
  item_codigo: number;
  unidade_medida: string;
  valor_total_estimado: number;
  valor_total_final: number;
  plano_associado: PlanoItem | null;
};

// Histórico de movimentação orçamentária
export type HistoricoOrcamentario = LogOrcamentario & {
  centro_custo_nome: string;
  diretoria_sigla: string;
  referencia_descricao: string;
  saldo_antes: number;
  saldo_depois: number;
};

// ============================================
// DTOs - Data Transfer Objects
// ============================================

// Para criar novo plano item
export type CreatePlanoItemDTO = Omit<PlanoItem, 'id' | 'created_at'>;

// Para atualizar orçamento anual
export type UpdateOrcamentoDTO = {
  valor_aprovado?: number;
  valor_reservado?: number;
  valor_executado?: number;
};

// Para atualizar orçamento da diretoria (múltiplos centros de custo)
export type UpdateOrcamentoDiretoriaDTO = {
  ano: number;
  diretoria_id: string;
  orcamentos: Array<{
    centro_custo_id: string;
    valor_aprovado: number;
  }>;
};

// Para atualizar status de plano diretoria
export type UpdatePlanoDiretoriaDTO = {
  status: PlanoDiretoriaStatus;
  observacoes?: string;
};

// Para criar solicitação de compra
export type CreateSolicitacaoCompraDTO = Omit<SolicitacaoCompra, 'id' | 'created_at'>;

// Para cancelar e estornar
export type EstornoDTO = {
  motivo: string;
  referencia_tipo: LogOrcamentarioRefTipo;
  referencia_id: string;
  valor: number;
};

// ============================================
// RESPONSES & QUERIES
// ============================================

// Response de cálculo de disponibilidade
export type ResponseDisponibilidade = {
  centro_custo_id: string;
  ano: number;
  valor_aprovado: number;
  valor_reservado: number;
  valor_executado: number;
  disponivel: number;
  percentual_disponivel: number;
  em_critico: boolean; // true se disponível < 20% do aprovado
};

// Response de validação orçamentária
export type ResponseValidacaoOrcamentaria = {
  pode_solicitar: boolean;
  valor_solicitado: number;
  valor_disponivel: number;
  percentual_disponivel: number;
  motivo_rejeicao?: string;
};

// ============================================
// HELPER TYPES
// ============================================

export type Prioridade = 1 | 2 | 3;
export type PrioridadeLabel = 'Alta' | 'Média' | 'Baixa';

export function prioridadeToLabel(p: Prioridade): PrioridadeLabel {
  return p === 1 ? 'Alta' : p === 2 ? 'Média' : 'Baixa';
}

export function labelToPrioridade(label: PrioridadeLabel): Prioridade {
  return label === 'Alta' ? 1 : label === 'Média' ? 2 : 3;
}

// Mês como número para label
export function mesNumeroToLabel(mes: number): string {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return meses[mes - 1] || '';
}

// Status labels em português
export function planoStatusLabel(status: PlanoDiretoriaStatus): string {
  const labels: Record<PlanoDiretoriaStatus, string> = {
    'rascunho': 'Rascunho',
    'enviado': 'Enviado para Aprovação',
    'aprovado': 'Aprovado',
    'devolvido': 'Devolvido'
  };
  return labels[status] || status;
}

export function solicitacaoStatusLabel(status: SolicitacaoCompraStatus): string {
  const labels: Record<SolicitacaoCompraStatus, string> = {
    'aberta': 'Aberta',
    'aprovada': 'Aprovada',
    'rejeitada': 'Rejeitada',
    'em_cotacao': 'Em Cotação',
    'comprada': 'Comprada',
    'cancelada': 'Cancelada'
  };
  return labels[status] || status;
}
