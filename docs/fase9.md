# FASE 9 — VOUCHERS Y DOCUMENTOS MEJORADOS

> **Objetivo:** Integrar la gestión de vouchers/comprobantes de pago directamente en la pantalla de detalle de cada préstamo y alquiler, manteniendo Google Drive como backend de almacenamiento y mejorando la experiencia de adjuntar comprobantes.  
> **Prioridad:** Media–Baja.  
> **Duración estimada:** 2–3 días de desarrollo  
> **Prerequisito:** Fases 1, 5 (detalle de préstamo), 8 (detalle de alquiler) completadas.

---

## 9.1 CONTEXTO Y PROPÓSITO

### Decisión acordada (del grill-me):

> "Mantener la página de Vouchers/Documentos tal como está (subida a Google Drive), pero integrarla mejor al detalle de préstamo. Es una funcionalidad útil."

### Problemas que resuelve:
- Actualmente los vouchers se gestionan desde una página separada.
- El usuario debe navegar fuera del detalle del préstamo para ver/adjuntar comprobantes.
- La misión (sección 9) requiere que los documentos sean accesibles desde el contexto del préstamo.

### Lo que NO cambia:
- El backend de almacenamiento sigue siendo Google Drive.
- La lógica de subida de archivos es la misma.
- La integración con el proxy de Drive para ver imágenes sigue igual.

---

## 9.2 TAREAS DETALLADAS

### TAREA 9.2.1 — Integrar el visor de vouchers en el timeline del préstamo

En la `TimelineDetallePrestamo` (Fase 5), cada pago muestra un enlace al voucher si existe:

```
MES 1 — Cuota 1 (01 Feb 2027)
┌─────────────────────────────────────────────────────────────┐
│ ✅ Pago recibido (15 Ene 2027): S/ 1,333.33 — Yape        │
│    → A interés:  S/   500.00                                │
│    → A capital:  S/   833.33                                │
│    📎 Comprobante: [Ver imagen] [Descargar]  ← SI EXISTE  │
│    📎 [+ Adjuntar comprobante]               ← SI NO EXISTE│
└─────────────────────────────────────────────────────────────┘
```

**Implementación del botón "Adjuntar comprobante":**

```typescript
// Componente: AdjuntarVoucherButton.tsx
// Al hacer clic:
// 1. Abre selector de archivo (accept="image/*,application/pdf")
// 2. Convierte la imagen a base64
// 3. Llama a POST /api/amortizaciones/:id/voucher
// 4. Actualiza el estado local para mostrar el link del voucher
```

---

### TAREA 9.2.2 — Integrar el visor de vouchers en el timeline de alquiler

Mismo comportamiento que en los préstamos, aplicado a los pagos de alquiler en `AlquilerDetallePage.tsx`.

---

### TAREA 9.2.3 — Mejorar la UX de subida de comprobantes

**Mejoras sobre el sistema actual:**

1. **Vista previa antes de subir:** Al seleccionar una imagen, mostrar una miniatura antes de confirmar la subida.

2. **Compresión de imagen en el cliente:** Antes de convertir a base64, comprimir imágenes pesadas:
```typescript
async function comprimirImagen(file: File, maxWidthPx = 1024): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% calidad
    };
    img.src = URL.createObjectURL(file);
  });
}
```

3. **Captura desde cámara (mobile):** El input de archivo debe incluir `capture="environment"` en dispositivos móviles:
```html
<input type="file" accept="image/*" capture="environment" />
```

4. **Indicador de progreso:** Mostrar una barra de progreso mientras sube a Drive.

---

### TAREA 9.2.4 — Crear la sección de documentos del cliente

En el detalle del cliente (`ClienteDetallePage.tsx`, Fase 7), agregar una sección de documentos del cliente:

```
DOCUMENTOS DEL CLIENTE
  ─────────────────────────────────────────────────
  [📁 Abrir carpeta en Google Drive]
  
  Documentos subidos directamente:
  ┌─────────────────────────────────────────────────────────┐
  │ 📄 DNI_Juan_Perez.jpg        [Ver] [Eliminar]          │
  │ 📄 Recibo_Luz_Ene2027.pdf    [Ver] [Eliminar]          │
  └─────────────────────────────────────────────────────────┘
  
  [+ Subir documento del cliente]
```

**Endpoint para documentos del cliente:**
```
GET  /api/clientes/:id/documentos    → Lista archivos en la carpeta del cliente en Drive
POST /api/clientes/:id/documentos    → Sube un nuevo documento a la carpeta del cliente
DELETE /api/clientes/:id/documentos/:fileId → Elimina el archivo de Drive
```

