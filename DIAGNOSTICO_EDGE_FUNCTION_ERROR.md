# Diagnóstico: "Edge Function returned a non-2xx status code"

## 🔍 Causas Possíveis

Baseado na análise do código, o erro ao criar um novo serviço no painel admin pode ter estas causas:

### 1. **Edge Function NÃO está deployada no Supabase (404)**
   - A função `admin-create-servico-catalogo` não foi publicada no seu projeto Supabase
   - Solução: Deploy da função (vide passos abaixo)

### 2. **Access Code inválido ou expirado (401)**
   - Localização: [supabase/functions/admin-create-servico-catalogo/index.ts](supabase/functions/admin-create-servico-catalogo/index.ts#L31-L50)
   - A função valida:
     - ✅ Se o código hash existe e está ativo
     - ✅ Se não expirou (`expira_em < agora`)
   - Solução: Verifique se tem um código admin válido na tabela `codigos_acesso`

### 3. **Erro interno na função (500)**
   - Pode ser problema com as variáveis de ambiente no Supabase:
     - `SUPABASE_URL` não configurada
     - `SUPABASE_SERVICE_ROLE_KEY` não configurada
   - Ou erro ao buscar gerências/períodos no banco

### 4. **CORS ou autenticação Supabase**
   - Função não tem permissão para acessar tabelas

---

## 🚀 Passos para Deploy das Edge Functions

### Pré-requisitos
```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Verificar instalação
supabase --version
```

### Login no Supabase
```bash
supabase login
# Vai abrir no navegador, autentique com sua conta
```

### Deploy das Edge Functions

```bash
# No diretório do projeto:
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial

# Deploy TODAS as funções
supabase functions deploy

# OU deploy uma função específica
supabase functions deploy admin-create-servico-catalogo
supabase functions deploy admin-update-servico-catalogo
supabase functions deploy admin-delete-servico-catalogo
supabase functions deploy admin-distribuir-servico-catalogo
supabase functions deploy admin-create-catalog-item
supabase functions deploy admin-upsert-mini-erp-config
supabase functions deploy admin-upsert-category-budget-owners
supabase functions deploy validate-access-code
supabase functions deploy gerencia-reset-solicitacao
supabase functions deploy update-orcamento
```

### Verificar Deploy
```bash
# Listar todas as funções deployadas
supabase functions list

# Ver logs de uma função
supabase functions logs admin-create-servico-catalogo
```

---

## 📋 Funções a Deployar

Seu projeto tem essas Edge Functions em `supabase/functions/`:

| Função | Propósito |
|--------|-----------|
| `admin-create-servico-catalogo` | Criar novo serviço e distribuir para gerências |
| `admin-update-servico-catalogo` | Atualizar serviço do catálogo |
| `admin-delete-servico-catalogo` | Deletar serviço |
| `admin-distribuir-servico-catalogo` | Redistribuir serviço para gerências |
| `admin-create-catalog-item` | Criar item do catálogo de materiais |
| `admin-upsert-mini-erp-config` | Configurar orçamento e roteamento |
| `admin-upsert-category-budget-owners` | Vincular categorias a diretorias |
| `validate-access-code` | Validar código de acesso (sem admin) |
| `gerencia-reset-solicitacao` | Reset de solicitações (para gerências) |
| `update-orcamento` | Atualizar orçamento |

---

## 🔧 Como Testar se Funciona

1. **Verifique se a função está deployada:**
   ```bash
   curl https://<your-project>.supabase.co/functions/v1/admin-create-servico-catalogo \
     -H "Authorization: Bearer <ANON_KEY>"
   ```

2. **Verifique o código admin:**
   - Vá em Supabase Dashboard → SQL Editor
   - Execute: `SELECT * FROM codigos_acesso WHERE scope = 'admin' AND ativo = true;`
   - Deve ter pelo menos um registro válido

3. **Verifique no browser DevTools:**
   - F12 → Network
   - Tente criar um serviço
   - Veja a requisição para `admin-create-servico-catalogo`
   - Verifique o status e resposta

---

## 📝 Variáveis de Ambiente

As funções precisam destas variáveis (configuradas automaticamente pelo Supabase):
- `SUPABASE_URL` - URL do seu projeto
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço (não expor)

Verificar em: Supabase Dashboard → Settings → API → Project Settings

---

## ✅ Checklist Rápido

- [ ] Código admin válido e não expirado na tabela `codigos_acesso`
- [ ] Período ativo criado na tabela `periodos`
- [ ] Gerências cadastradas e marcadas como ativas
- [ ] `supabase` CLI instalado e autenticado
- [ ] Executou `supabase functions deploy`
- [ ] Verificou logs com `supabase functions logs`
- [ ] Testou no browser (F12 → Network)
