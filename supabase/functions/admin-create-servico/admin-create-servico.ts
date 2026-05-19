//* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file

// supabase/functions/admin-create-servico-catalogo/index.ts
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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessCode, servico } = await req.json();

    console.log("Recebendo requisição:", { hasAccessCode: !!accessCode, hasServico: !!servico });

    if (!accessCode || !servico) {
      return new Response(
        JSON.stringify({ error: "Missing accessCode or servico" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing env variables");
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const accessHash = await hashCode(accessCode);

    console.log("Validando código admin...");

    // ✅ CORRIGIDO: Usar a mesma lógica do admin-create-catalog-item
    const { data: accessRow, error: accessError } = await supabase
      .from("codigos_acesso")
      .select("id, scope, ativo, expira_em")
      .eq("scope", "admin")
      .eq("ativo", true)
      .or(`codigo_hash.eq.${accessCode},codigo_hash.eq.${accessHash}`)  // ← AGORA ACEITA AMBOS
      .maybeSingle();

    if (accessError) {
      console.error("Access error:", accessError);
      throw accessError;
    }

    if (!accessRow) {
      console.log("Código admin inválido:", accessCode);
      return new Response(
        JSON.stringify({ error: "Código admin inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (accessRow.expira_em && new Date(accessRow.expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Código admin expirado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Código admin validado com sucesso");

    // Buscar próximo número de item disponível (como no admin-create-catalog-item)
    const { data: ultimoServico, error: ultimoError } = await supabase
      .from("servicos_catalogo")
      .select("item")
      .order("item", { ascending: false })
      .limit(1);

    if (ultimoError) {
      console.error("Erro ao buscar último serviço:", ultimoError);
      // Se não encontrar nenhum, começa do 2000
    }

    const proximoItem = (ultimoServico?.[0]?.item || 2000) + 1;
    console.log("Próximo item:", proximoItem);

    // INSERIR NO CATÁLOGO
    const { data: servicoCatalogo, error: insertError } = await supabase
      .from("servicos_catalogo")
      .insert({
        item: proximoItem,
        tipo_contratacao: String(servico.tipo_contratacao || "Novo").trim(),
        objeto: String(servico.objeto).trim(),
        justificativa: servico.justificativa ? String(servico.justificativa).trim() : null,
        grau_prioridade: String(servico.grau_prioridade || "Médio"),
        estimativa_valor: Number(servico.estimativa_valor) || 0,
        vinculacao: servico.vinculacao === "Sim" ? "Sim" : "Não",
        dependencia_descricao: servico.dependencia_descricao ? String(servico.dependencia_descricao).trim() : null,
        diretoria_id: servico.diretoria_id,
        gerencia_id: servico.gerencia_id,
        ativo: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao inserir no catálogo:", insertError);
      return new Response(
        JSON.stringify({ error: `Erro ao inserir: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Serviço criado no catálogo:", servicoCatalogo.id);

    // Buscar período ativo
    const { data: periodoAtivo, error: periodoError } = await supabase
      .from("periodos")
      .select("id")
      .eq("ativo", true)
      .order("fim", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodoError) {
      console.error("Erro ao buscar período:", periodoError);
    }

    // DISTRIBUIR para todas as gerências ativas (como no admin-create-catalog-item)
    let distribuidos = 0;
    if (periodoAtivo) {
      console.log("Distribuindo para gerências...");
      
      const { data: gerencias, error: gerenciasError } = await supabase
        .from("gerencias")
        .select("id, diretoria_id")
        .eq("ativa", true);

      if (gerenciasError) {
        console.error("Erro ao buscar gerências:", gerenciasError);
      } else if (gerencias && gerencias.length > 0) {
        // ✅ CORRIGIDO: Mapeamento correto dos campos para servicos_solicitados
        const solicitacoes = gerencias.map((gerencia: { id: string; diretoria_id: string }) => ({
          periodo_id: periodoAtivo.id,
          diretoria_id: gerencia.diretoria_id,
          gerencia_id: gerencia.id,
          servico_catalogo_id: servicoCatalogo.id,
          item: servicoCatalogo.item,
          tipo_contratacao: servicoCatalogo.tipo_contratacao,
          objeto: servicoCatalogo.objeto,
          justificativa: servicoCatalogo.justificativa,
          estimativa_valor: servicoCatalogo.estimativa_valor,
          grau_prioridade: servicoCatalogo.grau_prioridade,
          vinculacao: servicoCatalogo.vinculacao,
          dependencia_descricao: servicoCatalogo.dependencia_descricao,
          status: "rascunho",
        }));

        const { error: solicitacoesError } = await supabase
          .from("servicos_solicitados")
          .insert(solicitacoes);

        if (solicitacoesError) {
          console.error("Erro ao distribuir:", solicitacoesError);
          // ✅ CORRIGIDO: Não retorna erro, apenas loga (como no admin-create-catalog-item)
        } else {
          distribuidos = solicitacoes.length;
          console.log(`Distribuído para ${distribuidos} gerências`);
        }
      }
    }

    // ✅ CORRIGIDO: Retorno similar ao admin-create-catalog-item
    return new Response(
      JSON.stringify({ 
        success: true, 
        servico: servicoCatalogo,
        distribuido_para: distribuidos 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Erro não tratado:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});