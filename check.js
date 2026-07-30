require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('logs_atividades').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}
check();
