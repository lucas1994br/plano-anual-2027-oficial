import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const cod = await supabase.from('codigos_acesso').select('*, gerencias(sigla), diretorias(sigla)');
  
  let anomalies = 0;
  for (const c of cod.data || []) {
    if (c.scope === 'gerencia') {
      const expectedPrefix = c.gerencias?.sigla?.toLowerCase();
      if (!c.codigo_hash.startsWith(expectedPrefix)) {
        console.log("Anomaly in gerencia:", c);
        anomalies++;
      }
    } else if (c.scope === 'diretoria') {
      const expectedPrefix = c.diretorias?.sigla?.toLowerCase();
      if (!c.codigo_hash.startsWith(expectedPrefix)) {
        console.log("Anomaly in diretoria:", c);
        anomalies++;
      }
    }
  }
  
  console.log(`Finished checking ${cod.data?.length} codes. Anomalies found: ${anomalies}`);
}

checkData();
