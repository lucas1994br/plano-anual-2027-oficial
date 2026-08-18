-- Adiciona a coluna 'contratada' nas tabelas de serviços
ALTER TABLE public.servicos_catalogo ADD COLUMN IF NOT EXISTS contratada VARCHAR(255);
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS contratada VARCHAR(255);
