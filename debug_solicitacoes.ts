import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://icyawlvdmlcndsjpudle.supabase.co', 'sb_publishable_DegRlJqU1rw3iziTpeRaaw_08hXoJvN');

async function run() {
  const { data: countData, error, count } = await supabase.from('solicitacoes').select('id', { count: 'exact', head: true }).eq('diretoria_id', '842c2695-a38b-4ffa-aeb7-0f9d5753fb34').eq('qtd_estimada', 0).eq('status', 'rascunho');
  console.log('DO ghost solicitacoes:', count);
}
run();
