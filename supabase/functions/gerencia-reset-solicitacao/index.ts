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
    const { accessCode, solicitacaoId, acao, dados } = await req.json();

    if (!accessCode) {
      return new Response(JSON.stringify({ error: "Missing accessCode" }), {
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

    // Validar código de acesso (gerência ou admin)
    const { data: accessRow, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em, gerencia_id")
      .eq("ativo", true)
      .or(`codigo_hash.eq.${accessCode},codigo_hash.eq.${accessHash}`)
      .maybeSingle();

    if (accessError) throw accessError;

    if (!accessRow) {
      return new Response(JSON.stringify({ error: "Código de acesso inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRow.expira_em && new Date(accessRow.expira_em) < new Date()) {
      return new Response(JSON.stringify({ error: "Código de acesso expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isGerencia = accessRow.scope === "gerencia";
    const gerenciaId = isGerencia ? accessRow.gerencia_id : null;

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

    // Ação: reativar solicitação devolvida
    if (acao === "reativar" && solicitacaoId) {
      // Buscar solicitação
      const { data: solicitacao, error: fetchError } = await supabase
        .from("solicitacoes")
        .select("*")
        .eq("id", solicitacaoId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!solicitacao) {
        return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se a gerência tem permissão (se for acesso de gerência)
      if (isGerencia && solicitacao.gerencia_id !== gerenciaId) {
        return new Response(JSON.stringify({ error: "Sem permissão para esta solicitação" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se está em rascunho (devolvida)
      if (solicitacao.status !== "rascunho") {
        return new Response(JSON.stringify({ 
          error: `Solicitação está com status "${solicitacao.status}". Apenas solicitações devolvidas (rascunho) podem ser reativadas.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atualizar para permitir edição (manter como rascunho, mas limpar observações antigas se desejar)
      const { error: updateError } = await supabase
        .from("solicitacoes")
        .update({
          observacoes: null, // Limpa observação de devolução
          updated_at: new Date().toISOString(),
        })
        .eq("id", solicitacaoId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        message: "Solicitação reativada para edição",
        solicitacao: { ...solicitacao, observacoes: null }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação: atualizar solicitação devolvida
    if (acao === "atualizar" && solicitacaoId && dados) {
      // Buscar solicitação atual
      const { data: solicitacao, error: fetchError } = await supabase
        .from("solicitacoes")
        .select("*")
        .eq("id", solicitacaoId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!solicitacao) {
        return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar permissão
      if (isGerencia && solicitacao.gerencia_id !== gerenciaId) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se pode editar (apenas rascunho para usuários normais)
      if (!isGerencia && solicitacao.status !== "rascunho") {
        return new Response(JSON.stringify({ 
          error: `Não é possível editar solicitação com status "${solicitacao.status}". Aguarde o administrador devolver para edição.` 
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Permitir edição dos campos
      const allowedFields = ["qtd_estimada", "valor_unitario", "prioridade", "observacoes", "descricao", "justificativa"];
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      
      for (const field of allowedFields) {
        if (dados[field] !== undefined) {
          updates[field] = dados[field];
        }
      }

      const { error: updateError } = await supabase
        .from("solicitacoes")
        .update(updates)
        .eq("id", solicitacaoId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        message: "Solicitação atualizada com sucesso"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação: criar nova solicitação (se não existir ou se a anterior foi removida)
    if (acao === "criar" && dados) {
      // Verificar se já existe solicitação para este item/período/gerência
      const { data: existing, error: existingError } = await supabase
        .from("solicitacoes")
        .select("id, status")
        .eq("periodo_id", periodoAtivo.id)
        .eq("gerencia_id", gerenciaId)
        .eq("item_id", dados.item_id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing && existing.status !== "cancelado" && existing.status !== "rascunho") {
        return new Response(JSON.stringify({ 
          error: "Já existe uma solicitação para este item neste período. Edite a existente ou solicite que o administrador devolva para edição." 
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Se existe em rascunho, atualizar ao invés de criar
      if (existing && existing.status === "rascunho") {
        const { error: updateError } = await supabase
          .from("solicitacoes")
          .update({
            qtd_estimada: dados.qtd_estimada,
            valor_unitario: dados.valor_unitario,
            prioridade: dados.prioridade || "Baixa",
            justificativa: dados.justificativa,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({
          success: true,
          message: "Solicitação existente atualizada"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Criar nova
      const { data: nova, error: createError } = await supabase
        .from("solicitacoes")
        .insert({
          periodo_id: periodoAtivo.id,
          gerencia_id: gerenciaId,
          item_id: dados.item_id,
          qtd_estimada: dados.qtd_estimada,
          valor_unitario: dados.valor_unitario,
          prioridade: dados.prioridade || "Baixa",
          justificativa: dados.justificativa,
          status: "rascunho",
        })
        .select()
        .single();

      if (createError) throw createError;

      return new Response(JSON.stringify({
        success: true,
        message: "Solicitação criada com sucesso",
        solicitacao: nova
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
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