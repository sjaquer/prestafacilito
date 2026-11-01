import { supabase } from "../src/lib/supabase.js";
import { parseVoucherUrls } from "../src/lib/formatters.js";
import { rutaDeUrl } from "../src/lib/archivos.js";
import { descargarArchivo } from "./storage.js";
import { generarExcelRespaldo } from "./excel-respaldo.js";
import { traerTodasLasPaginas } from "./consultas.js";
import {
  buscarOCrearCarpeta,
  getClientesFolderId,
  getDriveFolderId,
  getRespaldosFolderId,
  isDriveConfigured,
  nombreCarpetaCliente,
  subirArchivoDrive,
} from "./google-drive.js";

/**
 * Respaldo semanal a Google Drive.
 *
 * Un "ciclo" de respaldo:
 *   1. Sube el Excel con todos los datos a la carpeta de respaldos.
 *   2. Copia a Drive los archivos de Storage que aún no tienen copia (comprobantes por mes,
 *      documentos en la carpeta de cada cliente). Lo ya copiado queda registrado en
 *      `respaldos_archivos`, así cada semana solo se suben los archivos nuevos.
 *   3. Cuando no queda nada pendiente, marca `ultima_fecha_backup` y cierra el ciclo.
 *
 * Si se acaba el tiempo (funciones de Vercel limitadas), el ciclo queda abierto y la
 * siguiente ejecución continúa donde quedó, sin volver a subir el Excel.
 */

export const DIAS_ENTRE_RESPALDOS = 7;
const TIEMPO_POR_DEFECTO_MS = 40_000;

const CARPETA_EXCEL = "PrestaFacilito - Respaldos Excel";
const CARPETA_COMPROBANTES = "PrestaFacilito - Comprobantes";
const CARPETA_CLIENTES = "PrestaFacilito - Documentos de Clientes";

interface Configuracion {
  ultima_fecha_backup: string | null;
  respaldo_iniciado_en: string | null;
}

export interface EstadoRespaldo {
  ultima_fecha_backup: string | null;
  dias_transcurridos: number | null;
  requiere_backup: boolean;
  en_curso: boolean;
  drive_configurado: boolean;
}

export interface ResultadoRespaldo {
  omitido: boolean;
  excel_subido: boolean;
  copiados: number;
  fallidos: number;
  pendientes: number;
  completo: boolean;
  errores: string[];
}

interface ArchivoARespaldar {
  ruta: string;
  /** Nombre legible en Drive, p. ej. "2026-10-31 - Juan Perez - Voucher.jpg". */
  nombre: string;
  destino: { tipo: "comprobante"; mes: string } | { tipo: "cliente"; clienteId: string; nombreCliente: string; carpeta: string | null };
}

const diasDesde = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

async function leerConfiguracion(): Promise<Configuracion> {
  const { data, error } = await supabase
    .from("configuracion_sistema")
    .select("ultima_fecha_backup, respaldo_iniciado_en")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `No se pudo leer configuracion_sistema (${error.message}). ¿Ejecutaste supabase/migrations/20261031_storage_y_respaldos.sql?`
    );
  }
  return { ultima_fecha_backup: data?.ultima_fecha_backup ?? null, respaldo_iniciado_en: data?.respaldo_iniciado_en ?? null };
}

async function guardarConfiguracion(cambios: Partial<Configuracion>) {
  const { error } = await supabase.from("configuracion_sistema").upsert({ id: 1, ...cambios });
  if (error) throw new Error(`No se pudo actualizar configuracion_sistema: ${error.message}`);
}

export async function obtenerEstadoRespaldo(): Promise<EstadoRespaldo> {
  const config = await leerConfiguracion();
  const dias = diasDesde(config.ultima_fecha_backup);
  return {
    ultima_fecha_backup: config.ultima_fecha_backup,
    dias_transcurridos: dias,
    requiere_backup: dias === null || dias >= DIAS_ENTRE_RESPALDOS,
    en_curso: !!config.respaldo_iniciado_en,
    drive_configurado: isDriveConfigured(),
  };
}

const fechaCorta = (valor: unknown) => String(valor || "").slice(0, 10);
const nombreDeRuta = (ruta: string) => ruta.split("/").pop()!.replace(/^[a-z0-9]+-/, "");

