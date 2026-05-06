-- Script para atualizar status de alguns serviços para 'enviado'
-- Execute este script no Supabase SQL Editor

-- Atualizar primeiros 4 serviços para status 'enviado'
UPDATE servicos
SET status = 'enviado'
WHERE item IN (1, 2, 3, 4, 5, 6)
  AND status = 'rascunho';

-- Verificar os serviços atualizados
SELECT 
  s.item,
  s.objeto,
  g.sigla as gerencia,
  d.sigla as diretoria,
  s.grau_prioridade,
  s.vinculacao,
  s.estimativa_valor,
  s.status
FROM servicos s
JOIN gerencias g ON s.gerencia_id = g.id
JOIN diretorias d ON s.diretoria_id = d.id
WHERE s.status = 'enviado'
ORDER BY s.item;
