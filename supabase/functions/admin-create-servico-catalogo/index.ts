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
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { accessCode, servico } = await req.json();

    if (!accessCode || !servico) {
      return new Response(JSON.stringify({ error: "Missing accessCode or servico" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const accessHash = await hashCode(accessCode);

    // 1. Validar Admin
    const { data: accessRow, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .or(`codigo_hash.eq.${accessCode},codigo_hash.eq.${accessHash}`)
      .maybeSingle();

    if (accessError || !accessRow) {
      return new Response(JSON.stringify({ error: "Acesso negado ou código inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRow.expira_em && new Date(accessRow.expira_em) < new Date()) {
      return new Response(JSON.stringify({ error: "Código expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Buscar próximo número de item
    const { data: ultimoServico } = await supabase
      .from("servicos_catalogo")
      .select("item")
      .order("item", { ascending: false })
      .limit(1);

    const proximoItem = (ultimoServico?.[0]?.item || 3000) + 1;

    // 3. Inserir no Catálogo
    const { data: servicoCatalogo, error: insertError } = await supabase
      .from("servicos_catalogo")
      .insert({
        item: proximoItem,
        tipo_contratacao: servico.tipo_contratacao || "Novo",
        objeto: servico.objeto,
        justificativa: servico.justificativa,
        grau_prioridade: servico.grau_prioridade || "Médio",
        estimativa_valor: Number(servico.estimativa_valor) || 0,
        vinculacao: servico.vinculacao || "Não",
        dependencia_descricao: servico.dependencia_descricao,
        ativo: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Distribuir para as gerências ativas
    const { data: periodoAtivo } = await supabase
      .from("periodos")
      .select("id")
      .eq("ativo", true)
      .maybeSingle();

    let distribuidosCount = 0;
    if (periodoAtivo) {
      const { data: gerencias } = await supabase
        .from("gerencias")
        .select("id, diretoria_id, sigla")
        .eq("ativa", true);

      if (gerencias && gerencias.length > 0) {
        const solicitacoes = gerencias.map((g) => ({
          periodo_id: periodoAtivo.id,
          diretoria_id: g.diretoria_id,
          gerencia_id: g.id,
          servico_catalogo_id: servicoCatalogo.id,
          item: servicoCatalogo.item,
          tipo_contratacao: servicoCatalogo.tipo_contratacao,
          unidade_demandante: g.sigla || "N/A",
          objeto: servicoCatalogo.objeto,
          justificativa: servicoCatalogo.justificativa,
          estimativa_valor: servicoCatalogo.estimativa_valor,
          grau_prioridade: servicoCatalogo.grau_prioridade,
          vinculacao: servicoCatalogo.vinculacao,
          status: "rascunho",
        }));

        const { error: distError } = await supabase
          .from("servicos_solicitados")
          .insert(solicitacoes);
        
        if (!distError) distribuidosCount = gerencias.length;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      servico: servicoCatalogo,
      message: `Criado e distribuído para ${distribuidosCount} gerências.` 
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: corsHeaders });
  }
});