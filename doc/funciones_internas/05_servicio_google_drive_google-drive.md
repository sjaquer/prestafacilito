# ⚙️ Módulo Interno: Servicio e Integración con Google Drive (`google-drive.ts`)

- **Ubicación del Código Fuente**: [`services/google-drive.ts`](file:///home/sjaquer/Downloads/prestafacilito/services/google-drive.ts) y [`routes/drive.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/drive.routes.ts)
- **Propósito**: Gestionar el almacenamiento seguro en la nube de vouchers de pago, contratos de préstamo y documentos de identidad de clientes a través de la API oficial de Google Drive v3, implementando un proxy autenticado para evitar exponer URLs públicas directas.

---

## 🔑 1. Autenticación OAuth 2.0 y Manejo de Tokens

### `getGoogleDriveAccessToken(): Promise<string>`
Solicita un Access Token de corta duración utilizando el Refresh Token configurado en el servidor.

```typescript
export async function getGoogleDriveAccessToken(): Promise<string>;
```

#### Variables de Entorno Requeridas:
- `GOOGLE_CLIENT_ID`: Identificador de cliente OAuth 2.0 en Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: Clave secreta del cliente OAuth 2.0.
- `GOOGLE_REFRESH_TOKEN`: Token de larga duración para renovar credenciales.
- `GOOGLE_DRIVE_FOLDER_ID`: ID de la carpeta principal de vouchers en Drive.
- `GOOGLE_DRIVE_CLIENTES_FOLDER_ID`: ID de la carpeta de expedientes de clientes.

#### Manejo de Errores:
- Si Google responde con `invalid_grant`, el servicio lanza una excepción explícita indicando que el token fue revocado o expiró, sugiriendo la reconexión en `/api/auth/google/login`.

---

## 📤 2. Funciones de Carga de Archivos

### 2.1. `uploadVoucherToDrive(fileName, mimeType, buffer)`
Sube una imagen de comprobante bancario a Google Drive mediante una petición `multipart/related`.

```typescript
export async function uploadVoucherToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{
  fileId: string;
  fileName: string;
  webViewLink?: string;
  webContentLink?: string;
  publicUrl: string;
  directUrl: string;
  folderId: string;
}>;
```

#### Características de Resiliencia:
- **Sanitización de Nombres**: Limpia caracteres especiales para evitar nombres inválidos en el sistema de archivos de Google.
- **Fallback Automático a Raíz**: Si la carpeta configurada en `GOOGLE_DRIVE_FOLDER_ID` fue eliminada o no tiene permisos (error 404/403), el sistema reintenta inmediatamente la subida en la raíz de Google Drive para garantizar que el voucher nunca se pierda.
- **Retorno de URL de Proxy**: Devuelve `publicUrl: /api/vouchers/proxy/${uploadedFile.id}` para su consumo por el frontend.

---

### 2.2. `createDriveSubfolder(clientName, parentFolderId)`
Crea una carpeta exclusiva para el expediente del cliente con el formato: `Documentos - [Nombre Cliente]`.

```typescript
export async function createDriveSubfolder(
  clientName: string,
  parentFolderId?: string
): Promise<string>;
```

---

### 2.3. `uploadDocumentToDrive(fileName, mimeType, buffer, folderId)`
Sube documentos legales (DNI, copias de Registros Públicos, pagarés firmados) dentro de la subcarpeta del cliente.

```typescript
export async function uploadDocumentToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  folderId?: string
): Promise<{
  fileId: string;
  fileName: string;
  publicUrl: string;
}>;
```

---

## 🛡️ 3. Proxy Seguro de Visualización de Archivos

En lugar de hacer públicos los archivos en Google Drive (lo que violaría la privacidad de los clientes), PrestaFacilito utiliza endpoints intermediarios autenticados:

1. **`GET /api/vouchers/proxy/:fileId`**:
   - Requiere autenticación (`requireAuth`).
   - Solicita el archivo a `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media` usando el `Authorization: Bearer <accessToken>`.
   - Entrega el buffer al cliente con cabecera `Content-Type` correspondiente y `Cache-Control: public, max-age=86400` para optimizar el rendimiento del navegador.
2. **`GET /api/documentos/proxy/:fileId`**:
   - Proxy para expedientes de clientes (PDFs, imágenes de DNI, documentos Word).
