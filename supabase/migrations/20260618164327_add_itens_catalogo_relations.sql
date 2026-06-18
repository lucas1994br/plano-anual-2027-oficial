-- 1. Relacionamento 1:N entre servicos e itens_catalogo
ALTER TABLE servicos
ADD CONSTRAINT fk_servicos_item_catalogo
FOREIGN KEY (item) REFERENCES itens_catalogo(codigo) ON DELETE RESTRICT;

-- 2. Tabela associativa N:N entre fornecedor e itens_catalogo
CREATE TABLE IF NOT EXISTS fornecedor_item (
  fornecedor_id uuid NOT NULL,
  item_catalogo_id uuid NOT NULL,
  preco_sugerido numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_fornecedor_item PRIMARY KEY (fornecedor_id, item_catalogo_id),
  CONSTRAINT fk_fornecedor_item_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES fornecedor(id) ON DELETE CASCADE,
  CONSTRAINT fk_fornecedor_item_catalogo FOREIGN KEY (item_catalogo_id) REFERENCES itens_catalogo(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE fornecedor_item ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para fornecedor_item (leitura pública, escrita admin - semelhante à tabela fornecedor)
CREATE POLICY "fornecedor_item_read" ON fornecedor_item
  FOR SELECT USING (auth.role() IN ('authenticated', 'anon'));

CREATE POLICY "fornecedor_item_admin_write" ON fornecedor_item
  FOR ALL USING ((auth.jwt() ->> 'app_role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'app_role') = 'admin');
