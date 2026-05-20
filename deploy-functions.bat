@echo off
REM Script para Deploy de Edge Functions no Supabase
REM Execute este arquivo na raiz do projeto

setlocal enabledelayedexpansion

echo.
echo ============================================
echo  Deploy de Edge Functions - Supabase
echo ============================================
echo.

REM Verificar se supabase CLI está instalado
supabase --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Supabase CLI não está instalado!
    echo.
    echo Instale com: npm install -g supabase
    echo Ou: https://supabase.com/docs/guides/cli/getting-started
    exit /b 1
)

echo [OK] Supabase CLI detectado

REM Listar funções disponíveis
echo.
echo [INFO] Funções disponíveis para deploy:
echo   1. Fazer deploy DE TODAS as funções
echo   2. Deploy seletivo
echo   3. Apenas listar funções
echo.

set /p choice="Escolha uma opção (1-3): "

if "%choice%"=="1" (
    echo.
    echo [DEPLOY] Iniciando deploy de TODAS as funções...
    echo.
    supabase functions deploy
    
    if %ERRORLEVEL% equ 0 (
        echo.
        echo [SUCESSO] Deploy completado!
        echo.
        supabase functions list
    ) else (
        echo.
        echo [ERRO] Deploy falhou!
        exit /b 1
    )
)

if "%choice%"=="2" (
    echo.
    echo Selecione as funções para deploy:
    echo.
    setlocal enabledelayedexpansion
    set "functions=admin-create-servico-catalogo admin-update-servico-catalogo admin-delete-servico-catalogo admin-distribuir-servico-catalogo admin-create-catalog-item admin-upsert-mini-erp-config admin-upsert-category-budget-owners validate-access-code gerencia-reset-solicitacao update-orcamento"
    
    set idx=1
    for %%f in (!functions!) do (
        echo   !idx!. %%f
        set /a idx=!idx!+1
    )
    echo.
    
    set /p funcIdx="Digite o número da função (ou deixe em branco para todos): "
    
    if "!funcIdx!"=="" (
        echo Fazendo deploy de todas...
        supabase functions deploy
    ) else (
        echo Fazendo deploy seletivo...
        set idx=1
        for %%f in (!functions!) do (
            if !idx! equ !funcIdx! (
                echo [DEPLOY] %%f
                supabase functions deploy %%f
            )
            set /a idx=!idx!+1
        )
    )
)

if "%choice%"=="3" (
    echo.
    echo [INFO] Funções deployadas:
    echo.
    supabase functions list
)

echo.
echo Para ver logs de uma função:
echo   supabase functions logs NOME_DA_FUNCAO
echo.
