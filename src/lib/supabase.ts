import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Advertencia: Faltan credenciales de Supabase en el archivo .env. Asegúrate de configurar SUPABASE_URL y SUPABASE_KEY.");
}

/** Rol de la clave de Supabase (sin exponerla): service_role, anon o desconocido. */
const detectKeyRole = (key: string): string => {
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.role || "desconocido";
  } catch {
    return "desconocido";
  }
};

if (supabaseKey) {
  const role = detectKeyRole(supabaseKey);
  if (role === "service_role") {
    console.log("[DB] Conectado con rol service_role");
  } else {
    console.warn(
      `[DB] ⚠️ SUPABASE_KEY usa el rol "${role}". El backend debe usar la clave service_role; ` +
        "con RLS activo, la clave anon no tiene acceso a los datos. Ver supabase/migrations/20261015_enable_rls.sql"
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
