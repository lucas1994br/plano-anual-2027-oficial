import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function alterTable() {
  console.log("Checking columns in servicos_catalogo...");
  const { data, error } = await supabase.from('servicos_catalogo').select('*').limit(1);
  console.log("Data columns:", data && data.length > 0 ? Object.keys(data[0]) : "Empty table, but query success");
}

alterTable();
