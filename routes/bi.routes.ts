import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, toNumber, round2 } from "../src/lib/loanLogic.js";

const router = express.Router();

// GET /api/bi/resumen — Estadísticas financieras y gráficas gerenciales en tiempo real (Tarea 10.2.3)
router.get("/resumen", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const [prestamosRes, amortRes, alquileresRes, pagosAlqRes, clientesRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("alquileres").select("*"),
      supabase.from("pagos_alquiler").select("*"),
      supabase.from("resumen_financiero_clientes").select("*")
    ]);

    if (prestamosRes.error) throw prestamosRes.error;
    if (amortRes.error) throw amortRes.error;
    if (alquileresRes.error) throw alquileresRes.error;
    if (pagosAlqRes.error) throw pagosAlqRes.error;
    if (clientesRes.error) throw clientesRes.error;

    const prestamos = prestamosRes.data || [];
    const amortizaciones = amortRes.data || [];
    const alquileres = alquileresRes.data || [];
    const pagosAlquiler = pagosAlqRes.data || [];
    const clientes = clientesRes.data || [];

    const now = new Date();
    const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1);
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const prestamosActivos = prestamos.filter((p) => p.estado === "activo");
    const prestamosPagados = prestamos.filter((p) => p.estado === "pagado");

    // Capital total prestado en circulación
    const capitalEnCirculacion = prestamosActivos.reduce(
      (sum, p) => sum + toNumber(p.monto_capital),
      0
    );

    // Cálculos de saldo exigible y morosidad mediante el motor del modelo francés
    let saldoPendienteTotal = 0;
    let prestamosAtrasadosCount = 0;

    for (const p of prestamosActivos) {
      const pagos = amortizaciones.filter((a) => a.prestamo_id === p.id);
      const schedule = buildPaymentSchedule(p, pagos);
      saldoPendienteTotal += schedule.resumen.saldoPendiente;
      if (schedule.resumen.cuotasVencidas > 0) {
        prestamosAtrasadosCount++;
      }
    }

    // Cobros del mes actual (Amortizaciones + Rentas de Alquiler)
    const cobrosMesActualList = [
      ...amortizaciones.filter((a) => a.fecha_pago && new Date(a.fecha_pago) >= inicioMesActual),
      ...pagosAlquiler.filter((p) => p.fecha_pago && new Date(p.fecha_pago) >= inicioMesActual)
    ];
    const cobradoMesActual = cobrosMesActualList.reduce((sum, p) => sum + toNumber(p.monto), 0);

    // Cobros del mes anterior
    const cobrosMesAnteriorList = [
      ...amortizaciones.filter((a) => {
        if (!a.fecha_pago) return false;
        const f = new Date(a.fecha_pago);
        return f >= inicioMesAnterior && f < inicioMesActual;
      }),
      ...pagosAlquiler.filter((p) => {
        if (!p.fecha_pago) return false;
        const f = new Date(p.fecha_pago);
        return f >= inicioMesAnterior && f < inicioMesActual;
      })
    ];
    const cobradoMesAnterior = cobrosMesAnteriorList.reduce((sum, p) => sum + toNumber(p.monto), 0);

    // Histórico de cobros mensual de los últimos 6 meses (para la gráfica SVG)
    const historialCobros = [];
    const NOMBRES_MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    for (let i = 5; i >= 0; i--) {
      const fechaBase = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const inicioMes = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
      const finMes = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, 0, 23, 59, 59);

      const cobrado = [
        ...amortizaciones.filter((a) => {
          if (!a.fecha_pago) return false;
          const f = new Date(a.fecha_pago);
          return f >= inicioMes && f <= finMes;
        }),
        ...pagosAlquiler.filter((p) => {
          if (!p.fecha_pago) return false;
          const f = new Date(p.fecha_pago);
          return f >= inicioMes && f <= finMes;
        })
      ].reduce((sum, p) => sum + toNumber(p.monto), 0);

      const mesLabel = `${NOMBRES_MESES[inicioMes.getMonth()]} ${String(inicioMes.getFullYear()).slice(-2)}`;
      historialCobros.push({
        mes: mesLabel,
        cobrado: round2(cobrado)
      });
    }

    // Top 5 Clientes por Capital Activo con su Score A/B/C
    const top5Clientes = clientes
      .filter((c) => (c.prestamos_activos || 0) > 0)
      .sort((a, b) => toNumber(b.capital_total_prestado) - toNumber(a.capital_total_prestado))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre_completo,
        apodo: c.apodo || "",
        capitalActivo: toNumber(c.capital_total_prestado),
        prestamosActivos: c.prestamos_activos || 0,
        score: c.score_efectivo || null,
        scoreSobreescrito: c.score_sobreescrito || false
      }));

    res.json({
      kpis: {
        capitalEnCirculacion: round2(capitalEnCirculacion),
        saldoPendienteTotal: round2(saldoPendienteTotal),
        cobradoMesActual: round2(cobradoMesActual),
        cobradoMesAnterior: round2(cobradoMesAnterior),
        prestamosActivosCount: prestamosActivos.length,
        prestamosPagadosCount: prestamosPagados.length,
        prestamosAtrasadosCount,
        totalClientes: clientes.length,
        alquileresActivos: alquileres.filter((a) => a.estado === "activo").length
      },
      historialCobros,
      top5Clientes
    });
  } catch (err: any) {
    console.error("Error al generar resumen BI:", err);
    res.status(500).json({ error: "Error al generar resumen BI", detail: err.message });
  }
});

export default router;
