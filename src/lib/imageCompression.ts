/**
 * Compresión de imágenes en el navegador (Canvas) antes de guardarlas en Storage.
 *
 * Perfiles:
 *  - "comprobante": captura de Yape/transferencia o foto de voucher. Lo importante es poder leer
 *    montos, fechas y nombres: escala de grises, como máximo 900×1600 px, WebP (o JPEG si el
 *    navegador no sabe generar WebP). Suele quedar en 40–120 KB.
 *  - "documento": DNI, recibos, contratos. Mantiene el color (sellos, firmas) y algo más de resolución.
 *
 * Los PDF y los formatos que el navegador no puede abrir (p. ej. HEIC en Chrome) se envían tal cual.
 */

export type PerfilCompresion = "comprobante" | "documento";

interface Perfil {
  anchoMax: number;
  altoMax: number;
  calidad: number;
  grises: boolean;
}

const PERFILES: Record<PerfilCompresion, Perfil> = {
  comprobante: { anchoMax: 900, altoMax: 1600, calidad: 0.6, grises: true },
  documento: { anchoMax: 1400, altoMax: 1800, calidad: 0.7, grises: false },
};

const leerComoDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const cargarImagen = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El navegador no pudo abrir la imagen"));
    };
    img.src = url;
  });

/** Pasa a escala de grises (luminancia). Funciona en todos los navegadores, a diferencia de ctx.filter. */
function aGrises(ctx: CanvasRenderingContext2D, ancho: number, alto: number) {
  const datos = ctx.getImageData(0, 0, ancho, alto);
  const p = datos.data;
  for (let i = 0; i < p.length; i += 4) {
    const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000;
    p[i] = p[i + 1] = p[i + 2] = y;
  }
  ctx.putImageData(datos, 0, 0);
}

/**
 * Comprime una imagen y devuelve un data URL (el tipo real va en el prefijo: image/webp o image/jpeg).
 * Si no es imagen o no se puede abrir, devuelve el archivo original sin cambios.
 */
export async function comprimirImagen(archivo: Blob, perfil: PerfilCompresion = "comprobante"): Promise<string> {
  if (!archivo.type.startsWith("image/")) return leerComoDataUrl(archivo);

  let img: HTMLImageElement;
  try {
    img = await cargarImagen(archivo);
  } catch {
    return leerComoDataUrl(archivo);
  }

  const { anchoMax, altoMax, calidad, grises } = PERFILES[perfil];
  const escala = Math.min(1, anchoMax / img.width, altoMax / img.height);
  const ancho = Math.max(1, Math.round(img.width * escala));
  const alto = Math.max(1, Math.round(img.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return leerComoDataUrl(archivo);

  // Fondo blanco: las capturas PNG con transparencia no quedan negras al pasar a JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, ancho, alto);
  if (grises) aGrises(ctx, ancho, alto);

  // WebP pesa ~30 % menos. Safari no sabe generarlo y devuelve PNG: en ese caso, JPEG.
  let resultado = canvas.toDataURL("image/webp", calidad);
  if (!resultado.startsWith("data:image/webp")) resultado = canvas.toDataURL("image/jpeg", calidad + 0.05);

  // Si por algún motivo "comprimido" pesa más que el original, se queda el original
  const original = await leerComoDataUrl(archivo);
  return resultado.length < original.length ? resultado : original;
}

/** Separa un data URL en tipo y base64, listo para enviar al servidor. */
export function partesDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  const mimeType = dataUrl.match(/^data:([^;]+);/)?.[1] || "application/octet-stream";
  return { mimeType, base64Data: dataUrl.replace(/^data:[^;]+;base64,/, "") };
}

/**
 * Comprime y sube un comprobante a /api/upload-voucher y devuelve su URL
 * (`/api/archivos/comprobantes/...`). Lanza un Error si el servidor rechaza la subida.
 */
export async function subirVoucher(file: File): Promise<{ url: string }> {
  const { mimeType, base64Data } = partesDataUrl(await comprimirImagen(file, "comprobante"));

  const res = await fetch("/api/upload-voucher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name || "comprobante", mimeType, base64Data }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || (errData.detail as string) || "No se pudo subir el comprobante");
  }

  const data = await res.json();
  if (!data.publicUrl) throw new Error("El servidor no devolvió la URL del comprobante");
  return { url: data.publicUrl };
}
