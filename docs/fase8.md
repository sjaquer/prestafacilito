# FASE 8 — MÓDULO DE ALQUILERES (UI + API)

> **Objetivo:** Implementar la interfaz de usuario completa para la gestión de alquileres, usando la nueva tabla `alquileres` creada en la Fase 2 y la lógica de negocio `alquilerLogic.ts` de la Fase 3.  
> **Prioridad:** Media.  
> **Duración estimada:** 3–4 días de desarrollo  
> **Prerequisito:** Fases 1, 2, 3 completadas.

---

## 8.1 CONTEXTO Y PROPÓSITO

Los alquileres son conceptualmente distintos a los préstamos:

| Aspecto | Préstamo | Alquiler |
|---------|----------|---------|
| Capital | Se presta un monto que se devuelve | No hay capital que devolver |
| Interés | Se cobra sobre el saldo pendiente | No hay interés |
| Cuota | Variable (decrece con el saldo) | Fija (siempre el mismo monto mensual) |
| Duración | Plazo definido de cuotas | Puede ser indefinido |
| Liquidación | El préstamo termina cuando el capital = 0 | El contrato termina cuando se decide |
| Deuda acumulada | El capital restante | Los meses no pagados |

Con la Fase 3, los alquileres ya tienen su propia tabla y lógica. Esta fase implementa la UI completa para gestionarlos.

---

## 8.2 ESTRUCTURA DE LA SECCIÓN DE ALQUILERES

La sección de alquileres tiene dos vistas principales:

1. **Lista de alquileres activos** (similar a la lista de deudores del Home).
2. **Detalle de un alquiler** (cronograma por mes, historial de pagos).

---

## 8.3 TAREAS DETALLADAS

### TAREA 8.3.1 — Crear la página `AlquileresPage.tsx`

**Layout de la página (similar al Home, con formularios fijos):**

```
╔══════════════════════════════════════════════════════════════╗
║  ALQUILERES                                                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  [COLUMNA IZQUIERDA — 38%]    [COLUMNA DERECHA — 62%]       ║
║                                                              ║
║  ┌─────────────────────┐       ┌─────────────────────────┐  ║
║  │ NUEVO CONTRATO      │       │ ALQUILERES ACTIVOS       │  ║
║  │ DE ALQUILER         │       │                         │  ║
║  │                     │       │ [Lista de tarjetas]     │  ║
║  │ [Formulario fijo]   │       │                         │  ║
║  └─────────────────────┘       └─────────────────────────┘  ║
║                                                              ║
║  ┌─────────────────────┐                                     ║
║  │ REGISTRAR PAGO      │                                     ║
║  │ DE ALQUILER         │                                     ║
║  │ [Formulario fijo]   │                                     ║
║  └─────────────────────┘                                     ║
╚══════════════════════════════════════════════════════════════╝
```

---

### TAREA 8.3.2 — Implementar el formulario de "Nuevo Contrato de Alquiler"

**Campos del formulario:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Inquilino | Autocomplete | ✅ | Selección de cliente existente o creación rápida |
| Inmueble | Texto | ✅ | Descripción del inmueble. Ej: "Casa Calle Lima 123" |
| Monto Mensual | Número | ✅ | Monto fijo mensual (S/ Soles) |
| Fecha de Inicio | Fecha | ✅ | Por defecto: el 1º del mes siguiente |
| Fecha de Fin | Fecha | ❌ | Opcional. Si es vacío = contrato indefinido |
| Notas | Textarea | ❌ | Observaciones adicionales |

**Validaciones:**
- El monto mensual debe ser > 0.
- La fecha de inicio no puede ser anterior a hace 5 años.
- Si hay fecha de fin, debe ser posterior a la de inicio.

---

### TAREA 8.3.3 — Implementar el formulario de "Registrar Pago de Alquiler"

**Campos del formulario:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Inquilino | Autocomplete | ✅ | Selección de cliente |
| Contrato | Select dinámico | ✅ | Carga después de seleccionar el cliente |
| Mes/Año | Selector de mes | ✅ | ¿A qué mes corresponde este pago? |
| Monto | Número | ✅ | Monto recibido |
| Fecha del pago | Fecha | ✅ | Por defecto: hoy |
| Método | Select | ✅ | Efectivo, Yape, Plin, Transferencia, Otro |
| Comprobante | File | ❌ | Voucher de pago |

**Comportamiento:**
- Al seleccionar el contrato, mostrar: monto mensual esperado y los últimos 3 meses con su estado de pago.
- Al seleccionar el mes, indicar si ya está pagado o está pendiente.

---

### TAREA 8.3.4 — Diseño de la tarjeta de alquiler en la lista

```
╔═══════════════════════════════════════════════════════════════╗
║  🏠 CASA CALLE LIMA 123                                       ║
║  Inquilino: María García  (Mary)                              ║
║  ─────────────────────────────────────────────────────────── ║
║  Monto mensual: S/ 800.00                                    ║
║  Contrato desde: Ene 2026                                    ║
║  Mes actual (Feb 2027):  [🔴 PENDIENTE] / [🟡 PARCIAL]      ║
║                          / [✅ PAGADO]                       ║
║                                                              ║
║  Meses atrasados: 2 (S/ 1,600 total)                        ║
║  [Ver Detalle]  [Registrar Pago]  [💬 WhatsApp]             ║
╚═══════════════════════════════════════════════════════════════╝
```

