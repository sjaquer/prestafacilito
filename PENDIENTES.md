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
8. **[tú]** Migrar las fotos antiguas: `npx tsx scripts/migrar-drive-a-storage.ts` (simulación) y luego con `--ejecutar`.
9. **[tú]** Rotar la clave anon (Settings → API): estuvo en uso con acceso total.

Hasta el paso 5, subir comprobantes o documentos falla ("Bucket not found"): desplegar el código y aplicar la migración el mismo día.

## 2. Google

- **[tú]** Si la app de OAuth en Google Cloud está en modo **Testing**, el refresh token caduca a los 7 días y el respaldo semanal fallará siempre. Pasarla a **In production** (Google Auth Platform → Audience → Publish app).
- El callback de OAuth escribe el token en `.env` (local) o lo imprime en los logs (Vercel). Mejor guardarlo en la base de datos para que "Reconectar" funcione sin redesplegar.

## 3. Para revisar (cálculos, no se tocaron)

- **Reportes vs. Inicio no coinciden en "atrasados"**: Inicio muestra 5 clientes atrasados, Reportes dice "9 con atraso" (préstamos con alguna cuota vencida) y la barra de estado dice 8. Además `routes/bi.routes.ts` cuenta como activos solo `estado = "activo"` (deja fuera los `estancado`) y como pagados solo `"pagado"`, aunque la migración de estados pasó esos a `"liquidado"`. Conviene definir un único criterio de "atrasado".

## 4. Deuda técnica restante

- **Límite de 1000 filas de Supabase**: `dashboard`, `bi`, `prestamos` (listado, amortizaciones) y `clientes/:id/score` piden tablas completas sin paginar. Hoy hay ~114 pagos, pero al pasar de 1000 los totales saldrían cortados sin aviso. El score además trae los pagos de todos los clientes en vez de filtrar por sus préstamos. (Solo cambia qué filas se leen, no los cálculos.) El respaldo y el Excel ya paginan.
- **Subidas grandes**: Vercel limita el cuerpo de la petición a 4.5 MB y los archivos van en base64. Los documentos subidos desde el formulario de cliente no se comprimen; un PDF de más de ~3 MB fallará. Solución: URLs firmadas de subida directa a Storage.
- **Archivos huérfanos**: al quitar un comprobante de un pago o borrar el pago, el archivo queda en Storage (su copia en Drive se conserva a propósito).
- **Después de migrar las fotos**: eliminar los proxies `/api/vouchers/proxy` y `/api/documentos/proxy`, y las columnas `voucher_drive_file_id`, `documentos_cliente.drive_file_id` y `drive_url`.
- **Bundle de 715 KB**: dividir por página con `import()` dinámico.
- **CSP** permite `'unsafe-eval'` en producción (solo lo necesita Vite en desarrollo).
- **Tipos `any`** en varios componentes y rutas.
- **Usuarios en variables de entorno** (`PIN_*`): no hay alta/baja sin redesplegar ni registro de quién hizo cada cambio.
