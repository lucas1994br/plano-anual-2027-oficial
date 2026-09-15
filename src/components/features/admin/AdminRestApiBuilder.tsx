import React, { useState, useEffect } from "react";
import { 
  Code, 
  Copy, 
  Check, 
  Database, 
  Terminal, 
  ExternalLink, 
  FileSpreadsheet, 
  Play, 
  RefreshCw, 
  Globe, 
  FileJson, 
  Layers, 
  Sparkles, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  BarChart3,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  GOOGLE_SPREADSHEET_URL, 
  GOOGLE_SPREADSHEET_ID, 
  GOOGLE_SPREADSHEET_GID,
  GOOGLE_SCRIPT_URL
} from "@/lib/googleSheetsClient";

const DEFAULT_SCRIPT_URL = GOOGLE_SCRIPT_URL;

interface TableMetadata {
  id: string;
  name: string;
  sheetName: string;
  gid?: string;
  action: string;
  category: "Operacional" | "Cadastros" | "Governança" | "Catálogo";
  description: string;
  fields: { name: string; type: string; desc: string }[];
  supportedFilters: { key: string; label: string; placeholder: string; options?: { label: string; value: string }[] }[];
}

const TABLES: TableMetadata[] = [
  {
    id: "solicitacoes",
    name: "Solicitações de Aquisição (Materiais)",
    sheetName: "solicitacoes",
    gid: GOOGLE_SPREADSHEET_GID,
    action: "getSolicitacoes",
    category: "Operacional",
    description: "Tabela oficial e central de aquisições do PAC 2027 (Aba oficial com GID 604009512).",
    fields: [
      { name: "id", type: "UUID / String", desc: "Identificador único da solicitação" },
      { name: "numero_item", type: "Integer", desc: "Número sequencial do item" },
      { name: "descricao", type: "String", desc: "Descrição detalhada do material" },
      { name: "unidade_fornecimento", type: "String", desc: "Unidade de medida (UN, KG, CX, etc.)" },
      { name: "quantidade", type: "Number", desc: "Quantidade solicitada" },
      { name: "valor_unitario", type: "Number", desc: "Valor unitário estimado" },
      { name: "valor_total", type: "Number", desc: "Valor total da contratação" },
      { name: "status", type: "String", desc: "Status (rascunho, pendente, enviado, aprovado, rejeitado)" },
      { name: "diretoria_id", type: "String", desc: "Sigla ou ID da Diretoria (DG, DE, DC, DO, PR)" },
      { name: "gerencia_id", type: "String", desc: "ID ou sigla da Gerência solicitante" },
      { name: "periodo_id", type: "String", desc: "ID do período PAC correspondente" },
      { name: "created_at", type: "ISO DateTime", desc: "Data e hora de criação" },
    ],
    supportedFilters: [
      { 
        key: "diretoria_id", 
        label: "Diretoria", 
        placeholder: "Todas ou selecione",
        options: [
          { label: "DG - Diretoria Geral", value: "DG" },
          { label: "DE - Diretoria de Engenharia", value: "DE" },
          { label: "DC - Diretoria Comercial", value: "DC" },
          { label: "DO - Diretoria de Operações", value: "DO" },
          { label: "PR - Presidência", value: "PR" }
        ]
      },
      { 
        key: "status", 
        label: "Status", 
        placeholder: "Todos ou selecione",
        options: [
          { label: "Aprovado", value: "aprovado" },
          { label: "Pendente", value: "pendente" },
          { label: "Enviado", value: "enviado" },
          { label: "Rascunho", value: "rascunho" },
          { label: "Rejeitado", value: "rejeitado" }
        ]
      },
      { key: "gerencia_id", label: "Gerência (Sigla/ID)", placeholder: "Ex: GCFI, EMAR, UEP..." },
      { key: "periodo_id", label: "Período (ID)", placeholder: "Ex: per-2027" }
    ]
  },
  {
    id: "servicos",
    name: "Contratações de Serviços",
    sheetName: "servicos",
    action: "getServicos",
    category: "Operacional",
    description: "Contratos e contratações de serviços continuados ou novos para o exercício de 2027.",
    fields: [
      { name: "id", type: "UUID / String", desc: "Identificador único do serviço" },
      { name: "item", type: "Integer", desc: "Número ordinal do item de serviço" },
      { name: "descricao", type: "String", desc: "Objeto/escopo do serviço" },
      { name: "tipo_servico", type: "String", desc: "Contínuo, pontual ou sob demanda" },
      { name: "valor_total", type: "Number", desc: "Valor global anual previsto" },
      { name: "status", type: "String", desc: "Status do fluxo de aprovação" },
      { name: "diretoria_id", type: "String", desc: "Diretoria gestora" },
      { name: "gerencia_id", type: "String", desc: "Gerência gestora" }
    ],
    supportedFilters: [
      { 
        key: "diretoria_id", 
        label: "Diretoria", 
        placeholder: "Todas ou selecione",
        options: [
          { label: "DG", value: "DG" },
          { label: "DE", value: "DE" },
          { label: "DC", value: "DC" },
          { label: "DO", value: "DO" },
          { label: "PR", value: "PR" }
        ]
      },
      { 
        key: "status", 
        label: "Status", 
        placeholder: "Todos ou selecione",
        options: [
          { label: "Aprovado", value: "aprovado" },
          { label: "Pendente", value: "pendente" },
          { label: "Enviado", value: "enviado" }
        ]
      },
      { key: "gerencia_id", label: "Gerência", placeholder: "Ex: GCON, EPRO..." }
    ]
  },
  {
    id: "itens_catalogo",
    name: "Catálogo de Itens / Materiais",
    sheetName: "itens_catalogo",
    action: "getItensCatalogo",
    category: "Catálogo",
    description: "Catálogo padronizado de materiais e suprimentos da CAEMA com códigos e descrições.",
    fields: [
      { name: "id", type: "String", desc: "Identificador único do catálogo" },
      { name: "codigo", type: "String", desc: "Código interno do material" },
      { name: "descricao", type: "String", desc: "Descrição padronizada do material" },
      { name: "unidade_fornecimento", type: "String", desc: "Unidade padrão" },
      { name: "valor_referencia", type: "Number", desc: "Valor de referência histórico" }
    ],
    supportedFilters: []
  },
  {
    id: "servicos_catalogo",
    name: "Catálogo de Serviços Padronizados",
    sheetName: "servicos_catalogo",
    action: "getServicosCatalogo",
    category: "Catálogo",
    description: "Catálogo com especificações técnicas padronizadas para contratação de serviços.",
    fields: [
      { name: "id", type: "String", desc: "ID do serviço catalogado" },
      { name: "descricao", type: "String", desc: "Objeto do serviço" },
      { name: "gerencia_id", type: "String", desc: "Gerência competente" }
    ],
    supportedFilters: [
      { key: "gerencia_id", label: "Gerência", placeholder: "Filtrar por gerência" }
    ]
  },
  {
    id: "diretorias",
    name: "Diretorias",
    sheetName: "diretorias",
    action: "getDiretorias",
    category: "Cadastros",
    description: "Lista das diretorias corporativas da CAEMA (DG, DE, DC, DO, PR).",
    fields: [
      { name: "id", type: "UUID / String", desc: "Identificador da diretoria" },
      { name: "sigla", type: "String", desc: "Sigla institucional (ex: DG, DE)" },
      { name: "nome", type: "String", desc: "Nome por extenso da diretoria" }
    ],
    supportedFilters: []
  },
  {
    id: "gerencias",
    name: "Gerências",
    sheetName: "gerencias",
    action: "getGerencias",
    category: "Cadastros",
    description: "Unidades administrativas e gerências operacionais vinculadas às diretorias.",
    fields: [
      { name: "id", type: "UUID / String", desc: "Identificador único da gerência" },
      { name: "diretoria_id", type: "String", desc: "ID ou sigla da diretoria vinculada" },
      { name: "sigla", type: "String", desc: "Sigla da gerência (ex: GCFI, EMAR)" },
      { name: "nome", type: "String", desc: "Nome completo da gerência" }
    ],
    supportedFilters: [
      { key: "diretoria_id", label: "Diretoria (ID ou Sigla)", placeholder: "Ex: DG, DE..." }
    ]
  },
  {
    id: "periodos",
    name: "Períodos do PAC",
    sheetName: "periodos",
    action: "getPeriodos",
    category: "Governança",
    description: "Janelas de planejamento anual com data de abertura, encerramento e status ativo.",
    fields: [
      { name: "id", type: "String", desc: "ID do período (ex: per-2027)" },
      { name: "nome", type: "String", desc: "Nome do ciclo (ex: PAC 2027)" },
      { name: "inicio", type: "Date", desc: "Data de início" },
      { name: "fim", type: "Date", desc: "Data de término" },
      { name: "ativo", type: "Boolean", desc: "Indica se é o período corrente" }
    ],
    supportedFilters: []
  },
  {
    id: "admin_config",
    name: "Limites Orçamentários e Configurações",
    sheetName: "admin_config",
    action: "getAdminConfig",
    category: "Governança",
    description: "Tetos orçamentários por diretoria e parâmetros globais do sistema.",
    fields: [
      { name: "chave", type: "String", desc: "Chave do parâmetro (ex: teto_DG)" },
      { name: "valor", type: "JSON / Number / String", desc: "Valor associado à chave" }
    ],
    supportedFilters: []
  },
  {
    id: "logs_atividades",
    name: "Logs de Atividades e Auditoria",
    sheetName: "logs_atividades",
    action: "getLogsAtividades",
    category: "Governança",
    description: "Trilha de auditoria das ações dos usuários, exclusões lógicas e eventos de aprovação.",
    fields: [
      { name: "id", type: "String", desc: "Identificador do log" },
      { name: "acao", type: "String", desc: "Ação executada (create, update, delete, approve)" },
      { name: "usuario", type: "String", desc: "Identificação do usuário ou gerência" },
      { name: "detalhes", type: "String", desc: "Detalhes em texto ou JSON" },
      { name: "timestamp", type: "ISO DateTime", desc: "Data e hora do evento" }
    ],
    supportedFilters: [
      { 
        key: "lixeira", 
        label: "Lixeira / Excluídos", 
        placeholder: "Todos ou selecione",
        options: [
          { label: "Somente Ativos (Padrão)", value: "false" },
          { label: "Somente Excluídos (Lixeira)", value: "true" }
        ]
      }
    ]
  },
  {
    id: "log_orcamentario",
    name: "Trilha Financeira (Mini-ERP)",
    sheetName: "log_orcamentario",
    action: "getLogsOrcamentarios",
    category: "Governança",
    description: "Lançamentos e movimentações de empenho orçamentário por diretoria.",
    fields: [
      { name: "id", type: "String", desc: "ID do registro financeiro" },
      { name: "diretoria_id", type: "String", desc: "Diretoria" },
      { name: "tipo", type: "String", desc: "Crédito, Débito, Estorno" },
      { name: "valor", type: "Number", desc: "Valor da transação" },
      { name: "created_at", type: "ISO DateTime", desc: "Data do lançamento" }
    ],
    supportedFilters: []
  },
  {
    id: "restricoes_atividades",
    name: "Restrições e Janelas Operacionais",
    sheetName: "restricoes_atividades",
    action: "getRestricoesAtividades",
    category: "Governança",
    description: "Regras de bloqueio temporal e permissões por perfil de usuário.",
    fields: [
      { name: "id", type: "String", desc: "ID da regra" },
      { name: "perfil", type: "String", desc: "Perfil afetado (gerencia, diretoria, etc.)" },
      { name: "bloqueado", type: "Boolean", desc: "Indica se o envio está suspenso" }
    ],
    supportedFilters: []
  },
  {
    id: "funcionarios",
    name: "Funcionários e Colaboradores",
    sheetName: "funcionarios",
    action: "getFuncionarios",
    category: "Cadastros",
    description: "Colaboradores e responsáveis técnicos designados.",
    fields: [
      { name: "id", type: "String", desc: "Identificador" },
      { name: "nome", type: "String", desc: "Nome completo" },
      { name: "matricula", type: "String", desc: "Matrícula funcional" },
      { name: "gerencia_id", type: "String", desc: "Gerência de lotação" }
    ],
    supportedFilters: []
  },
  {
    id: "codigos_acesso",
    name: "Códigos de Acesso de Segurança",
    sheetName: "codigos_acesso",
    action: "getCodigosAcesso",
    category: "Cadastros",
    description: "Perfis e códigos de acesso por nível de governança.",
    fields: [
      { name: "id", type: "String", desc: "ID do código" },
      { name: "codigo", type: "String", desc: "Código de acesso criptografado/hasheado" },
      { name: "escopo", type: "String", desc: "Nível de acesso (admin, diretoria, gerencia)" }
    ],
    supportedFilters: []
  }
];

