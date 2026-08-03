import express from "express";
import fs from "fs";
import path from "path";
import { OAuth2Client } from "google-auth-library";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule } from "../src/lib/loanLogic.js";
import {
  isGoogleCalendarConfigured,
  getGoogleAccessToken,
  deleteGoogleCalendarEvent,
  findGoogleCalendarEvent,
  createOrUpdateGoogleCalendarEvent
} from "../services/google-calendar.js";
import {
  getGoogleClientId,
  getGoogleClientSecret
} from "../services/google-drive.js";

const router = express.Router();

const getRedirectUri = (req: express.Request) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
};

router.get("/google/login", (req: express.Request, res: express.Response) => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    res.status(400).send("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tu archivo .env");
    return;
  }

  const redirectUri = getRedirectUri(req);
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/calendar"
    ],
    prompt: "consent"
  });

  res.redirect(authUrl);
});

router.get("/google/callback", async (req: express.Request, res: express.Response) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send("Código de autorización ausente.");
    return;
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  const redirectUri = getRedirectUri(req);
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc;">
            <div style="max-width: 600px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #ef4444;">
              <h2 style="color: #f87171;">⚠️ ¡Error al obtener el Refresh Token!</h2>
              <p>Google no ha devuelto un <code>refresh_token</code>.</p>
              <p>Esto ocurre porque ya habías autorizado la aplicación antes. Para solucionarlo:</p>
              <ol>
                <li>Ve a la configuración de tu cuenta de Google.</li>
                <li>Elimina el acceso de la aplicación.</li>
                <li>Vuelve a intentar ingresar a: <a href="/api/auth/google/login" style="color: #60a5fa;">/api/auth/google/login</a></li>
              </ol>
            </div>
          </body>
        </html>
      `);
      return;
    }

    let envWriteStatus = "No se pudo escribir en el archivo .env automáticamente.";
    let envWriteSuccess = false;
    try {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf8");
        if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
          envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}`;
        }
        fs.writeFileSync(envPath, envContent, "utf8");
        envWriteStatus = "¡Guardado automáticamente en tu archivo <code>.env</code>!";
        envWriteSuccess = true;
      }
      process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
    } catch (fsErr: any) {
      console.warn("No se pudo escribir en el archivo .env:", fsErr);
    }

    const escapedToken = String(refreshToken).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const manualCopyBlock = envWriteSuccess
      ? ""
      : `
            <div style="margin-top: 18px; background: #0f172a; border: 1px dashed #f59e0b; border-radius: 10px; padding: 16px;">
              <p style="color: #fbbf24; font-weight: bold; margin: 0 0 8px;">📋 Copia y pega esto manualmente en tu archivo <code>.env</code>:</p>
              <pre style="white-space: pre-wrap; word-break: break-all; background: #1e293b; padding: 12px; border-radius: 8px; margin: 0; font-size: 12px; color: #93c5fd;">GOOGLE_REFRESH_TOKEN=${escapedToken}</pre>
              <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0;">En Vercel agrega <code>GOOGLE_REFRESH_TOKEN</code> en las variables de entorno del entorno <b>Production</b>.</p>
            </div>
      `;

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc;">
          <div style="max-width: 600px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #3b82f6; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h2 style="color: #4ade80; margin-top: 0;">🎉 ¡Autenticación de Google Exitosa!</h2>
            <p>Hemos obtenido tu <b>Refresh Token</b> de larga duración de forma segura.</p>
            <p><b>Estado del archivo .env:</b> <span style="color: #4ade80; font-weight: bold;">${envWriteStatus}</span></p>
            ${manualCopyBlock}
            <a href="/" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-top: 15px;">
              Volver a PrestaFacilito
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    res.status(500).send(`Error al intercambiar el código por tokens: ${error.message}`);
  }
});

function getMonthRanges(baseDate: Date = new Date()) {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth();

  const currentMonthStart = new Date(currentYear, currentMonth, 1);
  const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);

  const pastMonthStart = new Date(currentYear, currentMonth - 1, 1);
  const pastMonthEnd = new Date(currentYear, currentMonth, 0);

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    currentMonth: {
      start: formatDate(currentMonthStart),
      end: formatDate(currentMonthEnd),
      year: currentYear,
      month: currentMonth + 1
    },
    pastMonth: {
      start: formatDate(pastMonthStart),
      end: formatDate(pastMonthEnd),
      year: currentMonth === 0 ? currentYear - 1 : currentYear,
      month: currentMonth === 0 ? 12 : currentMonth
    }
  };
}

