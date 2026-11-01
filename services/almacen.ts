import { supabase } from "../src/lib/supabase.js";
import { traerTodasLasPaginas } from "./consultas.js";
import { descargarArchivo, eliminarArchivo, subirArchivo } from "./storage.js";
import { descargarArchivoDrive, isDriveConfigured, subirArchivoDrive } from "./google-drive.js";
import { carpetaCliente, carpetaComprobantesMes } from "./carpetas-drive.js";

/**
 * Almacén de archivos con dos lugares:
 *   - Supabase Storage: carga rápida para la app.
 *   - Google Drive: fuente de confianza; todo se copia ahí al momento de subirlo.
 *
 * Cada archivo se identifica por su ruta (`comprobantes/AAAA/MM/...` o `clientes/<id>/...`) y la
 * tabla `respaldos_archivos` dice dónde está: `drive_file_id` (copia en Drive) y `en_storage`.
 *
 * ARCHIVOS_MODO (en .env.local / Vercel):
 *   normal     → se guarda en ambos; se lee de Storage y, si falla, de Drive.
 *   solo_drive → Storage caído o lleno: se guarda y se lee solo de Drive. Al volver a "normal",
 *                restaurarStorage() copia a Storage lo que quedó solo en Drive.
 */

export type ModoArchivos = "normal" | "solo_drive";
export const modoArchivos = (): ModoArchivos => (process.env.ARCHIVOS_MODO?.trim() === "solo_drive" ? "solo_drive" : "normal");

export type DestinoDrive = { tipo: "comprobante"; mes: string } | { tipo: "cliente"; clienteId: string };

const mesActualLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()).slice(0, 7);

/** Carpeta de Drive para un destino. */
export const carpetaPara = (d: DestinoDrive) => (d.tipo === "comprobante" ? carpetaComprobantesMes(d.mes) : carpetaCliente(d.clienteId));

/** Nombre legible en Drive: la ruta sin el prefijo único ("abc123-Voucher.webp" → "Voucher.webp"). */
export const nombreParaDrive = (ruta: string) => ruta.split("/").pop()!.replace(/^[a-z0-9]+-/, "");

async function registrar(ruta: string, cambios: { drive_file_id?: string | null; en_storage?: boolean; nota?: string }) {
  const { error } = await supabase.from("respaldos_archivos").upsert({ ruta, ...cambios });
  if (error) throw new Error(`No se pudo registrar dónde quedó ${ruta}: ${error.message}`);
}

/**
 * Guarda un archivo en Storage y en Drive a la vez (con el mismo contenido que ya está en memoria,
 * así el respaldo no tiene que volver a descargarlo de Storage). Basta con que uno de los dos funcione.
 */
export async function guardarArchivo(p: {
  ruta: string;
  buffer: Buffer;
  mimeType: string;
  destino?: DestinoDrive;
}): Promise<{ enStorage: boolean; enDrive: boolean }> {
  const destino = p.destino || { tipo: "comprobante", mes: mesActualLima() };
  const usarStorage = modoArchivos() === "normal";
  const usarDrive = isDriveConfigured();

  const [storage, drive] = await Promise.allSettled([
    usarStorage ? subirArchivo(p.ruta, p.buffer, p.mimeType) : Promise.reject(new Error("modo solo_drive")),
    usarDrive
      ? carpetaPara(destino).then((carpeta) => subirArchivoDrive(nombreParaDrive(p.ruta), p.mimeType, p.buffer, carpeta))
      : Promise.reject(new Error("Drive no conectado")),
  ]);

  const enStorage = storage.status === "fulfilled";
  const driveId = drive.status === "fulfilled" ? drive.value.fileId : null;
  if (!enStorage && !driveId) {
    const motivo = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? (r.reason as Error).message : "");
    throw new Error(`No se pudo guardar el archivo. Storage: ${motivo(storage)} · Drive: ${motivo(drive)}`);
  }
  if (drive.status === "rejected" && usarDrive) console.warn(`[Archivos] ${p.ruta} sin copia en Drive (la hará el respaldo semanal):`, drive.reason?.message);

  if (driveId) {
    try {
      await registrar(p.ruta, { drive_file_id: driveId, en_storage: enStorage, nota: enStorage ? "" : "Solo en Drive" });
    } catch (err) {
      // Si solo quedó en Drive y no se pudo registrar, el archivo no se podría encontrar: es un error real
      if (!enStorage) throw err;
      console.warn("[Archivos]", (err as Error).message);
    }
  }
  return { enStorage, enDrive: !!driveId };
}

