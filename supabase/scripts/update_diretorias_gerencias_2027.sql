-- Atualizacao oficial de diretorias e gerencias (PAC 2027)
-- Seguro para banco existente (usa UPSERT e reativa registros oficiais).

-- Diretorias
UPDATE diretorias
SET
  nome = 'Diretoria de Comercialização e Relacionamento com Cliente',
  descricao = 'Comercialização, faturamento e relacionamento com cliente'
WHERE sigla = 'DC';

UPDATE diretorias
SET
  nome = 'Diretoria de Engenharia e Meio Ambiente',
  descricao = 'Engenharia, projetos, obras e meio ambiente'
WHERE sigla = 'DE';

UPDATE diretorias
SET
  nome = 'Diretoria de Gestão Administrativa Financeira e de Pessoas',
  descricao = 'Gestão administrativa, financeira e de pessoas'
WHERE sigla = 'DG';

UPDATE diretorias
SET
  nome = 'Diretoria de Operação e Manutenção',
  descricao = 'Operação e manutenção dos sistemas'
WHERE sigla = 'DO';

UPDATE diretorias
SET
  nome = 'Diretoria da Presidência',
  descricao = 'Presidência e unidades vinculadas'
WHERE sigla = 'PR';

-- Gerencias oficiais
INSERT INTO gerencias (diretoria_id, sigla, nome, ativa)
VALUES
  -- DC
  ((SELECT id FROM diretorias WHERE sigla = 'DC'), 'CCRR', 'Gerência de Relacionamento com Cliente', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DC'), 'CCRF', 'Gerência de Faturamento e Arrecadação', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DC'), 'CCRC', 'Gerência de Operações Comerciais', true),

  -- DE
  ((SELECT id FROM diretorias WHERE sigla = 'DE'), 'EPRO', 'Gerência de Projetos', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DE'), 'EOBR', 'Gerência de Obras', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DE'), 'EMAR', 'Gerência de Meio Ambiente e Recursos Hídricos', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DE'), 'EPRE', 'Gerência de Projetos e Obras Especiais', true),

  -- DG
  ((SELECT id FROM diretorias WHERE sigla = 'DG'), 'GCFI', 'Gerência Contábil e Financeira', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DG'), 'GSAD', 'Gerência de Suporte Administrativo', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DG'), 'GEPE', 'Gerência de Pessoas', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DG'), 'GCON', 'Gerência de Contratos e Convênios', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DG'), 'GESL', 'Gerência de Suprimentos e Logística', true),

  -- DO (Sede)
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'ODCD', 'Gerência de Desenvolvimento e Controle Operacional', true),

  -- DO (Norte)
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNI', 'Gerência de Produção de Água do Sistema Italuís', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNA', 'Gerência de Produção de Água do Sistema Metropolitano', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNE', 'Gerência de Operação de Estação Elevatória de Esgoto da Região Metropolitana', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNM', 'Gerência de Planejamento Gestão e Manutenção Metropolitana', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCND', 'Gerência de Operação do Sistema Distribuidor Metropolitano', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNC', 'Gerência de Operação do Sistema Coletor Metropolitano', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNP', 'Gerência de Serviços e Negócios de Pinheiro', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCNB', 'Gerência de Serviços e Negócios de Barreirinha', true),

  -- DO (Sul)
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCSZ', 'Gerência Especial de Imperatriz', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCSC', 'Gerência de Serviços e Negócios de Chapadinha', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCSD', 'Gerência de Serviços e Negócios de Pedreiras', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCSJ', 'Gerência de Serviços e Negócios de São João dos Patos', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCSI', 'Gerência de Serviços e Negócios de Santa Inês', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCSU', 'Gerência de Serviços e Negócios de Itapecuru Mirim', true),
  ((SELECT id FROM diretorias WHERE sigla = 'DO'), 'OCST', 'Gerência de Serviços e Negócios de Presidente Dutra', true),

  -- PR
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'UTIN', 'Gerência de Tecnologia da Informação e Suporte a Usuários', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'UEP', 'Unidade Especial de Planejamento, Controle e Inovação', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'AUDIT', 'Auditoria Interna', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'PRO', 'Ouvidoria', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'ASCOM', 'Assessoria de Comunicação', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'PRJ', 'Procuradoria Jurídica', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'PRL', 'Central de Licitação', true),
  ((SELECT id FROM diretorias WHERE sigla = 'PR'), 'PRR', 'Assessoria de Governança e Regulação', true)
ON CONFLICT (diretoria_id, sigla) DO UPDATE
SET
  nome = EXCLUDED.nome,
  ativa = true;

-- Desativa siglas antigas conhecidas de PR
UPDATE gerencias
SET ativa = false
WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')
  AND sigla IN ('PRG');
