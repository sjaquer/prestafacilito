import { supabase } from "../src/lib/supabase.js";
import { esMimePermitido } from "../src/lib/archivos.js";

/**
 * Almacenamiento principal de comprobantes y documentos: Supabase Storage.
 *
 * El bucket es privado y sin políticas para anon/authenticated: solo el backend
 * (clave service_role) puede leer o escribir. El navegador nunca accede directo;
 * todo pasa por /api/archivos/<ruta>, que exige sesión.
 */
export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "archivos";

/** 10 MB: las fotos ya llegan comprimidas (~200 KB); el límite cubre PDFs escaneados. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

export class ArchivoInvalidoError extends Error {}

/** Convierte el base64 recibido del navegador (con o sin prefijo data:) y valida tipo y tamaño. */
export function decodificarArchivo(base64Data: unknown, mimeType: string): Buffer {
  if (!esMimePermitido(mimeType)) {
    throw new ArchivoInvalidoError(`Tipo de archivo no permitido: ${mimeType || "desconocido"}. Solo imágenes, PDF o Word.`);
  }
  const limpio = String(base64Data || "").replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(limpio, "base64");
  if (buffer.length === 0) throw new ArchivoInvalidoError("El archivo recibido está vacío o es inválido.");
  if (buffer.length > TAMANO_MAXIMO) throw new ArchivoInvalidoError("El archivo supera el máximo de 10 MB.");
  return buffer;
}

export async function subirArchivo(ruta: string, buffer: Buffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, buffer, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`No se pudo guardar el archivo en Storage: ${error.message}`);
}

/** Descarga un archivo; devuelve null si no existe. */
export async function descargarArchivo(ruta: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
  if (error) {
    const status = (error as { status?: number; statusCode?: string }).status;
    if (status === 400 || status === 404 || /not.?found/i.test(error.message)) return null;
    throw new Error(`No se pudo leer el archivo de Storage: ${error.message}`);
  }
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}

export async function eliminarArchivo(ruta: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) throw new Error(`No se pudo eliminar el archivo de Storage: ${error.message}`);
}
