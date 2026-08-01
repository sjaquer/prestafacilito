# FASE 7 — REDISEÑO DE LA GESTIÓN DE CLIENTES

> **Objetivo:** Rediseñar la página de clientes con la lista como protagonista, el formulario como elemento secundario, y todos los campos que la misión requiere: apodo, score, préstamos activos, préstamos liquidados, monto total histórico.  
> **Prioridad:** Media.  
> **Duración estimada:** 3–4 días de desarrollo  
> **Prerequisito:** Fases 1, 2, 6 completadas (para que el score y la vista de BD sean correctos).

---

## 7.1 CONTEXTO Y PROPÓSITO

La misión (sección 7) describe la página de clientes así:

> "La lista de clientes es lo primero que se ve. No el formulario."

Problemas actuales:
- **P-038:** El formulario de registro ocupa lugar prominente. La lista es secundaria.
- **P-039:** La lista no muestra: préstamos activos, liquidados, monto total, score.
- **P-040:** No existe campo de apodo ni en la BD ni en el formulario.

---

## 7.2 DISEÑO DE LA NUEVA PÁGINA DE CLIENTES

### Layout General:

```
╔══════════════════════════════════════════════════════════════╗
║  CLIENTES  [Buscar por nombre o apodo...]   [+ Nuevo]       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │  Juan Pérez  (Juancho)            Score: [A]         │   ║
║  │  Tel: 999 888 777                                    │   ║
║  │  Activos: 2 | Liquidados: 1 | Capital histórico: S/ 10,000│
║  │                         [Ver Detalle] [WhatsApp]     │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │  María García  (Mary)             Score: [B]         │   ║
║  │  Tel: 111 222 333                                    │   ║
║  │  Activos: 1 | Liquidados: 3 | Capital histórico: S/ 8,500│
║  │                         [Ver Detalle] [WhatsApp]     │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

El botón `[+ Nuevo]` en la cabecera abre un panel deslizable (sidebar) con el formulario de creación, sin navegar a otra página.

---

## 7.3 TAREAS DETALLADAS

### TAREA 7.3.1 — Actualizar el endpoint `GET /api/clientes`

**Qué devolver:**

```typescript
// Cada cliente en la lista incluye:
{
  id: string,
  nombre_completo: string,
  apodo: string,                   // ← NUEVO
  telefono: string,
  observaciones: string,
  fecha_registro: string,
  prestamos_activos: number,       // ← NUEVO (desde vista BD)
  prestamos_liquidados: number,    // ← NUEVO (desde vista BD)
  capital_total_prestado: number,  // ← NUEVO (desde vista BD)
  total_amortizado: number,        // ← NUEVO (desde vista BD)
  alquileres_activos: number,      // ← NUEVO (desde vista BD)
  score_efectivo: 'A' | 'B' | 'C' | null,  // ← NUEVO (desde score_clientes)
  score_sobreescrito: boolean,     // ← NUEVO
  drive_folder_id?: string,
  numero_cuenta?: string,
  banco_cuenta?: string
}
```

**Implementación (usando la vista `resumen_financiero_clientes`):**

```typescript
app.get("/api/clientes", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("resumen_financiero_clientes")
    .select("*")
    .order("nombre_completo", { ascending: true });
  
  if (error) throw error;
  res.json(data || []);
});
```

---

### TAREA 7.3.2 — Actualizar el formulario de creación/edición de clientes

**Campos del formulario de cliente (agrupados):**

**Grupo 1 - Datos Principales:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Nombre Completo | Texto | ✅ | Nombre y apellidos |
| Apodo/Alias | Texto | ❌ | Cómo se le conoce informalmente |
| Teléfono | Texto | ✅ | Con código de área. Estandarizar al guardar. |
| Dirección | Texto | ❌ | Dirección de residencia |

**Grupo 2 - Datos de Cuenta Bancaria (colapsable):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Banco | Select | ❌ | BCP, Interbank, BBVA, Yape, Plin, Otro |
| Número de Cuenta | Texto | ❌ | Número de cuenta o número de celular |

**Grupo 3 - Notas:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| Observaciones | Textarea | ❌ | Información adicional relevante |

---

### TAREA 7.3.3 — Implementar la búsqueda de clientes

**Requisito:** El buscador en la cabecera debe filtrar por:
- `nombre_completo` (contiene el texto).
- `apodo` (contiene el texto).
- `telefono` (contiene el texto).

**Implementación:**

```typescript
// Filtrado en el cliente (dado que el número de clientes es pequeño, <100)
const clientesFiltrados = useMemo(() => {
  const query = searchTerm.toLowerCase().trim();
  if (!query) return clientes;
  
  return clientes.filter(c => 
    c.nombre_completo?.toLowerCase().includes(query) ||
    c.apodo?.toLowerCase().includes(query) ||
    c.telefono?.includes(query)
  );
}, [clientes, searchTerm]);
```

---

### TAREA 7.3.4 — Página de detalle de cliente

Al hacer clic en "Ver Detalle", la app navega a `/clientes/:id` con:

**Sección 1 — Datos del cliente:**
```
Juan Pérez (Juancho)
Tel: 999 888 777 | BCP: 1234567890
Dir: Calle Los Pinos 123
[✏️ Editar datos] [📁 Ver carpeta en Drive]
```

**Sección 2 — Score:**
```
Score: [A] 85.3/100
[Ver desglose del cálculo] [Sobreescribir manualmente]
```

**Sección 3 — Resumen financiero:**
```
Capital total prestado:  S/ 10,000.00
Total amortizado:        S/  8,500.00
Saldo pendiente:         S/  2,300.00
Préstamos activos:       2
Préstamos liquidados:    1
```

**Sección 4 — Lista de préstamos:**
```
PRÉSTAMOS ACTIVOS
┌────────────────────────────────────────────────────────┐
│ Préstamo Personal | S/ 5,000 | 10%/mes | Cuota: S/583  │
│ Emitido: Ene 2027 | Vence: Jun 2027                    │
│ Saldo: S/ 3,333.33          [Ver Detalle]              │
└────────────────────────────────────────────────────────┘

