import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRouting() {
  const { data: gerencias } = await supabase.from('gerencias').select('*');
  const { data: fluxos } = await supabase.from('admin_fluxo_config').select('*');
  
  const gerenciaMap = new Map();
  gerencias.forEach(g => gerenciaMap.set(g.id, g));
  
  let mismatches = 0;
  
  console.log("ROUTING MISMATCHES:");
  fluxos.forEach(f => {
    const gerencia = gerenciaMap.get(f.gerencia_id);
    if (!gerencia) {
      console.log(`Gerencia not found for fluxo:`, f);
      return;
    }
    
    if (gerencia.diretoria_id !== f.destino_id && f.destino_tipo === 'diretoria') {
      mismatches++;
      console.log(`Mismatch! Gerencia ${gerencia.sigla} (${gerencia.nome}) has diretoria ${gerencia.diretoria_id} but routes to ${f.destino_id}`);
    }
  });
  
  if (mismatches === 0) console.log("No mismatches found. All routing goes to the parent diretoria.");
}

checkRouting();
