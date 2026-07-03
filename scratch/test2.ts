import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function test() {
  const { data } = await supabase.from("itens_catalogo").select("codigo").eq("codigo", 2171).limit(1);
  console.log("Cat 2171:", data);
  const { data: d2 } = await supabase.from("itens_catalogo").select("codigo").eq("codigo", 9000000).limit(1);
  console.log("Cat 9000000:", d2);
  const { error } = await supabase.from("servicos").insert([{
    periodo_id: "1d7edd8a-f895-4835-8139-8e53dbbf73b7",
    diretoria_id: "684972d4-a9ef-4f8e-b849-4576e5c0d8c9",
    gerencia_id: "d38b01f7-9f6e-41af-8a59-212eb51fc763",
    item: 9000000,
    tipo_contratacao: "Serviço",
    unidade_demandante: "TESTE",
    objeto: "Teste",
    justificativa: "Teste",
    estimativa_valor: 1500,
    dotacao_orcamentaria: 0,
    grau_prioridade: "Médio",
    vinculacao: "Não",
    status: "rascunho"
  }]);
  if (error) console.error("Error inserting 9000000:", JSON.stringify(error, null, 2));
  else console.log("Success 9000000");
}
test();
