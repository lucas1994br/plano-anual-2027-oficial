-- Reset DC - Nova lista de itens para teste

-- 1. Deletar histórico e dados transacionais
DELETE FROM solicitacao_historico;
DELETE FROM solicitacoes;
DELETE FROM servicos;

-- 2. Deletar todos os itens do catálogo
DELETE FROM itens_catalogo;

-- 3. Inserir novos itens de teste
