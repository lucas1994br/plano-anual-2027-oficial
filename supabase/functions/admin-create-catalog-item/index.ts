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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessCode, item } = await req.json();

    if (!accessCode || !item) {
      return new Response(JSON.stringify({ error: "Missing accessCode or item" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const accessHash = await hashCode(accessCode);

    const { data: accessRow, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .or(`codigo_hash.eq.${accessCode},codigo_hash.eq.${accessHash}`)
      .maybeSingle();

    if (accessError) {
      throw accessError;
    }

    if (!accessRow) {
      return new Response(JSON.stringify({ error: "Codigo admin invalido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRow.expira_em && new Date(accessRow.expira_em) < new Date()) {
      return new Response(JSON.stringify({ error: "Codigo admin expirado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: itemCatalogo, error: itemError } = await supabase
      .from("itens_catalogo")
      .insert([
        {
          codigo: Number(item.codigo),
          descricao: String(item.descricao).trim(),
          categoria: String(item.categoria).trim(),
          unidade: String(item.unidade).trim().toUpperCase(),
          valor_unitario: Number(item.valorUnitario),
        },
      ])
      .select("*")
      .single();

    if (itemError) {
      throw itemError;
    }

    const { data: periodoAtivo, error: periodoError } = await supabase
      .from("periodos")
      .select("id")
      .eq("ativo", true)
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodoError) {
      throw periodoError;
    }

    if (periodoAtivo) {
      const { data: gerencias, error: gerenciasError } = await supabase
        .from("gerencias")
        .select("id, diretoria_id")
        .eq("ativa", true);

      if (gerenciasError) {
        throw gerenciasError;
      }

      if (gerencias && gerencias.length > 0) {
        const solicitacoes = gerencias.map((gerencia: { id: string; diretoria_id: string }) => ({
          periodo_id: periodoAtivo.id,
          diretoria_id: gerencia.diretoria_id,
          gerencia_id: gerencia.id,
          item_id: itemCatalogo.id,
          codigo: itemCatalogo.codigo,
          descricao: itemCatalogo.descricao,
          categoria: itemCatalogo.categoria,
          unidade: itemCatalogo.unidade,
          qtd_estimada: 0,
          valor_unitario: itemCatalogo.valor_unitario,
          prioridade: "Baixa",
          status: "rascunho",
        }));

        const { error: solicitacoesError } = await supabase
          .from("solicitacoes")
          .insert(solicitacoes);

        if (solicitacoesError) {
          throw solicitacoesError;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, item: itemCatalogo }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error(message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
