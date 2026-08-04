import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: No se encontraron SUPABASE_URL ni SUPABASE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDiscrepancies() {
  console.log("🛠️ CORRIGIENDO DISCREPANCIAS EN SUPABASE...\n");

  // 1. Walter Alayo (Préstamo 351b143f-4106-4a05-ad23-2117d658d2f2): Quitar 22 soles agregando amortización de S/ 22.00 y marcar como pagado/liquidado
  const walterLoanId = "351b143f-4106-4a05-ad23-2117d658d2f2";
  console.log(`1. Aplicando abono de S/ 22.00 y marcando como pagado/liquidado préstamo de Walter Alayo (${walterLoanId})...`);
  
  const { error: errAbono } = await supabase.from("amortizaciones").insert({
    prestamo_id: walterLoanId,
    monto: 22.00,
    fecha_pago: new Date().toISOString().split("T")[0],
    tipo_movimiento: "Liquidación total",
    metodo_pago: "Efectivo"
  });

  if (errAbono) {
    console.error("❌ Error al insertar amortización de Walter Alayo:", errAbono);
  } else {
    console.log("   ✅ Abono de S/ 22.00 registrado.");
  }

  const { error: errWalter } = await supabase
    .from("prestamos")
    .update({ estado: "pagado" })
    .eq("id", walterLoanId);

  if (errWalter) {
    console.error("❌ Error al actualizar estado de Walter Alayo:", errWalter);
  } else {
    console.log("   ✅ Préstamo de Walter Alayo actualizado a 'pagado'.");
  }

  // 2. Lizbeth Fiorella Gutiérrez Saavedra (e8eeacd1-73bc-4238-a8be-5d18847a78bb): Marcar como pagado/liquidado
  const fiorellaLoanId = "e8eeacd1-73bc-4238-a8be-5d18847a78bb";
  console.log(`\n2. Actualizando estado a 'pagado' para Lizbeth Fiorella (${fiorellaLoanId})...`);
  const { error: errFiorella } = await supabase
    .from("prestamos")
    .update({ estado: "pagado" })
    .eq("id", fiorellaLoanId);

  if (errFiorella) {
    console.error("❌ Error al actualizar estado de Lizbeth Fiorella:", errFiorella);
  } else {
    console.log("   ✅ Préstamo de Lizbeth Fiorella actualizado a 'pagado'.");
  }

  console.log("\n🎉 TODAS LAS CORRECCIONES SOLICITADAS HAN SIDO APLICADAS EN SUPABASE.");
}

fixDiscrepancies().catch(console.error);
