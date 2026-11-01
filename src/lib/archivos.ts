/**
 * Rutas de archivos (comprobantes y documentos de clientes).
 *
 * Los archivos viven en Supabase Storage (bucket privado) y se sirven a través del
 * backend en `/api/archivos/<ruta>`, que exige sesión. Google Drive queda solo como
 * copia de seguridad semanal.
 *
 * Funciones puras: se usan tanto en el backend como en el navegador.
 */

export const ARCHIVOS_PREFIX = "/api/archivos/";

/** Proxies de Drive anteriores a Storage; se siguen resolviendo hasta migrar las fotos viejas. */
const PROXIES_DRIVE = ["/api/vouchers/proxy/", "/api/documentos/proxy/"];

const RUTA_VALIDA = /^(comprobantes|clientes)\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

/** Tipos de archivo aceptados: imágenes, PDF y Word (los mismos que permite el formulario de clientes). */
const MIME_PERMITIDOS = [
  /^image\/(jpeg|png|webp|gif|heic|heif)$/,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
];

export function esMimePermitido(mimeType: string): boolean {
  return MIME_PERMITIDOS.some((re) => re.test(mimeType));
}

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Nombre de archivo seguro para una ruta de Storage: sin tildes, espacios ni símbolos,
 * con la extensión que corresponde al contenido real (al comprimir, una foto PNG se vuelve JPEG).
 */
export function nombreArchivoSeguro(fileName: string, mimeType?: string): string {
  const sinTildes = (fileName || "archivo").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const punto = sinTildes.lastIndexOf(".");
  const base = (punto > 0 ? sinTildes.slice(0, punto) : sinTildes)
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "archivo";
  const extOriginal = punto > 0 ? sinTildes.slice(punto + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const ext = (mimeType && EXTENSION_POR_MIME[mimeType]) || extOriginal || "bin";
  return `${base}.${ext}`;
}

const sufijoUnico = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** `comprobantes/AAAA/MM/<único>-<nombre>`, agrupado por el mes del pago. */
export function rutaComprobante(fileName: string, mimeType?: string, fecha: Date = new Date()): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  return `comprobantes/${anio}/${mes}/${sufijoUnico()}-${nombreArchivoSeguro(fileName, mimeType)}`;
}

/** `clientes/<clienteId>/<único>-<nombre>`. */
export function rutaDocumentoCliente(clienteId: string, fileName: string, mimeType?: string): string {
  const id = String(clienteId).replace(/[^A-Za-z0-9-]/g, "");
  return `clientes/${id}/${sufijoUnico()}-${nombreArchivoSeguro(fileName, mimeType)}`;
}

/** Evita rutas fuera de las carpetas permitidas (por ejemplo con `..`). */
export function esRutaValida(ruta: string): boolean {
  return RUTA_VALIDA.test(ruta) && !ruta.split("/").some((p) => p === "." || p === "..");
}

export const urlDeRuta = (ruta: string) => `${ARCHIVOS_PREFIX}${ruta}`;

/** Ruta de Storage contenida en una URL `/api/archivos/...`, o null si la URL es de otro origen. */
export function rutaDeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const limpia = url.trim().split("?")[0];
  if (!limpia.startsWith(ARCHIVOS_PREFIX)) return null;
  const ruta = decodeURIComponent(limpia.slice(ARCHIVOS_PREFIX.length));
  return esRutaValida(ruta) ? ruta : null;
}

/** ID de un archivo de Google Drive a partir de un enlace, un proxy antiguo o el ID puro. */
export function driveIdDeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim();
  for (const proxy of PROXIES_DRIVE) {
    if (t.startsWith(proxy)) return t.slice(proxy.length).split("?")[0] || null;
  }
  const match = t.match(/(?:\/file\/d\/|\?id=|&id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{25,55}$/.test(t)) return t;
  return null;
}

export const esUrlDeProxyDrive = (url: string) => PROXIES_DRIVE.some((p) => url.startsWith(p));

/** Guarda una lista de URLs en el formato de la columna comprobante_url (una sola o un array JSON). */
export function serializarUrls(urls: string[]): string | null {
  if (urls.length === 0) return null;
  return urls.length === 1 ? urls[0] : JSON.stringify(urls);
}
