# PrestaFacilito: guía para agentes

App privada (2 usuarios) para administrar **préstamos, alquileres y cobranza** en soles (S/), zona horaria **America/Lima**.
Todo el código, la UI y los mensajes están en español. Este archivo resume la arquitectura, las reglas del negocio
y las decisiones tomadas. Lo pendiente está en `PENDIENTES.md`, y la puesta en marcha en `README.md`.

---

## 0. Reglas de trabajo (obligatorias)

1. **No hacer `git commit` ni `git push`.** Al terminar, entregar el mensaje de commit listo para copiar. Termina con
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. El usuario hace commit y push (no hay credenciales en esta máquina).
2. **No cambiar los cálculos de préstamos, intereses o alquileres sin aprobación explícita.** Si un número parece raro, se
   revisa y se reporta (en `PENDIENTES.md` §3), no se "arregla". Recordar que dos pantallas pueden no coincidir por usar
   criterios distintos, sin que la matemática esté mal.
3. **No existe la mora.** Nunca usar la palabra "mora" en código, UI ni docs. El interés de meses pasados que no se pagó
   es **"interés atrasado"** y no tiene recargo.
4. **Un préstamo al 0 % nunca es "estancado".** Si un 0 % no cuadra, se revisa con los vouchers.
5. **Los datos de la API nunca se cachean** (`no-store`). Solo se cachean el código con hash y las fotos.
6. **Nunca imprimir valores secretos** de `.env`/`.env.local`: clave service_role, PINs, `JWT_SECRET`, secretos de Google o `CRON_SECRET`.
7. Antes de entregar: `npm run lint && npm test && npm run build`.

---

## 1. Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | `tsx server.ts`: Vite + Express en http://localhost:3000 |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | `tsx --test src/lib/__tests__/*.test.ts` (63 pruebas) |
| `npm run test:audit` | Auditoría de consistencia de la BD (solo lectura) |
| `npm run build` | Vite + bundle del servidor (`dist/server.cjs`, fuera de Vercel) |

Para matar un servidor de desarrollo colgado, usar su PID: `pkill -f "tsx server.ts"` se mata a sí mismo.

---

## 2. Arquitectura

```
Navegador (React 19 + Vite + Tailwind v4, móvil primero)
   │  fetch /api/*  (cookie HttpOnly con JWT)
   ▼
Express (server-app.ts → routes/ → services/)      ← en Vercel: una sola función, api/index.ts
   ├── Supabase Postgres  (clave service_role; RLS activo en todo)
   ├── Supabase Storage   (bucket privado "archivos": carga rápida)
   ├── Google Drive       (copia inmediata de cada archivo + Excel semanal: fuente de confianza)
   └── Google Calendar    (un evento por cobro pendiente)
```

- El **frontend nunca habla con Supabase ni con Google**. Todo pasa por `/api`.
- **Vercel ejecuta el servidor como Node ESM puro.** Los imports relativos del código que usa el servidor (`routes/`,
  `services/`, `helpers/`, `middleware/` **y lo que importen de `src/lib/`**) **deben llevar extensión `.js`**
  (`import { x } from "./archivos.js"`). Un import sin extensión tumba producción entera con `FUNCTION_INVOCATION_FAILED`.
  Lo vigila `src/lib/__tests__/importsServidor.test.ts`, que compila el grafo del servidor con esbuild.
- `helpers/env.ts` carga `.env.local` y después `.env`. Los valores que empiezan por `PEGAR_AQUI` se descartan.
- Las variables de Vercel se fijan al momento de cada deploy: si se cambia una, hay que **redesplegar**.
- Producción: `prestafacilito.vercel.app`. Los deploys de ramas son *Preview*; a producción va `main`.

### Mapa del código

| Carpeta | Contenido |
| --- | --- |
| `routes/` | `prestamos` (incluye pagos/amortizaciones y ajustes), `alquileres`, `clientes` (documentos, score), `dashboard` (`/home` = datos de Inicio), `bi` (Reportes), `archivos` (servir fotos y migración), `drive`, `calendar`, `backup`, `auth` |
| `services/` | `almacen` (guardar/leer archivos con Storage + Drive), `storage`, `google-drive`, `carpetas-drive`, `respaldo` + `excel-respaldo` (respaldo semanal), `migracion` (fotos de Drive a Storage), `score`, `google-calendar` + `calendario-eventos`, `consultas` (paginación sin límite de 1000 filas) |
| `src/lib/` | **Lógica pura y testeada**: `loanLogic` (motor de préstamos), `alquilerLogic`, `proximoCobro`, `cobranza` (grupos de Inicio), `resumenPrestamo`, `scoreLogic`, `planPagos`, `cuentas`, `fechas`, `formatters`, `archivos`, `imageCompression` |
| `src/pages/` | Una página por ruta: Inicio, Cartera, Clientes, Alquileres, Cuentas, Reportes (BI), Vouchers, detalles |
| `src/components/` | Por dominio (`inicio/`, `prestamo/`, `alquiler/`, `cliente/`, …) y `ui/` (BottomSheet, Button, Card, DataTable…) |
| `supabase/migrations/` | Esquema SQL, **todo ya aplicado** al proyecto (ver §7) |
| `middleware/` | `auth` (JWT), `cron` (`CRON_SECRET`), `rateLimit` (login), `errorHandler` |