export function AdminRestApiBuilder() {
  const [selectedTableId, setSelectedTableId] = useState<string>("solicitacoes");
  const [customTableMode, setCustomTableMode] = useState<boolean>(false);
  const [customTableName, setCustomTableName] = useState<string>("");
  const [customGid, setCustomGid] = useState<string>("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Live tester state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    statusText: string;
    durationMs: number;
    count?: number;
    success: boolean;
    data?: any;
    error?: string;
  } | null>(null);

  // Ping / health check state
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [pingDuration, setPingDuration] = useState<number | null>(null);
  const [isCheckingPing, setIsCheckingPing] = useState<boolean>(false);

  const scriptUrl = GOOGLE_SCRIPT_URL;

  const currentTable = TABLES.find(t => t.id === selectedTableId) || TABLES[0];

  // Reseta filtros quando troca de tabela
  useEffect(() => {
    setFilterValues({});
    setTestResult(null);
  }, [selectedTableId, customTableMode]);

  // Checagem de disponibilidade inicial da API
  const checkApiHealth = async () => {
    setIsCheckingPing(true);
    const start = performance.now();
    try {
      const res = await fetch(`${scriptUrl}?action=ping`);
      const data = await res.json();
      const elapsed = Math.round(performance.now() - start);
      setPingDuration(elapsed);
      if (data && data.success) {
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }
    } catch {
      setApiOnline(false);
      setPingDuration(null);
    } finally {
      setIsCheckingPing(false);
    }
  };

  useEffect(() => {
    checkApiHealth();
  }, []);

  // Constrói a URL final do endpoint com base nos filtros
  const buildEndpointUrl = () => {
    const url = new URL(scriptUrl);
    
    if (customTableMode) {
      if (customGid) {
        url.searchParams.set("action", "getDataByGid");
        url.searchParams.set("gid", customGid.trim());
      } else {
        url.searchParams.set("action", "getTable");
        url.searchParams.set("table", (customTableName || "solicitacoes").trim());
      }
    } else {
      url.searchParams.set("action", currentTable.action);
      Object.entries(filterValues).forEach(([key, val]) => {
        if (val && val.trim() !== "") {
          url.searchParams.set(key, val.trim());
        }
      });
    }

    return url.toString();
  };

  // URL Direta da Planilha em CSV (Google Visualization)
  const buildCsvDirectUrl = () => {
    const sheetNameOrGid = customTableMode 
      ? (customGid ? `gid=${customGid}` : `sheet=${customTableName || 'solicitacoes'}`)
      : (currentTable.gid ? `gid=${currentTable.gid}` : `sheet=${currentTable.sheetName}`);
    
    return `https://docs.google.com/spreadsheets/d/${GOOGLE_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&${sheetNameOrGid}`;
  };

  const endpointUrl = buildEndpointUrl();
  const csvDirectUrl = buildCsvDirectUrl();

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Executa o teste ao vivo da requisição
  const handleRunLiveTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const response = await fetch(endpointUrl);
      const elapsed = Math.round(performance.now() - start);
      const json = await response.json();

      let recordCount = 0;
      if (Array.isArray(json.data)) {
        recordCount = json.data.length;
      } else if (Array.isArray(json)) {
        recordCount = json.length;
      } else if (json && typeof json.count === "number") {
        recordCount = json.count;
      }

      setTestResult({
        status: response.status,
        statusText: response.statusText || "OK",
        durationMs: elapsed,
        count: recordCount,
        success: json.success !== false,
        data: json
      });
      toast.success(`Requisição concluída em ${elapsed}ms! (${recordCount} registros)`);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setTestResult({
        status: 500,
        statusText: "Network Error",
        durationMs: elapsed,
        success: false,
        error: err.message || "Erro de conexão ao executar a requisição."
      });
      toast.error("Falha na requisição. Verifique a URL do Google Apps Script.");
    } finally {
      setIsTesting(false);
    }
  };

  // -------------------------------------------------------------
  // GERADORES DE CÓDIGO
  // -------------------------------------------------------------

  // 1. Python Code Snippet
  const getPythonSnippet = () => {
    return `# =========================================================================
# PAC 2027 — INTEGRAÇÃO REST API (PYTHON)
# Tabela: ${currentTable.name}
# =========================================================================
import requests
import pandas as pd
import json

# Endpoint gerado para a tabela ${currentTable.sheetName}
API_URL = "${endpointUrl}"

def carregar_dados():
    print(f"Consultando endpoint: {API_URL}")
    response = requests.get(API_URL, timeout=30)
    response.raise_for_status()
    
    payload = response.json()
    if not payload.get("success", False):
        raise ValueError(f"Erro na API: {payload.get('error', 'Falha desconhecida')}")
    
    # Os registros estão contidos na chave 'data'
    registros = payload.get("data", [])
    
    # Criação do DataFrame pandas pronto para análise de dados / gráficos
    df = pd.DataFrame(registros)
    print(f"✓ Sucesso: {len(df)} registros carregados!")
    return df

if __name__ == "__main__":
    df = carregar_dados()
    print("\\n--- Primeiras 5 linhas ---")
    print(df.head())
    print("\\n--- Informações das colunas ---")
    print(df.info())
`;
  };

  // 2. Java Code Snippet
  const getJavaSnippet = () => {
    return `// =========================================================================
// PAC 2027 — INTEGRAÇÃO REST API (JAVA 11+)
// Tabela: ${currentTable.name}
// =========================================================================
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class Pac2027ApiClient {

    private static final String API_ENDPOINT = 
        "${endpointUrl}";

    public static void main(String[] args) {
        HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_2)
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_ENDPOINT))
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(30))
                .GET()
                .build();

        try {
            System.out.println("Enviando requisição GET para o endpoint...");
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            System.out.println("Status Code: " + response.statusCode());
            if (response.statusCode() == 200) {
                System.out.println("✓ Dados recebidos com sucesso!");
                System.out.println("Corpo da resposta:");
                System.out.println(response.body().substring(0, Math.min(600, response.body().length())) + "...");
                // Dica: Use Jackson (ObjectMapper) ou Gson para desserializar para POJO:
                // PacResponse<List<Item>> data = new ObjectMapper().readValue(response.body(), ...);
            } else {
                System.err.println("Erro na requisição: " + response.body());
            }
        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
        }
    }
}
`;
  };

  // 3. JavaScript / TypeScript Code Snippet
  const getJsSnippet = () => {
    return `// =========================================================================
// PAC 2027 — INTEGRAÇÃO REST API (JAVASCRIPT / TYPESCRIPT)
// Tabela: ${currentTable.name}
// =========================================================================

const ENDPOINT_URL = "${endpointUrl}";

/**
 * Consulta a tabela oficial do PAC 2027 via Fetch API
 * Funciona no Browser, Node.js 18+, Bun e Deno
 */
async function fetchPacData() {
  try {
    console.log("Requisitando dados de:", ENDPOINT_URL);
    const response = await fetch(ENDPOINT_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(\`Erro HTTP \${response.status}: \${response.statusText}\`);
    }

    const payload = await response.json();
    
    if (!payload.success) {
      throw new Error(payload.error || "Erro retornado pela API");
    }

    console.log(\`✓ \${payload.data?.length || 0} registros obtidos com sucesso!\`);
    return payload.data;
  } catch (error) {
    console.error("Falha na chamada REST:", error);
    throw error;
  }
}

// Exemplo de execução:
fetchPacData().then(dados => {
  console.table(dados.slice(0, 5));
});
`;
  };

  // 4. Power BI - Power Query M Code Snippet (Web.Contents JSON)
  const getPowerBiJsonSnippet = () => {
    return `// =========================================================================
// POWER BI — SCRIPT M (POWER QUERY) - VIA REST API JSON
// Cole este código no "Editor Avançado" do Power BI Desktop
// =========================================================================
let
    // 1. URL da REST API oficial do PAC 2027
    ApiUrl = "${endpointUrl}",

    // 2. Requisição Web e conversão da resposta JSON
    Fonte = Json.Document(Web.Contents(ApiUrl)),

    // 3. Extração da lista de registros da chave 'data'
    DadosLista = Fonte[data],

    // 4. Conversão da lista de objetos para tabela
    TabelaConvertida = Table.FromList(DadosLista, Splitter.SplitByNothing(), null, null, ExtraValues.Error),

    // 5. Expansão dinâmica de todas as colunas
    NomesColunas = Record.FieldNames(TabelaConvertida{0}[Column1]),
    TabelaExpandida = Table.ExpandRecordColumn(TabelaConvertida, "Column1", NomesColunas, NomesColunas)
in
    TabelaExpandida
`;
  };

  // 5. Power BI - Power Query M Code Snippet (Direct CSV Live Sync)
  const getPowerBiCsvSnippet = () => {
    return `// =========================================================================
// POWER BI — SCRIPT M (POWER QUERY) - VIA FLUXO CSV DIRETO
// Alta performance para tabelas com muitos registros sem auth de terceiros
// =========================================================================
let
    // Endpoint de exportação direta CSV da Planilha Google
    UrlCsv = "${csvDirectUrl}",

    // Download do arquivo CSV com codificação UTF-8
    Fonte = Csv.Document(
        Web.Contents(UrlCsv), 
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.None]
    ),

    // Promove a primeira linha como cabeçalhos de coluna
    CabecalhosPromovidos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true])
in
    CabecalhosPromovidos
`;
  };

  // 6. SQL Commands Snippet
  const getSqlSnippet = () => {
    const tableName = currentTable.sheetName;
    return `-- =========================================================================
-- CONSULTAS SQL — PAC 2027
-- Tabela: ${currentTable.name} (${tableName})
-- =========================================================================

-- 1. POSTGRESQL / SUPABASE (Consulta Direta de Banco)
SELECT 
    id,
    ${tableName === 'solicitacoes' ? 'numero_item,\n    descricao,\n    quantidade,\n    valor_unitario,\n    valor_total,\n    status,\n    diretoria_id,\n    gerencia_id,\n    periodo_id,' : 'descricao,\n    status,\n    diretoria_id,\n    gerencia_id,'}
    created_at
FROM ${tableName}
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- 2. DUCKDB (Consulta direta no endpoint CSV da Planilha Google sem banco)
SELECT * 
FROM read_csv_auto('${csvDirectUrl}')
LIMIT 100;

-- 3. GOOGLE VISUALIZATION SQL (Consulta executada direto no Google Sheets)
-- Pode ser passada na URL via parâmetro tq=...
-- Exemplo: Selecionar itens com valor total expressivo
SELECT A, B, C, D, E, F 
WHERE E > 0 
ORDER BY A ASC;
`;
  };

  // 7. cURL Snippet
  const getCurlSnippet = () => {
    return `# =========================================================================
# cURL — PAC 2027 REST API
# Nota: A flag -L é OBRIGATÓRIA para seguir o redirecionamento 302 do Google
# =========================================================================
curl -L -X GET "${endpointUrl}" \\
     -H "Accept: application/json"
`;
  };

  return (
    <div className="space-y-6">
      {/* CARD DO CABEÇALHO COM STATUS EM TEMPO REAL */}
      <Card className="border-border/60 shadow-sm overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                  <Server className="h-5 w-5 text-indigo-300" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  Central de Integração REST API & Power BI
                </h2>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  Plano Anual 2027
                </Badge>
              </div>
              <p className="text-sm text-slate-300 max-w-2xl">
                Crie, teste e gere endpoints REST parametrizados para acessar todas as tabelas da 
                Planilha Google Oficial. Obtenha código pronto em Python, Java, JavaScript, comandos SQL e conexões nativas para o Power BI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status do Backend */}
              <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs">
                <span className="text-slate-400">Status da API:</span>
                {isCheckingPing ? (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verificando...
                  </span>
                ) : apiOnline === true ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online {pingDuration ? `(${pingDuration}ms)` : ""}
                  </span>
                ) : apiOnline === false ? (
                  <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Indisponível
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-slate-400 hover:text-white" 
                  onClick={checkApiHealth}
                  title="Testar ping novamente"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>

              {/* Link da Planilha Oficial */}
              <a
                href={GOOGLE_SPREADSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-emerald-200 bg-emerald-900/60 hover:bg-emerald-900/90 border border-emerald-600/40 rounded-lg transition-colors shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <span>Planilha Oficial (GID: {GOOGLE_SPREADSHEET_GID})</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ÁREA PRINCIPAL: SELETOR DE TABELA + CONSTRUTOR DE FILTROS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA: CONFIGURAÇÃO DO ENDPOINT (4 COLUNAS) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/70">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  1. Seleção da Tabela / Aba
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {customTableMode ? "Modo Customizado" : `${TABLES.length} Tabelas`}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Escolha uma tabela da planilha oficial ou informe uma aba customizada.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Alternador Modo Padrão vs Customizado */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <Label htmlFor="table-mode" className="text-xs font-medium text-slate-700">
                  Modo de Consulta
                </Label>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant={!customTableMode ? "default" : "outline"} 
                    className="h-7 text-xs px-2.5"
                    onClick={() => setCustomTableMode(false)}
                  >
                    Tabelas Oficiais
                  </Button>
                  <Button 
                    size="sm" 
                    variant={customTableMode ? "default" : "outline"} 
                    className="h-7 text-xs px-2.5"
                    onClick={() => setCustomTableMode(true)}
                  >
                    Personalizado / GID
                  </Button>
                </div>
              </div>

              {!customTableMode ? (
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-slate-700">Tabela do Sistema</Label>
                  <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Selecione a tabela" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {["Operacional", "Cadastros", "Catálogo", "Governança"].map((cat) => (
                        <div key={cat} className="mb-2">
                          <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                            {cat}
                          </div>
                          {TABLES.filter(t => t.category === cat).map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs py-1.5">
                              <span className="font-medium text-slate-800">{t.name}</span>
                              <span className="text-slate-400 ml-1.5">({t.sheetName})</span>
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Informações da tabela selecionada */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Nome da Aba no Google:</span>
                      <code className="font-mono bg-white px-1.5 py-0.5 rounded border text-indigo-700 font-semibold">
                        {currentTable.sheetName}
                      </code>
                    </div>
                    {currentTable.gid && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">GID Oficial:</span>
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border text-emerald-700 font-semibold">
                          {currentTable.gid}
                        </code>
                      </div>
                    )}
                    <div className="text-slate-600 pt-1">
                      {currentTable.description}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Nome da Aba na Planilha</Label>
                    <Input 
                      placeholder="Ex: solicitacoes, servicos, minha_aba" 
                      value={customTableName}
                      onChange={(e) => setCustomTableName(e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Ou informe o GID numérico</Label>
                    <Input 
                      placeholder="Ex: 604009512" 
                      value={customGid}
                      onChange={(e) => setCustomGid(e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                    <span className="text-[11px] text-slate-500">
                      O GID é o identificador numérico ao final da URL da planilha após <code>#gid=</code>.
                    </span>
                  </div>
                </div>
              )}

              {/* CONSTRUTOR DE FILTROS DINÂMICOS */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs font-semibold text-slate-800">
                    2. Parâmetros de Consulta (Query Params)
                  </Label>
                </div>

                {!customTableMode && currentTable.supportedFilters.length > 0 ? (
                  <div className="space-y-2.5">
                    {currentTable.supportedFilters.map((filt) => (
                      <div key={filt.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{filt.label}:</span>
                          <code className="text-[11px] text-slate-400 font-mono">{filt.key}</code>
                        </div>
                        {filt.options ? (
                          <Select 
                            value={filterValues[filt.key] || "ALL"} 
                            onValueChange={(val) => {
                              setFilterValues(prev => ({
                                ...prev,
                                [filt.key]: val === "ALL" ? "" : val
                              }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder={filt.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL" className="text-xs text-slate-500">
                                Sem filtro (Todos os registros)
                              </SelectItem>
                              {filt.options.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            placeholder={filt.placeholder}
                            value={filterValues[filt.key] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFilterValues(prev => ({
                                ...prev,
                                [filt.key]: val
                              }));
                            }}
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    {customTableMode 
                      ? "A consulta retornará todos os registros da aba customizada informada."
                      : "Esta tabela retorna o conjunto completo de registros sem filtros adicionais obrigatórios."}
                  </p>
                )}
              </div>

              {/* CAMPOS DA TABELA (SCHEMA) */}
              {!customTableMode && currentTable.fields && (
                <div className="pt-2 border-t border-slate-100">
                  <details className="group text-xs">
                    <summary className="font-semibold text-slate-700 cursor-pointer flex items-center justify-between hover:text-primary py-1">
                      <span>Estrutura de Colunas ({currentTable.fields.length} campos)</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ScrollArea className="h-44 mt-2 pr-2 border rounded-md p-2 bg-slate-50/50">
                      <div className="space-y-2">
                        {currentTable.fields.map(f => (
                          <div key={f.name} className="border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-medium text-indigo-700">{f.name}</span>
                              <span className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-200/60 rounded">
                                {f.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">{f.desc}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUNA DIREITA: ENDPOINT GERADO, TESTADOR LIVE E GERADOR DE CÓDIGO (7 COLUNAS) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CARD DO ENDPOINT GERADO */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/70">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  3. Endpoint REST Gerado
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleCopy(endpointUrl, "endpoint-url")}
                  >
                    {copiedKey === "endpoint-url" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    Copiar URL
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    disabled={isTesting}
                    onClick={handleRunLiveTest}
                  >
                    {isTesting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Testar / Executar
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs">
                Endpoint HTTP GET oficial compatível com qualquer linguagem e ferramentas de BI.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="relative">
                <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg break-all border border-slate-800 flex items-start justify-between gap-2">
                  <span className="select-all">{endpointUrl}</span>
                </div>
              </div>

              {/* PAINEL DE RESULTADO DO TESTE AO VIVO */}
              {testResult && (
                <div className="mt-3 p-3.5 rounded-lg border text-xs space-y-2 bg-slate-950 text-slate-200 border-slate-800 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          HTTP {testResult.status} {testResult.statusText}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-[11px]">
                          <AlertCircle className="h-3 w-3" />
                          Erro {testResult.status}
                        </Badge>
                      )}
                      <span className="text-slate-400">Tempo: <strong>{testResult.durationMs}ms</strong></span>
                      {testResult.count !== undefined && (
                        <span className="text-slate-400">Registros: <strong>{testResult.count}</strong></span>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 text-[11px] text-slate-400 hover:text-white px-2"
                      onClick={() => handleCopy(JSON.stringify(testResult.data, null, 2), "test-json")}
                    >
                      {copiedKey === "test-json" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      Copiar JSON
                    </Button>
                  </div>

                  {testResult.error ? (
                    <div className="text-rose-400 font-mono text-xs pt-1">
                      {testResult.error}
                    </div>
                  ) : (
                    <ScrollArea className="h-48 rounded bg-slate-900/90 p-2.5 font-mono text-[11px] text-emerald-300">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ABAS MULTILINGUAGEM E POWER BI */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b bg-slate-50/70">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Code className="h-4 w-4 text-indigo-600" />
                  4. Exemplos de Implementação & Power BI
                </CardTitle>
                <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
                  Pronto para uso
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Selecione a tecnologia desejada para copiar o código pronto com tratamento de resposta.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Tabs defaultValue="powerbi" className="w-full">
                <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-slate-100 mb-4">
                  <TabsTrigger value="powerbi" className="text-xs py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
                    Power BI
                  </TabsTrigger>
                  <TabsTrigger value="python" className="text-xs py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm flex items-center gap-1">
                    <span className="font-bold text-blue-500">Py</span>
                    Python
                  </TabsTrigger>
                  <TabsTrigger value="java" className="text-xs py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-sm flex items-center gap-1">
                    <span className="font-bold text-orange-500">☕</span>
                    Java
                  </TabsTrigger>
                  <TabsTrigger value="javascript" className="text-xs py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm flex items-center gap-1">
                    <span className="font-bold text-emerald-500">JS</span>
                    JavaScript
                  </TabsTrigger>
                  <TabsTrigger value="sql" className="text-xs py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-sm flex items-center gap-1">
                    <Database className="h-3.5 w-3.5 text-purple-500" />
                    SQL
                  </TabsTrigger>
                </TabsList>

                {/* ABA POWER BI */}
                <TabsContent value="powerbi" className="space-y-4 m-0">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs space-y-1 text-slate-700">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      Como conectar no Power BI Desktop em 3 passos:
                    </div>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-600 pt-1">
                      <li>No Power BI Desktop, clique em <strong>Obter Dados</strong> &gt; <strong>Consulta em Branco</strong>.</li>
                      <li>Na guia Página Inicial, clique em <strong>Editor Avançado</strong>.</li>
                      <li>Substitua todo o conteúdo pelo script M abaixo e clique em <strong>Concluído</strong>.</li>
                    </ol>
                  </div>

                  <Tabs defaultValue="powerquery-json" className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <TabsList className="h-7 p-0.5 bg-slate-200/80">
                        <TabsTrigger value="powerquery-json" className="text-[11px] h-6 px-2">
                          Script M (REST API JSON)
                        </TabsTrigger>
                        <TabsTrigger value="powerquery-csv" className="text-[11px] h-6 px-2">
                          Script M (CSV Stream Direto)
                        </TabsTrigger>
                      </TabsList>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleCopy(getPowerBiJsonSnippet(), "pbi-code")}
                      >
                        {copiedKey === "pbi-code" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        Copiar Script M
                      </Button>
                    </div>

                    <TabsContent value="powerquery-json" className="m-0">
                      <div className="relative rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                        <ScrollArea className="h-72 p-3 font-mono text-[11px] text-amber-300">
                          <pre className="whitespace-pre">{getPowerBiJsonSnippet()}</pre>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="powerquery-csv" className="m-0">
                      <div className="relative rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                        <ScrollArea className="h-72 p-3 font-mono text-[11px] text-amber-300">
                          <pre className="whitespace-pre">{getPowerBiCsvSnippet()}</pre>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                {/* ABA PYTHON */}
                <TabsContent value="python" className="space-y-3 m-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Utiliza <code>requests</code> e converte direto para <code>pandas.DataFrame</code>.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCopy(getPythonSnippet(), "python-code")}
                    >
                      {copiedKey === "python-code" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copiar Python
                    </Button>
                  </div>
                  <div className="relative rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                    <ScrollArea className="h-72 p-3 font-mono text-[11px] text-blue-300">
                      <pre className="whitespace-pre">{getPythonSnippet()}</pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* ABA JAVA */}
                <TabsContent value="java" className="space-y-3 m-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Utiliza <code>java.net.http.HttpClient</code> nativo (Java 11+) com follow de redirects 302.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCopy(getJavaSnippet(), "java-code")}
                    >
                      {copiedKey === "java-code" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copiar Java
                    </Button>
                  </div>
                  <div className="relative rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                    <ScrollArea className="h-72 p-3 font-mono text-[11px] text-orange-300">
                      <pre className="whitespace-pre">{getJavaSnippet()}</pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* ABA JAVASCRIPT */}
                <TabsContent value="javascript" className="space-y-3 m-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Compatível com Navegadores, Node.js 18+, Bun, Deno e Next.js.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCopy(getJsSnippet(), "js-code")}
                    >
                      {copiedKey === "js-code" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copiar JavaScript
                    </Button>
                  </div>
                  <div className="relative rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                    <ScrollArea className="h-72 p-3 font-mono text-[11px] text-emerald-300">
                      <pre className="whitespace-pre">{getJsSnippet()}</pre>
                    </ScrollArea>
                  </div>
                </TabsContent>

                {/* ABA SQL */}
                <TabsContent value="sql" className="space-y-3 m-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Comandos para PostgreSQL / Supabase, DuckDB e Google Sheets Query (GViz).
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCopy(getSqlSnippet(), "sql-code")}
                    >
                      {copiedKey === "sql-code" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copiar SQL
                    </Button>
                  </div>
                  <div className="relative rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
                    <ScrollArea className="h-72 p-3 font-mono text-[11px] text-purple-300">
                      <pre className="whitespace-pre">{getSqlSnippet()}</pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* GUIA DE BOAS PRÁTICAS E SEGURANÇA */}
      <Card className="border-slate-200 bg-slate-50/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
            <HelpCircle className="h-4 w-4 text-indigo-600" />
            Diretrizes de Consumo e Arquitetura
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Redirecionamento HTTP 302
              </div>
              <p className="text-[11px] text-slate-500">
                O Google Apps Script retorna respostas via redirecionamento 302 temporário. Em ferramentas de linha de comando ou clientes HTTP (como cURL), sempre inclua o parâmetro para seguir redirecionamentos (ex: <code>-L</code> no cURL, ou <code>followRedirects(ALWAYS)</code> em Java).
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-amber-600" />
                Atualização no Power BI Service
              </div>
              <p className="text-[11px] text-slate-500">
                Para configurar atualização agendada automática na nuvem (Power BI Service), defina o tipo de autenticação como <strong>Anônimo</strong> (Anonymous) nas configurações de credencial da fonte de dados da Web.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-slate-200">
              <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-indigo-600" />
                Redundância Híbrida
              </div>
              <p className="text-[11px] text-slate-500">
                Os dados persistidos na Planilha Google Oficial permanecem 100% sincronizados com a estrutura do sistema, garantindo redundância segura, rastreabilidade e custo zero de infraestrutura.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
