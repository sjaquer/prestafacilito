# Pendientes

Estado al 2026-10-31. Lo marcado **[tú]** requiere acceso a Supabase, Vercel o Google y no se puede hacer desde el código.

## 1. Activar Storage y la seguridad de los datos (en este orden)

1. **[tú]** Supabase → Project Settings → API → copiar la clave **service_role**.
2. **[tú]** Poner esa clave en `SUPABASE_KEY` del `.env` local y de Vercel (Production). Borrar de Vercel/`.env` las variables que no usa el código: `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. **[tú]** En Vercel: definir `CRON_SECRET` (largo y aleatorio) y, si se quiere carpeta propia para el Excel, `GOOGLE_DRIVE_RESPALDOS_FOLDER_ID`.
4. **[tú]** Desplegar y comprobar en los logs de arranque: `[DB] Conectado con rol service_role`.
5. **[tú]** SQL Editor: ejecutar `supabase/migrations/20261031_storage_y_respaldos.sql` (bucket privado, columnas y tabla de respaldos).
6. **[tú]** SQL Editor: ejecutar `supabase/migrations/20261015_enable_rls.sql` (RLS en todas las tablas).
7. **[tú]** Probar en la app: subir un comprobante, verlo, y pulsar **Sistema → Respaldar ahora en Drive**.
8. **[tú]** Migrar las fotos antiguas: en la app, **Sistema → "Migrar fotos a Storage"** (aparece solo si quedan fotos en Drive). El navegador descarga cada foto de Drive, la comprime con el mismo compresor de la app (vouchers en escala de grises WebP, ~20–120 KB) y la sube. No cerrar la app mientras avanza; si algo falla, se puede volver a pulsar y solo procesa lo que falta.
9. **[tú]** Rotar la clave anon (Settings → API): estuvo en uso con acceso total.

Hasta el paso 5, subir comprobantes o documentos falla ("Bucket not found"): desplegar el código y aplicar la migración el mismo día.

## 2. Google

- **[tú]** Si la app de OAuth en Google Cloud está en modo **Testing**, el refresh token caduca a los 7 días y el respaldo semanal fallará siempre. Pasarla a **In production** (Google Auth Platform → Audience → Publish app).
- El callback de OAuth escribe el token en `.env` (local) o lo imprime en los logs (Vercel). Mejor guardarlo en la base de datos para que "Reconectar" funcione sin redesplegar.

## 3. Revisión de cálculos (2026-10-31) — solo revisado, nada modificado

Verificado con los datos reales (25 préstamos con estado `activo` en la BD, 114 pagos).

**El motor (`buildPaymentSchedule`) es coherente.** Cobra el interés del mes sobre el capital al inicio del mes; si el pago no lo cubre, el resto pasa a mora (sin interés sobre interés). Cada pago se aplica primero a la mora, luego al interés y el excedente va a capital. Las fechas no se corren (préstamo del 31 → 28/29 feb → 31 mar). Los tests pasan.

**Por qué Inicio dice 5 atrasados y Reportes dice 9.** No es un error de cálculo: cada pantalla usa un criterio distinto.
- Inicio: préstamos con interés vencido *hoy* sin pagar (5). Los que tienen 5 o más cuotas sin pagar van aparte, en la sección de estancados (2, ambos de Isabel Sánchez).
- Reportes (`bi.routes.ts`): préstamos que *alguna vez* tuvieron un mes impago o incompleto, aunque ya se pusieron al día. Suma los mismos 5 + 2, más:
  - **Mario Rojas**: préstamo de S/ 420 **al 0 %** sin pagos desde mayo. No debe interés, pero el motor cuenta los meses sin pago.
  - **George Jhonatan**: tiene 2 congelamientos de interés que Reportes no aplica (no carga `ajustes_prestamo`).

**Errores reales encontrados (de criterio o de etiqueta, no del motor):**
1. **Regla: un préstamo al 0 % no puede ser estancado** (no genera interés mensual). Hoy no se respeta en tres lugares, que cuentan meses sin pago sin mirar la tasa:
   - `esEstancado` del motor (3 o más meses incompletos, además históricos): Mario Rojas sale como "estancado" en su detalle.
   - `routes/prestamos.routes.ts` (al editar o registrar un pago): guarda `estado = "estancado"` si hay más de 2 meses sin pago.
   - Aviso de `PrestamoDetalle.tsx` ("más de 2 meses consecutivos sin abonos").
   Inicio y Calendario ya lo cumplen (con 0 % no hay mora, así que nunca lo marcan atrasado). Hay tres definiciones de estancado: el motor (3 o más históricos), Inicio/Calendario (5 o más vigentes) y el estado de la BD. Préstamos al 0 % hoy: Teddy Paredes, Tuty Paredes, Mario Rojas, Carlos Gonzales (Cayo) y Fabrizio.
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

- **Límite de 1000 filas de Supabase**: `dashboard`, `bi`, `prestamos` (listado, amortizaciones) y `clientes/:id/score` piden tablas completas sin paginar. Hoy hay ~114 pagos, pero al pasar de 1000 los totales saldrían cortados sin aviso. El score además trae los pagos de todos los clientes en vez de filtrar por sus préstamos. (Solo cambia qué filas se leen, no los cálculos.) El respaldo y el Excel ya paginan.
- **Subidas grandes**: Vercel limita el cuerpo de la petición a 4.5 MB y los archivos van en base64. Los documentos subidos desde el formulario de cliente no se comprimen; un PDF de más de ~3 MB fallará. Solución: URLs firmadas de subida directa a Storage.
- **Archivos huérfanos**: al quitar un comprobante de un pago o borrar el pago, el archivo queda en Storage (su copia en Drive se conserva a propósito).
- **Después de migrar las fotos**: eliminar los proxies `/api/vouchers/proxy` y `/api/documentos/proxy`, y las columnas `voucher_drive_file_id`, `documentos_cliente.drive_file_id` y `drive_url`.
- **Bundle de 715 KB**: dividir por página con `import()` dinámico.
- **CSP** permite `'unsafe-eval'` en producción (solo lo necesita Vite en desarrollo).
- **Tipos `any`** en varios componentes y rutas.
- **Usuarios en variables de entorno** (`PIN_*`): no hay alta/baja sin redesplegar ni registro de quién hizo cada cambio.
