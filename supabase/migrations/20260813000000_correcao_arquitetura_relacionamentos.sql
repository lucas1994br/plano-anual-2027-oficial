-- Script de migração para corrigir as inconsistências arquiteturais

-- 1. Restaurar vínculos órfãos de 'solicitacoes' (preencher item_id pelo codigo numérico)
UPDATE solicitacoes s
SET item_id = c.id
FROM itens_catalogo c
WHERE s.codigo = c.codigo 
  AND s.item_id IS NULL;

-- 2. Adicionar 'item_id' real em 'servicos' para ter consistência com o catálogo em UUID
ALTER TABLE servicos 
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES itens_catalogo(id) ON DELETE SET NULL;

-- Preencher o item_id em servicos com base no campo 'item' numérico existente
UPDATE servicos s
SET item_id = c.id
FROM itens_catalogo c
WHERE s.item = c.codigo 
  AND s.item_id IS NULL;

-- 3. Atualizar a constraint do log_orcamentario para aceitar 'solicitacao' e 'servico' (além dos tipos de ERP puros)
DO $$
DECLARE
    rec record;
BEGIN
    -- Busca qualquer check constraint associada à coluna referencia_tipo
    FOR rec IN 
        SELECT conname as constraint_name
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_attribute ON pg_attribute.attrelid = pg_class.oid AND pg_attribute.attnum = ANY(pg_constraint.conkey)
        WHERE pg_class.relname = 'log_orcamentario' AND pg_attribute.attname = 'referencia_tipo'
    LOOP
        EXECUTE 'ALTER TABLE log_orcamentario DROP CONSTRAINT ' || rec.constraint_name;
    END LOOP;
END$$;

ALTER TABLE log_orcamentario 
ADD CONSTRAINT log_orcamentario_referencia_tipo_check 
CHECK (referencia_tipo IN ('plano_item', 'solicitacao_compra', 'compra', 'solicitacao', 'servico'));

-- 4. Atualizar os logs_orcamentarios existentes que estavam com o tipo incorreto
UPDATE log_orcamentario
SET referencia_tipo = 'solicitacao'
WHERE referencia_tipo = 'solicitacao_compra'
  AND referencia_id IN (SELECT id FROM solicitacoes);
