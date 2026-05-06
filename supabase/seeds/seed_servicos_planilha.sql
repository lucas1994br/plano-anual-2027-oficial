-- ============================================================
-- IMPORTAÇÃO DE SERVIÇOS DA PLANILHA "SERVICOS EXISTENTES .xlsx"
-- Fonte: PAC 2026 adaptado para o Plano 2027
-- Diretorias: DC, PR, DG, DE
-- ============================================================

-- Gerencias de fallback para unidades demandantes não cadastradas:
-- CCRH e CET → gerencia 'DC' da diretoria DC

-- ============================================================
-- DC — DIRETORIA DE COMERCIALIZAÇÃO
-- ============================================================

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'CCRF' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  1, 'Serviço', 'CCRF',
  'Leitura, impressão simultânea, entrega de contas e atualização cadastral de clientes',
  'Prorrogação de contrato vigente. Comtemplando previsão de reajuste conforme condições contratuais e normativas aplicáveis visando garantir a continuidade da leitura e impressão simultânea de contas, com atualização cadastral, para manter manter o cronograma de leitura e qualidade no atendimento.',
  14682305.69, 5180864.63, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 1
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'DC' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  2, 'Serviço', 'CCRH',
  'Serviços de Cobrança/Negativação',
  'Prorrogação de contrato vigente contemplando previsão de novo contrato e de reajuste conforme condições contratuais e normativas aplicáveis visando garantir a continuidade dos serviços de negativação de clientes inadimplentes, com foco na regularização de créditos vencidos.',
  '2026-12-01', 850000.00, 750000.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 2
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'CCRF' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  3, 'Serviço', 'CCRF',
  'Impressão de contas',
  'Garantir a continuidade dos serviços gráficos nas áreas ainda sem leitura e impressão simultânea, assegurando a entrega das contas aos clientes.',
  756000.00, 730000.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 3
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'DC' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  5, 'Serviço', 'CET',
  'Cadastramento de clientes',
  'Contratação de empresa especializada para realização de novos cadastros e atualização cadastral, visando manter a base de dados atualizada e assegurar a regularidade das informações dos usuários.',
  '2026-02-01', 0.00, 70000.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 5
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'DC' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  6, 'Outros', 'CET',
  'Fundo Rotativo da Diretoria de Comercialização e Relacionamento com o Cliente - DC',
  'Necessidade de aquisição ou realização de serviços emergenciais na Diretoria Comercial e respectivas Gerências.',
  144000.00, 144000.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 6
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'DC' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  7, 'Serviço', 'CET',
  'Serviços de apoio operacional e auxiliares de informação',
  'A contratação de serviços especializados para a execução de atividades de campo e de atendimento ao cliente (técnicos e auxiliares de informação), com fornecimento de equipamentos e materiais necessários à realização dos serviços supracitados. A iniciativa contribuirá para maior eficiencia, padronização dos processos, redução do uso de papel e aumento da qualidade na relação com os clientes.',
  '2026-02-01', 2841098.92, 766787.40, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 7
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'CCRC' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  8, 'Serviço', 'CCRC',
  'Serviços Comerciais',
  'Empresa especializada nos serviços de corte, religação, instalação de hidrômetros, execução de ramais, com fornecimento de materiais, mão de obra e equipamentos, com o objetivo de garantir a regularização dos clientes, reduzir perdas de consumo e desperdício de água, melhorar o controle e gestão do sistema de abastecimento, e, consequentemente, contribuir para o aumento da arrecadação e sustentabilidade da Companhia.',
  18862196.29, 7431098.15, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 8
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'CCRC' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  9, 'Serviço', 'CCRC',
  'Calibração de bancada de aferição',
  'A contratação tem por finalidade garantir a manutenção corretiva e preventiva da bancada volumétrica semiautomática da Oficina de Hidrômetros da CAEMA, bem como a realização de inspeções metrológicas e calibrações de instrumentos auxiliares. Considerando tratar-se de equipamento da marca Dígico, cujo suporte técnico é exclusivo do fabricante, resta caracterizada a inviabilidade de competição, nos termos do Art. 115, inciso II, do Regulamento Interno de Licitações e Contratos da CAEMA (RILC/2024), e no Art. 30, inciso II, alínea "b", da Lei nº 13.303/2016, por se tratar de serviços técnicos especializados de natureza singular, executados por empresa de notória especialização.',
  '2026-12-01', 60000.00, 60000.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 9
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, justificativa, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DC'),
  (SELECT id FROM gerencias WHERE sigla = 'CCRR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')),
  10, 'Serviço', 'CCRR',
  'Serviços de Call Center',
  'Prestação de serviço de atendimento de solução digital de atendimento ativo e receptivo, humano e eletrônico, incluindo multicanal web (WhatsApp, Webchat, Voicebot, Telegram) e mensageria (SMS e E-mail) e aplicativos móveis (nas versões IOS e Android), na modalidade virtual e presencial, contemplando os recursos necessários (de infraestrutura física, humana e tecnológica), abrangendo as etapas de planejamento, a implantação, operacionalização, o desenvolvimento, a customização, integração, conexão de dados, manutenção, atualização, o gerenciamento da plataforma de operação e a gestão do atendimento, abrangendo a utilização de inteligência artificial e análise de dados.',
  '2026-01-01', 0.00, 7381553.50, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DC')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 10
);

