import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Tratamento do preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://docs.google.com/spreadsheets/d/1seIaYVZ1D06jPZm9O7yzXbW8hi8tgV2OzBHguyNrfMY/export?format=xlsx");
    if (!res.ok) {
      throw new Error("Failed to fetch Google Sheet");
    }

    const arrayBuffer = await res.arrayBuffer();
    // Leitura do Buffer no Deno usando sheetjs
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    
    const previstoData = workbook.Sheets['previsto'] ? XLSX.utils.sheet_to_json(workbook.Sheets['previsto']) : [];
    const realizadoData = workbook.Sheets['realizado'] ? XLSX.utils.sheet_to_json(workbook.Sheets['realizado']) : [];
    const orcamentoData = workbook.Sheets['orcamento'] ? XLSX.utils.sheet_to_json(workbook.Sheets['orcamento']) : [];

    return new Response(JSON.stringify({ previstoData, realizadoData, orcamentoData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