---

### TAREA 8.3.5 — Crear la página de detalle de alquiler `AlquilerDetallePage.tsx`

**URL:** `/alquileres/:id`

**Sección de cabecera:**
```
ALQUILER — CASA CALLE LIMA 123
Inquilino: María García (Mary) | Tel: 999 888 777
Monto mensual: S/ 800.00
Contrato desde: Ene 2026 | Contrato hasta: (sin fecha de fin)
[✏️ Editar contrato] [📅 Sincronizar Calendario] [Finalizar Contrato]
```

**Timeline por mes:**

```
HISTORIAL DE PAGOS POR MES

MES 25 — Febrero 2027 (Mes actual)
┌─────────────────────────────────────────────────────────────┐
│ Monto esperado: S/ 800.00                                   │
│                                                             │
│ ⏳ SIN PAGO REGISTRADO                                      │
│                                                             │
│ [Registrar pago de este mes]                               │
└─────────────────────────────────────────────────────────────┘

MES 24 — Enero 2027
┌─────────────────────────────────────────────────────────────┐
│ Monto esperado: S/ 800.00                                   │
│ ✅ Pago recibido (05 Ene 2027): S/ 800.00 — Yape          │
│ [Ver comprobante]                                           │
└─────────────────────────────────────────────────────────────┘

MES 23 — Diciembre 2026
┌─────────────────────────────────────────────────────────────┐
│ Monto esperado: S/ 800.00                                   │
│ ⚠️ Pago parcial (10 Dic 2026): S/ 500.00 — Efectivo      │
│ 🚨 PENDIENTE S/ 300.00 (Atrasado 52 días)                 │
│ [Registrar pago del saldo]                                 │
└─────────────────────────────────────────────────────────────┘
```

---

### TAREA 8.3.6 — Implementar los endpoints API de alquileres

**Endpoints requeridos (en `routes/alquileres.routes.ts`, creado en Fase 3):**

```typescript
// GET /api/alquileres
// Devuelve todos los alquileres activos con estado del mes actual
app.get("/api/alquileres", requireAuth, async (req, res) => {
  const now = new Date();
  
  const [alquileresRes, pagosRes, clientesRes] = await Promise.all([
    supabase.from("alquileres").select("*").order("fecha_inicio", { ascending: false }),
    supabase.from("pagos_alquiler").select("*"),
    supabase.from("clientes").select("id, nombre_completo, apodo, telefono")
  ]);
  
  const resultado = alquileresRes.data?.map(alquiler => {
    const pagosDelAlquiler = pagosRes.data?.filter(p => p.alquiler_id === alquiler.id) || [];
    const cliente = clientesRes.data?.find(c => c.id === alquiler.cliente_id);
    const estado = buildAlquilerSchedule(alquiler, pagosDelAlquiler, now);
    
    return {
      ...alquiler,
      cliente_nombre: cliente?.nombre_completo || 'Desconocido',
      cliente_apodo: cliente?.apodo || '',
      cliente_telefono: cliente?.telefono || '',
      mes_actual_estado: estado.mesSiguiente?.estado || 'sin_datos',
      mes_actual_pendiente: estado.mesSiguiente?.saldoPendiente || 0,
      meses_atrasados: estado.mesesAtrasados,
      total_pendiente: estado.totalPendiente
    };
  }) || [];
  
  res.json(resultado);
});

// GET /api/alquileres/:id
// Devuelve el detalle completo con el timeline por mes
app.get("/api/alquileres/:id", requireAuth, async (req, res) => {
  const alquilerId = req.params.id;
  
  const [alquilerRes, pagosRes] = await Promise.all([
    supabase.from("alquileres").select("*").eq("id", alquilerId).single(),
    supabase.from("pagos_alquiler").select("*").eq("alquiler_id", alquilerId)
      .order("fecha_pago", { ascending: false })
  ]);
  
  if (!alquilerRes.data) {
    return res.status(404).json({ error: "Alquiler no encontrado" });
  }
  
  const alquiler = alquilerRes.data;
  const pagos = pagosRes.data || [];
  const estado = buildAlquilerSchedule(alquiler, pagos, new Date());
  
  // Obtener cliente
  const { data: cliente } = await supabase
    .from("clientes").select("*").eq("id", alquiler.cliente_id).single();
  
  res.json({ alquiler, cliente, estado });
});

// POST /api/alquileres
// Crea un nuevo contrato de alquiler
app.post("/api/alquileres", requireAuth, async (req, res) => {
  const { cliente_id, monto_mensual, descripcion_inmueble, fecha_inicio, fecha_fin, notas } = req.body;
  
  if (!cliente_id || !monto_mensual || !fecha_inicio || !descripcion_inmueble) {
    return res.status(400).json({ error: "cliente_id, monto_mensual, descripcion_inmueble y fecha_inicio son requeridos" });
  }
  
  const { data, error } = await supabase
    .from("alquileres")
    .insert({
      cliente_id,
      monto_mensual: toNumber(monto_mensual),
      descripcion_inmueble,
      fecha_inicio,
      fecha_fin: fecha_fin || null,
      notas: notas || '',
      estado: 'activo'
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Sincronizar con Google Calendar
  syncAlquilerToGoogleCalendar(data.id).catch(console.error);
  
  res.status(201).json({ success: true, alquiler: data });
});

// POST /api/alquileres/:id/pagos
// Registra un pago de alquiler
app.post("/api/alquileres/:id/pagos", requireAuth, async (req, res) => {
  const alquilerId = req.params.id;
  const { monto, fecha_pago, periodo_mes, periodo_anio, metodo_pago, comprobante_url } = req.body;
  
  if (!monto || !periodo_mes || !periodo_anio) {
    return res.status(400).json({ error: "monto, periodo_mes y periodo_anio son requeridos" });
  }
  
  const { data, error } = await supabase
    .from("pagos_alquiler")
    .insert({
      alquiler_id: alquilerId,
      monto: toNumber(monto),
      fecha_pago: fecha_pago || new Date().toISOString().split('T')[0],
      periodo_mes: parseInt(periodo_mes),
      periodo_anio: parseInt(periodo_anio),
      metodo_pago: metodo_pago || 'Efectivo',
      comprobante_url: comprobante_url || null,
      es_pago_completo: true
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Obtener estado actualizado
  const [alquilerRes, todosLosPageos] = await Promise.all([
    supabase.from("alquileres").select("*").eq("id", alquilerId).single(),
    supabase.from("pagos_alquiler").select("*").eq("alquiler_id", alquilerId)
  ]);
  
  const estadoActualizado = buildAlquilerSchedule(
    alquilerRes.data, 
    todosLosPageos.data || [], 
    new Date()
  );
  
  res.status(201).json({ success: true, pago: data, estado_actualizado: estadoActualizado });
});
```

