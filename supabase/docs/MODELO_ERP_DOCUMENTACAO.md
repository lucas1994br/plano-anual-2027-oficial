# Modelo ERP - Documentação Completa

## Visão Geral

Este modelo implementa um sistema ERP de planejamento orçamentário por diretoria, seguindo boas práticas de separação de responsabilidades:

- **Quem solicita** (diretoria solicitante)
- **Quem paga** (centro de custo / diretoria dona do orçamento)
- **O que é o item** (catálogo de itens com categorias)
- **Planejamento anual** (versão/ano + diretoria + itens planejados)
- **Execução** (solicitações de compra reais)
- **Regras dinâmicas** (quem paga cada categoria)

---

## Tabelas e Relacionamentos

### 1. **diretoria** (Existente)
Central da estrutura - identifica cada diretoria.

```sql
- id (uuid) - PK
- sigla (text) - DG, DO, DTI, etc
- nome (text)
- ativa (bool)
```

### 2. **categoria_item** (Nova)
Classifica os itens no catálogo.

```sql
- id (uuid) - PK
- nome (text) - "Material de Expediente", "TI", etc
- descricao (text)
- ativa (bool)
```

**Exemplo:** Material de expediente, Informática, Móveis, Serviços, etc.

### 3. **centro_custo** (Nova) ⭐ IMPORTANTE
O "segredo" para ficar profissional. Um centro de custo é o responsável pelo orçamento.

```sql
- id (uuid) - PK
- codigo (text) - "CC-EXP-DG", "CC-TI-DTI"
- nome (text) - "Expediente - DG"
- diretoria_id (uuid) - FK para diretorias (quem "responde" pelo centro)
- ativo (bool)
```

**Importante:** Um centro de custo PERTENCE a uma diretoria. A diretoria é quem "responde" pelo gasto.

**Exemplo:**
- DG tem centros: CC-ADM-DG, CC-OPER-DG
- DTI tem centros: CC-ADM-DTI, CC-TI-DTI

### 4. **regra_categoria_centro_custo** (Nova)
Mapeia categoria → centro de custo PADRÃO (com vigência).

```sql
- id (uuid) - PK
- categoria_id (uuid) - FK
- centro_custo_id (uuid) - FK
- vigencia_inicio (date)
- vigencia_fim (date, null = indefinido)
- ativo (bool)
```

**Exemplo:**
- "Material de Expediente" → CC-ADM-DG (por padrão)
- "TI" → CC-TI-DTI (por padrão)

Quando a DO solicita material de expediente, o custo vai para DG por padrão.

### 5. **item_catalogo** (Existente + Melhorado)
Catálogo centralizado de itens que podem ser solicitados.

```sql
- id (uuid) - PK
- codigo (int) - "001", "002"
- descricao (text)
- categoria_id (uuid) - FK para categoria_item (NEW)
- unidade_medida (text) - "un", "cx", "resma"
- valor_unitario (numeric)
- ativo (bool)
```

### 6. **fornecedor** (Nova - Opcional mas Recomendado)
Cadastro de fornecedores para futuras compras.

```sql
- id (uuid) - PK
- cnpj (text)
- razao_social (text)
- nome_fantasia (text)
- ativo (bool)
```

---

## Fluxo de Planejamento Anual

### 7. **plano_anual** (Nova)
Cabeçalho do planejamento anual.

```sql
- id (uuid) - PK
- ano (int) - 2026, 2027
- status (text) - rascunho | em_aprovacao | aprovado | encerrado
- descricao (text)
- criado_por (uuid)
```

### 8. **plano_diretoria** (Nova)
A "proposta" anual de cada diretoria dentro de um plano.

```sql
- id (uuid) - PK
- plano_anual_id (uuid) - FK
- diretoria_id (uuid) - FK (A diretoria que está propondo)
- status (text) - rascunho | enviado | aprovado | devolvido
- observacoes (text)
- submitted_at (timestamp)
- approved_at (timestamp)
- unique (plano_anual_id, diretoria_id)
```

**Exemplo:** Plano 2026 → proposta da DG, proposta da DO, proposta da DTI

### 9. **plano_item** (Nova) ⭐ CORE DO SISTEMA
Os itens planejados - onde a "mágica" acontece.

```sql
- id (uuid) - PK
- plano_diretoria_id (uuid) - FK (qual proposta)
- item_catalogo_id (uuid) - FK (qual item)
- quantidade_prevista (numeric)
- valor_unit_previsto (numeric, null = será preenchido depois)
- justificativa (text)
- prioridade (int) - 1, 2, 3
- centro_custo_id (uuid) - FK ⭐ (QUEM PAGA - preenchido pela regra)
- meta_mes (int) - mês previsto (1..12)
```

