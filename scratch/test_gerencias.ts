import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const { data: diretoria } = await supabase.from("diretorias").select("id, sigla").eq("sigla", "DG").single();
  console.log("Diretoria DG:", diretoria);
  
  if (diretoria) {
    const { data: gerencias } = await supabase.from("gerencias").select("id, sigla").eq("diretoria_id", diretoria.id);
    console.log("Gerencias for DG:", gerencias);
  }
}
test();
