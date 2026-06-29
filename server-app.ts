import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";
import { JWT, OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabase } from "./src/lib/supabase.js";
import { buildPaymentSchedule, classifyPayment, toNumber } from "./src/lib/loanLogic.js";

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

// Variables cacheadas dinámicamente para no crashear en Vercel
let fallbackJwtSecret: string | null = null;
const getJwtSecret = () => {
  const secret = getEnv("JWT_SECRET");
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: La variable de entorno JWT_SECRET no está configurada. Operación abortada por seguridad.");
    }
    if (!fallbackJwtSecret) {
      fallbackJwtSecret = crypto.randomBytes ? crypto.randomBytes(32).toString("hex") : "dev-fallback-insecure-string-backup";
      console.warn("⚠️ Advertencia: JWT_SECRET no está configurada en desarrollo. Generada clave aleatoria temporal.");
    }
    return fallbackJwtSecret;
  }
  return secret;
};

// Validar JWT_SECRET inmediatamente al iniciar el servidor
getJwtSecret();

const getAdminUser = () => getEnv("ADMIN_USER");
const getAdminPass = () => getEnv("ADMIN_PASS");
const getDriveFolderId = () => getEnv("GOOGLE_DRIVE_FOLDER_ID");

const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const getGoogleClientId = () => getEnv("GOOGLE_CLIENT_ID");
const getGoogleClientSecret = () => getEnv("GOOGLE_CLIENT_SECRET");
const getGoogleRefreshToken = () => getEnv("GOOGLE_REFRESH_TOKEN");

async function getGoogleDriveAccessToken() {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getGoogleRefreshToken();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Faltan credenciales de Google Drive OAuth 2.0. Revisa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el archivo .env.");
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const response = await oauth2Client.getAccessToken();
  if (!response.token) {
    throw new Error("No se pudo obtener un access token para Google Drive. Revisa si tu GOOGLE_REFRESH_TOKEN es válido.");
  }

  return response.token;
}

async function uploadVoucherToDrive(fileName: string, mimeType: string, buffer: Buffer) {
  const accessToken = await getGoogleDriveAccessToken();
  const folderId = getDriveFolderId();
  const uniqueName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const boundary = `----prestafacilito-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const metadata: Record<string, unknown> = {
    name: uniqueName
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const multipartPrefix = Buffer.from([
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    ""
  ].join("\r\n"), "utf8");

  const multipartSuffix = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const multipartBody = Buffer.concat([multipartPrefix, buffer, multipartSuffix]);

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`No se pudo subir el archivo a Google Drive: ${errorText}`);
  }

  const uploadedFile = await uploadResponse.json();

  return {
    fileId: uploadedFile.id as string,
    fileName: uploadedFile.name as string,
    webViewLink: uploadedFile.webViewLink as string | undefined,
    webContentLink: uploadedFile.webContentLink as string | undefined,
    publicUrl: `/api/vouchers/proxy/${uploadedFile.id}`,
    directUrl: `https://drive.google.com/uc?export=view&id=${uploadedFile.id}`,
    folderId: folderId || ""
  };
}

/** Verifica si Drive está correctamente configurado sin lanzar error */
function isDriveConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

/** Verifica si Google Calendar está correctamente configurado sin lanzar error */
function isGoogleCalendarConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

/** Obtiene el token de acceso de Google (reutiliza el flujo de Drive) */
const getGoogleAccessToken = getGoogleDriveAccessToken;

/**
 * Crea o actualiza un evento de Google Calendar.
 * Devuelve el objeto del evento creado/actualizado.
 */
async function createOrUpdateGoogleCalendarEvent({
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
      date: dateStr // Evento de todo el día
    },
    end: {
      date: dateStr // Evento de todo el día
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
    const errText = await response.text();
    console.error(`Error de Google Calendar API (event ${eventId || 'new'}): ${errText}`);
    throw new Error(`Error en Google Calendar API: ${errText}`);
  }

  return await response.json();
}

/** Elimina un evento de Google Calendar. */
async function deleteGoogleCalendarEvent(eventId: string) {
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

/** Sincroniza el calendario de cuotas de un préstamo con Google Calendar. */
async function syncLoanScheduleToGoogleCalendar(prestamoId: string) {
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

    // Calcular el calendario de cuotas actual
    const debtState = buildPaymentSchedule(prestamo, pagosRealizados, ajustes, new Date());
    const cuotas = debtState.cuotas;

    // Obtener eventos guardados previamente
    const existingEvents = Array.isArray(prestamo.google_calendar_events)
      ? prestamo.google_calendar_events
      : [];

    const updatedEvents = [];

    for (const cuota of cuotas) {
      const existing = existingEvents.find((e: any) => e.numero === cuota.numero);
      const eventId = existing?.eventId;

      let colorId = "5"; // Yellow (Banana) - Pendiente por defecto
      let statusPrefix = "🔔 [PENDIENTE]";

      if (cuota.estado === "Saldada") {
        colorId = "10"; // Green (Basil)
        statusPrefix = "✅ [PAGADO]";
      } else if (cuota.estado === "Parcial") {
        colorId = "6"; // Orange (Tangerine)
        statusPrefix = "🔶 [PARCIAL]";
      } else if (cuota.estado === "Vencida") {
        colorId = "11"; // Red (Tomato)
        statusPrefix = "🚨 [VENCIDO]";
      }

      const summary = `${statusPrefix} Cuota ${cuota.numero} - ${cliente.nombre_completo}`;
      const description = [
        `📊 ESTADO DEL CRÉDITO:`,
        `• Cliente: ${cliente.nombre_completo}`,
        `• Teléfono: ${cliente.telefono || "No registrado"}`,
        `• Tipo de Préstamo: ${prestamo.tipo_prestamo || "Personal"}`,
        `• N° de Cuota: ${cuota.numero} de ${debtState.resumen.totalCuotas}`,
        `• Monto de la Cuota: S/. ${cuota.montoExigible.toFixed(2)}`,
        `• Capital de Cuota: S/. ${cuota.capitalPendiente.toFixed(2)}`,
        cuota.interesOriginal ? `• Interés de Cuota: S/. ${cuota.interesOriginal.toFixed(2)}` : null,
        cuota.moraPendiente > 0 ? `• Mora Pendiente: S/. ${cuota.moraPendiente.toFixed(2)}` : null,
        `• Total Pagado en esta cuota: S/. ${cuota.pagado.toFixed(2)}`,
        `• Saldo Pendiente: S/. ${cuota.saldoPendiente.toFixed(2)}`,
        `• Fecha de Vencimiento: ${cuota.fechaVencimiento}`,
        `• Estado de la Cuota: ${cuota.estado}`,
        `\n📅 Registro actualizado automáticamente desde PrestaFacilito.`
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

    // Eliminar eventos de cuotas obsoletas si las hay (por reprogramaciones)
    const newCuotasNums = cuotas.map((c: any) => c.numero);
    const toDelete = existingEvents.filter((e: any) => !newCuotasNums.includes(e.numero));
    for (const d of toDelete) {
      if (d.eventId) {
        await deleteGoogleCalendarEvent(d.eventId).catch(err =>
          console.error("Error al borrar evento de calendario sobrante:", err)
        );
      }
    }

    // Actualizar préstamo en Supabase con los IDs de eventos
    await supabase
      .from("prestamos")
      .update({ google_calendar_events: updatedEvents })
      .eq("id", prestamoId);

  } catch (err: any) {
    console.error("Error en syncLoanScheduleToGoogleCalendar:", err);
  }
}

/** Registra una amortización / pago de deuda como un evento de cobro en Google Calendar. */
async function logPaymentToGoogleCalendar(
  cliente: any,
  prestamo: any,
  monto: number,
  metodoPago: string,
  clasificacion: string,
  fechaPago: string
) {
  if (!isGoogleCalendarConfigured()) return;

  try {
    const summary = `💰 Cobro Recibido: S/. ${monto.toFixed(2)} - ${cliente.nombre_completo}`;
    const description = [
      `💰 REGISTRO DE COBRO RECIBIDO:`,
      `• Cliente: ${cliente.nombre_completo}`,
      `• Teléfono: ${cliente.telefono || "No registrado"}`,
      `• Monto Recibido: S/. ${monto.toFixed(2)}`,
      `• Método de Pago: ${metodoPago}`,
      `• Tipo de Movimiento: ${clasificacion}`,
      `• Préstamo de Capital: S/. ${toNumber(prestamo.monto_capital).toFixed(2)}`,
      `• Fecha del Pago: ${fechaPago}`,
      `\n📅 Registro creado automáticamente desde PrestaFacilito.`
    ].join("\n");

    // Color verde suave es '2' (Sage)
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

// ID de la carpeta raíz en Google Drive para documentos de clientes (configurable)
const GOOGLE_DRIVE_CLIENTES_FOLDER_ID = getEnv("GOOGLE_DRIVE_CLIENTES_FOLDER_ID") || "12xYCUm9UULixGlauvbYdeUHRaEzTNJyq";

/**
 * Crea una subcarpeta en Google Drive para el cliente.
 * Devuelve el ID de la subcarpeta creada.
 */
async function createDriveSubfolder(clientName: string, parentFolderId: string): Promise<string> {
  const accessToken = await getGoogleDriveAccessToken();
  const safeName = clientName.replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, '').trim();
  const folderName = `Documentos - ${safeName}`;

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`No se pudo crear la subcarpeta en Google Drive: ${err}`);
  }

  const folder = await response.json() as { id: string };
  return folder.id;
}

/**
 * Sube un documento de cliente a su subcarpeta en Google Drive.
 */
async function uploadDocumentToDrive(fileName: string, mimeType: string, buffer: Buffer, folderId: string) {
  const accessToken = await getGoogleDriveAccessToken();
  const uniqueName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
  const boundary = `----prestafacilito-doc-${Date.now()}`;

  const metadata = { name: uniqueName, parents: [folderId] };

  const multipartPrefix = Buffer.from([
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    ''
  ].join('\r\n'), 'utf8');

  const multipartSuffix = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([multipartPrefix, buffer, multipartSuffix]);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!uploadResponse.ok) {
    const err = await uploadResponse.text();
    throw new Error(`Error al subir documento a Drive: ${err}`);
  }

  const file = await uploadResponse.json() as { id: string; name: string; webViewLink?: string };
  return {
    fileId: file.id,
    fileName: file.name,
    publicUrl: `/api/documentos/proxy/${file.id}`
  };
}

