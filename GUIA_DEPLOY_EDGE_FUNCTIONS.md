# 🚀 Guia Completo: Deploy de Edge Functions no Supabase

## Índice
1. [Setup Inicial](#setup-inicial)
2. [Fazer Login no Supabase](#fazer-login-no-supabase)
3. [Deploy das Funções](#deploy-das-funções)
4. [Testar o Deploy](#testar-o-deploy)
5. [Troubleshooting](#troubleshooting)

---

## Setup Inicial

### 1. Instalar Supabase CLI

**No PowerShell (como administrador):**
```powershell
npm install -g supabase
```

**Verificar instalação:**
```powershell
supabase --version
# Deve retornar algo como: supabase-cli 1.XX.XX
```

### 2. Ter as Credenciais do Supabase

Você precisa:
- **Project ID**: Encontrar em Supabase Dashboard → Settings → General
- **Access Token**: Gerar em Supabase → Account → Access Tokens
  - Criar novo token
  - Selecionar "Full access"
  - Copiar o token (você verá só uma vez!)

---

## Fazer Login no Supabase

### Terminal PowerShell:

```powershell
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial

supabase login
```

**O que vai acontecer:**
1. Vai abrir o navegador
2. Autentique com sua conta do Supabase
3. Volta ao terminal com status "Logged in"

✅ **Pronto! Você está autenticado.**

---

## Deploy das Funções

### Opção 1: Deploy Rápido (Tudo de uma vez)

```powershell
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial

supabase functions deploy
```

**Isso vai:**
1. ✅ Fazer deploy de TODAS as funções em `supabase/functions/`
2. ✅ Atualizar funções existentes
3. ✅ Criar novas funções

**Tempo:** ~30 segundos a 2 minutos

### Opção 2: Deploy Seletivo (Uma função por vez)

```powershell
# Deploy apenas a função de criar serviço
supabase functions deploy admin-create-servico-catalogo

# Deploy apenas a função de validar código
supabase functions deploy validate-access-code

# ... e assim por diante
```

### Opção 3: Usar o Script Interativo

**PowerShell:**
```powershell
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial
.\deploy-functions.ps1
```

**CMD:**
```cmd
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial
deploy-functions.bat
```

O script vai te dar um menu para escolher o que fazer.

---

## Testar o Deploy

### 1. Verificar Funções Deployadas

```powershell
supabase functions list
```

**Saída esperada:**
```
✓ admin-create-servico-catalogo (Deno)
✓ admin-update-servico-catalogo (Deno)
✓ admin-delete-servico-catalogo (Deno)
✓ admin-distribuir-servico-catalogo (Deno)
✓ admin-create-catalog-item (Deno)
✓ admin-upsert-mini-erp-config (Deno)
✓ admin-upsert-category-budget-owners (Deno)
✓ validate-access-code (Deno)
✓ gerencia-reset-solicitacao (Deno)
✓ update-orcamento (Deno)
```

### 2. Ver Logs de uma Função

```powershell
supabase functions logs admin-create-servico-catalogo --limit 10
```

Isso mostra os últimos 10 logs de execução.

### 3. Testar no Browser

1. Abra seu projeto no navegador
2. Vá para **Painel Admin**
3. Tente **Cadastrar um novo serviço**
4. Se der erro, abra o DevTools (F12):
   - Vá em **Network**
   - Procure a requisição para `admin-create-servico-catalogo`
   - Verifique o **Status Code** e **Response**

---

## Troubleshooting

### ❌ Erro: "Edge Function returned a non-2xx status code"

**Possíveis causas e soluções:**

#### 1. **Função não foi deployada (404)**
```powershell
# Verificar
supabase functions list

# Se não aparecer, fazer deploy
supabase functions deploy admin-create-servico-catalogo
```

#### 2. **Código admin inválido/expirado (401)**

No Supabase Dashboard, vá em **SQL Editor** e execute:

```sql
-- Ver códigos admin válidos
SELECT id, codigo_hash, ativo, expira_em 
FROM codigos_acesso 
WHERE scope = 'admin' 
ORDER BY created_at DESC;

-- Se não houver nenhum, criar um
INSERT INTO codigos_acesso (codigo_hash, scope, ativo)
VALUES (
  'seu_codigo_hash_aqui',
  'admin',
  true
);
```

#### 3. **Período não ativo (400)**

```sql
-- Verificar períodos
SELECT id, nome, ativo 
FROM periodos 
ORDER BY inicio DESC;

-- Se não houver ativo, criar um
INSERT INTO periodos (nome, inicio, fim, ativo)
VALUES (
  'Período 2027',
  '2027-01-01',
  '2027-12-31',
  true
);
```

#### 4. **Gerências não cadastradas (400)**

```sql
-- Verificar
SELECT COUNT(*) as total_gerencias 
FROM gerencias 
WHERE ativa = true;

-- Se for 0, revisar dados no banco
```

#### 5. **Ver logs detalhados**

```powershell
# Logs em tempo real
supabase functions logs admin-create-servico-catalogo --tail

# Últimos erros
supabase functions logs admin-create-servico-catalogo --limit 50
```

### ❌ Erro: "Not authenticated"

```powershell
# Fazer login novamente
supabase logout
supabase login
```

### ❌ Erro: "Command not found: supabase"

```powershell
# Reinstalar
npm uninstall -g supabase
npm install -g supabase
```

---

## 📋 Checklist de Deploy

- [ ] Supabase CLI instalado (`supabase --version` retorna versão)
- [ ] Autenticado no Supabase (`supabase login`)
- [ ] Código admin válido na tabela `codigos_acesso`
- [ ] Período ativo na tabela `periodos`
- [ ] Gerências cadastradas e ativas
- [ ] Executou `supabase functions deploy`
- [ ] Verificou `supabase functions list` - mostra 10 funções
- [ ] Testou criar um serviço no painel admin
- [ ] Se deu erro, verificou logs com `supabase functions logs`

---

## 🔗 Links Úteis

- [Documentação Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Deploy de Edge Functions](https://supabase.com/docs/guides/functions/deploy)
- [Logs e Debugging](https://supabase.com/docs/guides/functions/debugging)
- [Environment Variables](https://supabase.com/docs/guides/functions/secrets)

---

## 💡 Dica Rápida

Se tiver problemas, execute em ordem:

```powershell
# 1. Verificar CLI
supabase --version

# 2. Fazer login
supabase login

# 3. Fazer deploy
supabase functions deploy

# 4. Ver status
supabase functions list

# 5. Ver logs
supabase functions logs admin-create-servico-catalogo
```

Pronto! 🎉
