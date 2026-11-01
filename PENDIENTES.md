# Pendientes

Estado al 2026-10-31. Lo marcado **[tú]** requiere acceso a Supabase, Vercel o Google y no se puede hacer desde el código.

## 1. Activar Storage, la copia en Drive y la seguridad (en este orden)

Cómo queda: **Drive = fuente de confianza** (toda foto se copia ahí al subirla) · **Supabase Storage = carga rápida**. Si Storage falla, la app sirve la foto desde Drive sola; con `ARCHIVOS_MODO="solo_drive"` funciona entera sin Storage, y al volver a `normal` el cron copia de vuelta a Storage lo que quedó solo en Drive.

1. **[tú]** Reiniciar Claude Code en el proyecto, aprobar el MCP `supabase` y autenticarlo (`/mcp` → supabase → Authenticate). Con eso, Claude puede ejecutar los SQL de los pasos 5 y 6.
2. **[tú]** Supabase → Project Settings → API Keys → copiar la clave **service_role** (secret). Pegarla en `.env.local` (`SUPABASE_KEY="..."`, quitando el `#`) y en Vercel (Production). El MCP no puede leer claves secretas.
3. **[tú]** En Vercel, agregar `CRON_SECRET` (el mismo valor que ya quedó en `.env.local`) y `ARCHIVOS_MODO=normal`. Borrar de Vercel/`.env` las variables sin uso: `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. **[tú]** Desplegar y comprobar en los logs: `[DB] Conectado con rol service_role`.
5. SQL: `supabase/migrations/20261031_storage_y_respaldos.sql` (bucket privado, columnas, tabla `respaldos_archivos` con `en_storage`).
6. SQL: `supabase/migrations/20261015_enable_rls.sql` (RLS en todas las tablas).
7. **[tú]** Probar: subir un comprobante (debe quedar en Storage y en la carpeta del mes en Drive) y pulsar **Sistema → Respaldar ahora en Drive**.
8. **[tú]** **Sistema → "Migrar fotos a Storage"**: copia a Storage, ya comprimidas, las ~96 fotos que hoy están solo en Drive. El original queda en Drive en calidad completa.
9. **[tú]** Rotar la clave anon (Settings → API): estuvo en uso con acceso total.
10. Local: para probar Drive desde tu equipo, **Sistema → Reconectar**; el token se guarda solo en `.env.local`.

Hasta el paso 5, subir comprobantes en producción falla ("Bucket not found"): desplegar el código y aplicar el SQL el mismo día.

### Ahorro de espacio y egress (ya aplicado)
- Fotos comprimidas en el navegador antes de subir (vouchers en grises WebP, ~20–120 KB).
- Una sola subida desde el celular; el servidor escribe Storage y Drive en paralelo con el mismo contenido: el respaldo no vuelve a descargar de Storage.
- Cada foto se guarda 1 año en el navegador (`immutable`): se descarga una vez por equipo.
- Drive solo se lee si Storage falla o para restaurar.
- Al borrar un documento de cliente se libera de Storage (la copia en Drive queda).

## 2. Google

- **[tú]** Si la app de OAuth en Google Cloud está en modo **Testing**, el refresh token caduca a los 7 días y el respaldo semanal fallará siempre. Pasarla a **In production** (Google Auth Platform → Audience → Publish app).
- El callback de OAuth escribe el token en `.env.local` (local) o lo imprime en los logs (Vercel). Mejor guardarlo en la base de datos para que "Reconectar" funcione sin redesplegar.

## 3. Revisión de cálculos (2026-10-31) — solo revisado, nada modificado

Verificado con los datos reales (25 préstamos con estado `activo` en la BD, 114 pagos).

**El motor (`buildPaymentSchedule`) es coherente.** Cobra el interés del mes sobre el capital al inicio del mes; si el pago no lo cubre, el resto pasa a mora (sin interés sobre interés). Cada pago se aplica primero a la mora, luego al interés y el excedente va a capital. Las fechas no se corren (préstamo del 31 → 28/29 feb → 31 mar). Los tests pasan.

**Por qué Inicio dice 5 atrasados y Reportes dice 9.** No es un error de cálculo: cada pantalla usa un criterio distinto.
- Inicio: préstamos con interés vencido *hoy* sin pagar (5). Los que tienen 5 o más cuotas sin pagar van aparte, en la sección de estancados (2, ambos de Isabel Sánchez).
- Reportes (`bi.routes.ts`): préstamos que *alguna vez* tuvieron un mes impago o incompleto, aunque ya se pusieron al día. Suma los mismos 5 + 2, más:
  - **Mario Rojas**: préstamo de S/ 420 **al 0 %** sin pagos desde mayo. No debe interés, pero el motor cuenta los meses sin pago.
  - **George Jhonatan**: tiene 2 congelamientos de interés que Reportes no aplica (no carga `ajustes_prestamo`).

**Errores reales encontrados (de criterio o de etiqueta, no del motor):**
1. ✅ **Regla aplicada (2026-10-31): un préstamo al 0 % nunca es estancado.** Se aplicó en el motor (`esEstancado`), en el estado que se guarda al editar o registrar un pago (si un 0 % estaba como estancado, vuelve a "activo") y en el aviso de `PrestamoDetalle`. Hay un test que la fija. Verificado con los datos reales: ningún monto ni cuota cambia; solo Mario Rojas y Teddy Paredes dejan de figurar como estancados.
   - Sigue pendiente: `esEstancado` del motor cuenta meses incompletos *históricos* (3 o más, aunque ya se puso al día), y hay tres definiciones de estancado (motor: 3 o más históricos; Inicio/Calendario: 5 o más vigentes; estado de la BD). Préstamos al 0 % hoy: Teddy Paredes, Tuty Paredes, Mario Rojas, Carlos Gonzales (Cayo) y Fabrizio.
2. **6 préstamos ya pagados siguen como `activo` en la BD** (Jesús Steven, Diego Santti, Fabrizio, 3 de Lizbeth). Reportes los cuenta en "25 préstamos activos" (en realidad son 19) y suma su capital a "Capital prestado".
3. **Reportes, "Quién debe más"**: usa `capital_total_prestado` (todo lo prestado alguna vez, incluidos los préstamos pagados), no lo que debe hoy. Marcos Espinosa aparece con S/ 21,000, pero su préstamo vigente es de S/ 7,000.
4. **Reportes calcula "hoy" con la hora del servidor (UTC en Vercel)**: desde las 19:00 de Lima ya es el día siguiente, y el último día del mes "cobrado este mes" se reinicia antes de tiempo. Inicio sí usa la hora de Lima.
5. **Excedentes que no se aplican**: si un pago supera lo que se debe, el excedente no se refleja en el préstamo (sí cuenta en "cobrado"). Hay 5 casos:
   - Teddy Paredes: préstamo de S/ 4,000 al **0 %** y pagó S/ 5,000.
   - Fabrizio: S/ 400 al **0 %** y pagó S/ 550.
   - Isabel, Diego y Lizbeth: S/ 18, S/ 25 y S/ 30 de más.
   Probablemente son préstamos registrados con una tasa equivocada (debería ser 10 %) o pagos de más. **Siguiente paso, cuando las fotos ya estén en Storage:** revisar préstamo por préstamo (los 25 "activos") junto a sus vouchers.
6. **Desglose por pago en el cronograma** (`pagosRecibidos.aplicadoInteres/aplicadoCapital`): no tiene en cuenta la mora, los varios pagos en un mismo mes ni el tope de capital. En 10 de 107 meses lo que se muestra no coincide con lo que realmente se aplicó (los totales del mes sí están bien).
7. **Alquileres "al día" en Reportes**: basta cualquier pago del mes actual, aunque sea parcial y aunque haya meses anteriores sin pagar.

**Previsualizar pago en cuotas** (`usePreviewCuotas` + `CrearPrestamoForm`):
- Dice "Modelo Francés", pero calcula amortización constante (cuota decreciente), que es el modelo alemán.
- El número de cuotas **no se guarda**: después de crear el préstamo, nada en la app sabe que era a 3 o 6 cuotas.
- Simulado contra el motor: si el cliente paga exactamente esos montos en cada vencimiento, el préstamo queda en cero (en 1,000/3 sobra S/ 0.01 por redondeo, que el motor da por saldado). O sea, **los montos son correctos para este motor**; lo que falla es el rótulo y que el plan no queda registrado.
- Propuesta: guardar `numero_cuotas`; generar la vista previa simulando con el propio motor (una sola fuente de verdad); que la última cuota absorba el redondeo; mostrar también "si solo paga interés: S/ X al mes"; y en Inicio/Cartera mostrar "cuota del plan" junto al interés del mes.

**El monolito** (propuesta para cuando se decida tocarlo, con los tests como red):
- `buildPaymentSchedule` (240 líneas) hace seis cosas a la vez: generar períodos, detectar congelamientos, asignar pagos al período, aplicar el pago (mora → interés → capital), decidir el estado de la cuota y armar el resumen. Se puede separar en funciones puras sin cambiar resultados, verificando contra una "foto" del resultado actual para todos los préstamos reales.
- `routes/prestamos.routes.ts` (731 líneas) mezcla HTTP con reglas de negocio (el registro de pago recalcula el cronograma 3 veces).
- El criterio de "atrasado/estancado/al día" está repetido en `proximoCobro`, `cobranza`, `bi.routes`, `calendario-eventos` y el motor. Debería existir un solo módulo `estadoCobranza` que usen Inicio, Cartera, Reportes y Calendario.

## 4. Deuda técnica restante

Resuelto el 2026-10-31: consultas por páginas (sin límite de 1000 filas; se verificó que todos los endpoints devuelven exactamente lo mismo), `'unsafe-eval'` solo en desarrollo, carga por página (paquete principal de 715 a 508 KB) y token de Google en memoria (antes se pedía uno por llamada).

- **Score del cliente** (`clientes/:id/score`): trae los pagos de todos los clientes en vez de filtrar por sus préstamos. Es lógica de score: pendiente de aprobación.
- **Subidas grandes**: Vercel limita el cuerpo a 4.5 MB (base64). Las fotos ya llegan comprimidas; un PDF de más de ~3 MB fallará. Solución: URLs firmadas de subida directa a Storage.
- **Comprobantes huérfanos**: al quitar un comprobante de un pago o borrar el pago, el archivo sigue en Storage (la copia en Drive se conserva a propósito). Los documentos de cliente ya se liberan.
- **Después de migrar las fotos**: se pueden eliminar las columnas `voucher_drive_file_id`, `documentos_cliente.drive_file_id` y `drive_url` (los proxies de Drive se quedan: son el respaldo de lectura).
- **Paquete principal** aún de 508 KB: `motion` y `html-to-image` podrían cargarse solo cuando se usan.
- **Tipos `any`** en varios componentes y rutas.
- **Usuarios en variables de entorno** (`PIN_*`): no hay alta/baja sin redesplegar ni registro de quién hizo cada cambio.
