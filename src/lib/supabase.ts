import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Advertencia: Faltan credenciales de Supabase en el archivo .env. Asegúrate de configurar SUPABASE_URL y SUPABASE_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