---

### TAREA 9.2.5 — Simplificar o eliminar la página separada de Vouchers

La misión indica que los documentos se deben gestionar desde el contexto del préstamo/alquiler, no desde una página separada.

**Opciones:**
- **Opción A (Recomendada):** Eliminar `VouchersPage.tsx` y redirigir `/vouchers` al detalle del préstamo o cliente correspondiente.
- **Opción B:** Mantener la página como una vista de "todos los documentos" del sistema (útil para búsqueda global).

**Decisión a tomar durante la implementación:** Si la página aporta valor como búsqueda global, mantenerla simplificada. Si no se usa, eliminarla.

---

### TAREA 9.2.6 — Mejorar el endpoint proxy de Drive

El endpoint actual `/api/vouchers/proxy/:fileId` sirve el archivo de Drive sin validar que pertenezca a la carpeta de la app (P-045).

**Mejorar con validación:**

```typescript
app.get("/api/vouchers/proxy/:fileId", requireAuth, async (req, res) => {
  const { fileId } = req.params;
  
  // Validar que el fileId existe en nuestra BD (ya sea en amortizaciones o pagos_alquiler)
  const [amortRes, pagosAlqRes] = await Promise.all([
    supabase.from("amortizaciones").select("id").eq("voucher_drive_file_id", fileId).maybeSingle(),
    supabase.from("pagos_alquiler").select("id").eq("voucher_drive_file_id", fileId).maybeSingle()
  ]);
  
  if (!amortRes.data && !pagosAlqRes.data) {
    return res.status(403).json({ error: "Acceso denegado: archivo no registrado en el sistema" });
  }
  
  // ... resto del proxy existente ...
});
```

---

### TAREA 9.2.7 — Agregar campo `voucher_drive_file_id` a `pagos_alquiler`

El campo ya debería estar presente desde la migración de la Fase 2. Verificar que existe:

```sql
ALTER TABLE pagos_alquiler
ADD COLUMN IF NOT EXISTS voucher_drive_file_id TEXT;

ALTER TABLE pagos_alquiler
ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
```

---

## 9.3 DISEÑO DEL VISOR DE VOUCHERS

Al hacer clic en "Ver imagen" en el timeline:

```
╔══════════════════════════════════════════════════════════════╗
║  COMPROBANTE — Pago de S/ 1,333.33 (15 Ene 2027)           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  [                                                         ] ║
║  [           IMAGEN DEL COMPROBANTE                        ] ║
║  [           (cargada desde Drive via proxy)               ] ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  [Descargar original] [Eliminar comprobante] [Cerrar]        ║
╚══════════════════════════════════════════════════════════════╝
```

El visor se implementa como un panel deslizante (sidebar) o un lightbox, no como una nueva página.

---

## 9.4 PRUEBAS Y VERIFICACIÓN

1. **Adjuntar voucher desde el detalle de préstamo:**
   - Ir al detalle de un préstamo con pagos.
   - Hacer clic en "+ Adjuntar comprobante" en un pago sin voucher.
   - Seleccionar una imagen → debe subir a Drive y mostrar "Ver imagen".

2. **Ver voucher existente:**
   - Hacer clic en "Ver imagen" → debe mostrar la imagen dentro de la app (via proxy).

3. **Compresión de imagen:**
   - Adjuntar una imagen de 5MB → debe comprimirse a <500KB antes de subir.

4. **Seguridad del proxy:**
   - Intentar acceder a `/api/vouchers/proxy/ID_FALSO` → debe devolver 403.
   - Acceder con un `fileId` válido registrado en la BD → debe servir la imagen.

---

## 9.5 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| La compresión de imagen en browser puede ser lenta en fotos grandes | Media | Mostrar indicador de "procesando..." durante la compresión. |
| Drive puede tener cuota agotada | Muy baja | El proyecto almacena solo comprobantes de pagos (unas pocas imágenes por mes). |
| La eliminación de `VouchersPage.tsx` rompe un enlace de navegación | Baja | Actualizar el menú de navegación antes de eliminar el archivo. |

---

## 9.6 DEPENDENCIAS

- **Prerequisitos:** Fase 1 (para el proxy mejorado), Fase 5 (timeline de préstamo), Fase 8 (timeline de alquiler).
- **No bloquea:** Ninguna fase posterior.
