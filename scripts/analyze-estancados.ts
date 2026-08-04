import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { buildPaymentSchedule, round2 } from "../src/lib/loanLogic";

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
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  const { data: prestamos } = await supabase.from("prestamos").select("*");
  const { data: amortizaciones } = await supabase.from("amortizaciones").select("*");
  const { data: clientes } = await supabase.from("clientes").select("*");
  const { data: ajustes } = await supabase.from("ajustes_prestamo").select("*");

  const hoy = new Date();
  
  console.log("=== ANÁLISIS DE PRÉSTAMOS ESTANCADOS / ATRASADOS ===");
  
  for (const p of prestamos || []) {
    const cliente = clientes?.find(c => c.id === p.cliente_id);
    const pagosP = amortizaciones?.filter(a => a.prestamo_id === p.id) || [];
    const ajustesP = ajustes?.filter(aj => aj.prestamo_id === p.id) || [];
    
    const schedule = buildPaymentSchedule(p, pagosP, { ajustes: ajustesP, referenceDate: hoy });
    const res = schedule.resumen;
    
    if (res.capitalPendiente > 0.01) {
      if (res.cuotasVencidas > 0 || res.mesesSinPago > 0) {
        console.log(`- Cliente: ${cliente?.nombre_completo} | Préstamo: ${p.monto_capital}`);
        console.log(`  Capital Pend: ${res.capitalPendiente} | Mora: ${res.moraAcumulada}`);
        console.log(`  Cuotas Vencidas Totales: ${res.cuotasVencidas} | Meses Sin Pago Consecutivos: ${res.mesesSinPago}`);
        console.log(`  Es Estancado (Lógica actual): ${res.esEstancado}`);
        console.log(`  Estado en BD: ${p.estado}\n`);
      }
    }
  }
}

analyze().catch(console.error);