**EXEMPLO CRÍTICO - Caso de Uso:**

```
DO (Diretoria de Operações) solicita 100 resmas de papel A4

1. DO cria plano_item:
   - plano_diretoria_id = "plano da DO para 2026"
   - item_catalogo_id = "papel A4"
   - categoria_item = "Material de Expediente"
   - quantidade_prevista = 100
   - justificativa = "consumo mensal"

2. REGRA APLICADA:
   SELECT centro_custo_id FROM regra_categoria_centro_custo
   WHERE categoria_id = "Material de Expediente"
   
   Resultado: CC-ADM-DG (Centro administrativo DA DG)

3. plano_item.centro_custo_id = CC-ADM-DG
   
   IMPORTANTE: DO solicita, MAS DG paga!
```

---

## Fluxo de Execução Orçamentária

### 10. **orcamento_anual** (Nova)
O orçamento aprovado por centro de custo.

```sql
- id (uuid) - PK
- ano (int)
- centro_custo_id (uuid) - FK
- valor_aprovado (numeric) - Orçamento total aprovado
- valor_reservado (numeric) - Soma do que tá em plano_item
- valor_executado (numeric) - Soma do que já foi comprado
- unique (ano, centro_custo_id)
```

**Fórmula Importante:**
```
Disponível = valor_aprovado - valor_reservado - valor_executado
```

### 11. **solicitacao_compra** (Nova)
Quando um item planejado vira uma solicitação de compra REAL.

```sql
- id (uuid) - PK
- diretoria_solicitante_id (uuid) - FK (quem quer)
- centro_custo_id (uuid) - FK (quem paga)
- status (text) - aberta | aprovada | rejeitada | em_cotacao | comprada | cancelada
- descricao (text)
```

### 12. **solicitacao_item** (Nova)
Itens dentro de uma solicitação de compra.

```sql
- id (uuid) - PK
- solicitacao_compra_id (uuid) - FK
- item_catalogo_id (uuid) - FK
- quantidade (numeric)
- valor_unit_estimado (numeric, null)
- valor_unit_final (numeric, null)
- plano_item_id (uuid, null) - Liga com o item planejado
```

### 13. **aprovacao** (Nova)
Workflow de aprovação (Direto, Gerência, Admin, Compras).

```sql
- id (uuid) - PK
- tipo (text) - plano_diretoria | solicitacao_compra
- referencia_id (uuid)
- etapa (int) - etapa do workflow
- aprovado_por (uuid)
- status (text) - pendente | aprovado | rejeitado
- comentario (text)
```

### 14. **log_orcamentario** (Nova) ⭐ TRILHA DO DINHEIRO
Cada movimento orçamentário fica registrado.

```sql
- id (uuid) - PK
- ano (int)
- centro_custo_id (uuid) - FK
- referencia_tipo (text) - plano_item | solicitacao_compra | compra
- referencia_id (uuid)
- acao (text) - reservar | estornar_reserva | executar | estornar_execucao
- valor (numeric)
- created_at (timestamp)
```

**Como funciona:**

```
1. Um plano_item é criado para 100 resmas @ R$ 50 = R$ 5.000
   → INSERT log_orcamentario: acao=reservar, valor=5000

2. Orçamento é atualizado:
   valor_reservado += 5000 (TRIGGER automático!)

3. Solicitação de compra é enviada com 100 resmas @ R$ 52 = R$ 5.200
   → INSERT log_orcamentario: acao=estornar_reserva, valor=5000
   → INSERT log_orcamentario: acao=reservar, valor=5200

4. Compra aprovada e entregue:
   → INSERT log_orcamentario: acao=estornar_reserva, valor=5200
   → INSERT log_orcamentario: acao=executar, valor=5200

5. Final: Disponível = 225000 - 0 - 5200 = 219800
```

---

## Functions Auxiliares

### `obter_centro_custo_categor(categoria_id, data?)`
Retorna o centro de custo padrão para uma categoria em uma data.

```sql
SELECT obter_centro_custo_categor('uuid-categoria'::uuid, '2026-01-01'::date);
```

### `calcular_disponivel_orcamento(centro_custo_id, ano)`
Calcula quanto ainda está disponível no orçamento.

```sql
SELECT calcular_disponivel_orcamento('uuid-centro'::uuid, 2026);
```

---

## Roles e Segurança (RLS)

