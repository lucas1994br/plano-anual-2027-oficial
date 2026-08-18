import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkItem() {
  console.log("Checking servicos item 3077...");
  const { data, error } = await supabase
    .from('servicos')
    .select('item, contratada')
    .eq('item', 3077);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Data:", data);
  }
}

checkItem();
