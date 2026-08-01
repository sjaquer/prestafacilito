import express from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { estandarizarTelefono } from "../helpers/telefono.js";
import {
  isDriveConfigured,
  createDriveSubfolder,
  uploadDocumentToDrive,
  getGoogleDriveAccessToken,
  GOOGLE_DRIVE_CLIENTES_FOLDER_ID
} from "../services/google-drive.js";

import { calcularScoreCliente } from "../src/lib/scoreLogic.js";

const router = express.Router();

// Listar todos los clientes
router.get("/", requireAuth, async (req: express.Request, res: express.Response) => {
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

// Crear nuevo cliente
router.post("/", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { nombre_completo, apodo, telefono, observaciones, direccion, numero_cuenta, banco_cuenta, informacion_adicional } = req.body;

    if (!nombre_completo) {
      res.status(400).json({ error: "El nombre completo es requerido" });
      return;
    }

    const telSanitized = estandarizarTelefono(telefono || '');

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nombre_completo,
        apodo: apodo || '',
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

    if (isDriveConfigured() && GOOGLE_DRIVE_CLIENTES_FOLDER_ID) {
      try {
        const folderId = await createDriveSubfolder(nombre_completo, GOOGLE_DRIVE_CLIENTES_FOLDER_ID);
        await supabase.from('clientes').update({ drive_folder_id: folderId }).eq('id', data.id);
        data.drive_folder_id = folderId;
      } catch (driveErr: any) {
        console.warn('No se pudo crear la carpeta de Drive para el cliente:', driveErr.message);
      }
    }

    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al crear cliente:", err);
    res.status(500).json({ error: "Error al crear cliente", detail: err.message });
  }
});

// Editar cliente existente
router.put("/:id", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const clienteId = req.params.id;
    const { nombre_completo, apodo, telefono, observaciones, direccion, numero_cuenta, banco_cuenta, informacion_adicional } = req.body;

    if (!nombre_completo) {
      res.status(400).json({ error: "El nombre completo es requerido" });
      return;
    }

    const telSanitized = estandarizarTelefono(telefono || '');

    const { data, error } = await supabase
      .from("clientes")
      .update({
        nombre_completo,
        apodo: apodo || '',
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
    res.json(data);
  } catch (err: any) {
    console.error("Error al actualizar cliente:", err);
    res.status(500).json({ error: "Error al actualizar cliente", detail: err.message });
  }
});

// Listar documentos de un cliente
router.get("/:id/documentos", requireAuth, async (req: express.Request, res: express.Response) => {
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
router.post("/:id/documentos", requireAuth, async (req: AuthRequest, res: express.Response) => {
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

    const { data: cliente, error: clienteErr } = await supabase
      .from('clientes')
      .select('nombre_completo, drive_folder_id')
      .eq('id', clienteId)
      .single();

    if (clienteErr || !cliente) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    let folderId = cliente.drive_folder_id;
    if (!folderId && GOOGLE_DRIVE_CLIENTES_FOLDER_ID) {
      try {
        folderId = await createDriveSubfolder(cliente.nombre_completo, GOOGLE_DRIVE_CLIENTES_FOLDER_ID);
        await supabase.from('clientes').update({ drive_folder_id: folderId }).eq('id', clienteId);
      } catch (folderErr: any) {
        res.status(502).json({ error: 'No se pudo crear la carpeta del cliente en Drive.', detail: folderErr.message });
        return;
      }
    }

    if (!folderId) {
      res.status(400).json({ error: 'No se ha configurado la carpeta raíz de clientes en Google Drive.' });
      return;
    }

    const buffer = Buffer.from(base64Data, 'base64');
    let uploaded;
    try {
      uploaded = await uploadDocumentToDrive(fileName, mimeType, buffer, folderId);
    } catch (uploadErr: any) {
      res.status(502).json({ error: 'No se pudo subir el documento a Drive.', detail: uploadErr.message });
      return;
    }

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

    res.status(201).json(docData);
  } catch (err: any) {
    console.error('Error al subir documento:', err);
    res.status(500).json({ error: 'Error al subir documento', detail: err.message });
  }
});

// Eliminar documento de cliente
router.delete("/:id/documentos/:docId", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { docId } = req.params;
    const { error } = await supabase
      .from('documentos_cliente')
      .delete()
      .eq('id', docId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error al eliminar documento:', err);
    res.status(500).json({ error: 'Error al eliminar documento', detail: err.message });
  }
});