| Role | Permissões |
|------|-----------|
| **admin** | Criar/modificar tudo: centros, categorias, regras, orçamentos |
| **gerencia** | Criar planos, visualizar orçamentos, criar solicitações |
| **diretoria** | Criar planos/solicitações apenas da sua diretoria |
| **compras** | Visualizar tudo, gerenciar aprovações e execução |
| **anon** | Apenas leitura de catálogos e diretorias |

---

## Fluxo Completo (Exemplo Prático)

### 2026 - Janeiro: Planejamento

1. **Admin** cria categorias, centros de custo, regras
2. **Diretoria** cria `plano_diretoria` para 2026
3. **Diretoria** adiciona `plano_item`: 
   - DESC: "Papel A4 para expediente"
   - QTD: 1000 resmas
   - Centro: regra automática aplica CC-ADM-DG
4. **Compras** revisa e aprova
5. Sistema cria `log_orcamentario`: reserva R$ 50.000 em CC-ADM-DG

### 2026 - Março: Execução

1. **Diretoria** cria `solicitacao_compra` com mesmos itens
2. Vincula `solicitacao_item` ao `plano_item` original
3. **Compras** cotação: encontra melhor preço R$ 48/resma
4. Sistema atualiza log: estorna R$ 50k, reserva R$ 48k
5. `solicitacao_compra` status → "comprada"
6. Sistema cria log: estorna reserva, executa R$ 48k

### Saldo Final

```
CC-ADM-DG 2026:
- Aprovado: R$ 125.000
- Reservado: R$ 0 (tudo executado)
- Executado: R$ 48.000
- Disponível: R$ 77.000
```

---

## Queries Úteis

### Orçamento por Centro de Custo

```sql
SELECT 
  cc.codigo,
  cc.nome,
  oa.valor_aprovado,
  oa.valor_reservado,
  oa.valor_executado,
  (oa.valor_aprovado - oa.valor_reservado - oa.valor_executado) as disponivel
FROM orcamento_anual oa
JOIN centro_custo cc ON cc.id = oa.centro_custo_id
WHERE oa.ano = 2026
ORDER BY cc.nome;
```

### Histórico Orçamentário de um Centro

```sql
SELECT 
  lo.created_at,
  lo.acao,
  lo.valor,
  lo.referencia_tipo,
  lo.referencia_id
FROM log_orcamentario lo
WHERE lo.centro_custo_id = 'uuid-centro'::uuid
AND lo.ano = 2026
ORDER BY lo.created_at;
```

### Itens Planejados por Diretoria

```sql
SELECT 
  d.sigla,
  ic.descricao,
  pi.quantidade_prevista,
  pi.valor_unit_previsto,
  cc.nome as paga_por,
  pi.prioridade
FROM plano_item pi
JOIN plano_diretoria pd ON pd.id = pi.plano_diretoria_id
JOIN diretorias d ON d.id = pd.diretoria_id
JOIN item_catalogo ic ON ic.id = pi.item_catalogo_id
JOIN centro_custo cc ON cc.id = pi.centro_custo_id
WHERE pd.plano_anual_id = 'uuid-plano'::uuid
ORDER BY d.sigla, pi.prioridade;
```

### Solicitações Pendentes de Aprovação

```sql
SELECT 
  sc.id,
  d.sigla as solicitante,
  cc.nome as paga_por,
  COUNT(si.id) as qtd_itens,
  sc.status,
  sc.created_at
FROM solicitacao_compra sc
JOIN diretorias d ON d.id = sc.diretoria_solicitante_id
JOIN centro_custo cc ON cc.id = sc.centro_custo_id
LEFT JOIN solicitacao_item si ON si.solicitacao_compra_id = sc.id
WHERE sc.status IN ('aberta', 'em_cotacao')
GROUP BY sc.id, d.sigla, cc.nome
ORDER BY sc.created_at;
```

---

## Próximos Passos

1. **Criar Views** para relatórios (disponibilidade, execução, etc)
2. **Políticas de Aprovação** (workflow customizável por perfil)
3. **Alertas** (quando 80% do orçamento é atingido)
4. **Integração com API** (criar endpoints CRUD para cada entidade)
5. **Frontend** (criar telas para planos, solicitações, orçamento)

---

## Comandos de Setup

```bash
# 1. Criar schema e tabelas
psql -d seu_db -f schema.sql

# 2. Popular dados iniciais
psql -d seu_db -f seed-erp.sql

# 3. Verificar integridade
SELECT * FROM categoria_item WHERE ativa;
SELECT * FROM centro_custo;
SELECT * FROM orcamento_anual;
```

---

**Documento versão: 1.0**
**Data: 2026-03-05**
