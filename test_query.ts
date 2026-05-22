import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://mvusegasjopczjziupts.supabase.co";
const publishableKey = process.env.SUPABASE_KEY || "";
const legacyAnonKey = process.env.LEGACY_ANON_KEY || "";

async function runTest(name: string, key: string) {
  console.log(`\n--- Testing Key: ${name} ---`);
  const supabase = createClient(supabaseUrl, key);
  
  const rRes = await supabase.from("resumen_financiero_clientes").select("*");
  if (rRes.error) {
    console.error("resumen_financiero_clientes error:", rRes.error.message, rRes.error);
  } else {
    console.log("resumen_financiero_clientes success, count returned:", rRes.data.length);
  }
}

async function main() {
  await runTest("Publishable Key", publishableKey);
  await runTest("Legacy JWT Anon Key", legacyAnonKey);
}

main().catch(console.error);
