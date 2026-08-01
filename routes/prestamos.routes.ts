import express from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, classifyPayment, toNumber } from "../src/lib/loanLogic.js";
import { syncLoanScheduleToGoogleCalendar, logPaymentToGoogleCalendar } from "../services/google-calendar.js";
import { isDriveConfigured, uploadVoucherToDrive } from "../services/google-drive.js";

export const prestamosRouter = express.Router();
export const amortizacionesRouter = express.Router();

// ── RUTAS DE PRÉSTAMOS ─────────────────────────────────────

// Registrar préstamo
prestamosRouter.post("/", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { cliente_id, monto_capital, tasa_interes_porcentaje, fecha_emision, fecha_vencimiento, tipo_prestamo } = req.body;

    if (!cliente_id || !monto_capital) {
      res.status(400).json({ error: "El cliente y el monto capital son obligatorios." });
      return;
    }

    const nuevoPrestamo = {
      cliente_id,
      monto_capital: parseFloat(monto_capital),
      tasa_interes_porcentaje: parseFloat(tasa_interes_porcentaje) || 0,
      fecha_emision: fecha_emision || new Date().toISOString().split("T")[0],
      fecha_vencimiento: fecha_vencimiento || null,
      estado: "activo",
      tipo_prestamo: tipo_prestamo || "Personal"
    };

    const { data, error } = await supabase
      .from("prestamos")
      .insert(nuevoPrestamo)
      .select()
      .single();

    if (error) throw error;

    syncLoanScheduleToGoogleCalendar(data.id).catch((calErr) => {
      console.error("Error al sincronizar préstamo en Google Calendar:", calErr);
    });

    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al crear préstamo:", err);
    res.status(500).json({ error: "Error al crear préstamo", detail: err.message });
  }
});

// Listar préstamos
prestamosRouter.get("/", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const [pRes, cRes, ajRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("ajustes_prestamo").select("*").eq("activo", true)
    ]);

    if (pRes.error) throw pRes.error;
    if (cRes.error) throw cRes.error;
    if (ajRes.error) throw ajRes.error;

    const prestamos = pRes.data || [];
    const clientes = cRes.data || [];
    const ajustes = ajRes.data || [];

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

    res.json(prestamosConCliente);
  } catch (err: any) {
    console.error("Error al obtener lista de préstamos:", err);
    res.status(500).json({ error: "Error en el servidor", detail: err.message });
  }
});

// Autoseleccionar préstamo
prestamosRouter.post("/autoseleccionar", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { cliente_id, monto, fecha_pago } = req.body;

    if (!cliente_id || !monto) {
      res.status(400).json({ error: "El cliente y el monto son obligatorios." });
      return;
    }

    const montoPago = toNumber(monto);
    const [prestamosRes, amortRes, ajustesRes] = await Promise.all([
      supabase.from("prestamos").select("*").eq("cliente_id", cliente_id).eq("estado", "activo"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("ajustes_prestamo").select("*")
    ]);

    if (prestamosRes.error) throw prestamosRes.error;
    if (amortRes.error) throw amortRes.error;
    if (ajustesRes.error) throw ajustesRes.error;

    const prestamosActivos = prestamosRes.data || [];
    const amortizaciones = amortRes.data || [];
    const todosAjustes = ajustesRes.data || [];
    const candidatos = prestamosActivos.map((prestamo) => {
      const pagosDelPrestamo = amortizaciones.filter((pago) => pago.prestamo_id === prestamo.id);
      const ajustesDelPrestamo = todosAjustes.filter((aj) => aj.prestamo_id === prestamo.id);
      const debtState = buildPaymentSchedule(prestamo, pagosDelPrestamo, { ajustes: ajustesDelPrestamo, referenceDate: new Date(fecha_pago || new Date()) });
      const cuotaSiguiente = debtState.cuotaSiguiente;
      const diferenciaCuota = cuotaSiguiente ? Math.abs(montoPago - cuotaSiguiente.montoExigible) : Math.abs(montoPago - debtState.resumen.totalExigible);
      const scoreBase = Math.max(0, 100 - Math.round(diferenciaCuota));
      const scoreMorosidad = debtState.resumen.cuotasVencidas > 0 ? 12 : 0;
      const scoreExactitud = cuotaSiguiente && Math.abs(montoPago - cuotaSiguiente.montoExigible) <= 0.01 ? 15 : 0;
      const scoreLiquidacion = montoPago >= debtState.resumen.totalExigible - 0.01 ? 20 : 0;

      return {
        prestamo_id: prestamo.id,
        cliente_id: prestamo.cliente_id,
        cliente_nombre: prestamo.cliente_nombre || cliente_id,
        tipo_prestamo: prestamo.tipo_prestamo,
        monto_capital: toNumber(prestamo.monto_capital),
        fecha_emision: prestamo.fecha_emision,
        fecha_vencimiento: prestamo.fecha_vencimiento,
        deuda: debtState.resumen,
        clasificacion_sugerida: classifyPayment(montoPago, debtState),
        score: scoreBase + scoreMorosidad + scoreExactitud + scoreLiquidacion
      };
    }).sort((a, b) => b.score - a.score);

    const mejorCoincidencia = candidatos[0] || null;
    const sugerencias = candidatos.slice(0, 3);

    res.json({
      success: true,
      mejorCoincidencia,
      sugerencias,
      totalCandidatos: candidatos.length
    });
  } catch (err: any) {
    console.error("Error al autoseleccionar préstamo:", err);
    res.status(500).json({ error: "No se pudo autoseleccionar la deuda", detail: err.message });
  }
});

