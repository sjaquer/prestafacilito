import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { buildPaymentSchedule } from "../src/lib/loanLogic.js";

const supabaseUrl = process.env.SUPABASE_URL || "https://mvusegasjopczjziupts.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY || "";

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Fetch the first active loan
  const { data: prestamos } = await supabase.from("prestamos").select("*");
  if (!prestamos || prestamos.length === 0) {
    console.log("No loans found");
    return;
  }
  const p = prestamos[0];
  
  // Fetch amortizaciones
  const { data: amortizaciones } = await supabase
    .from("amortizaciones")
    .select("*")
    .eq("prestamo_id", p.id)
    .order("fecha_pago", { ascending: true });
    
  // Fetch adjustments
  const { data: ajustes } = await supabase
    .from("ajustes_prestamo")
    .select("*")
    .eq("prestamo_id", p.id);
    
  console.log(`Loan Capital: ${p.monto_capital}, Tasa: ${p.tasa_interes_porcentaje}%, Emision: ${p.fecha_emision}`);
  
  const referenceDate = new Date("2026-05-24T23:33:03-05:00");
  const debtState = buildPaymentSchedule(p, amortizaciones || [], ajustes || [], referenceDate);
  
  console.log("\n--- SIMULATION RESULTS ---");
  console.log("Total Pagado (en amortizaciones):", debtState.resumen.totalPagado);
  console.log("Capital Pendiente:", debtState.resumen.capitalPendiente);
  console.log("Interes Pendiente:", debtState.resumen.interesPendiente);
  console.log("Mora Acumulada:", debtState.resumen.moraAcumulada);
  console.log("Saldo Pendiente:", debtState.resumen.saldoPendiente);
  
  console.log("\n--- CUOTAS ---");
  for (const c of debtState.cuotas) {
    console.log(`Cuota #${c.numero} (${c.fechaVencimiento}):
      Base: ${c.montoCuotaBase.toFixed(2)}
      Exigible: ${c.montoExigible.toFixed(2)}
      CapitalPendiente en cuota: ${c.capitalPendiente.toFixed(2)}
      InteresPendiente: ${c.interesPendiente.toFixed(2)}
      MoraPendiente: ${c.moraPendiente.toFixed(2)}
      Pagado: ${c.pagado.toFixed(2)}
      CapitalAmortizado: ${(c.capitalAmortizado || 0).toFixed(2)}
      Estado: ${c.estado}`);
  }
}

main().catch(console.error);
