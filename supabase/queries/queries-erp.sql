-- ============================================
-- QUERIES ÚTEIS - MODELO ERP
-- ============================================

-- ============================================
-- VISIBILIDADE E MONITORAMENTO
-- ============================================

-- 1. Dashboard de Orçamento Por Diretoria (2026)
select 
  d.sigla as diretoria,
  count(distinct cc.id) as qtd_centros,
  sum(oa.valor_aprovado) as total_aprovado,
  sum(oa.valor_reservado) as total_reservado,
  sum(oa.valor_executado) as total_executado,
  sum(oa.valor_aprovado) - sum(oa.valor_reservado) - sum(oa.valor_executado) as disponivel
from diretorias d
left join centro_custo cc on cc.diretoria_id = d.id and cc.ativo = true
left join orcamento_anual oa on oa.centro_custo_id = cc.id and oa.ano = 2026
where d.ativa = true
group by d.id, d.sigla
order by diretoria;

-- 2. Orçamento Detalhado Por Centro de Custo
select 
  d.sigla,
  cc.codigo,
  cc.nome,
  oa.valor_aprovado,
  oa.valor_reservado,
  oa.valor_executado,
  (oa.valor_aprovado - oa.valor_reservado - oa.valor_executado) as disponivel,
  round(100.0 * oa.valor_executado / nullif(oa.valor_aprovado, 0), 2) as taxa_execucao_pct,
  round(100.0 * (oa.valor_reservado + oa.valor_executado) / nullif(oa.valor_aprovado, 0), 2) as taxa_comprometimento_pct
from orcamento_anual oa
join centro_custo cc on cc.id = oa.centro_custo_id
join diretorias d on d.id = cc.diretoria_id
where oa.ano = 2026
order by d.sigla, cc.nome;

-- 3. Categorias Com Mais Gastos Planejados
select 
  ci.nome as categoria,
  count(distinct pi.id) as qtd_itens_planejados,
  sum(pi.quantidade_prevista) as qtd_total,
  sum(pi.quantidade_prevista * coalesce(pi.valor_unit_previsto, 0)) as valor_total_previsto
from categoria_item ci
left join item_catalogo ic on ic.categoria_id = ci.id
left join plano_item pi on pi.item_catalogo_id = ic.id
left join plano_diretoria pd on pd.id = pi.plano_diretoria_id
where ci.ativa = true
  and (pd.plano_anual_id = (select id from plano_anual where ano = 2026) or pd.id is null)
group by ci.id, ci.nome
order by valor_total_previsto desc;

-- 4. Itens Críticos (com risco de exceder orçamento)
select 
  d.sigla,
  pi.id,
  ic.descricao,
  pi.quantidade_prevista,
  pi.valor_unit_previsto,
  (pi.quantidade_prevista * pi.valor_unit_previsto) as valor_previsto,
  cc.nome as centro_pagador,
  (select (oa.valor_aprovado - oa.valor_reservado - oa.valor_executado)
   from orcamento_anual oa 
   where oa.centro_custo_id = pi.centro_custo_id and oa.ano = 2026) as disponivel_centro,
  case 
    when (pi.quantidade_prevista * pi.valor_unit_previsto) > 
         (select coalesce((oa.valor_aprovado - oa.valor_reservado - oa.valor_executado), 0)
          from orcamento_anual oa 
          where oa.centro_custo_id = pi.centro_custo_id and oa.ano = 2026)
    then 'CRÍTICO'
    when (pi.quantidade_prevista * pi.valor_unit_previsto) > 
         (select coalesce((oa.valor_aprovado - oa.valor_reservado - oa.valor_executado), 0), 0) * 0.8
    then 'ATENÇÃO'
    else 'OK'
  end as status
