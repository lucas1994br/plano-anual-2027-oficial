-- Migration: 20260901000000_create_restricoes_atividades.sql
-- Descrição: Criação da tabela de restrições de atividades por período, módulo, escopo e status.

CREATE TABLE IF NOT EXISTS restricoes_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id UUID NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  escopo_tipo TEXT NOT NULL CHECK (escopo_tipo IN ('todos', 'diretoria', 'gerencia', 'perfil')),
  diretoria_id UUID REFERENCES diretorias(id) ON DELETE CASCADE,
  gerencia_id UUID REFERENCES gerencias(id) ON DELETE CASCADE,
  perfil TEXT CHECK (perfil IN ('todos', 'gerencia', 'diretoria', 'compras')),
  modulo TEXT NOT NULL, -- 'todos', 'aquisicao', 'servicos_existentes', 'servicos_novos', 'compras', 'aprovacao'
  atividade TEXT NOT NULL, -- 'todas', 'enviar_solicitacao', 'adicionar_item', 'adicionar_servico', 'adicionar_novo_servico', 'alterar_quantidade', 'alterar_prioridade', 'adicionar_observacao', 'devolver_solicitacao', 'aprovar', 'reprovar', 'enviar_compras', 'processar_solicitacao', 'excluir_item', 'editar_item', 'edicao_em_lote'
  status TEXT NOT NULL DEFAULT 'bloqueado' CHECK (status IN ('bloqueado', 'liberado')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  criado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_restricoes_periodo ON restricoes_atividades(periodo_id);
CREATE INDEX IF NOT EXISTS idx_restricoes_escopo ON restricoes_atividades(escopo_tipo, diretoria_id, gerencia_id, perfil);
CREATE INDEX IF NOT EXISTS idx_restricoes_modulo_atividade ON restricoes_atividades(modulo, atividade);
CREATE INDEX IF NOT EXISTS idx_restricoes_ativo ON restricoes_atividades(ativo);

-- RLS
ALTER TABLE restricoes_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restricoes_read" ON restricoes_atividades;
DROP POLICY IF EXISTS "restricoes_write" ON restricoes_atividades;

CREATE POLICY "restricoes_read" ON restricoes_atividades
  FOR SELECT USING (true);

CREATE POLICY "restricoes_write" ON restricoes_atividades
  FOR ALL USING (true) WITH CHECK (true);