// Detalle de un préstamo
prestamosRouter.get("/:id", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const prestamoId = req.params.id;

    const { data: prestamo, error: pErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .single();

    if (pErr) throw pErr;

    const [cRes, aRes, ajRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single(),
      supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
      supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
    ]);

    const cliente = cRes.data;
    const pagosRealizados = aRes.data || [];
    const ajustes = ajRes.data || [];

    const debtState = buildPaymentSchedule(prestamo, pagosRealizados, { ajustes, referenceDate: new Date() });
    const capital = toNumber(prestamo.monto_capital);
    const tasaInteres = toNumber(prestamo.tasa_interes_porcentaje);
    const totalBaseExigible = capital + (capital * (tasaInteres / 100) * debtState.resumen.totalCuotas);

    res.json({
      prestamo: {
        ...prestamo,
        monto_capital: capital,
        tasa_interes_porcentaje: tasaInteres,
        total_a_pagar: debtState.resumen.totalExigible,
        total_a_pagar_base: totalBaseExigible,
        total_exigible_actual: debtState.resumen.totalExigible,
        total_pagado: debtState.resumen.totalPagado,
        saldo_pendiente: debtState.resumen.saldoPendiente,
        capital_pendiente: debtState.resumen.capitalPendiente,
        interes_pendiente: debtState.resumen.interesPendiente,
        mora_acumulada: debtState.resumen.moraAcumulada,
        cuotas_totales: debtState.resumen.totalCuotas,
        cuotas_pendientes: debtState.resumen.cuotasPendientes,
        cuotas_vencidas: debtState.resumen.cuotasVencidas,
        cliente_nombre: cliente ? cliente.nombre_completo : "Cliente desconocido",
        cliente_telefono: cliente ? cliente.telefono : ""
      },
      pagosRealizados,
      ajustes,
      planAyuda: debtState.planAyuda,
      deuda: debtState.resumen,
      cuotas: debtState.cuotas,
      cuota_siguiente: debtState.cuotaSiguiente,
      cuotas_vencidas_detalle: debtState.cuotasVencidasDetalle
    });
  } catch (err: any) {
    console.error("Error al cargar detalle de préstamo:", err);
    res.status(500).json({ error: "Error al cargar detalle del préstamo", detail: err.message });
  }
});

