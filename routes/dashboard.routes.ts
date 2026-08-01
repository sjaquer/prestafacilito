import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, normalizeDate, toNumber, round2 } from "../src/lib/loanLogic.js";

const router = express.Router();

// Endpoint optimizado para el Centro de Control / Home (Fase 4)
router.get("/home", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const referenceDate = req.query.fecha ? new Date(String(req.query.fecha)) : new Date();
    const now = normalizeDate(referenceDate);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const [pRes, aRes, cRes, ajRes] = await Promise.all([
      supabase.from("prestamos").select("*").eq("estado", "activo"),
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

    // Calcular cobros efectuados en el mes actual
    const cobradoEsteMes = amortizaciones
      .filter(a => {
        const d = normalizeDate(a.fecha_pago);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, a) => sum + toNumber(a.monto), 0);

    const deudoresDelMes: any[] = [];
    let prestamosAtrasadosCount = 0;

    for (const prestamo of prestamos) {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === prestamo.id);
      const ajustesDelPrestamo = ajustes.filter(a => a.prestamo_id === prestamo.id);

      const debtState = buildPaymentSchedule(prestamo, pagosDelPrestamo, {
        ajustes: ajustesDelPrestamo,
        referenceDate: now
      });

      // Encontrar la cuota correspondiente a este mes o la cuota vencida más relevante
      const cuotaMes = debtState.cuotas.find(c => {
        const d = normalizeDate(c.fechaVencimiento);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      }) || debtState.cuotaSiguiente || debtState.cuotas[debtState.cuotas.length - 1];

      // Determinar si el deudor debe figurar en la lista del mes actual:
      // Figuran si tienen una cuota en el mes actual o si tienen cuotas vencidas pendientes.
      const tieneCuotaEsteMes = debtState.cuotas.some(c => {
        const d = normalizeDate(c.fechaVencimiento);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });

      const tieneMoraOpendientes = debtState.resumen.cuotasVencidas > 0 || debtState.resumen.cuotasPendientes > 0;

      if (tieneCuotaEsteMes || tieneMoraOpendientes) {
        let estadoPagoMes: 'atrasado' | 'pendiente' | 'pagado' = 'pendiente';
        let diasAtraso = 0;

        if (debtState.resumen.cuotasVencidas > 0) {
          estadoPagoMes = 'atrasado';
          prestamosAtrasadosCount++;
          diasAtraso = debtState.cuotasVencidasDetalle[0]?.diasVencidos || 0;
        } else if (cuotaMes && cuotaMes.estado === 'Saldada') {
          estadoPagoMes = 'pagado';
        } else if (cuotaMes && cuotaMes.estado === 'Parcial') {
          estadoPagoMes = cuotaMes.diasVencidos > 0 ? 'atrasado' : 'pendiente';
        }

        const fechaVencMes = cuotaMes ? cuotaMes.fechaVencimiento : prestamo.fecha_vencimiento || prestamo.fecha_emision;

        deudoresDelMes.push({
          prestamo_id: prestamo.id,
          cliente_id: prestamo.cliente_id,
          cliente_nombre: cliente?.nombre_completo || "Cliente Desconocido",
          cliente_apodo: cliente?.apodo || "",
          cliente_telefono: cliente?.telefono || "",
          score: cliente?.score || null,
          monto_capital: toNumber(prestamo.monto_capital),
          tasa_interes_porcentaje: toNumber(prestamo.tasa_interes_porcentaje),
          tipo_prestamo: prestamo.tipo_prestamo,
          fecha_emision: prestamo.fecha_emision,
          fecha_vencimiento: prestamo.fecha_vencimiento,
          dia_vencimiento_mes: fechaVencMes,
          cuota_actual: cuotaMes ? cuotaMes.montoCuotaBase : 0,
          cuota_exigible: cuotaMes ? cuotaMes.montoExigible : 0,
          cuota_pagado: cuotaMes ? cuotaMes.pagado : 0,
          cuota_numero: cuotaMes ? cuotaMes.numero : 1,
          total_cuotas: debtState.resumen.totalCuotas,
          estado_pago_mes: estadoPagoMes,
          saldo_pendiente: debtState.resumen.saldoPendiente,
          dias_atraso: diasAtraso
        });
      }
    }

    // Ordenar deudores: 1° atrasado, 2° pendiente, 3° pagado
    const ordenEstado = { atrasado: 1, pendiente: 2, pagado: 3 };
    deudoresDelMes.sort((a, b) => {
      const diff = ordenEstado[a.estado_pago_mes as keyof typeof ordenEstado] - ordenEstado[b.estado_pago_mes as keyof typeof ordenEstado];
      if (diff !== 0) return diff;
      return new Date(a.dia_vencimiento_mes).getTime() - new Date(b.dia_vencimiento_mes).getTime();
    });

    const totalCapitalEnCirculacion = round2(prestamos.reduce((sum, p) => sum + toNumber(p.monto_capital), 0));

    res.json({
      deudoresDelMes,
      resumenCartera: {
        totalActivoCount: prestamos.length,
        totalCapitalEnCirculacion,
        totalCobradoEsteMes: round2(cobradoEsteMes),
        prestamosAtrasadosCount
      }
    });
  } catch (err: any) {
    console.error("Error al obtener datos del Home:", err);
    res.status(500).json({ error: "Error en el servidor", detail: err.message });
  }
});

// Endpoint legado Dashboard
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