// Obtener / Calcular Score del Cliente (Fase 6)
router.get("/:id/score", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const clienteId = req.params.id;

    const [prestamosRes, amortRes, scoreRes] = await Promise.all([
      supabase.from("prestamos").select("*").eq("cliente_id", clienteId),
      supabase.from("amortizaciones").select("*"),
      supabase.from("score_clientes").select("*").eq("cliente_id", clienteId).maybeSingle()
    ]);

    const prestamos = prestamosRes.data || [];
    const amortizaciones = amortRes.data || [];
    const scoreExistente = scoreRes.data;

    const scoreCalculado = calcularScoreCliente(prestamos, amortizaciones);

    // Persistir o actualizar en score_clientes
    await supabase.from("score_clientes").upsert(
      {
        cliente_id: clienteId,
        score_numerico: scoreCalculado.scoreNumerico,
        score_letra: scoreCalculado.scoreLetra,
        cuotas_totales: scoreCalculado.cuotasTotales,
        cuotas_a_tiempo: scoreCalculado.cuotasPagadasATiempo,
        cuotas_completas: scoreCalculado.cuotasPagadasCompletas,
        prestamos_liquidados: scoreCalculado.prestamosLiquidados,
        prestamos_totales: scoreCalculado.prestamosTotales,
        dias_atraso_promedio: scoreCalculado.diasAtrasoPromedio,
        ultima_actualizacion: new Date().toISOString()
      },
      { onConflict: "cliente_id" }
    );

    const scoreEfectivo = scoreExistente?.score_manual || scoreCalculado.scoreLetra;

    res.json({
      scoreNumerico: scoreCalculado.scoreNumerico,
      scoreLetra: scoreCalculado.scoreLetra,
      scoreEfectivo,
      sobreescrito: !!scoreExistente?.score_manual,
      scoreManual: scoreExistente?.score_manual || null,
      motivoOverride: scoreExistente?.motivo_override || "",
      detalle: {
        cuotasTotales: scoreCalculado.cuotasTotales,
        cuotasPagadasATiempo: scoreCalculado.cuotasPagadasATiempo,
        cuotasPagadasCompletas: scoreCalculado.cuotasPagadasCompletas,
        prestamosLiquidados: scoreCalculado.prestamosLiquidados,
        prestamosTotales: scoreCalculado.prestamosTotales,
        diasAtrasoPromedio: scoreCalculado.diasAtrasoPromedio
      }
    });
  } catch (err: any) {
    console.error("Error al obtener score de cliente:", err);
    res.status(500).json({ error: "Error al obtener score del cliente", detail: err.message });
  }
});

// Override manual del Score del Cliente (Fase 6)
router.put("/:id/score/override", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const clienteId = req.params.id;
    const { score_manual, motivo } = req.body;

    if (score_manual !== null && !["A", "B", "C"].includes(score_manual)) {
      res.status(400).json({ error: "El score manual debe ser 'A', 'B', 'C' o null" });
      return;
    }

    const { error } = await supabase.from("score_clientes").upsert(
      {
        cliente_id: clienteId,
        score_manual: score_manual || null,
        motivo_override: motivo || "",
        ultima_actualizacion: new Date().toISOString()
      },
      { onConflict: "cliente_id" }
    );

    if (error) throw error;

    res.json({ success: true, scoreManual: score_manual, motivoOverride: motivo || "" });
  } catch (err: any) {
    console.error("Error al sobreescribir score:", err);
    res.status(500).json({ error: "Error al sobreescribir score", detail: err.message });
  }
});

export default router;
