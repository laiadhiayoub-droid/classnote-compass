export type ImageEdits = {
  rotation: 0 | 90 | 180 | 270;
  /** Crop margins in percent (0-40) of each side. */
  crop: { top: number; right: number; bottom: number; left: number };
  /** Manual contrast multiplier (0.5-2), applied after auto-enhance. */
  contrast: number;
  /** Whiten paper background and dirty margins. */
  cleanup: boolean;
};

export const DEFAULT_EDITS: ImageEdits = {
  rotation: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 }, contrast: 1, cleanup: false,
};

/** Percentile-based level stretch: maps [lo, hi] luminance to [0, 255]. */
export function levels(hist: number[], total: number): [number, number] {
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]!; if (acc >= total * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]!; if (acc >= total * 0.02) { hi = i; break; } }
  if (hi - lo < 40) return [0, 255];
  return [lo, hi];
}

/** Render edits + automatic enhancement to a canvas, max dimension `max`. */
export async function renderEdited(file: Blob, edits: ImageEdits, max = 1800): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const c = edits.crop;
  const sx = (bmp.width * c.left) / 100, sy = (bmp.height * c.top) / 100;
  const sw = Math.max(1, bmp.width * (1 - (c.left + c.right) / 100));
  const sh = Math.max(1, bmp.height * (1 - (c.top + c.bottom) / 100));
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.round(sw * scale), h = Math.round(sh * scale);
  const turned = edits.rotation === 90 || edits.rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = turned ? h : w; canvas.height = turned ? w : h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((edits.rotation * Math.PI) / 180);
  ctx.drawImage(bmp, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data, n = d.length / 4;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[(d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114) | 0]++;
  const [lo, hi] = levels(hist, n);
  const k = 255 / (hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      let v = (d[i + j]! - lo) * k;
      v = (v - 128) * edits.contrast + 128;
      d[i + j] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    if (edits.cleanup) {
      const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      // Light, low-saturation pixels are paper/shadow: whiten them; keep coloured ink.
      if (lum > 175 && sat < 45) { d[i] = d[i + 1] = d[i + 2] = 255; }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Process an upload into a compressed WebP (JPEG fallback). */
export async function processImage(file: Blob, edits: ImageEdits = DEFAULT_EDITS): Promise<Blob> {
  const canvas = await renderEdited(file, edits);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("compress failed"))), "image/jpeg", 0.8));
}

/** Find unit / domain values in OCR text. */
export function extractUnitDomain(text: string): { unit: string; domain: string } {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const find = (re: RegExp) => {
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[0].replace(/^[\s:：\-–—.]+|[\s:：\-–—.]+$/g, "").slice(0, 80);
    }
    return "";
  };
  const unit = find(/(الوحدة|الوحده|Unidad|Unit[ée]?|Unité)\s*[:：\-–]?\s*[^\n]{0,60}/i);
  const domain = find(/(الميدان|المجال|Ámbito|Ambito|Dominio|Domaine|Domain|Field)\s*[:：\-–]?\s*[^\n]{0,60}/i);
  return { unit, domain };
}
