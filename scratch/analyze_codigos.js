import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icyawlvdmlcndsjpudle.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function analyze() {
  const { data: diretorias, error: errDir } = await supabase.from('diretorias').select('*').eq('ativa', true);
  if (errDir) console.error("Error fetching diretorias:", errDir);

  const { data: gerencias, error: errGer } = await supabase.from('gerencias').select('*').eq('ativa', true);
  if (errGer) console.error("Error fetching gerencias:", errGer);

  const { data: codigos, error: errCod } = await supabase.from('codigos_acesso').select('*');
  if (errCod) console.error("Error fetching codigos_acesso:", errCod);

  if (diretorias && gerencias && codigos) {
    const dirMissing = diretorias.filter(d => !codigos.some(c => c.diretoria_id === d.id));
    const gerMissing = gerencias.filter(g => !codigos.some(c => c.gerencia_id === g.id));

    console.log("Diretorias missing codigos_acesso:");
    dirMissing.forEach(d => console.log(`- ${d.sigla}: ${d.nome}`));

    console.log("\nGerencias missing codigos_acesso:");
    gerMissing.forEach(g => console.log(`- ${g.sigla}: ${g.nome}`));
  } else {
    console.log("Could not fetch data (possibly RLS blocked codigos_acesso)");
  }
}

analyze();