PRÉSTAMOS LIQUIDADOS
┌────────────────────────────────────────────────────────┐
│ Préstamo Negocio | S/ 2,000 | 12%/mes                 │
│ Liquidado: Mar 2026                    [Ver Detalle]   │
└────────────────────────────────────────────────────────┘
```

**Sección 5 — Alquileres:**
```
ALQUILERES ACTIVOS
┌────────────────────────────────────────────────────────┐
│ Casa Calle Los Pinos 123 | S/ 800/mes                  │
│ Desde: Ene 2026                       [Ver Detalle]   │
└────────────────────────────────────────────────────────┘
```

---

### TAREA 7.3.5 — Actualizar los endpoints de creación y edición de clientes

**POST /api/clientes:**

```typescript
const { nombre_completo, apodo, telefono, observaciones, 
        direccion, numero_cuenta, banco_cuenta, informacion_adicional } = req.body;

if (!nombre_completo || !telefono) {
  return res.status(400).json({ error: "nombre_completo y telefono son obligatorios" });
}

const { data, error } = await supabase
  .from("clientes")
  .insert({
    nombre_completo: nombre_completo.trim(),
    apodo: apodo?.trim() || '',        // ← NUEVO
    telefono: estandarizarTelefono(telefono),
    observaciones: observaciones || '',
    direccion: direccion || '',
    numero_cuenta: numero_cuenta || '',
    banco_cuenta: banco_cuenta || '',
    informacion_adicional: informacion_adicional || ''
  })
  .select()
  .single();
```

**PUT /api/clientes/:id:**

Mismo cuerpo que el POST, actualizar todos los campos incluyendo `apodo`.

---

### TAREA 7.3.6 — Limpiar `ClientesPage.tsx`

**Qué eliminar o refactorizar:**
- Cualquier lógica de estado de tabs/pestañas para el formulario de registro.
- La prioridad visual del formulario por sobre la lista.
- Campos en el formulario que no corresponden a la BD (post Fase 2).

**Qué mantener:**
- Enlace a Google Drive de la carpeta del cliente (si existe).
- Botón de WhatsApp.

---

## 7.4 PRUEBAS Y VERIFICACIÓN

1. **Lista de clientes muestra los 4 datos requeridos:**
   - Préstamos activos, liquidados, capital histórico, score.

2. **Búsqueda por apodo:**
   - Buscar "Juancho" → debe encontrar al cliente cuyo apodo es "Juancho".

3. **Crear cliente con apodo:**
   - Crear cliente con `apodo = "Chabelo"`.
   - Verificar que aparece en la lista entre paréntesis junto al nombre.

4. **Editar cliente:**
   - Cambiar el apodo de un cliente existente.
   - Verificar que la lista se actualiza.

---

## 7.5 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| La vista `resumen_financiero_clientes` es lenta con muchos préstamos | Baja | El proyecto tiene ≤50 clientes. La vista es simple. |
| El apodo no es obligatorio — algunos clientes no lo tendrán | Nula | El campo tiene `DEFAULT ''`. Se muestra solo si no está vacío. |

---

## 7.6 DEPENDENCIAS

- **Prerequisitos:** Fases 1, 2, 6 completadas.
- **Bloquea:** Ninguna fase posterior crítica.
