export type ImageOutputFormat = 'jpeg' | 'png' | 'webp';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WatermarkOptions {
  text: string;
  opacity: number;
  fontSize: number;
  color: string;
  position: 'center' | 'bottom-right' | 'bottom-left' | 'tiled';
}

export interface BgRemovalOptions {
  mode: 'normal' | 'advanced';
  tolerance: number;
  feather: number;
  seedPoints?: { x: number; y: number }[];
  keepMask?: Uint8Array | null;
  eraseMask?: Uint8Array | null;
  maskWidth?: number;
  maskHeight?: number;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image file.'));
    img.src = src;
  });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ImageOutputFormat,
  quality = 0.92
): Promise<Blob> {
  const mime =
    format === 'png'
      ? 'image/png'
      : format === 'webp'
      ? 'image/webp'
      : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to encode ${format.toUpperCase()} image.`));
      },
      mime,
      format === 'png' ? undefined : Math.min(1, Math.max(0.05, quality))
    );
  });
}

export async function renderTransformedCrop(
  img: HTMLImageElement,
  crop: CropRect,
  options: {
    rotateDeg: number;
    flipH: boolean;
    flipV: boolean;
    format: ImageOutputFormat;
    quality: number;
    backgroundColor?: string;
  }
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  // First normalize rotation & flip onto an intermediate canvas
  const rad = ((options.rotateDeg % 360) * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  const rotW = Math.max(1, Math.round(srcW * cos + srcH * sin));
  const rotH = Math.max(1, Math.round(srcW * sin + srcH * cos));

  const stage = document.createElement('canvas');
  stage.width = rotW;
  stage.height = rotH;
  const sCtx = stage.getContext('2d')!;
  sCtx.translate(rotW / 2, rotH / 2);
  sCtx.rotate(rad);
  sCtx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
  sCtx.drawImage(img, -srcW / 2, -srcH / 2);

  // Extract normalized crop rect clamped to transformed canvas bounds
  const cx = Math.max(0, Math.min(rotW - 1, Math.round(crop.x)));
  const cy = Math.max(0, Math.min(rotH - 1, Math.round(crop.y)));
  const cw = Math.max(1, Math.min(rotW - cx, Math.round(crop.width)));
  const ch = Math.max(1, Math.min(rotH - cy, Math.round(crop.height)));

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const oCtx = out.getContext('2d')!;

  if (options.format === 'jpeg' || options.backgroundColor) {
    oCtx.fillStyle = options.backgroundColor || '#FFFFFF';
    oCtx.fillRect(0, 0, cw, ch);
  }

  oCtx.drawImage(stage, cx, cy, cw, ch, 0, 0, cw, ch);

  const blob = await canvasToBlob(out, options.format, options.quality);
  return {
    blob,
    url: URL.createObjectURL(blob),
    width: cw,
    height: ch,
  };
}

export async function resizeOrConvertImage(
  file: File,
  options: {
    targetWidth?: number;
    targetHeight?: number;
    maxWidth?: number;
    format: ImageOutputFormat;
    quality: number;
    rotateDeg?: number;
    flipH?: boolean;
    flipV?: boolean;
    matteColor?: string;
    watermark?: WatermarkOptions;
  }
): Promise<{
  blob: Blob;
  url: string;
  width: number;
  height: number;
  originalSize: number;
  finalSize: number;
}> {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(srcUrl);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;

    const rot = options.rotateDeg ?? 0;
    const swapDims = Math.abs(rot % 180) === 90;
    const baseW = swapDims ? natH : natW;
    const baseH = swapDims ? natW : natH;

    let outW = options.targetWidth ?? baseW;
    let outH = options.targetHeight ?? baseH;

    if (options.maxWidth && outW > options.maxWidth) {
      const ratio = options.maxWidth / outW;
      outW = Math.round(outW * ratio);
      outH = Math.round(outH * ratio);
    }

    outW = Math.max(1, Math.round(outW));
    outH = Math.max(1, Math.round(outH));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    if (options.format === 'jpeg') {
      ctx.fillStyle = options.matteColor || '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
    const drawW = swapDims ? outH : outW;
    const drawH = swapDims ? outW : outH;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    if (options.watermark && options.watermark.text.trim()) {
      drawWatermarkOnCanvas(ctx, outW, outH, options.watermark);
    }

    const blob = await canvasToBlob(canvas, options.format, options.quality);
    return {
      blob,
      url: URL.createObjectURL(blob),
      width: outW,
      height: outH,
      originalSize: file.size,
      finalSize: blob.size,
    };
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wm: WatermarkOptions
) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0.05, wm.opacity));
  ctx.fillStyle = wm.color;
  const scaledSize = Math.max(12, Math.round((wm.fontSize * Math.min(w, h)) / 600));
  ctx.font = `700 ${scaledSize}px "Plus Jakarta Sans", system-ui, sans-serif`;

  if (wm.position === 'tiled') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stepX = Math.max(160, scaledSize * 6);
    const stepY = Math.max(120, scaledSize * 4);
    for (let y = 0; y < h + stepY; y += stepY) {
      for (let x = 0; x < w + stepX; x += stepX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(wm.text, 0, 0);
        ctx.restore();
      }
    }
  } else if (wm.position === 'center') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 8);
    ctx.fillText(wm.text, 0, 0);
  } else if (wm.position === 'bottom-left') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(wm.text, 24, h - 20);
  } else {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(wm.text, w - 24, h - 20);
  }

  ctx.restore();
}

// Convert sRGB (0-255) to perceptual CIELAB (L*, a*, b*) for accurate background segmentation
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let sr = r / 255;
  let sg = g / 255;
  let sb = b / 255;
  sr = sr > 0.04045 ? Math.pow((sr + 0.055) / 1.055, 2.4) : sr / 12.92;
  sg = sg > 0.04045 ? Math.pow((sg + 0.055) / 1.055, 2.4) : sg / 12.92;
  sb = sb > 0.04045 ? Math.pow((sb + 0.055) / 1.055, 2.4) : sb / 12.92;

  let x = (sr * 0.4124 + sg * 0.3576 + sb * 0.1805) / 0.95047;
  let y = (sr * 0.2126 + sg * 0.7152 + sb * 0.0722) / 1.0;
  let z = (sr * 0.0193 + sg * 0.1192 + sb * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export async function removeImageBackground(
  img: HTMLImageElement,
  options: BgRemovalOptions
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const totalPixels = w * h;

  // Gather perimeter & custom seed RGB/Lab colors
  const seeds: { r: number; g: number; b: number; lab: [number, number, number] }[] = [];
  const addSeedAt = (px: number, py: number) => {
    const cx = Math.max(0, Math.min(w - 1, Math.round(px)));
    const cy = Math.max(0, Math.min(h - 1, Math.round(py)));
    const idx = (cy * w + cx) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    seeds.push({ r, g, b, lab: rgbToLab(r, g, b) });
  };

  if (options.seedPoints && options.seedPoints.length > 0) {
    options.seedPoints.forEach((pt) => addSeedAt(pt.x, pt.y));
  } else {
    // Sample 12 perimeter points (4 corners + mid-edges)
    const stepX = Math.max(1, Math.floor(w / 4));
    const stepY = Math.max(1, Math.floor(h / 4));
    for (let x = 2; x < w - 2; x += stepX) {
      addSeedAt(x, 2);
      addSeedAt(x, h - 3);
    }
    for (let y = 2; y < h - 2; y += stepY) {
      addSeedAt(2, y);
      addSeedAt(w - 3, y);
    }
  }

  // Deduplicate similar seeds for fast inner loop
  const uniqueSeeds = seeds.filter((s, idx) => {
    for (let j = 0; j < idx; j++) {
      const o = seeds[j];
      if (Math.abs(s.r - o.r) + Math.abs(s.g - o.g) + Math.abs(s.b - o.b) < 18) return false;
    }
    return true;
  });

  const alphaMap = new Float32Array(totalPixels).fill(1);
  const tol = Math.max(4, options.tolerance);

  if (options.mode === 'normal') {
    // Fast 4-connected BFS flood-fill from edges & user seed points
    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const pushIfBg = (x: number, y: number) => {
      const p = y * w + x;
      if (visited[p]) return;
      const idx = p * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      let minDist = Infinity;
      for (let k = 0; k < uniqueSeeds.length; k++) {
        const s = uniqueSeeds[k];
        const d = Math.hypot(r - s.r, g - s.g, b - s.b);
        if (d < minDist) minDist = d;
      }
      if (minDist <= tol * 1.45) {
        visited[p] = 1;
        alphaMap[p] = 0;
        queue[tail++] = p;
      }
    };

    if (options.seedPoints && options.seedPoints.length > 0) {
      options.seedPoints.forEach((pt) =>
        pushIfBg(
          Math.max(0, Math.min(w - 1, Math.round(pt.x))),
          Math.max(0, Math.min(h - 1, Math.round(pt.y)))
        )
      );
    } else {
      for (let x = 0; x < w; x++) {
        pushIfBg(x, 0);
        pushIfBg(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        pushIfBg(0, y);
        pushIfBg(w - 1, y);
      }
    }

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) pushIfBg(x - 1, y);
      if (x < w - 1) pushIfBg(x + 1, y);
      if (y > 0) pushIfBg(x, y - 1);
      if (y < h - 1) pushIfBg(x, y + 1);
    }
  } else {
    // ADVANCED MODE: Sobel Edge Magnitude Barrier + Perceptual CIELAB ΔE Flood & Alpha Matting
    const luma = new Float32Array(totalPixels);
    for (let p = 0; p < totalPixels; p++) {
      const idx = p * 4;
      luma[p] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    const edgeStrength = new Float32Array(totalPixels);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const gx =
          -luma[p - w - 1] +
          luma[p - w + 1] -
          2 * luma[p - 1] +
          2 * luma[p + 1] -
          luma[p + w - 1] +
          luma[p + w + 1];
        const gy =
          -luma[p - w - 1] -
          2 * luma[p - w] -
          luma[p - w + 1] +
          luma[p + w - 1] +
          2 * luma[p + w] +
          luma[p + w + 1];
        edgeStrength[p] = Math.hypot(gx, gy);
      }
    }

    const visited = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;
    const labThreshold = Math.max(8, tol * 0.52);

    const evaluateAndEnqueue = (x: number, y: number, isBoundaryStart = false) => {
      const p = y * w + x;
      if (visited[p]) return;
      const idx = p * 4;
      const lab = rgbToLab(data[idx], data[idx + 1], data[idx + 2]);

      let minDeltaE = Infinity;
      for (let k = 0; k < uniqueSeeds.length; k++) {
        const sl = uniqueSeeds[k].lab;
        const dE = Math.hypot(lab[0] - sl[0], lab[1] - sl[1], lab[2] - sl[2]);
        if (dE < minDeltaE) minDeltaE = dE;
      }

      // Edge-aware penalty prevents cutting across crisp subject contours
      const edgePenalty = isBoundaryStart ? 0 : edgeStrength[p] * 0.12;
      const effectiveDist = minDeltaE + edgePenalty;

      if (effectiveDist <= labThreshold) {
        visited[p] = 1;
        alphaMap[p] = 0;
        queue[tail++] = p;
      } else if (effectiveDist <= labThreshold * 1.45) {
        visited[p] = 1;
        const t = (effectiveDist - labThreshold) / Math.max(0.001, labThreshold * 0.45);
        alphaMap[p] = Math.min(alphaMap[p], t * t * (3 - 2 * t));
      }
    };

    if (options.seedPoints && options.seedPoints.length > 0) {
      options.seedPoints.forEach((pt) =>
        evaluateAndEnqueue(
          Math.max(0, Math.min(w - 1, Math.round(pt.x))),
          Math.max(0, Math.min(h - 1, Math.round(pt.y))),
          true
        )
      );
    } else {
      for (let x = 0; x < w; x++) {
        evaluateAndEnqueue(x, 0, true);
        evaluateAndEnqueue(x, h - 1, true);
      }
      for (let y = 0; y < h; y++) {
        evaluateAndEnqueue(0, y, true);
        evaluateAndEnqueue(w - 1, y, true);
      }
    }

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) evaluateAndEnqueue(x - 1, y);
      if (x < w - 1) evaluateAndEnqueue(x + 1, y);
      if (y > 0) evaluateAndEnqueue(x, y - 1);
      if (y < h - 1) evaluateAndEnqueue(x, y + 1);
    }

    // Color fringe decontamination along semi-transparent boundary pixels
    const bgRef = uniqueSeeds[0] || { r: 255, g: 255, b: 255 };
    for (let p = 0; p < totalPixels; p++) {
      const a = alphaMap[p];
      if (a > 0.03 && a < 0.92) {
        const idx = p * 4;
        data[idx] = Math.max(0, Math.min(255, Math.round((data[idx] - (1 - a) * bgRef.r) / a)));
        data[idx + 1] = Math.max(
          0,
          Math.min(255, Math.round((data[idx + 1] - (1 - a) * bgRef.g) / a))
        );
        data[idx + 2] = Math.max(
          0,
          Math.min(255, Math.round((data[idx + 2] - (1 - a) * bgRef.b) / a))
        );
      }
    }
  }

  // Optional edge feathering pass
  const featherRadius = Math.max(0, Math.min(6, Math.round(options.feather)));
  if (featherRadius > 0) {
    const blurred = new Float32Array(alphaMap);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (alphaMap[p] > 0 && alphaMap[p] < 1) continue;
        const avg =
          (alphaMap[p - 1] +
            alphaMap[p + 1] +
            alphaMap[p - w] +
            alphaMap[p + w] +
            alphaMap[p] * 2) /
          6;
        if (avg !== alphaMap[p]) {
          blurred[p] = alphaMap[p] === 0 ? Math.min(0.35, avg) : Math.max(0.45, avg);
        }
      }
    }
    alphaMap.set(blurred);
  }

  // Apply interactive user Keep / Erase refinement masks if present
  if (
    options.keepMask &&
    options.eraseMask &&
    options.maskWidth === w &&
    options.maskHeight === h
  ) {
    for (let p = 0; p < totalPixels; p++) {
      if (options.keepMask[p]) alphaMap[p] = 1;
      if (options.eraseMask[p]) alphaMap[p] = 0;
    }
  }

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4;
    const origAlpha = data[idx + 3] / 255;
    data[idx + 3] = Math.round(alphaMap[p] * origAlpha * 255);
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, width: w, height: h };
}
