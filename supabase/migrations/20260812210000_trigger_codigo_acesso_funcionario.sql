-- Função que gera automaticamente um código de acesso quando um novo funcionário é cadastrado
CREATE OR REPLACE FUNCTION trigger_criar_codigo_acesso_funcionario()
RETURNS TRIGGER AS $$
DECLARE
    v_sigla TEXT;
    v_scope TEXT;
    v_codigo_hash TEXT;
BEGIN
    -- Verifica se possui matricula, caso não, não tem como gerar o hash
    IF NEW.matricula IS NULL OR NEW.matricula = '' THEN
        RETURN NEW;
    END IF;

    -- Define o escopo e busca a sigla (em minúsculo) baseando-se na gerência ou diretoria
    IF NEW.gerencia_id IS NOT NULL THEN
        v_scope := 'gerencia';
        SELECT lower(sigla) INTO v_sigla FROM gerencias WHERE id = NEW.gerencia_id;
    ELSIF NEW.diretoria_id IS NOT NULL THEN
        v_scope := 'diretoria';
        SELECT lower(sigla) INTO v_sigla FROM diretorias WHERE id = NEW.diretoria_id;
    ELSE
        -- Se o funcionário não está vinculado a nenhuma gerência ou diretoria, não cria código
        RETURN NEW;
    END IF;
    
    -- Caso não encontre a sigla correspondente (por inconsistência de dados), aborta a criação
    IF v_sigla IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Monta o codigo_hash concatenando a sigla e a matrícula do funcionário
    v_codigo_hash := v_sigla || NEW.matricula;
    
    -- Verifica se já existe esse código para evitar duplicidade (Regra 6 e 7)
    IF NOT EXISTS (
        SELECT 1 FROM codigos_acesso 
        WHERE codigo_hash = v_codigo_hash
    ) THEN
        -- Insere o novo código de acesso apenas para novos registros (Regra 3, 5 e 8)
        INSERT INTO codigos_acesso (
            scope,
            diretoria_id,
            gerencia_id,
            codigo_hash,
            ativo
        ) VALUES (
            v_scope,
            CASE WHEN v_scope = 'diretoria' THEN NEW.diretoria_id ELSE NULL END,
            CASE WHEN v_scope = 'gerencia' THEN NEW.gerencia_id ELSE NULL END,
            v_codigo_hash,
            true
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove a trigger se já existir, garantindo idempotência
DROP TRIGGER IF EXISTS trigger_novo_funcionario_codigo_acesso ON funcionarios;

-- Cria a trigger que será disparada APÓS a inserção (AFTER INSERT) de um novo funcionário
CREATE TRIGGER trigger_novo_funcionario_codigo_acesso
AFTER INSERT ON funcionarios
FOR EACH ROW
EXECUTE FUNCTION trigger_criar_codigo_acesso_funcionario();
