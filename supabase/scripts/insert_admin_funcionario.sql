-- ==========================================
-- INSERÇÃO DO ADMIN123 NA TABELA FUNCIONARIOS
-- ==========================================

-- Isso resolve o problema "Nome não encontrado" no log de atividades para os administradores

INSERT INTO funcionarios (matricula, nome)
VALUES ('admin123', 'Administrador do Sistema')
ON CONFLICT (matricula) 
DO UPDATE SET nome = 'Administrador do Sistema';
