-- =========================================================================
-- CORREÇÃO DE POLÍTICAS RLS PARA DELETE EM servicos, solicitacoes E aprovacao
-- =========================================================================

-- 1. servicos
ALTER TABLE IF EXISTS servicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "servicos_delete" ON servicos;
DROP POLICY IF EXISTS "Permitir delete publico em servicos" ON servicos;

CREATE POLICY "servicos_delete" ON servicos
  FOR DELETE USING (true);

-- 2. solicitacoes
ALTER TABLE IF EXISTS solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "solicitacoes_delete" ON solicitacoes;
DROP POLICY IF EXISTS "Permitir delete publico em solicitacoes" ON solicitacoes;

CREATE POLICY "solicitacoes_delete" ON solicitacoes
  FOR DELETE USING (true);

-- 3. aprovacao
ALTER TABLE IF EXISTS aprovacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aprovacao_delete" ON aprovacao;
DROP POLICY IF EXISTS "Permitir delete publico em aprovacao" ON aprovacao;

CREATE POLICY "aprovacao_delete" ON aprovacao
  FOR DELETE USING (true);
