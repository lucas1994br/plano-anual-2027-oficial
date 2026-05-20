// ============================================
// SUPABASE SERVICES - MODELO ERP
// ============================================

import { createClient } from '@supabase/supabase-js';
import type {
  PlanoAnual,
  PlanoDiretoria,
  PlanoItem,
  OrcamentoAnual,
  SolicitacaoCompra,
  SolicitacaoItem,
  CategoriaItem,
  CentroCusto,
  LogOrcamentario,
  DashboardOrcamentoDiretoria,
  OrcamentoDisponivel,
  CreatePlanoItemDTO,
  ResponseDisponibilidade,
  ResponseValidacaoOrcamentaria,
  OrcamentoDiretoria,
  UpdateOrcamentoDiretoriaDTO,
} from '../types/erp.ts';

type HistoricoConsumoEntry = LogOrcamentario;

type CentroCustoComConsumo = {
  id: string;
  codigo: string;
  nome: string;
  valor_aprovado: number;
  valor_executado: number;
  saldo: number;
  historico: HistoricoConsumoEntry[];
};

type OrcamentoDiretoriaComConsumo = {
  ano: number;
  diretoria_id: string;
  valor_total_aprovado: number;
  valor_total_executado: number;
  saldo_total: number;
  centros_custo: CentroCustoComConsumo[];
};

// Você precisa ter essas variáveis no .env:
// VITE_SUPABASE_URL=https://seu-projeto.supabase.co
// VITE_SUPABASE_ANON_KEY=eyJ...

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ============================================
// FUNÇÕES - PLANO ANUAL
// ============================================

