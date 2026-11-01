/**
 * Compresión de imágenes en el cliente (Browser Canvas) para que los archivos
 * guardados en Storage pesen poco (<500 KB).
 */

export async function comprimirImagen(
  file: File,
  maxWidthPx = 1024,
  quality = 0.7
): Promise<string> {
  // Si no es una imagen (ej: PDF), retornar como base64 normal
  if (!file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidthPx / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo obtener el contexto 2D del Canvas"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Comprime y sube un comprobante a /api/upload-voucher y devuelve su URL
 * (`/api/archivos/comprobantes/...`). Lanza un Error si el servidor rechaza la subida.
 */
export async function subirVoucher(file: File): Promise<{ url: string }> {
  const compressedDataUrl = await comprimirImagen(file, 1024, 0.7);
  const base64Data = compressedDataUrl.replace(/^data:[^;]+;base64,/, "");
  // Las imágenes se re-codifican como JPEG al comprimirse: el tipo debe coincidir con el contenido
  const mimeType = compressedDataUrl.match(/^data:([^;]+);/)?.[1] || file.type || "image/jpeg";

  const res = await fetch("/api/upload-voucher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name || "comprobante", mimeType, base64Data })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || (errData.detail as string) || "No se pudo subir el comprobante");
  }

  const data = await res.json();
  if (!data.publicUrl) throw new Error("El servidor no devolvió la URL del comprobante");
  return { url: data.publicUrl };
}
