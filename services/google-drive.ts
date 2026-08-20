import { OAuth2Client } from "google-auth-library";

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export const getDriveFolderId = () => getEnv("GOOGLE_DRIVE_FOLDER_ID");
export const getClientesFolderId = () => getEnv("GOOGLE_DRIVE_CLIENTES_FOLDER_ID") || getDriveFolderId();

export const getGoogleClientId = () => getEnv("GOOGLE_CLIENT_ID");
export const getGoogleClientSecret = () => getEnv("GOOGLE_CLIENT_SECRET");
export const getGoogleRefreshToken = () => getEnv("GOOGLE_REFRESH_TOKEN");

export async function getGoogleDriveAccessToken() {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const refreshToken = getGoogleRefreshToken();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Faltan credenciales de Google Drive OAuth 2.0. Revisa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el archivo .env o en Vercel.");
  }

  try {
    const oauth2Client = new OAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const response = await oauth2Client.getAccessToken();
    if (!response.token) {
      throw new Error("No se pudo obtener un access token para Google Drive. Revisa si tu GOOGLE_REFRESH_TOKEN es válido.");
    }

    return response.token;
  } catch (err: any) {
    if (err.message && err.message.includes("invalid_grant")) {
      throw new Error("El token de actualización de Google Drive ha expirado o fue revocado (invalid_grant). Por favor haz clic en 'Reconectar' en el encabezado de la aplicación o visita /api/auth/google/login para volver a vincular tu cuenta de Google.");
    }
    throw err;
  }
}

export async function uploadVoucherToDrive(fileName: string, mimeType: string, buffer: Buffer) {
  const accessToken = await getGoogleDriveAccessToken();
  const folderId = getDriveFolderId();
  const uniqueName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const boundary = `----prestafacilito-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const metadata: Record<string, unknown> = {
    name: uniqueName
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const prefix = `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const prefixBuffer = Buffer.from(prefix, "utf8");
  const suffixBuffer = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const multipartBody = Buffer.concat([prefixBuffer, buffer, suffixBuffer]);

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`No se pudo subir el archivo a Google Drive: ${errorText}`);
  }

  const uploadedFile = await uploadResponse.json();

  return {
    fileId: uploadedFile.id as string,
    fileName: uploadedFile.name as string,
    webViewLink: uploadedFile.webViewLink as string | undefined,
    webContentLink: uploadedFile.webContentLink as string | undefined,
    publicUrl: `/api/vouchers/proxy/${uploadedFile.id}`,
    directUrl: `https://drive.google.com/uc?export=view&id=${uploadedFile.id}`,
    folderId: folderId || ""
  };
}

export function isDriveConfigured(): boolean {
  return !!getGoogleClientId() && !!getGoogleClientSecret() && !!getGoogleRefreshToken();
}

export async function createDriveSubfolder(clientName: string, parentFolderId: string): Promise<string> {
  const accessToken = await getGoogleDriveAccessToken();
  const safeName = clientName.replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, '').trim();
  const folderName = `Documentos - ${safeName}`;

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`No se pudo crear la subcarpeta en Google Drive: ${err}`);
  }

  const folder = await response.json() as { id: string };
  return folder.id;
}

export async function uploadDocumentToDrive(fileName: string, mimeType: string, buffer: Buffer, folderId: string) {
  const accessToken = await getGoogleDriveAccessToken();
  const uniqueName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
  const boundary = `----prestafacilito-doc-${Date.now()}`;

  const metadata = { name: uniqueName, parents: [folderId] };

  const prefix = `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const prefixBuffer = Buffer.from(prefix, "utf8");
  const suffixBuffer = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([prefixBuffer, buffer, suffixBuffer]);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  if (!uploadResponse.ok) {
    const err = await uploadResponse.text();
    throw new Error(`Error al subir documento a Drive: ${err}`);
  }

  const file = await uploadResponse.json() as { id: string; name: string; webViewLink?: string };
  return {
    fileId: file.id,
    fileName: file.name,
    publicUrl: `/api/documentos/proxy/${file.id}`
  };
}
