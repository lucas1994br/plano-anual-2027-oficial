-- ==========================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES (RLS)
-- ==========================================
-- 1. Permitir que o sistema exclua logs (DELETE)
CREATE POLICY "Permitir deleção de logs publica" ON logs_atividades
  FOR DELETE 
  USING (true);

-- 2. Permitir que o sistema crie funcionários dinâmicos quando eles geram logs
-- Ativar RLS se não estiver ativo
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;

-- Permitir INSERT
CREATE POLICY "Permitir insercao publica em funcionarios" ON funcionarios
  FOR INSERT 
  WITH CHECK (true);

-- Permitir UPDATE (para o upsert funcionar)
CREATE POLICY "Permitir update publico em funcionarios" ON funcionarios
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- Permitir SELECT
CREATE POLICY "Permitir leitura publica em funcionarios" ON funcionarios
  FOR SELECT 
  USING (true);
