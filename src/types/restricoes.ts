export type ModuloTipo =
  | "todos"
  | "aquisicao"
  | "servicos_existentes"
  | "servicos_novos"
  | "compras"
  | "aprovacao";

export type EscopoTipo = "todos" | "diretoria" | "gerencia" | "perfil";

export type PerfilTipo = "todos" | "gerencia" | "diretoria" | "compras";

export type StatusRestricao = "bloqueado" | "liberado";

export type AtividadeTipo =
  | "todas"
  | "adicionar_item"
  | "editar_item"
  | "alterar_quantidade"
  | "alterar_prioridade"
  | "adicionar_observacao"
  | "enviar_solicitacao"
  | "devolver_solicitacao"
  | "excluir_item"
  | "adicionar_servico"
  | "adicionar_novo_servico"
  | "editar_servico"
  | "alterar_valor"
  | "excluir_servico"
  | "aprovar"
  | "reprovar"
  | "enviar_compras"
  | "receber_solicitacoes"
  | "processar_solicitacoes"
  | "alterar_informacoes"
  | "edicao_em_lote";

export interface RestricaoAtividade {
  id: string;
  periodo_id: string;
  escopo_tipo: EscopoTipo;
  diretoria_id?: string | null;
  gerencia_id?: string | null;
  perfil?: PerfilTipo | null;
  modulo: ModuloTipo;
  atividade: AtividadeTipo | string;
  status: StatusRestricao;
  ativo: boolean;
  observacao?: string | null;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  // Campos populados via join/lookup
  periodo_nome?: string;
  diretoria_sigla?: string;
  gerencia_sigla?: string;
}

export interface ActivityPermissionContext {
  periodoId?: string;
  gerenciaId?: string;
  diretoriaId?: string;
  perfil?: "gerencia" | "diretoria" | "compras" | "admin";
  modulo: ModuloTipo;
  atividade: AtividadeTipo | string;
}

export interface PermissionCheckResult {
  blocked: boolean;
  reason?: string;
  matchedRule?: RestricaoAtividade;
}

