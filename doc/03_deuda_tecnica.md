# ⚠️ Registro Exhaustivo de Deuda Técnica y Plan de Remediación — PrestaFacilito

Este documento cataloga de forma detallada todos los **puntos críticos, riesgos de seguridad, cuellos de botella de rendimiento, anomalías arquitectónicas y deuda técnica acumulada** en el proyecto PrestaFacilito, junto con una matriz de impacto y un plan de acción para su resolución.

---

## 🎯 1. Resumen Ejecutivo

PrestaFacilito cuenta con un motor de cálculo financiero robusto (`loanLogic.ts`), interfaces limpias y una integración funcional con Google Drive y Supabase. No obstante, el crecimiento de la plataforma y el aumento en el volumen de transacciones financieras introducen riesgos operacionales y de escalabilidad que deben abordarse.

### Matriz de Priorización

```
                  ┌───────────────────┬───────────────────┐
                  │    ALTO IMPACTO   │    ALTO IMPACTO   │
                  │   / BAJO ESFUERZO │   / ALTO ESFUERZO │
                  │                   │                   │
                  │   [P0] Quick Wins │  [P0-P1] Proyectos│
   I M P A C T O  │   - Rate Limiting │  - Paginación BD  │
                  │   - Roles BD      │  - Colas asíncronas│
                  ├───────────────────┼───────────────────┤
                  │   BAJO IMPACTO    │    BAJO IMPACTO   │
                  │   / BAJO ESFUERZO │   / ALTO ESFUERZO │
                  │                   │                   │
                  │   [P2] Mantenim.  │   [P3] Mejoras    │
                  │   - Limpiar 'any' │   - Refactor UI   │
                  │   - Tests unitar. │   - Dark theme    │
                  └───────────────────┴───────────────────┘
                               E S F U E R Z O
```

---

## 📋 2. Catálogo Detallado de Deuda Técnica

### 🔴 Categoría A: Seguridad y Autenticación (Prioridad P0 - Crítica)

#### DT-SEC-01: Autenticación por PIN estático en Variables de Entorno
- **Descripción**: La autenticación del sistema se basa en 3 variables de entorno (`PIN_ADMIN`, `PIN_OPERATOR`, `PIN_VIEWER`).
- **Riesgo**:
  1. No existe trazabilidad individual de qué usuario específico realizó un cobro, edición o anulación (todos los operadores comparten el mismo PIN).
  2. Para cambiar un PIN o revocar el acceso a un empleado cesado, se requiere reiniciar el servidor o actualizar variables de entorno en producción.
- **Solución recomendada**:
  - Migrar a una tabla `usuarios` en PostgreSQL con hash `bcrypt`/`argon2`, nombre, correo, rol y estado (`activo`/`inactivo`).

#### DT-SEC-02: Ausencia de Rate Limiting en el endpoint de Login (`POST /api/auth/login`)
- **Descripción**: Un PIN de 4 a 6 dígitos tiene un espacio de búsqueda de solo 10,000 a 1,000,000 combinaciones. Sin limitación de tasa, un script automatizado puede descifrar el PIN de administrador en pocos minutos.
- **Riesgo**: Ataques de fuerza bruta y denegación de servicio.
- **Solución recomendada**:
  - Implementar middleware `express-rate-limit` restringiendo a máximo 5 intentos fallidos cada 15 minutos por dirección IP.

#### DT-SEC-03: Manejo de Expiración de Google Refresh Token (`invalid_grant`)
- **Descripción**: Si el `GOOGLE_REFRESH_TOKEN` es revocado por el administrador de Google Workspace o expira por inactividad (>6 meses en apps no verificadas), los endpoints que interactúan con Drive o Calendar lanzan excepciones HTTP 500/502.
- **Solución recomendada**:
  - Implementar un interceptor de salud proactivo (`health check`) y una pantalla de reconexión simplificada mediante OAuth2 callback.

---

### 🟠 Categoría B: Rendimiento y Escalabilidad (Prioridad P1 - Alta)

#### DT-PERF-01: Carga de Cartera Completa en Memoria (`SELECT *`) en Endpoints de BI y Dashboard
- **Descripción**: En `routes/bi.routes.ts` (`/api/bi/resumen`) y `routes/dashboard.routes.ts`, el backend ejecuta `supabase.from("prestamos").select("*")` y `supabase.from("amortizaciones").select("*")` trayendo **todos los registros históricos** para iterar sobre ellos en bucles JavaScript.
- **Impacto actual**: Con 100 préstamos el tiempo de respuesta es de ~80ms. Con 5,000 préstamos y 60,000 amortizaciones, el consumo de RAM de Node.js se disparará y las peticiones tardarán varios segundos.
- **Solución recomendada**:
  - Crear **Vistas Materializadas** o Funciones PostgreSQL (`RPC`) que calculen sumatorias y agregaciones directamente en el motor de base de datos.
  - Implementar paginación cursor-based (`limit` y `offset`) en `/api/amortizaciones` y `/api/prestamos`.

