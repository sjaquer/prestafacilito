import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, toNumber, round2 } from "../src/lib/loanLogic.js";
import { proximoCobroAlquiler, proximoCobroPrestamo } from "../src/lib/proximoCobro.js";
import { buildAlquilerSchedule } from "../src/lib/alquilerLogic.js";

const router = express.Router();

// Endpoint optimizado para el Centro de Control / Inicio
/** Fecha de hoy (YYYY-MM-DD) en hora de Lima, independiente de la zona horaria del servidor. */
const hoyLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

/**
 * Cobros pendientes para la pantalla de Inicio: un item por préstamo o alquiler vigente
 * (los liquidados no aparecen). Los montos salen de la lógica de préstamos/alquileres;
 * aquí solo se resumen para la vista.
 */
router.get("/home", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const hoy = hoyLima();
    const referencia = new Date(`${hoy}T12:00:00`);

    const [pRes, aRes, cRes, ajRes, alqRes, pagosAlqRes] = await Promise.all([
      supabase.from("prestamos").select("*").in("estado", ["activo", "estancado"]),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("id, nombre_completo, apodo, telefono, score"),
      supabase.from("ajustes_prestamo").select("*").eq("activo", true),
      supabase.from("alquileres").select("*").eq("estado", "activo"),
      supabase.from("pagos_alquiler").select("*"),
    ]);
    for (const r of [pRes, aRes, cRes, ajRes, alqRes, pagosAlqRes]) if (r.error) throw r.error;

    const amortizaciones = aRes.data || [];
    const pagosAlquiler = pagosAlqRes.data || [];
    const clientePorId = new Map((cRes.data || []).map((c) => [c.id, c]));

    // Dinero recibido (por fecha de pago) hoy y en el mes, préstamos + alquileres, en hora de Lima
    const cobros = [...amortizaciones, ...pagosAlquiler].map((p) => ({ fecha: String(p.fecha_pago || "").slice(0, 10), monto: toNumber(p.monto) }));
    const totalCobradoHoy = round2(cobros.filter((p) => p.fecha === hoy).reduce((s, p) => s + p.monto, 0));
    const totalCobradoEsteMes = round2(cobros.filter((p) => p.fecha.startsWith(hoy.slice(0, 7))).reduce((s, p) => s + p.monto, 0));

    const ultimoPago = (pagos: any[]) =>
      pagos.reduce((max: string | null, p) => (!max || String(p.fecha_pago) > max ? String(p.fecha_pago).slice(0, 10) : max), null);

    const items: any[] = [];

    for (const prestamo of pRes.data || []) {
      const pagos = amortizaciones.filter((a) => a.prestamo_id === prestamo.id);
      const ajustes = (ajRes.data || []).filter((a) => a.prestamo_id === prestamo.id);
      const deuda = buildPaymentSchedule(prestamo, pagos, { ajustes, referenceDate: referencia });
      const prox = proximoCobroPrestamo(deuda, prestamo.fecha_emision, hoy);
      if (prox.liquidado) continue;

      const cliente = clientePorId.get(prestamo.cliente_id);
      const tasa = toNumber(prestamo.tasa_interes_porcentaje);
      const { resumen } = deuda;
      items.push({
        id: prestamo.id,
        es_alquiler: false,
        cliente_id: prestamo.cliente_id,
        cliente_nombre: cliente?.nombre_completo || "Cliente desconocido",
        cliente_apodo: cliente?.apodo || "",
        cliente_telefono: cliente?.telefono || "",
        score: cliente?.score || null,
        tipo: prestamo.tipo_prestamo || "Personal",
        monto_original: toNumber(prestamo.monto_capital),
        tasa,
        capital_restante: resumen.capitalPendiente,
        // Interés del próximo mes (respeta congelamientos); si aún no está en el cronograma, sobre el capital restante
        interes_mes: prox.cuota?.interesOriginal ?? round2((resumen.capitalPendiente * tasa) / 100),
        proximo_cobro: prox.fecha,
        // Lo que debe pagar en esa fecha para quedar al día (interés del mes + lo atrasado)
        monto_proximo: prox.cuota ? prox.cuota.montoCuotaBase : round2(resumen.moraAcumulada + resumen.interesPendiente),
        atrasado: prox.atrasado ? resumen.moraAcumulada : 0,
        cuotas_atrasadas: prox.cuotasAtrasadas,
        debe_desde: prox.debeDesde,
        saldo_pendiente: resumen.saldoPendiente,
        ultimo_pago_fecha: ultimoPago(pagos),
      });
    }

    for (const alquiler of alqRes.data || []) {
      const pagos = pagosAlquiler.filter((p) => p.alquiler_id === alquiler.id);
      const estado = buildAlquilerSchedule(alquiler, pagos, referencia);
      const prox = proximoCobroAlquiler(estado, hoy, alquiler.fecha_fin);
      if (!prox.fecha && prox.atrasado <= 0) continue;

      const cliente = clientePorId.get(alquiler.cliente_id);
      const renta = toNumber(alquiler.monto_mensual);
      items.push({
        id: alquiler.id,
        es_alquiler: true,
        cliente_id: alquiler.cliente_id,
        cliente_nombre: cliente?.nombre_completo || "Inquilino desconocido",
        cliente_apodo: cliente?.apodo || "",
        cliente_telefono: cliente?.telefono || "",
        score: cliente?.score || null,
        tipo: "Alquiler",
        descripcion_inmueble: alquiler.descripcion_inmueble || "Inmueble",
        renta_mensual: renta,
        proximo_cobro: prox.fecha,
        monto_proximo: round2((prox.mes ? prox.mes.saldoPendiente : renta) + prox.atrasado),
        atrasado: prox.atrasado,
        cuotas_atrasadas: prox.mesesAtrasados,
        debe_desde: prox.debeDesde,
        saldo_pendiente: estado.totalPendiente,
        ultimo_pago_fecha: ultimoPago(pagos),
      });
    }

    res.json({ items, resumen: { totalCobradoHoy, totalCobradoEsteMes } });
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

// Endpoint para Flujo de Llegada de Dinero por Cuenta
router.get("/llegada-cuentas", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const [aRes, paRes, pRes, alqRes, cRes] = await Promise.all([
      supabase.from("amortizaciones").select("*").order("fecha_pago", { ascending: false }),
      supabase.from("pagos_alquiler").select("*").order("fecha_pago", { ascending: false }),
      supabase.from("prestamos").select("id, cliente_id, tipo_prestamo"),
      supabase.from("alquileres").select("id, cliente_id, descripcion_inmueble"),
      supabase.from("clientes").select("id, nombre_completo, apodo")
    ]);

    if (aRes.error) throw aRes.error;
    if (paRes.error) throw paRes.error;

    const amortizaciones = aRes.data || [];
    const pagosAlquiler = paRes.data || [];
    const prestamos = pRes.data || [];
    const alquileres = alqRes.data || [];
    const clientes = cRes.data || [];

    const allPayments: any[] = [];

    for (const a of amortizaciones) {
      const pr = prestamos.find(p => p.id === a.prestamo_id);
      const cl = clientes.find(c => c.id === (pr ? pr.cliente_id : a.cliente_id));
      allPayments.push({
        id: a.id,
        fecha_pago: a.fecha_pago,
        monto: toNumber(a.monto),
        metodo_pago: a.metodo_pago || "Efectivo",
        cliente_nombre: cl?.nombre_completo || "Cliente Desconocido",
        cliente_apodo: cl?.apodo || "",
        tipo_operacion: "prestamo",
        ref_id: a.prestamo_id,
        detalle: `Abono Préstamo (${pr?.tipo_prestamo || 'General'})`,
        comprobante_url: a.comprobante_url
      });
    }

    for (const pa of pagosAlquiler) {
      const alq = alquileres.find(al => al.id === pa.alquiler_id);
      const cl = clientes.find(c => c.id === (alq ? alq.cliente_id : pa.cliente_id));
      allPayments.push({
        id: pa.id,
        fecha_pago: pa.fecha_pago,
        monto: toNumber(pa.monto),
        metodo_pago: pa.metodo_pago || "Efectivo",
        cliente_nombre: cl?.nombre_completo || "Inquilino Desconocido",
        cliente_apodo: cl?.apodo || "",
        tipo_operacion: "alquiler",
        ref_id: pa.alquiler_id,
        detalle: `Renta (${alq?.descripcion_inmueble || 'Alquiler'})`,
        comprobante_url: pa.comprobante_url
      });
    }

    allPayments.sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime());

    res.json({
      allPayments,
      meta: {
        totalIngresosHistorial: round2(allPayments.reduce((sum, p) => sum + p.monto, 0)),
        countTotal: allPayments.length
      }
    });
  } catch (err: any) {
    console.error("Error al obtener llegada a cuentas:", err);
    res.status(500).json({ error: "Error en el servidor", detail: err.message });
  }
});

export default router;
