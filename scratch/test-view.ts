import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key starts with:", supabaseKey.substring(0, 15) + "...");

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log("Querying resumen_financiero_clientes...");
    const { data, error } = await supabase
      .from("resumen_financiero_clientes")
      .select("*")
      .order("nombre_completo", { ascending: true });

    if (error) {
      console.error("❌ ERROR QUERYING VIEW:", error.message, error);
    } else {
      console.log("✅ SUCCESS QUERYING VIEW! Number of rows returned:", data?.length);
      if (data && data.length > 0) {
        console.log("First row:", data[0]);
      }
    }
  } catch (err) {
    console.error("💥 CRASHED:", err);
  }
}

main().catch(console.error);