/**
 * Detecta el género del cliente por su primer nombre.
 * Devuelve 'SR.' o 'SRA.' según corresponda.
 */
function detectarGenero(nombreCompleto: string): 'SR.' | 'SRA.' {
  const NOMBRES_FEMENINOS = new Set([
    'maria', 'ana', 'lucia', 'sofia', 'elena', 'carmen', 'rosa', 'claudia', 'andrea', 'patricia',
    'laura', 'diana', 'gloria', 'monica', 'sandra', 'alejandra', 'valentina', 'gabriela', 'lorena',
    'jessica', 'vanessa', 'adriana', 'paola', 'natalia', 'carolina', 'fernanda', 'daniela', 'sara',
    'isabel', 'pilar', 'julia', 'alicia', 'beatriz', 'cristina', 'irene', 'mariana', 'raquel',
    'silvia', 'yolanda', 'angela', 'consuelo', 'esperanza', 'graciela', 'luz', 'mercedes', 'norma',
    'olga', 'rebeca', 'susana', 'veronica', 'wendy', 'xiomara', 'yasmin', 'zoraida', 'pamela',
    'karina', 'brenda', 'gisela', 'rocio', 'miriam', 'nancy', 'marisol', 'milagros', 'flor',
    'liliana', 'estela', 'rosa', 'cecilia', 'catalina', 'evelyn', 'fabiola', 'helen', 'iliana'
  ]);

  const primerNombre = nombreCompleto.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  return NOMBRES_FEMENINOS.has(primerNombre) ? 'SRA.' : 'SR.';
}

/**
 * Estandariza el número de teléfono para Perú (+51).
 * Si el número tiene 9 dígitos y empieza con 9, agrega el prefijo 51.
 */
function estandarizarTelefono(tel: string): string {
  if (!tel) return '';
  const soloDigitos = tel.replace(/\D/g, '');
  if (soloDigitos.startsWith('51') && soloDigitos.length === 11) return soloDigitos;
  if (soloDigitos.length === 9 && soloDigitos.startsWith('9')) return `51${soloDigitos}`;
  return soloDigitos;
}

// Helper para comparación de diferencias en ediciones
function getDiffDescription(oldObj: any, newObj: any, fields: Record<string, string>): string {
  const changes: string[] = [];
  for (const [key, label] of Object.entries(fields)) {
    const oldVal = oldObj[key] !== undefined && oldObj[key] !== null ? String(oldObj[key]) : "";
    const newVal = newObj[key] !== undefined && newObj[key] !== null ? String(newObj[key]) : "";
    if (oldVal.trim() !== newVal.trim()) {
      changes.push(`${label}: "${oldVal}" ➔ "${newVal}"`);
    }
  }
  return changes.length > 0 ? `Cambios: ${changes.join(" | ")}` : "Sin modificaciones relevantes.";
}

// Helper para auditoría de acciones (Logs) en Supabase y local (universal)
async function logAction(
  usuario: string,
  accion: string,
  detalles: string,
  req?: express.Request,
  metaExtra?: Record<string, any>
) {
  try {
    let ip = "";
    let userAgent = "";
    let route = "";
    let method = "";
    if (req) {
      const forwarded = req.headers['x-forwarded-for'] as string;
      ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket.remoteAddress || "");
      userAgent = req.headers['user-agent'] || "";
      route = req.originalUrl || "";
      method = req.method || "";
    }

    const meta = {
      ip,
      userAgent,
      route,
      method,
      ...metaExtra
    };

    const detailsPayload = {
      message: detalles,
      meta
    };

    await supabase.from("logs").insert({
      usuario,
      accion,
      detalles: JSON.stringify(detailsPayload)
    });

    // Guardar también en archivo local en el servidor (Persistencia Universal)
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const localLogEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : new Date().getTime().toString(),
      fecha_hora: new Date().toISOString(),
      usuario,
      accion,
      detalles: detailsPayload.message,
      meta
    };

    fs.appendFileSync(
      path.join(logDir, "audit.jsonl"),
      JSON.stringify(localLogEntry) + "\n",
      "utf8"
    );
  } catch (err) {
    console.error("⚠️ Error al registrar log de auditoría:", err);
  }
}

const app = express();

// Middlewares de seguridad robusta para sistema cerrado
app.use((req, res, next) => {
  // 1. Desactivar indexación por completo en motores de búsqueda (Google, Bing, etc.)
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noodp, noydir");

  // 2. Prevenir clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // 3. Prevenir sniffing de tipo MIME
  res.setHeader("X-Content-Type-Options", "nosniff");

  // 4. Referrer Policy ultra-segura para sistema cerrado
  res.setHeader("Referrer-Policy", "no-referrer");

  // 5. Cache-Control estricto para evitar almacenamiento de datos financieros confidenciales
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  // 6. Content Security Policy (CSP) adaptada al sistema
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://*.googleusercontent.com https://*.googleapis.com; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com; " +
    "frame-src 'self' https://docs.google.com https://drive.google.com;"
  );

  next();
});

// Aumentar el límite de tamaño de petición para permitir la transferencia de base64 de comprobantes
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));
app.use(cookieParser());

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60 * 1000,
};
const clearCookieOptions = {
  httpOnly: cookieOptions.httpOnly,
  secure: cookieOptions.secure,
  sameSite: cookieOptions.sameSite,
};

// Middleware de Autenticación
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.token;
  if (!token) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Sesión inválida o expirada" });
  }
};

// Obtiene el PIN para un usuario específico desde las variables de entorno
const getPinForUser = (username: string) => {
  const envKey = `PIN_${username.trim().toUpperCase()}`;
  return getEnv(envKey);
};

// Rutas de Autenticación
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, message: "Usuario y PIN de acceso requeridos" });
    return;
  }

  const cleanUser = username.trim().toLowerCase();
  const expectedPin = getPinForUser(cleanUser);

  const adminUser = getAdminUser();
  const adminPass = getAdminPass();
  const isAdminValid = !!(adminUser && adminPass &&
    cleanUser === adminUser.toLowerCase() && password === adminPass);

  const isValid = !!((expectedPin && password === expectedPin) || isAdminValid);

  if (isValid) {
    const token = jwt.sign({ username: cleanUser }, getJwtSecret(), { expiresIn: "24h" });
    res.cookie("token", token, cookieOptions);
    await logAction(cleanUser, "INICIAR_SESION", `El usuario ${cleanUser} inició sesión de forma exitosa.`, req);
    res.json({ success: true, username: cleanUser });
  } else {
    res.status(401).json({ success: false, message: "Usuario o PIN de acceso incorrecto" });
  }
});

app.get("/api/auth/me", (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    res.json({ authenticated: true, user: (decoded as any).username });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const username = (req as any).user?.username || "Admin";
  await logAction(username, "CERRAR_SESION", "El administrador cerró sesión.", req);
  res.clearCookie("token", clearCookieOptions);
  res.json({ success: true });
});

// ==========================================
// RUTAS DEL NEGOCIO (PROTEGIDAS POR AUTH)
// ==========================================

// 1. Bitácora de Auditoría (Logs)
app.get("/api/logs", requireAuth, async (req, res) => {
  try {
    const { usuario, accion, limit, search } = req.query;
    let query = supabase
      .from("logs")
      .select("*")
      .order("fecha_hora", { ascending: false });

    if (usuario) {
      query = query.eq("usuario", usuario);
    }
    if (accion) {
      query = query.eq("accion", accion);
    }
    if (search) {
      query = query.ilike("detalles", `%${search}%`);
    }

    const limitNum = limit ? parseInt(limit as string) : 100;
    query = query.limit(limitNum);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    console.error("Error al obtener logs:", err);
    res.status(500).json({ error: "Error de servidor al obtener logs", detail: err.message });
  }
});

