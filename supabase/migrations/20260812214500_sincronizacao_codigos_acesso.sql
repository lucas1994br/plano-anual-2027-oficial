-- ==============================================================================
-- 1. FUNÇÃO POSTGRESQL (GERAÇÃO AUTOMÁTICA SIGLA + MATRÍCULA)
-- ==============================================================================
CREATE OR REPLACE FUNCTION trg_criar_codigo_acesso()
RETURNS TRIGGER AS $$
DECLARE
    v_sigla TEXT;
    v_scope TEXT;
    v_codigo_hash TEXT;
BEGIN
    -- Se a matrícula não for informada, não gera o código
    IF NEW.matricula IS NULL OR TRIM(NEW.matricula) = '' THEN
        RETURN NEW;
    END IF;

    -- Define o escopo e busca a sigla
    IF NEW.gerencia_id IS NOT NULL THEN
        v_scope := 'gerencia';
        SELECT sigla INTO v_sigla FROM gerencias WHERE id = NEW.gerencia_id;
    ELSIF NEW.diretoria_id IS NOT NULL THEN
        v_scope := 'diretoria';
        SELECT sigla INTO v_sigla FROM diretorias WHERE id = NEW.diretoria_id;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Aborta se a sigla não for encontrada
    IF v_sigla IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Regra definida: SIGLA + MATRÍCULA (ex: CAEMA44725)
    v_codigo_hash := v_sigla || NEW.matricula;
    
    -- Verifica se já existe esse código para evitar duplicidade
    IF NOT EXISTS (
        SELECT 1 FROM codigos_acesso 
        WHERE codigo_hash = v_codigo_hash
    ) THEN
        INSERT INTO codigos_acesso (
            scope,
            diretoria_id,
            gerencia_id,
            codigo_hash,
            ativo,
            expira_em,
            created_at
        ) VALUES (
            v_scope,
            CASE WHEN v_scope = 'diretoria' THEN NEW.diretoria_id ELSE NULL END,
            CASE WHEN v_scope = 'gerencia' THEN NEW.gerencia_id ELSE NULL END,
            v_codigo_hash,
            true,
            NULL,
            CURRENT_TIMESTAMP
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. TRIGGER POSTGRESQL (DISPARADA APENAS APÓS NOVOS INSERTS)
-- ==============================================================================
DROP TRIGGER IF EXISTS trg_novo_funcionario_codigo_acesso ON funcionarios;

CREATE TRIGGER trg_novo_funcionario_codigo_acesso
AFTER INSERT ON funcionarios
FOR EACH ROW
EXECUTE FUNCTION trg_criar_codigo_acesso();

-- ==============================================================================
-- 3. CARGA INICIAL: SINCRONIZAÇÃO DE FUNCIONÁRIOS JÁ EXISTENTES
-- ==============================================================================
DO $$
DECLARE
    f_rec RECORD;
    v_sigla TEXT;
    v_scope TEXT;
    v_codigo_hash TEXT;
BEGIN
    FOR f_rec IN SELECT * FROM funcionarios LOOP
        -- Ignora se não tiver matrícula
        IF f_rec.matricula IS NULL OR TRIM(f_rec.matricula) = '' THEN
            CONTINUE;
        END IF;

        -- Identifica escopo e sigla
        IF f_rec.gerencia_id IS NOT NULL THEN
            v_scope := 'gerencia';
            SELECT sigla INTO v_sigla FROM gerencias WHERE id = f_rec.gerencia_id;
        ELSIF f_rec.diretoria_id IS NOT NULL THEN
            v_scope := 'diretoria';
            SELECT sigla INTO v_sigla FROM diretorias WHERE id = f_rec.diretoria_id;
        ELSE
            CONTINUE;
        END IF;

        IF v_sigla IS NOT NULL THEN
            -- Monta o código hash: SIGLA + MATRÍCULA
            v_codigo_hash := v_sigla || f_rec.matricula;

            -- Insere apenas se o código não existir na base, protegendo dados antigos
            IF NOT EXISTS (
                SELECT 1 FROM codigos_acesso 
                WHERE codigo_hash = v_codigo_hash
            ) THEN
                INSERT INTO codigos_acesso (
                    scope,
                    diretoria_id,
                    gerencia_id,
                    codigo_hash,
                    ativo,
                    expira_em,
                    created_at
                ) VALUES (
                    v_scope,
                    CASE WHEN v_scope = 'diretoria' THEN f_rec.diretoria_id ELSE NULL END,
                    CASE WHEN v_scope = 'gerencia' THEN f_rec.gerencia_id ELSE NULL END,
                    v_codigo_hash,
                    true,
                    NULL,
                    CURRENT_TIMESTAMP
                );
            END IF;
        END IF;
    END LOOP;
END;
$$;