/** Todos los archivos de Storage referenciados en la base de datos, con su destino en Drive. */
async function listarArchivos(): Promise<ArchivoARespaldar[]> {
  const [amort, pagosAlq, docs] = await Promise.all([
    traerTodasLasPaginas<any>(
      (desde, hasta) =>
        supabase
          .from("amortizaciones")
          .select("id, fecha_pago, comprobante_url, prestamos(clientes(nombre_completo))")
          .not("comprobante_url", "is", null)
          .order("id")
          .range(desde, hasta),
      "los comprobantes de préstamos"
    ),
    traerTodasLasPaginas<any>(
      (desde, hasta) =>
        supabase
          .from("pagos_alquiler")
          .select("id, fecha_pago, comprobante_url, alquileres(clientes(nombre_completo))")
          .not("comprobante_url", "is", null)
          .order("id")
          .range(desde, hasta),
      "los comprobantes de alquileres"
    ),
    traerTodasLasPaginas<any>(
      (desde, hasta) =>
        supabase
          .from("documentos_cliente")
          .select("id, cliente_id, tipo_documento, storage_path, clientes(nombre_completo, drive_folder_id)")
          .not("storage_path", "is", null)
          .order("id")
          .range(desde, hasta),
      "los documentos de clientes"
    ),
  ]);

  const archivos: ArchivoARespaldar[] = [];
  const agregarComprobantes = (fecha: unknown, urls: string | null, cliente: string) => {
    for (const url of parseVoucherUrls(urls)) {
      const ruta = rutaDeUrl(url);
      if (!ruta) continue;
      const dia = fechaCorta(fecha) || "sin-fecha";
      archivos.push({
        ruta,
        nombre: `${dia} - ${cliente || "Sin cliente"} - ${nombreDeRuta(ruta)}`,
        destino: { tipo: "comprobante", mes: dia.slice(0, 7) },
      });
    }
  };

  // Las relaciones embebidas llegan como objeto (o array, según cómo Supabase infiera la FK)
  const uno = (v: any) => (Array.isArray(v) ? v[0] : v);
  for (const a of amort) {
    agregarComprobantes(a.fecha_pago, a.comprobante_url, uno(uno(a.prestamos)?.clientes)?.nombre_completo);
  }
  for (const p of pagosAlq) {
    agregarComprobantes(p.fecha_pago, p.comprobante_url, uno(uno(p.alquileres)?.clientes)?.nombre_completo);
  }
  for (const d of docs) {
    const cliente = uno(d.clientes);
    archivos.push({
      ruta: d.storage_path,
      nombre: `${d.tipo_documento} - ${nombreDeRuta(d.storage_path)}`,
      destino: {
        tipo: "cliente",
        clienteId: d.cliente_id,
        nombreCliente: cliente?.nombre_completo || "Sin nombre",
        carpeta: cliente?.drive_folder_id || null,
      },
    });
  }

  // Un mismo archivo podría estar referenciado dos veces
  return [...new Map(archivos.map((a) => [a.ruta, a])).values()];
}

async function rutasYaRespaldadas(): Promise<Set<string>> {
  const filas = await traerTodasLasPaginas<{ ruta: string }>(
    (desde, hasta) => supabase.from("respaldos_archivos").select("ruta").order("ruta").range(desde, hasta),
    "respaldos_archivos"
  );
  return new Set(filas.map((r) => r.ruta));
}

/** Resuelve (y recuerda durante la ejecución) los IDs de las carpetas de Drive. */
function crearResolutorDeCarpetas() {
  const cache = new Map<string, Promise<string>>();
  const recordar = (clave: string, crear: () => Promise<string>) => {
    if (!cache.has(clave)) cache.set(clave, crear());
    return cache.get(clave)!;
  };

  const raizComprobantes = () =>
    recordar("raiz:comprobantes", async () => getDriveFolderId() || buscarOCrearCarpeta(CARPETA_COMPROBANTES));
  const raizClientes = () =>
    recordar("raiz:clientes", async () => getClientesFolderId() || buscarOCrearCarpeta(CARPETA_CLIENTES));

  return {
    excel: () => recordar("raiz:excel", async () => getRespaldosFolderId() || buscarOCrearCarpeta(CARPETA_EXCEL)),

    async para(destino: ArchivoARespaldar["destino"]): Promise<string> {
      if (destino.tipo === "comprobante") {
        return recordar(`mes:${destino.mes}`, async () => buscarOCrearCarpeta(destino.mes, await raizComprobantes()));
      }
      if (destino.carpeta) return destino.carpeta;
      return recordar(`cliente:${destino.clienteId}`, async () => {
        const id = await buscarOCrearCarpeta(nombreCarpetaCliente(destino.nombreCliente), await raizClientes());
        await supabase.from("clientes").update({ drive_folder_id: id }).eq("id", destino.clienteId);
        return id;
      });
    },
  };
}

