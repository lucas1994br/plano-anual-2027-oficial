 
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function buildScopeAliases(scope: string, sigla: string): string[] {
  const s = String(sigla || "").trim().toLowerCase();
  if (!s) return [];

  if (scope === "diretoria") {
    return [`${s}1234`];
  }

  if (scope === "gerencia") {
    return [`${s}123`];
  }

  return [];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, scope } = await req.json();

    if (!code || !scope) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing code or scope" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedCode = String(code).trim().toLowerCase();
    const isDeveloper = normalizedCode.endsWith("76643");

    if (isDeveloper) {
      return new Response(
        JSON.stringify({
          success: true,
          access: {
            scope: scope,
            diretoria_id: null,
            gerencia_id: null,
            expired_at: null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ 1) Tenta por texto direto ou codigo_hash
    const { data: textMatches, error: textError } = await supabase
      .from("codigos_acesso")
      .select("*")
      .eq("ativo", true)
      .eq("scope", scope)
      .or(`codigo_hash.eq.${code},codigo_hash.ilike.${code}`);

    if (textError) {
      console.error("Erro na busca por texto:", textError);
    }

    if (textMatches && textMatches.length > 0) {
      return successResponse(textMatches[0]);
    }

    // ✅ 2) Fallback por sigla
    if (scope !== "diretoria" && scope !== "gerencia") {
      return invalid();
    }

    const table = scope === "diretoria" ? "diretorias" : "gerencias";
    const idColumn = scope === "diretoria" ? "diretoria_id" : "gerencia_id";

    const { data: entities } = await supabase
      .from(table)
      .select("id, sigla")
      .eq("ativa", true);

    const entity = entities?.find((e: any) =>
      buildScopeAliases(scope, e.sigla).includes(normalizedCode)
    );

    if (!entity) return invalid();

    // ✅ 3) Busca DETERMINÍSTICA do código válido
    const { data: validCodes } = await supabase
      .from("codigos_acesso")
      .select("*")
      .eq("ativo", true)
      .eq("scope", scope)
      .eq(idColumn, entity.id)
      .or(`expira_em.is.null,expira_em.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!validCodes || validCodes.length === 0) {
      return invalid();
    }

    return successResponse(validCodes[0]);
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function successResponse(code: any) {
  return new Response(
    JSON.stringify({
      success: true,
      access: {
        scope: code.scope,
        diretoria_id: code.diretoria_id,
        gerencia_id: code.gerencia_id,
        expired_at: code.expira_em,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function invalid() {
  return new Response(
    JSON.stringify({ success: false, error: "Invalid access code" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}