// Descargar logs en CSV (Persistencia Universal/Descarga)
app.get("/api/logs/download", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("fecha_hora", { ascending: false });

    if (error) throw error;

    let csv = "\uFEFFID,Fecha/Hora,Usuario,Accion,Detalles\n";
    (data || []).forEach(log => {
      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      csv += `${escape(log.id)},${escape(log.fecha_hora)},${escape(log.usuario)},${escape(log.accion)},${escape(log.detalles)}\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=bitacora_prestafacilito.csv");
    res.send(csv);
  } catch (err: any) {
    console.error("Error al descargar logs:", err);
    res.status(500).json({ error: "Error de servidor al descargar logs", detail: err.message });
  }
});

// Descargar logs locales (.jsonl)
app.get("/api/logs/local", requireAuth, async (req, res) => {
  try {
    const logFilePath = path.join(process.cwd(), "logs", "audit.jsonl");
    if (!fs.existsSync(logFilePath)) {
      res.status(404).json({ error: "No se ha generado ningún log local aún." });
      return;
    }
    res.setHeader("Content-Type", "application/x-jsonlines");
    res.setHeader("Content-Disposition", "attachment; filename=audit_local.jsonl");
    fs.createReadStream(logFilePath).pipe(res);
  } catch (err: any) {
    console.error("Error al leer logs locales:", err);
    res.status(500).json({ error: "Error al descargar log local", detail: err.message });
  }
});

// Test de conectividad a Supabase (Legacy endpoint para mantener compatibilidad)
app.post("/api/initialize-sheets", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from("clientes").select("id").limit(1);
    if (error) throw error;

    const username = (req as any).user.username;
    await logAction(username, "CONECTAR_SUPABASE", "Conexión a base de datos Supabase verificada de forma manual.", req);
    res.json({ success: true, message: "Conexión con Supabase verificada correctamente." });
  } catch (err: any) {
    console.error("Error de conectividad a Supabase:", err);
    res.status(500).json({ error: "No se pudo conectar a la base de datos de Supabase", detail: err.message });
  }
});

// Endpoint para rellenar base de datos con datos de prueba (Seed)
app.post("/api/seed", requireAuth, async (req, res) => {
  try {
    const { data: existing, error: checkErr } = await supabase.from("clientes").select("id").limit(1);
    if (checkErr) throw checkErr;

    if (existing && existing.length > 0) {
      res.json({
        success: false,
        message: "La base de datos ya contiene registros. Se omitió la siembra para evitar duplicados."
      });
      return;
    }

    // 1. Generar Clientes Ejemplo
    const clientesSeed = [
      {
        nombre_completo: "Sofía Vergara Ramos",
        telefono: "57 3201234567",
        observaciones: "Clienta habitual, comerciante de calzado."
      },
      {
        nombre_completo: "Alejandro Mendoza Soler",
        telefono: "52 5598765432",
        observaciones: "Crédito comercial para ampliación de panadería tradicional."
      },
      {
        nombre_completo: "Mariana Silva Duarte",
        telefono: "54 9114321098",
        observaciones: "Firma de préstamo personal con aval de propiedad familiar."
      }
    ];

    const { data: insertedClientes, error: insertClientsErr } = await supabase
      .from("clientes")
      .insert(clientesSeed)
      .select();

    if (insertClientsErr) throw insertClientsErr;

    const sc1 = insertedClientes.find(c => c.nombre_completo.includes("Sofía"));
    const sc2 = insertedClientes.find(c => c.nombre_completo.includes("Alejandro"));
    const sc3 = insertedClientes.find(c => c.nombre_completo.includes("Mariana"));

    // 2. Generar Préstamos Ejemplo
    const prestamosSeed = [
      {
        cliente_id: sc1.id,
        monto_capital: 20000,
        tasa_interes_porcentaje: 10,
        fecha_emision: "2026-05-10",
        fecha_vencimiento: "2026-08-10",
        estado: "activo",
        tipo_prestamo: "Negocio"
      },
      {
        cliente_id: sc2.id,
        monto_capital: 50000,
        tasa_interes_porcentaje: 12,
        fecha_emision: "2026-05-12",
        fecha_vencimiento: "2026-11-12",
        estado: "activo",
        tipo_prestamo: "Hipotecario"
      },
      {
        cliente_id: sc3.id,
        monto_capital: 10000,
        tasa_interes_porcentaje: 8,
        fecha_emision: "2026-05-15",
        fecha_vencimiento: "2026-06-15",
        estado: "pagado",
        tipo_prestamo: "Personal"
      }
    ];

    const { data: insertedPrestamos, error: insertLoansErr } = await supabase
      .from("prestamos")
      .insert(prestamosSeed)
      .select();

    if (insertLoansErr) throw insertLoansErr;

    const sp1 = insertedPrestamos.find(l => l.cliente_id === sc1.id);
    const sp3 = insertedPrestamos.find(l => l.cliente_id === sc3.id);

    // 3. Generar Amortizaciones Ejemplo
    const amortizacionesSeed = [
      {
        prestamo_id: sp1.id,
        tipo_movimiento: "Pago Ordinario",
        monto: 5000,
        fecha_pago: "2026-05-18",
        metodo_pago: "Transferencia"
      },
      {
        prestamo_id: sp3.id,
        tipo_movimiento: "Liquidación Crédito",
        monto: 10800,
        fecha_pago: "2026-05-20",
        metodo_pago: "Efectivo"
      }
    ];

    const { error: insertAmortErr } = await supabase
      .from("amortizaciones")
      .insert(amortizacionesSeed);

    if (insertAmortErr) throw insertAmortErr;

    const username = (req as any).user.username;
    await logAction(username, "SEMBRAR_DATOS", "Se sembró la base de datos Supabase con clientes, préstamos y amortizaciones de ejemplo.", req);

    res.json({
      success: true,
      message: "¡Siembra de datos exitosa en Supabase! Se crearon 3 Clientes, 3 Préstamos y 2 Amortizaciones."
    });
  } catch (err: any) {
    console.error("Error al sembrar datos:", err);
    res.status(500).json({ error: "Fallo al poblar datos de prueba", detail: err.message });
  }
});

// 2. Dashboard Endpoint: Métricas y últimos préstamos
app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    // Consultas paralelas a Supabase
    const [pRes, aRes, cRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*")
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];

    // Cálculos Financieros
    const totalCapitalPrestado = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);
    const totalRecuperado = amortizaciones.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const prestamosActivos = prestamos.filter(p => p.estado === "activo").length;

    // Unir datos relacionales
    const prestamosConCliente = prestamos.map(p => {
      const cliente = clientes.find(c => c.id === p.cliente_id);
      return {
        ...p,
        monto_capital: parseFloat(p.monto_capital) || 0,
        tasa_interes_porcentaje: parseFloat(p.tasa_interes_porcentaje) || 0,
        cliente_nombre: cliente ? cliente.nombre_completo : "Cliente no encontrado"
      };
    });

    const ultimosPrestamos = [...prestamosConCliente]
      .sort((a, b) => new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime());

    const username = (req as any).user?.username || "sistema";
    await logAction(username, "VER_DASHBOARD", "Accedió al dashboard principal.", req);

    res.json({
      metrics: {
        totalCapitalPrestado: Math.round(totalCapitalPrestado * 100) / 100,
        totalRecuperado: Math.round(totalRecuperado * 100) / 100,
        prestamosActivos,
        totalPrestamosCount: prestamos.length
      },
      ultimosPrestamos
    });
  } catch (err: any) {
    console.error("Error al obtener dashboard:", err);
    res.status(500).json({ error: "Error en el servidor", detail: err.message });
  }
});

// 3. Clientes Endpoints
app.get("/api/clientes", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resumen_financiero_clientes")
      .select("*")
      .order("nombre_completo", { ascending: true });

    if (error) throw error;
    const username = (req as any).user?.username || "sistema";
    await logAction(username, "CONSULTAR_CLIENTES", "Consultó el panel de clientes.", req);
    res.json(data || []);
  } catch (err: any) {
    console.error("Error al obtener clientes:", err);
    res.status(500).json({ error: "Error al obtener clientes", detail: err.message });
  }
});

app.post("/api/clientes", requireAuth, async (req, res) => {
  try {
    const { nombre_completo, telefono, observaciones, direccion, numero_cuenta, banco_cuenta, informacion_adicional } = req.body;

    if (!nombre_completo) {
      res.status(400).json({ error: "El nombre completo es requerido" });
      return;
    }

    // Estandarizar número de teléfono peruano (+51)
    const telSanitized = estandarizarTelefono(telefono || '');

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nombre_completo,
        telefono: telSanitized,
        observaciones: observaciones || '',
        direccion: direccion || '',
        numero_cuenta: numero_cuenta || '',
        banco_cuenta: banco_cuenta || '',
        informacion_adicional: informacion_adicional || ''
      })
      .select()
      .single();

    if (error) throw error;

    // Crear subcarpeta en Google Drive si está configurado
    if (isDriveConfigured()) {
      try {
        const folderId = await createDriveSubfolder(nombre_completo, GOOGLE_DRIVE_CLIENTES_FOLDER_ID);
        await supabase.from('clientes').update({ drive_folder_id: folderId }).eq('id', data.id);
        data.drive_folder_id = folderId;
      } catch (driveErr: any) {
        console.warn('No se pudo crear la carpeta de Drive para el cliente:', driveErr.message);
      }
    }

    const username = (req as any).user.username;
    await logAction(
      username,
      "CREAR_CLIENTE",
      `Se registró al cliente: ${nombre_completo} (Tel: ${telSanitized})`,
      req,
      { cliente_id: data.id }
    );

    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al crear cliente:", err);
    res.status(500).json({ error: "Error al crear cliente", detail: err.message });
  }
});

app.put("/api/clientes/:id", requireAuth, async (req, res) => {
  try {
    const clienteId = req.params.id;
    const { nombre_completo, telefono, observaciones, direccion, numero_cuenta, banco_cuenta, informacion_adicional } = req.body;

    if (!nombre_completo) {
      res.status(400).json({ error: "El nombre completo es requerido" });
      return;
    }

    const telSanitized = estandarizarTelefono(telefono || '');

    // Obtener datos previos para la auditoría de cambios
    const { data: oldCliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("clientes")
      .update({
        nombre_completo,
        telefono: telSanitized,
        observaciones: observaciones || '',
        direccion: direccion || '',
        numero_cuenta: numero_cuenta || '',
        banco_cuenta: banco_cuenta || '',
        informacion_adicional: informacion_adicional || ''
      })
      .eq("id", clienteId)
      .select()
      .single();

    if (error) throw error;

    const username = (req as any).user.username;
    let desc = `Actualizó al cliente: ${nombre_completo}.`;
    if (oldCliente) {
      const diff = getDiffDescription(oldCliente, data, {
        nombre_completo: "Nombre",
        telefono: "Teléfono",
        observaciones: "Observaciones",
        direccion: "Dirección",
        numero_cuenta: "N° Cuenta",
        banco_cuenta: "Banco",
        informacion_adicional: "Info Extra"
      });
      desc += ` ${diff}`;
    }
    await logAction(username, "EDITAR_CLIENTE", desc, req, { cliente_id: clienteId });

    res.json(data);
  } catch (err: any) {
    console.error("Error al actualizar cliente:", err);
    res.status(500).json({ error: "Error al actualizar cliente", detail: err.message });
  }
});

// 4. Préstamos Endpoints
app.post("/api/prestamos", requireAuth, async (req, res) => {
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

    // Obtener cliente para auditoría
    const { data: cliente } = await supabase.from("clientes").select("nombre_completo").eq("id", cliente_id).single();

    const username = (req as any).user.username;
    await logAction(
      username,
      "REGISTRAR_PRESTAMO",
      `Otorgó crédito ${tipo_prestamo} de S/. ${monto_capital} al cliente: ${cliente ? cliente.nombre_completo : cliente_id}`,
      req,
      { prestamo_id: data.id, cliente_id }
    );

    // Sincronizar cuotas en Google Calendar de forma asíncrona
    syncLoanScheduleToGoogleCalendar(data.id).catch((calErr) => {
      console.error("Error al sincronizar préstamo en Google Calendar:", calErr);
    });

    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al crear préstamo:", err);
    res.status(500).json({ error: "Error al crear préstamo", detail: err.message });
  }
});

app.get("/api/prestamos", requireAuth, async (req, res) => {
  try {
    const [pRes, cRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("clientes").select("*")
    ]);

    if (pRes.error) throw pRes.error;
    if (cRes.error) throw cRes.error;

    const prestamos = pRes.data || [];
    const clientes = cRes.data || [];

    const prestamosConCliente = prestamos.map(p => {
      const cliente = clientes.find(c => c.id === p.cliente_id);
      return {
        ...p,
        monto_capital: parseFloat(p.monto_capital) || 0,
        tasa_interes_porcentaje: parseFloat(p.tasa_interes_porcentaje) || 0,
        cliente_nombre: cliente ? cliente.nombre_completo : "Cliente no encontrado"
      };
    });

    const username = (req as any).user?.username || "sistema";
    await logAction(username, "CONSULTAR_PRESTAMOS", "Consultó la lista general de préstamos.", req);
    res.json(prestamosConCliente);
  } catch (err: any) {
    console.error("Error al obtener lista de préstamos:", err);
    res.status(500).json({ error: "Error en el servidor", detail: err.message });
  }
});

// 5. Detalle de Préstamos
app.get("/api/prestamos/:id", requireAuth, async (req, res) => {
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

    const debtState = buildPaymentSchedule(prestamo, pagosRealizados, ajustes, new Date());
    const capital = toNumber(prestamo.monto_capital);
    const tasaInteres = toNumber(prestamo.tasa_interes_porcentaje);
    const totalBaseExigible = capital + (capital * (tasaInteres / 100) * debtState.resumen.totalCuotas);

    const username = (req as any).user?.username || "sistema";
    await logAction(
      username,
      "VER_PRESTAMO_DETALLE",
      `Consultó el detalle del préstamo ${prestamoId}.`,
      req,
      { prestamo_id: prestamoId, cliente_id: prestamo.cliente_id }
    );

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

app.put("/api/prestamos/:id", requireAuth, async (req, res) => {
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

    // Obtener datos previos para la auditoría de cambios
    const { data: oldPrestamo } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .maybeSingle();

    const { data: updated, error } = await supabase
      .from("prestamos")
      .update(updatePayload)
      .eq("id", prestamoId)
      .select()
      .single();

    if (error) throw error;

    const { data: cliente } = await supabase.from("clientes").select("nombre_completo").eq("id", updated.cliente_id).single();

    const username = (req as any).user.username;
    let desc = `Actualizó parámetros del contrato/préstamo ${updated.tipo_prestamo} del cliente: ${cliente ? cliente.nombre_completo : updated.cliente_id}.`;
    if (oldPrestamo) {
      const diff = getDiffDescription(oldPrestamo, updated, {
        monto_capital: "Capital",
        tasa_interes_porcentaje: "Tasa de Interés (%)",
        fecha_emision: "Fecha de Emisión",
        fecha_vencimiento: "Fecha de Vencimiento",
        notas: "Notas"
      });
      desc += ` ${diff}`;
    }
    await logAction(username, "EDITAR_PRESTAMO", desc, req, { prestamo_id: prestamoId, cliente_id: updated.cliente_id });

    // Sincronizar cuotas reprogramadas en Google Calendar de forma asíncrona
    syncLoanScheduleToGoogleCalendar(prestamoId).catch((calErr) => {
      console.error("Error al reprogramar préstamo en Google Calendar:", calErr);
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Error al actualizar préstamo:", err);
    res.status(500).json({ error: "Error al actualizar préstamo", detail: err.message });
  }
});

app.delete("/api/prestamos/:id", requireAuth, async (_req, res) => {
  res.status(405).json({
    error: "El borrado de préstamos está deshabilitado. Solo se permite editar fechas y registrar pagos."
  });
});

// 6. Registrar Abonos / Amortizaciones
app.post("/api/prestamos/:id/pagos", requireAuth, async (req, res) => {
  try {
    const prestamoId = req.params.id;
    const { monto, tipo_movimiento, metodo_pago, fecha_pago, comprobante_url } = req.body;

    const montoPago = parseFloat(monto);
    if (!montoPago || montoPago <= 0) {
      res.status(400).json({ error: "El monto del pago debe ser mayor a 0." });
      return;
    }

    // Obtener el préstamo
    const { data: prestamo, error: pErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .single();

    if (pErr) throw pErr;

    // Obtener pagos previos y ajustes
    const [aRes, ajRes] = await Promise.all([
      supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
      supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
    ]);

    if (aRes.error) throw aRes.error;
    if (ajRes.error) throw ajRes.error;

    const pagosAnteriores = aRes.data || [];
    const ajustes = ajRes.data || [];
    const deudaAntes = buildPaymentSchedule(prestamo, pagosAnteriores, ajustes, new Date(fecha_pago || new Date()));

    // Validamos contra el saldo pendiente al día de hoy o a la fecha del pago (el mayor de ambos)
    // para permitir pagos de liquidación total que se registren en el pasado.
    const referenceDate = new Date();
    const fechaPagoDate = new Date(fecha_pago || new Date());
    const queryDate = fechaPagoDate.getTime() > referenceDate.getTime() ? fechaPagoDate : referenceDate;
    const deudaValidacion = buildPaymentSchedule(prestamo, pagosAnteriores, ajustes, queryDate);

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

    // Insertar la amortización en Supabase
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
    const deudaDespues = buildPaymentSchedule(prestamo, pagosActualizados, ajustes, new Date(fecha_pago || new Date()));
    let nuevoEstado = prestamo.estado;

    if (deudaDespues.resumen.saldoPendiente <= 0.01) {
      nuevoEstado = "pagado";
      await supabase
        .from("prestamos")
        .update({ estado: "pagado" })
        .eq("id", prestamoId);
    }

    // Obtener cliente para logs y Google Calendar
    const { data: cliente } = await supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single();

    const username = (req as any).user.username;
    await logAction(
      username,
      "REGISTRAR_PAGO",
      `Abonó S/. ${montoPago} (Método: ${metodo_pago || "Efectivo"} | Tipo: ${clasificacionAutomatica}) al contrato/préstamo de: ${cliente ? cliente.nombre_completo : prestamo.cliente_id}. Saldo anterior: S/. ${deudaAntes.resumen.saldoPendiente.toFixed(2)} ➔ Restante: S/. ${deudaDespues.resumen.saldoPendiente.toFixed(2)}.`,
      req,
      { prestamo_id: prestamoId, cliente_id: prestamo.cliente_id, amortizacion_id: insertedAmort?.id }
    );

    // Sincronizar cuotas actualizadas en Google Calendar
    syncLoanScheduleToGoogleCalendar(prestamoId).catch((calErr) => {
      console.error("Error al sincronizar cuotas tras pago en Google Calendar:", calErr);
    });

    // Registrar abono recibido en Google Calendar
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

app.post("/api/prestamos/autoseleccionar", requireAuth, async (req, res) => {
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
      const debtState = buildPaymentSchedule(prestamo, pagosDelPrestamo, ajustesDelPrestamo, new Date(fecha_pago || new Date()));
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

app.get("/api/amortizaciones", requireAuth, async (req, res) => {
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
        cliente_nombre: cliente ? cliente.nombre_completo : "Desconocido",
        cliente_telefono: cliente ? cliente.telefono : "",
        tipo_prestamo: prestamo ? prestamo.tipo_prestamo : "Personal",
        monto_capital: prestamo ? prestamo.monto_capital : 0
      };
    });

    const username = (req as any).user?.username || "sistema";
    await logAction(username, "CONSULTAR_AMORTIZACIONES", "Consultó el historial de amortizaciones.", req);
    res.json(detailed);
  } catch (err: any) {
    console.error("Error al obtener amortizaciones:", err);
    res.status(500).json({ error: "Error al obtener amortizaciones", detail: err.message });
  }
});

app.put("/api/amortizaciones/:id", requireAuth, async (req, res) => {
  try {
    const amortizacionId = req.params.id;
    const { fecha_pago } = req.body;

    if (!fecha_pago) {
      res.status(400).json({ error: "La fecha de pago es requerida." });
      return;
    }

    // 1. Obtener la amortización actual
    const { data: amortizacion, error: amortErr } = await supabase
      .from("amortizaciones")
      .select("*")
      .eq("id", amortizacionId)
      .single();

    if (amortErr || !amortizacion) {
      res.status(404).json({ error: "No se encontró la amortización solicitada o no existe." });
      return;
    }

    const fechaAnterior = amortizacion.fecha_pago;
    const prestamoId = amortizacion.prestamo_id;

    // 2. Actualizar la fecha de pago en Supabase
    const { data: updatedAmort, error: updateErr } = await supabase
      .from("amortizaciones")
      .update({ fecha_pago })
      .eq("id", amortizacionId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 3. Obtener el préstamo
    const { data: prestamo, error: pErr } = await supabase
      .from("prestamos")
      .select("*")
      .eq("id", prestamoId)
      .single();

    if (pErr) throw pErr;

    // 4. Obtener todos los pagos actualizados y ajustes para recalcular la deuda/estado
    const [aRes, ajRes] = await Promise.all([
      supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
      supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
    ]);

    if (aRes.error) throw aRes.error;
    if (ajRes.error) throw ajRes.error;

    const pagosActualizados = aRes.data || [];
    const ajustes = ajRes.data || [];

    const deudaDespues = buildPaymentSchedule(prestamo, pagosActualizados, ajustes, new Date());

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

    // 5. Loguear la acción en bitácora de auditoría
    const { data: cliente } = await supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single();
    const username = (req as any).user?.username || "sistema";
    await logAction(
      username,
      "EDITAR_FECHA_PAGO",
      `Editó la fecha de pago de la amortización de S/. ${amortizacion.monto} del contrato de ${cliente ? cliente.nombre_completo : prestamo.cliente_id}. Cambió de ${fechaAnterior} a ${fecha_pago}.`,
      req,
      { prestamo_id: prestamoId, cliente_id: prestamo.cliente_id, amortizacion_id: amortizacionId }
    );

    // 6. Sincronizar cuotas actualizadas en Google Calendar
    syncLoanScheduleToGoogleCalendar(prestamoId).catch((calErr) => {
      console.error("Error al sincronizar cuotas tras edición de pago en Google Calendar:", calErr);
    });

    res.json({
      success: true,
      amortizacion: updatedAmort,
      estado_prestamo: nuevoEstado,
      deuda_actualizada: deudaDespues.resumen,
      cuotas_actualizadas: deudaDespues.cuotas
    });
  } catch (err: any) {
    console.error("Error al editar fecha de pago:", err);
    res.status(500).json({ error: "Error al editar fecha de pago", detail: err.message });
  }
});

app.post("/api/amortizaciones/:id/voucher", requireAuth, async (req, res) => {
  try {
    const amortizacionId = req.params.id;
    const { fileName, mimeType, base64Data } = req.body;

    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: "Datos del comprobante incompletos. Se requieren fileName, mimeType y base64Data." });
      return;
    }

    // Verificar configuracion de Drive antes de proceder
    if (!isDriveConfigured()) {
      res.status(503).json({
        error: "El almacenamiento de comprobantes (Google Drive) no esta configurado en este servidor.",
        detail: "Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el archivo .env para habilitar la subida de vouchers.",
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
        error: "No se pudo subir el comprobante a Google Drive. El pago ya fue registrado; puedes adjuntar el voucher nuevamente mas tarde.",
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
      console.error(`Voucher subido a Drive (${uploaded.fileId}) pero no se guardo en BD para amortizacion ${amortizacionId}:`, updateErr);
      res.status(500).json({
        error: "El comprobante se subio a Drive pero no se pudo guardar la referencia en la base de datos.",
        detail: updateErr.message,
        driveFileId: uploaded.fileId,
        driveUrl: uploaded.publicUrl
      });
      return;
    }

    const username = (req as any).user.username;
    await logAction(
      username,
      "ACTUALIZAR_VOUCHER",
      `Adjunto voucher a amortizacion ${amortizacionId} (prestamo ${amortizacion.prestamo_id}).`,
      req,
      { prestamo_id: amortizacion.prestamo_id, amortizacion_id: amortizacionId }
    );

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

// Endpoint proxy seguro para visualizar vouchers almacenados en Google Drive de forma privada y sin problemas de CORS/CSP
app.get("/api/vouchers/proxy/:fileId", requireAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = await getGoogleDriveAccessToken();

    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      console.error(`Error de Google Drive API al traer archivo ${fileId}: ${errText}`);
      res.status(driveRes.status).send(`No se pudo cargar el archivo desde Google Drive.`);
      return;
    }

    const contentType = driveRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache de 1 día

    // Obtener los datos del buffer de respuesta y enviarlos
    const arrayBuffer = await driveRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error al intermediar imagen de Google Drive:", err);
    res.status(500).send(`Error del servidor: ${err.message}`);
  }
});

// 7. Carga de Comprobante en Google Drive
app.post("/api/upload-voucher", requireAuth, async (req, res) => {
  try {
    const { fileName, mimeType, base64Data } = req.body;
    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: "Datos del comprobante incompletos. Se requieren fileName, mimeType y base64Data." });
      return;
    }

    // Verificar configuracion de Drive antes de proceder
    if (!isDriveConfigured()) {
      res.status(503).json({
        error: "El almacenamiento de comprobantes (Google Drive) no esta configurado en este servidor.",
        detail: "Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el archivo .env.",
        driveConfigured: false
      });
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
        error: "No se pudo subir el comprobante a Google Drive. Puedes registrar el pago sin imagen y adjuntar el voucher despues.",
        detail: driveErr.message,
        driveConfigured: true
      });
      return;
    }

    res.json({
      success: true,
      publicUrl: uploaded.publicUrl,
      directUrl: uploaded.directUrl,
      driveFileId: uploaded.fileId,
      driveWebViewLink: uploaded.webViewLink,
      driveWebContentLink: uploaded.webContentLink,
      driveFolderId: uploaded.folderId
    });
  } catch (err: any) {
    console.error("Error inesperado al subir voucher:", err);
    res.status(500).json({ error: "Error interno al subir el comprobante", detail: err.message });
  }
});

// Rutas para flujo de autorización de Google Drive OAuth 2.0
const getRedirectUri = (req: express.Request) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
};

app.get("/api/auth/google/login", (req, res) => {
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

app.get("/api/auth/google/callback", async (req, res) => {
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
                <li>Ve a la configuración de tu cuenta de Google (Seguridad > Aplicaciones con acceso a tu cuenta).</li>
                <li>Elimina el acceso de la aplicación (ej. "prestafacilito").</li>
                <li>Vuelve a intentar ingresar a: <a href="/api/auth/google/login" style="color: #60a5fa;">/api/auth/google/login</a></li>
              </ol>
            </div>
          </body>
        </html>
      `);
      return;
    }

    // Intentar escribir el refresh token directamente en el archivo .env de forma segura
    let envWriteStatus = "No se pudo escribir en el archivo .env automáticamente.";
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
      }
      // Actualizar la variable en memoria para evitar requerir reinicio del servidor
      process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
    } catch (fsErr: any) {
      console.warn("No se pudo escribir en el archivo .env:", fsErr);
    }

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc;">
          <div style="max-width: 600px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #3b82f6; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h2 style="color: #4ade80; margin-top: 0;">🎉 ¡Autenticación de Google Exitosa!</h2>
            <p>Hemos obtenido tu <b>Refresh Token</b> de larga duración de forma segura.</p>
            <p><b>Estado del archivo .env:</b> <span style="color: #4ade80; font-weight: bold;">${envWriteStatus}</span></p>
            
            <p>Si no se guardó automáticamente, cópialo manualmente y colócalo en tu archivo <code>.env</code> (o agrégalo como Environment Variable en tu panel de Vercel):</p>
            
            <div style="background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #475569; overflow-x: auto;">
              <code style="color: #38bdf8; font-size: 14px; word-break: break-all;">GOOGLE_REFRESH_TOKEN=${refreshToken}</code>
            </div>
            
            <p style="margin-top: 20px; font-size: 14px; color: #94a3b8;">
              💡 <i>Ya puedes cerrar esta ventana. Si estás en localhost, reinicia tu servidor local para aplicar el nuevo token. Si estás en Vercel, cópialo y agrégalo en las variables de entorno de tu proyecto en vercel.com.</i>
            </p>
            
            <a href="/" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-top: 15px; transition: background 0.2s;">
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

