import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log("Running dashboard code clone...");
    const [pRes, aRes, cRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*")
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];

    console.log("prestamos count:", prestamos.length);
    console.log("amortizaciones count:", amortizaciones.length);
    console.log("clientes count:", clientes.length);

    // Calculations
    const totalCapitalPrestado = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);
    const totalRecuperado = amortizaciones.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const prestamosActivos = prestamos.filter(p => p.estado === "activo").length;

    console.log("Calculated metrics:", {
      totalCapitalPrestado,
      totalRecuperado,
      prestamosActivos,
      totalPrestamosCount: prestamos.length
    });

    const prestamosConCliente = prestamos.map(p => {
      const cliente = clientes.find(c => c.id === p.cliente_id);
      return {
        ...p,
        monto_capital: parseFloat(p.monto_capital) || 0,
        tasa_interes_porcentaje: parseFloat(p.tasa_interes_porcentaje) || 0,
        cliente_nombre: cliente ? cliente.nombre_completo : "Cliente no encontrado"
      };
    });

    const ultimosPrestamos = [...prestamosConCliente]
      .sort((a, b) => new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime())
      .slice(0, 5);

    console.log("ultimosPrestamos:", ultimosPrestamos);
    console.log("SUCCESS!");
  } catch (err) {
    console.error("DASHBOARD CODE FAILED:", err);
  }
}

main().catch(console.error);
