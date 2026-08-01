import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule, toNumber } from "../src/lib/loanLogic.js";
import {
  getGoogleDriveAccessToken,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken
} from "./google-drive.js";

export function isGoogleCalendarConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

export const getGoogleAccessToken = getGoogleDriveAccessToken;

export async function findGoogleCalendarEvent(clienteNombre: string, cuotaNumero: number): Promise<string | null> {
  try {
    const accessToken = await getGoogleAccessToken();
    const query = encodeURIComponent(clienteNombre);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${query}&singleEvents=true`;
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
  const accessToken = await getGoogleAccessToken();
  const url = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const method = eventId ? "PUT" : "POST";

  const eventBody = {
    summary,
    description,
    start: {
      date: dateStr
    },
    end: {
      date: dateStr
    },
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
      console.warn(`Evento ${eventId} no encontrado (404). Intentando crear uno nuevo...`);
      const postUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
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
      console.error(`Error de Google Calendar API al recrear evento: ${postErrText}`);
      throw new Error(`Error en Google Calendar API al recrear: ${postErrText}`);
    }
    const errText = await response.text();
    console.error(`Error de Google Calendar API (event ${eventId || 'new'}): ${errText}`);
    throw new Error(`Error en Google Calendar API: ${errText}`);
  }

  return await response.json();
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  const accessToken = await getGoogleAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

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

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const timestamp = `${todayStr} ${hh}:${min}:${ss}`;

    const updatedEvents = [];

    for (const cuota of cuotas) {
      const existing = existingEvents.find((e: any) => e.numero === cuota.numero);
      let eventId = existing?.eventId;

      const isPast = cuota.fechaVencimiento < todayStr;

      if (isPast) {
        if (!eventId) {
          eventId = await findGoogleCalendarEvent(cliente.nombre_completo, cuota.numero);
        }
        if (eventId) {
          console.log(`Eliminando evento pasado de la cuota ${cuota.numero} (Vencimiento: ${cuota.fechaVencimiento})`);
          await deleteGoogleCalendarEvent(eventId).catch(err =>
            console.error("Error al borrar evento de calendario pasado:", err)
          );
        }
        continue;
      }

      if (!eventId) {
        eventId = await findGoogleCalendarEvent(cliente.nombre_completo, cuota.numero);
      }

      let colorId = "5";
      let statusPrefix = "[PENDIENTE]";

      if (cuota.estado === "Saldada") {
        colorId = "10";
        statusPrefix = "[PAGADO]";
      } else if (cuota.estado === "Parcial") {
        colorId = "6";
        statusPrefix = "[PARCIAL]";
      } else if (cuota.estado === "Vencida") {
        colorId = "11";
        statusPrefix = "[VENCIDO]";
      }

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
        cuota.moraPendiente > 0 ? `Mora Pendiente: S/. ${cuota.moraPendiente.toFixed(2)}` : null,
        `Total Pagado en esta cuota: S/. ${cuota.pagado.toFixed(2)}`,
        `Saldo Pendiente: S/. ${cuota.saldoPendiente.toFixed(2)}`,
        `Fecha de Vencimiento: ${cuota.fechaVencimiento}`,
        `Estado de la Cuota: ${cuota.estado}`,
        `Última actualización de sincronización: ${timestamp}`,
        `\nRegistro actualizado automáticamente desde PrestaFacilito.`
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

    const newCuotasNums = cuotas.map((c: any) => c.numero);
    const toDelete = existingEvents.filter((e: any) => !newCuotasNums.includes(e.numero));
    for (const d of toDelete) {
      if (d.eventId) {
        await deleteGoogleCalendarEvent(d.eventId).catch(err =>
          console.error("Error al borrar evento de calendario sobrante:", err)
        );
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
