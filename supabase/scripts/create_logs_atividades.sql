-- ==========================================
-- SCRIPT DE CRIAÇÃO DA TABELA DE LOGS DE ATIVIDADES
-- ==========================================

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS logs_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula VARCHAR NOT NULL,
  acao VARCHAR NOT NULL, -- Ex: 'CRIAR', 'EDITAR', 'EXCLUIR'
  tabela_afetada VARCHAR NOT NULL, -- Ex: 'itens_catalogo', 'servicos', 'plano_item'
  registro_id VARCHAR, -- ID do item que foi alterado
  detalhes JSONB, -- JSON contendo detalhes, como os campos alterados ou o objeto completo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ativar RLS (Row Level Security)
ALTER TABLE logs_atividades ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para permitir inserção pública (pois usamos nosso próprio sistema de acesso por código)
-- Permitir INSERT
CREATE POLICY "Permitir inserção de logs publica" ON logs_atividades
  FOR INSERT 
  WITH CHECK (true);

-- Permitir SELECT (Apenas para visualização em painel de administração no futuro)
CREATE POLICY "Permitir leitura de logs publica" ON logs_atividades
  FOR SELECT 
  USING (true);
