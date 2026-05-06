import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { ano, diretoriaId, orcamentos, role } = body;

    if (
      typeof ano !== "number" ||
      !diretoriaId ||
      !Array.isArray(orcamentos) ||
      !role ||
      !["admin", "gerencia"].includes(role)
    ) {
      return new Response(
        JSON.stringify({ error: "Parâmetros inválidos ou permissão insuficiente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // perform updates using service role (bypass RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const resultados: any[] = [];

    for (const orc of orcamentos) {
      if (!orc.centro_custo_id || typeof orc.valor_aprovado !== "number") {
        continue;
      }
      const { data, error } = await serviceClient
        .from("orcamento_anual")
        .upsert(
          {
            ano,
            centro_custo_id: orc.centro_custo_id,
            valor_aprovado: orc.valor_aprovado,
            valor_reservado: 0,
            valor_executado: 0,
          },
          {
            onConflict: "ano,centro_custo_id",
          }
        )
        .select()
        .single();

      if (error) throw error;
      if (data) resultados.push(data);
    }

    return new Response(
      JSON.stringify({ success: true, resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error(msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});