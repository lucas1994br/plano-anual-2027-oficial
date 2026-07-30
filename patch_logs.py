import re
import sys

def main():
    file_path = "src/lib/services.ts"
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. saveAdminMiniErpConfigDb
    content = re.sub(
        r'(export async function saveAdminMiniErpConfigDb.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EDITAR", "configuracoes", "admin-mini-erp-config", { acao: "saveAdminMiniErpConfigDb" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 2. createServicoCatalogoAndDistribuir
    content = re.sub(
        r'(export async function createServicoCatalogoAndDistribuir.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("CRIAR", "servicos_catalogo", data?.id || "novo", { acao: "createServicoCatalogoAndDistribuir" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 3. updateServicoCatalogoAdmin
    content = re.sub(
        r'(export async function updateServicoCatalogoAdmin.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EDITAR", "servicos_catalogo", "bulk_update", { acao: "updateServicoCatalogoAdmin" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 4. deleteServicoCatalogoAdmin
    content = re.sub(
        r'(export async function deleteServicoCatalogoAdmin.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EXCLUIR", "servicos_catalogo", "bulk_delete", { acao: "deleteServicoCatalogoAdmin" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 5. saveCategoryBudgetOwnerRules
    content = re.sub(
        r'(export async function saveCategoryBudgetOwnerRules.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EDITAR", "configuracoes", "category_budget_owner_rules", { acao: "saveCategoryBudgetOwnerRules" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 6. createItemCatalogoAndDistribuir
    content = re.sub(
        r'(export async function createItemCatalogoAndDistribuir.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("CRIAR", "itens_catalogo", data?.id || "novo", { acao: "createItemCatalogoAndDistribuir" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 7. updateItemCatalogoAdmin
    content = re.sub(
        r'(export async function updateItemCatalogoAdmin.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EDITAR", "itens_catalogo", "bulk_update", { acao: "updateItemCatalogoAdmin" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 8. deleteItemCatalogoAdmin
    content = re.sub(
        r'(export async function deleteItemCatalogoAdmin.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EXCLUIR", "itens_catalogo", "bulk_delete", { acao: "deleteItemCatalogoAdmin" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 9. criarOrcamento
    content = re.sub(
        r'(export async function criarOrcamento.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("CRIAR", "orcamento_global", "novo_orcamento", { acao: "criarOrcamento" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 10. enviarOrcamento
    content = re.sub(
        r'(export async function enviarOrcamento.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EDITAR", "orcamento_global", "enviar_orcamento", { acao: "enviarOrcamento" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    # 11. deletarOrcamento
    content = re.sub(
        r'(export async function deletarOrcamento.*?if \(data\?\.error\) throw new Error\(data\.error\);\s*)(return data;\s*})',
        r'\1\n  await registrarLogAtividade("EXCLUIR", "orcamento_global", "deletar_orcamento", { acao: "deletarOrcamento" });\n\n  \2',
        content,
        flags=re.DOTALL
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
