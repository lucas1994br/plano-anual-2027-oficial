-- Migration: Consolidated fixes from loose scripts
-- Adds is_deleted to logs_atividades from add_lixeira.sql

ALTER TABLE logs_atividades ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
