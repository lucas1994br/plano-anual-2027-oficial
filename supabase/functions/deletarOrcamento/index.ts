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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessCode, diretoriaId, tipo, gerenciasIds } = await req.json();

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

    // Delete do valor da diretoria
    await supabase
      .from("admin_orcamento_config")
      .delete()
      .eq("escopo", "diretoria")
      .eq("referencia_id", diretoriaId)
      .eq("tipo", tipo);

    // Delete das gerencias associadas
    if (gerenciasIds && Array.isArray(gerenciasIds)) {
        const validGerenciasIds = gerenciasIds.filter(isValidUuid);
        if (validGerenciasIds.length > 0) {
            await supabase
              .from("admin_orcamento_config")
              .delete()
              .eq("escopo", "gerencia")
              .eq("tipo", tipo)
              .in("referencia_id", validGerenciasIds);
        }
    }

    return new Response(JSON.stringify({ success: true, message: "Orçamento deletado com sucesso" }), {
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
