-- 4. Criar solicitações para todas as gerências ativas (quantidade 0, status rascunho)
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
  (SELECT id FROM periodos WHERE ativo = true LIMIT 1) as periodo_id,
  g.diretoria_id as diretoria_id,
  g.id as gerencia_id,
  ic.id as item_id,
  ic.codigo,
  ic.descricao,
  ic.categoria,
  ic.unidade,
  0 as qtd_estimada,
  ic.valor_unitario,
  'Baixa' as prioridade,
  NULL as observacao,
  'rascunho' as status
FROM gerencias g
CROSS JOIN itens_catalogo ic
WHERE g.ativa = true;
