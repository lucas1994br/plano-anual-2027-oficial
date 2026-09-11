import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://icyawlvdmlcndsjpudle.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking Supabase solicitacoes for DC / gerencias CCRC, CCRF, CCRR...");
  const { data: sol, error } = await supabase
    .from('solicitacoes')
    .select('id, codigo, descricao, qtd_estimada, valor_unitario, valor_total, status, gerencia_id, diretoria_id')
    .in('status', ['enviado', 'aprovado', 'em_analise', 'rascunho'])
    .limit(10);

  if (error) {
    console.error("Supabase Error:", error);
  } else {
    console.log(`Found ${sol.length} solicitacoes sample in Supabase:`);
    console.log(sol.slice(0, 5));
  }

  // Check count of items with qtd_estimada = 0 vs > 0
  const { count: countZero } = await supabase
    .from('solicitacoes')
    .select('*', { count: 'exact', head: true })
    .eq('qtd_estimada', 0);
  
  const { count: countGtZero } = await supabase
    .from('solicitacoes')
    .select('*', { count: 'exact', head: true })
    .gt('qtd_estimada', 0);

  console.log(`Supabase: solicitacoes with qtd_estimada == 0: ${countZero}, > 0: ${countGtZero}`);

  // Check Google Sheets
  const scriptUrl = process.env.VITE_GOOGLE_SCRIPT_URL;
  if (scriptUrl) {
    console.log("\nChecking Google Apps Script Web App for getSolicitacoes...");
    try {
      const res = await fetch(`${scriptUrl}?action=getSolicitacoes&diretoria_id=DC`);
      const gsData = await res.json();
      console.log(`Google Sheets: Success=${gsData.success}, Total count=${gsData.data?.length}`);
      if (gsData.data?.length) {
        console.log("First 3 items from Google Sheets:");
        console.log(gsData.data.slice(0, 3));
        const zeroQtd = gsData.data.filter(x => Number(x.qtd_estimada || 0) === 0).length;
        const gtZeroQtd = gsData.data.filter(x => Number(x.qtd_estimada || 0) > 0).length;
        console.log(`Google Sheets: qtd_estimada == 0: ${zeroQtd}, > 0: ${gtZeroQtd}`);
      }
    } catch (e) {
      console.error("Google Apps Script fetch error:", e.message);
    }
  }
}

check();
