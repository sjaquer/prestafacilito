import express from "express";
import * as XLSX from "xlsx";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";

const router = express.Router();

// GET /api/backup/status
router.get("/status", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select("ultima_fecha_backup")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    const ultimaFecha = data?.ultima_fecha_backup ? new Date(data.ultima_fecha_backup) : null;
    const ahora = new Date();
    
    let diasTranscurridos = 999;
    if (ultimaFecha) {
      const diffMs = ahora.getTime() - ultimaFecha.getTime();
      diasTranscurridos = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    const requiereBackup = diasTranscurridos >= 7;

    res.json({
      ultima_fecha_backup: data?.ultima_fecha_backup || null,
      dias_transcurridos: diasTranscurridos,
      requiere_backup: requiereBackup
    });
  } catch (err: any) {
    console.error("Error al obtener estado de backup:", err);
    res.status(500).json({ error: "Error al obtener estado de backup", detail: err.message });
  }
});

// POST /api/backup/update-date
router.post("/update-date", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const ahora = new Date().toISOString();
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .upsert({ id: 1, ultima_fecha_backup: ahora })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, ultima_fecha_backup: data.ultima_fecha_backup });
  } catch (err: any) {
    console.error("Error al actualizar fecha de backup:", err);
    res.status(500).json({ error: "Error al actualizar fecha de backup", detail: err.message });
  }
});

// GET /api/backup/excel
router.get("/excel", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const [clientesRes, prestamosRes, amortRes, alquileresRes, pagosAlqRes] = await Promise.all([
      supabase.from("clientes").select("*").order("nombre_completo", { ascending: true }),
      supabase.from("prestamos").select("*").order("fecha_emision", { ascending: false }),
      supabase.from("amortizaciones").select("*").order("fecha_pago", { ascending: false }),
      supabase.from("alquileres").select("*").order("fecha_inicio", { ascending: false }),
      supabase.from("pagos_alquiler").select("*").order("fecha_pago", { ascending: false })
    ]);

    const workbook = XLSX.utils.book_new();

    // 1. Hoja Clientes
    const clientesData = (clientesRes.data || []).map((c) => ({
      "ID Cliente": c.id,
      "DNI / RUC": c.dni_ruc || "",
      "Nombre Completo": c.nombre_completo,
      "Apodo": c.apodo || "",
      "Teléfono": c.telefono || "",
      "Dirección": c.direccion || "",
      "Score Crediticio": c.score || "A",
      "Fecha Registro": c.fecha_registro || ""
    }));
    const sheetClientes = XLSX.utils.json_to_sheet(clientesData);
    XLSX.utils.book_append_sheet(workbook, sheetClientes, "Clientes");

    // 2. Hoja Préstamos
    const prestamosData = (prestamosRes.data || []).map((p) => ({
      "ID Préstamo": p.id,
      "ID Cliente": p.cliente_id,
      "Tipo Préstamo": p.tipo_prestamo,
      "Monto Capital (S/)": p.monto_capital,
      "Tasa Interés (%)": p.tasa_interes_porcentaje,
      "Día Cobro Mensual": p.dia_vencimiento_mes || "",
      "Fecha Emisión": p.fecha_emision,
      "Fecha Vencimiento": p.fecha_vencimiento || "",
      "Estado": p.estado,
      "Notas": p.notas || ""
    }));
    const sheetPrestamos = XLSX.utils.json_to_sheet(prestamosData);
    XLSX.utils.book_append_sheet(workbook, sheetPrestamos, "Préstamos");

    // 3. Hoja Amortizaciones (Pagos de Préstamos)
    const amortData = (amortRes.data || []).map((a) => ({
      "ID Pago": a.id,
      "ID Préstamo": a.prestamo_id,
      "Tipo Movimiento": a.tipo_movimiento || "Pago Ordinario",
      "Monto Pagado (S/)": a.monto,
      "Fecha Pago": a.fecha_pago,
      "Método Pago": a.metodo_pago || "Efectivo",
      "Comprobante URL(s)": a.comprobante_url || "",
      "Drive File ID(s)": a.voucher_drive_file_id || ""
    }));
    const sheetAmort = XLSX.utils.json_to_sheet(amortData);
    XLSX.utils.book_append_sheet(workbook, sheetAmort, "Amortizaciones Préstamos");

    // 4. Hoja Alquileres
    const alquileresData = (alquileresRes.data || []).map((alq) => ({
      "ID Alquiler": alq.id,
      "ID Cliente (Inquilino)": alq.cliente_id,
      "Inmueble / Descripción": alq.descripcion_inmueble,
      "Monto Mensual (S/)": alq.monto_mensual,
      "Fecha Inicio": alq.fecha_inicio,
      "Fecha Fin": alq.fecha_fin || "",
      "Estado": alq.estado,
      "Notas": alq.notas || ""
    }));
    const sheetAlquileres = XLSX.utils.json_to_sheet(alquileresData);
    XLSX.utils.book_append_sheet(workbook, sheetAlquileres, "Alquileres");

    // 5. Hoja Pagos de Alquiler
    const pagosAlqData = (pagosAlqRes.data || []).map((pa) => ({
      "ID Pago": pa.id,
      "ID Alquiler": pa.alquiler_id,
      "Período Mes": pa.periodo_mes,
      "Período Año": pa.periodo_anio,
      "Monto (S/)": pa.monto,
      "Fecha Pago": pa.fecha_pago,
      "Método Pago": pa.metodo_pago || "Efectivo",
      "Es Pago Completo": pa.es_pago_completo ? "Sí" : "No",
      "Comprobante URL(s)": pa.comprobante_url || "",
      "Drive File ID(s)": pa.voucher_drive_file_id || ""
    }));
    const sheetPagosAlq = XLSX.utils.json_to_sheet(pagosAlqData);
    XLSX.utils.book_append_sheet(workbook, sheetPagosAlq, "Pagos de Alquiler");

    // Generar buffer XLSX
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Actualizar fecha del último backup en Supabase
    const ahora = new Date().toISOString();
    await supabase.from("configuracion_sistema").upsert({ id: 1, ultima_fecha_backup: ahora });

    const filename = `Backup_PrestaFacilito_${ahora.split("T")[0]}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error al generar backup Excel:", err);
    res.status(500).json({ error: "Error al generar backup Excel", detail: err.message });
  }
});

export default router;
