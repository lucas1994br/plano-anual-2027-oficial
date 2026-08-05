import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Cleaning up solicitacoes with qtd_estimada = 0 ...');
  
  // To avoid timeout on large tables, we delete in batches
  let deleted = 0;
  while (true) {
    const { data, error, count } = await supabase
      .from('solicitacoes')
      .select('id')
      .eq('qtd_estimada', 0)
      .eq('status', 'rascunho')
      .is('observacao', null)
      .limit(50);
      
    if (error) {
      console.error('Error fetching:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      console.log('Done cleaning!');
      break;
    }
    
    const ids = data.map(d => d.id);
    const { error: delError } = await supabase
      .from('solicitacoes')
      .delete()
      .in('id', ids);
      
    if (delError) {
      console.error('Error deleting:', delError);
      break;
    }
    
    deleted += data.length;
    console.log(`Deleted ${deleted} items...`);
  }
}

run();