router.post("/calendar/sync-month", requireAuth, async (req: express.Request, res: express.Response) => {
  if (!isGoogleCalendarConfigured()) {
    res.status(503).json({ error: "Google Calendar no está configurado en las variables de entorno." });
    return;
  }

  try {
    const ranges = getMonthRanges();
    const curStart = ranges.currentMonth.start;
    const curEnd = ranges.currentMonth.end;
    const pastStart = ranges.pastMonth.start;
    const pastEnd = ranges.pastMonth.end;

    const accessToken = await getGoogleAccessToken();

    const timeMin = `${pastStart}T00:00:00Z`;
    const timeMax = `${pastEnd}T23:59:59Z`;
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true`;

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!listRes.ok) {
      const listErrText = await listRes.text();
      throw new Error(`Error al listar eventos del mes pasado: ${listErrText}`);
    }

    const calendarData = await listRes.json();
    const events: any[] = calendarData.items || [];

    const loanEventsToDelete = events.filter((event: any) => {
      const summary = event.summary || "";
      const description = event.description || "";

      const hasPrestaFacilitoDesc = description.includes("PrestaFacilito");
      const hasPrefix =
        summary.startsWith("🔔 [PENDIENTE]") ||
        summary.startsWith("✅ [PAGADO]") ||
        summary.startsWith("🔶 [PARCIAL]") ||
        summary.startsWith("🚨 [VENCIDO]") ||
        summary.startsWith("💰 Cobro Recibido");

      return hasPrestaFacilitoDesc || hasPrefix;
    });

    let deletedCount = 0;
    for (const event of loanEventsToDelete) {
      if (event.id) {
        try {
          await deleteGoogleCalendarEvent(event.id);
          deletedCount++;
        } catch (delErr: any) {
          console.error(`[CalendarSync] Fallo al eliminar evento ${event.id}:`, delErr.message);
        }
      }
    }

    const { data: activeLoans, error: lErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("estado", "activo");

    if (lErr) throw lErr;

    let syncedCount = 0;

    if (activeLoans && activeLoans.length > 0) {
      for (const prestamo of activeLoans) {
        try {
          const [cRes, aRes, ajRes] = await Promise.all([
            supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single(),
            supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamo.id),
            supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamo.id)
          ]);

          const cliente = cRes.data;
          const pagosRealizados = aRes.data || [];
          const ajustes = ajRes.data || [];

          if (!cliente) continue;

          const debtState = buildPaymentSchedule(prestamo, pagosRealizados, { ajustes, referenceDate: new Date() });
          const cuotas = debtState.cuotas;

          const existingEvents = Array.isArray(prestamo.google_calendar_events)
            ? prestamo.google_calendar_events
            : [];

          const updatedEventsList: any[] = [];

          const d = new Date();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const todayStr = `${yyyy}-${mm}-${dd}`;
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          const ss = String(d.getSeconds()).padStart(2, "0");
          const timestamp = `${todayStr} ${hh}:${min}:${ss}`;

          for (const cuota of cuotas) {
            const isCurrentMonth = cuota.fechaVencimiento >= curStart && cuota.fechaVencimiento <= curEnd;
            const isPastMonth = cuota.fechaVencimiento >= pastStart && cuota.fechaVencimiento <= pastEnd;

            const existing = existingEvents.find((e: any) => e.numero === cuota.numero);
            let eventId = existing?.eventId;

            const isPast = cuota.fechaVencimiento < todayStr;

            if (isPast) {
              if (!eventId) {
                eventId = await findGoogleCalendarEvent(cliente.nombre_completo, cuota.numero);
              }
              if (eventId) {
                await deleteGoogleCalendarEvent(eventId).catch(err =>
                  console.error("Error al borrar evento de calendario pasado:", err)
                );
              }
              continue;
            }

            if (isCurrentMonth) {
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
                `Interés de Cuota: S/. ${(cuota.interesOriginal ?? 0).toFixed(2)}`,
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

                updatedEventsList.push({
                  numero: cuota.numero,
                  eventId: calEvent.id,
                  fechaVencimiento: cuota.fechaVencimiento
                });
                syncedCount++;
              } catch (calErr: any) {
                console.error(`[CalendarSync] Error al sincronizar cuota ${cuota.numero} en Google Calendar:`, calErr.message);
                if (existing) updatedEventsList.push(existing);
              }
            } else if (isPastMonth) {
              console.log(`[CalendarSync] Descartando evento del mes pasado del préstamo ${prestamo.id}, cuota ${cuota.numero}`);
            } else {
              if (existing) {
                updatedEventsList.push(existing);
              }
            }
          }

          await supabase
            .from("prestamos")
            .update({ google_calendar_events: updatedEventsList })
            .eq("id", prestamo.id);

        } catch (loanErr: any) {
          console.error(`[CalendarSync] Error al procesar préstamo ${prestamo.id}:`, loanErr.message);
        }
      }
    }

    res.json({
      success: true,
      syncedCount,
      deletedCount,
      message: `¡Sincronización mensual completada! ${syncedCount} cuotas del mes actual sincronizadas/actualizadas y ${deletedCount} eventos antiguos del mes pasado depurados con éxito.`
    });

  } catch (err: any) {
    console.error("Error en sincronización mensual de calendario:", err);
    res.status(500).json({ error: "Error al sincronizar el calendario mensual", detail: err.message });
  }
});

export default router;
