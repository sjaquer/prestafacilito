import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { buildPaymentSchedule } from "../src/lib/loanLogic";

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

async function run() {
  const { data: prestamos } = await supabase.from("prestamos").select("*");
  const { data: amortizaciones } = await supabase.from("amortizaciones").select("*");
  const { data: ajustes } = await supabase.from("ajustes_prestamo").select("*");
  const { data: clientes } = await supabase.from("clientes").select("*");

  if (!prestamos) return;

  const hoy = new Date();
  
  for (const p of prestamos) {
    if (p.estado === "pagado" || p.estado === "liquidado") continue;

    const pagosP = amortizaciones?.filter(a => a.prestamo_id === p.id) || [];
    const ajustesP = ajustes?.filter(a => a.prestamo_id === p.id) || [];
    const schedule = buildPaymentSchedule(p, pagosP, { ajustes: ajustesP, referenceDate: hoy });
    const res = schedule.resumen;

    const debeSerEstancado = res.cuotasVencidas >= 3;
    const esActualmenteEstancado = p.estado === "estancado";

    if (debeSerEstancado && !esActualmenteEstancado) {
      console.log(`[+] Marcando como estancado: ${p.cliente_nombre || p.cliente_id} (Debe ${res.cuotasVencidas} cuotas)`);
      await supabase.from("prestamos").update({ estado: "estancado" }).eq("id", p.id);
    } else if (!debeSerEstancado && esActualmenteEstancado) {
      console.log(`[-] Desmarcando estancado (volviendo a activo): ${p.cliente_nombre || p.cliente_id} (Debe ${res.cuotasVencidas} cuotas)`);
      await supabase.from("prestamos").update({ estado: "activo" }).eq("id", p.id);
    }
  }

  console.log("Completado.");
}

run().catch(console.error);