// Editar préstamo
prestamosRouter.put("/:id", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const prestamoId = req.params.id;
    const { fecha_emision, fecha_vencimiento, monto_capital, tasa_interes_porcentaje, notas } = req.body;

    const updatePayload: any = {
      fecha_emision,
      fecha_vencimiento
    };

    if (monto_capital !== undefined) updatePayload.monto_capital = toNumber(monto_capital);
    if (tasa_interes_porcentaje !== undefined) updatePayload.tasa_interes_porcentaje = toNumber(tasa_interes_porcentaje);
    if (notas !== undefined) updatePayload.notas = notas;

    const { data: updated, error } = await supabase
      .from("prestamos")
      .update(updatePayload)
      .eq("id", prestamoId)
      .select()
      .single();

    if (error) throw error;

    syncLoanScheduleToGoogleCalendar(prestamoId).catch((calErr) => {
      console.error("Error al reprogramar préstamo en Google Calendar:", calErr);
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Error al actualizar préstamo:", err);
    res.status(500).json({ error: "Error al actualizar préstamo", detail: err.message });
  }
});

// Eliminar préstamo
prestamosRouter.delete("/:id", requireAuth, async (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    error: "El borrado de préstamos está deshabilitado. Solo se permite editar fechas y registrar pagos."
  });
});

// Registrar pago / abono
prestamosRouter.post("/:id/pagos", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const prestamoId = req.params.id;
    const { monto, tipo_movimiento, metodo_pago, fecha_pago, comprobante_url } = req.body;

    const montoPago = parseFloat(monto);
    if (!montoPago || montoPago <= 0) {
      res.status(400).json({ error: "El monto del pago debe ser mayor a 0." });
      return;
    }

    const { data: prestamo, error: pErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .single();

    if (pErr) throw pErr;

    const [aRes, ajRes] = await Promise.all([
      supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
      supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
    ]);

    if (aRes.error) throw aRes.error;
    if (ajRes.error) throw ajRes.error;

    const pagosAnteriores = aRes.data || [];
    const ajustes = ajRes.data || [];
    const deudaAntes = buildPaymentSchedule(prestamo, pagosAnteriores, { ajustes, referenceDate: new Date(fecha_pago || new Date()) });

    const referenceDate = new Date();
    const fechaPagoDate = new Date(fecha_pago || new Date());
    const queryDate = fechaPagoDate.getTime() > referenceDate.getTime() ? fechaPagoDate : referenceDate;
    const deudaValidacion = buildPaymentSchedule(prestamo, pagosAnteriores, { ajustes, referenceDate: queryDate });

    if (montoPago > deudaValidacion.resumen.saldoPendiente + 0.01) {
      res.status(400).json({ error: `El monto del pago excede el saldo pendiente actual (S/. ${deudaValidacion.resumen.saldoPendiente.toFixed(2)})` });
      return;
    }

    const clasificacionAutomatica = classifyPayment(montoPago, deudaAntes, fecha_pago);
    const excedenteAplicado = Math.max(0, montoPago - deudaAntes.resumen.totalExigible);

    const validTypes = [
      "Liquidación total",
      "Pago exacto de cuota",
      "Amortización parcial",
      "Pago adelantado / múltiple",
      "Pago adelantado",
      "Amortización de Capital",
      "Amortizacion de Capital",
      "Liquidación Express",
      "Liquidacion Express"
    ];
    const tipoMovimientoFinal = (tipo_movimiento && validTypes.includes(tipo_movimiento))
      ? tipo_movimiento
      : clasificacionAutomatica;

    const nuevaAmortizacion = {
      prestamo_id: prestamoId,
      tipo_movimiento: tipoMovimientoFinal,
      monto: montoPago,
      fecha_pago: fecha_pago || new Date().toISOString().split("T")[0],
      metodo_pago: metodo_pago || "Efectivo",
      comprobante_url: comprobante_url || null
    };

    const { data: insertedAmort, error: insertErr } = await supabase
      .from("amortizaciones")
      .insert(nuevaAmortizacion)
      .select()
      .single();

    if (insertErr) throw insertErr;

    const pagosActualizados = [...pagosAnteriores, insertedAmort];
    const deudaDespues = buildPaymentSchedule(prestamo, pagosActualizados, { ajustes, referenceDate: new Date(fecha_pago || new Date()) });
    let nuevoEstado = prestamo.estado;

    if (deudaDespues.resumen.saldoPendiente <= 0.01) {
      nuevoEstado = "pagado";
      await supabase
        .from("prestamos")
        .update({ estado: "pagado" })
        .eq("id", prestamoId);
    }

    const { data: cliente } = await supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single();

    syncLoanScheduleToGoogleCalendar(prestamoId).catch((calErr) => {
      console.error("Error al sincronizar cuotas tras pago en Google Calendar:", calErr);
    });

    if (cliente) {
      logPaymentToGoogleCalendar(
        cliente,
        prestamo,
        montoPago,
        metodo_pago || "Efectivo",
        clasificacionAutomatica,
        fecha_pago || new Date().toISOString().split("T")[0]
      ).catch((calErr) => {
        console.error("Error al registrar abono en Google Calendar:", calErr);
      });
    }

    res.status(201).json({
      success: true,
      nuevaAmortizacion: insertedAmort,
      clasificacion_automatica: clasificacionAutomatica,
      excedente_aplicado: excedenteAplicado,
      saldo_pendiente: deudaDespues.resumen.saldoPendiente,
      estado_prestamo: nuevoEstado,
      deuda_actualizada: deudaDespues.resumen,
      cuotas_actualizadas: deudaDespues.cuotas
    });
  } catch (err: any) {
    console.error("Error al registrar pago:", err);
    res.status(500).json({ error: "Error al registrar abono/pago", detail: err.message });
  }
});

