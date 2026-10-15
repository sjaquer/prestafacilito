/**
 * Sincronización de cobros con Google Calendar.
 *
 * Modelo: UN evento de día completo por préstamo o alquiler vigente, en su próxima fecha
 * de cobro. Cada evento lleva una marca privada (`extendedProperties.private.ref`), así la
 * sincronización es idempotente: se puede ejecutar muchas veces y solo crea, actualiza o
 * borra lo necesario, sin depender del nombre del cliente ni de columnas en la base.
 *
 * No va al calendario:
 *  - préstamos liquidados o alquileres finalizados,
 *  - préstamos estancados (5+ cuotas atrasadas): se gestionan desde la app,
 *  - registros de pagos recibidos (eso vive en la sección Cuentas).
 */
import { supabase } from "../src/lib/supabase.js";
import { CUOTAS_ESTANCADO, EventoDeseado, eventoAlquiler, eventoPrestamo, hoyLima, sumarDias } from "./calendario-eventos.js";
import {
  getGoogleDriveAccessToken,
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleRefreshToken,
} from "./google-drive.js";

const APP_TAG = "prestafacilito";
export { CUOTAS_ESTANCADO };

export function isGoogleCalendarConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

export const getGoogleCalendarId = () => process.env.GOOGLE_CALENDAR_ID || "primary";

// ── Cliente HTTP mínimo de la API de Calendar ─────────────────────────────

