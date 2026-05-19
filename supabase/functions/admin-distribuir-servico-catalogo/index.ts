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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessCode, servicoCatalogoId } = await req.json();

    if (!accessCode || !servicoCatalogoId) {
      return new Response(JSON.stringify({ error: "Missing accessCode or servicoCatalogoId" }), {
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

    if (accessError) throw accessError;

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

    // Buscar o serviço do catálogo
    const { data: servicoCatalogo, error: fetchError } = await supabase
      .from("servicos_catalogo")
      .select("*")
      .eq("id", servicoCatalogoId)
      .single();

    if (fetchError) throw fetchError;

    if (!servicoCatalogo) {
      return new Response(JSON.stringify({ error: "Serviço não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar período ativo
    const { data: periodoAtivo, error: periodoError } = await supabase
      .from("periodos")
      .select("id")
      .eq("ativo", true)
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodoError) throw periodoError;

    if (!periodoAtivo) {
      return new Response(JSON.stringify({ error: "Nenhum período ativo encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar todas as gerências ativas
    const { data: gerencias, error: gerenciasError } = await supabase
      .from("gerencias")
      .select("id, diretoria_id")
      .eq("ativa", true);

    if (gerenciasError) throw gerenciasError;

    let distribuidos = 0;

    if (gerencias && gerencias.length > 0) {
      // Criar solicitações para cada gerência
      const solicitacoes = gerencias.map((gerencia: { id: string; diretoria_id: string }) => ({
        periodo_id: periodoAtivo.id,
        diretoria_id: gerencia.diretoria_id,
        gerencia_id: gerencia.id,
        servico_catalogo_id: servicoCatalogo.id,
        item: servicoCatalogo.item,
        tipo_contratacao: servicoCatalogo.tipo_contratacao,
        unidade_demandante: "",
        objeto: servicoCatalogo.objeto,
        justificativa: servicoCatalogo.justificativa,
        previsao_inicio: null,
        estimativa_valor: servicoCatalogo.estimativa_valor,
        dotacao_orcamentaria: 0,
        grau_prioridade: servicoCatalogo.grau_prioridade,
        vinculacao: servicoCatalogo.vinculacao,
        dependencia_descricao: servicoCatalogo.dependencia_descricao,
        status: "rascunho",
      }));

      const { error: solicitacoesError } = await supabase
        .from("servicos_solicitados")
        .insert(solicitacoes);

      if (solicitacoesError) throw solicitacoesError;
      
      distribuidos = solicitacoes.length;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Serviço distribuído para ${distribuidos} gerências`,
      distribuidos,
    }), {
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