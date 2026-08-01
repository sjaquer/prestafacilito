import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";

const router = express.Router();

router.get("/", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const [pRes, aRes, cRes, ajRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("ajustes_prestamo").select("*").eq("activo", true)
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;
    if (ajRes.error) throw ajRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];
    const ajustes = ajRes.data || [];

    const totalCapitalPrestado = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);
    const totalRecuperado = amortizaciones.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const prestamosActivos = prestamos.filter(p => p.estado === "activo").length;

    const prestamosConCliente = prestamos.map(p => {
      const cliente = clientes.find(c => c.id === p.cliente_id);
      const prAjustes = ajustes.filter(a => a.prestamo_id === p.id);
      return {
        ...p,
        monto_capital: parseFloat(p.monto_capital) || 0,
        tasa_interes_porcentaje: parseFloat(p.tasa_interes_porcentaje) || 0,
        cliente_nombre: cliente ? cliente.nombre_completo : "Cliente no encontrado",
        ajustes: prAjustes
      };
    });

    const ultimosPrestamos = [...prestamosConCliente]
      .sort((a, b) => new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime());

    res.json({
      metrics: {
        totalCapitalPrestado: Math.round(totalCapitalPrestado * 100) / 100,
        totalRecuperado: Math.round(totalRecuperado * 100) / 100,
        prestamosActivos,
        totalPrestamosCount: prestamos.length
      },
      ultimosPrestamos,
      prestamos: prestamosConCliente
    });
  } catch (err: any) {
    console.error("Error al obtener dashboard:", err);
    res.status(500).json({ error: "Error en el servidor", detail: err.message });
  }
});

export default router;
