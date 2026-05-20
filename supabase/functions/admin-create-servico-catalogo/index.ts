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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { accessCode, servico } = body;

    console.log("Request body:", JSON.stringify({ 
      hasAccessCode: !!accessCode, 
      hasServico: !!servico,
      servicoKeys: servico ? Object.keys(servico) : []
    }));

    if (!accessCode || !servico) {
      return new Response(JSON.stringify({ 
        error: "Missing accessCode or servico",
        received: { hasAccessCode: !!accessCode, hasServico: !!servico }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables");
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const accessHash = await hashCode(accessCode);

    console.log("Validating access code...");

    // 1. Validar Admin - Busca por código hash (padrão)
    let { data: accessRow, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em, codigo_hash")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessHash)
      .maybeSingle();

    // Se não encontrou pelo hash, tenta pelo código original (fallback)
    if (!accessRow && !accessError) {
      console.log("Trying with original code...");
      const { data: rowByCode, error: errorByCode } = await supabase
        .from("codigos_acesso")
        .select("id, scope, ativo, expira_em, codigo_hash")
        .eq("scope", "admin")
        .eq("ativo", true)
        .eq("codigo_hash", accessCode)
        .maybeSingle();
      
      accessRow = rowByCode;
      accessError = errorByCode;
    }

    if (accessError) {
      console.error("Error validating access code:", accessError);
      return new Response(JSON.stringify({ error: `Erro ao validar código: ${accessError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accessRow) {
      console.error("Access code not found or invalid");
      return new Response(JSON.stringify({ error: "Acesso negado - código admin inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRow.expira_em && new Date(accessRow.expira_em) < new Date()) {
      console.error("Access code expired:", accessRow.expira_em);
      return new Response(JSON.stringify({ error: "Código de acesso expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Access validated successfully");

    // 2. Buscar próximo número de item
    const { data: ultimoServico, error: erroUltimo } = await supabase
      .from("servicos_catalogo")
      .select("item")
      .order("item", { ascending: false })
      .limit(1);

    if (erroUltimo) {
      console.error("Error fetching last item:", erroUltimo);
      return new Response(JSON.stringify({ error: `Erro ao buscar último item: ${erroUltimo.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const proximoItem = (ultimoServico?.[0]?.item || 3000) + 1;
    console.log("Next item number:", proximoItem);

    // 3. Inserir no Catálogo
    const servicoData = {
      item: proximoItem,
      tipo_contratacao: servico.tipo_contratacao || "Novo",
      objeto: servico.objeto,
      justificativa: servico.justificativa || null,
      grau_prioridade: servico.grau_prioridade || "Médio",
      estimativa_valor: Number(servico.estimativa_valor) || 0,
      vinculacao: servico.vinculacao || "Não",
      dependencia_descricao: servico.dependencia_descricao || null,
      diretoria_id: servico.diretoria_id,
      gerencia_id: servico.gerencia_id,
      ativo: true,
    };

    console.log("Inserting into servicos_catalogo:", JSON.stringify(servicoData));

    const { data: servicoCatalogo, error: insertError } = await supabase
      .from("servicos_catalogo")
      .insert(servicoData)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting servico:", insertError);
      return new Response(JSON.stringify({ 
        error: `Erro ao inserir serviço: ${insertError.message}`,
        details: insertError.details,
        hint: insertError.hint
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Servico inserted successfully:", servicoCatalogo.id);

    // 4. Distribuir para as gerências ativas
    const { data: periodoAtivo, error: erroPeriodo } = await supabase
      .from("periodos")
      .select("id")
      .eq("ativo", true)
      .maybeSingle();

    if (erroPeriodo) {
      console.error("Error fetching active period:", erroPeriodo);
      // Não falha a operação principal, apenas loga o erro
      console.warn("Could not distribute to gerencias due to period error");
    }

    let distribuidosCount = 0;
    if (periodoAtivo) {
      const { data: gerencias, error: erroGerencias } = await supabase
        .from("gerencias")
        .select("id, diretoria_id, sigla")
        .eq("ativa", true);

      if (erroGerencias) {
        console.error("Error fetching gerencias:", erroGerencias);
        console.warn("Could not distribute to gerencias");
      } else if (gerencias && gerencias.length > 0) {
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
        
        if (distError) {
          console.error("Error distributing servico:", distError);
          console.warn("Servico created but distribution failed");
        } else {
          distribuidosCount = gerencias.length;
          console.log(`Distributed to ${distribuidosCount} gerencias`);
        }
      }
    } else {
      console.warn("No active period found, skipping distribution");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      servico: servicoCatalogo,
      message: `Serviço criado com sucesso. Item ${proximoItem} - ${servicoCatalogo.objeto.substring(0, 50)}... ${distribuidosCount > 0 ? `Distribuído para ${distribuidosCount} gerências.` : "Aguardando período ativo para distribuição."}`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in admin-create-servico-catalogo:", errorMessage, error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});