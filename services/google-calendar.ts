import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, toNumber } from "../src/lib/loanLogic.js";
import { buildAlquilerSchedule } from "../src/lib/alquilerLogic.js";
import {
  getGoogleDriveAccessToken,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken
} from "./google-drive.js";

export function isGoogleCalendarConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

export function getGoogleCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

export const getGoogleAccessToken = getGoogleDriveAccessToken;

/**
 * Reintentos con backoff exponencial para llamadas a APIs de Google (Tarea 10.1.7)
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      const status = err.status || err.statusCode;
      if (status !== 429 && status !== 503 && !err.message?.includes("timeout")) {
        throw err;
      }
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Máximo de reintentos alcanzado");
}

export async function findGoogleCalendarEvent(clienteNombre: string, cuotaNumero: number): Promise<string | null> {
  try {
    const accessToken = await getGoogleAccessToken();
    const calendarId = getGoogleCalendarId();
    const query = encodeURIComponent(clienteNombre);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?q=${query}&singleEvents=true`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      const found = (data.items || []).find((item: any) => {
        const sum = item.summary || "";
        return sum.includes(`Cuota ${cuotaNumero}`) && sum.includes(clienteNombre);
      });
      return found ? found.id : null;
    }
  } catch (err: any) {
    console.error("Error al buscar evento en Google Calendar:", err.message);
  }
  return null;
}

export async function createOrUpdateGoogleCalendarEvent({
  eventId,
  summary,
  description,
  dateStr,
  colorId,
}: {
  eventId?: string;
  summary: string;
  description: string;
  dateStr: string;
  colorId?: string;
}) {
  return withRetry(async () => {
    const accessToken = await getGoogleAccessToken();
    const calendarId = getGoogleCalendarId();
    const url = eventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const method = eventId ? "PUT" : "POST";

    const eventBody = {
      summary,
      description,
      start: { date: dateStr },
      end: { date: dateStr },
      ...(colorId ? { colorId } : {})
    };

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventBody)
    });

    if (!response.ok) {
      if (method === "PUT" && response.status === 404) {
        console.warn(`Evento ${eventId} no encontrado. Intentando crear uno nuevo...`);
        const postUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
        const postResponse = await fetch(postUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(eventBody)
        });
        if (postResponse.ok) {
          return await postResponse.json();
        }
        const postErrText = await postResponse.text();
        throw new Error(`Error en Google Calendar API al recrear: ${postErrText}`);
      }
      const errText = await response.text();
      throw new Error(`Error en Google Calendar API: ${errText}`);
    }

    return await response.json();
  });
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  return withRetry(async () => {
    const accessToken = await getGoogleAccessToken();
    const calendarId = getGoogleCalendarId();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 404) {
      const errText = await response.text();
      console.error(`Error de Google Calendar API al eliminar event ${eventId}: ${errText}`);
    }
  });
}

export async function syncLoanScheduleToGoogleCalendar(prestamoId: string) {
  if (!isGoogleCalendarConfigured()) {
    console.warn("Google Calendar no está configurado. Omitiendo sincronización.");
    return;
  }

  try {
    const { data: prestamo, error: pErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .single();

    if (pErr || !prestamo) throw pErr || new Error("Préstamo no encontrado");

    const [cRes, aRes, ajRes] = await Promise.all([
      supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single(),
      supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
      supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
    ]);

    const cliente = cRes.data;
    const pagosRealizados = aRes.data || [];
    const ajustes = ajRes.data || [];

    if (!cliente) throw new Error("Cliente no encontrado para el préstamo");

    const debtState = buildPaymentSchedule(prestamo, pagosRealizados, { ajustes, referenceDate: new Date() });
    const cuotas = debtState.cuotas;

    const existingEvents = Array.isArray(prestamo.google_calendar_events)
      ? prestamo.google_calendar_events
      : [];

    const updatedEvents = [];

    for (const cuota of cuotas) {
      const existing = existingEvents.find((e: any) => e.numero === cuota.numero);
      let eventId = existing?.eventId;

      // Si la cuota ya fue saldada, eliminar el evento pendiente de Calendar (Tarea 10.1.4)
      if (cuota.estado === "Saldada") {
        if (eventId) {
          await deleteGoogleCalendarEvent(eventId).catch(() => {});
        }
        continue;
      }

      if (!eventId) {
        eventId = await findGoogleCalendarEvent(cliente.nombre_completo, cuota.numero);
      }

      const colorId = cuota.estado === "Vencida" ? "11" : "5";
      const statusPrefix = cuota.estado === "Vencida" ? "[VENCIDO]" : cuota.estado === "Parcial" ? "[PARCIAL]" : "[PENDIENTE]";

      const summary = `${statusPrefix} Cuota ${cuota.numero} - ${cliente.nombre_completo}`;
      const description = [
        `ESTADO DEL CRÉDITO:`,
        `Cliente: ${cliente.nombre_completo}`,
        `Teléfono: ${cliente.telefono || "No registrado"}`,
        `Tipo de Préstamo: ${prestamo.tipo_prestamo || "Personal"}`,
        `N° de Cuota: ${cuota.numero} de ${debtState.resumen.totalCuotas}`,
        `Monto de la Cuota: S/. ${cuota.montoExigible.toFixed(2)}`,
        `Capital de Cuota: S/. ${cuota.capitalPendiente.toFixed(2)}`,
        cuota.interesOriginal ? `Interés de Cuota: S/. ${cuota.interesOriginal.toFixed(2)}` : null,
        `Total Pagado: S/. ${cuota.pagado.toFixed(2)}`,
        `Saldo Pendiente: S/. ${cuota.saldoPendiente.toFixed(2)}`,
        `Fecha de Vencimiento: ${cuota.fechaVencimiento}`,
        `\nRegistro actualizado desde PrestaFacilito.`
      ].filter(Boolean).join("\n");

      try {
        const calEvent = await createOrUpdateGoogleCalendarEvent({
          eventId,
          summary,
          description,
          dateStr: cuota.fechaVencimiento,
          colorId
        });

        updatedEvents.push({
          numero: cuota.numero,
          eventId: calEvent.id,
          fechaVencimiento: cuota.fechaVencimiento
        });
      } catch (calErr: any) {
        console.error(`Error al registrar cuota ${cuota.numero} en Google Calendar:`, calErr);
        if (existing) {
          updatedEvents.push(existing);
        }
      }
    }

    await supabase
      .from("prestamos")
      .update({ google_calendar_events: updatedEvents })
      .eq("id", prestamoId);

  } catch (err: any) {
    console.error("Error en syncLoanScheduleToGoogleCalendar:", err);
  }
}

/**
 * Sincronización de contratos de alquiler a Google Calendar (Tarea 10.1.5)
 */
