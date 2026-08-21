import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

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
