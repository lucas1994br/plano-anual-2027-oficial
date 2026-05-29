import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanGhosts() {
  console.log("Deletando serviços fantasmas (que não são 'Novo')...");
  const { data, error } = await supabase
    .from('servicos')
    .delete()
    .neq('tipo_contratacao', 'Novo');
    
  console.log("Resultado:", error || "Sucesso! Fantasmas removidos.");
}

cleanGhosts();
