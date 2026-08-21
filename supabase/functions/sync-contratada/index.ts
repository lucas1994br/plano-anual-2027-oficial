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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing environment variables" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: catalogo, error: catError } = await supabase
      .from("servicos_catalogo")
      .select("item, contrato, contratada")
      .not("item", "is", null);

    if (catError) throw catError;

    let updatedCount = 0;
    for (const cat of catalogo || []) {
      if (cat.item && (cat.contrato || cat.contratada)) {
        const { error: updError } = await supabase
          .from("servicos")
          .update({
            contrato: cat.contrato || null,
            contratada: cat.contratada || null,
          })
          .eq("item", cat.item);

        if (!updError) updatedCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Sincronizados ${updatedCount} serviços.` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
