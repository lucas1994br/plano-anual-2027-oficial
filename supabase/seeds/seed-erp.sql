-- ============================================
-- SEED DATA - MODELO ERP
-- ============================================

-- Limpar dados existentes (se necessário)
-- truncate table categoria_item cascade;
-- truncate table centro_custo cascade;
-- truncate table fornecedor cascade;
 
-- ============================================
-- 1. CATEGORIAS DE ITENS
-- ============================================

insert into categoria_item (nome, descricao, ativa) values
  ('Material de Expediente', 'Papéis, canetas, pastas e outros itens de escritório', true),
  ('Informática e TI', 'Computadores, servidores, software, licenças', true),
  ('Móveis e Decoração', 'Mesas, cadeiras, armários, itens de decoração', true),
  ('Limpeza e Higiene', 'Produtos de limpeza, higiene pessoal, desinfetantes', true),
  ('Serviços Gerais', 'Contratos de limpeza, vigilância, manutenção', true),
  ('Viagens e Deslocamentos', 'Passagens aéreas, hospedagem, combustível', true),
  ('Eventos e Reuniões', 'Catering, locação de espaço, material de divulgação', true),
  ('Infraestrutura', 'Obras, reformas, manutenção predial', true),
  ('Equipamentos Especializados', 'Equipamentos técnicos, laboratório, etc', true),
  ('Consultoria e Treinamento', 'Serviços de consultoria, treinamentos, capacitação', true)
on conflict do nothing;

-- ============================================
-- 2. CENTROS DE CUSTO (por diretoria)
-- ============================================

insert into centro_custo (codigo, nome, diretoria_id, ativo) 
select 
  'CC-ADM-' || d.sigla,
  'Administrativo - ' || d.sigla,
  d.id,
  true
from diretorias d
where ativa = true
on conflict (codigo) do nothing;

insert into centro_custo (codigo, nome, diretoria_id, ativo) 
select  
  'CC-OPER-' || d.sigla,
  'Operacional - ' || d.sigla,
  d.id,
  true
from diretorias d
where ativa = true
on conflict (codigo) do nothing;

insert into centro_custo (codigo, nome, diretoria_id, ativo) 
select  
  'CC-PESSOAL-' || d.sigla,
  'Pessoal/RH - ' || d.sigla,
  d.id,
  true
from diretorias d
where ativa = true
on conflict (codigo) do nothing;

-- ============================================
-- 3. REGRAS DE CATEGORIA → CENTRO DE CUSTO
-- ============================================

-- Para cada diretoria, criar regras mapeando categorias
with diretorias_list as (
  select distinct d.id, d.sigla
  from diretorias d
  where d.ativa = true
),
categorias_list as (
  select id, nome from categoria_item where ativa = true
),
centros_adm as (
  select id, diretoria_id from centro_custo 
  where codigo like 'CC-ADM-%'
),
centros_oper as (
  select id, diretoria_id from centro_custo
  where codigo like 'CC-OPER-%'
)
insert into regra_categoria_centro_custo (categoria_id, centro_custo_id, vigencia_inicio, ativo)
select distinct 
  c.id,
  case 
    when c.nome in ('Material de Expediente', 'Limpeza e Higiene', 'Móveis e Decoração')
      then ca.id
    when c.nome in ('Informática e TI', 'Infraestrutura', 'Equipamentos Especializados')
      then co.id
    else ca.id
  end as centro_id,
  current_date,
  true
from categorias_list c
cross join diretorias_list d
left join centros_adm ca on ca.diretoria_id = d.id
left join centros_oper co on co.diretoria_id = d.id
where (case 
  when c.nome in ('Material de Expediente', 'Limpeza e Higiene', 'Móveis e Decoração')
    then ca.id
  when c.nome in ('Informática e TI', 'Infraestrutura', 'Equipamentos Especializados')
    then co.id
  else ca.id
end) is not null
on conflict (categoria_id, centro_custo_id, vigencia_inicio) do nothing;

-- ============================================
-- 4. FORNECEDORES PADRÃO
-- ============================================

insert into fornecedor (cnpj, razao_social, nome_fantasia, ativo) values
  ('12.345.678/0001-90', 'Distribuidora Nacional de Materiais de Expediente LTDA', 'Distribuidora Nacional', true),
  ('98.765.432/0001-10', 'Soluções em Informática Profissional SA', 'Soluções TI', true),
  ('55.555.555/0001-55', 'Móveis Corporativos Industriais LTDA', 'Móveis Corp', true),
  ('77.777.777/0001-77', 'Serviços de Limpeza Total LTDA', 'Limpeza Total', true),
  ('44.444.444/0001-44', 'Vigilância e Segurança Premium LTDA', 'Vigilância Premium', true),
  ('33.333.333/0001-33', 'Agência de Viagens Corporativa JIT', 'Viagens JIT', true),
  ('66.666.666/0001-66', 'Construção e Reformas Rápido LTDA', 'Reformas Rápido', true),
  ('11.111.111/0001-11', 'Instituto de Consultoria e Treinamento ITC', 'Instituto ITC', true)
on conflict (cnpj) do nothing;

-- ============================================
-- 5. PLANO ANUAL INICIAL
-- ============================================

insert into plano_anual (ano, status, descricao) values
  (2026, 'rascunho', 'Plano Orçamentário Anual 2026'),
  (2027, 'rascunho', 'Plano Orçamentário Anual 2027')
on conflict (ano) do nothing;

-- ============================================
-- 6. ORÇAMENTOS INICIAIS POR CENTRO DE CUSTO
-- ============================================

insert into orcamento_anual (ano, centro_custo_id, valor_aprovado)
select 
  2026 as ano,
  cc.id,
  case 
    when cc.codigo like '%ADM%' then 50000.00
    when cc.codigo like '%OPER%' then 100000.00
    when cc.codigo like '%PESSOAL%' then 75000.00
    else 50000.00
  end as valor_inicial
from centro_custo cc
where cc.ativo = true
on conflict (ano, centro_custo_id) do nothing;

insert into orcamento_anual (ano, centro_custo_id, valor_aprovado)
select 
  2027 as ano,
  cc.id,
  case 
    when cc.codigo like '%ADM%' then 55000.00
    when cc.codigo like '%OPER%' then 110000.00
    when cc.codigo like '%PESSOAL%' then 82500.00
    else 55000.00
  end as valor_inicial
from centro_custo cc
where cc.ativo = true
on conflict (ano, centro_custo_id) do nothing;

-- ============================================
-- RESUMO
-- ============================================
-- Executar este script após criar as tabelas com schema.sql
-- Isso vai popular:
-- - 10 categorias de itens
-- - 1 centro de custo (ADM, OPER, PESSOAL) por diretoria
-- - Regras de mapeamento categoria → centro de custo
-- - 8 fornecedores padrão
-- - 2 planos anuais (2026 e 2027)
-- - Orçamentos iniciais para cada centro de custo
