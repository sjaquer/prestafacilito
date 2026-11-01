import { OAuth2Client } from "google-auth-library";

/**
 * Google Drive: solo copia de seguridad (los archivos de la app viven en Supabase Storage).
 *
 * Estructura en Drive:
 *   GOOGLE_DRIVE_FOLDER_ID            → comprobantes, en subcarpetas AAAA-MM
 *   GOOGLE_DRIVE_CLIENTES_FOLDER_ID   → "Documentos - <cliente>" por cliente
 *   GOOGLE_DRIVE_RESPALDOS_FOLDER_ID  → Excel semanal
 * Si una carpeta no está configurada, se crea (o reutiliza) una con nombre fijo en la raíz.
 */

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export const getDriveFolderId = () => getEnv("GOOGLE_DRIVE_FOLDER_ID");
export const getClientesFolderId = () => getEnv("GOOGLE_DRIVE_CLIENTES_FOLDER_ID");
export const getRespaldosFolderId = () => getEnv("GOOGLE_DRIVE_RESPALDOS_FOLDER_ID");

export const getGoogleClientId = () => getEnv("GOOGLE_CLIENT_ID");
export const getGoogleClientSecret = () => getEnv("GOOGLE_CLIENT_SECRET");
export const getGoogleRefreshToken = () => getEnv("GOOGLE_REFRESH_TOKEN");

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name";
const MIME_CARPETA = "application/vnd.google-apps.folder";

export function isDriveConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

/** Token de acceso en memoria hasta poco antes de vencer (cada uno dura ~1 h): evita pedir uno por llamada. */
let tokenEnCache: { token: string; vence: number } | null = null;

export async function getGoogleDriveAccessToken() {
  if (tokenEnCache && tokenEnCache.vence > Date.now()) return tokenEnCache.token;

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getGoogleRefreshToken();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Faltan credenciales de Google OAuth 2.0. Revisa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en .env.local o en Vercel.");
  }

  try {
    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const response = await oauth2Client.getAccessToken();
    if (!response.token) {
      throw new Error("No se pudo obtener un access token de Google. Revisa si tu GOOGLE_REFRESH_TOKEN es válido.");
    }

    const expira = oauth2Client.credentials.expiry_date || Date.now() + 50 * 60_000;
    tokenEnCache = { token: response.token, vence: expira - 5 * 60_000 };
    return response.token;
  } catch (err: any) {
    tokenEnCache = null;
    if (err.message && err.message.includes("invalid_grant")) {
      throw new Error("El token de Google expiró o fue revocado (invalid_grant). Pulsa 'Reconectar' en el menú de Sistema para volver a vincular la cuenta de Google.");
    }
    throw err;
  }
}

/** Escapa un valor para usarlo dentro de una consulta `q` de la API de Drive. */
const escaparQ = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Busca una carpeta por nombre dentro de `parentId` (o en la raíz) y la crea si no existe. */
export async function buscarOCrearCarpeta(nombre: string, parentId?: string): Promise<string> {
  const accessToken = await getGoogleDriveAccessToken();
  const padre = parentId || "root";
  const q = `name = '${escaparQ(nombre)}' and '${escaparQ(padre)}' in parents and mimeType = '${MIME_CARPETA}' and trashed = false`;

  const busqueda = await fetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!busqueda.ok) {
    throw new Error(`No se pudo buscar la carpeta "${nombre}" en Drive: ${await busqueda.text()}`);
  }
  const encontrados = (await busqueda.json()) as { files?: { id: string }[] };
  if (encontrados.files?.[0]?.id) return encontrados.files[0].id;

  const creacion = await fetch(`${DRIVE_API}?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nombre, mimeType: MIME_CARPETA, parents: [padre] }),
  });
  if (!creacion.ok) {
    throw new Error(`No se pudo crear la carpeta "${nombre}" en Drive: ${await creacion.text()}`);
  }
  return ((await creacion.json()) as { id: string }).id;
}

/** Nombre de la carpeta de respaldo de un cliente: "Documentos - <nombre>". */
export function nombreCarpetaCliente(nombreCliente: string) {
  const limpio = nombreCliente.replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, "").trim();
  return `Documentos - ${limpio || "Sin nombre"}`;
}

/** Sube un archivo a la carpeta indicada. Falla (sin caer en la raíz) si la carpeta no es válida. */
export async function subirArchivoDrive(
  nombre: string,
  mimeType: string,
  buffer: Buffer,
  folderId: string
): Promise<{ fileId: string; fileName: string }> {
  const accessToken = await getGoogleDriveAccessToken();
  const boundary = `----prestafacilito-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const metadata = { name: nombre, parents: [folderId] };

  const cuerpo = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`,
      "utf8"
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);

  const res = await fetch(DRIVE_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: cuerpo,
  });

  if (!res.ok) {
    throw new Error(`No se pudo subir "${nombre}" a Google Drive: ${await res.text()}`);
  }
  const file = (await res.json()) as { id: string; name: string };
  return { fileId: file.id, fileName: file.name };
}

/** Descarga un archivo de Drive (contenido, tipo y nombre). Devuelve null si no existe. */
export async function descargarArchivoDrive(
  fileId: string
): Promise<{ buffer: Buffer; contentType: string; nombre: string } | null> {
  const accessToken = await getGoogleDriveAccessToken();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const id = encodeURIComponent(fileId);

  const meta = await fetch(`${DRIVE_API}/${id}?fields=name,mimeType`, { headers });
  if (meta.status === 404) return null;
  if (!meta.ok) throw new Error(`Drive respondió ${meta.status} al consultar ${fileId}`);
  const { name, mimeType } = (await meta.json()) as { name: string; mimeType: string };

  const contenido = await fetch(`${DRIVE_API}/${id}?alt=media`, { headers });
  if (contenido.status === 404) return null;
  if (!contenido.ok) throw new Error(`Drive respondió ${contenido.status} al descargar ${fileId}`);

  return {
    buffer: Buffer.from(await contenido.arrayBuffer()),
    contentType: contenido.headers.get("content-type") || mimeType || "application/octet-stream",
    nombre: name,
  };
}