### Tablas

`clientes`, `prestamos`, `amortizaciones` (pagos de préstamos), `ajustes_prestamo` (congelamientos), `alquileres`,
`pagos_alquiler`, `documentos_cliente`, `score_clientes`, `configuracion_sistema` (estado de respaldos, etc.) y
`respaldos_archivos` (ruta, drive_file_id, en_storage, nota).

---

## 3. Reglas del negocio

### Préstamos: motor `buildPaymentSchedule` (`src/lib/loanLogic.ts`)
- Préstamo **libre**: no hay cuota fija. Cada mes (en el día de emisión; un 31 pasa a 28/29 en febrero) se cobra
  **interés = capital al inicio del mes × tasa mensual**.
- Si el mes no se paga completo, el resto queda como **interés atrasado**: sin recargo y sin interés sobre interés.
- Cada pago se aplica en orden: **interés atrasado → interés del mes → capital**.
- El **mínimo** de un mes es el interés. **Para liquidar** se paga lo atrasado, el interés y todo el capital.
- **Congelamiento** (`ajustes_prestamo`, tipo `congelar_interes_temporal`): no se cobra interés en las cuotas cuyo
  vencimiento cae en `fecha_inicio ≤ vencimiento ≤ fecha_fin`. Siempre es un rango de cuota X a cuota Y: la API exige
  `fecha_fin` y no deja reactivar congelamientos sin fin. Es el único tipo de ajuste que existe.
- `esEstancado = tasa > 0 && cuotasVencidas >= 3` en el motor. Ojo: hay otras definiciones de estancado (§ Inicio y
  `PENDIENTES.md` §3).

### Inicio: grupos de cobro (`src/lib/cobranza.ts`, `src/components/inicio/tipos.ts`)
- **Atrasado** = interés que venció **antes de hoy** y no se pagó (`proximoCobroPrestamo`). La cuota que vence hoy
  **todavía no es atraso**.
- `clasificarCobro`: 5 o más cuotas atrasadas → `estancado` (sección aparte); 1 o más → `atrasado`. Si no hay atraso,
  según los días a la próxima fecha: 0 → `hoy`, 1 → `manana`, 2 a 7 → `semana`, más → `despues`.
- Si no hay nada que cobrar en la próxima fecha (por ejemplo, interés congelado) → `despues` con la etiqueta **"Sin cobro"**.
- **Un atrasado al que además le vence una cuota hoy, mañana o esta semana aparece en las dos pestañas**: Atrasados y la de
  su próxima fecha. Los flags son `venceHoyTambien`, `venceMananaTambien` y `venceSemanaTambien`. El contador de la pestaña
  suma esos extras (`hoyExtra`, `mananaExtra`, `semanaExtra` en `InicioPage`). La etiqueta muestra "Hoy + atrasado" o
  "Mañana + atrasado".
- Monto a cobrar: si vence hoy también, el total para dejarlo al día (`monto_proximo`); si es solo atrasado, lo atrasado;
  en los demás casos, el monto de la próxima cuota. En el KPI "Cobrar hoy" se suma solo la parte de hoy, para no contar
  dos veces lo atrasado.
- Inicio tiene vista de **tarjetas** o **tabla** (`TablaCobros.tsx`), y recuerda la elegida en `localStorage["inicio_vista"]`.
- Todo esto **solo agrupa y rotula** lo que calcula el servidor: no recalcula deudas.

### Alquileres (`src/lib/alquilerLogic.ts`)
- Cada pago cuenta para **el mes que se eligió** (`periodo_mes`/`periodo_anio`), hasta el monto de la renta.
- Lo pagado de más, o los pagos de meses anteriores al contrato, cubre **el mes impago más antiguo**
  (`MesAlquiler.cubiertoConExcedente`).
