import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

function processText(text: string): string {
  if (!text) return text;
  
  let processed = text;
  
  // Fix mojibake explicitly based on observed patterns
  processed = processed.replace(/AÃ‚Â°/g, '°');
  processed = processed.replace(/AA‚A°/g, '°');
  processed = processed.replace(/AÃ‚Âº/g, 'º');
  processed = processed.replace(/AA‚Aº/g, 'º');
  processed = processed.replace(/AÃ‚Â²/g, '²');
  processed = processed.replace(/AA‚A²/g, '²');
  processed = processed.replace(/AÃ‚Â³/g, '³');
  processed = processed.replace(/AA‚A³/g, '³');
  processed = processed.replace(/Ã‚Â°/g, '°');
  processed = processed.replace(/Ã‚Âº/g, 'º');
  processed = processed.replace(/Ã‚Â²/g, '²');
  processed = processed.replace(/Ã‚Â³/g, '³');

  // Upper case
  processed = processed.toUpperCase();
  
  // Remove accents
  processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  
  // Remove unnecessary symbols
  processed = processed.replace(/=/g, "");
  
  return processed.trim();
}

async function fixDatabase() {
  console.log('Fetching itens_catalogo...');
  
  let allData: any[] = [];
  let from = 0;
  const size = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('itens_catalogo')
      .select('id, codigo, descricao')
      .range(from, from + size - 1);
      
    if (error) {
      console.error('Error fetching data:', error);
      return;
    }
    
    if (data.length === 0) break;
    
    allData = allData.concat(data);
    from += size;
  }

  console.log(`Found ${allData.length} items total.`);
  let updatedCount = 0;

  for (const item of allData) {
    const original = item.descricao;
    const processed = processText(original);
    
    if (original !== processed) {
      console.log(`Updating [${item.codigo}]`);
      console.log(`  From: ${original}`);
      console.log(`  To:   ${processed}`);
      
      const { error: updateError } = await supabase
        .from('itens_catalogo')
        .update({ descricao: processed })
        .eq('id', item.id);
        
      if (updateError) {
        console.error(`Error updating item ${item.codigo}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Finished. Updated ${updatedCount} items.`);
}

fixDatabase();
