import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";
import { JWT, OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import { supabase } from "./src/lib/supabase.js";
import { buildPaymentSchedule, classifyPayment, toNumber } from "./src/lib/loanLogic.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

// Variables cacheadas dinámicamente para no crashear en Vercel
const getJwtSecret = () => getEnv("JWT_SECRET") || "fallback-secret-para-evitar-crashes-500";
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

// Helper para auditoría de acciones (Logs) en Supabase
async function logAction(usuario: string, accion: string, detalles: string) {
  try {
    await supabase.from("logs").insert({
      usuario,
      accion,
      detalles
    });
  } catch (err) {
    console.error("⚠️ Error al registrar log de auditoría:", err);
  }
}

const app = express();

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

// Rutas de Autenticación
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (username === getAdminUser() && password === getAdminPass()) {
    const token = jwt.sign({ username }, getJwtSecret(), { expiresIn: "24h" });
    res.cookie("token", token, cookieOptions);
    await logAction(username, "INICIAR_SESION", "El administrador inició sesión de forma exitosa.");
    res.json({ success: true, username });
  } else {
    res.status(401).json({ success: false, message: "Credenciales incorrectas" });
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
  await logAction(username, "CERRAR_SESION", "El administrador cerró sesión.");
  res.clearCookie("token", cookieOptions);
  res.json({ success: true });
});

// ==========================================
// RUTAS DEL NEGOCIO (PROTEGIDAS POR AUTH)
// ==========================================

// 1. Bitácora de Auditoría (Logs)
app.get("/api/logs", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("fecha_hora", { ascending: false })
      .limit(30);

    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    console.error("Error al obtener logs:", err);
    res.status(500).json({ error: "Error de servidor al obtener logs", detail: err.message });
  }
});

// Test de conectividad a Supabase (Legacy endpoint para mantener compatibilidad)
app.post("/api/initialize-sheets", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from("clientes").select("id").limit(1);
    if (error) throw error;
    
    const username = (req as any).user.username;
    await logAction(username, "CONECTAR_SUPABASE", "Conexión a base de datos Supabase verificada de forma manual.");
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
    await logAction(username, "SEMBRAR_DATOS", "Se sembró la base de datos Supabase con clientes, préstamos y amortizaciones de ejemplo.");

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
    res.json(data || []);
  } catch (err: any) {
    console.error("Error al obtener clientes:", err);
    res.status(500).json({ error: "Error al obtener clientes", detail: err.message });
  }
});

