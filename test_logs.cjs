require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: logs } = await supabase.from('logs_atividades').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Logs:", logs);

  const { data: funcs } = await supabase.from('funcionarios').select('*').in('matricula', ['76643', 'dg76643', 'gesl76643', 'admin123']);
  console.log("Funcionarios:", funcs);
}
check();
