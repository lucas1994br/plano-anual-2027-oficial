-- ==========================================
-- SCRIPT DE CORREÇÃO (RODAR NO SUPABASE SQL EDITOR)
-- ==========================================

-- 1. Permissões restantes (Update para logs, Delete para funcionarios)
CREATE POLICY "Permitir update de logs publica" ON logs_atividades
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir delete publico em funcionarios" ON funcionarios
  FOR DELETE USING (true);

-- 2. Limpar os dados errados passados (Substituir 'dg76643' e 'gesl76643' pelo número correto '76643')
-- Como rodamos isso direto no banco (superuser), o RLS não vai bloquear.

-- Transferir a autoria dos logs errados para a matrícula correta (76643)
UPDATE logs_atividades 
SET matricula = '76643' 
WHERE matricula IN ('dg76643', 'gesl76643');

-- Apagar os funcionários fantasmas ('Usuário dg76643') que foram criados indevidamente
DELETE FROM funcionarios 
WHERE matricula IN ('dg76643', 'gesl76643');

-- Restaurar o nome correto do administrador, caso tenha sido sobrescrito
UPDATE funcionarios 
SET nome = 'Administrador do Sistema' 
WHERE matricula = 'admin123';
