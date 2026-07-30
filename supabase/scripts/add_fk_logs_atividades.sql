-- ==============================================================
-- ADICIONAR RELACIONAMENTO NA TABELA LOGS_ATIVIDADES
-- ==============================================================

-- 1. Primeiro, garantimos que a coluna 'matricula' na tabela funcionarios é única
-- Isso é exigido pelo PostgreSQL para podermos criar uma Foreign Key apontando para ela.
ALTER TABLE funcionarios ADD CONSTRAINT IF NOT EXISTS funcionarios_matricula_key UNIQUE (matricula);

-- 2. Adicionamos a Foreign Key na tabela logs_atividades referenciando a tabela funcionarios
ALTER TABLE logs_atividades 
ADD CONSTRAINT fk_logs_funcionarios 
FOREIGN KEY (matricula) 
REFERENCES funcionarios(matricula)
ON DELETE SET NULL;

-- Nota sobre o registro_id:
-- O PostgreSQL não permite criar chaves estrangeiras (Foreign Keys) dinâmicas/polimórficas 
-- (uma coluna que aponta para 10 tabelas diferentes dependendo do valor em tabela_afetada). 
-- Portanto, o registro_id continua como VARCHAR sem uma Foreign Key (Constraint) rígida no banco, 
-- mas no nível de lógica de software ele já está relacionado.