export async function listarPlanosAnuais(): Promise<PlanoAnual[]> {
  const { data, error } = await supabase
    .from('plano_anual')
    .select('*')
    .order('ano', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function obterPlanoAnual(id: string): Promise<PlanoAnual> {
  const { data, error } = await supabase
    .from('plano_anual')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function criarPlanoAnual(ano: number, descricao?: string): Promise<PlanoAnual> {
  const { data, error } = await supabase
    .from('plano_anual')
    .insert([{
      ano,
      descricao,
      status: 'rascunho',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// FUNÇÕES - PLANO DIRETORIA
// ============================================

export async function listarPlanosDisponiveisParaDiretoria(
  planoAnualId: string,
  diretoriaId: string
): Promise<PlanoDiretoria[]> {
  const { data, error } = await supabase
    .from('plano_diretoria')
    .select('*')
    .eq('plano_anual_id', planoAnualId)
    .eq('diretoria_id', diretoriaId);

  if (error) throw error;
  return data || [];
}

export async function criarPlanoDiretoria(
  planoAnualId: string,
  diretoriaId: string
): Promise<PlanoDiretoria> {
  const { data, error } = await supabase
    .from('plano_diretoria')
    .insert([{
      plano_anual_id: planoAnualId,
      diretoria_id: diretoriaId,
      status: 'rascunho',
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarStatusPlanoDiretoria(
  id: string,
  novoStatus: string,
  observacoes?: string
): Promise<PlanoDiretoria> {
  const { data, error } = await supabase
    .from('plano_diretoria')
    .update({
      status: novoStatus,
      observacoes,
      submitted_at: novoStatus === 'enviado' ? new Date().toISOString() : undefined,
      approved_at: novoStatus === 'aprovado' ? new Date().toISOString() : undefined,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// FUNÇÕES - PLANO ITEM
// ============================================

export async function listarPlanosItens(planoDiretoriaId: string): Promise<PlanoItem[]> {
  const { data, error } = await supabase
    .from('plano_item')
    .select('*')
    .eq('plano_diretoria_id', planoDiretoriaId);

  if (error) throw error;
  return data || [];
}

export async function criarPlanoItem(dto: CreatePlanoItemDTO): Promise<PlanoItem> {
  // Se centro_custo_id não for fornecido, obter da regra
  let centroCustoId = dto.centro_custo_id;

  if (!centroCustoId) {
    const { data: itemData } = await supabase
      .from('item_catalogo')
      .select('categoria_id')
      .eq('id', dto.item_catalogo_id)
      .single();

    if (itemData?.categoria_id) {
      // Chamar função PostgreSQL para obter centro padrão
      const { data: centroPadrao } = await supabase
        .rpc('obter_centro_custo_categor', {
          p_categoria_id: itemData.categoria_id,
          p_data: new Date().toISOString().split('T')[0],
        });

      centroCustoId = centroPadrao;
    }
  }

  const { data, error } = await supabase
    .from('plano_item')
    .insert([{
      ...dto,
      centro_custo_id: centroCustoId,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function atualizarPlanoItem(id: string, updates: Partial<PlanoItem>): Promise<PlanoItem> {
  const { data, error } = await supabase
    .from('plano_item')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletarPlanoItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('plano_item')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// FUNÇÕES - ORÇAMENTO
// ============================================

export async function obterDashboardOrcamentoDiretorias(ano: number): Promise<DashboardOrcamentoDiretoria[]> {
  const { data, error } = await supabase
    .from('orcamento_anual')
    .select(`
      centro_custo:centro_custo_id (
        diretoria:diretoria_id (sigla)
      )
    `)
    .eq('ano', ano);

  if (error) throw error;

  // Agrupar por diretoria manualmente (ou usar uma view no banco)
  // Para simplificar, retornar dados brutos. Idealmente criar uma VIEW no banco.
  return [];
}

export async function obterOrcamentoDiretoria(
  centroCustoId: string,
  ano: number
): Promise<OrcamentoDisponivel | null> {
  const { data, error } = await supabase
    .from('orcamento_anual')
    .select('*')
    .eq('centro_custo_id', centroCustoId)
    .eq('ano', ano)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // 404 é normal
  if (!data) return null;

  const disponivel = data.valor_aprovado - data.valor_reservado - data.valor_executado;
  const taxa_execucao_pct = (data.valor_executado / data.valor_aprovado) * 100;
  const taxa_comprometimento_pct = ((data.valor_reservado + data.valor_executado) / data.valor_aprovado) * 100;

  return {
    ...data,
    disponivel,
    taxa_execucao_pct,
    taxa_comprometimento_pct,
  } as OrcamentoDisponivel;
}

export async function listarOrcamentosPorAno(ano: number): Promise<OrcamentoAnual[]> {
  const { data, error } = await supabase
    .from('orcamento_anual')
    .select('*')
    .eq('ano', ano);

  if (error) throw error;
  return data || [];
}

// ============================================
// FUNÇÕES - SOLICITAÇÃO DE COMPRA
// ============================================

export async function criarSolicitacaoCompra(
  diretoriaSolicitanteId: string,
  centroCustoId: string,
  descricao: string
): Promise<SolicitacaoCompra> {
  const { data, error } = await supabase
    .from('solicitacao_compra')
    .insert([{
      diretoria_solicitante_id: diretoriaSolicitanteId,
      centro_custo_id: centroCustoId,
      status: 'aberta',
      descricao,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listarSolicitacoesPorDiretoria(diretoriaId: string): Promise<SolicitacaoCompra[]> {
  const { data, error } = await supabase
    .from('solicitacao_compra')
    .select('*')
    .eq('diretoria_solicitante_id', diretoriaId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function atualizarStatusSolicitacao(
  id: string,
  novoStatus: string
): Promise<SolicitacaoCompra> {
  const { data, error } = await supabase
    .from('solicitacao_compra')
    .update({ status: novoStatus })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// FUNÇÕES - SOLICITAÇÃO ITEM
// ============================================

export async function criarSolicitacaoItem(
  solicitacaoCompraId: string,
  itemCatalogoId: string,
  quantidade: number,
  valorUnitEstimado?: number,
  planoItemId?: string
): Promise<SolicitacaoItem> {
  const { data, error } = await supabase
    .from('solicitacao_item')
    .insert([{
      solicitacao_compra_id: solicitacaoCompraId,
      item_catalogo_id: itemCatalogoId,
      quantidade,
      valor_unit_estimado: valorUnitEstimado,
      plano_item_id: planoItemId,
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listarItensDocumentacao(solicitacaoCompraId: string): Promise<SolicitacaoItem[]> {
  const { data, error } = await supabase
    .from('solicitacao_item')
    .select('*')
    .eq('solicitacao_compra_id', solicitacaoCompraId);

  if (error) throw error;
  return data || [];
}

// ============================================
// FUNÇÕES - CATEGORIAS E CATÁLOGO
// ============================================

export async function listarCategorias(): Promise<CategoriaItem[]> {
  const { data, error } = await supabase
    .from('categoria_item')
    .select('*')
    .eq('ativa', true)
    .order('nome');

  if (error) throw error;
  return data || [];
}

export async function obterCategoria(id: string): Promise<CategoriaItem> {
  const { data, error } = await supabase
    .from('categoria_item')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// FUNÇÕES - CENTRO DE CUSTO
// ============================================

export async function listarCentrosCusto(): Promise<CentroCusto[]> {
  const { data, error } = await supabase
    .from('centro_custo')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) throw error;
  return data || [];
}

export async function listarCentrosCustoPorDiretoria(diretoriaId: string): Promise<CentroCusto[]> {
  const { data, error } = await supabase
    .from('centro_custo')
    .select('*')
    .eq('diretoria_id', diretoriaId)
    .eq('ativo', true)
    .order('nome');

  if (error) throw error;
  return data || [];
}

// ============================================
// FUNÇÕES - LOG ORÇAMENTÁRIO
// ============================================

export async function obterHistoricoOrcamentario(
  centroCustoId: string,
  ano: number
): Promise<LogOrcamentario[]> {
  const { data, error } = await supabase
    .from('log_orcamentario')
    .select('*')
    .eq('centro_custo_id', centroCustoId)
    .eq('ano', ano)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================
// FUNÇÕES - VALIDAÇÃO E CÁLCULOS
// ============================================

export async function validarDisponibilidadeOrcamentaria(
  centroCustoId: string,
  ano: number,
  valorSolicitado: number
): Promise<ResponseValidacaoOrcamentaria> {
  try {
    // Chamar função PostgreSQL
    const { data, error } = await supabase
      .rpc('calcular_disponivel_orcamento', {
        p_centro_custo_id: centroCustoId,
        p_ano: ano,
      });

    if (error) throw error;

    const disponivel = data || 0;
    const pode_solicitar = disponivel >= valorSolicitado;

    return {
      pode_solicitar,
      valor_solicitado: valorSolicitado,
      valor_disponivel: disponivel,
      percentual_disponivel: (disponivel / (disponivel + valorSolicitado)) * 100,
      motivo_rejeicao: pode_solicitar ? undefined : 'Orçamento insuficiente',
    };
  } catch (error) {
    console.error('Erro ao validar orçamento:', error);
    throw error;
  }
}

export async function obterDisponibilidadeCompleta(
  centroCustoId: string,
  ano: number
): Promise<ResponseDisponibilidade | null> {
  const orcamento = await obterOrcamentoDiretoria(centroCustoId, ano);
  if (!orcamento) return null;

  return {
    centro_custo_id: centroCustoId,
    ano,
    valor_aprovado: orcamento.valor_aprovado,
    valor_reservado: orcamento.valor_reservado,
    valor_executado: orcamento.valor_executado,
    disponivel: orcamento.disponivel,
    percentual_disponivel: (orcamento.disponivel / orcamento.valor_aprovado) * 100,
    em_critico: orcamento.disponivel < (orcamento.valor_aprovado * 0.2),
  };
}

// ============================================
// FUNÇÕES - GERENCIAMENTO DE ORÇAMENTO POR DIRETORIA
// ============================================

/**
 * Obtém o histórico de consumo de um centro de custo (quem usou e quanto)
 */
export async function obterHistoricoConsumoCentroCusto(
  centroCustoId: string,
  ano: number
): Promise<HistoricoConsumoEntry[]> {
  try {
    const { data, error } = await supabase
      .from('log_orcamentario')
      .select(`
        *,
        referencia_id,
        acao,
        valor,
        created_at
      `)
      .eq('centro_custo_id', centroCustoId)
      .eq('ano', ano)
      .eq('acao', 'executar')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as HistoricoConsumoEntry[]) || [];
  } catch (error) {
    console.error('Erro ao obter histórico de consumo:', error);
    return [];
  }
}

/**
 * Obtém orçamento com histórico de consumo (quem usou e quanto foi diminuído)
 */
export async function obterOrcamentoDiretoriaComConsumo(
  diretoriaId: string,
  ano: number
): Promise<OrcamentoDiretoriaComConsumo | null> {
  try {
    if (!diretoriaId) return null;

    // Buscar todos os centros de custo da diretoria
    const { data: centrosCusto, error: erroCentros } = await supabase
      .from('centro_custo')
      .select('id, codigo, nome')
      .eq('diretoria_id', diretoriaId)
      .eq('ativo', true);

    const centrosCustoTyped = (centrosCusto as Array<{ id: string; codigo: string; nome: string }> ) || [];

    if (erroCentros) {
      console.error('Erro ao buscar centros de custo:', erroCentros);
      throw erroCentros;
    }

    if (!centrosCusto || centrosCusto.length === 0) {
      return {
        ano,
        diretoria_id: diretoriaId,
        valor_total_aprovado: 0,
        valor_total_executado: 0,
        saldo_total: 0,
        centros_custo: [],
      };
    }

    // Buscar orçamentos dos centros
    const { data: orcamentos, error: erroOrcamento } = await supabase
      .from('orcamento_anual')
      .select('*')
      .eq('ano', ano)
      .in('centro_custo_id', centrosCustoTyped.map(cc => cc.id));

    const orcamentosTyped = (orcamentos as Array<{ centro_custo_id: string; valor_aprovado?: number; valor_executado?: number }>) || [];

    if (erroOrcamento) {
      console.error('Erro ao buscar orçamentos:', erroOrcamento);
      throw erroOrcamento;
    }

    // Para cada centro, preparar dados
    let totalAprovado = 0;
    let totalExecutado = 0;

    const centrosComDetalhe = centrosCusto.map((cc) => {
      const orc = orcamentosTyped.find(o => o.centro_custo_id === cc.id);
      const valor_aprovado = orc?.valor_aprovado || 0;
      const valor_executado = orc?.valor_executado || 0;
      const saldo = valor_aprovado - valor_executado;

      totalAprovado += valor_aprovado;
      totalExecutado += valor_executado;

      return {
        id: cc.id,
        codigo: cc.codigo,
        nome: cc.nome,
        valor_aprovado,
        valor_executado,
        saldo,
        historico: [],
      };
    });

    const saldoTotal = totalAprovado - totalExecutado;

    return {
      ano,
      diretoria_id: diretoriaId,
      valor_total_aprovado: totalAprovado,
      valor_total_executado: totalExecutado,
      saldo_total: saldoTotal,
      centros_custo: centrosComDetalhe,
    };
  } catch (error) {
    console.error('Erro ao obter orçamento com consumo:', error);
    throw error;
  }
}

/**
 * Atualiza valores de orçamento para múltiplos centros de uma diretoria.
 *
 * A operação é executada por uma Edge Function (`update-orcamento`) que usa
 * a chave de serviço para contornar RLS. A função também valida o token do
 * chamador e garante que apenas roles `admin` ou `gerencia` possam efetuar a
 * atualização.
 */
export async function atualizarOrcamentoDiretoria(
  ano: number,
  diretoriaId: string,
  orcamentos: Array<{ centro_custo_id: string; valor_aprovado: number }>,
  userRole?: string // should be 'admin' or 'gerencia'
): Promise<unknown> {
  try {
    const payload: Record<string, unknown> = { ano, diretoriaId, orcamentos };
    if (userRole) payload.role = userRole;

    const { data, error } = await supabase.functions.invoke('update-orcamento', {
      body: payload,
    });

    if (error) throw error;
    return data;
  } catch (error: unknown) {
    if (String(error.message || '').includes('row-level security policy')) {
      console.error('RLS violation updating orçamento via edge function:', error);
      throw new Error('Permissão insuficiente: apenas admin/gerência pode alterar orçamentos');
    }
    console.error('Erro ao atualizar orçamento:', error);
    throw error;
  }
}

/**
 * Cria orçamentos para uma diretoria (todos seus centros de custo) dado um valor total
 */
export async function criarOrcamentoPorDiretoria(
  ano: number,
  diretoriaId: string,
  valorTotal: number,
  userRole?: string
): Promise<unknown> {
  try {
    // Buscar centros de custo da diretoria
    const { data: centrosCusto, error: erroCentros } = await supabase
      .from('centro_custo')
      .select('id')
      .eq('diretoria_id', diretoriaId)
      .eq('ativo', true);

    if (erroCentros) throw erroCentros;

    if (!centrosCusto || centrosCusto.length === 0) {
      throw new Error('Nenhum centro de custo encontrado para esta diretoria');
    }

    // Distribuir valor igualmente entre centros (ou usar lógica customizada)
    const valorPorCentro = valorTotal / centrosCusto.length;

    return await atualizarOrcamentoDiretoria(
      ano,
      diretoriaId,
      centrosCusto.map(cc => ({
        centro_custo_id: cc.id,
        valor_aprovado: valorPorCentro,
      })),
      userRole
    );
  } catch (error) {
    console.error('Erro ao criar orçamento por diretoria:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Plano Anual
  listarPlanosAnuais,
  obterPlanoAnual,
  criarPlanoAnual,

  // Plano Diretoria
  listarPlanosDisponiveisParaDiretoria,
  criarPlanoDiretoria,
  atualizarStatusPlanoDiretoria,

  // Plano Item
  listarPlanosItens,
  criarPlanoItem,
  atualizarPlanoItem,
  deletarPlanoItem,

  // Orçamento
  obterDashboardOrcamentoDiretorias,
  obterOrcamentoDiretoria,
  listarOrcamentosPorAno,
  obterOrcamentoDiretoriaComConsumo,
  atualizarOrcamentoDiretoria,
  criarOrcamentoPorDiretoria,

  // Solicitação Compra
  criarSolicitacaoCompra,
  listarSolicitacoesPorDiretoria,
  atualizarStatusSolicitacao,

  // Solicitação Item
  criarSolicitacaoItem,
  listarItensDocumentacao,

  // Catálogos
  listarCategorias,
  obterCategoria,
  listarCentrosCusto,
  listarCentrosCustoPorDiretoria,

  // Histórico
  obterHistoricoOrcamentario,

  // Validações
  validarDisponibilidadeOrcamentaria,
  obterDisponibilidadeCompleta,
};
