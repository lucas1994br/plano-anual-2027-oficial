 
//* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashCode(code: string) {
  const encoded = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

function toBudgetRows(
  escopo: "diretoria" | "gerencia",
  tipo: "aquisicao" | "servicos",
  values: Record<string, number>,
) {
  return Object.entries(values || {}).map(([referenciaId, valor]) => ({
    escopo,
    referencia_id: referenciaId,
    tipo,
    valor: Number(valor || 0),
    updated_at: new Date().toISOString(),
  }));
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessCode, config } = await req.json();

    if (!accessCode || !config) {
      return new Response(JSON.stringify({ error: "Missing accessCode or config" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables");
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const accessHash = await hashCode(accessCode);

    // Validar Admin - Busca por código direto OU código hash
    const { data: accessRowsCode, error: errorCode } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessCode)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: accessRowsHash, error: errorHash } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessHash)
      .order("created_at", { ascending: false })
      .limit(1);

    const accessRows = (accessRowsCode && accessRowsCode.length > 0) ? accessRowsCode : accessRowsHash;
    const accessError = errorCode || errorHash;

    if (accessError) {
      console.error("Error validating access code:", accessError);
      throw accessError;
    }

    const accessRow = accessRows?.[0] ?? null;

    if (!accessRow) {
      return new Response(JSON.stringify({ error: "Código admin inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRow.expira_em && new Date(accessRow.expira_em) < new Date()) {
      return new Response(JSON.stringify({ error: "Código admin expirado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: diretorias } = await supabase.from("diretorias").select("id");
    const { data: gerencias } = await supabase.from("gerencias").select("id");
    const validDiretoriaIds = new Set((diretorias || []).map((d: any) => d.id));
    const validGerenciaIds = new Set((gerencias || []).map((g: any) => g.id));

    const rawBudgetRows = [
      ...toBudgetRows("diretoria", "aquisicao", config.diretoriaBudgetsAquisicao || {}),
      ...toBudgetRows("diretoria", "servicos", config.diretoriaBudgetsServicos || {}),
      ...toBudgetRows("gerencia", "aquisicao", config.gerenciaBudgetsAquisicao || {}),
      ...toBudgetRows("gerencia", "servicos", config.gerenciaBudgetsServicos || {}),
    ];

    const budgetRows = rawBudgetRows.filter((row) => {
      if (!isValidUuid(row.referencia_id)) return false;
      if (row.escopo === "diretoria") return validDiretoriaIds.has(row.referencia_id);
      return validGerenciaIds.has(row.referencia_id);
    });

    if (budgetRows.length > 0) {
      const { error: budgetError } = await supabase
        .from("admin_orcamento_config")
        .upsert(budgetRows, { onConflict: "escopo,referencia_id,tipo" });

      if (budgetError) throw budgetError;
    }

    const routingEntries = Object.entries(config.routingRules || {});
    if (routingEntries.length > 0) {
      const routingRows = routingEntries
        .filter(([gerenciaId, rule]: [string, any]) => {
          if (!isValidUuid(gerenciaId) || !validGerenciaIds.has(gerenciaId)) return false;
          if (!rule || (rule.destinoTipo !== "diretoria" && rule.destinoTipo !== "compras" && rule.destinoTipo !== "admin")) {
            return false;
          }
          if (rule.destinoTipo === "diretoria") {
            return isValidUuid(rule.destinoId) && validDiretoriaIds.has(rule.destinoId);
          }
          return typeof rule.destinoId === "string" && rule.destinoId.length > 0;
        })
        .map(([gerenciaId, rule]: [string, any]) => ({
          gerencia_id: gerenciaId,
          destino_tipo: rule.destinoTipo,
          destino_id: rule.destinoId,
          updated_at: new Date().toISOString(),
        }));

      if (routingRows.length > 0) {
        const { error: routingError } = await supabase
          .from("admin_fluxo_config")
          .upsert(routingRows, { onConflict: "gerencia_id" });

        if (routingError) throw routingError;
      }
    }

    return new Response(JSON.stringify({ success: true, budgetRows: budgetRows.length, routingRows: routingEntries.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : (typeof error === "object" && error !== null && "message" in error)
        ? String((error as { message?: unknown }).message ?? "Internal server error")
        : "Internal server error";
    console.error(message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
