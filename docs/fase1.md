# FASE 1 — LIMPIEZA ESTRUCTURAL Y ELIMINACIÓN DE DEUDA TÉCNICA CRÍTICA

> **Objetivo:** Dejar el proyecto con una base sólida y limpia antes de construir cualquier funcionalidad nueva.  
> **Prioridad:** Bloquea todas las demás fases — debe completarse primero.  
> **Duración estimada:** 4–6 días de desarrollo

---

## 1.1 CONTEXTO Y PROPÓSITO

El código actual tiene **53 problemas detectados** (ver `problemas.md`). El 39% son de severidad alta y bloquean cualquier desarrollo sostenible. Antes de implementar nuevas funcionalidades (score de clientes, nueva UI, lógica de alquileres), es indispensable limpiar los fundamentos.

Esta fase no añade funcionalidades al usuario. Su valor es invisible pero crítico: hace que el resto del proyecto sea posible sin acumular más deuda técnica.

---

## 1.2 TAREAS DETALLADAS

### TAREA 1.2.1 — Eliminar la Bitácora/Logs completamente

**Qué hacer:**

1. **Base de datos:** Ejecutar `DROP TABLE IF EXISTS logs;` en Supabase.
2. **Backend (`server-app.ts`):** 
   - Eliminar la función `logAction()` completa (líneas 578–640).
   - Eliminar todas las llamadas a `logAction(...)` en cada endpoint (son más de 30 llamadas).
   - Eliminar los endpoints `/api/logs`, `/api/logs/download`, `/api/logs/local`.
3. **Frontend:**
   - Eliminar el archivo `src/pages/BitacoraPage.tsx`.
   - Eliminar la ruta de bitácora en el router.
   - Eliminar cualquier enlace de navegación hacia la bitácora.
4. **Backend:** Eliminar la importación de `fs` y `path` si ya no se usan para nada más. Eliminar la escritura a `logs/audit.jsonl`.

**Archivos afectados:**
- `server-app.ts`
- `src/pages/BitacoraPage.tsx` ← eliminar
- `src/App.tsx` (rutas del router)
- Cualquier componente de navegación que enlace a `/bitacora`

**Criterio de aceptación:**
- No existen referencias a `logAction`, `logs`, `audit.jsonl`, `BitacoraPage` en ningún archivo del proyecto.
- La tabla `logs` no existe en la base de datos de Supabase.

---

### TAREA 1.2.2 — Modularizar `server-app.ts`

**Qué hacer:**

El archivo de 2971 líneas debe dividirse en módulos siguiendo esta estructura:

```
server-app.ts               ← Solo inicialización: express, middlewares, montaje de rutas
├── middleware/
│   └── auth.ts             ← requireAuth, cookieOptions
├── routes/
│   ├── auth.routes.ts      ← /api/auth/*
│   ├── clientes.routes.ts  ← /api/clientes/*
│   ├── prestamos.routes.ts ← /api/prestamos/*, /api/amortizaciones/*
│   ├── alquileres.routes.ts← /api/alquileres/* (nuevo - fase 3)
│   ├── drive.routes.ts     ← /api/drive/*, /api/upload-voucher, /api/vouchers/*
│   ├── calendar.routes.ts  ← /api/auth/google/*, /api/calendar/*
│   └── dashboard.routes.ts ← /api/dashboard
├── services/
│   ├── google-drive.ts     ← uploadVoucherToDrive, createDriveSubfolder, etc.
│   └── google-calendar.ts  ← syncLoanScheduleToGoogleCalendar, findGoogleCalendarEvent, etc.
└── helpers/
    ├── telefono.ts         ← estandarizarTelefono
    └── jwt.ts              ← getJwtSecret, fallbackJwtSecret
```

**Proceso:**
1. Extraer primero las funciones helper sin dependencias (`estandarizarTelefono`, `getJwtSecret`, `getDiffDescription`).
2. Extraer los servicios de Google (`google-drive.ts`, `google-calendar.ts`).
3. Extraer el middleware de auth (`middleware/auth.ts`).
4. Dividir las rutas en archivos por dominio.
5. Actualizar `server-app.ts` para importar y montar los routers.

**Criterio de aceptación:**
- `server-app.ts` tiene menos de 100 líneas (solo setup y mount de routers).
- Todos los endpoints siguen funcionando exactamente igual.
- No hay duplicación de código entre módulos.

---

### TAREA 1.2.3 — Arreglar la firma de `buildPaymentSchedule`

**Qué hacer:**

Reemplazar la firma polimórfica ambigua:
```typescript
// ANTES (confuso):
export const buildPaymentSchedule = (
  prestamo: Prestamo,
  pagos: Amortizacion[] = [],
  ajustesOrReferenceDate?: AjustePrestamo[] | Date,
  referenceDateOrRate?: Date | number,
  lateInterestRateDailyInput?: number
)

// DESPUÉS (claro):
interface BuildScheduleOptions {
  ajustes?: AjustePrestamo[];
  referenceDate?: Date;
  lateInterestRateDaily?: number;
}

export const buildPaymentSchedule = (
  prestamo: Prestamo,
  pagos: Amortizacion[] = [],
  options: BuildScheduleOptions = {}
): EstadoDeudaPrestamo
```

