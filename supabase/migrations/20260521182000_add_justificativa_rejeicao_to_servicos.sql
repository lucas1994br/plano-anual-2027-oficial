-- Migration to add justificativa_rejeicao to servicos table
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS justificativa_rejeicao text;