- Los pagos de meses futuros quedan reservados para su mes.
- `totalVencido` ("debe a la fecha") suma **solo meses ya vencidos**, no la mensualidad que aún no vence. Los días de un
  mes vencido se calculan desde `fechaVencimiento` (antes un valor recortado mostraba "vence hoy").

### Score A/B/C (`src/lib/scoreLogic.ts`, `services/score.ts`)
- Puntos:
  - Puntualidad: 50 (cuotas vencidas con algo que pagar que quedaron Saldadas).
  - Al día: 25, menos 8 por cada cuota atrasada hoy.
  - Préstamos liquidados: 15.
  - Días de atraso: 10 (0 días = 10, 60 o más = 0).
- **A ≥ 70, B ≥ 40, si no C.** Las cuotas congeladas y las de préstamos al 0 % no cuentan. Sin cuotas cobrables, no hay letra.
- Se guarda en `score_clientes`. Se recalcula cada día (cron del calendario) y tras cada cambio de pagos (`programarScore`).

### Guía de pagos (`src/lib/planPagos.ts`, `GuiaPagos.tsx`)
- Es **solo informativa**: no se guarda ni limita pagos.
- "En N cuotas" (cuota fija; la última absorbe el redondeo) o "Pagando S/ X al mes" (cuántos meses tarda).
- Simula con las mismas reglas del motor.

### Funciones decididas por el usuario (2026-11-01)
- **Se quedan:** Score A/B/C (mejorado) y la guía de pagos (antes "Previsualizar cuotas").
- **Se quitaron:** "Acuerdos/notas del préstamo" y "Tipo de cada pago" (`classifyPayment` y el rotulado de
  `tipo_movimiento`). No volver a agregarlas.

---

## 4. Archivos: Storage + Drive

- Las fotos se **comprimen en el navegador** (`imageCompression.ts`):
  - Comprobante: WebP en grises ≤900×1600, calidad 0.6 (JPEG en Safari).
  - Documento: color ≤1400.
- Al subir, `services/almacen.ts › guardarArchivo` escribe **Storage y Drive en paralelo** con el mismo contenido.
  Drive es la **fuente de confianza**; Storage es la carga rápida.
- Rutas en Storage: `comprobantes/AAAA/MM/<id>-<nombre>` y `clientes/<clienteId>/…`. En la BD se guarda la URL
  `/api/archivos/<ruta>`, que sirve el archivo solo con sesión iniciada.
- `leerArchivo` lee de Storage y, si falla, cae a Drive. `ARCHIVOS_MODO=solo_drive` es el modo de emergencia si Storage colapsa.
- `restaurarStorage` copia de vuelta a Storage lo que quedó solo en Drive. El registro está en `respaldos_archivos`.
- Carpetas en Drive: comprobantes por mes (`GOOGLE_DRIVE_FOLDER_ID`), una carpeta por cliente
  (`GOOGLE_DRIVE_CLIENTES_FOLDER_ID`) y el Excel semanal (`GOOGLE_DRIVE_RESPALDOS_FOLDER_ID`, opcional). Las que faltan se
  crean con nombre fijo.
- **Respaldo semanal** (`services/respaldo.ts`): el cron diario `/api/backup/cron` solo actúa si pasaron 7 días o el
  respaldo anterior quedó a medias. Sube el Excel con todos los datos y copia los archivos sin copia. Si falla, la app
  muestra un recordatorio (punto rojo y panel Sistema → "Respaldar ahora en Drive").
- Visor de comprobantes: `VoucherLightbox.tsx` es una galería con todos los vouchers de un pago (sin límite de 3).
- Migración de fotos antiguas (de Drive a Storage): **hecha**. Fueron 118 archivos, 3.38 MB, todos con su original en Drive.

---

## 5. Seguridad y caché

- `SUPABASE_KEY` es la **service_role** y solo vive en el servidor. **RLS activo en todas las tablas**, sin políticas
  (con la clave anon no se lee nada). El bucket es privado.
- El event trigger `rls_por_defecto` activa RLS automáticamente en cada tabla nueva.
- Login con PIN por usuario (`PIN_<USUARIO>`) con límite de intentos. El JWT va en una cookie HttpOnly. Los cron se
  autentican con `CRON_SECRET`.
- `X-Frame-Options: DENY` en producción; `SAMEORIGIN` solo en desarrollo, para la vista previa.
- Caché (`vercel.json` y Express):
  - `/assets/*`: 1 año, inmutable.
  - `index.html`: `no-cache`.
  - `/api/archivos/*`: privado, 1 año, inmutable (cada archivo tiene ruta nueva).
  - **El resto de `/api`: `no-store`**.

---

## 6. Variables de entorno

