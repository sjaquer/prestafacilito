import { supabase } from "../src/lib/supabase.js";
import {
  buscarOCrearCarpeta,
  getClientesFolderId,
  getDriveFolderId,
  getRespaldosFolderId,
  nombreCarpetaCliente,
} from "./google-drive.js";

/**
 * Carpetas de Drive donde va cada archivo (las mismas para la copia inmediata y el respaldo semanal):
 *   comprobantes → <GOOGLE_DRIVE_FOLDER_ID>/AAAA-MM
 *   documentos   → <GOOGLE_DRIVE_CLIENTES_FOLDER_ID>/Documentos - <cliente>
 *   Excel        → <GOOGLE_DRIVE_RESPALDOS_FOLDER_ID>
 * Los IDs se recuerdan mientras la función siga viva, para no buscar la carpeta en cada subida.
 */
const CARPETA_EXCEL = "PrestaFacilito - Respaldos Excel";
const CARPETA_COMPROBANTES = "PrestaFacilito - Comprobantes";
const CARPETA_CLIENTES = "PrestaFacilito - Documentos de Clientes";

const cache = new Map<string, Promise<string>>();
function recordar(clave: string, crear: () => Promise<string>): Promise<string> {
  if (!cache.has(clave)) {
    // Si falla, no se recuerda el error: el próximo intento vuelve a probar
    const promesa = crear().catch((err) => {
      cache.delete(clave);
      throw err;
    });
    cache.set(clave, promesa);
  }
  return cache.get(clave)!;
}

const raizComprobantes = () => recordar("raiz:comprobantes", async () => getDriveFolderId() || buscarOCrearCarpeta(CARPETA_COMPROBANTES));
const raizClientes = () => recordar("raiz:clientes", async () => getClientesFolderId() || buscarOCrearCarpeta(CARPETA_CLIENTES));

export const carpetaExcel = () => recordar("raiz:excel", async () => getRespaldosFolderId() || buscarOCrearCarpeta(CARPETA_EXCEL));

/** `mes` en formato AAAA-MM. */
export const carpetaComprobantesMes = (mes: string) =>
  recordar(`mes:${mes}`, async () => buscarOCrearCarpeta(mes, await raizComprobantes()));

/** Carpeta del cliente; si no la tiene registrada, la busca o crea y la guarda en `clientes.drive_folder_id`. */
export async function carpetaCliente(clienteId: string, datos?: { nombre?: string; carpeta?: string | null }): Promise<string> {
  if (datos?.carpeta) return datos.carpeta;
  return recordar(`cliente:${clienteId}`, async () => {
    let nombre = datos?.nombre;
    if (!nombre) {
      const { data } = await supabase.from("clientes").select("nombre_completo, drive_folder_id").eq("id", clienteId).maybeSingle();
      if (data?.drive_folder_id) return data.drive_folder_id;
      nombre = data?.nombre_completo || "Sin nombre";
    }
    const id = await buscarOCrearCarpeta(nombreCarpetaCliente(nombre), await raizClientes());
    await supabase.from("clientes").update({ drive_folder_id: id }).eq("id", clienteId);
    return id;
  });
}
