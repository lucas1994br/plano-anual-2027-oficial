import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocal = path.resolve(process.cwd(), '.env.local');
const envDefault = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config({ path: envDefault });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials. Ensure .env or .env.local exists and contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ItemCatalogo {
  id: string;
  codigo: number;
  descricao: string;
}

async function analyze() {
  const { data, error } = await supabase
    .from('itens_catalogo')
    .select('id, codigo, descricao');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  if (data) {
    for (const item of data as ItemCatalogo[]) {
      if (item.descricao && (item.descricao.includes('A‚A') || item.descricao.includes('Ã‚'))) {
         console.log(`[${item.codigo}] ${item.descricao}`);
      }
    }
  }
}

analyze();