// Estado de configuracion de Google Drive
app.get("/api/drive/status", requireAuth, (_req, res) => {
  const configured = isDriveConfigured();
  const folderId = getDriveFolderId();
  res.json({
    configured,
    folderConfigured: !!folderId,
    message: configured
      ? "Google Drive esta configurado correctamente."
      : "Faltan credenciales de Google Drive. Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en .env."
  });
});

// AI Gemini Weekly Executive Financial Report endpoint (Token Optimized, On-Demand)
app.post("/api/ai/reporte-gerencial", requireAuth, async (req, res) => {
  try {
    // 1. Consultas paralelas a Supabase para agrupar métricas financieras reales
    const [pRes, aRes, cRes, lRes, ajRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("logs").select("*").order("fecha_hora", { ascending: false }).limit(10),
      supabase.from("ajustes_prestamo").select("*")
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;
    if (ajRes.error) throw ajRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];
    const logsRecientes = lRes.data || [];
    const todosAjustes = ajRes.data || [];

    // 2. Procesar métricas agregadas en NodeJS
    const totalCapital = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);

    let totalExigible = 0;
    for (const p of prestamos) {
      const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === p.id);
      const ajustesDelPrestamo = todosAjustes.filter(aj => aj.prestamo_id === p.id);
      const debtState = buildPaymentSchedule(p, pagosDelPrestamo, ajustesDelPrestamo, new Date());
      totalExigible += debtState.resumen.totalExigible;
    }
    const totalRecuperado = amortizaciones.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const saldoPendiente = Math.max(0, totalExigible - totalRecuperado);

    const prestamosActivos = prestamos.filter(p => p.estado === "activo");
    const prestamosPagados = prestamos.filter(p => p.estado === "pagado");

    // Detectar préstamos con mora (fecha de vencimiento expirada y estado activo)
    const hoyStr = new Date().toISOString().split("T")[0];
    const prestamosVencidos = prestamosActivos.filter(p => p.fecha_vencimiento && p.fecha_vencimiento < hoyStr);

    // Distribución de métodos de pago
    const metodosPago = amortizaciones.reduce((acc: Record<string, number>, a) => {
      acc[a.metodo_pago] = (acc[a.metodo_pago] || 0) + 1;
      return acc;
    }, {});

    // Construir el reporte consolidado estructurado para la IA
    const financialContext = {
      totalClientes: clientes.length,
      totalPrestamos: prestamos.length,
      prestamosActivosCount: prestamosActivos.length,
      prestamosPagadosCount: prestamosPagados.length,
      prestamosVencidosCount: prestamosVencidos.length,
      resumenFinanciero: {
        totalCapitalPrestado: Math.round(totalCapital * 100) / 100,
        totalExigibleConIntereses: Math.round(totalExigible * 100) / 100,
        totalRecuperadoAmortizado: Math.round(totalRecuperado * 100) / 100,
        saldoPendienteCobro: Math.round(saldoPendiente * 100) / 100,
        porcentajeRecuperacion: totalExigible > 0 ? Math.round((totalRecuperado / totalExigible) * 10000) / 100 : 0
      },
      prestamosVencidosDetalle: prestamosVencidos.map(p => {
        const c = clientes.find(cl => cl.id === p.cliente_id);
        return {
          cliente: c ? c.nombre_completo : "Desconocido",
          capital: p.monto_capital,
          vencimiento: p.fecha_vencimiento,
          tipo: p.tipo_prestamo
        };
      }),
      metodosPagoPopulares: metodosPago,
      logsRecientesAcciones: logsRecientes.map(l => ({
        usuario: l.usuario,
        accion: l.accion,
        detalles: l.detalles
      }))
    };

    // 3. Evaluar API Key para generar reporte
    if (!ai) {
      // Retorno de contingencia inteligente (Mock Corporativo muy detallado)
      const fechaLat = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
      const morosidadCalc = prestamosActivos.length > 0 ? Math.round((prestamosVencidos.length / prestamosActivos.length) * 100) : 0;

      return res.json({
        fechaReporte: fechaLat,
        saludFinanciera: `El negocio PrestaFacilito muestra un nivel de liquidez aceptable con un total amortizado de S/. ${totalRecuperado.toFixed(2)}. Sin embargo, mantener S/. ${saldoPendiente.toFixed(2)} por cobrar requiere una vigilancia constante de la cartera activa.`,
        tasaMorosidadPorcentaje: morosidadCalc,
        resumenDesempeño: "La operación se mantiene estable. Es imperativo contener la tasa de morosidad mediante incentivos y comunicación oportuna.",
        kpis: [
          {
            label: "Índice de Liquidez Corriente",
            value: `${(totalRecuperado > 0 ? (totalRecuperado / (saldoPendiente || 1)).toFixed(2) : "0.85")}x`,
            indicator: totalRecuperado > saldoPendiente ? "up" : "stable",
            descripcion: "Proporción de capital recuperado vs saldo exigible restante en la cartera."
          },
          {
            label: "Tasa de Cobro Exigible",
            value: `${(totalExigible > 0 ? Math.round((totalRecuperado / totalExigible) * 100) : 0)}%`,
            indicator: "up",
            descripcion: "Porcentaje global del capital e interés que ya ha sido amortizado efectivamente."
          },
          {
            label: "Vencimientos en Alerta",
            value: `${prestamosVencidos.length} créditos`,
            indicator: prestamosVencidos.length > 2 ? "down" : "stable",
            descripcion: "Préstamos activos que han superado su fecha límite de pago pactada."
          }
        ],
        analisisDetallado: {
          liquidez: `Con un capital colocado de S/. ${totalCapital.toFixed(2)} y S/. ${totalRecuperado.toFixed(2)} ya recuperados, el flujo de caja operativo actual muestra estabilidad. Se sugiere optimizar el saldo remanente de S/. ${saldoPendiente.toFixed(2)} para mejorar los indicadores de tesorería inmediata.`,
          riesgos: `La tasa de morosidad estimada se sitúa en ${morosidadCalc}%. El principal foco de riesgo se concentra en los ${prestamosVencidos.length} créditos vencidos. Se recomienda congelar nuevas colocaciones a clientes con antecedentes de retraso y ejecutar notificaciones formales inmediatas.`,
          eficiencia: `Yape, Plin y canales digitales representan las vías de cobro más ágiles. Se debe incentivar la conciliación exprés mediante vouchers con OCR para evitar vacíos operativos y retrasos en la actualización de saldos.`
        },
        proyeccionesCaja: [
          { period: "Semana 1", cobroEstimado: Math.round(saldoPendiente * 0.15), morosidadEstimada: Math.max(2, Math.round(morosidadCalc * 0.9)) },
          { period: "Semana 2", cobroEstimado: Math.round(saldoPendiente * 0.25), morosidadEstimada: Math.max(1, Math.round(morosidadCalc * 0.8)) },
          { period: "Semana 3", cobroEstimado: Math.round(saldoPendiente * 0.35), morosidadEstimada: Math.max(1, Math.round(morosidadCalc * 0.6)) },
          { period: "Semana 4", cobroEstimado: Math.round(saldoPendiente * 0.20), morosidadEstimada: 0 }
        ],
        estrategiasCobranza: [
          {
            titulo: "Notificación Masiva Express por WhatsApp",
            descripcion: "Enviar recordatorios amigables de pago estructurados por la IA a los prestatarios con vencimientos dentro de los próximos 3 días.",
            impacto: "Alto",
            prioridad: "Alta"
          },
          {
            titulo: "Condonación de Interés Moratorio Temporal",
            descripcion: "Ofrecer descuentos del 50% en intereses devengados únicamente para los créditos vencidos que liquiden su capital total esta semana.",
            impacto: "Alto",
            prioridad: "Media"
          },
          {
            titulo: "Adopción de Conciliación OCR",
            descripcion: "Facilitar el registro de abonos cargando directamente las capturas de Yape/BCP desde el celular para reducir errores manuales de digitación.",
            impacto: "Medio",
            prioridad: "Alta"
          }
        ],
        contextoFinanciero: financialContext
      });
    }

    const prompt = `Actúa como un Director Financiero (CFO) y Consultor Estratégico experto para microempresas de préstamo y crédito personal en el Perú.
    Analiza detalladamente el siguiente resumen estructurado de nuestra cartera de clientes y préstamos en Soles Peruanos (S/.) de PrestaFacilito:
    ${JSON.stringify(financialContext, null, 2)}
    
    Genera un informe gerencial, estratégico, sumamente profesional y limpio para la dirección general.
    
    La respuesta debe ser estrictamente un objeto JSON válido. No incluyes bloques de código \`\`\`json ni texto introductorio o conclusivo. Devuelve solo el JSON válido de acuerdo a este esquema exacto:
    {
      "fechaReporte": "Fecha actual en formato amigable de Perú (ej: 22 de Mayo de 2026)",
      "saludFinanciera": "Diagnóstico profesional, asertivo, limpio y de alto nivel sobre la salud general de la cartera de préstamos, el capital activo y el nivel de cobro (máximo 3 frases)",
      "tasaMorosidadPorcentaje": número entero de 0 a 100 (tasa calculada de morosidad basada en préstamos vencidos vs préstamos activos)",
      "resumenDesempeño": "Mensaje ejecutivo directivo para motivar y orientar el trabajo administrativo de la semana en base a los datos observados",
      "kpis": [
        {
          "label": "Nombre del indicador formal (ej: Rentabilidad de Cartera, Rotación de Capital)",
          "value": "Valor calculado del KPI (ej: 14.5%, S/. 2,300, 1.25x)",
          "indicator": "dirección del indicador: 'up' (bueno/sube), 'down' (crítico/baja) o 'stable' (estable)",
          "descripcion": "Breve explicación gerencial del indicador de 1 frase"
        }
      ],
      "analisisDetallado": {
        "liquidez": "Análisis exhaustivo sobre la liquidez de caja, velocidad de amortización y capacidad de reinversión en nuevos créditos",
        "riesgos": "Evaluación rigurosa de los riesgos asociados a los créditos en mora o alertas por retrasos observadas",
        "eficiencia": "Dictamen de la eficiencia en los procesos de cobro, medios preferidos de pago por los clientes y uso de conciliación digital"
      },
      "proyeccionesCaja": [
        { "period": "Semana 1", "cobroEstimado": número entero (soles proyectados a recuperar), "morosidadEstimada": número (tasa de mora proyectada) },
        { "period": "Semana 2", "cobroEstimado": número entero, "morosidadEstimada": número },
        { "period": "Semana 3", "cobroEstimado": número entero, "morosidadEstimada": number },
        { "period": "Semana 4", "cobroEstimado": número entero, "morosidadEstimada": número }
      ],
      "estrategiasCobranza": [
        {
          "titulo": "Título de la estrategia comercial o de cobranza",
          "descripcion": "Descripción detallada de la acción operativa que el administrador debe ejecutar inmediatamente",
          "impacto": "Nivel de impacto estimado: 'Alto' o 'Medio'",
          "prioridad": "Nivel de urgencia: 'Alta', 'Media' o 'Baja'"
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    res.json({
      ...result,
      contextoFinanciero: financialContext
    });
  } catch (err: any) {
    console.error("Error en reporte-gerencial:", err);
    res.status(500).json({ error: "Error al generar reporte gerencial", detail: err.message });
  }
});

// AI Gemini collection message generator endpoint
app.post("/api/ai/mensaje-cobro", requireAuth, async (req, res) => {
  try {
    const { clienteNombre, saldoPendiente, fechaVencimiento } = req.body;
    if (!clienteNombre) {
      res.status(400).json({ error: "El nombre del cliente es obligatorio" });
      return;
    }

    const username = (req as any).user?.username || "sjaquer";
    const senderName = username === "rjaque" ? "Roberto" : "Sebastián";

    if (!ai) {
      const msg = `¡Hola, ${clienteNombre}! Te saluda ${senderName} de PrestaFacilito. Te recordamos amablemente tu pago pendiente de S/. ${parseFloat(saldoPendiente).toFixed(2)} con vencimiento el ${fechaVencimiento || "próximo vencimiento"}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un excelente día!`;
      return res.json({ mensaje: msg });
    }

    const prompt = `Genera un mensaje recordatorio de cobro de préstamo personalizado y amigable para enviar por WhatsApp.
    Cliente: ${clienteNombre}
    Saldo Pendiente: S/. ${parseFloat(saldoPendiente).toFixed(2)}
    Fecha de Vencimiento: ${fechaVencimiento}
    Emisor/Cobrador: ${senderName} (El mensaje DEBE mencionar: "Te saluda ${senderName} de PrestaFacilito.")
    
    El tono debe ser: profesional, respetuoso, empático, pero claro y asertivo (muy adaptado al habla peruana amigable, usando palabras como 'Te recordamos amablemente', 'PrestaFacilito', etc.).
    Evita el uso excesivo de emojis. Usa como máximo uno o dos si es estrictamente necesario, manteniendo un tono formal de finanzas corporativas.
    Responde estrictamente con un objeto JSON válido con el siguiente formato:
    {
      "mensaje": "Mensaje para WhatsApp formateado listo para enviar."
    }
    No incluyes markdown, bloques de código, ni texto adicional fuera del JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    res.json(result);
  } catch (err: any) {
    console.error("Error en mensaje-cobro:", err);
    res.status(500).json({ error: "Error al generar mensaje de cobro", detail: err.message });
  }
});

