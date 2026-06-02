import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function analyze() {
  const { data, error } = await supabase
    .from('itens_catalogo')
    .select('id, codigo, descricao');

  if (error) throw error;
  
  for (const item of data) {
    if (item.descricao.includes('A‚A') || item.descricao.includes('Ã‚')) {
       console.log(`[${item.codigo}] ${item.descricao}`);
    }
  }
}

analyze();
