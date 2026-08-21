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

async function checkDatabase() {
  const { data, error } = await supabase
    .from('servicos')
    .select('*, gerencias(sigla), diretorias(sigla)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log('--- LATEST 10 SERVICOS IN DATABASE ---');
  data.forEach((s) => {
    console.log(`ID: ${s.id}`);
    console.log(`Item: ${s.item}`);
    console.log(`Tipo: ${s.tipo_contratacao}`);
    console.log(`Status: ${s.status}`);
    console.log(`Gerencia: ${s.gerencias?.sigla}`);
    console.log(`Diretoria: ${s.diretorias?.sigla}`);
    console.log(`Objeto: ${s.objeto}`);
    console.log('------------------------');
  });
}

checkDatabase();
