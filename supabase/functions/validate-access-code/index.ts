/* eslint-disable @typescript-eslint/no-explicit-any */
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
        JSON.stringify({ error: "Missing code or scope" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedCode = String(code).trim().toLowerCase();

    // 🔐 HASH
    const encoded = new TextEncoder().encode(normalizedCode);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // ✅ 1) Tenta por hash direto
    const { data: hashedMatches } = await supabase
      .from("codigos_acesso")
      .select("*")
      .eq("ativo", true)
      .eq("scope", scope)
      .eq("codigo_hash", hashHex);

    if (hashedMatches && hashedMatches.length > 0) {
      return successResponse(hashedMatches[0]);
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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
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
    { status: 200, headers: corsHeaders }
  );
}

function invalid() {
  return new Response(
    JSON.stringify({ error: "Invalid access code" }),
    { status: 401, headers: corsHeaders }
  );
}