from plano_item pi
join plano_diretoria pd on pd.id = pi.plano_diretoria_id
join diretorias d on d.id = pd.diretoria_id
join item_catalogo ic on ic.id = pi.item_catalogo_id
join centro_custo cc on cc.id = pi.centro_custo_id
where pd.plano_anual_id = (select id from plano_anual where ano = 2026 limit 1)
  and pi.valor_unit_previsto is not null
order by valor_previsto desc;

-- ============================================
-- RASTREAMENTO ORÇAMENTÁRIO
-- ============================================

-- 5. Histórico Completo de Movimentação de um Centro
select 
  lo.created_at,
  lo.acao,
  lo.valor,
  lo.referencia_tipo,
  case 
    when lo.referencia_tipo = 'plano_item' then (select ic.descricao from plano_item pi join item_catalogo ic on ic.id = pi.item_catalogo_id where pi.id = lo.referencia_id)
    when lo.referencia_tipo = 'solicitacao_compra' then (select sc.descricao from solicitacao_compra sc where sc.id = lo.referencia_id)
    else 'Compra'
  end as descricao,
  lo.referencia_id
from log_orcamentario lo
where lo.centro_custo_id = 'ID_DO_CENTRO'::uuid
  and lo.ano = 2026
order by lo.created_at desc;

-- 6. Auditoria: Eventos de Estorno
select 
  d.sigla,
  cc.nome,
  count(*) as qtd_estornos,
  sum(lo.valor) as valor_estornado,
  max(lo.created_at) as ultimo_estorno
from log_orcamentario lo
join centro_custo cc on cc.id = lo.centro_custo_id
join diretorias d on d.id = cc.diretoria_id
where lo.acao in ('estornar_reserva', 'estornar_execucao')
  and lo.ano = 2026
group by d.id, d.sigla, cc.id, cc.nome
order by qtd_estornos desc;

-- ============================================
-- PLANEJAMENTO DE COMPRAS
-- ============================================

-- 7. Próximas Compras Previstas Por Mês
select 
  pi.meta_mes,
  case 
    when pi.meta_mes = 1 then 'Janeiro'
    when pi.meta_mes = 2 then 'Fevereiro'
    when pi.meta_mes = 3 then 'Março'
    when pi.meta_mes = 4 then 'Abril'
    when pi.meta_mes = 5 then 'Maio'
    when pi.meta_mes = 6 then 'Junho'
    when pi.meta_mes = 7 then 'Julho'
    when pi.meta_mes = 8 then 'Agosto'
    when pi.meta_mes = 9 then 'Setembro'
    when pi.meta_mes = 10 then 'Outubro'
    when pi.meta_mes = 11 then 'Novembro'
    when pi.meta_mes = 12 then 'Dezembro'
  end as mes_texto,
  count(pi.id) as qtd_itens,
  sum(pi.quantidade_prevista * coalesce(pi.valor_unit_previsto, 0)) as valor_previsto
from plano_item pi
join plano_diretoria pd on pd.id = pi.plano_diretoria_id
where pd.plano_anual_id = (select id from plano_anual where ano = 2026 limit 1)
  and pi.meta_mes is not null
group by pi.meta_mes
order by pi.meta_mes;

-- 8. Itens Planejados Que Não Foram Solicitados Ainda
select 
  d.sigla,
  ic.descricao,
  pi.quantidade_prevista,
  pi.valor_unit_previsto,
  pi.prioridade,
  pi.meta_mes,
  pi.justificativa
from plano_item pi
join plano_diretoria pd on pd.id = pi.plano_diretoria_id
join diretorias d on d.id = pd.diretoria_id
join item_catalogo ic on ic.id = pi.item_catalogo_id
where pd.plano_anual_id = (select id from plano_anual where ano = 2026 limit 1)
  and not exists (
    select 1 from solicitacao_item si
    where si.plano_item_id = pi.id
  )
order by d.sigla, pi.prioridade;

