import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('servicos_catalogo')
    .select('*')
    .order('item');

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  // Check for duplicate ITEM codes
  const itemMap = new Map();
  for (const row of data) {
    if (!itemMap.has(row.item)) {
      itemMap.set(row.item, []);
    }
    itemMap.get(row.item).push(row);
  }
  
  let duplicateItems = 0;
  for (const [item, rows] of itemMap.entries()) {
    if (rows.length > 1) {
      duplicateItems++;
      console.log(`Item ${item} is duplicated ${rows.length} times. Types: ${rows.map((r: any) => r.tipo_contratacao).join(', ')}`);
    }
  }
  
  console.log(`Total duplicate item codes: ${duplicateItems}`);
}

checkDuplicates();