export const MODULOS_CONFIG: {
  id: ModuloTipo;
  label: string;
  atividades: { id: AtividadeTipo | string; label: string; descricao?: string }[];
}[] = [
  {
    id: "todos",
    label: "Todos os Módulos",
    atividades: [
      { id: "todas", label: "Todas as Atividades", descricao: "Bloqueia/libera todas as ações do período" },
    ],
  },
  {
    id: "aquisicao",
    label: "Aquisição",
    atividades: [
      { id: "todas", label: "Todas as Atividades de Aquisição" },
      { id: "enviar_solicitacao", label: "Enviar solicitação", descricao: "Envio de itens em rascunho para aprovação da diretoria" },
      { id: "adicionar_item", label: "Adicionar item", descricao: "Adicionar itens do catálogo ao plano" },
      { id: "editar_item", label: "Editar item", descricao: "Edição de detalhes do item no plano" },
      { id: "alterar_quantidade", label: "Alterar quantidade", descricao: "Alteração de quantidade estimada" },
      { id: "alterar_prioridade", label: "Alterar prioridade", descricao: "Alteração do grau de prioridade" },
      { id: "adicionar_observacao", label: "Adicionar observação", descricao: "Inserção e edição de observações" },
      { id: "devolver_solicitacao", label: "Devolver solicitação", descricao: "Devolução de itens para rascunho" },
      { id: "excluir_item", label: "Excluir item", descricao: "Remoção de itens da solicitação" },
      { id: "edicao_em_lote", label: "Edição em lote", descricao: "Alterações em massa de itens" },
    ],
  },
  {
    id: "servicos_existentes",
    label: "Serviços Existentes",
    atividades: [
      { id: "todas", label: "Todas as Atividades de Serviços Existentes" },
      { id: "enviar_solicitacao", label: "Enviar solicitação", descricao: "Envio de serviços existentes para aprovação da diretoria" },
      { id: "adicionar_servico", label: "Adicionar serviço existente", descricao: "Vincular serviços do catálogo" },
      { id: "editar_servico", label: "Editar serviço", descricao: "Edição de campos do serviço existente" },
      { id: "alterar_valor", label: "Alterar dotação / estimativa", descricao: "Modificação de valores financeiros" },
      { id: "alterar_prioridade", label: "Alterar prioridade", descricao: "Modificação de prioridade do serviço" },
      { id: "adicionar_observacao", label: "Adicionar observação", descricao: "Inserção/edição de observação" },
      { id: "devolver_solicitacao", label: "Devolver solicitação", descricao: "Devolução de serviço para rascunho" },
      { id: "excluir_servico", label: "Excluir serviço", descricao: "Exclusão de serviços cadastrados" },
      { id: "edicao_em_lote", label: "Edição em lote", descricao: "Alterações em massa de serviços existentes" },
    ],
  },
  {
    id: "servicos_novos",
    label: "Novos Serviços",
    atividades: [
      { id: "todas", label: "Todas as Atividades de Novos Serviços" },
      { id: "enviar_solicitacao", label: "Enviar solicitação", descricao: "Envio de novos serviços para aprovação da diretoria" },
      { id: "adicionar_novo_servico", label: "Adicionar novo serviço", descricao: "Cadastrar novo serviço não existente no catálogo" },
      { id: "editar_servico", label: "Editar serviço", descricao: "Edição dos dados cadastrados" },
      { id: "alterar_valor", label: "Alterar estimativa / dotação", descricao: "Modificação de valores estimados" },
      { id: "alterar_prioridade", label: "Alterar prioridade", descricao: "Modificação de prioridade" },
      { id: "adicionar_observacao", label: "Adicionar observação", descricao: "Edição de observações" },
      { id: "devolver_solicitacao", label: "Devolver solicitação", descricao: "Devolução de novo serviço para rascunho" },
      { id: "excluir_servico", label: "Excluir novo serviço", descricao: "Exclusão de serviços novos" },
      { id: "edicao_em_lote", label: "Edição em lote", descricao: "Alterações em massa de novos serviços" },
    ],
  },
  {
    id: "aprovacao",
    label: "Aprovação (Diretoria)",
    atividades: [
      { id: "todas", label: "Todas as Atividades de Aprovação" },
      { id: "aprovar", label: "Aprovar solicitações", descricao: "Aprovação de itens ou serviços das gerências" },
      { id: "reprovar", label: "Reprovar / Rejeitar", descricao: "Rejeição de solicitações com justificativa" },
      { id: "devolver", label: "Devolver para gerência", descricao: "Retorno da solicitação para rascunho da gerência" },
      { id: "enviar_compras", label: "Enviar para Compras", descricao: "Encaminhamento de itens aprovados para o setor de compras" },
      { id: "adicionar_item", label: "Adicionar item (Plano Próprio)", descricao: "Inclusão direta de itens no plano próprio da diretoria" },
      { id: "adicionar_servico", label: "Adicionar serviço (Plano Próprio)", descricao: "Inclusão direta de serviços no plano próprio da diretoria" },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    atividades: [
      { id: "todas", label: "Todas as Atividades de Compras" },
      { id: "receber_solicitacoes", label: "Receber solicitações", descricao: "Visualização e recepção de demandas encaminhadas" },
      { id: "processar_solicitacoes", label: "Processar solicitações", descricao: "Tramitação para cotação, compra ou conclusão" },
      { id: "alterar_informacoes", label: "Alterar informações", descricao: "Modificação de valores, dados contratuais e observações" },
      { id: "devolver_solicitacao", label: "Devolver solicitação", descricao: "Retorno da demanda para a diretoria/gerência" },
      { id: "excluir_solicitacao", label: "Excluir solicitação", descricao: "Exclusão de itens ou serviços em compras" },
      { id: "edicao_em_lote", label: "Edição em lote", descricao: "Alterações em massa no módulo de compras" },
    ],
  },
];
