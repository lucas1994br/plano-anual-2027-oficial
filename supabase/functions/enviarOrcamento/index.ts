// deno-lint-ignore-file no-explicit-any

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessCode, diretoriaId, tipo, retidoDiretoria, repassesGerencias } = await req.json();

    if (!accessCode || !diretoriaId || !tipo) {
      return new Response(JSON.stringify({ error: "Parâmetros insuficientes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidUuid(diretoriaId)) {
        return new Response(JSON.stringify({ error: "diretoriaId inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente ausentes");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const accessHash = await hashCode(accessCode);

    const { data: accessRowsCode } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessCode)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: accessRowsHash } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessHash)
      .order("created_at", { ascending: false })
      .limit(1);

    const accessRows = (accessRowsCode && accessRowsCode.length > 0) ? accessRowsCode : accessRowsHash;
    const accessRow = accessRows?.[0];

    if (!accessRow || (accessRow.expira_em && new Date(accessRow.expira_em) < new Date())) {
      return new Response(JSON.stringify({ error: "Código admin inválido ou expirado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = [];
    
    rows.push({
      escopo: "diretoria",
      referencia_id: diretoriaId,
      tipo: tipo,
      valor: Number(retidoDiretoria || 0),
      updated_at: new Date().toISOString()
    });

    if (repassesGerencias && typeof repassesGerencias === "object") {
        for (const [gerenciaId, valor] of Object.entries(repassesGerencias)) {
            if (isValidUuid(gerenciaId)) {
                rows.push({
                    escopo: "gerencia",
                    referencia_id: gerenciaId,
                    tipo: tipo,
                    valor: Number(valor || 0),
                    updated_at: new Date().toISOString()
                });
            }
        }
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("admin_orcamento_config")
        .upsert(rows, { onConflict: "escopo,referencia_id,tipo" });

      if (upsertError) throw upsertError;
    }

    return new Response(JSON.stringify({ success: true, message: "Orçamento enviado com sucesso" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