// ========================================================
// ENDPOINTS PARA PLAN DE AYUDA AL CLIENTE (AJUSTES)
// ========================================================

app.get("/api/prestamos/:id/ajustes", requireAuth, async (req, res) => {
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

app.post("/api/prestamos/:id/ajustes", requireAuth, async (req, res) => {
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

    const username = (req as any).user.username;

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

    // Obtener cliente y info del préstamo para logs
    const { data: prestamo } = await supabase
      .from("prestamos")
      .select("cliente_id, monto_capital")
      .eq("id", prestamoId)
      .single();

    let clienteNombre = prestamoId;
    if (prestamo) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nombre_completo")
        .eq("id", prestamo.cliente_id)
        .single();
      if (cliente) {
        clienteNombre = cliente.nombre_completo;
      }
    }

    await logAction(
      username,
      "CREAR_AJUSTE_PRESTAMO",
      `Aplicó ajuste de tipo ${tipo} al préstamo de ${clienteNombre}. Motivo: ${motivo}. Detalles: Monto antes: S/. ${monto_antes || 0} | después: S/. ${monto_despues || 0}.`,
      req
    );

    res.status(201).json(newAdj);
  } catch (err: any) {
    console.error("Error al crear ajuste:", err);
    res.status(500).json({ error: "Error al aplicar el ajuste", detail: err.message });
  }
});

