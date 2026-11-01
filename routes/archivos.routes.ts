import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { esRutaValida, rutaComprobante, urlDeRuta } from "../src/lib/archivos.js";
import { ArchivoInvalidoError, decodificarArchivo, descargarArchivo, subirArchivo } from "../services/storage.js";

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
    await subirArchivo(ruta, buffer, mimeType);
    res.json({ success: true, publicUrl: urlDeRuta(ruta), ruta });
  } catch (err: any) {
    if (err instanceof ArchivoInvalidoError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error("Error al subir comprobante:", err);
    res.status(502).json({ error: "No se pudo guardar el comprobante.", detail: err.message });
  }
});

/** Sirve un archivo de Storage solo a usuarios con sesión. */
router.get("/archivos/*", requireAuth, async (req: express.Request, res: express.Response) => {
  const ruta = String((req.params as Record<string, string>)[0] || "");
  if (!esRutaValida(ruta)) {
    res.status(400).json({ error: "Ruta de archivo inválida." });
    return;
  }

  try {
    const archivo = await descargarArchivo(ruta);
    if (!archivo) {
      res.status(404).send("Archivo no encontrado.");
      return;
    }
    res.setHeader("Content-Type", archivo.contentType);
    // Privado: solo el navegador del usuario puede guardarlo en caché, nunca un proxy intermedio
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.send(archivo.buffer);
  } catch (err: any) {
    console.error(`Error al servir ${ruta}:`, err);
    res.status(500).send("No se pudo cargar el archivo.");
  }
});

export default router;
