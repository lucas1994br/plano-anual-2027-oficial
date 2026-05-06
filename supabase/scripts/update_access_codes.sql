-- Atualiza codigos de acesso para todas as diretorias e gerencias
-- Execute este script no SQL Editor para atualizar um banco ja existente

-- Corrige codigos existentes que ja expiraram
UPDATE codigos_acesso
SET expira_em = NULL,
    ativo = true
WHERE scope IN ('diretoria', 'gerencia');

-- Converte codigos legados em texto puro para hash SHA-256
UPDATE codigos_acesso
SET codigo_hash = encode(digest(lower(codigo_hash), 'sha256'), 'hex')
WHERE codigo_hash !~ '^[0-9a-f]{64}$';

-- Admin global
INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT NULL, NULL, 'admin', encode(digest('admin123', 'sha256'), 'hex')::text, true, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM codigos_acesso ca
  WHERE ca.scope = 'admin'
    AND ca.diretoria_id IS NULL
    AND ca.gerencia_id IS NULL
    AND ca.codigo_hash = encode(digest('admin123', 'sha256'), 'hex')::text
);

-- Compras global
INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT NULL, NULL, 'compras', encode(digest('compras123', 'sha256'), 'hex')::text, true, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM codigos_acesso ca
  WHERE ca.scope = 'compras'
    AND ca.diretoria_id IS NULL
    AND ca.gerencia_id IS NULL
    AND ca.codigo_hash = encode(digest('compras123', 'sha256'), 'hex')::text
);

-- Diretorias: padrao <sigla_em_minusculo>1234
INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT
  d.id,
  NULL,
  'diretoria',
  encode(digest((lower(d.sigla) || '1234')::text, 'sha256'), 'hex')::text,
  true,
  NULL
FROM diretorias d
WHERE d.ativa = true
  AND NOT EXISTS (
    SELECT 1
    FROM codigos_acesso ca
    WHERE ca.scope = 'diretoria'
      AND ca.diretoria_id = d.id
      AND ca.codigo_hash = encode(digest((lower(d.sigla) || '1234')::text, 'sha256'), 'hex')::text
  );

INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT
  d.id,
  NULL,
  'diretoria',
  encode(digest((lower(d.sigla) || '123')::text, 'sha256'), 'hex')::text,
  true,
  NULL
FROM diretorias d
WHERE d.ativa = true
  AND NOT EXISTS (
    SELECT 1
    FROM codigos_acesso ca
    WHERE ca.scope = 'diretoria'
      AND ca.diretoria_id = d.id
      AND ca.codigo_hash = encode(digest((lower(d.sigla) || '123')::text, 'sha256'), 'hex')::text
  );

INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT
  d.id,
  NULL,
  'diretoria',
  encode(digest(('1234' || lower(d.sigla))::text, 'sha256'), 'hex')::text,
  true,
  NULL
FROM diretorias d
WHERE d.ativa = true
  AND NOT EXISTS (
    SELECT 1
    FROM codigos_acesso ca
    WHERE ca.scope = 'diretoria'
      AND ca.diretoria_id = d.id
      AND ca.codigo_hash = encode(digest(('1234' || lower(d.sigla))::text, 'sha256'), 'hex')::text
  );

-- Gerencias: aceitar aliases por sigla para compatibilidade
-- Formatos suportados: <sigla>123, <sigla>1234 e 1234<sigla>
INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT
  NULL,
  g.id,
  'gerencia',
  encode(digest((lower(g.sigla) || '123')::text, 'sha256'), 'hex')::text,
  true,
  NULL
FROM gerencias g
WHERE g.ativa = true
  AND NOT EXISTS (
    SELECT 1
    FROM codigos_acesso ca
    WHERE ca.scope = 'gerencia'
      AND ca.gerencia_id = g.id
      AND ca.codigo_hash = encode(digest((lower(g.sigla) || '123')::text, 'sha256'), 'hex')::text
  );

INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT
  NULL,
  g.id,
  'gerencia',
  encode(digest((lower(g.sigla) || '1234')::text, 'sha256'), 'hex')::text,
  true,
  NULL
FROM gerencias g
WHERE g.ativa = true
  AND NOT EXISTS (
    SELECT 1
    FROM codigos_acesso ca
    WHERE ca.scope = 'gerencia'
      AND ca.gerencia_id = g.id
      AND ca.codigo_hash = encode(digest((lower(g.sigla) || '1234')::text, 'sha256'), 'hex')::text
  );

INSERT INTO codigos_acesso (diretoria_id, gerencia_id, scope, codigo_hash, ativo, expira_em)
SELECT
  NULL,
  g.id,
  'gerencia',
  encode(digest(('1234' || lower(g.sigla))::text, 'sha256'), 'hex')::text,
  true,
  NULL
FROM gerencias g
WHERE g.ativa = true
  AND NOT EXISTS (
    SELECT 1
    FROM codigos_acesso ca
    WHERE ca.scope = 'gerencia'
      AND ca.gerencia_id = g.id
      AND ca.codigo_hash = encode(digest(('1234' || lower(g.sigla))::text, 'sha256'), 'hex')::text
  );