app.patch("/api/prestamos/:id/ajustes/:ajusteId", requireAuth, async (req, res) => {
  try {
    const { ajusteId } = req.params;
    const { activo } = req.body;
    const username = (req as any).user.username;

    const { data: updatedAdj, error } = await supabase
      .from("ajustes_prestamo")
      .update({ activo })
      .eq("id", ajusteId)
      .select()
      .single();

    if (error) throw error;

    await logAction(
      username,
      activo ? "ACTIVAR_AJUSTE_PRESTAMO" : "DESACTIVAR_AJUSTE_PRESTAMO",
      `${activo ? "Activó" : "Desactivó"} el ajuste ${ajusteId} del préstamo ${updatedAdj.prestamo_id}.`,
      req
    );

    res.json(updatedAdj);
  } catch (err: any) {
    console.error("Error al actualizar ajuste:", err);
    res.status(500).json({ error: "Error al modificar el estado del ajuste", detail: err.message });
  }
});

// ========================================================
// ENDPOINTS DE DOCUMENTOS DE CLIENTES (v2)
// ========================================================

// Listar documentos de un cliente
app.get("/api/clientes/:id/documentos", requireAuth, async (req, res) => {
  try {
    const clienteId = req.params.id;
    const { data, error } = await supabase
      .from('documentos_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_subida', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    console.error('Error al obtener documentos:', err);
    res.status(500).json({ error: 'Error al obtener documentos', detail: err.message });
  }
});

// Subir documento de cliente a Google Drive
app.post("/api/clientes/:id/documentos", requireAuth, async (req, res) => {
  try {
    const clienteId = req.params.id;
    const { fileName, mimeType, base64Data, tipo_documento, observacion } = req.body;

    if (!fileName || !mimeType || !base64Data || !tipo_documento) {
      res.status(400).json({ error: 'Faltan campos requeridos: fileName, mimeType, base64Data, tipo_documento.' });
      return;
    }

    if (!isDriveConfigured()) {
      res.status(503).json({ error: 'Google Drive no está configurado.', driveConfigured: false });
      return;
    }

    // Obtener cliente y su carpeta en Drive
    const { data: cliente, error: clienteErr } = await supabase
      .from('clientes')
      .select('nombre_completo, drive_folder_id')
      .eq('id', clienteId)
      .single();

    if (clienteErr || !cliente) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    // Crear subcarpeta si no existe
    let folderId = cliente.drive_folder_id;
    if (!folderId) {
      try {
        folderId = await createDriveSubfolder(cliente.nombre_completo, GOOGLE_DRIVE_CLIENTES_FOLDER_ID);
        await supabase.from('clientes').update({ drive_folder_id: folderId }).eq('id', clienteId);
      } catch (folderErr: any) {
        res.status(502).json({ error: 'No se pudo crear la carpeta del cliente en Drive.', detail: folderErr.message });
        return;
      }
    }

    // Subir el archivo
    const buffer = Buffer.from(base64Data, 'base64');
    let uploaded;
    try {
      uploaded = await uploadDocumentToDrive(fileName, mimeType, buffer, folderId);
    } catch (uploadErr: any) {
      res.status(502).json({ error: 'No se pudo subir el documento a Drive.', detail: uploadErr.message });
      return;
    }

    // Guardar referencia en la BD
    const { data: docData, error: docErr } = await supabase
      .from('documentos_cliente')
      .insert({
        cliente_id: clienteId,
        tipo_documento,
        nombre_archivo: fileName,
        drive_file_id: uploaded.fileId,
        drive_url: uploaded.publicUrl,
        mime_type: mimeType,
        observacion: observacion || ''
      })
      .select()
      .single();

    if (docErr) throw docErr;

    const username = (req as any).user.username;
    await logAction(username, 'SUBIR_DOCUMENTO_CLIENTE', `Subió ${tipo_documento} para cliente ${cliente.nombre_completo}.`, req);

    res.status(201).json(docData);
  } catch (err: any) {
    console.error('Error al subir documento:', err);
    res.status(500).json({ error: 'Error al subir documento', detail: err.message });
  }
});

// Eliminar documento de cliente
app.delete("/api/clientes/:id/documentos/:docId", requireAuth, async (req, res) => {
  try {
    const { docId } = req.params;
    const { error } = await supabase
      .from('documentos_cliente')
      .delete()
      .eq('id', docId);

    if (error) throw error;

    const username = (req as any).user.username;
    await logAction(username, 'ELIMINAR_DOCUMENTO_CLIENTE', `Eliminó documento ${docId}.`, req);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error al eliminar documento:', err);
    res.status(500).json({ error: 'Error al eliminar documento', detail: err.message });
  }
});

// Proxy para visualizar documentos de clientes desde Google Drive
app.get("/api/documentos/proxy/:fileId", requireAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const accessToken = await getGoogleDriveAccessToken();

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok) {
      res.status(driveRes.status).send('No se pudo cargar el documento desde Google Drive.');
      return;
    }

    const contentType = driveRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await driveRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error al servir documento:', err);
    res.status(500).send(`Error: ${err.message}`);
  }
});