---

### TAREA 8.3.7 — Actualizar la sincronización con Google Calendar para alquileres

Crear la función `syncAlquilerToGoogleCalendar` en `services/google-calendar.ts`:

```typescript
export async function syncAlquilerToGoogleCalendar(alquilerId: string): Promise<void> {
  // 1. Obtener el contrato y sus meses pendientes
  // 2. Para cada mes pendiente (hasta 3 meses adelante), crear un evento:
  //    - Título: "Alquiler [Inmueble] — [Inquilino] — S/[Monto]"
  //    - Fecha: día de vencimiento del mes
  //    - Descripción: Estado (pendiente/pagado), monto esperado
  // 3. Si el mes ya fue pagado, actualizar el evento con el estado "✅ PAGADO"
}
```

---

### TAREA 8.3.8 — Actualizar la navegación del sistema para incluir Alquileres

En el menú de navegación, agregar la sección "Alquileres" entre "Cartera" y la nueva sección de Reportes.

---

### TAREA 8.3.9 — Integrar la vista de alquileres del cliente en la Fase 7

En el detalle de cliente (`ClienteDetallePage.tsx`, Fase 7), ya se planificó mostrar los alquileres activos. Esta tarea conecta ese componente con el endpoint de alquileres.

---

## 8.4 PANTALLAS ADICIONALES

### Modal de "Finalizar Contrato":
Al hacer clic en "Finalizar Contrato" en el detalle:
- Mostrar: "¿Confirmar que el contrato de alquiler de [Inmueble] con [Inquilino] ha finalizado?"
- Al confirmar: actualizar `estado = 'finalizado'` y `fecha_fin = hoy` si no había fecha de fin.
- Eliminar los eventos futuros de Google Calendar para este alquiler.

---

## 8.5 PRUEBAS Y VERIFICACIÓN

1. **Crear contrato de alquiler:**
   - Crear alquiler de S/800/mes para María García desde Ene 2027.
   - Verificar que aparece en la lista con estado "PENDIENTE" para el mes actual.

2. **Registrar pago:**
   - Registrar pago del mes de Enero 2027.
   - En el timeline del detalle, el Mes 1 debe cambiar a "✅ Pagado".

3. **Pago parcial:**
   - Registrar S/400 (la mitad) para Febrero 2027.
   - La tarjeta debe mostrar estado "⚠️ PARCIAL" con "Pendiente S/400".

4. **Finalizar contrato:**
   - Finalizar el contrato.
   - Verificar que desaparece de la lista de "Alquileres Activos".
   - Verificar que sigue apareciendo en el historial del cliente en "Alquileres Finalizados".

---

## 8.6 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Los datos migrados de alquileres no tienen `periodo_mes/anio` correcto | Media | La migración de la Fase 2 calcula estos campos desde `fecha_pago`. Verificar manualmente post-migración. |
| Contratos sin fecha de fin pueden generar timelines infinitos | Baja | El límite de seguridad de 120 meses en `buildAlquilerSchedule` evita esto. |

---

## 8.7 DEPENDENCIAS

- **Prerequisitos:** Fases 1, 2, 3 completadas.
- **Relacionado:** Fase 7 (detalle de cliente muestra los alquileres).
