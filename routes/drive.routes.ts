import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import {
  isDriveConfigured,
  getDriveFolderId,
  uploadVoucherToDrive,
  getGoogleDriveAccessToken
} from "../services/google-drive.js";

const router = express.Router();

// Estado de configuración de Google Drive
router.get("/status", requireAuth, (_req: express.Request, res: express.Response) => {
  const configured = isDriveConfigured();
  const folderId = getDriveFolderId();
  res.json({
    configured,
    folderConfigured: !!folderId,
    message: configured
      ? "Google Drive está configurado correctamente."
      : "Faltan credenciales de Google Drive. Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en .env."
  });
});

// Carga de comprobante
router.post("/upload-voucher", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { fileName, mimeType, base64Data } = req.body;
    if (!fileName || !mimeType || !base64Data) {
      res.status(400).json({ error: "Datos del comprobante incompletos. Se requieren fileName, mimeType y base64Data." });
      return;
    }

    if (!isDriveConfigured()) {
      res.status(503).json({
        error: "El almacenamiento de comprobantes (Google Drive) no está configurado en este servidor.",
        detail: "Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el archivo .env.",
        driveConfigured: false
      });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, "base64");
      if (buffer.length === 0) throw new Error("Buffer vacío");
    } catch {
      res.status(400).json({ error: "El contenido base64 del comprobante es inválido o está vacío." });
      return;
    }

    let uploaded;
    try {
      uploaded = await uploadVoucherToDrive(fileName, mimeType, buffer);
    } catch (driveErr: any) {
      console.error("Error al subir voucher a Google Drive:", driveErr.message);
      res.status(502).json({
        error: "No se pudo subir el comprobante a Google Drive.",
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

// Proxy para visualizar vouchers (Tarea 9.2.6 con validación de seguridad)
router.get("/vouchers/proxy/:fileId", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { fileId } = req.params;

    // Validar en BD que el fileId esté registrado en amortizaciones o pagos_alquiler
    const [amortRes, alqRes] = await Promise.all([
      supabase.from("amortizaciones").select("id").ilike("voucher_drive_file_id", `%${fileId}%`).limit(1),
      supabase.from("pagos_alquiler").select("id").ilike("voucher_drive_file_id", `%${fileId}%`).limit(1)
    ]);

    let registrado = (amortRes.data && amortRes.data.length > 0) || (alqRes.data && alqRes.data.length > 0);

    if (!registrado) {
      // Intentar también buscar en comprobante_url por si el id está dentro de la url
      const [amortUrlRes, alqUrlRes] = await Promise.all([
        supabase.from("amortizaciones").select("id").ilike("comprobante_url", `%${fileId}%`).limit(1),
        supabase.from("pagos_alquiler").select("id").ilike("comprobante_url", `%${fileId}%`).limit(1)
      ]);
      registrado = (amortUrlRes.data && amortUrlRes.data.length > 0) || (alqUrlRes.data && alqUrlRes.data.length > 0);
    }

    if (!registrado) {
      res.status(403).json({ error: "Acceso denegado: el comprobante no se encuentra registrado en el sistema." });
      return;
    }

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
    res.setHeader("Cache-Control", "public, max-age=86400");

    const arrayBuffer = await driveRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error al intermediar imagen de Google Drive:", err);
    res.status(500).send(`Error del servidor: ${err.message}`);
  }
});

// Proxy para visualizar documentos de clientes desde Google Drive
router.get("/documentos/proxy/:fileId", requireAuth, async (req: express.Request, res: express.Response) => {
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

export default router;