// Ajustes endpoints
prestamosRouter.get("/:id/ajustes", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const prestamoId = req.params.id;
    const { data, error } = await supabase
      .from("ajustes_prestamo")
      .select("*")
      .eq("prestamo_id", prestamoId)
      .order("fecha_registro", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error("Error al obtener ajustes:", err);
    res.status(500).json({ error: "Error al obtener ajustes", detail: err.message });
  }
});

prestamosRouter.post("/:id/ajustes", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const prestamoId = req.params.id;
    const {
      tipo,
      monto_afectado,
      monto_antes,
      monto_despues,
      cuota_numero,
      fecha_inicio,
      fecha_fin,
      periodo_gracia_dias,
      descripcion,
      motivo
    } = req.body;

    const username = req.user?.username || "sistema";

    const { data: newAdj, error } = await supabase
      .from("ajustes_prestamo")
      .insert({
        prestamo_id: prestamoId,
        tipo,
        monto_afectado: toNumber(monto_afectado),
        monto_antes: toNumber(monto_antes),
        monto_despues: toNumber(monto_despues),
        cuota_numero: cuota_numero ? parseInt(cuota_numero) : null,
        fecha_inicio: fecha_inicio || new Date().toISOString().split("T")[0],
        fecha_fin: fecha_fin || null,
        periodo_gracia_dias: periodo_gracia_dias ? parseInt(periodo_gracia_dias) : 0,
        descripcion: descripcion || "",
        usuario: username,
        motivo: motivo || ""
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newAdj);
  } catch (err: any) {
    console.error("Error al crear ajuste:", err);
    res.status(500).json({ error: "Error al aplicar el ajuste", detail: err.message });
  }
});

prestamosRouter.patch("/:id/ajustes/:ajusteId", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { ajusteId } = req.params;
    const { activo } = req.body;

    const { data: updatedAdj, error } = await supabase
      .from("ajustes_prestamo")
      .update({ activo })
      .eq("id", ajusteId)
      .select()
      .single();

    if (error) throw error;
    res.json(updatedAdj);
  } catch (err: any) {
    console.error("Error al actualizar ajuste:", err);
    res.status(500).json({ error: "Error al modificar el estado del ajuste", detail: err.message });
  }
});

// ── RUTAS DE AMORTIZACIONES ─────────────────────────────────

amortizacionesRouter.get("/", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const [aRes, pRes, cRes] = await Promise.all([
      supabase.from("amortizaciones").select("*").order("fecha_pago", { ascending: false }),
      supabase.from("prestamos").select("*"),
      supabase.from("clientes").select("*")
    ]);
    if (aRes.error) throw aRes.error;
    if (pRes.error) throw pRes.error;
    if (cRes.error) throw cRes.error;

    const amortizaciones = aRes.data || [];
    const prestamos = pRes.data || [];
    const clientes = cRes.data || [];

    const detailed = amortizaciones.map(a => {
      const prestamo = prestamos.find(p => p.id === a.prestamo_id);
      const cliente = prestamo ? clientes.find(c => c.id === prestamo.cliente_id) : null;
      return {
        ...a,
        cliente_id: cliente ? cliente.id : null,
        cliente_nombre: cliente ? cliente.nombre_completo : "Desconocido",
        cliente_telefono: cliente ? cliente.telefono : "",
        tipo_prestamo: prestamo ? prestamo.tipo_prestamo : "Personal",
        monto_capital: prestamo ? prestamo.monto_capital : 0
      };
    });

    res.json(detailed);
  } catch (err: any) {
    console.error("Error al obtener amortizaciones:", err);
    res.status(500).json({ error: "Error al obtener amortizaciones", detail: err.message });
  }
});

