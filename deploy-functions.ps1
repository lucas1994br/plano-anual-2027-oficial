# Script PowerShell para Deploy de Edge Functions no Supabase
# Execute na raiz do projeto: .\deploy-functions.ps1

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Deploy de Edge Functions - Supabase" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se supabase CLI está instalado
try {
    $supabaseVersion = supabase --version 2>$null
    Write-Host "[✓] Supabase CLI detectado: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "[✗] Supabase CLI não está instalado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instale com:"
    Write-Host "  npm install -g supabase"
    Write-Host "  Ou: https://supabase.com/docs/guides/cli/getting-started"
    Write-Host ""
    exit 1
}

# Menu de opções
Write-Host ""
Write-Host "Opções de Deploy:" -ForegroundColor Yellow
Write-Host "  1. Deploy DE TODAS as funções"
Write-Host "  2. Deploy seletivo"
Write-Host "  3. Listar funções deployadas"
Write-Host "  4. Ver logs de uma função"
Write-Host ""

$choice = Read-Host "Escolha uma opção (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "[→] Iniciando deploy de TODAS as funções..." -ForegroundColor Yellow
        Write-Host ""
        
        supabase functions deploy
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[✓] Deploy completado!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Funções deployadas:" -ForegroundColor Yellow
            supabase functions list
        } else {
            Write-Host ""
            Write-Host "[✗] Deploy falhou!" -ForegroundColor Red
            exit 1
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "Selecione as funções para deploy:" -ForegroundColor Yellow
        Write-Host ""
        
        $functions = @(
            "admin-create-servico-catalogo",
            "admin-update-servico-catalogo",
            "admin-delete-servico-catalogo",
            "admin-distribuir-servico-catalogo",
            "admin-create-catalog-item",
            "admin-upsert-mini-erp-config",
            "admin-upsert-category-budget-owners",
            "validate-access-code",
            "gerencia-reset-solicitacao",
            "update-orcamento"
        )
        
        for ($i = 0; $i -lt $functions.Count; $i++) {
            Write-Host "  $($i + 1). $($functions[$i])"
        }
        
        Write-Host ""
        $funcIdx = Read-Host "Digite o número da função (ou deixe em branco para todos)"
        
        if ([string]::IsNullOrWhiteSpace($funcIdx)) {
            Write-Host "[→] Fazendo deploy de todas as funções..." -ForegroundColor Yellow
            supabase functions deploy
        } else {
            $idx = [int]$funcIdx - 1
            if ($idx -ge 0 -and $idx -lt $functions.Count) {
                $func = $functions[$idx]
                Write-Host "[→] Deploy de: $func" -ForegroundColor Yellow
                supabase functions deploy $func
            } else {
                Write-Host "[✗] Índice inválido!" -ForegroundColor Red
            }
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "Funções deployadas:" -ForegroundColor Yellow
        Write-Host ""
        supabase functions list
    }
    
    "4" {
        Write-Host ""
        $funcName = Read-Host "Nome da função (ex: admin-create-servico-catalogo)"
        Write-Host ""
        Write-Host "Logs de: $funcName" -ForegroundColor Yellow
        Write-Host ""
        supabase functions logs $funcName
    }
    
    default {
        Write-Host "[✗] Opção inválida!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "ℹ Para ver logs de uma função:" -ForegroundColor Cyan
Write-Host "  supabase functions logs NOME_DA_FUNCAO" -ForegroundColor Cyan
Write-Host ""
