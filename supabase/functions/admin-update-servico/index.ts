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
    const { accessCode, servicoId, updates } = await req.json();

    if (!accessCode || !servicoId || !updates) {
      return new Response(JSON.stringify({ error: "Missing accessCode, servicoId or updates" }), {
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

    // Verificar se o serviço existe
    const { data: servico, error: fetchError } = await supabase
      .from("servicos")
      .select("id, status")
      .eq("id", servicoId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!servico) {
      return new Response(JSON.stringify({ error: "Serviço não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lista de campos permitidos para edição por admin (todos)
    const allowedFields = [
      "item",
      "tipo_contratacao",
      "unidade_demandante",
      "objeto",
      "justificativa",
      "previsao_inicio",
      "estimativa_valor",
      "dotacao_orcamentaria",
      "grau_prioridade",
      "vinculacao",
      "dependencia_descricao",
      "status",
      "observacao",
    ];

    const filteredUpdates: Record<string, unknown> = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        if (key === "previsao_inicio" && updates[key]) {
          filteredUpdates[key] = new Date(updates[key]).toISOString().split('T')[0];
        } else if (key === "estimativa_valor" || key === "dotacao_orcamentaria") {
          filteredUpdates[key] = Number(updates[key]);
        } else if (key === "item") {
          filteredUpdates[key] = Number(updates[key]);
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    // Adicionar timestamp de atualização
    filteredUpdates.updated_at = new Date().toISOString();

    if (Object.keys(filteredUpdates).length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Realizar o update
    const { data: updatedServico, error: updateError } = await supabase
      .from("servicos")
      .update(filteredUpdates)
      .eq("id", servicoId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Serviço atualizado com sucesso",
      servico: updatedServico,
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