amortizacionesRouter.put("/:id", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const amortizacionId = req.params.id;
    const { fecha_pago, prestamo_id, monto, metodo_pago } = req.body;

    const { data: amortizacion, error: amortErr } = await supabase
      .from("amortizaciones")
      .select("*")
      .eq("id", amortizacionId)
      .single();

    if (amortErr || !amortizacion) {
      res.status(404).json({ error: "No se encontró la amortización solicitada o no existe." });
      return;
    }

    const prestamoIdOld = amortizacion.prestamo_id;

    const updateData: any = {};
    if (fecha_pago !== undefined) updateData.fecha_pago = fecha_pago;
    if (prestamo_id !== undefined) updateData.prestamo_id = prestamo_id;
    if (monto !== undefined) updateData.monto = monto;
    if (metodo_pago !== undefined) updateData.metodo_pago = metodo_pago;

    const { data: updatedAmort, error: updateErr } = await supabase
      .from("amortizaciones")
      .update(updateData)
      .eq("id", amortizacionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const prestamoIdsToRecalculate = [prestamoIdOld];
    if (prestamo_id && prestamo_id !== prestamoIdOld) {
      prestamoIdsToRecalculate.push(prestamo_id);
    }

    const recalculateResults: Record<string, any> = {};

    for (const pId of prestamoIdsToRecalculate) {
      const { data: prestamo, error: pErr } = await supabase
        .from("prestamos")
        .select("*")
        .eq("id", pId)
        .single();
      if (pErr) throw pErr;

      const [aRes, ajRes] = await Promise.all([
        supabase.from("amortizaciones").select("*").eq("prestamo_id", pId),
        supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", pId)
      ]);
      if (aRes.error) throw aRes.error;
      if (ajRes.error) throw ajRes.error;

      const pagosActualizados = aRes.data || [];
      const ajustes = ajRes.data || [];

      const deudaDespues = buildPaymentSchedule(prestamo, pagosActualizados, { ajustes, referenceDate: new Date() });

      let nuevoEstado = prestamo.estado;
      if (deudaDespues.resumen.saldoPendiente <= 0.01) {
        nuevoEstado = "pagado";
        await supabase
          .from("prestamos")
          .update({ estado: "pagado" })
          .eq("id", pId);
      } else if (prestamo.estado === "pagado") {
        nuevoEstado = "activo";
        await supabase
          .from("prestamos")
          .update({ estado: "activo" })
          .eq("id", pId);
      }

      syncLoanScheduleToGoogleCalendar(pId).catch((calErr) => {
        console.error(`Error al sincronizar cuotas tras edición de pago para préstamo ${pId} en Google Calendar:`, calErr);
      });

      recalculateResults[pId] = {
        estado_prestamo: nuevoEstado,
        deuda_actualizada: deudaDespues.resumen,
        cuotas_actualizadas: deudaDespues.cuotas
      };
    }

    res.json({
      success: true,
      amortizacion: updatedAmort,
      ...recalculateResults[updatedAmort.prestamo_id]
    });
  } catch (err: any) {
    console.error("Error al editar pago:", err);
    res.status(500).json({ error: "Error al editar pago", detail: err.message });
  }
});

