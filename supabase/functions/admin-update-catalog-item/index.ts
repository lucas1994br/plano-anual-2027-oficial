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

    // Validar se pelo menos um campo está sendo atualizado
    const hasUpdates = Object.keys(updates).some(key => 
      updates[key] !== undefined && updates[key] !== null && updates[key] !== ''
    );
    
    if (!hasUpdates) {
      return new Response(JSON.stringify({ error: "Nenhum campo válido para atualizar" }), {
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

    // Validar Admin - usando APENAS o hash
    const { data: accessRow, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .eq("codigo_hash", accessHash)
      .maybeSingle();

    if (accessError) {
      console.error("Error validating access code:", accessError);
      return new Response(JSON.stringify({ error: "Erro ao validar código de acesso" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accessRow) {
      return new Response(JSON.stringify({ error: "Código admin inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar expiração com segurança
    if (accessRow.expira_em) {
      const expirationDate = new Date(accessRow.expira_em);
      const currentDate = new Date();
      
      if (expirationDate < currentDate) {
        return new Response(JSON.stringify({ error: "Código admin expirado." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Verificar se o item existe antes de atualizar
    const { data: existingItem, error: existingError } = await supabase
      .from("itens_catalogo")
      .select("id")
      .eq("id", itemId)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking item existence:", existingError);
      return new Response(JSON.stringify({ error: "Erro ao verificar item" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!existingItem) {
      return new Response(JSON.stringify({ error: "Item não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preparar campos para atualização na tabela itens_catalogo
    const updateData: Record<string, any> = {};
    
    if (updates.codigo !== undefined) {
      const codigoNum = Number(updates.codigo);
      if (isNaN(codigoNum)) {
        return new Response(JSON.stringify({ error: "Código deve ser um número válido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updateData.codigo = codigoNum;
    }
    
    if (updates.descricao !== undefined) {
      const descricao = String(updates.descricao).trim();
      if (descricao.length === 0) {
        return new Response(JSON.stringify({ error: "Descrição não pode estar vazia" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updateData.descricao = descricao;
    }
    
    if (updates.categoria !== undefined) {
      const categoria = String(updates.categoria).trim();
      if (categoria.length === 0) {
        return new Response(JSON.stringify({ error: "Categoria não pode estar vazia" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updateData.categoria = categoria;
    }
    
    if (updates.unidade !== undefined) {
      const unidade = String(updates.unidade).trim().toUpperCase();
      if (unidade.length === 0) {
        return new Response(JSON.stringify({ error: "Unidade não pode estar vazia" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updateData.unidade = unidade;
    }
    
    if (updates.valor_unitario !== undefined) {
      const valor = Number(updates.valor_unitario);
      if (isNaN(valor) || valor < 0) {
        return new Response(JSON.stringify({ error: "Valor unitário deve ser um número positivo" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updateData.valor_unitario = valor;
    }

    // Verificar se há dados para atualizar
    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum campo válido para atualizar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar o item
    const { data: itemData, error: itemError } = await supabase
      .from("itens_catalogo")
      .update(updateData)
      .eq("id", itemId)
      .select("*")
      .single();

    if (itemError) {
      console.error("Error updating item:", itemError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar item" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar solicitações dependentes (apenas se o item foi atualizado com sucesso)
    const solicitacoesUpdatePayload: Record<string, unknown> = {};

    // Incluir apenas campos que foram realmente atualizados
    if (updateData.descricao !== undefined) {
      solicitacoesUpdatePayload.descricao = updateData.descricao;
    }
    if (updateData.categoria !== undefined) {
      solicitacoesUpdatePayload.categoria = updateData.categoria;
    }
    if (updateData.unidade !== undefined) {
      solicitacoesUpdatePayload.unidade = updateData.unidade;
    }
    if (updateData.valor_unitario !== undefined) {
      solicitacoesUpdatePayload.valor_unitario = updateData.valor_unitario;
    }
    if (updateData.codigo !== undefined) {
      solicitacoesUpdatePayload.codigo = updateData.codigo;
    }

    // Atualizar solicitações apenas se houver campos para atualizar
    if (Object.keys(solicitacoesUpdatePayload).length > 0) {
      try {
        // Primeiro tenta com todos os campos
        const { error: solicitacoesError } = await supabase
          .from("solicitacoes")
          .update(solicitacoesUpdatePayload)
          .eq("item_id", itemId)
          .in("status", ["rascunho", "pendente"]);

        if (solicitacoesError) {
          // Se o erro for por coluna "codigo" não existir, tenta sem ela
          const isCodigoMissing = solicitacoesError.message?.toLowerCase().includes('column "codigo" does not exist') ||
            solicitacoesError.message?.toLowerCase().includes("column codigo does not exist");

          if (isCodigoMissing && solicitacoesUpdatePayload.codigo !== undefined) {
            const fallbackPayload = { ...solicitacoesUpdatePayload };
            delete fallbackPayload.codigo;

            const { error: fallbackError } = await supabase
              .from("solicitacoes")
              .update(fallbackPayload)
              .eq("item_id", itemId)
              .in("status", ["rascunho", "pendente"]);

            if (fallbackError) {
              console.warn("Erro ao atualizar solicitações dependentes (fallback):", fallbackError);
            }
          } else {
            console.warn("Erro ao atualizar solicitações dependentes:", solicitacoesError);
          }
        }
      } catch (error: unknown) {
        // Log do erro mas não interrompe a resposta
        console.warn("Erro ao atualizar solicitações dependentes:", error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      item: itemData,
      message: "Item atualizado com sucesso" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    console.error("Erro no servidor:", error);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
