-- Corrigir as funções de sincronização disparadas pelas triggers de itens_catalogo
-- A tabela 'solicitacoes' não possui as colunas 'codigo', 'descricao', 'categoria', 'unidade' (estas vêm da relação item_id -> itens_catalogo.id).
-- Apenas valor_unitario e updated_at devem ser atualizados em solicitacoes quando o catálogo é alterado.

CREATE OR REPLACE FUNCTION public.trg_sync_itens_catalogo_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.solicitacoes
    SET 
        valor_unitario = NEW.valor_unitario,
        updated_at = NOW()
    WHERE item_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_sync_itens_catalogo()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.solicitacoes
    SET 
        valor_unitario = NEW.valor_unitario,
        updated_at = NOW()
    WHERE item_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
