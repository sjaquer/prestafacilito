# 🚨 REGISTRO DE PROBLEMAS — PrestaFacilito

> Documento de auditoría técnica generado el 2026-08-01.  
> Fuente de análisis: `server-app.ts`, `src/lib/loanLogic.ts`, `src/lib/moraLogic.ts`, `src/pages/*`, `supabase_schema.sql`, `src/types.ts`, `docs/mision.md`, `logica.md`.

---

## ÍNDICE

1. [Deuda Técnica del Backend](#1-deuda-técnica-del-backend)
2. [Problemas en Lógica de Negocio](#2-problemas-en-lógica-de-negocio)
3. [Malas Prácticas de Código](#3-malas-prácticas-de-código)
4. [Problemas en Base de Datos](#4-problemas-en-base-de-datos)
5. [Desviaciones respecto a la Misión](#5-desviaciones-respecto-a-la-misión)
6. [Problemas de Seguridad](#6-problemas-de-seguridad)
7. [Problemas de Arquitectura y Escalabilidad](#7-problemas-de-arquitectura-y-escalabilidad)
8. [Problemas en la Interfaz de Usuario](#8-problemas-en-la-interfaz-de-usuario)
9. [Problemas de Mantenibilidad](#9-problemas-de-mantenibilidad)

---

## 1. DEUDA TÉCNICA DEL BACKEND

### P-001 · Mega-archivo `server-app.ts` de 2971 líneas
- **Severidad:** 🔴 Alta
- **Archivo:** `server-app.ts`
- **Descripción:** Todo el servidor Express (rutas, helpers, integraciones con Google, lógica de negocio, middlewares, autenticación) vive en un único archivo de 2971 líneas. Viola el principio de separación de responsabilidades y hace el código prácticamente imposible de depurar, testear o mantener.
- **Impacto:** Cualquier cambio en una sección puede romper otra. Imposible hacer pruebas unitarias.
- **Solución:** Dividir en módulos: `routes/`, `middleware/`, `services/`, `integrations/`.

---

### P-002 · Función `buildPaymentSchedule` con firma de parámetros ambigua
- **Severidad:** 🔴 Alta
- **Archivo:** `src/lib/loanLogic.ts` — línea 74
- **Descripción:** La función principal de cálculo de cuotas tiene una firma polimórfica confusa con parámetros opcionales que cambian de tipo según posición (`ajustesOrReferenceDate?: AjustePrestamo[] | Date`). Genera código condicional complejo e ilegible.
- **Solución:** Usar un único objeto de opciones tipado: `{ ajustes, referenceDate, lateRate }`.

---

### P-003 · `buildPaymentSchedule` se llama múltiples veces por petición
- **Severidad:** 🔴 Alta
- **Archivo:** `server-app.ts` — endpoint POST /api/prestamos/:id/pagos
- **Descripción:** En el endpoint de registro de pagos, `buildPaymentSchedule` se llama 3 veces sobre los mismos datos (deudaAntes, deudaValidacion, deudaDespues). Esta función es costosa en cómputo. No hay memoización ni caché.
- **Solución:** Calcular una sola vez y reutilizar el resultado.

---

### P-004 · `GET /api/dashboard` carga TODOS los datos sin paginación
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — línea 984
- **Descripción:** El endpoint del dashboard hace `.select("*")` sin filtros sobre todas las tablas. Conforme crezca la BD, causará timeouts y consumo excesivo de memoria.
- **Solución:** Agregar paginación, filtros de fecha, y traer solo los campos necesarios.

---

### P-005 · `GET /api/prestamos/autoseleccionar` carga TODAS las amortizaciones sin filtrar
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — línea 1549
- **Descripción:** Se carga el universo completo de pagos solo para filtrar por `prestamo_id` en memoria.
- **Solución:** Filtrar directamente en la query con `.in("prestamo_id", listaDeIds)`.

---

### P-006 · Escritura directa al archivo `.env` desde un endpoint de producción
- **Severidad:** 🔴 Alta
- **Archivo:** `server-app.ts` — línea 2113
- **Descripción:** El callback de OAuth de Google escribe directamente en el archivo `.env` del servidor. En un entorno de producción (Vercel), esto es inútil (funciones stateless) y en cualquier entorno es una práctica peligrosa.
- **Solución:** Eliminar la escritura al `.env`. Mostrar solo el token al usuario para que lo copie manualmente.

---

### P-007 · Endpoint `/api/seed` accesible en producción
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — línea 859
- **Descripción:** El endpoint de datos de prueba está protegido solo por JWT, no por `NODE_ENV`. Cualquier usuario autenticado puede intentar sembrarlo.
- **Solución:** Agregar `if (process.env.NODE_ENV !== 'development') return res.status(403)`.

---

### P-008 · Uso de `parseFloat()` directamente sobre datos monetarios
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — múltiples líneas (1002, 1003, 1185, 1246)
- **Descripción:** El documento `logica.md` prohíbe el uso de float para dinero. Sin embargo, el servidor usa `parseFloat(p.monto_capital)` sin convertir a representación de alta precisión.
- **Impacto:** Errores de redondeo acumulativos en cálculos financieros.
- **Solución:** Usar siempre `toNumber()` de `loanLogic.ts` y operar en centavos.

---

### P-009 · `logAction` se llama en CADA endpoint de lectura (GET)
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — múltiples endpoints GET
- **Descripción:** Cada consulta de lectura genera un registro en la tabla `logs` de Supabase. Miles de registros de baja utilidad saturan la BD. La misión ordena eliminar los logs completamente.
- **Solución:** Eliminar toda llamada a `logAction` y la tabla `logs`.

---

### P-010 · ID hardcodeado de Google Drive en el código fuente
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — línea 443
- **Descripción:** Un ID de carpeta de Google Drive real está hardcodeado como fallback: `|| "12xYCUm9UULixGlauvbYdeUHRaEzTNJyq"`. Expone datos de infraestructura privada en el repositorio.
- **Solución:** Eliminar el fallback hardcodeado.

---

## 2. PROBLEMAS EN LÓGICA DE NEGOCIO

### P-011 · Contradicción entre el modelo de cuotas de la misión y `logica.md`
- **Severidad:** 🔴 Alta
- **Descripción:** `mision.md` (4.4) describe cuotas **iguales** con amortización constante (francés). `logica.md` describe cuotas **libres** donde solo se paga interés mensual (americano). El sistema actual implementa el modelo americano pero la previsualización debería usar el francés.
- **Solución (acordada):** Implementar French Adaptive como modelo principal.

---

### P-012 · La tabla `alquileres` no existe — la lógica está mezclada en `loanLogic.ts`
- **Severidad:** 🔴 Alta
- **Archivo:** `src/lib/loanLogic.ts` — línea 103
- **Descripción:** Los alquileres se manejan como tipo especial de préstamo con un bloque `if` gigante dentro de la función de cuotas. No tienen tabla propia ni API separada.
- **Solución:** Crear tabla `alquileres` independiente y migrar los datos existentes.

---

### P-013 · El sistema de mora calcula interés diario pero la tasa es 0
- **Severidad:** 🟡 Baja
- **Archivo:** `src/lib/loanLogic.ts` — línea 5
- **Descripción:** `DEFAULT_LATE_INTEREST_RATE_DAILY = 0`. Toda la lógica de mora existe pero nunca produce efecto real, añadiendo complejidad de cómputo sin valor.
- **Solución (acordada):** Eliminar lógica de mora acumulada. Solo indicadores visuales de días de atraso.

---

### P-014 · Sistema de `ajustes_prestamo` excesivamente complejo
- **Severidad:** 🟠 Media
- **Archivo:** `supabase_schema.sql` — línea 53, `src/lib/loanLogic.ts` — línea 350
- **Descripción:** 6 tipos de ajuste para 2 personas. Sobredimensionado.
- **Solución (acordada):** Simplificar a 2 tipos: congelar interés del mes y registrar acuerdo especial.

---

### P-015 · Estado del préstamo puede desincronizarse del estado calculado
- **Severidad:** 🟠 Media
- **Descripción:** El estado `activo/pagado` en BD solo se actualiza al registrar pagos. Si se modifica la BD manualmente, el estado queda incorrecto.
- **Solución:** Calcular el estado siempre desde `buildPaymentSchedule`, sin depender del campo `estado` como fuente de verdad operativa.

---

### P-016 · `detectarGenero()` usa lista hardcodeada de nombres femeninos
- **Severidad:** 🟡 Baja
- **Archivo:** `server-app.ts` — línea 534
- **Descripción:** Detección de género frágil e innecesaria para la funcionalidad core. Falla con nombres inusuales o extranjeros.
- **Solución:** Eliminar esta función.

---

### P-017 · Score de autoselección de préstamo con pesos arbitrarios
- **Severidad:** 🟡 Baja
- **Archivo:** `server-app.ts` — línea 1566
- **Descripción:** Los pesos del score (12, 15, 20 puntos) no tienen base documentada.
- **Solución:** Documentar o simplificar la lógica de autoselección.

---

### P-018 · "Liquidación Express" no está documentada en ningún documento de diseño
- **Severidad:** 🟠 Media
- **Archivo:** `src/lib/loanLogic.ts` — línea 677, `src/types.ts` — línea 85
- **Descripción:** Funcionalidad implementada sin aprobación en los documentos de diseño. Genera confusión.
- **Solución:** Eliminar junto con la simplificación del sistema de ajustes.

---

## 3. MALAS PRÁCTICAS DE CÓDIGO

### P-019 · Uso masivo de `any` en TypeScript
- **Severidad:** 🟠 Media
- **Descripción:** Decenas de variables, parámetros y respuestas tipadas como `any`, eliminando el valor de TypeScript.
- **Solución:** Crear interfaces TypeScript para todas las respuestas de API y estados del frontend.

---

### P-020 · `interface TimelineEvent` definida dentro de una función
- **Severidad:** 🟡 Baja
- **Archivo:** `src/lib/loanLogic.ts` — línea 268
- **Descripción:** Una interfaz de TypeScript definida dentro del cuerpo de función `buildPaymentSchedule`.
- **Solución:** Mover al nivel del módulo o a `types.ts`.

---

### P-021 · Archivos con saltos de línea CRLF mixtos con LF
- **Severidad:** 🟡 Baja
- **Archivo:** `src/lib/loanLogic.ts`
- **Descripción:** `loanLogic.ts` usa terminaciones Windows (CRLF) mientras el resto usa Unix (LF). Causa conflictos en diffs de Git.
- **Solución:** Normalizar a LF con `.gitattributes`.

---

### P-022 · `ReportesPage.tsx` está vacía (276 bytes)
- **Severidad:** 🟡 Baja
- **Archivo:** `src/pages/ReportesPage.tsx`
- **Descripción:** Archivo placeholder sin funcionalidad.
- **Solución:** Eliminar o implementar en la fase correspondiente.

---

### P-023 · Lógica de WhatsApp mezclada en el componente de cartera
- **Severidad:** 🟡 Baja
- **Archivo:** `src/pages/CarteraPage.tsx`
- **Descripción:** Generación del mensaje de WhatsApp como lógica inline en el componente de UI.
- **Solución:** Extraer a una utilidad separada.

---

### P-024 · `nowTick` se calcula una sola vez en el render inicial
- **Severidad:** 🟡 Baja
- **Archivo:** `src/pages/CarteraPage.tsx` — línea 30
- **Descripción:** `useState(() => new Date())` no se actualiza si la app está abierta varios días.
- **Solución:** Usar `new Date()` directamente o un efecto de actualización periódico.

---

## 4. PROBLEMAS EN BASE DE DATOS

### P-025 · Tabla `logs` existe y está activa contra la misión
- **Severidad:** 🔴 Alta
- **Archivo:** `supabase_schema.sql` — línea 97
- **Descripción:** La misión ordena eliminar la bitácora. La tabla existe y acumula miles de registros por cada acción del sistema, incluyendo lecturas.
- **Solución:** `DROP TABLE IF EXISTS logs;` y eliminar todas las llamadas a `logAction`.

---

### P-026 · RLS habilitado sin políticas definidas
- **Severidad:** 🔴 Alta
- **Archivo:** `supabase_schema.sql` — línea 146
- **Descripción:** RLS está habilitado en todas las tablas pero no hay ningún `CREATE POLICY`. Con la service_key actual funciona, pero si se cambia al anon_key la BD queda inaccesible.
- **Solución:** Definir policies explícitas o deshabilitar RLS con documentación del modelo de seguridad.

---

### P-027 · Campo `notas` en TypeScript no existe en el schema SQL
- **Severidad:** 🟠 Media
- **Archivo:** `src/types.ts` — línea 33
- **Descripción:** El type `Prestamo` incluye `notas?: string` pero la tabla `prestamos` no tiene esa columna.
- **Solución:** Agregar `notas TEXT DEFAULT ''` al schema o eliminar del type.

---

### P-028 · Campo `configuracion_ayuda` en TypeScript no existe en el schema SQL
- **Severidad:** 🟠 Media
- **Archivo:** `src/types.ts` — línea 30
- **Descripción:** El type `Prestamo` declara `configuracion_ayuda` pero no existe columna equivalente en BD.
- **Solución:** Eliminar el campo del type.

---

### P-029 · Vista SQL `resumen_financiero_clientes` calcula `total_exigible` incorrectamente
- **Severidad:** 🔴 Alta
- **Archivo:** `supabase_schema.sql` — línea 122
- **Descripción:** El cálculo usa interés simple sobre capital total sin considerar pagos ya realizados. Produce números que no coinciden con `buildPaymentSchedule`.
- **Solución:** Eliminar `total_exigible` de la vista o marcarlo como estimado bruto.

---

### P-030 · No hay campo `apodo` en la tabla `clientes`
- **Severidad:** 🟠 Media
- **Descripción:** La misión (7.2) requiere campo de apodo/alias. No existe en BD ni en types.
- **Solución:** Agregar `apodo TEXT DEFAULT ''` a `clientes`.

---

### P-031 · No existe tabla de historial de comportamiento de pago (para el Score)
- **Severidad:** 🔴 Alta
- **Descripción:** La misión (8.1) requiere una tabla para calcular el score A/B/C. No existe.
- **Solución:** Crear tabla `score_clientes` o calcular dinámicamente desde `amortizaciones`.

---

### P-032 · No existe tabla `alquileres`
- **Severidad:** 🔴 Alta
- **Descripción:** Los alquileres están embebidos en `prestamos`. No hay separación de entidades.
- **Solución:** Crear tabla `alquileres` y migrar datos existentes.

---

## 5. DESVIACIONES RESPECTO A LA MISIÓN

### P-033 · La página de Bitácora (`BitacoraPage.tsx`) existe y está activa
- **Severidad:** 🔴 Alta
- **Archivo:** `src/pages/BitacoraPage.tsx`
- **Descripción:** La misión (sección 3) ordena eliminar la bitácora. La página existe, está enrutada y en producción.
- **Solución:** Eliminar archivo, ruta y componentes relacionados.

---

### P-034 · Los formularios del Home son modales, no secciones fijas
- **Severidad:** 🔴 Alta
- **Archivo:** `src/pages/DashboardPage.tsx`
- **Descripción:** La misión (4.3) requiere formularios fijos en la página principal. Actualmente son modales/popups.
- **Solución:** Convertir en secciones fijas del layout del Home.

---

### P-035 · No hay previsualización de cuotas al crear un préstamo
- **Severidad:** 🔴 Alta
- **Descripción:** La misión (4.4) requiere mostrar el desglose de cuotas al ingresar capital, tasa y número de cuotas. No existe esta funcionalidad.
- **Solución:** Implementar componente de previsualización en el formulario de nuevo préstamo.

---

### P-036 · El Home filtra deudores que ya pagaron su cuota del mes
- **Severidad:** 🔴 Alta
- **Descripción:** La misión (4.2) requiere mostrar TODOS los deudores cuya cuota vence en el mes, sin filtrar por estado de pago.
- **Solución:** Cambiar regla de visibilidad para mostrar todos los deudores del mes.

---

### P-037 · La página de detalle separa "cronograma" de "pagos realizados"
- **Severidad:** 🔴 Alta
- **Archivo:** `src/pages/PrestamoDetallePage.tsx`
- **Descripción:** La misión (5.2) requiere una única vista cronológica integrada.
- **Solución:** Diseñar una vista unificada cronológica con desglose interés/capital por abono.

---

### P-038 · La página de clientes prioriza el formulario sobre la lista
- **Severidad:** 🟠 Media
- **Archivo:** `src/pages/ClientesPage.tsx`
- **Descripción:** La misión (7.1) establece que la lista de clientes es lo principal.
- **Solución:** Rediseñar para que la lista sea protagonista y el formulario sea secundario.

---

### P-039 · La lista de clientes no muestra los 4 campos requeridos por la misión
- **Severidad:** 🔴 Alta
- **Descripción:** La misión (7.1) requiere ver desde la lista: préstamos activos, liquidados, monto total histórico y score.
- **Solución:** Actualizar lista y consulta API para incluir esos campos.

---

### P-040 · No existe el campo apodo en el formulario de cliente
- **Severidad:** 🟠 Media
- **Descripción:** La misión (7.2) requiere campo de apodo/alias. No existe en el formulario.
- **Solución:** Agregar campo `apodo` en BD, API y formulario.

---

### P-041 · El sistema de Score A/B/C no existe
- **Severidad:** 🔴 Alta
- **Descripción:** La misión (sección 8) requiere score de comportamiento de pago (A/B/C). No hay tabla, cálculo ni visualización.
- **Solución:** Implementar en una fase dedicada.

---

### P-042 · Posibles avisos de "cuota mínima = interés" en préstamos personales
- **Severidad:** 🟠 Media
- **Descripción:** La misión (sección 3) prohíbe mostrar avisos de "cuota mínima" en préstamos personales.
- **Solución:** Revisar toda la UI y eliminar referencias a "cuota mínima" en préstamos.

---

## 6. PROBLEMAS DE SEGURIDAD

### P-043 · Contraseña comparada en texto plano
- **Severidad:** 🟠 Media (aceptable para sistema privado de 2 personas)
- **Archivo:** `server-app.ts` — línea 731
- **Descripción:** Las contraseñas/PINs se comparan con `===` en texto plano. Para el contexto del proyecto (2 personas) el riesgo es bajo, pero es técnicamente una mala práctica.

---

### P-044 · `unsafe-inline` y `unsafe-eval` en la CSP
- **Severidad:** 🟠 Media
- **Archivo:** `server-app.ts` — línea 666
- **Descripción:** La Content Security Policy incluye `unsafe-inline` y `unsafe-eval`, anulando gran parte de la protección XSS.
- **Solución:** Usar nonces o hashes para scripts inline.

---

### P-045 · Proxy de Google Drive no valida que el `fileId` pertenezca a la carpeta de la app
- **Severidad:** 🟡 Baja
- **Archivo:** `server-app.ts` — endpoint `/api/vouchers/proxy/:fileId`
- **Descripción:** Un usuario autenticado podría intentar acceder a archivos fuera de la carpeta de la aplicación.
- **Solución:** Validar que el `fileId` pertenezca a la carpeta raíz de la aplicación.

---

## 7. PROBLEMAS DE ARQUITECTURA Y ESCALABILIDAD

### P-046 · No hay manejo de errores global (Express error handler)
- **Severidad:** 🟠 Media
- **Descripción:** No existe middleware de manejo de errores global. Los errores se manejan con try/catch individuales en cada endpoint, repitiendo el mismo patrón 50+ veces.
- **Solución:** Implementar un error handler global de Express.

---

### P-047 · Las integraciones de Google no tienen reintentos
- **Severidad:** 🟡 Baja
- **Descripción:** Las llamadas `fetch()` a Google APIs no tienen mecanismo de reintento ante fallas transitorias.
- **Solución:** Implementar retry con backoff exponencial.

---

### P-048 · No hay separación de entornos dev/prod en el frontend
- **Severidad:** 🟡 Baja
- **Descripción:** El frontend llama directamente a `/api/*` sin configuración de entorno Vite.

---

## 8. PROBLEMAS EN LA INTERFAZ DE USUARIO

### P-049 · `calcularEstadoMora` llama `buildPaymentSchedule` para cada préstamo en lista
- **Severidad:** 🟠 Media
- **Archivo:** `src/lib/moraLogic.ts` — línea 30
- **Descripción:** Si la cartera tiene 50 préstamos, se ejecuta `buildPaymentSchedule` 50 veces en el cliente para renderizar la lista.
- **Solución:** Calcular el estado de mora en el servidor e incluirlo en la respuesta de `/api/prestamos`.

---

### P-050 · No hay buscador rápido de cliente en el formulario de nuevo préstamo
- **Severidad:** 🔴 Alta
- **Descripción:** La misión (4.3.A) requiere buscador rápido de cliente existente y botón de creación rápida sin salir del formulario.
- **Solución:** Implementar autocomplete en el formulario de nuevo préstamo.

---

## 9. PROBLEMAS DE MANTENIBILIDAD

### P-051 · Integraciones de Google mezcladas en `server-app.ts`
- **Severidad:** 🟠 Media
- **Descripción:** Todo el código de Drive y Calendar está mezclado en el servidor en lugar de módulos separados.
- **Solución:** Crear `services/google-drive.ts` y `services/google-calendar.ts`.

---

### P-052 · No hay documentación de API
- **Severidad:** 🟠 Media
- **Descripción:** No existe documentación de los endpoints REST. Dificulta el mantenimiento.
- **Solución:** Crear al menos un archivo `API.md` con lista de endpoints.

---

### P-053 · No hay tests unitarios ni de integración
- **Severidad:** 🟠 Media
- **Descripción:** No existe ningún archivo de tests. La lógica más crítica (`buildPaymentSchedule`) no está testeada.
- **Solución:** Implementar tests unitarios para `buildPaymentSchedule` y `classifyPayment`.

---

## RESUMEN POR CATEGORÍA

| Categoría | 🔴 Alta | 🟠 Media | 🟡 Baja |
|---|---|---|---|
| Deuda Técnica Backend | 5 | 4 | 1 |
| Lógica de Negocio | 3 | 3 | 2 |
| Malas Prácticas | 0 | 2 | 3 |
| Base de Datos | 4 | 3 | 0 |
| Desviaciones de Misión | 7 | 3 | 0 |
| Seguridad | 0 | 2 | 1 |
| Arquitectura | 0 | 1 | 2 |
| UI | 1 | 1 | 0 |
| Mantenibilidad | 0 | 3 | 0 |
| **TOTAL** | **20** | **22** | **9** |

---

> **Nota:** Este documento debe ser tratado como referencia viva. Cada problema resuelto debe marcarse con `[RESUELTO]` y la fase en que se implementó.