amortizacionesRouter.delete("/:id", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const amortizacionId = req.params.id;

    const { data: amortizacion, error: amortErr } = await supabase
      .from("amortizaciones")
      .select("*")
      .eq("id", amortizacionId)
      .single();

    if (amortErr || !amortizacion) {
      res.status(404).json({ error: "No se encontró la amortización solicitada o no existe." });
      return;
    }

    const prestamoId = amortizacion.prestamo_id;

    const { error: deleteErr } = await supabase
      .from("amortizaciones")
      .delete()
      .eq("id", amortizacionId);

    if (deleteErr) throw deleteErr;

    const { data: prestamo, error: pErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .single();

    if (pErr) throw pErr;

    const [aRes, ajRes] = await Promise.all([
      supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
      supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
    ]);

    if (aRes.error) throw aRes.error;
    if (ajRes.error) throw ajRes.error;

    const pagosActualizados = aRes.data || [];
    const ajustes = ajRes.data || [];

    const deudaDespues = buildPaymentSchedule(prestamo, pagosActualizados, { ajustes, referenceDate: new Date() });

    let nuevoEstado = prestamo.estado;
    if (deudaDespues.resumen.saldoPendiente <= 0.01) {
      nuevoEstado = "pagado";
      await supabase
        .from("prestamos")
        .update({ estado: "pagado" })
        .eq("id", prestamoId);
    } else if (prestamo.estado === "pagado") {
      nuevoEstado = "activo";
      await supabase
        .from("prestamos")
        .update({ estado: "activo" })
        .eq("id", prestamoId);
    }

    syncLoanScheduleToGoogleCalendar(prestamoId).catch((calErr) => {
      console.error(`Error al sincronizar cuotas tras eliminación de pago para préstamo ${prestamoId} en Google Calendar:`, calErr);
    });

    res.json({
      success: true,
      estado_prestamo: nuevoEstado,
      deuda_actualizada: deudaDespues.resumen,
      cuotas_actualizadas: deudaDespues.cuotas
    });
  } catch (err: any) {
    console.error("Error al eliminar pago:", err);
    res.status(500).json({ error: "Error al eliminar el pago", detail: err.message });
  }
});

amortizacionesRouter.post("/:id/voucher", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const amortizacionId = req.params.id;
    const { fileName, mimeType, base64Data } = req.body;

    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: "Datos del comprobante incompletos. Se requieren fileName, mimeType y base64Data." });
      return;
    }

    if (!isDriveConfigured()) {
      res.status(503).json({
        error: "El almacenamiento de comprobantes (Google Drive) no esta configurado en este servidor.",
        detail: "Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el archivo .env.",
        driveConfigured: false
      });
      return;
    }

    const { data: amortizacion, error: amortErr } = await supabase
      .from("amortizaciones")
      .select("*")
      .eq("id", amortizacionId)
      .single();

    if (amortErr || !amortizacion) {
      res.status(404).json({ error: "No se encontro la amortizacion solicitada." });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, "base64");
      if (buffer.length === 0) throw new Error("Buffer vacio");
    } catch {
      res.status(400).json({ error: "El contenido base64 del comprobante es invalido o esta vacio." });
      return;
    }

    let uploaded;
    try {
      uploaded = await uploadVoucherToDrive(fileName, mimeType, buffer);
    } catch (driveErr: any) {
      console.error("Error al subir voucher a Google Drive:", driveErr.message);
      res.status(502).json({
        error: "No se pudo subir el comprobante a Google Drive.",
        detail: driveErr.message,
        driveConfigured: true
      });
      return;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("amortizaciones")
      .update({
        comprobante_url: uploaded.publicUrl,
        voucher_drive_file_id: uploaded.fileId
      })
      .eq("id", amortizacionId)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({
        error: "El comprobante se subio a Drive pero no se pudo guardar la referencia en la base de datos.",
        detail: updateErr.message,
        driveFileId: uploaded.fileId,
        driveUrl: uploaded.publicUrl
      });
      return;
    }

    res.json({
      success: true,
      amortizacion: updated,
      voucher: {
        publicUrl: uploaded.publicUrl,
        directUrl: uploaded.directUrl,
        driveFileId: uploaded.fileId,
        driveWebViewLink: uploaded.webViewLink,
        driveWebContentLink: uploaded.webContentLink
      }
    });
  } catch (err: any) {
    console.error("Error inesperado al adjuntar voucher:", err);
    res.status(500).json({ error: "Error interno al adjuntar el voucher", detail: err.message });
  }
});
