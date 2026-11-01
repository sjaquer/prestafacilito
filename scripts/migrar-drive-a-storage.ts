/**
 * Copia a Supabase Storage los comprobantes y documentos que todavía están solo en Google Drive,
 * y actualiza la base de datos para que la app los lea desde Storage.
 *
 *   npx tsx scripts/migrar-drive-a-storage.ts            → simulación: solo muestra qué haría
 *   npx tsx scripts/migrar-drive-a-storage.ts --ejecutar → migra de verdad
 *
 * - No borra nada de Drive: lo que ya está allí queda registrado como su copia de respaldo
 *   (tabla respaldos_archivos), así el respaldo semanal no lo vuelve a subir.
 * - Es seguro ejecutarlo varias veces: lo ya migrado se salta.
 * - Requiere: clave service_role en SUPABASE_KEY, migración 20261031_storage_y_respaldos.sql
 *   aplicada y Google conectado (GOOGLE_REFRESH_TOKEN válido).
 */
import "dotenv/config";
import { supabase } from "../src/lib/supabase.js";
import { parseVoucherUrls } from "../src/lib/formatters.js";
import { driveIdDeUrl, rutaComprobante, rutaDeUrl, rutaDocumentoCliente, serializarUrls, urlDeRuta } from "../src/lib/archivos.js";
import { BUCKET, subirArchivo } from "../services/storage.js";
import { descargarArchivoDrive } from "../services/google-drive.js";
import { traerTodasLasPaginas } from "../services/consultas.js";

const EJECUTAR = process.argv.includes("--ejecutar");
const resumen = { migrados: 0, yaEnStorage: 0, noEncontrados: 0, errores: 0 };

/** "2026-10-31" → fecha local (para agrupar el comprobante en la carpeta del mes del pago). */
const fechaDePago = (valor: string | null) => {
  const [a, m, d] = String(valor || "").slice(0, 10).split("-").map(Number);
  return a && m ? new Date(a, m - 1, d || 1) : new Date();
};

async function verificarRequisitos() {
  const { error: errBucket } = await supabase.storage.getBucket(BUCKET);
  if (errBucket) {
    throw new Error(
      `No se puede acceder al bucket "${BUCKET}" (${errBucket.message}). ` +
        "Revisa que SUPABASE_KEY sea la clave service_role y que ejecutaste 20261031_storage_y_respaldos.sql."
    );
  }
  const { error: errTabla } = await supabase.from("documentos_cliente").select("storage_path").limit(1);
  if (errTabla) throw new Error(`Falta la columna documentos_cliente.storage_path: ${errTabla.message}`);
}

/** Descarga de Drive, sube a Storage y registra la copia. Devuelve la ruta nueva o null si falló. */
async function copiarDesdeDrive(driveId: string, crearRuta: (nombre: string, mime: string) => string, etiqueta: string) {
  if (!EJECUTAR) {
    console.log(`  [simulación] ${etiqueta}: Drive ${driveId} → Storage`);
    resumen.migrados++;
    return null;
  }
  try {
    const archivo = await descargarArchivoDrive(driveId);
    if (!archivo) {
      console.warn(`  ✗ ${etiqueta}: el archivo ${driveId} no existe en Drive`);
      resumen.noEncontrados++;
      return null;
    }
    const ruta = crearRuta(archivo.nombre, archivo.contentType);
    await subirArchivo(ruta, archivo.buffer, archivo.contentType);
    await supabase
      .from("respaldos_archivos")
      .upsert({ ruta, drive_file_id: driveId, nota: "Migrado desde Drive (original)" });
    console.log(`  ✓ ${etiqueta}: ${ruta}`);
    resumen.migrados++;
    return ruta;
  } catch (err: any) {
    console.error(`  ✗ ${etiqueta}: ${err.message}`);
    resumen.errores++;
    return null;
  }
}

