import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireCron } from "../middleware/cron.js";
import { generarExcelRespaldo } from "../services/excel-respaldo.js";
import { ejecutarRespaldo, obtenerEstadoRespaldo } from "../services/respaldo.js";

const router = express.Router();

// GET /api/backup/status — para el recordatorio en la app
router.get("/status", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    res.json(await obtenerEstadoRespaldo());
  } catch (err: any) {
    console.error("Error al obtener estado de respaldo:", err);
    res.status(500).json({ error: "Error al obtener estado de respaldo", detail: err.message });
  }
});

// POST /api/backup/ejecutar — "Respaldar ahora". Si quedan archivos, la app vuelve a llamar.
router.post("/ejecutar", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    res.json(await ejecutarRespaldo({ forzar: true }));
  } catch (err: any) {
    console.error("Error al ejecutar respaldo:", err);
    res.status(500).json({ error: err.message || "No se pudo completar el respaldo" });
  }
});

// GET /api/backup/cron — Vercel Cron diario; solo actúa si el respaldo está vencido o a medias
router.get("/cron", requireCron, async (_req: express.Request, res: express.Response) => {
  try {
    const r = await ejecutarRespaldo();
    console.log("[Cron respaldo]", { ...r, errores: r.errores.length });
    res.json({ success: true, ...r });
  } catch (err: any) {
    console.error("[Cron respaldo] Error:", err);
    res.status(500).json({ success: false, detail: err.message });
  }
});

// GET /api/backup/excel — descarga del Excel al equipo (no cuenta como respaldo en la nube)
router.get("/excel", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const buffer = await generarExcelRespaldo();
    const fecha = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Respaldo_PrestaFacilito_${fecha}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error al generar Excel:", err);
    res.status(500).json({ error: "Error al generar el Excel", detail: err.message });
  }
});

export default router;
