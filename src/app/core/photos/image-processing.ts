/** Longest edge of an uploaded photo, in pixels. Plenty for a phone screen. */
export const PHOTO_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** Scales (width, height) down to fit in a max × max square, keeping the ratio. Never upscales. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Decodes any image the browser/WebView can read, resizes it and re-encodes it
 * as JPEG. Re-encoding through a canvas drops every metadata block, EXIF
 * included (GPS position, device…); the orientation is applied to the pixels first.
 */
export async function resizeToJpeg(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    // JPEG has no transparency: paint transparent PNG areas white rather than black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', JPEG_QUALITY),
    );
  } finally {
    bitmap.close();
  }
}