export async function syncAlquilerToGoogleCalendar(alquilerId: string) {
  if (!isGoogleCalendarConfigured()) return;

  try {
    const [alqRes, pagosRes] = await Promise.all([
      supabase.from("alquileres").select("*").eq("id", alquilerId).single(),
      supabase.from("pagos_alquiler").select("*").eq("alquiler_id", alquilerId)
    ]);

    if (!alqRes.data) return;

    const alquiler = alqRes.data;
    const pagos = pagosRes.data || [];

    const { data: cliente } = await supabase
      .from("clientes")
      .select("nombre_completo, telefono")
      .eq("id", alquiler.cliente_id)
      .single();

    const schedule = buildAlquilerSchedule(alquiler, pagos);

    if (schedule.mesSiguiente) {
      const summary = `🏠 Alquiler (${alquiler.descripcion_inmueble}) — ${cliente?.nombre_completo || "Inquilino"} — S/ ${alquiler.monto_mensual.toFixed(2)}`;
      const description = `Pago de Renta Mensual:\nInmueble: ${alquiler.descripcion_inmueble}\nInquilino: ${cliente?.nombre_completo}\nMonto: S/ ${alquiler.monto_mensual.toFixed(2)}`;

      await createOrUpdateGoogleCalendarEvent({
        summary,
        description,
        dateStr: schedule.mesSiguiente.fechaVencimiento,
        colorId: "6"
      });
    }
  } catch (err: any) {
    console.error("Error en syncAlquilerToGoogleCalendar:", err);
  }
}

export async function logPaymentToGoogleCalendar(
  cliente: any,
  prestamo: any,
  monto: number,
  metodoPago: string,
  clasificacion: string,
  fechaPago: string
) {
  if (!isGoogleCalendarConfigured()) return;

  try {
    const summary = `Cobro Recibido: S/. ${monto.toFixed(2)} - ${cliente.nombre_completo}`;
    const description = [
      `REGISTRO DE COBRO RECIBIDO:`,
      `Cliente: ${cliente.nombre_completo}`,
      `Teléfono: ${cliente.telefono || "No registrado"}`,
      `Monto Recibido: S/. ${monto.toFixed(2)}`,
      `Método de Pago: ${metodoPago}`,
      `Tipo de Movimiento: ${clasificacion}`,
      `Préstamo de Capital: S/. ${toNumber(prestamo.monto_capital).toFixed(2)}`,
      `Fecha del Pago: ${fechaPago}`,
      `\nRegistro creado automáticamente desde PrestaFacilito.`
    ].join("\n");

    await createOrUpdateGoogleCalendarEvent({
      summary,
      description,
      dateStr: fechaPago,
      colorId: "2"
    });
  } catch (err: any) {
    console.error("Error al registrar cobro en Google Calendar:", err);
  }
}
