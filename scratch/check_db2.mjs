import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data: diretorias } = await supabase.from('diretorias').select('*');
  const { data: gerencias } = await supabase.from('gerencias').select('*');
  const { data: fluxos } = await supabase.from('admin_fluxo_config').select('*');
  const { data: config } = await supabase.from('admin_orcamento_config').select('*');
  
  console.log("DIRETORIAS:");
  console.log(JSON.stringify(diretorias, null, 2));
  
  console.log("\nGERENCIAS:");
  console.log(JSON.stringify(gerencias, null, 2));
  
  console.log("\nADMIN FLUXO CONFIG:");
  console.log(JSON.stringify(fluxos, null, 2));

  console.log("\nADMIN ORCAMENTO CONFIG:");
  console.log(JSON.stringify(config, null, 2));
}

checkDb();