-- ============================================================
-- PR — PRESIDÊNCIA
-- ============================================================

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'PR'),
  (SELECT id FROM gerencias WHERE sigla = 'PRG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')),
  1, 'Contínuo', 'PRG',
  'Contratação de empresa especializada na prestação de serviços técnicos especializados de consultoria jurídica administrativa e contenciosa na área de direito ambiental, perante todas as instâncias possíveis do Poder Judiciário, a serem prestados por sociedade de advogados para a Companhia de Saneamento Ambiental do Maranhão, e Superiores.',
  '2026-12-22', 309098.41, 309098.41, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 1
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'PR'),
  (SELECT id FROM gerencias WHERE sigla = 'PRG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')),
  2, 'Contínuo', 'PRG',
  'Contratação de empresa especializada na prestação de serviços técnicos especializados de consultoria jurídica preventiva, administrativa e contenciosa nas áreas de direito civil, consumidor, administrativa, tributária, penal, societária e regulatória, judiciais e extrajudiciais, perante todas as instâncias dos Tribunais Estaduais, Federais, e Superiores, inclusive Juizados Especiais Cíveis e Criminais, a serem prestados por sociedade de advogados para a Companhia de Saneamento Ambiental do Maranhão - CAEMA.',
  '2026-01-21', 531600.00, 531600.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 2
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'PR'),
  (SELECT id FROM gerencias WHERE sigla = 'PRG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')),
  3, 'Contínuo', 'PRG',
  'Contratação de serviços técnicos especializados de consultoria jurídica preventiva, administrativa e contenciosa nas áreas de direito trabalhista e previdenciário, perante todas as instâncias dos Tribunais Regionais e Superiores, a serem prestados por sociedade de advogados para a CAEMA.',
  '2026-02-24', 240000.00, 240000.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 3
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'PR'),
  (SELECT id FROM gerencias WHERE sigla = 'PRG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')),
  4, 'Contínuo', 'PRG',
  'Contratação de empresa especializada para prestação de serviços de clipping e mensuração de mídia, de todos os assuntos que fizerem referência à Companhia de Saneamento Ambiental do Maranhão (CAEMA) nas cidades de São Luís, Imperatriz, Chapadinha, Pinheiro, Presidente Dutra e Santa Inês, no Estado do Maranhão.',
  '2026-10-24', 75000.00, 75000.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'PR')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 4
);