async function calendarFetch(path: string, init: RequestInit = {}, intentos = 3): Promise<any> {
  const accessToken = await getGoogleDriveAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(getGoogleCalendarId())}${path}`;
  for (let intento = 1; ; intento++) {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    if (res.ok) return res.status === 204 ? null : res.json();
    // Ya borrado: no es un error para nosotros
    if (init.method === "DELETE" && (res.status === 404 || res.status === 410)) return null;
    if ((res.status === 429 || res.status >= 500) && intento < intentos) {
      await new Promise((r) => setTimeout(r, 2 ** intento * 500));
      continue;
    }
    throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  }
}

async function listarEventos(params: Record<string, string>): Promise<any[]> {
  const eventos: any[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ singleEvents: "true", maxResults: "250", ...params, ...(pageToken ? { pageToken } : {}) });
    const data = await calendarFetch(`/events?${qs}`);
    eventos.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return eventos;
}

/** Ejecuta tareas con concurrencia limitada (evita el límite de la API y timeouts). */
async function enLotes<T>(items: T[], fn: (item: T) => Promise<unknown>, concurrencia = 5) {
  let errores = 0;
  for (let i = 0; i < items.length; i += concurrencia) {
    const res = await Promise.allSettled(items.slice(i, i + concurrencia).map(fn));
    for (const r of res) {
      if (r.status === "rejected") {
        errores++;
        console.error("[Calendario]", r.reason?.message || r.reason);
      }
    }
  }
  return errores;
}

/** Calcula los eventos que deberían existir. Con `ref`, solo el de ese préstamo/alquiler. */
async function eventosDeseados(ref?: string): Promise<EventoDeseado[]> {
  const hoy = hoyLima();
  const [tipo, id] = ref ? ref.split(":") : [undefined, undefined];
  const resultado: EventoDeseado[] = [];

  if (!tipo || tipo === "prestamo") {
    let q = supabase.from("prestamos").select("*").in("estado", ["activo", "estancado"]);
    if (id) q = q.eq("id", id);
    const { data: prestamos, error } = await q;
    if (error) throw error;
    if (prestamos?.length) {
      const ids = prestamos.map((p) => p.id);
      const [aRes, ajRes, cRes] = await Promise.all([
        supabase.from("amortizaciones").select("*").in("prestamo_id", ids),
        supabase.from("ajustes_prestamo").select("*").in("prestamo_id", ids),
        supabase.from("clientes").select("id, nombre_completo, telefono").in("id", [...new Set(prestamos.map((p) => p.cliente_id))]),
      ]);
      for (const p of prestamos) {
        const ev = eventoPrestamo(
          p,
          cRes.data?.find((c) => c.id === p.cliente_id),
          (aRes.data || []).filter((a) => a.prestamo_id === p.id),
          (ajRes.data || []).filter((a) => a.prestamo_id === p.id),
          hoy
        );
        if (ev) resultado.push(ev);
      }
    }
  }

  if (!tipo || tipo === "alquiler") {
    let q = supabase.from("alquileres").select("*").eq("estado", "activo");
    if (id) q = q.eq("id", id);
    const { data: alquileres, error } = await q;
    if (error) throw error;
    if (alquileres?.length) {
      const ids = alquileres.map((a) => a.id);
      const [pRes, cRes] = await Promise.all([
        supabase.from("pagos_alquiler").select("*").in("alquiler_id", ids),
        supabase.from("clientes").select("id, nombre_completo, telefono").in("id", [...new Set(alquileres.map((a) => a.cliente_id))]),
      ]);
      for (const a of alquileres) {
        const ev = eventoAlquiler(a, cRes.data?.find((c) => c.id === a.cliente_id), (pRes.data || []).filter((p) => p.alquiler_id === a.id), hoy);
        if (ev) resultado.push(ev);
      }
    }
  }

  return resultado;
}

// ── Limpieza de eventos de la versión anterior ────────────────────────────

const PREFIJOS_ANTIGUOS = ["[PENDIENTE]", "[VENCIDO]", "[PARCIAL]", "[PAGADO]", "Cobro Recibido", "🔔 [PENDIENTE]", "✅ [PAGADO]", "🔶 [PARCIAL]", "🚨 [VENCIDO]", "💰 Cobro Recibido"];

/** Eventos creados por versiones anteriores (uno por cuota, cobros recibidos, rentas duplicadas). */
async function eventosAntiguos(): Promise<any[]> {
  const timeMin = new Date(Date.now() - 548 * 86400000).toISOString(); // ~18 meses atrás
  const timeMax = new Date(Date.now() + 730 * 86400000).toISOString(); // ~24 meses adelante
  const porTexto = async (q: string) => listarEventos({ q, timeMin, timeMax });
  const candidatos = [...(await porTexto("PrestaFacilito")), ...(await porTexto("Pago de Renta Mensual"))];
  const vistos = new Set<string>();
  return candidatos.filter((ev) => {
    if (vistos.has(ev.id) || ev.extendedProperties?.private?.app === APP_TAG) return false;
    vistos.add(ev.id);
    const summary = String(ev.summary || "");
    const description = String(ev.description || "");
    return (
      description.includes("PrestaFacilito") ||
      description.startsWith("Pago de Renta Mensual:") ||
      PREFIJOS_ANTIGUOS.some((p) => summary.startsWith(p))
    );
  });
}

// ── Reconciliación ────────────────────────────────────────────────────────

export interface ResultadoSync {
  creados: number;
  actualizados: number;
  eliminados: number;
  antiguosEliminados: number;
  errores: number;
}

const cuerpoEvento = (e: EventoDeseado) => ({
  summary: e.summary,
  description: e.description,
  colorId: e.colorId,
  start: { date: e.fecha },
  end: { date: sumarDias(e.fecha, 1) }, // en Google, el fin de un evento de día completo es exclusivo
  transparency: "transparent", // no bloquea la agenda
  reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 * 60 }] }, // 9:00 a. m. del día anterior
  extendedProperties: { private: { app: APP_TAG, ref: e.ref } },
});

const difiere = (actual: any, deseado: EventoDeseado) =>
  actual.start?.date !== deseado.fecha ||
  actual.summary !== deseado.summary ||
  (actual.description || "") !== deseado.description ||
  actual.colorId !== deseado.colorId;

/**
 * Deja Google Calendar igual a la cartera actual.
 * Sin `ref`: sincronización completa (incluye limpiar eventos antiguos).
 * Con `ref` ("prestamo:<id>" o "alquiler:<id>"): solo ese préstamo/alquiler.
 */
export async function sincronizarCalendario(ref?: string): Promise<ResultadoSync> {
  const resultado: ResultadoSync = { creados: 0, actualizados: 0, eliminados: 0, antiguosEliminados: 0, errores: 0 };
  if (!isGoogleCalendarConfigured()) return resultado;

  const deseados = await eventosDeseados(ref);
  const filtroApp = ref ? `ref=${ref}` : `app=${APP_TAG}`;
  const existentes = await listarEventos({ privateExtendedProperty: filtroApp });

  const porRef = new Map<string, any[]>();
  for (const ev of existentes) {
    const r = ev.extendedProperties?.private?.ref;
    if (!r) continue;
    porRef.set(r, [...(porRef.get(r) || []), ev]);
  }

  const crear: EventoDeseado[] = [];
  const actualizar: [string, EventoDeseado][] = [];
  const borrar: string[] = [];

  for (const d of deseados) {
    const [primero, ...duplicados] = porRef.get(d.ref) || [];
    porRef.delete(d.ref);
    borrar.push(...duplicados.map((e) => e.id));
    if (!primero) crear.push(d);
    else if (difiere(primero, d)) actualizar.push([primero.id, d]);
  }
  // Lo que quedó ya no corresponde (liquidado, finalizado, estancado o eliminado)
  for (const eventos of porRef.values()) borrar.push(...eventos.map((e) => e.id));

  resultado.errores += await enLotes(crear, async (d) => {
    await calendarFetch("/events", { method: "POST", body: JSON.stringify(cuerpoEvento(d)) });
    resultado.creados++;
  });
  resultado.errores += await enLotes(actualizar, async ([id, d]) => {
    await calendarFetch(`/events/${id}`, { method: "PUT", body: JSON.stringify(cuerpoEvento(d)) });
    resultado.actualizados++;
  });
  resultado.errores += await enLotes(borrar, async (id) => {
    await calendarFetch(`/events/${id}`, { method: "DELETE" });
    resultado.eliminados++;
  });

  if (!ref) {
    const antiguos = await eventosAntiguos();
    resultado.errores += await enLotes(antiguos, async (ev) => {
      await calendarFetch(`/events/${ev.id}`, { method: "DELETE" });
      resultado.antiguosEliminados++;
    });
  }

  return resultado;
}

/**
 * Sincroniza un préstamo o alquiler tras un cambio, sin bloquear la respuesta HTTP.
 * Si falla, la sincronización diaria lo corrige.
 */
export function programarSync(ref: string) {
  if (!isGoogleCalendarConfigured()) return;
  sincronizarCalendario(ref).catch((err) => console.error(`[Calendario] Error al sincronizar ${ref}:`, err.message));
}
