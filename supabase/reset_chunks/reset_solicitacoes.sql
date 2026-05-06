-- ============================================================
-- RESET COMPLETO DE SOLICITAÇÕES E SERVIÇOS
-- Apaga os registros transacionais e recria as solicitações base.
-- ============================================================

-- 1. Histórico de status (apagado em cascata, mas forçamos por segurança)
DELETE FROM solicitacao_historico;

-- 2. Solicitações (itens de material/aquisição)
DELETE FROM solicitacoes;

-- 3. Serviços
DELETE FROM servicos;

-- 4. Recria solicitações base para todas as gerências ativas no período ativo
WITH periodo_ativo AS (
  SELECT id
  FROM periodos
  WHERE ativo = true
  ORDER BY fim DESC
  LIMIT 1
)
INSERT INTO solicitacoes (
  periodo_id,
  diretoria_id,
  gerencia_id,
  item_id,
  codigo,
  descricao,
  categoria,
  unidade,
  qtd_estimada,
  valor_unitario,
  prioridade,
  observacao,
  status
)
SELECT
  (SELECT id FROM periodo_ativo) AS periodo_id,
  g.diretoria_id,
  g.id AS gerencia_id,
  ic.id AS item_id,
  ic.codigo,
  ic.descricao,
  ic.categoria,
  ic.unidade,
  0 AS qtd_estimada,
  ic.valor_unitario,
  'Baixa' AS prioridade,
  NULL AS observacao,
  'rascunho' AS status
FROM gerencias g
CROSS JOIN itens_catalogo ic
WHERE g.ativa = true
  AND EXISTS (SELECT 1 FROM periodo_ativo);

-- Confirmar limpeza
SELECT
  (SELECT COUNT(*) FROM solicitacoes) AS solicitacoes_restantes,
  (SELECT COUNT(*) FROM servicos) AS servicos_restantes,
  (SELECT COUNT(*) FROM solicitacao_historico) AS historico_restante;