#### DT-PERF-02: Llamadas Síncronas Bloqueantes a Google Calendar y Google Drive en el Request Loop
- **Descripción**: Al registrar un pago en `POST /api/prestamos/:id/pagos`, la respuesta HTTP puede demorarse esperando la subida a Google Drive y la sincronización con Google Calendar.
- **Impacto**: Si la API de Google presenta latencia de red, la experiencia de usuario del operador se vuelve lenta o arroja timeout.
- **Solución recomendada**:
  - Desacoplar la sincronización de Google Calendar en una tarea en segundo plano no bloqueante (`setImmediate` o cola en memoria).

---

### 🟡 Categoría C: Arquitectura y Base de Datos (Prioridad P1 / P2)

#### DT-ARCH-01: Duplicidad y Serialización Mixta de Vouchers (`TEXT` vs `JSONB`)
- **Descripción**: En la tabla `amortizaciones`, las columnas `comprobante_url` y `voucher_drive_file_id` almacenan en algunos casos strings simples (`"/api/vouchers/proxy/123"`) y en otros arrays JSON serializados como string (`"[\"/api/...\", \"/api/...\"]"`).
- **Riesgo**: Requiere lógica defensiva (`parseUrls`) en múltiples partes del código frontend y backend para parsear manualmente el string.
- **Solución recomendada**:
  - Migrar la columna a tipo nativo `JSONB` de PostgreSQL o crear una tabla relacional dedicada `comprobantes_pago(id, amortizacion_id, url, drive_file_id, created_at)`.

#### DT-ARCH-02: Sincronización del Estado del Préstamo Dependiente de la API
- **Descripción**: El estado `pagado` o `activo` del préstamo se calcula y actualiza en código TypeScript cuando se llama a un endpoint Express. Si alguien inserta o edita un registro directamente en Supabase, el estado del préstamo puede quedar desfasado.
- **Solución recomendada**:
  - Crear un Trigger en PostgreSQL que recalcule el saldo y actualice el estado automáticamente ante cualquier `INSERT`/`UPDATE`/`DELETE` en la tabla `amortizaciones`.

---

### 🔵 Categoría D: Testing y Calidad de Código (Prioridad P2 / P3)

#### DT-TEST-01: Cobertura Incompleta de Pruebas Unitarias e Integración
- **Descripción**: Actualmente solo existen pruebas unitarias para `loanLogic.test.ts` y `scoreLogic.test.ts`. No hay pruebas automatizadas para:
  - `moraLogic.ts`
  - `alquilerLogic.ts`
  - Endpoints REST de Express (`routes/*.ts`)
  - Middleware de autenticación y errores.
- **Solución recomendada**:
  - Incorporar suite de tests con `supertest` y `tsx --test` para validar los endpoints principales de la API.

#### DT-TEST-02: Tipado Débil (`any`) en Componentes de Frontend
- **Descripción**: Varios componentes y modales utilizan `pagos: any[]` o `(err: any)` sin tipado estricto de TypeScript.
- **Solución recomendada**:
  - Estandarizar todas las entidades en `src/types.ts` y activar reglas de ESLint `no-explicit-any`.

---

## 🗺️ 3. Plan de Remediación y Hoja de Ruta (Roadmap)

| Fase | Tarea | Prioridad | Esfuerzo Estimado | Beneficio Principal |
| :---: | :--- | :---: | :---: | :--- |
| **Fase 1** | Implementar `express-rate-limit` en `/api/auth/login`. | **P0** | 2 horas | Blindaje contra ataques de fuerza bruta. |
| **Fase 1** | Tabla de Usuarios con roles individuales y contraseñas hasheadas. | **P0** | 1 día | Trazabilidad y auditoría completa por usuario. |
| **Fase 2** | Paginación en endpoints `/api/amortizaciones` y `/api/prestamos`. | **P1** | 2 días | Escalabilidad para decenas de miles de registros. |
| **Fase 2** | Desacoplar Google Calendar en background job no bloqueante. | **P1** | 1 día | Respuestas HTTP ultrarrápidas al cobrar. |
| **Fase 3** | Triggers en PostgreSQL para sincronización automática de estados. | **P1** | 2 días | Consistencia garantizada en la base de datos. |
| **Fase 3** | Migración de columnas de comprobantes a `JSONB` o tabla `comprobantes`. | **P2** | 2 días | Código limpio sin parsers defensivos en frontend. |
| **Fase 4** | Cobertura de tests unitarios para `moraLogic`, `alquilerLogic` y rutas. | **P2** | 3 días | Prevención de regresiones en lógica de negocio. |
| **Fase 4** | Refactorización de tipos TypeScript eliminando `any`. | **P3** | 1 día | Mantenibilidad y autocompletado robusto en IDE. |
