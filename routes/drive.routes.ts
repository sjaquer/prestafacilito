import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { descargarArchivoDrive, isDriveConfigured } from "../services/google-drive.js";

/** Google Drive (se monta en /api). Drive ya solo guarda copias de seguridad. */
const router = express.Router();

router.get("/drive/status", requireAuth, (_req: express.Request, res: express.Response) => {
  const configured = isDriveConfigured();
  res.json({
    configured,
    message: configured
      ? "Google Drive está conectado (respaldos semanales)."
      : "Faltan credenciales de Google. Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN."
  });
});

/**
 * Proxies de archivos antiguos guardados en Drive (antes de Supabase Storage).
 * Siguen activos hasta ejecutar scripts/migrar-drive-a-storage.ts; después se pueden eliminar.
 */
const proxyDrive = async (req: express.Request, res: express.Response) => {
  const fileId = String(req.params.fileId || "").split("?")[0].trim();
  if (!/^[A-Za-z0-9_-]+$/.test(fileId)) {
    res.status(400).json({ error: "Identificador de archivo inválido." });
    return;
  }
  try {
    const archivo = await descargarArchivoDrive(fileId);
    if (!archivo) {
      res.status(404).send("No se encontró el archivo en Google Drive.");
      return;
    }
    res.setHeader("Content-Type", archivo.contentType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.removeHeader("Pragma");
    res.removeHeader("Expires");
    res.send(archivo.buffer);
  } catch (err: any) {
    console.error(`Error al traer ${fileId} desde Google Drive:`, err.message);
    res.status(502).send("No se pudo cargar el archivo desde Google Drive.");
  }
};

router.get("/vouchers/proxy/:fileId", requireAuth, proxyDrive);
router.get("/documentos/proxy/:fileId", requireAuth, proxyDrive);

export default router;
