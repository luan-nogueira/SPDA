/**
 * Redimensiona e comprime uma imagem no navegador.
 * Fotos de celular (4–8 MB) ficam com ~150–300 KB, deixando o envio muito mais rápido em campo.
 */
export async function compressImage(file, maxSize = 1600, quality = 0.75) {
  const bitmap = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { blob, canvas };
}

export const canvasToDataUrl = (canvas, maxSize = 960, quality = 0.55) => {
  const scale = Math.min(1, maxSize / Math.max(canvas.width, canvas.height));
  if (scale === 1) return canvas.toDataURL('image/jpeg', quality);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
};

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fallback abaixo */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
