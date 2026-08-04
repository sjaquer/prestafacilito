import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, normalizeDate, toNumber, round2 } from "../src/lib/loanLogic.js";
import { buildAlquilerSchedule } from "../src/lib/alquilerLogic.js";
import { calcularEstadoMora } from "../src/lib/moraLogic.js";

const router = express.Router();

// Endpoint optimizado para el Centro de Control / Inicio
router.get("/home", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const referenceDate = req.query.fecha ? new Date(String(req.query.fecha)) : new Date();
    const now = normalizeDate(referenceDate);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const [pRes, aRes, cRes, ajRes, alqRes, pagosAlqRes] = await Promise.all([
      supabase.from("prestamos").select("*").eq("estado", "activo"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("ajustes_prestamo").select("*").eq("activo", true),
      supabase.from("alquileres").select("*").eq("estado", "activo"),
      supabase.from("pagos_alquiler").select("*")
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;
    if (ajRes.error) throw ajRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];
    const ajustes = ajRes.data || [];
    const alquileres = alqRes.data || [];
    const pagosAlquiler = pagosAlqRes.data || [];

    // Calcular cobros efectuados en el mes actual
    const cobradoPrestamos = amortizaciones
      .filter(a => {
        const d = normalizeDate(a.fecha_pago);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .reduce((sum, a) => sum + toNumber(a.monto), 0);

    const cobradoAlquileres = pagosAlquiler
      .filter(p => p.periodo_anio === currentYear && p.periodo_mes === (currentMonth + 1))
      .reduce((sum, p) => sum + toNumber(p.monto), 0);

    const totalCobradoEsteMes = round2(cobradoPrestamos + cobradoAlquileres);

    const deudoresDelMes: any[] = [];
    let prestamosAtrasadosCount = 0;

    // 1. Procesar Préstamos Activos
    for (const prestamo of prestamos) {
      const cliente = clientes.find(c => c.id === prestamo.cliente_id);
      const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === prestamo.id);
      
      const estadoMora = calcularEstadoMora(prestamo, pagosDelPrestamo, now);

      const pagosMesActual = pagosDelPrestamo.filter(a => {
        const d = normalizeDate(a.fecha_pago);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });

      const totalPagadoMesActual = pagosMesActual.reduce((sum, a) => sum + toNumber(a.monto), 0);

      let estadoPagoMes: 'atrasado' | 'pendiente' | 'pagado' | 'estancado' = 'pendiente';
      if (estadoMora.esEstancado) {
        estadoPagoMes = 'estancado';
      } else if (estadoMora.estadoCuotaMes === 'al_dia') {
        estadoPagoMes = 'pagado';
      } else if (estadoMora.cuotasAtrasadas > 0) {
        estadoPagoMes = 'atrasado';
        prestamosAtrasadosCount++;
      } else {
        estadoPagoMes = 'pendiente';
      }

      deudoresDelMes.push({
        prestamo_id: prestamo.id,
        cliente_id: prestamo.cliente_id,
        cliente_nombre: cliente?.nombre_completo || "Cliente Desconocido",
        cliente_apodo: cliente?.apodo || "",
        cliente_telefono: cliente?.telefono || "",
        score: cliente?.score || null,
        es_alquiler: false,
        monto_capital: toNumber(prestamo.monto_capital),
        tasa_interes_porcentaje: toNumber(prestamo.tasa_interes_porcentaje),
        tipo_prestamo: prestamo.tipo_prestamo,
        fecha_emision: prestamo.fecha_emision,
        fecha_vencimiento: prestamo.fecha_vencimiento,
        dia_vencimiento_mes: estadoMora.fechaCuotaActual,
        dias_restantes: estadoMora.diasRestantes,
        cuota_actual: estadoMora.montoCuotaActual,
        cuota_exigible: estadoMora.montoCuotaActual,
        cuota_pagado: totalPagadoMesActual,
        cuota_numero: 1,
        total_cuotas: 1,
        cuotas_debiendo: estadoMora.cuotasAtrasadas,
        estado_pago_mes: estadoPagoMes,
        saldo_pendiente: estadoMora.saldoPendiente,
        dias_atraso: estadoMora.diasAtraso
      });
    }

    // 2. Procesar Alquileres Activos (Inquilinos en Inicio)
    for (const alquiler of alquileres) {
      const cliente = clientes.find(c => c.id === alquiler.cliente_id);
      const pagosDelAlquiler = pagosAlquiler.filter(p => p.alquiler_id === alquiler.id);
      const estadoAlq = buildAlquilerSchedule(alquiler, pagosDelAlquiler, now);

      const mesSig = estadoAlq.mesSiguiente;
      const mesesAtrasados = estadoAlq.mesesAtrasados;

      let estadoPagoMes: 'atrasado' | 'pendiente' | 'pagado' | 'estancado' = 'pendiente';
      if (mesesAtrasados >= 3) {
        estadoPagoMes = 'estancado';
      } else if (mesesAtrasados > 0) {
        estadoPagoMes = 'atrasado';
      } else if (!mesSig || mesSig.estado === 'Saldada') {
        estadoPagoMes = 'pagado';
      } else {
        estadoPagoMes = 'pendiente';
      }

      const diaVencStr = mesSig ? mesSig.fechaVencimiento : alquiler.fecha_inicio;
      const diasRestantesAlq = estadoAlq.diasRestantesProximoCobro;

      deudoresDelMes.push({
        prestamo_id: alquiler.id,
        cliente_id: alquiler.cliente_id,
        cliente_nombre: cliente?.nombre_completo || "Inquilino Desconocido",
        cliente_apodo: cliente?.apodo || "",
        cliente_telefono: cliente?.telefono || "",
        score: cliente?.score || null,
        es_alquiler: true,
        descripcion_inmueble: alquiler.descripcion_inmueble || "Alquiler Inmueble",
        monto_capital: toNumber(alquiler.monto_mensual),
        tasa_interes_porcentaje: 0,
        tipo_prestamo: "Alquiler de Inmueble",
        fecha_emision: alquiler.fecha_inicio,
        fecha_vencimiento: alquiler.fecha_fin || "",
        dia_vencimiento_mes: diaVencStr,
        dias_restantes: diasRestantesAlq,
        cuota_actual: toNumber(alquiler.monto_mensual),
        cuota_exigible: mesSig ? mesSig.saldoPendiente : toNumber(alquiler.monto_mensual),
        cuota_pagado: mesSig ? mesSig.montoPagado : 0,
        cuota_numero: mesSig ? mesSig.numero : 1,
        total_cuotas: estadoAlq.mesesGenerados.length,
        cuotas_debiendo: mesesAtrasados,
        estado_pago_mes: estadoPagoMes,
        saldo_pendiente: estadoAlq.totalPendiente,
        dias_atraso: mesSig ? mesSig.diasVencidos : 0
      });
    }

    // Ordenar deudores: 1° atrasado, 2° estancado, 3° pendiente, 4° pagado
    const ordenEstado = { atrasado: 1, estancado: 2, pendiente: 3, pagado: 4 };
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
        totalCobradoEsteMes,
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
