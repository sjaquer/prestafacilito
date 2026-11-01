import express from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { todas } from "../services/consultas.js";
import { estandarizarTelefono } from "../helpers/telefono.js";
import { rutaDocumentoCliente } from "../src/lib/archivos.js";
import { ArchivoInvalidoError, decodificarArchivo, eliminarArchivo } from "../services/storage.js";
import { guardarArchivo, quitarDeStorage } from "../services/almacen.js";

import { recalcularScores } from "../services/score.js";

const router = express.Router();

// Listar todos los clientes
router.get("/", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { data, error } = await todas(() =>
      supabase.from("resumen_financiero_clientes").select("*").order("nombre_completo", { ascending: true })
    );

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
    // La carpeta del cliente en Drive se crea en el primer respaldo semanal que tenga documentos suyos
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

// Subir documento de cliente (Supabase Storage; Drive recibe la copia en el respaldo semanal)
router.post("/:id/documentos", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const clienteId = req.params.id;
    const { fileName, mimeType, base64Data, tipo_documento, observacion } = req.body;

    if (!fileName || !base64Data || !tipo_documento) {
      res.status(400).json({ error: 'Faltan campos requeridos: fileName, base64Data, tipo_documento.' });
      return;
    }

    const { data: cliente, error: clienteErr } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', clienteId)
      .maybeSingle();

    if (clienteErr) throw clienteErr;
    if (!cliente) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    const tipo = mimeType || 'application/octet-stream';
    let buffer: Buffer;
    try {
      buffer = decodificarArchivo(base64Data, tipo);
    } catch (err: any) {
      if (err instanceof ArchivoInvalidoError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const ruta = rutaDocumentoCliente(clienteId, fileName, tipo);
    try {
      await guardarArchivo({ ruta, buffer, mimeType: tipo, destino: { tipo: "cliente", clienteId } });
    } catch (uploadErr: any) {
      res.status(502).json({ error: 'No se pudo guardar el documento.', detail: uploadErr.message });
      return;
    }

    const { data: docData, error: docErr } = await supabase
      .from('documentos_cliente')
      .insert({
        cliente_id: clienteId,
        tipo_documento,
        nombre_archivo: fileName,
        storage_path: ruta,
        mime_type: tipo,
        observacion: observacion || ''
      })
      .select()
      .single();

    if (docErr) {
      // Sin registro en la BD el archivo quedaría huérfano
      await eliminarArchivo(ruta).catch(() => undefined);
      throw docErr;
    }

    res.status(201).json(docData);
  } catch (err: any) {
    console.error('Error al subir documento:', err);
    res.status(500).json({ error: 'Error al subir documento', detail: err.message });
  }
});

// Eliminar documento de cliente: sale de Storage; la copia en Drive se conserva como respaldo
router.delete("/:id/documentos/:docId", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id: clienteId, docId } = req.params;
    const { data: doc, error } = await supabase
      .from('documentos_cliente')
      .delete()
      .eq('id', docId)
      .eq('cliente_id', clienteId)
      .select('storage_path')
      .maybeSingle();

    if (error) throw error;
    if (doc?.storage_path) {
      await quitarDeStorage(doc.storage_path).catch((err) =>
        console.warn('Documento eliminado de la BD, pero no de Storage:', err.message)
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error al eliminar documento:', err);
    res.status(500).json({ error: 'Error al eliminar documento', detail: err.message });
  }
});

// Score del cliente: se recalcula al consultarlo (además del recálculo diario y tras cada pago)
router.get("/:id/score", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const clienteId = req.params.id;
    await recalcularScores([clienteId]);
    const { data: s, error } = await supabase.from("score_clientes").select("*").eq("cliente_id", clienteId).maybeSingle();
    if (error) throw error;

    res.json({
      scoreNumerico: Number(s?.score_numerico) || 0,
      scoreLetra: s?.score_letra || null,
      scoreEfectivo: s?.score_manual || s?.score_letra || null,
      sobreescrito: !!s?.score_manual,
      scoreManual: s?.score_manual || null,
      motivoOverride: s?.motivo_override || "",
      detalle: {
        cuotasTotales: s?.cuotas_totales || 0,
        cuotasPagadasATiempo: s?.cuotas_a_tiempo || 0,
        cuotasPagadasCompletas: s?.cuotas_completas || 0,
        prestamosLiquidados: s?.prestamos_liquidados || 0,
        prestamosTotales: s?.prestamos_totales || 0,
        diasAtrasoPromedio: Number(s?.dias_atraso_promedio) || 0
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