-- 9. Comparativo: Plano vs Execução
select 
  d.sigla,
  ic.descricao,
  
  -- Planejado
  pi.quantidade_prevista as plano_qtd,
  pi.valor_unit_previsto as plano_valor_unit,
  (pi.quantidade_prevista * pi.valor_unit_previsto) as plano_total,
  
  -- Executado
  sum(si.quantidade) as exec_qtd,
  avg(si.valor_unit_final) as exec_valor_unit,
  sum(si.quantidade * coalesce(si.valor_unit_final, 0)) as exec_total,
  
  -- Diferença
  sum(si.quantidade) - pi.quantidade_prevista as diff_qtd,
  sum(si.quantidade * coalesce(si.valor_unit_final, 0)) - (pi.quantidade_prevista * pi.valor_unit_previsto) as diff_valor
  
from plano_item pi
left join solicitacao_item si on si.plano_item_id = pi.id
left join solicitacao_compra sc on sc.id = si.solicitacao_compra_id and sc.status = 'comprada'
join plano_diretoria pd on pd.id = pi.plano_diretoria_id
join diretorias d on d.id = pd.diretoria_id
join item_catalogo ic on ic.id = pi.item_catalogo_id
where pd.plano_anual_id = (select id from plano_anual where ano = 2026 limit 1)
  and sc.id is not null
group by pi.id, d.sigla, ic.descricao, pi.quantidade_prevista, pi.valor_unit_previsto
order by d.sigla, ic.descricao;

-- ============================================
-- ANÁLISE DE CENTROS DE CUSTO
-- ============================================

-- 10. Taxa de Execução por Centro
select 
  cc.codigo,
  cc.nome,
  d.sigla,
  oa.valor_aprovado,
  oa.valor_reservado,
  oa.valor_executado,
  round(100.0 * oa.valor_executado / nullif(oa.valor_aprovado, 0), 1) as execucao_pct,
  case 
    when oa.valor_executado >= oa.valor_aprovado * 0.9 then 'CRÍTICO'
    when oa.valor_executado >= oa.valor_aprovado * 0.75 then 'ALTO'
    when oa.valor_executado >= oa.valor_aprovado * 0.5 then 'MÉDIO'
    else 'BAIXO'
  end as nivel_execucao
from orcamento_anual oa
join centro_custo cc on cc.id = oa.centro_custo_id
join diretorias d on d.id = cc.diretoria_id
where oa.ano = 2026
order by execucao_pct desc;

-- ============================================
-- VALIDAÇÕES E INTEGRIDADE
-- ============================================

-- 11. Centros Sem Orçamento Definido
select 
  cc.codigo,
  cc.nome,
  d.sigla
from centro_custo cc
join diretorias d on d.id = cc.diretoria_id
where cc.ativo = true
  and not exists (
    select 1 from orcamento_anual oa
    where oa.centro_custo_id = cc.id and oa.ano = 2026
  );

-- 12. Categorias Sem Regra de Centro
select 
  ci.id,
  ci.nome
from categoria_item ci
where ci.ativa = true
  and not exists (
    select 1 from regra_categoria_centro_custo rcc
    where rcc.categoria_id = ci.id
      and rcc.ativo = true
      and rcc.vigencia_inicio <= current_date
      and (rcc.vigencia_fim is null or rcc.vigencia_fim >= current_date)
  );

-- 13. Itens do Catálogo Sem Categoria
select 
  ic.id,
  ic.codigo,
  ic.descricao
from item_catalogo ic
where ic.ativo = true
  and ic.categoria_id is null;

-- 14. Solicitações Antigas Não Finalizadas
select 
  sc.id,
  d.sigla,
  sc.descricao,
  sc.status,
  sc.created_at,
  current_date - sc.created_at as dias_aberta
from solicitacao_compra sc
join diretorias d on d.id = sc.diretoria_solicitante_id
where sc.status in ('aberta', 'em_cotacao')
  and sc.created_at < current_date - interval '30 days'
order by sc.created_at;
