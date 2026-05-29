import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('servicos_catalogo').select('*').limit(1);
  console.log("Error:", error);
  console.log("Data columns:", data && data.length > 0 ? Object.keys(data[0]) : "No data, but query success");
}

check();