Plantilla en `.env.example`. `.env.local` solo tiene las que se usan:

- Supabase: `SUPABASE_URL`, `SUPABASE_KEY`.
- Sesión: `JWT_SECRET`, `PIN_SJAQUER`, `PIN_RJAQUE`.
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`,
  `GOOGLE_DRIVE_CLIENTES_FOLDER_ID`, `GOOGLE_CALENDAR_ID`.
- Otras: `ARCHIVOS_MODO`, `CRON_SECRET`.
- Opcionales: `APP_URL` (por defecto `VERCEL_PROJECT_PRODUCTION_URL`), `GOOGLE_DRIVE_RESPALDOS_FOLDER_ID` y
  `SUPABASE_STORAGE_BUCKET` (por defecto `archivos`).

En local, `GOOGLE_REFRESH_TOKEN` es un marcador (`PEGAR_AQUI…`): Drive y Calendar solo funcionan en Vercel, salvo que se
pegue el token.

Crons (`vercel.json`): `/api/cron/calendario` a las 11:00 UTC (calendario y scores) y `/api/backup/cron` a las 08:00 UTC.

---

## 7. Supabase

- Proyecto `mvusegasjopczjziupts`. Hay MCP configurado en `.mcp.json` (servidor `supabase`); también sirve el conector
  claude.ai Supabase. Para consultar datos reales usar `execute_sql` (de solo lectura salvo que el usuario pida
  corregir algo).
- Migraciones del repo, **todas aplicadas**: esquema base, score, comprobantes de alquiler, configuración, estados de
  préstamo, `20261015_enable_rls`, `20261031_storage_y_respaldos`, `20261101_indices_claves_foraneas` y
  `20261101_seguridad_predeterminada`. Para un cambio nuevo, crear el archivo en `supabase/migrations/` **y** aplicarlo
  con `apply_migration`.

---

## 8. Historial de correcciones de datos (para no repetirlas ni deshacerlas)

| Fecha | Caso | Qué se hizo |
| --- | --- | --- |
| 2026-10-31 | Préstamos al 0 % marcados como estancados (Mario Rojas, Teddy Paredes) | Regla en el motor, al guardar el estado y en el aviso de detalle. Ningún monto cambió. |
| 2026-11-01 | **George Villacorta** (préstamo `98417e57-…`): ajustes `8a9c4dc8-…` y `e7d4b374-…` congelaban todo desde el 2026-05-25 sin fin | Por decisión del usuario, se congelan solo las cuotas 8 (`2026-04-01`) y 9 (`2026-05-01`), con `fecha_inicio = fecha_fin`. Se perdonan S/ 207.06 (antes S/ 526.17). Ahora está atrasado en la cuota del 01/10 y tiene la del 01/11. |
| 2026-11-01 | **Natali Reátegui** (alquiler `3b9354e3-…`): los meses no cuadraban | Lo arregló la nueva asignación por mes elegido. Debe S/ 1,450 y no hay pagos de febrero a mayo de 2026; julio tiene 2 pagos. **Pendiente de revisar con la clienta** (no tocar los datos). |
| 2026-11-01 | Scores | Recalculados para 20 clientes: 12 A, 2 B, 2 C y 4 sin historial (préstamos al 0 %). |
| 2026-11-01 | Fotos | 118 archivos migrados de Drive a Storage, comprimidos. |

Hallazgos de cálculo **sin tocar** (esperan decisión del usuario), detallados en `PENDIENTES.md` §3:
- Criterios distintos entre Inicio y Reportes.
- 6 préstamos pagados que siguen `activo`.
- El "top 5" de Reportes usa todo lo prestado.
- Reportes usa la fecha UTC.
- Excedentes sin aplicar.
- El desglose por pago en el cronograma no siempre coincide.

---

## 9. Errores conocidos que ya costaron caro

- **Import sin `.js` en código del servidor** → producción caída entera. Correr `npm test`, que lo detecta.
- **Desplegar con la clave anon**: con RLS activo deja todo vacío. Verificar en los logs de Supabase (rol
  `service_role`) antes de cambiar la seguridad.
- **Deploys que quedan como Preview**: hay que promoverlos o hacer merge a `main`.
- **`toFixed` en montos visibles**: usar `formatSoles` (formato `S/ 1,234.50`).
- **Montos grandes en móvil**: usar `whitespace-nowrap` y tamaños con `clamp()`.
- **Fechas**: el frontend usa la fecha local (`src/lib/fechas.ts`) y el servidor usa `hoyLima()`. No usar
  `new Date().toISOString()` para "hoy", porque desde las 19:00 de Lima ya es el día siguiente en UTC.
