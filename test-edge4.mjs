import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://icyawlvdmlcndsjpudle.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("No VITE_SUPABASE_ANON_KEY found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const adminAccessCode = "123456"; // Just trying to get an error other than DB error

  const config = {
    diretoriaBudgetsServicosNovos: { "4977c7b9-90fc-43cb-9f15-c383520a1e28": 120000 },
    diretoriaBudgetsServicosExistentes: { "4977c7b9-90fc-43cb-9f15-c383520a1e28": 50000 }
  };

  const { data, error } = await supabase.functions.invoke("admin-upsert-mini-erp-config", {
    body: {
      accessCode: adminAccessCode,
      config,
    },
  });

  console.log("Edge Function Response:", data, error);
}

test();
