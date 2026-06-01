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
    const { accessCode, itemId, updates } = await req.json();

    if (!accessCode || !itemId || !updates) {
      return new Response(JSON.stringify({ error: "Missing accessCode, itemId or updates" }), {
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

    // Validar Admin
    const { data: accessRowByCode, error: errorByCode } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessCode)
      .maybeSingle();

    const { data: accessRowByHash, error: errorByHash } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessHash)
      .maybeSingle();

    const accessRow = accessRowByCode || accessRowByHash;
    const accessError = errorByCode || errorByHash;

    if (accessError) {
      console.error("Error validating access code:", accessError);
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

    // Preparar campos para atualização na tabela itens_catalogo
    const updateData: any = {};
    if (updates.codigo !== undefined) updateData.codigo = Number(updates.codigo);
    if (updates.descricao !== undefined) updateData.descricao = String(updates.descricao).trim();
    if (updates.categoria !== undefined) updateData.categoria = String(updates.categoria).trim();
    if (updates.unidade !== undefined) updateData.unidade = String(updates.unidade).trim().toUpperCase();
    if (updates.valor_unitario !== undefined) updateData.valor_unitario = Number(updates.valor_unitario);

    const { data: itemData, error: itemError } = await supabase
      .from("itens_catalogo")
      .update(updateData)
      .eq("id", itemId)
      .select("*")
      .single();

    if (itemError) {
      throw itemError;
    }

    // Tentar atualizar as descrições e valores unitários das solicitações dependentes deste item 
    // apenas em solicitações com status 'rascunho' ou 'pendente'.
    // Valores unitários de solicitações podem ser atualizados junto, dependendo da regra de negócio.
    const { error: solicitacoesError } = await supabase
      .from("solicitacoes")
      .update({
        codigo: updateData.codigo,
        descricao: updateData.descricao,
        categoria: updateData.categoria,
        unidade: updateData.unidade,
        valor_unitario: updateData.valor_unitario
      })
      .eq("item_id", itemId)
      .in("status", ["rascunho", "pendente"]);

    if (solicitacoesError) {
      console.warn("Erro ao atualizar solicitacoes dependentes:", solicitacoesError);
      // Não quebra a requisição se falhar em solicitações
    }

    return new Response(JSON.stringify({ success: true, item: itemData }), {
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
