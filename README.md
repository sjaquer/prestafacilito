# PrestaFacilito

PrestaFacilito es una app de administración de préstamos, clientes y amortizaciones con autenticación local y sincronización con Google Sheets.

## Requisitos

Necesitas Node.js 18 o superior y una hoja de Google Sheets con acceso para una cuenta de servicio.

## Variables de entorno

Configura estas variables en tu archivo `.env`:

- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `SPREADSHEET_ID`

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
