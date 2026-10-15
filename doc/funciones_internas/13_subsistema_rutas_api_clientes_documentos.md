# ⚙️ Módulo Interno: API REST de Clientes y Expedientes (`clientes.routes.ts`)

- **Ubicación del Código Fuente**: [`routes/clientes.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/clientes.routes.ts)
- **Helpers**: [`helpers/telefono.ts`](file:///home/sjaquer/Downloads/prestafacilito/helpers/telefono.ts)
- **Propósito**: Gestionar el ciclo de vida de los clientes/prestatarios, normalización de números de contacto para WhatsApp, creación automática de carpetas en Google Drive y administración de expedientes digitales con documentos de identidad y garantías.

---

## 📞 1. Normalización de Teléfonos (`helpers/telefono.ts`)

### `estandarizarTelefono(tel: string): string`
Asegura que los números de teléfono peruanos guarden el formato internacional `519XXXXXXXX` para permitir el envío directo de mensajes y recordatorios de WhatsApp con un solo clic.

```typescript
export function estandarizarTelefono(tel: string): string {
  if (!tel) return '';
  const soloDigitos = tel.replace(/\D/g, '');
  if (soloDigitos.startsWith('51') && soloDigitos.length === 11) return soloDigitos;
  if (soloDigitos.length === 9 && soloDigitos.startsWith('9')) return `51${soloDigitos}`;
  return soloDigitos;
}
```

---

## 📡 2. Endpoints de Clientes (`/api/clientes`)

### 2.1. `GET /api/clientes` — Listar Cartera de Clientes
- Consulta la vista relacional `resumen_financiero_clientes`.
- Retorna el listado completo con métricas de capital prestado, saldo pendiente actual, total de préstamos y score crediticio.

### 2.2. `POST /api/clientes` — Registrar Nuevo Cliente
- **Payload**:
  ```json
  {
    "nombre_completo": "Juan Pérez",
    "apodo": "Don Juan",
    "telefono": "987654321",
    "direccion": "Av. Principal 123",
    "numero_cuenta": "191-12345678-0-12",
    "banco_cuenta": "BCP",
    "observaciones": "Comerciante mayorista"
  }
  ```
- **Aprovisionamiento Automático en Google Drive**:
  - Si Google Drive está configurado, invoca a `createDriveSubfolder(nombre_completo, parentFolderId)`.
  - Guarda el `drive_folder_id` en la tabla `clientes`.

### 2.3. `GET /api/clientes/:id` — Ficha Integral del Cliente
- Retorna:
  - Datos de contacto y bancarios.
  - Historial completo de préstamos y cronogramas.
  - Contratos de alquiler asociados.
  - Documentos del expediente digital.
  - Score crediticio calculado en tiempo real con `calcularScoreCliente`.

---

## 📂 3. Gestión de Expedientes Digitales

- **`POST /api/clientes/:id/documentos`**: Sube DNI, recibos o garantías a Google Drive dentro de la carpeta del cliente y guarda el registro en `documentos_clientes`.
- **`GET /api/clientes/:id/documentos`**: Lista los archivos del expediente.
- **`DELETE /api/clientes/:id/documentos/:docId`**: Elimina el documento de la base de datos y de Google Drive.
