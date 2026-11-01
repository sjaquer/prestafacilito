# PrestaFacilito

App privada para administrar préstamos, alquileres y cobranza: clientes, cronogramas de cuotas,
pagos con comprobantes, calendario de cobros y cuentas donde llega el dinero.

> **Para agentes y nuevos desarrolladores:** las reglas del negocio, decisiones, correcciones de datos y trampas conocidas
> están en [`CLAUDE.md`](CLAUDE.md). Lo que falta hacer, en [`PENDIENTES.md`](PENDIENTES.md).

## Arquitectura

| Pieza | Qué hace |
| --- | --- |
| **React + Vite** (`src/`) | Interfaz (móvil primero). Nunca habla directo con Supabase ni con Google. |
| **Express** (`server-app.ts`, `routes/`, `services/`) | API en `/api/*`. Sesión por cookie HttpOnly (JWT) con PIN por usuario. En Vercel corre como función (`api/index.ts`). |
| **Supabase Postgres** | Datos. Acceso solo desde el backend con la clave `service_role`; RLS activo bloquea la clave pública. |
| **Supabase Storage** (bucket privado `archivos`) | Carga rápida de fotos de comprobantes (`comprobantes/AAAA/MM/…`) y documentos de clientes (`clientes/<id>/…`). Se sirven por `/api/archivos/…`, solo con sesión. |
| **Google Drive** | **Fuente de confianza.** Cada archivo se copia al subirlo (en paralelo con Storage) y se lee de Drive si Storage falla (`ARCHIVOS_MODO=solo_drive` en emergencia). Cada semana: Excel con todos los datos, en su carpeta. |
| **Google Calendar** | Eventos de cobro, sincronizados a diario y con cada pago. |

### Respaldo semanal

- Vercel Cron llama a `/api/backup/cron` todos los días; solo actúa si el último respaldo completo tiene 7 días o más (o quedó a medias).
- Sube el Excel a la carpeta de respaldos y copia a Drive las fotos que aún no tienen copia (registro en `respaldos_archivos`).
- Fotos antiguas de Drive: ya migradas a Storage (118 archivos, comprimidos en el navegador). La herramienta sigue en **Sistema → Migrar fotos a Storage**.
- Si falla o Google se desconecta, la app muestra el recordatorio (punto rojo en el menú y panel **Sistema**) con el botón **Respaldar ahora en Drive**.
- Carpetas en Drive: `GOOGLE_DRIVE_FOLDER_ID` (comprobantes, por mes), `GOOGLE_DRIVE_CLIENTES_FOLDER_ID` (una carpeta por cliente) y `GOOGLE_DRIVE_RESPALDOS_FOLDER_ID` (Excel). Si falta alguna, se crea una con nombre fijo en la raíz de Drive.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar valores
npm run dev            # http://localhost:3000 (Vite + Express en el mismo puerto)
```

Base de datos: los scripts de `supabase/migrations/` ya están aplicados en producción. Para una base nueva, ejecutarlos
en orden (por el MCP de Supabase o el SQL Editor).

Google: con sesión iniciada, abrir `/api/auth/google/login` (o **Sistema → Reconectar**) para obtener
el `GOOGLE_REFRESH_TOKEN` y guardarlo en las variables de entorno.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Desarrollo |
| `npm run lint` | Verificación de tipos (TypeScript) |
| `npm test` | Pruebas unitarias (`src/lib/__tests__`), incluye la que detecta imports sin `.js` que rompen Vercel |
| `npm run test:audit` | Auditoría de consistencia de la base de datos (solo lectura) |
| `npm run build` / `npm start` | Producción fuera de Vercel |

## Caché

- Código (`/assets/*`, con hash en el nombre): un año, inmutable. `index.html`: siempre se revalida (toma cada despliegue).
- Fotos (`/api/archivos/*`): un año en el navegador del usuario (`private`): cada archivo nuevo tiene ruta nueva.
- **Datos de la API: nunca en caché** (`no-store`). Montos, deudas y cálculos se recalculan en cada consulta.

## Seguridad

- `SUPABASE_KEY` es la clave **service_role**: solo en el servidor y en Vercel, nunca en el navegador.
- RLS activo en todas las tablas y bucket privado sin políticas: con la clave pública no se puede leer nada.
- Login con PIN por usuario (`PIN_<USUARIO>`), limitado contra fuerza bruta; `JWT_SECRET` obligatorio en producción.
- Los cron de Vercel se autentican con `CRON_SECRET`.
