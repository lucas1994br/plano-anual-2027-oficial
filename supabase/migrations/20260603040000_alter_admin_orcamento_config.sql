DO $$
DECLARE
    con_name text;
BEGIN
    SELECT conname INTO con_name
    FROM pg_constraint
    WHERE conrelid = 'admin_orcamento_config'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%tipo%';

    IF con_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE admin_orcamento_config DROP CONSTRAINT ' || con_name;
    END IF;
END $$;

ALTER TABLE admin_orcamento_config ADD CONSTRAINT admin_orcamento_config_tipo_check CHECK (tipo in ('aquisicao', 'servicos', 'servicos_novos', 'servicos_existentes'));
