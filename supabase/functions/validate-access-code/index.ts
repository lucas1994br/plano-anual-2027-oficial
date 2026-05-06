import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildScopeAliases(scope: string, sigla: string) {
  const normalizedSigla = String(sigla || "").trim().toLowerCase();

  if (!normalizedSigla) {
    return [] as string[];
  }

  if (scope === "diretoria") {
    return [
      `${normalizedSigla}1234`,
      `${normalizedSigla}123`,
      `1234${normalizedSigla}`,
    ];
  }

  if (scope === "gerencia") {
    return [
      `${normalizedSigla}123`,
      `${normalizedSigla}1234`,
      `1234${normalizedSigla}`,
    ];
  }

  return [] as string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, scope } = await req.json();

    if (!code || !scope) {
      return new Response(
        JSON.stringify({ error: "Missing code or scope" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash do codigo normalizado em minusculo para evitar diferencas de caixa.
    const normalizedCode = String(code).trim().toLowerCase();
    const encoded = new TextEncoder().encode(normalizedCode);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");

    // Query the access codes
    const { data: accessCodes, error: queryError } = await supabase
      .from("codigos_acesso")
      .select("*")
      .eq("ativo", true)
      .eq("scope", scope);

    if (queryError) throw queryError;

    let matchedCode = (accessCodes as any[])?.find(
      (ac: any) => ac.codigo_hash === hashHex
    );

    if (!matchedCode && (scope === "diretoria" || scope === "gerencia")) {
      const tableName = scope === "diretoria" ? "diretorias" : "gerencias";
      const idColumn = scope === "diretoria" ? "diretoria_id" : "gerencia_id";

      const { data: entities, error: entitiesError } = await supabase
        .from(tableName)
        .select("id, sigla, ativa")
        .eq("ativa", true);

      if (entitiesError) throw entitiesError;

      const matchedEntity = (entities as any[])?.find((entity: any) => {
        const aliases = buildScopeAliases(scope, entity.sigla);
        return aliases.includes(normalizedCode);
      });

      if (matchedEntity) {
        matchedCode = (accessCodes as any[])?.find(
          (ac: any) => ac[idColumn] === matchedEntity.id
        ) || {
          scope,
          diretoria_id: scope === "diretoria" ? matchedEntity.id : null,
          gerencia_id: scope === "gerencia" ? matchedEntity.id : null,
          expira_em: null,
        };
      }
    }

    if (!matchedCode) {
      return new Response(
        JSON.stringify({ error: "Invalid access code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration if set
    if (matchedCode.expira_em && new Date(matchedCode.expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Access code expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        access: {
          scope: matchedCode.scope,
          diretoria_id: matchedCode.diretoria_id,
          gerencia_id: matchedCode.gerencia_id,
          expired_at: matchedCode.expira_em,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error(errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
