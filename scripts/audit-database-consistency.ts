import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { buildPaymentSchedule, round2 } from "../src/lib/loanLogic";
import { buildAlquilerSchedule } from "../src/lib/alquilerLogic";

// Cargar variables de entorno desde .env de forma manual si dotenv no está disponible
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: No se encontraron SUPABASE_URL ni SUPABASE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DiscrepancyRecord {
  id: string;
  tipo: "prestamo" | "alquiler";
  cliente: string;
  campo: string;
  valorCalculado: any;
  valorRegistrado: any;
  descripcion: string;
}

async function runAudit() {
  console.log("🔍 INICIANDO AUDITORÍA INTEGRAL DE CONSISTENCIA CON SUPABASE...");
  console.log(`📡 Conectando a Supabase URL: ${supabaseUrl}\n`);

  const timestamp = new Date().toISOString();
  const hoy = new Date();
  const discrepancias: DiscrepancyRecord[] = [];

  // 1. Auditar Préstamos
  const { data: prestamos, error: errP } = await supabase.from("prestamos").select("*");
  const { data: amortizaciones, error: errA } = await supabase.from("amortizaciones").select("*");
  const { data: clientes, error: errC } = await supabase.from("clientes").select("*");
  const { data: ajustes, error: errAj } = await supabase.from("ajustes_prestamo").select("*");

  if (errP || errA || errC) {
    console.error("❌ Error al obtener datos de Supabase:", errP || errA || errC);
    process.exit(1);
  }

  const listPrestamos = prestamos || [];
  const listAmortizaciones = amortizaciones || [];
  const listClientes = clientes || [];
  const listAjustes = ajustes || [];

  console.log(`📊 Préstamos a auditar: ${listPrestamos.length}`);
  console.log(`💳 Amortizaciones registradas: ${listAmortizaciones.length}`);
  console.log(`👤 Clientes registrados: ${listClientes.length}\n`);

  let totalCapitalCirculacionCalculado = 0;
  let prestamosLiquidadosCalculados = 0;
  let prestamosActivosCalculados = 0;
  let prestamosEstancadosCalculados = 0;

  for (const p of listPrestamos) {
    const cliente = listClientes.find((c) => c.id === p.cliente_id);
    const pagosP = listAmortizaciones.filter((a) => a.prestamo_id === p.id);
    const ajustesP = listAjustes.filter((aj) => aj.prestamo_id === p.id);

    const schedule = buildPaymentSchedule(p, pagosP, { ajustes: ajustesP, referenceDate: hoy });
    const res = schedule.resumen;

    totalCapitalCirculacionCalculado += res.capitalPendiente;

    if (res.capitalPendiente <= 0.01 && res.moraAcumulada <= 0.01) {
      prestamosLiquidadosCalculados++;
    } else if (res.esEstancado) {
      prestamosEstancadosCalculados++;
    } else {
      prestamosActivosCalculados++;
    }

    // Verificar si el estado del préstamo en la BD coincide con el calculado por la regla de negocio
    let estadoEsperadoBD = "activo";
    if (res.capitalPendiente <= 0.01 && res.moraAcumulada <= 0.01) {
      estadoEsperadoBD = "liquidado";
    } else if (res.esEstancado) {
      estadoEsperadoBD = "estancado";
    }

    if (p.estado !== estadoEsperadoBD && !(p.estado === "pagado" && estadoEsperadoBD === "liquidado")) {
      discrepancias.push({
        id: p.id,
        tipo: "prestamo",
        cliente: cliente?.nombre_completo || "Desconocido",
        campo: "estado",
        valorCalculado: estadoEsperadoBD,
        valorRegistrado: p.estado,
        descripcion: `El préstamo figura como '${p.estado}' en BD pero su cálculo financiero indica '${estadoEsperadoBD}' (Capital pendiente: S/ ${res.capitalPendiente.toFixed(2)}, Mora: S/ ${res.moraAcumulada.toFixed(2)})`
      });
    }
  }

  // 2. Auditar Alquileres
  const { data: alquileres, error: errAlq } = await supabase.from("alquileres").select("*");
  const { data: pagosAlq, error: errPA } = await supabase.from("pagos_alquiler").select("*");

  const listAlquileres = alquileres || [];
  const listPagosAlq = pagosAlq || [];

  console.log(`🏠 Contratos de alquiler a auditar: ${listAlquileres.length}\n`);

  for (const alq of listAlquileres) {
    const cliente = listClientes.find((c) => c.id === alq.cliente_id);
    const pagosAlqP = listPagosAlq.filter((p) => p.alquiler_id === alq.id);
    const scheduleAlq = buildAlquilerSchedule(alq, pagosAlqP, hoy);

    if (alq.estado === "activo" && scheduleAlq.totalPendiente > alq.monto_mensual * 3) {
      discrepancias.push({
        id: alq.id,
        tipo: "alquiler",
        cliente: cliente?.nombre_completo || "Inquilino Desconocido",
        campo: "totalPendiente",
        valorCalculado: scheduleAlq.totalPendiente,
        valorRegistrado: alq.monto_mensual,
        descripcion: `El contrato de alquiler (${alq.descripcion_inmueble}) tiene más de 3 meses atrasados sin regularizar (Deuda total: S/ ${scheduleAlq.totalPendiente.toFixed(2)})`
      });
    }
  }

  // 3. Imprimir Reporte de Resumen
  console.log("=================================================");
  console.log("📌 RESUMEN DE CÁLCULOS FINANCIEROS AUDITADOS");
  console.log("=================================================");
  console.log(`💰 Capital en Circulación Total: S/ ${totalCapitalCirculacionCalculado.toFixed(2)}`);
  console.log(`🟢 Préstamos Activos Calculados: ${prestamosActivosCalculados}`);
  console.log(`🔴 Préstamos Estancados Calculados: ${prestamosEstancadosCalculados}`);
  console.log(`🔵 Préstamos Liquidados Calculados: ${prestamosLiquidadosCalculados}`);
  console.log("=================================================\n");

  if (discrepancias.length === 0) {
    console.log("✅ ¡AUDITORÍA EXITOSA! No se detectaron discrepancias entre el motor financiero y Supabase.\n");
  } else {
    console.warn(`⚠️ SE DETECTARON ${discrepancias.length} DISCREPANCIAS EN LA BASE DE DATOS:\n`);
    discrepancias.forEach((d, i) => {
      console.warn(` [${i + 1}] ID: ${d.id} | Cliente: ${d.cliente}`);
      console.warn(`     Campo: ${d.campo} | Registrado: ${d.valorRegistrado} → Calculado: ${d.valorCalculado}`);
      console.warn(`     Detalle: ${d.descripcion}\n`);
    });
  }

  // 4. Guardar Historial de Discrepancias en audit_logs/discrepancies_history.json
  const auditLogsDir = path.join(process.cwd(), "audit_logs");
  if (!fs.existsSync(auditLogsDir)) {
    fs.mkdirSync(auditLogsDir, { recursive: true });
  }

  const logFile = path.join(auditLogsDir, "discrepancies_history.json");
  let history: any[] = [];
  if (fs.existsSync(logFile)) {
    try {
      history = JSON.parse(fs.readFileSync(logFile, "utf-8"));
    } catch (e) {
      history = [];
    }
  }

  history.push({
    timestamp,
    prestamosAuditados: listPrestamos.length,
    alquileresAuditados: listAlquileres.length,
    capitalEnCirculacion: totalCapitalCirculacionCalculado,
    discrepanciasCount: discrepancias.length,
    discrepancias
  });

  fs.writeFileSync(logFile, JSON.stringify(history, null, 2), "utf-8");
  console.log(`💾 Historial de auditoría guardado en: ${logFile}\n`);
}

runAudit().catch((err) => {
  console.error("❌ Error en la ejecución de la auditoría:", err);
  process.exit(1);
});