/** Lee un archivo: de Storage (rápido) y, si no está o falla, de su copia en Drive. */
export async function leerArchivo(ruta: string): Promise<{ buffer: Buffer; contentType: string; origen: "storage" | "drive" } | null> {
  if (modoArchivos() === "normal") {
    try {
      const archivo = await descargarArchivo(ruta);
      if (archivo) return { ...archivo, origen: "storage" };
    } catch (err) {
      console.warn(`[Archivos] Storage falló al leer ${ruta}; se intenta Drive:`, (err as Error).message);
    }
  }

  const { data } = await supabase.from("respaldos_archivos").select("drive_file_id").eq("ruta", ruta).maybeSingle();
  if (!data?.drive_file_id || !isDriveConfigured()) return null;
  const copia = await descargarArchivoDrive(data.drive_file_id);
  return copia ? { buffer: copia.buffer, contentType: copia.contentType, origen: "drive" } : null;
}

/** Quita el archivo de Storage (libera espacio). La copia en Drive se conserva como respaldo. */
export async function quitarDeStorage(ruta: string) {
  await eliminarArchivo(ruta);
  await supabase.from("respaldos_archivos").update({ en_storage: false, nota: "Eliminado de la app; se conserva en Drive" }).eq("ruta", ruta);
}

/**
 * Copia a Storage los archivos que quedaron solo en Drive (subidos en modo solo_drive o con Storage caído).
 * Se ejecuta con el cron diario y desde Sistema. No hace nada en modo solo_drive.
 */
export async function restaurarStorage(tiempoMaximoMs = 30_000): Promise<{ restaurados: number; pendientes: number; errores: string[] }> {
  if (modoArchivos() !== "normal" || !isDriveConfigured()) return { restaurados: 0, pendientes: 0, errores: [] };
  const limite = Date.now() + tiempoMaximoMs;

  const filas = await traerTodasLasPaginas<{ ruta: string; drive_file_id: string; nota: string | null }>(
    (desde, hasta) =>
      supabase
        .from("respaldos_archivos")
        .select("ruta, drive_file_id, nota")
        .eq("en_storage", false)
        .not("drive_file_id", "is", null)
        .order("ruta")
        .range(desde, hasta),
    "archivos solo en Drive"
  );
  // Los que se borraron a propósito desde la app no se restauran
  const porRestaurar = filas.filter((f) => !String(f.nota || "").startsWith("Eliminado"));

  let restaurados = 0;
  const errores: string[] = [];
  for (const f of porRestaurar) {
    if (Date.now() > limite) break;
    try {
      const copia = await descargarArchivoDrive(f.drive_file_id);
      if (!copia) throw new Error("ya no existe en Drive");
      await subirArchivo(f.ruta, copia.buffer, copia.contentType).catch((err) => {
        if (!/exists|duplicate/i.test(err.message)) throw err; // ya estaba en Storage: solo falta marcarlo
      });
      await registrar(f.ruta, { en_storage: true, nota: "Restaurado desde Drive" });
      restaurados++;
    } catch (err: any) {
      errores.push(`${f.ruta}: ${err.message}`);
    }
  }
  return { restaurados, pendientes: porRestaurar.length - restaurados, errores };
}