-- ============================================================
-- DG — DIRETORIA DE GESTÃO ADM. FINANCEIRA
-- (contratos vigentes adaptados)
-- ============================================================

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  1, 'Serviço', 'DG',
  'Contratação de empresa especializada para a execução de consultoria continuada na área de contabilidade, gestão de sistemas e gestão patrimonial',
  202500.00, 202500.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 1
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  2, 'Serviço', 'DG',
  'Contratação de empresa especializada para a execução de serviços de atualização, manutenção e assistência técnica do Sistema Radar Empresarial (módulos Contábil, Conciliação, Compras, Estoque, Financeiro, Adiantamento de Viagens, MT Patrimonial, MT Fiscal, Arquivos Magnéticos, Radar IRPJ, Radar Orçamento e Radar Integrador)',
  294791.00, 294791.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 2
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  3, 'Serviço', 'DG',
  'Serviço de transmissão de dados de multioperadora de celular para telemetria e monitoramento',
  52571.97, 52571.97, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 3
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  4, 'Serviço', 'DG',
  'Prestação de serviços continuados de vigilância armada e vigilância motorizada',
  3680996.17, 3680996.17, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 4
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  5, 'Serviço', 'GEPE',
  'Contratação de empresa especializada em serviços de capacitação, aprendizagem corporativa e gestão de talentos',
  46380.00, 46380.00, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 5
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  6, 'Serviço', 'GEPE',
  'Contratação de operadora, administradora de benefícios ou seguradora de saúde para prestação de serviços de plano de saúde aos empregados e dependentes',
  20899765.92, 20899765.92, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 6
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  7, 'Serviço', 'GEPE',
  'Contratação de empresa especializada no gerenciamento eletrônico e controle de benefícios de refeição e alimentação (vale-refeição e vale-alimentação)',
  668777.85, 668777.85, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 7
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  8, 'Serviço', 'GSAD',
  'Locação de impressoras e multifuncionais (solução de impressão corporativa)',
  245481.56, 245481.56, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 8
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  9, 'Serviço', 'GSAD',
  'Contratação de empresa para reserva, emissão, marcação, remarcação, cancelamento de passagens aéreas, terrestres e fluviais, além de serviços de hospedagem e locação de veículos',
  245046.60, 245046.60, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 9
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  10, 'Serviço', 'GSAD',
  'Contratação de empresa especializada para prestação de serviços de limpeza, conservação e higienização',
  1360552.27, 1360552.27, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 10
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  11, 'Serviço', 'GSAD',
  'Serviços de transporte coletivo para a condução de funcionários da CAEMA',
  252747.00, 252747.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 11
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  12, 'Serviço', 'GSAD',
  'Contratação de empresa especializada para manutenção de redes de fibra óptica',
  48825.00, 48825.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 12
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  13, 'Serviço', 'DG',
  'Contratação de solução integrada de comunicação corporativa baseada em nuvem',
  274645.17, 274645.17, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 13
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  14, 'Serviço', 'DG',
  'Prestação de serviços de telefonia VOIP (PABX CLOUD)',
  97901.16, 97901.16, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 14
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  15, 'Serviço', 'DG',
  'Gerenciamento de prestação dos serviços continuados de vigilância eletrônica',
  1343496.00, 1343496.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 15
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  16, 'Serviço', 'GEPE',
  'Contratação de empresa para fornecimento de refeições, com dedicação exclusiva de mão de obra e fornecimento de insumos',
  1643564.00, 1643564.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 16
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GCFI' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  17, 'Serviço', 'GCFI',
  'Contratação de empresa especializada para a prestação de serviços de auditoria independente das demonstrações contábeis',
  112126.72, 112126.72, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 17
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  18, 'Serviço', 'GSAD',
  'Serviço de manutenção preventiva e corretiva em aparelhos de ar condicionado',
  261000.00, 261000.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 18
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  19, 'Serviço', 'GSAD',
  'Contratação de empresa especializada para prestação de serviços gráficos (impressão e acabamento de materiais institucionais)',
  50000.00, 50000.00, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 19
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  20, 'Serviço', 'GEPE',
  'Contratação de empresa especializada na administração e gerenciamento de vale-transporte (benefício de transporte para empregados)',
  864000.00, 864000.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 20
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  21, 'Serviço', 'GEPE',
  'Prestação de serviços contínuos em medicina do trabalho e saúde ocupacional',
  691799.90, 691799.90, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 21
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GEPE' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  22, 'Serviço', 'GEPE',
  'Contratação de empresa especializada para a prestação de serviços de assistência odontológica aos empregados e dependentes',
  268681.75, 268681.75, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 22
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'GSAD' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  23, 'Serviço', 'GSAD',
  'Contratação de empresa especializada para locação de motocicletas e veículos',
  4176999.96, 4176999.96, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 23
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  24, 'Serviço', 'DG',
  'Contratação de empresa especializada para gerenciamento de Programas de Estágio Supervisionado',
  58320.00, 58320.00, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 24
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  25, 'Serviço', 'DG',
  'Empresa prestadora de Serviço de Telefonia Móvel Pessoal (SMP)',
  521418.72, 521418.72, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 25
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  26, 'Serviço', 'DG',
  'Contratação de Empresa especializada para o gerenciamento de câmeras e sistemas de CFTV com monitoramento 24 horas',
  300000.00, 300000.00, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 26
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  27, 'Serviço', 'DG',
  'Contratação de empresa especializada para prestação dos serviços de manutenção preventiva e corretiva em sistema de ponto eletrônico',
  21375.00, 21375.00, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 27
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DG'),
  (SELECT id FROM gerencias WHERE sigla = 'DG' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')),
  28, 'Serviço', 'DG',
  'Contratação de empresa para a prestação de serviço de instalação e suporte em equipamentos de Wi-Fi para a sede da CAEMA',
  47000.00, 47000.00, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DG')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 28
);