/**
 * Ejecuta (o continúa) el respaldo. Sin `forzar`, no hace nada si el último respaldo
 * tiene menos de 7 días y no hay un ciclo abierto: así el cron puede correr a diario.
 */
export async function ejecutarRespaldo(opciones: { forzar?: boolean; tiempoMaximoMs?: number } = {}): Promise<ResultadoRespaldo> {
  const inicio = Date.now();
  const limite = inicio + (opciones.tiempoMaximoMs ?? TIEMPO_POR_DEFECTO_MS);
  const resultado: ResultadoRespaldo = {
    omitido: false,
    excel_subido: false,
    copiados: 0,
    fallidos: 0,
    pendientes: 0,
    completo: false,
    errores: [],
  };

  const config = await leerConfiguracion();
  const dias = diasDesde(config.ultima_fecha_backup);
  const vencido = dias === null || dias >= DIAS_ENTRE_RESPALDOS;
  if (!opciones.forzar && !config.respaldo_iniciado_en && !vencido) {
    return { ...resultado, omitido: true, completo: true };
  }

  if (!isDriveConfigured()) {
    throw new Error("Google Drive no está conectado: no se puede hacer el respaldo. Conéctalo desde el menú Sistema.");
  }

  const carpetas = crearResolutorDeCarpetas();

  // 1. Excel: una vez por ciclo
  if (!config.respaldo_iniciado_en) {
    const excel = await generarExcelRespaldo();
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour12: false }).slice(0, 5).replace(":", "h");
    const fecha = ahora.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    await subirArchivoDrive(
      `Respaldo PrestaFacilito ${fecha} ${hora}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      excel,
      await carpetas.excel()
    );
    await guardarConfiguracion({ respaldo_iniciado_en: ahora.toISOString() });
    resultado.excel_subido = true;
  }

  // 2. Archivos nuevos
  const [archivos, hechos] = await Promise.all([listarArchivos(), rutasYaRespaldadas()]);
  const pendientes = archivos.filter((a) => !hechos.has(a.ruta));

  for (const archivo of pendientes) {
    if (Date.now() > limite) break;
    try {
      const contenido = await descargarArchivo(archivo.ruta);
      if (!contenido) {
        // Referenciado en la BD pero inexistente en Storage: se anota para no reintentar cada semana
        await supabase.from("respaldos_archivos").upsert({ ruta: archivo.ruta, drive_file_id: null, nota: "No existe en Storage" });
        resultado.errores.push(`No existe en Storage: ${archivo.ruta}`);
        resultado.fallidos++;
        continue;
      }
      const folderId = await carpetas.para(archivo.destino);
      const subido = await subirArchivoDrive(archivo.nombre, contenido.contentType, contenido.buffer, folderId);
      const { error } = await supabase
        .from("respaldos_archivos")
        .upsert({ ruta: archivo.ruta, drive_file_id: subido.fileId, nota: "" });
      if (error) throw new Error(`copiado a Drive pero no registrado: ${error.message}`);
      resultado.copiados++;
    } catch (err: any) {
      resultado.fallidos++;
      resultado.errores.push(`${archivo.ruta}: ${err.message}`);
      // Sin acceso a Google no tiene sentido seguir intentando con el resto
      if (/invalid_grant|credenciales/i.test(err.message)) break;
    }
  }

  const yaRegistrados = await rutasYaRespaldadas();
  resultado.pendientes = archivos.filter((a) => !yaRegistrados.has(a.ruta)).length;

  // 3. Cerrar el ciclo cuando todo está copiado
  if (resultado.pendientes === 0) {
    await guardarConfiguracion({ ultima_fecha_backup: new Date().toISOString(), respaldo_iniciado_en: null });
    resultado.completo = true;
  }

  if (resultado.errores.length > 0) console.warn("[Respaldo] Errores:", resultado.errores);
  return resultado;
}