**Actualizar todas las llamadas:**
- `server-app.ts`: Buscar todas las invocaciones de `buildPaymentSchedule` y actualizar firma.
- `src/lib/moraLogic.ts`: Actualizar la llamada en línea 30.
- `src/hooks/*`: Si hay hooks que la llamen, actualizarlos.

**Criterio de aceptación:**
- La función acepta solo 3 parámetros, el tercero es un objeto de opciones tipado.
- No hay lógica condicional de detección de tipo de parámetro dentro de la función.

---

### TAREA 1.2.4 — Eliminar el endpoint `/api/seed` de producción

**Qué hacer:**
```typescript
// ANTES:
app.post("/api/seed", requireAuth, async (req, res) => {

// DESPUÉS:
app.post("/api/seed", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Este endpoint solo está disponible en desarrollo." });
    return;
  }
  // ... resto del código ...
```

---

### TAREA 1.2.5 — Eliminar el ID de Drive hardcodeado

**Qué hacer:**
```typescript
// ANTES:
const GOOGLE_DRIVE_CLIENTES_FOLDER_ID = getEnv("GOOGLE_DRIVE_CLIENTES_FOLDER_ID") || "12xYCUm9UULixGlauvbYdeUHRaEzTNJyq";

// DESPUÉS:
const GOOGLE_DRIVE_CLIENTES_FOLDER_ID = getEnv("GOOGLE_DRIVE_CLIENTES_FOLDER_ID");
// Si está vacío, la creación de subcarpetas de clientes se deshabilitará automáticamente.
```

---

### TAREA 1.2.6 — Eliminar `detectarGenero()`

**Qué hacer:**
- Eliminar la función `detectarGenero()` (líneas 534–549 de `server-app.ts`).
- Buscar todas las referencias a esta función y eliminarlas.

---

### TAREA 1.2.7 — Normalizar saltos de línea CRLF → LF

**Qué hacer:**

```bash
# En la raíz del proyecto:
find . -name "*.ts" -not -path "*/node_modules/*" -exec sed -i 's/\r//' {} \;
find . -name "*.tsx" -not -path "*/node_modules/*" -exec sed -i 's/\r//' {} \;
```

Agregar `.gitattributes` en la raíz:
```
* text=auto eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.json text eol=lf
```

---

### TAREA 1.2.8 — Agregar el middleware global de manejo de errores de Express

**Qué hacer:**

Al final de `server-app.ts`, antes del `app.listen`, agregar:
```typescript
// Middleware global de manejo de errores
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error no controlado:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    detail: process.env.NODE_ENV !== "production" ? err.message : undefined
  });
});
```

---

### TAREA 1.2.9 — Arreglar RLS en Supabase

**Qué hacer:**

Opciones:
- **Opción A (Recomendada para este proyecto):** Deshabilitar RLS ya que el backend es el único que accede a la BD con la service key:
```sql
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos DISABLE ROW LEVEL SECURITY;
ALTER TABLE amortizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_prestamo DISABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_cliente DISABLE ROW LEVEL SECURITY;
```

- **Opción B:** Crear policies que permitan todo al service role:
```sql
CREATE POLICY "service_role_all" ON clientes FOR ALL TO service_role USING (true);
-- Repetir para cada tabla
```

---

### TAREA 1.2.10 — Eliminar `ReportesPage.tsx` placeholder

**Qué hacer:**
- Eliminar `src/pages/ReportesPage.tsx`.
- Redirigir su ruta hacia el Dashboard si existe alguna navegación que apunte a ella.

---

## 1.3 PRUEBAS Y VERIFICACIÓN

Después de completar todas las tareas de esta fase:

1. **Build sin errores:** `npm run build` debe completar sin errores TypeScript.
2. **Server arranca:** `npm run dev` debe iniciar sin errores.
3. **Endpoints básicos responden:** Usar Postman o curl para verificar:
   - `GET /api/clientes` → 200
   - `GET /api/prestamos` → 200
   - `GET /api/dashboard` → 200
   - `POST /api/auth/login` → 200 con credentials correctas
4. **Bitácora eliminada:** Verificar que `/api/logs` devuelve 404.
5. **Tabla logs inexistente:** Ejecutar en Supabase: `SELECT * FROM logs` → debe fallar.

---

## 1.4 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Romper una ruta al modularizar | Media | Hacer commit antes de modularizar. Probar cada ruta después del move. |
| Conflictos de imports circulares | Baja | Definir la jerarquía de módulos antes de mover código. |
| Pérdida de logs en producción | Nula (intencional) | Confirmado por el usuario: los logs se eliminan completamente. |

---

## 1.5 DEPENDENCIAS

- **Ninguna.** Esta fase no depende de ninguna otra. Es el punto de partida.
- Las fases 2–10 dependen de que esta fase esté completa.