app.post("/api/clientes", requireAuth, async (req, res) => {
  try {
    const { nombre_completo, telefono, observaciones } = req.body;
    
    if (!nombre_completo) {
      res.status(400).json({ error: "El nombre completo es requerido" });
      return;
    }

    // Sanitizar número de teléfono (removiendo +)
    const telSanitized = telefono ? telefono.replace(/\+/g, "").trim() : "";

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nombre_completo,
        telefono: telSanitized,
        observaciones: observaciones || ""
      })
      .select()
      .single();

    if (error) throw error;

    const username = (req as any).user.username;
    await logAction(
      username, 
      "CREAR_CLIENTE", 
      `Se registró al cliente: ${nombre_completo} (Tel: ${telSanitized})`
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
    const { nombre_completo, telefono, observaciones, direccion, informacion_adicional } = req.body;

    if (!nombre_completo) {
      res.status(400).json({ error: "El nombre completo es requerido" });
      return;
    }

    const extraNotas = [direccion, informacion_adicional].filter(Boolean).join(" | ");
    const observacionesFinales = [observaciones || "", extraNotas].filter(Boolean).join(observaciones && extraNotas ? "\n" : "");
    const telSanitized = telefono ? String(telefono).replace(/\+/g, "").trim() : "";

    const { data, error } = await supabase
      .from("clientes")
      .update({
        nombre_completo,
        telefono: telSanitized,
        observaciones: observacionesFinales
      })
      .eq("id", clienteId)
      .select()
      .single();

    if (error) throw error;

    const username = (req as any).user.username;
    await logAction(username, "EDITAR_CLIENTE", `Actualizó el cliente: ${nombre_completo}`);

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
      `Otorgó crédito ${tipo_prestamo} de S/. ${monto_capital} al cliente: ${cliente ? cliente.nombre_completo : cliente_id}`
    );

    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al crear préstamo:", err);
    res.status(500).json({ error: "Error al crear préstamo", detail: err.message });
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
    const totalBaseExigible = capital * (1 + tasaInteres / 100);

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
    const { fecha_emision, fecha_vencimiento } = req.body;

    const { data: updated, error } = await supabase
      .from("prestamos")
      .update({
        fecha_emision,
        fecha_vencimiento
      })
      .eq("id", prestamoId)
      .select()
      .single();

    if (error) throw error;

    const { data: cliente } = await supabase.from("clientes").select("nombre_completo").eq("id", updated.cliente_id).single();

    const username = (req as any).user.username;
    await logAction(
      username,
      "EDITAR_PRESTAMO",
      `Actualizó fechas del préstamo ${updated.tipo_prestamo} de S/. ${updated.monto_capital} del cliente: ${cliente ? cliente.nombre_completo : updated.cliente_id}`
    );

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
    const clasificacionAutomatica = classifyPayment(montoPago, deudaAntes);
    const excedenteAplicado = Math.max(0, montoPago - deudaAntes.resumen.totalExigible);

    // Insertar la amortización en Supabase
    const nuevaAmortizacion = {
      prestamo_id: prestamoId,
      tipo_movimiento: clasificacionAutomatica,
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

    // Obtener cliente para logs
    const { data: cliente } = await supabase.from("clientes").select("nombre_completo").eq("id", prestamo.cliente_id).single();

    const username = (req as any).user.username;
    await logAction(
      username,
      "REGISTRAR_PAGO",
      `Abonó S/. ${montoPago} (${clasificacionAutomatica}) al préstamo de: ${cliente ? cliente.nombre_completo : prestamo.cliente_id}`
    );

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
        tipo_prestamo: prestamo ? prestamo.tipo_prestamo : "Personal"
      };
    });

    res.json(detailed);
  } catch (err: any) {
    console.error("Error al obtener amortizaciones:", err);
    res.status(500).json({ error: "Error al obtener amortizaciones", detail: err.message });
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
        detail: "Configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en el archivo .env para habilitar la subida de vouchers.",
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
      `Adjunto voucher a amortizacion ${amortizacionId} (prestamo ${amortizacion.prestamo_id}).`
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
app.get("/api/auth/google/login", (req, res) => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  
  if (!clientId || !clientSecret) {
    res.status(400).send("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tu archivo .env");
    return;
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret, "http://localhost:3000/api/auth/google/callback");
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive"],
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

  const oauth2Client = new OAuth2Client(clientId, clientSecret, "http://localhost:3000/api/auth/google/callback");

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
            
            <p>Si no se guardó automáticamente, cópialo manualmente y colócalo en tu archivo <code>.env</code>:</p>
            
            <div style="background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #475569; overflow-x: auto;">
              <code style="color: #38bdf8; font-size: 14px; word-break: break-all;">GOOGLE_REFRESH_TOKEN=${refreshToken}</code>
            </div>
            
            <p style="margin-top: 20px; font-size: 14px; color: #94a3b8;">
              💡 <i>Ya puedes cerrar esta ventana. Reinicia tu servidor local para que aplique el nuevo token en caso de que no se actualice dinámicamente.</i>
            </p>
            
            <a href="http://localhost:3000" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-top: 15px; transition: background 0.2s;">
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
    const [pRes, aRes, cRes, lRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("logs").select("*").order("fecha_hora", { ascending: false }).limit(10)
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];
    const logsRecientes = lRes.data || [];

    // 2. Procesar métricas agregadas en NodeJS
    const totalCapital = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);
    const totalExigible = prestamos.reduce((sum, p) => sum + ((parseFloat(p.monto_capital) || 0) * (1 + (parseFloat(p.tasa_interes_porcentaje) || 0) / 100)), 0);
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
    if (!process.env.GEMINI_API_KEY) {
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

    if (!process.env.GEMINI_API_KEY) {
      const msg = `¡Hola, ${clienteNombre}! Te saludamos de parte de PrestaFacilito. Te recordamos amablemente que tienes un pago pendiente por el monto de S/. ${parseFloat(saldoPendiente).toFixed(2)} con vencimiento el ${fechaVencimiento || "próximo vencimiento"}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un excelente día!`;
      return res.json({ mensaje: msg });
    }

    const prompt = `Genera un mensaje recordatorio de cobro de préstamo personalizado y amigable para enviar por WhatsApp.
    Cliente: ${clienteNombre}
    Saldo Pendiente: S/. ${parseFloat(saldoPendiente).toFixed(2)}
    Fecha de Vencimiento: ${fechaVencimiento}
    
    El tono debe ser: profesional, respetuoso, empático, pero claro y asertivo (muy adaptado al habla peruana amigable, usando palabras como 'Te recordamos amablemente', 'PrestaFacilito', etc.).
    Debe contener íconos emoji relevantes para facilitar la lectura y destacar los datos clave como el saldo y la fecha.
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
      `Aplicó ajuste de tipo ${tipo} al préstamo de ${clienteNombre}. Motivo: ${motivo}`
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
      `${activo ? "Activó" : "Desactivó"} el ajuste ${ajusteId} del préstamo ${updatedAdj.prestamo_id}.`
    );

    res.json(updatedAdj);
  } catch (err: any) {
    console.error("Error al actualizar ajuste:", err);
    res.status(500).json({ error: "Error al modificar el estado del ajuste", detail: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