async function migrarComprobantes(tabla: "amortizaciones" | "pagos_alquiler") {
  console.log(`\n== ${tabla} ==`);
  const filas = await traerTodasLasPaginas<{ id: string; fecha_pago: string | null; comprobante_url: string }>(
    (desde, hasta) =>
      supabase
        .from(tabla)
        .select("id, fecha_pago, comprobante_url")
        .not("comprobante_url", "is", null)
        .order("id")
        .range(desde, hasta),
    tabla
  );

  for (const fila of filas) {
    const urls = parseVoucherUrls(fila.comprobante_url);
    const nuevas: string[] = [];
    let cambio = false;

    for (const url of urls) {
      if (rutaDeUrl(url)) {
        resumen.yaEnStorage++;
        nuevas.push(url);
        continue;
      }
      const driveId = driveIdDeUrl(url);
      if (!driveId) {
        console.warn(`  ? ${tabla} ${fila.id}: URL no reconocida, se deja igual (${url.slice(0, 60)})`);
        nuevas.push(url);
        continue;
      }
      const ruta = await copiarDesdeDrive(
        driveId,
        (nombre, mime) => rutaComprobante(nombre, mime, fechaDePago(fila.fecha_pago)),
        `${tabla} ${fila.id}`
      );
      if (ruta) {
        nuevas.push(urlDeRuta(ruta));
        cambio = true;
      } else {
        nuevas.push(url); // se conserva el enlace a Drive: la app lo sigue mostrando por el proxy
      }
    }

    if (cambio) {
      const { error } = await supabase.from(tabla).update({ comprobante_url: serializarUrls(nuevas) }).eq("id", fila.id);
      if (error) {
        console.error(`  ✗ ${tabla} ${fila.id}: copiado pero no se actualizó la BD: ${error.message}`);
        resumen.errores++;
      }
    }
  }
}

async function migrarDocumentos() {
  console.log("\n== documentos_cliente ==");
  const docs = await traerTodasLasPaginas<{
    id: string;
    cliente_id: string;
    nombre_archivo: string;
    drive_file_id: string | null;
    drive_url: string | null;
    storage_path: string | null;
  }>(
    (desde, hasta) =>
      supabase
        .from("documentos_cliente")
        .select("id, cliente_id, nombre_archivo, drive_file_id, drive_url, storage_path")
        .order("id")
        .range(desde, hasta),
    "documentos_cliente"
  );

  for (const doc of docs) {
    if (doc.storage_path) {
      resumen.yaEnStorage++;
      continue;
    }
    const driveId = doc.drive_file_id || driveIdDeUrl(doc.drive_url);
    if (!driveId) {
      console.warn(`  ? documento ${doc.id}: sin archivo en Drive, se omite`);
      continue;
    }
    const ruta = await copiarDesdeDrive(
      driveId,
      (_nombre, mime) => rutaDocumentoCliente(doc.cliente_id, doc.nombre_archivo, mime),
      `documento ${doc.id} (${doc.nombre_archivo})`
    );
    if (ruta) {
      const { error } = await supabase.from("documentos_cliente").update({ storage_path: ruta }).eq("id", doc.id);
      if (error) {
        console.error(`  ✗ documento ${doc.id}: copiado pero no se actualizó la BD: ${error.message}`);
        resumen.errores++;
      }
    }
  }
}

async function main() {
  console.log(EJECUTAR ? "MIGRACIÓN REAL Drive → Storage" : "SIMULACIÓN (nada se modifica). Usa --ejecutar para migrar.");
  await verificarRequisitos();
  await migrarComprobantes("amortizaciones");
  await migrarComprobantes("pagos_alquiler");
  await migrarDocumentos();
  console.log("\nResumen:", resumen);
  if (resumen.errores > 0 || resumen.noEncontrados > 0) {
    console.log("Los que fallaron siguen viéndose desde Drive. Puedes volver a ejecutar el script para reintentarlos.");
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
