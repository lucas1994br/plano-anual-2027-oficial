-- =========================================================================
-- CORREÇÃO DE POLÍTICAS RLS PARA log_orcamentario E solicitacao_historico
-- =========================================================================

-- 1. Tabela log_orcamentario
ALTER TABLE IF EXISTS log_orcamentario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_orcamentario_read" ON log_orcamentario;
DROP POLICY IF EXISTS "log_orcamentario_insert" ON log_orcamentario;
DROP POLICY IF EXISTS "log_orcamentario_update" ON log_orcamentario;
DROP POLICY IF EXISTS "log_orcamentario_delete" ON log_orcamentario;
DROP POLICY IF EXISTS "Permitir insercao publica em log_orcamentario" ON log_orcamentario;
DROP POLICY IF EXISTS "Permitir leitura publica em log_orcamentario" ON log_orcamentario;
DROP POLICY IF EXISTS "Permitir update publico em log_orcamentario" ON log_orcamentario;
DROP POLICY IF EXISTS "Permitir delete publico em log_orcamentario" ON log_orcamentario;

CREATE POLICY "log_orcamentario_read" ON log_orcamentario
  FOR SELECT USING (true);

CREATE POLICY "log_orcamentario_insert" ON log_orcamentario
  FOR INSERT WITH CHECK (true);

CREATE POLICY "log_orcamentario_update" ON log_orcamentario
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "log_orcamentario_delete" ON log_orcamentario
  FOR DELETE USING (true);

-- 2. Tabela solicitacao_historico
ALTER TABLE IF EXISTS solicitacao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historico_read" ON solicitacao_historico;
DROP POLICY IF EXISTS "historico_insert" ON solicitacao_historico;
DROP POLICY IF EXISTS "historico_delete" ON solicitacao_historico;
DROP POLICY IF EXISTS "Permitir insercao publica em solicitacao_historico" ON solicitacao_historico;
DROP POLICY IF EXISTS "Permitir leitura publica em solicitacao_historico" ON solicitacao_historico;

CREATE POLICY "historico_read" ON solicitacao_historico
  FOR SELECT USING (true);

CREATE POLICY "historico_insert" ON solicitacao_historico
  FOR INSERT WITH CHECK (true);

CREATE POLICY "historico_delete" ON solicitacao_historico
  FOR DELETE USING (true);
