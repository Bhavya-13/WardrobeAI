// Small picture helpers used in the browser.

export const THUMB_SIDE = 480;

export function scaleToCanvas(
  src: ImageBitmap | HTMLCanvasElement,
  maxSide: number
): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * scale));
  c.height = Math.max(1, Math.round(src.height * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could not process the picture");
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress the picture"))),
      "image/jpeg",
      quality
    )
  );
}

// A small copy of a picture for grids and cards (about 30 KB instead of 250 KB).
export async function makeThumbBlob(
  src: ImageBitmap | HTMLCanvasElement
): Promise<Blob> {
  return canvasToBlob(scaleToCanvas(src, THUMB_SIDE), 0.78);
}
