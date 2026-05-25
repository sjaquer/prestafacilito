import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://mvusegasjopczjziupts.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY || "";

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log("Fetching active prestamos...");
  const { data: prestamos, error: pError } = await supabase
    .from("prestamos")
    .select("*");
    
  if (pError) {
    console.error("Error fetching prestamos:", pError);
    return;
  }
  
  console.log(`Found ${prestamos?.length || 0} prestamos:`);
  for (const p of prestamos || []) {
    console.log(`Loan ID: ${p.id}, Cliente ID: ${p.cliente_id}, Capital: ${p.monto_capital}, Tasa: ${p.tasa_interes_porcentaje}%, Estado: ${p.estado}, Emision: ${p.fecha_emision}, Vencimiento: ${p.fecha_vencimiento}`);
    
    const { data: amortizaciones, error: aError } = await supabase
      .from("amortizaciones")
      .select("*")
      .eq("prestamo_id", p.id)
      .order("fecha_pago", { ascending: true });
      
    if (aError) {
      console.error(`Error fetching amortizaciones for loan ${p.id}:`, aError);
      continue;
    }
    
    console.log(`  Amortizaciones (${amortizaciones?.length || 0}):`);
    for (const a of amortizaciones || []) {
      console.log(`    Pago ID: ${a.id}, Monto: ${a.monto}, Fecha: ${a.fecha_pago}, Tipo: ${a.tipo_movimiento}, Metodo: ${a.metodo_pago}`);
    }
  }
}

main().catch(console.error);