-- ============================================================
-- DE — DIRETORIA DE ENGENHARIA E MEIO AMBIENTE
-- ============================================================

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  1, 'Serviço', 'EOBR',
  'Contratação de empresa especializada em recuperação de reservatórios, recuperação de ETAS e execução de serviços complementares visando atender às gerências de negócios de Imperatriz, Pedreiras, Presidente Dutra, Colinas e Barreirinhas',
  '2025-11-26', 6441653.00, 6441653.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 1
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  2, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular profundo, no Município de Sucupira do Norte/MA',
  '2025-12-06', 1597400.39, 1597400.39, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 2
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  3, 'Serviço', 'EOBR',
  'Perfuração de um poço tubular profundo na Comunidade Sarney Costa, na cidade de São Luís/MA',
  '2025-12-08', 386395.29, 386395.29, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 3
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EPRO' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  4, 'Serviço', 'EPRO',
  'Contratação de empresa especializada para elaboração de estudos de concepção, projetos básico e executivo para implantação de desarenador (caixa de areia) tipo canal em concreto, fluxo horizontal, destinado a atender à EEE Pimenta (Lote 1) e à ETE Vinhais (Lote 2)',
  '2025-12-19', 255675.42, 255675.42, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 4
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  5, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular, no Município de Conceição do Lago Açu/MA',
  '2026-01-22', 592882.14, 592882.14, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 5
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  6, 'Serviço', 'EOBR',
  'Execução dos serviços específicos de engenharia e hidrogeologia, para perfuração de 01 (um) poço tubular profundo no bairro Bom Jesus, do Sistema de Abastecimento do Município de São Luís/MA',
  '2026-01-24', 386516.30, 386516.30, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 6
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  7, 'Serviço', 'EOBR',
  'Serviços comuns de engenharia e hidrogeologia para manutenção e reabilitação de poços tubulares profundos',
  '2026-01-27', 1040487.03, 1040487.03, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 7
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  8, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular profundo, no município de Paraibano/MA',
  '2026-02-18', 635535.74, 635535.74, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 8
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  9, 'Serviço', 'EOBR',
  'Execução de obras e serviço de conclusão de implementação e ampliação do sistema de abastecimento de água',
  '2026-02-20', 20625708.08, 20625708.08, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 9
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  10, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular, no Município de Coroatá/MA',
  '2026-03-16', 633343.27, 633343.27, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 10
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  11, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular profundo, no município de Fortuna/MA',
  '2026-03-16', 522811.64, 522811.64, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 11
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  12, 'Serviço', 'EOBR',
  'Execução dos serviços de perfuração de 01 (um) poço tubular profundo, com revestimento de tubo de aço e demais serviços pertinentes',
  '2026-03-19', 1241882.77, 1241882.77, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 12
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  13, 'Serviço', 'EOBR',
  'Contratação de empresa de engenharia para execução do saldo remanescente de obras de implementação e ampliação de sistemas de abastecimento de água e/ou coleta de esgoto',
  '2026-03-22', 21198718.22, 21198718.22, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 13
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EPRO' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  14, 'Serviço', 'EPRO',
  'Aquisição de licenças (assinaturas) de uso de softwares Autodesk, versão profissional, para a equipe técnica de engenharia',
  '2026-03-24', 94141.05, 94141.05, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 14
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  15, 'Serviço', 'EOBR',
  'Execução dos serviços específicos de engenharia e hidrogeologia, para perfuração de poços tubulares profundos em municípios do Maranhão',
  '2026-04-24', 614155.52, 614155.52, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 15
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  16, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular, no Município de Olho D''Água das Cunhãs/MA',
  '2026-04-24', 520763.07, 520763.07, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 16
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  17, 'Serviço', 'EOBR',
  'Prestação de serviços comuns de engenharia e hidrogeologia em 03 (três) poços tubulares profundos em municípios do Maranhão',
  '2026-04-30', 1531183.69, 1531183.69, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 17
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  18, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular profundo em município do Maranhão',
  '2026-04-30', 726025.70, 726025.70, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 18
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  19, 'Serviço', 'EOBR',
  'Perfuração de 04 (quatro) poços tubulares profundos, no Município de Imperatriz/MA',
  '2026-05-12', 3854404.86, 3854404.86, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 19
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  20, 'Serviço', 'EOBR',
  'Contratação de empresa especializada em execução de serviços comuns de engenharia para ampliação e melhoria de sistemas de abastecimento de água',
  '2026-05-13', 1412815.48, 1412815.48, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 20
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  21, 'Serviço', 'EOBR',
  'Contratação de empresa de engenharia especializada para prestação de serviços de execução de obras de saneamento',
  '2026-05-17', 262376.62, 262376.62, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 21
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  22, 'Serviço', 'EOBR',
  'Execução de Obras e Serviços de Conclusão de Implantação e Ampliação de sistemas de saneamento',
  '2026-05-18', 3040776.78, 3040776.78, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 22
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EPRO' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  23, 'Serviço', 'EPRO',
  'Contratação de serviços de fornecimento de licença anual de plataforma de geoprocessamento e sensoriamento remoto',
  '2026-06-10', 3599.90, 3599.90, 'Médio', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 23
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  24, 'Serviço', 'EOBR',
  'Perfuração de 01 (um) poço tubular profundo, com revestimento de tubo de aço e demais serviços pertinentes, em município do Maranhão',
  '2026-07-02', 1176915.91, 1176915.91, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 24
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  25, 'Serviço', 'EOBR',
  'Perfuração de 02 (dois) poços tubulares profundos em municípios do Maranhão',
  '2026-07-18', 1538218.15, 1538218.15, 'Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 25
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  26, 'Serviço', 'EOBR',
  'Prestação de serviços de manutenção predial visando atender à Região Metropolitana de São Luís',
  '2026-10-23', 4579944.00, 4579944.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 26
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  27, 'Serviço', 'EOBR',
  'Prestação de serviços de manutenção predial visando atender à Gerência de Pinheiro e demais unidades do interior',
  '2026-10-23', 2191805.14, 2191805.14, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 27
);

INSERT INTO servicos (periodo_id, diretoria_id, gerencia_id, item, tipo_contratacao, unidade_demandante, objeto, previsao_inicio, estimativa_valor, dotacao_orcamentaria, grau_prioridade, vinculacao, status)
SELECT
  (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1),
  (SELECT id FROM diretorias WHERE sigla = 'DE'),
  (SELECT id FROM gerencias WHERE sigla = 'EOBR' AND diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')),
  28, 'Serviço', 'EOBR',
  'Execução de serviços de recuperação de reservatórios, ETAs e execução de serviços complementares em municípios do Maranhão',
  '2027-03-01', 26001075.00, 26001075.00, 'Muito Alto', 'Não', 'rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM servicos WHERE diretoria_id = (SELECT id FROM diretorias WHERE sigla = 'DE')
  AND periodo_id = (SELECT id FROM periodos WHERE nome LIKE '%2027%' LIMIT 1) AND item = 28
);
