import { supabase } from "../src/lib/supabase.js";
import { parseVoucherUrls } from "../src/lib/formatters.js";
import { driveIdDeUrl, rutaComprobante, rutaDeUrl, rutaDocumentoCliente, serializarUrls, urlDeRuta } from "../src/lib/archivos.js";
import { traerTodasLasPaginas } from "./consultas.js";
import { eliminarArchivo, subirArchivo } from "./storage.js";

/**
 * Migración única de fotos antiguas de Google Drive a Supabase Storage.
 *
 * La hace el navegador desde Sistema → "Migrar fotos antiguas": descarga cada archivo por el
 * proxy de Drive, lo comprime con el mismo compresor de la app y lo envía aquí. El servidor solo
 * lo guarda y actualiza la referencia. El original en Drive no se borra: queda como respaldo.
 */

export type TablaMigrable = "amortizaciones" | "pagos_alquiler" | "documentos_cliente";

export interface Pendiente {
  tabla: TablaMigrable;
  id: string;
  driveId: string;
  /** "comprobante" o "documento": define el perfil de compresión en el navegador. */
  tipo: "comprobante" | "documento";
  /** Para mostrar el progreso. */
  etiqueta: string;
}

export async function listarPendientes(): Promise<Pendiente[]> {
  const pendientes: Pendiente[] = [];

  for (const tabla of ["amortizaciones", "pagos_alquiler"] as const) {
    const filas = await traerTodasLasPaginas<{ id: string; fecha_pago: string; comprobante_url: string }>(
      (desde, hasta) =>
        supabase.from(tabla).select("id, fecha_pago, comprobante_url").not("comprobante_url", "is", null).order("id").range(desde, hasta),
      tabla
    );
    for (const f of filas) {
      for (const url of parseVoucherUrls(f.comprobante_url)) {
        if (rutaDeUrl(url)) continue;
        const driveId = driveIdDeUrl(url);
        if (driveId) pendientes.push({ tabla, id: f.id, driveId, tipo: "comprobante", etiqueta: `Pago del ${String(f.fecha_pago).slice(0, 10)}` });
      }
    }
  }

  const docs = await traerTodasLasPaginas<{ id: string; nombre_archivo: string; drive_file_id: string | null; drive_url: string | null }>(
    (desde, hasta) =>
      supabase
        .from("documentos_cliente")
        .select("id, nombre_archivo, drive_file_id, drive_url")
        .is("storage_path", null)
        .order("id")
        .range(desde, hasta),
    "documentos_cliente"
  );
  for (const d of docs) {
    const driveId = d.drive_file_id || driveIdDeUrl(d.drive_url);
    if (driveId) pendientes.push({ tabla: "documentos_cliente", id: d.id, driveId, tipo: "documento", etiqueta: d.nombre_archivo });
  }

  return pendientes;
}

const fechaLocal = (valor: string | null | undefined) => {
  const [a, m, d] = String(valor || "").slice(0, 10).split("-").map(Number);
  return a && m ? new Date(a, m - 1, d || 1) : new Date();
};

/** Guarda en Storage el archivo ya comprimido y reemplaza la referencia de Drive por la nueva. */
export async function aplicarMigracion(p: {
  tabla: TablaMigrable;
  id: string;
  driveId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ url: string }> {
  if (p.tabla === "documentos_cliente") {
    const { data: doc, error } = await supabase
      .from("documentos_cliente")
      .select("cliente_id, nombre_archivo, storage_path")
      .eq("id", p.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("El documento ya no existe.");
    if (doc.storage_path) return { url: urlDeRuta(doc.storage_path) }; // ya migrado (doble clic, otra pestaña)

    const ruta = rutaDocumentoCliente(doc.cliente_id, doc.nombre_archivo || p.fileName, p.mimeType);
    await subirArchivo(ruta, p.buffer, p.mimeType);
    const { error: errUpd } = await supabase.from("documentos_cliente").update({ storage_path: ruta }).eq("id", p.id);
    if (errUpd) {
      await eliminarArchivo(ruta).catch(() => undefined);
      throw new Error(errUpd.message);
    }
    await registrarRespaldo(ruta, p.driveId);
    return { url: urlDeRuta(ruta) };
  }

  const { data: fila, error } = await supabase.from(p.tabla).select("fecha_pago, comprobante_url").eq("id", p.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!fila) throw new Error("El pago ya no existe.");

  const urls = parseVoucherUrls(fila.comprobante_url);
  const indice = urls.findIndex((u) => !rutaDeUrl(u) && driveIdDeUrl(u) === p.driveId);
  if (indice === -1) throw new Error("Ese comprobante ya fue migrado o cambió.");

  const ruta = rutaComprobante(p.fileName, p.mimeType, fechaLocal(fila.fecha_pago));
  await subirArchivo(ruta, p.buffer, p.mimeType);
  urls[indice] = urlDeRuta(ruta);
  const { error: errUpd } = await supabase.from(p.tabla).update({ comprobante_url: serializarUrls(urls) }).eq("id", p.id);
  if (errUpd) {
    await eliminarArchivo(ruta).catch(() => undefined);
    throw new Error(errUpd.message);
  }
  await registrarRespaldo(ruta, p.driveId);
  return { url: urlDeRuta(ruta) };
}

/** El original en Drive cuenta como copia de seguridad: el respaldo semanal no lo vuelve a subir. */
async function registrarRespaldo(ruta: string, driveId: string) {
  // en_storage: la copia comprimida ya está en Storage; Drive conserva el original en calidad completa
  await supabase.from("respaldos_archivos").upsert({ ruta, drive_file_id: driveId, en_storage: true, nota: "Original en Drive (migrado)" });
}
