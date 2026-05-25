# PrestaFacilito

PrestaFacilito es una app de administración de préstamos, clientes y amortizaciones con autenticación local, sincronización con Google Sheets y carga de comprobantes a Google Drive.

## Requisitos

Necesitas Node.js 18 o superior, una hoja de Google Sheets con acceso para una cuenta de servicio y una carpeta de Google Drive compartida con esa misma cuenta de servicio si quieres que los vouchers queden dentro de tu Drive.

## Variables de entorno

Configura estas variables en tu archivo `.env`:

- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `SPREADSHEET_ID`

Para que los vouchers se guarden en tu Drive personal o en una carpeta de tu organización, crea una carpeta en Google Drive, compártela con el correo de la cuenta de servicio y coloca su ID en `GOOGLE_DRIVE_FOLDER_ID`. Si no defines ese valor, el archivo se guardará en la raíz del Drive de la cuenta de servicio, no en una carpeta tuya.

## Ejecutar localmente

1. Instala dependencias con `npm install`.
2. Completa el archivo `.env` con tus valores reales.
3. Levanta la aplicación con `npm run dev`.

## Scripts

- `npm run dev`: arranca el servidor de desarrollo.
- `npm run build`: compila frontend y backend para producción.
- `npm start`: ejecuta el build de producción.
- `npm run clean`: elimina artefactos generados.

## Notas

- No subas credenciales reales al repositorio.
- Usa `.env.example` como plantilla para la configuración local.
 - Si accidentalmente comprometiste claves (por ejemplo, subiste `.env`):
	 1. Elimina el archivo del repo: `git rm --cached .env` y haz commit.
	 2. Rota/regenéra las claves afectadas inmediatamente (API keys, claves de servicio, secretos JWT).
	 3. (Opcional) Para purgar historial usa `git filter-repo` o BFG, y fuerza push sólo si comprendes las implicaciones.
	 4. Activa secret scanning en GitHub y guarda secretos en GitHub Secrets o en tu gestor de secretos.
