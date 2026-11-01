import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { esRutaValida, rutaComprobante, urlDeRuta } from "../src/lib/archivos.js";
import { ArchivoInvalidoError, decodificarArchivo } from "../services/storage.js";
import { guardarArchivo, leerArchivo } from "../services/almacen.js";
import { aplicarMigracion, listarPendientes, TablaMigrable } from "../services/migracion.js";

/** Comprobantes y documentos en Supabase Storage (se monta en /api). */
const router = express.Router();

/**
 * Sube un comprobante y devuelve su URL (`/api/archivos/comprobantes/...`).
 * La URL se guarda después en comprobante_url al registrar o editar el pago.
 */
router.post("/upload-voucher", requireAuth, async (req: express.Request, res: express.Response) => {
  const { fileName, mimeType, base64Data } = req.body || {};
  if (!fileName || !mimeType || !base64Data) {
    res.status(400).json({ error: "Datos del comprobante incompletos. Se requieren fileName, mimeType y base64Data." });
    return;
  }

  try {
    const buffer = decodificarArchivo(base64Data, mimeType);
    const ruta = rutaComprobante(fileName, mimeType);
    // Storage (carga rápida) + Drive (respaldo) a la vez
    const donde = await guardarArchivo({ ruta, buffer, mimeType });
    res.json({ success: true, publicUrl: urlDeRuta(ruta), ruta, ...donde });
  } catch (err: any) {
    if (err instanceof ArchivoInvalidoError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error("Error al subir comprobante:", err);
    res.status(502).json({ error: "No se pudo guardar el comprobante.", detail: err.message });
  }
});

// ── Migración de fotos antiguas (Drive → Storage). Va antes de /archivos/* para no confundirse con un archivo.

router.get("/archivos-migracion/pendientes", requireAuth, async (_req: express.Request, res: express.Response) => {
  try {
    const pendientes = await listarPendientes();
    res.json({ total: pendientes.length, pendientes });
  } catch (err: any) {
    console.error("Error al listar fotos por migrar:", err);
    res.status(500).json({ error: "No se pudo listar las fotos por migrar", detail: err.message });
  }
});

const TABLAS: TablaMigrable[] = ["amortizaciones", "pagos_alquiler", "documentos_cliente"];

router.post("/archivos-migracion", requireAuth, async (req: express.Request, res: express.Response) => {
  const { tabla, id, driveId, fileName, mimeType, base64Data } = req.body || {};
  if (!TABLAS.includes(tabla) || !id || !driveId || !mimeType || !base64Data) {
    res.status(400).json({ error: "Datos incompletos para migrar el archivo." });
    return;
  }
  try {
    const buffer = decodificarArchivo(base64Data, mimeType);
    res.json({ success: true, ...(await aplicarMigracion({ tabla, id, driveId, fileName: fileName || "archivo", mimeType, buffer })) });
  } catch (err: any) {
    const status = err instanceof ArchivoInvalidoError ? 400 : 500;
    console.error(`Error al migrar ${tabla}/${id}:`, err.message);
    res.status(status).json({ error: err.message || "No se pudo migrar el archivo." });
  }
});

/** Sirve un archivo (de Storage, o de Drive si Storage falla) solo a usuarios con sesión. */
router.get("/archivos/*", requireAuth, async (req: express.Request, res: express.Response) => {
  const ruta = String((req.params as Record<string, string>)[0] || "");
  if (!esRutaValida(ruta)) {
    res.status(400).json({ error: "Ruta de archivo inválida." });
    return;
  }

  try {
    const archivo = await leerArchivo(ruta);
    if (!archivo) {
      res.status(404).send("Archivo no encontrado.");
      return;
    }
    res.setHeader("Content-Type", archivo.contentType);
    res.setHeader("X-Origen-Archivo", archivo.origen);
    // Cada ruta es única y su contenido nunca cambia (un archivo nuevo = ruta nueva): el navegador
    // la guarda un año y no la vuelve a pedir. "private": ningún proxy/CDN intermedio la guarda.
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.send(archivo.buffer);
  } catch (err: any) {
    console.error(`Error al servir ${ruta}:`, err);
    res.status(500).send("No se pudo cargar el archivo.");
  }
});

export default router;
