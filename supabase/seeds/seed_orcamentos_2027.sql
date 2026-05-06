-- ============================================
-- SEED DE ORÇAMENTOS 2027 - DIRETORIAS
-- ============================================
-- Arquivo: supabase/seed_orcamentos_2027.sql
-- Descrição: Popula os orçamentos iniciais para as diretorias baseado nos valores informados

-- Tabela: diretorias + seus centros de custo + orçamentos

-- Assegurar que os centros de custo existem
INSERT INTO centro_custo (codigo, nome, diretoria_id, ativo)
SELECT '2000-DG', 'Centro Administrativo - DG', id, true
FROM diretorias WHERE sigla = 'DG' AND NOT EXISTS (
  SELECT 1 FROM centro_custo WHERE codigo = '2000-DG'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO centro_custo (codigo, nome, diretoria_id, ativo)
SELECT '3000-DO', 'Centro Operacional - DO', id, true
FROM diretorias WHERE sigla = 'DO' AND NOT EXISTS (
  SELECT 1 FROM centro_custo WHERE codigo = '3000-DO'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO centro_custo (codigo, nome, diretoria_id, ativo)
SELECT '4000-DE', 'Centro de Engenharia - DE', id, true
FROM diretorias WHERE sigla = 'DE' AND NOT EXISTS (
  SELECT 1 FROM centro_custo WHERE codigo = '4000-DE'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO centro_custo (codigo, nome, diretoria_id, ativo)
SELECT '5000-DC', 'Centro Comercial - DC', id, true
FROM diretorias WHERE sigla = 'DC' AND NOT EXISTS (
  SELECT 1 FROM centro_custo WHERE codigo = '5000-DC'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO centro_custo (codigo, nome, diretoria_id, ativo)
SELECT '1000-PR', 'Centro Estratégico - PR', id, true
FROM diretorias WHERE sigla = 'PR' AND NOT EXISTS (
  SELECT 1 FROM centro_custo WHERE codigo = '1000-PR'
)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- INSERIR ORÇAMENTOS ANUAIS - 2027
-- ============================================

-- DG: R$ 100.000.000,00
INSERT INTO orcamento_anual (ano, centro_custo_id, valor_aprovado, valor_reservado, valor_executado)
SELECT 2027, cc.id, 100000000.00, 0, 0
FROM centro_custo cc
WHERE cc.codigo = '2000-DG'
ON CONFLICT (ano, centro_custo_id) DO UPDATE SET valor_aprovado = 100000000.00;

-- DO: R$ 300.000.000,00
INSERT INTO orcamento_anual (ano, centro_custo_id, valor_aprovado, valor_reservado, valor_executado)
SELECT 2027, cc.id, 300000000.00, 0, 0
FROM centro_custo cc
WHERE cc.codigo = '3000-DO'
ON CONFLICT (ano, centro_custo_id) DO UPDATE SET valor_aprovado = 300000000.00;

-- DE: R$ 130.000.000,00
INSERT INTO orcamento_anual (ano, centro_custo_id, valor_aprovado, valor_reservado, valor_executado)
SELECT 2027, cc.id, 130000000.00, 0, 0
FROM centro_custo cc
WHERE cc.codigo = '4000-DE'
ON CONFLICT (ano, centro_custo_id) DO UPDATE SET valor_aprovado = 130000000.00;

-- DC: R$ 25.000.000,00
INSERT INTO orcamento_anual (ano, centro_custo_id, valor_aprovado, valor_reservado, valor_executado)
SELECT 2027, cc.id, 25000000.00, 0, 0
FROM centro_custo cc
WHERE cc.codigo = '5000-DC'
ON CONFLICT (ano, centro_custo_id) DO UPDATE SET valor_aprovado = 25000000.00;

-- PR: R$ 12.000.000,00
INSERT INTO orcamento_anual (ano, centro_custo_id, valor_aprovado, valor_reservado, valor_executado)
SELECT 2027, cc.id, 12000000.00, 0, 0
FROM centro_custo cc
WHERE cc.codigo = '1000-PR'
ON CONFLICT (ano, centro_custo_id) DO UPDATE SET valor_aprovado = 12000000.00;

-- ============================================
-- TOTAL ORÇAMENTÁRIO: R$ 567.000.000,00
-- ============================================

-- Query para verificar os orçamentos criados:
-- SELECT 
--   d.sigla,
--   d.nome,
--   cc.codigo,
--   cc.nome as centro_nome,
--   oa.ano,
--   oa.valor_aprovado,
--   oa.valor_executado,
--   (oa.valor_aprovado - oa.valor_executado) as disponivel
-- FROM orcamento_anual oa
-- JOIN centro_custo cc ON oa.centro_custo_id = cc.id
-- JOIN diretorias d ON cc.diretoria_id = d.id
-- WHERE oa.ano = 2027
-- ORDER BY d.sigla;
