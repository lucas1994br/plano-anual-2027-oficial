-- Migration: Adiciona relacionamentos ausentes
-- Relaciona servicos_catalogo.item_catalogo_id com itens_catalogo.id

ALTER TABLE servicos_catalogo 
  ADD CONSTRAINT fk_servicos_item_catalogo 
  FOREIGN KEY (item_catalogo_id) 
  REFERENCES itens_catalogo(id) 
  ON DELETE CASCADE;
