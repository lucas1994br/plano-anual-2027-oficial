# 📌 Resumo Executivo: Erro "Edge Function returned a non-2xx status code"

## ⚡ TL;DR (Resumo Muito Rápido)

Seu erro ocorre porque as **Edge Functions não estão deployadas no Supabase**.

### Solução em 3 comandos:
```powershell
supabase login
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial
supabase functions deploy
```

---

## 🎯 O Que Está Acontecendo

```
Você clica em "Criar Serviço" no Painel Admin
        ↓
Código chama: supabase.functions.invoke("admin-create-servico-catalogo")
        ↓
Supabase procura a função no servidor
        ↓
❌ Não encontra (404) ou função retorna erro (500)
        ↓
Você vê: "Edge Function returned a non-2xx status code"
```

---

## ✅ Possíveis Causas (em ordem de probabilidade)

| # | Causa | Como Verificar | Como Corrigir |
|---|-------|---|---|
| 1️⃣ | **Função NÃO deployada** | `supabase functions list` | `supabase functions deploy` |
| 2️⃣ | Código admin inválido | SELECT * FROM codigos_acesso WHERE scope='admin' | Criar novo código admin |
| 3️⃣ | Período não ativo | SELECT * FROM periodos WHERE ativo=true | Criar período ativo |
| 4️⃣ | Gerências não cadastradas | SELECT COUNT(*) FROM gerencias WHERE ativa=true | Cadastrar gerências |
| 5️⃣ | Erro interno da função | `supabase functions logs admin-create-servico-catalogo` | Revisar código ou variáveis de ambiente |

---

## 🚀 3 Passos Rápidos para Resolver

### Passo 1: Instalar Supabase CLI (se não tiver)
```powershell
npm install -g supabase
```

### Passo 2: Fazer Login
```powershell
supabase login
# Vai abrir no navegador, faça login com sua conta Supabase
```

### Passo 3: Fazer Deploy
```powershell
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial
supabase functions deploy
```

**Pronto!** ✅

---

## 📊 Estrutura de Edge Functions do Seu Projeto

Seu projeto tem **10 Edge Functions** em `supabase/functions/`:

### Admin (para controlar o sistema)
- `admin-create-servico-catalogo` ← **Essa está falhando**
- `admin-update-servico-catalogo`
- `admin-delete-servico-catalogo`
- `admin-distribuir-servico-catalogo`
- `admin-create-catalog-item`
- `admin-upsert-mini-erp-config`
- `admin-upsert-category-budget-owners`

### Público (para usuários)
- `validate-access-code` - Validar código de acesso
- `gerencia-reset-solicitacao` - Reset de solicitações
- `update-orcamento` - Atualizar orçamento

---

## 🔍 Como Verificar se o Deploy Funcionou

### Verificar Funções Deployadas
```powershell
supabase functions list
```

Você deve ver algo assim:
```
✓ admin-create-servico-catalogo (Deno)
✓ admin-update-servico-catalogo (Deno)
✓ admin-delete-servico-catalogo (Deno)
... (e assim por diante)
```

### Ver Logs (Se der erro)
```powershell
supabase functions logs admin-create-servico-catalogo

# Logs em tempo real
supabase functions logs admin-create-servico-catalogo --tail
```

---

## 🛠️ Scripts Prontos para Usar

Criei 2 scripts para facilitar:

### Opção 1: PowerShell (Recomendado no Windows)
```powershell
.\deploy-functions.ps1
# Menu interativo com opções
```

### Opção 2: CMD (Batch)
```cmd
deploy-functions.bat
# Menu interativo com opções
```

Ambos estão na raiz do seu projeto.

---

## ❓ Perguntas Frequentes

### P: Preciso fazer deploy toda vez que edito o código?
**R:** Sim, após editar qualquer função em `supabase/functions/*/index.ts`, execute `supabase functions deploy`.

### P: Funciona com Local Development?
**R:** Sim! Use `supabase start` para usar Supabase localmente durante desenvolvimento.

### P: Onde vejo os logs de erro?
**R:** `supabase functions logs NOME_DA_FUNCAO --limit 50`

### P: Posso testar as funções sem o painel admin?
**R:** Sim, mas precisa enviar o `accessCode` válido. Veja `DIAGNOSTICO_EDGE_FUNCTION_ERROR.md`.

---

## 📚 Documentação Completa

Criei 3 arquivos para você:

1. **GUIA_DEPLOY_EDGE_FUNCTIONS.md** - Guia passo a passo completo
2. **DIAGNOSTICO_EDGE_FUNCTION_ERROR.md** - Análise detalhada do erro
3. **Esse arquivo** - Resumo executivo

---

## 🎓 Exemplo: Fluxo Completo de Uma Função

Quando você clica em "Criar Novo Serviço":

```javascript
// Frontend (seu app)
await supabase.functions.invoke("admin-create-servico-catalogo", {
  body: {
    accessCode: "seu-codigo-admin", // Do sessionStorage
    servico: {
      objeto: "Limpeza de escritório",
      objeto: "asda",
      grau_prioridade: "Médio",
      ...
    }
  }
})
```

```typescript
// Backend (Edge Function: supabase/functions/admin-create-servico-catalogo/index.ts)
// 1. Valida o accessCode contra a tabela codigos_acesso ✅
// 2. Verifica se está ativo e não expirou ✅
// 3. Busca o próximo número de item ✅
// 4. Insere o serviço na tabela servicos_catalogo ✅
// 5. Distribui para todas as gerências ativas ✅
// 6. Retorna status 200 com sucesso ✅
```

Se qualquer passo falhar → retorna erro com status não-2xx → Você vê a mensagem ❌

---

## ✨ Próximos Passos Após o Deploy

1. Testou que `supabase functions list` mostra as 10 funções ✅
2. Abriu o app no navegador
3. Foi para Painel Admin
4. Tentou criar um novo serviço
5. Se funcionar: **Pronto!** 🎉
6. Se não funcionar: Consulte `DIAGNOSTICO_EDGE_FUNCTION_ERROR.md` para troubleshooting

---

**Precisa de ajuda?** Veja os arquivos criados:
- `GUIA_DEPLOY_EDGE_FUNCTIONS.md` - Instruções detalhadas
- `DIAGNOSTICO_EDGE_FUNCTION_ERROR.md` - Análise de problema
- `deploy-functions.ps1` ou `deploy-functions.bat` - Scripts interativos
