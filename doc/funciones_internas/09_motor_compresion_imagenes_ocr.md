# ⚙️ Módulo Interno: Compresión de Imágenes en Cliente y OCR (`imageCompression.ts`)

- **Ubicación del Código Fuente**: [`src/lib/imageCompression.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/imageCompression.ts) y [`src/components/common/ImagePasteDropzone.tsx`](file:///home/sjaquer/Downloads/prestafacilito/src/components/common/ImagePasteDropzone.tsx)
- **Tecnologías**: HTML5 Canvas API, File API, Tesseract.js (OCR)
- **Propósito**: Reducir el peso de las fotografías y capturas de pantalla de comprobantes bancarios directamente en el navegador del usuario antes de transmitirlas por red, asegurando un peso inferior a 500 KB, y facilitar la extracción de texto mediante OCR y pegado directo con `Ctrl+V`.

---

## 🗜️ 1. Compresión en el Navegador: `comprimirImagen`

```typescript
export async function comprimirImagen(
  file: File,
  maxWidthPx = 1024,
  quality = 0.7
): Promise<string>;
```

### Algoritmo de Compresión:
1. **Detección de Tipo**: Si el archivo no es una imagen (ej: PDF), se lee como DataURL estándar sin alterar.
2. **Carga en Memoria**: Crea un objeto `Image` y un Blob URL temporal (`URL.createObjectURL`).
3. **Escalado Proporcional**:
   - Calcula el factor de escala: `scale = min(1, maxWidthPx / img.width)`.
   - Si la imagen original tiene 4000x3000 px, se reescala a 1024x768 px manteniendo el aspect ratio.
4. **Renderizado en Canvas 2D**:
   - Crea un elemento `<canvas>` en memoria y dibuja la imagen escalada con `ctx.drawImage`.
5. **Exportación JPEG Optimizada**:
   - Invoca `canvas.toDataURL("image/jpeg", quality)` (calidad 70%).
   - Libera el recurso de memoria con `URL.revokeObjectURL`.
   - Retorna la cadena Base64 lista para envío.

---

## 📋 2. Pegado Directo con Portapapeles (`Ctrl+V`)

En el componente [`ImagePasteDropzone.tsx`](file:///home/sjaquer/Downloads/prestafacilito/src/components/common/ImagePasteDropzone.tsx):
- Escucha el evento global `window.addEventListener("paste", handleGlobalPaste)`.
- Si el usuario copia una captura de pantalla desde WhatsApp Web o la aplicación bancaria y presiona `Ctrl+V` dentro de la ventana:
  1. Extrae los items de tipo imagen de `e.clipboardData.items`.
  2. Convierte el Blob a un objeto `File` con nombre generado automáticamente: `voucher_pega_[timestamp]_[i].png`.
  3. Actualiza el estado de la vista previa con miniaturas visuales.

---

## 🔍 3. Extracción de Datos Bancarios mediante OCR

PrestaFacilito integra `tesseract.js` para procesar vouchers de las principales entidades bancarias del Perú:
- **BCP / Yape**: Detección de número de operación, fecha/hora y monto abonado.
- **BBVA / Plin**: Identificación de beneficiario y código de transferencia.
- **Interbank / Scotiabank**: Lectura de comprobantes interbancarios.
