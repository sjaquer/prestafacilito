# ⚙️ Módulo Interno: Servicio de Google Calendar (`google-calendar.ts`)

- **Ubicación del Código Fuente**: [`services/google-calendar.ts`](file:///home/sjaquer/Downloads/prestafacilito/services/google-calendar.ts) y [`routes/calendar.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/calendar.routes.ts)
- **Propósito**: Sincronizar automáticamente los vencimientos de cuotas de préstamos y mensualidades de alquileres con Google Calendar, permitiendo a los operadores recibir notificaciones y visualizar su cronograma de cobranzas en sus dispositivos móviles.

---

## 🔑 1. Configuración y Credenciales

- **`isGoogleCalendarConfigured(): boolean`**: Verifica que existan `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REFRESH_TOKEN`.
- **`getGoogleCalendarId(): string`**: Obtiene el ID del calendario destino desde `GOOGLE_CALENDAR_ID` (por defecto `"primary"`).
- **`withRetry<T>(fn, maxRetries = 3)`**: Implementa backoff exponencial para reintentar peticiones en caso de límites de cuota (HTTP 429) o fallas temporales de Google (HTTP 503).

---

## 📅 2. Funciones de Sincronización

### 2.1. `syncLoanScheduleToGoogleCalendar(prestamoId)`
Recalcula el estado del préstamo y actualiza las cuotas pendientes o saldadas en Google Calendar.

```typescript
export async function syncLoanScheduleToGoogleCalendar(prestamoId: string): Promise<void>;
```

#### Reglas de Sincronización:
- **Cuota Pendiente / Próxima**:
  - `Summary`: `💰 Cobro Cuota [N] - [Nombre Cliente] (S/ [Monto])`
  - `ColorId`: `"5"` (Amarillo) si está pendiente, `"11"` (Rojo) si está vencida.
  - `Description`: Detalle del capital pendiente, tasa de interés y teléfono de contacto.
- **Cuota Saldada**:
  - `Summary`: `✅ Pagado: Cuota [N] - [Nombre Cliente]`
  - `ColorId`: `"10"` (Verde).

---

### 2.2. `syncAllActiveLoansToCalendar()` y `syncAllAlquileresToCalendar()`
Sincronización masiva de toda la cartera activa de préstamos y contratos de alquiler.

```typescript
export async function syncAllActiveLoansToCalendar(): Promise<{ totalSincronizados: number; errores: number }>;
export async function syncAllAlquileresToCalendar(): Promise<{ totalSincronizados: number; errores: number }>;
```

---

### 2.3. `createOrUpdateGoogleCalendarEvent(options)`
Crea un nuevo evento (`POST`) o actualiza uno existente (`PUT`).

```typescript
export async function createOrUpdateGoogleCalendarEvent({
  eventId,
  summary,
  description,
  dateStr,
  colorId,
}: {
  eventId?: string;
  summary: string;
  description: string;
  dateStr: string;
  colorId?: string;
}): Promise<any>;
```

---

## 🌐 3. Endpoints REST de Calendario (`routes/calendar.routes.ts`)

- **`GET /api/calendar/status`**: Retorna el estado de conexión con Google Calendar.
- **`POST /api/calendar/sync-all`**: Dispara la sincronización masiva de todos los préstamos y alquileres activos.
- **`POST /api/prestamos/:id/sync-calendar`**: Sincroniza un préstamo específico tras un registro de abono o prórroga.