// Helper to calculate timezone-safe YYYY-MM-DD ranges for current and past month
function getMonthRanges(baseDate: Date = new Date()) {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth(); // 0-indexed

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

// Endpoint to synchronize Google Calendar events for the current month and clean up the past month
app.post("/api/calendar/sync-month", requireAuth, async (req, res) => {
  if (!isGoogleCalendarConfigured()) {
    res.status(503).json({ error: "Google Calendar no está configurado en las variables de entorno." });
    return;
  }

  const username = (req as any).user?.username || "Admin";

  try {
    const ranges = getMonthRanges();
    const curStart = ranges.currentMonth.start;
    const curEnd = ranges.currentMonth.end;
    const pastStart = ranges.pastMonth.start;
    const pastEnd = ranges.pastMonth.end;

    console.log(`[CalendarSync] Iniciando sincronización. Mes actual: ${curStart} al ${curEnd}. Mes pasado: ${pastStart} al ${pastEnd}.`);

    const accessToken = await getGoogleAccessToken();

    // 1. Obtener eventos de Google Calendar del mes pasado para depuración
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

    // Filtrar estrictamente eventos de PrestaFacilito
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

    console.log(`[CalendarSync] Encontrados ${loanEventsToDelete.length} eventos de préstamos para eliminar del mes pasado.`);

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

    // 2. Obtener préstamos activos para sincronizar cuotas del mes actual
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

          // Calcular cronograma
          const debtState = buildPaymentSchedule(prestamo, pagosRealizados, ajustes, new Date());
          const cuotas = debtState.cuotas;

          const existingEvents = Array.isArray(prestamo.google_calendar_events)
            ? prestamo.google_calendar_events
            : [];

          const updatedEventsList: any[] = [];

          // Procesar todas las cuotas del préstamo
          for (const cuota of cuotas) {
            const isCurrentMonth = cuota.fechaVencimiento >= curStart && cuota.fechaVencimiento <= curEnd;
            const isPastMonth = cuota.fechaVencimiento >= pastStart && cuota.fechaVencimiento <= pastEnd;

            const existing = existingEvents.find((e: any) => e.numero === cuota.numero);

            if (isCurrentMonth) {
              // Sincronizar cuota de mes actual
              let colorId = "5"; // Yellow (Banana) - Pendiente por defecto
              let statusPrefix = "🔔 [PENDIENTE]";

              if (cuota.estado === "Saldada") {
                colorId = "10"; // Green (Basil)
                statusPrefix = "✅ [PAGADO]";
              } else if (cuota.estado === "Parcial") {
                colorId = "6"; // Orange (Tangerine)
                statusPrefix = "🔶 [PARCIAL]";
              } else if (cuota.estado === "Vencida") {
                colorId = "11"; // Red (Tomato)
                statusPrefix = "🚨 [VENCIDO]";
              }

              const summary = `${statusPrefix} Cuota ${cuota.numero} - ${cliente.nombre_completo}`;
              const description = [
                `📊 ESTADO DEL CRÉDITO:`,
                `• Cliente: ${cliente.nombre_completo}`,
                `• Teléfono: ${cliente.telefono || "No registrado"}`,
                `• Tipo de Préstamo: ${prestamo.tipo_prestamo || "Personal"}`,
                `• N° de Cuota: ${cuota.numero} de ${debtState.resumen.totalCuotas}`,
                `• Monto de la Cuota: S/. ${cuota.montoExigible.toFixed(2)}`,
                `• Capital de Cuota: S/. ${cuota.capitalPendiente.toFixed(2)}`,
                `• Interés de Cuota: S/. ${(cuota.interesOriginal ?? 0).toFixed(2)}`,
                cuota.moraPendiente > 0 ? `• Mora Pendiente: S/. ${cuota.moraPendiente.toFixed(2)}` : null,
                `• Total Pagado en esta cuota: S/. ${cuota.pagado.toFixed(2)}`,
                `• Saldo Pendiente: S/. ${cuota.saldoPendiente.toFixed(2)}`,
                `• Fecha de Vencimiento: ${cuota.fechaVencimiento}`,
                `• Estado de la Cuota: ${cuota.estado}`,
                `\n📅 Registro actualizado automáticamente desde PrestaFacilito.`
              ].filter(Boolean).join("\n");

              try {
                const calEvent = await createOrUpdateGoogleCalendarEvent({
                  eventId: existing?.eventId,
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
              // Si estaba registrado en base de datos para el mes pasado, se descarta del array ya que fue eliminado del calendario
              console.log(`[CalendarSync] Descartando evento del mes pasado del préstamo ${prestamo.id}, cuota ${cuota.numero}`);
            } else {
              // Mantener eventos de otros meses intactos
              if (existing) {
                updatedEventsList.push(existing);
              }
            }
          }

          // Actualizar préstamo en Supabase con la nueva lista de eventos
          await supabase
            .from("prestamos")
            .update({ google_calendar_events: updatedEventsList })
            .eq("id", prestamo.id);

        } catch (loanErr: any) {
          console.error(`[CalendarSync] Error al procesar préstamo ${prestamo.id}:`, loanErr.message);
        }
      }
    }

    const actionDetails = `Sincronización mensual de calendario ejecutada de forma exitosa. Se actualizaron/sincronizaron ${syncedCount} cuotas del mes actual y se eliminaron ${deletedCount} eventos obsoletos del mes pasado de préstamos en el calendario.`;
    await logAction(username, "SINCRONIZAR_CALENDARIO_MENSUAL", actionDetails, req);

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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
