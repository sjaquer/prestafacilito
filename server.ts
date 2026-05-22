import "dotenv/config";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "./src/lib/supabase.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta configurar la variable de entorno ${name}.`);
  }
  return value;
}

const JWT_SECRET = requireEnv("JWT_SECRET");
const ADMIN_USER = requireEnv("ADMIN_USER");
const ADMIN_PASS = requireEnv("ADMIN_PASS");
const PORT = Number(process.env.PORT || 3000);

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

async function startServer() {
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
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Sesión inválida o expirada" });
    }
  };

  // Rutas de Autenticación
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" });
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
      const decoded = jwt.verify(token, JWT_SECRET);
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

      const [cRes, aRes] = await Promise.all([
        supabase.from("clientes").select("*").eq("id", prestamo.cliente_id).single(),
        supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId)
      ]);

      const cliente = cRes.data;
      const pagosRealizados = aRes.data || [];

      // Conversión de tipos para cálculos de negocio
      const capital = parseFloat(prestamo.monto_capital) || 0;
      const tasaInteres = parseFloat(prestamo.tasa_interes_porcentaje) || 0;
      const totalAPagar = capital * (1 + tasaInteres / 100);
      const totalPagado = pagosRealizados.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
      const saldoPendiente = Math.max(0, totalAPagar - totalPagado);

      res.json({
        prestamo: {
          ...prestamo,
          monto_capital: capital,
          tasa_interes_porcentaje: tasaInteres,
          total_a_pagar: totalAPagar,
          total_pagado: totalPagado,
          saldo_pendiente: saldoPendiente,
          cliente_nombre: cliente ? cliente.nombre_completo : "Cliente desconocido",
          cliente_telefono: cliente ? cliente.telefono : ""
        },
        pagosRealizados
      });
    } catch (err: any) {
      console.error("Error al cargar detalle de préstamo:", err);
      res.status(500).json({ error: "Error al cargar detalle del préstamo", detail: err.message });
    }
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

      // Obtener pagos previos
      const { data: pagosPrevios, error: aErr } = await supabase
        .from("amortizaciones")
        .select("*")
        .eq("prestamo_id", prestamoId);

      if (aErr) throw aErr;

      // Insertar la amortización en Supabase
      const nuevaAmortizacion = {
        prestamo_id: prestamoId,
        tipo_movimiento: tipo_movimiento || "Pago Ordinario",
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

      // Recalcular saldo e intereses
      const capital = parseFloat(prestamo.monto_capital) || 0;
      const tasaInteres = parseFloat(prestamo.tasa_interes_porcentaje) || 0;
      const totalAPagar = capital * (1 + tasaInteres / 100);
      const totalPagado = (pagosPrevios || []).reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0) + montoPago;

      const saldoPendiente = Math.max(0, totalAPagar - totalPagado);
      let nuevoEstado = prestamo.estado;

      if (saldoPendiente <= 0.01) {
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
        `Abonó S/. ${montoPago} (Vía: ${metodo_pago}) al préstamo de: ${cliente ? cliente.nombre_completo : prestamo.cliente_id}`
      );

      res.status(201).json({
        success: true,
        nuevaAmortizacion: insertedAmort,
        saldo_pendiente: saldoPendiente,
        estado_prestamo: nuevoEstado
      });
    } catch (err: any) {
      console.error("Error al registrar pago:", err);
      res.status(500).json({ error: "Error al registrar abono/pago", detail: err.message });
    }
  });

  // 7. Carga de Comprobante en Supabase Storage
  app.post("/api/upload-voucher", requireAuth, async (req, res) => {
    try {
      const { fileName, mimeType, base64Data } = req.body;
      if (!fileName || !mimeType || !base64Data) {
        res.status(400).json({ error: "Datos del comprobante incompletos" });
        return;
      }

      // Decodificar el archivo base64 a Buffer
      const buffer = Buffer.from(base64Data, "base64");

      // Nombre único para el comprobante
      const uniqueName = `${Date.now()}-${fileName}`;

      // Subir archivo al bucket "vouchers" en Supabase Storage
      const { data, error } = await supabase.storage
        .from("vouchers")
        .upload(uniqueName, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) throw error;

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from("vouchers")
        .getPublicUrl(uniqueName);

      res.json({
        success: true,
        publicUrl: publicUrlData.publicUrl
      });
    } catch (err: any) {
      console.error("Error al subir archivo a Supabase Storage:", err);
      res.status(500).json({ error: "No se pudo subir el comprobante de pago", detail: err.message });
    }
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
          { "period": "Semana 3", "cobroEstimado": número entero, "morosidadEstimada": número },
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
      No incluyas markdown, bloques de código, ni texto adicional fuera del JSON.`;

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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
