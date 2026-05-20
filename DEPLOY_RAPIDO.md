# ⚡ Deploy Rápido - Edge Functions Corrigidas

## 🎯 3 Passos para Resolver o Erro

### Passo 1: Abra PowerShell
```powershell
cd c:\Users\noell\Downloads\Projetos\plano-anual-2027-oficial
```

### Passo 2: Fazer Deploy
```powershell
supabase functions deploy
```

**Aguarde a conclusão** (~30 segundos a 2 minutos)

Você verá:
```
✓ admin-create-servico-catalogo
✓ admin-update-servico-catalogo
✓ admin-delete-servico-catalogo
✓ admin-distribuir-servico-catalogo
✓ admin-create-catalog-item
✓ admin-upsert-mini-erp-config
✓ admin-upsert-category-budget-owners
✓ gerencia-reset-solicitacao
✓ validate-access-code
✓ update-orcamento
```

### Passo 3: Verificar Deploy
```powershell
supabase functions list
```

Todas as 10 funções devem aparecer com ✓

---

## 🧪 Testar se Funciona

1. **Abra o app no navegador**
2. **Vá para Painel Admin**
3. **Tente criar um novo serviço**

Se funcionar → **Problema resolvido!** 🎉

Se não funcionar → **Veja logs:**
```powershell
supabase functions logs admin-create-servico-catalogo
```

---

## 🔴 Se Errando Ainda...

### Erro: "Código admin inválido"
```sql
-- Supabase SQL Editor
SELECT * FROM codigos_acesso WHERE scope = 'admin' AND ativo = true;
-- Deve ter pelo menos um registro
```

### Erro: "No active period"
```sql
-- Supabase SQL Editor
SELECT * FROM periodos WHERE ativo = true;
-- Deve ter pelo menos um registro
```

### Erro: "No gerencias"
```sql
-- Supabase SQL Editor
SELECT COUNT(*) FROM gerencias WHERE ativa = true;
-- Deve ser > 0
```

---

## 📝 O Que Foi Corrigido

| Problema | Solução |
|----------|---------|
| ❌ `.or()` syntax inválida | ✅ Dividida em 2 queries separadas |
| ❌ Sem validation de env vars | ✅ Agora valida `SUPABASE_URL` |
| ❌ Sem error logs | ✅ Cada erro tem `console.error()` |
| ❌ Null handling ruim | ✅ Melhor tratamento de nulos |

---

## ✅ Checklist

- [ ] Abriu PowerShell na pasta do projeto
- [ ] Executou `supabase functions deploy`
- [ ] Verificou com `supabase functions list`
- [ ] Testou criar novo serviço no painel
- [ ] Se deu erro, viu os logs

---

**Pronto! Deploy em 2 minutos** ⏱️
