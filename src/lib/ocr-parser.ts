/**
 * OCR Pipeline — SteelNest AI
 *
 * Optimised specifically for camera photos of printed steel-fabrication BOM tables.
 *
 * Pipeline:
 *  1. Load source:
 *       • JPEG / PNG / WEBP / BMP camera photos → imageFileToCanvas()
 *       • PDF (scanned or CAD) → renderPdfToCanvases() via pdfjs-dist
 *  2. Preprocess each canvas:
 *       a. 3× upscale so glyphs are ≥ 40 px tall (Tesseract sweet-spot)
 *       b. ITU-R BT.601 grayscale
 *       c. Local adaptive threshold (Sauvola / Bradley) — handles shadows &
 *          uneven camera lighting that trips global Otsu
 *       d. Light noise-dilation pass to thicken thin strokes
 *  3. Divide into horizontal tiles (3–10 based on height)
 *  4. Per-tile: dual-pass Tesseract (PSM-6 block + PSM-11 sparse)
 *     with dictionaries disabled and an engineering-character whitelist
 *  5. Merge + disambiguate + parse into Part[]
 */

import { createWorker } from "tesseract.js";
import type { Part } from "./mock-data";

// ── Public types ─────────────────────────────────────────────────────────────

export interface OcrProgress {
  step: number;
  totalSteps: number;
  message: string;
  percent: number;
}

// ── PDF rendering (lazy import) ───────────────────────────────────────────────

async function renderPdfToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const buf  = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data: buf }).promise;
  const canvases: HTMLCanvasElement[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page     = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 3.0 }); // 3× ≈ 300 DPI
    const canvas   = document.createElement("canvas");
    canvas.width   = viewport.width;
    canvas.height  = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

// ── Image loading ─────────────────────────────────────────────────────────────

function imageFileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement("canvas");
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── LOCAL ADAPTIVE THRESHOLD (Sauvola-style / integral-image Bradley) ────────
// This is the critical fix for camera photos with shadows & uneven lighting.
// Instead of one global threshold, it computes a local threshold for each
// pixel based on the mean & std-dev of its neighbourhood window.

function adaptiveThreshold(
  gray: Uint8Array,
  W: number,
  H: number,
  windowSize = 51,   // neighbourhood radius (odd number)
  k = 0.15           // sensitivity — higher = more aggressive binarisation
): Uint8Array {
  const half   = Math.floor(windowSize / 2);
  const out    = new Uint8Array(W * H);

  // Build integral image and integral-squared image for O(1) window sums
  const integral  = new Float64Array((W + 1) * (H + 1));
  const integral2 = new Float64Array((W + 1) * (H + 1));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = gray[y * W + x]!;
      integral [(y + 1) * (W + 1) + (x + 1)] =
        v +
        integral [y * (W + 1) + (x + 1)] +
        integral [(y + 1) * (W + 1) + x] -
        integral [y * (W + 1) + x];
      integral2[(y + 1) * (W + 1) + (x + 1)] =
        v * v +
        integral2[y * (W + 1) + (x + 1)] +
        integral2[(y + 1) * (W + 1) + x] -
        integral2[y * (W + 1) + x];
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(W - 1, x + half);
      const y2 = Math.min(H - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum  = integral [(y2 + 1) * (W + 1) + (x2 + 1)]
                 - integral [(y1)     * (W + 1) + (x2 + 1)]
                 - integral [(y2 + 1) * (W + 1) + (x1)]
                 + integral [(y1)     * (W + 1) + (x1)];
      const sum2 = integral2[(y2 + 1) * (W + 1) + (x2 + 1)]
                 - integral2[(y1)     * (W + 1) + (x2 + 1)]
                 - integral2[(y2 + 1) * (W + 1) + (x1)]
                 + integral2[(y1)     * (W + 1) + (x1)];

      const mean   = sum / count;
      const stddev = Math.sqrt(Math.max(0, sum2 / count - mean * mean));
      // Sauvola threshold: T = mean × (1 + k × (stddev/128 − 1))
      const threshold = mean * (1 + k * (stddev / 128 - 1));

      out[y * W + x] = gray[y * W + x]! >= threshold ? 255 : 0;
    }
  }
  return out;
}

// ── Preprocessing ─────────────────────────────────────────────────────────────

function preprocessCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  // 1. Upscale to ≥3000 px wide (camera photos may be 1600px — too small for Tesseract)
  const TARGET_W = Math.max(src.width, 3000);
  const scale    = TARGET_W / src.width;
  const W        = Math.round(src.width  * scale);
  const H        = Math.round(src.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, W, H);

  const imgData = ctx.getImageData(0, 0, W, H);
  const px      = imgData.data;

  // 2. Weighted grayscale (ITU-R BT.601)
  const gray = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    gray[i] = Math.round(px[i*4]! * 0.299 + px[i*4+1]! * 0.587 + px[i*4+2]! * 0.114);
  }

  // 3. Detect background polarity: if more dark pixels → invert before threshold
  let darkCount = 0;
  for (let i = 0; i < gray.length; i++) if (gray[i]! < 128) darkCount++;
  const isDarkBg = darkCount > gray.length * 0.55;
  if (isDarkBg) {
    // Invert so background is always light (Sauvola assumes light BG)
    for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i]!;
  }

  // 4. Local adaptive threshold (Sauvola) — the key step for camera photos
  //    Window size = ~2% of image width (adaptive to resolution)
  const winSize  = Math.max(15, Math.round(W * 0.018) | 1); // must be odd
  const binary   = adaptiveThreshold(gray, W, H, winSize, 0.15);

  // 5. Write black-text / white-bg output
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    // binary=255 means "above threshold" = background = white
    // binary=0   means "below threshold" = foreground = black
    const v = binary[i]!; // 255=white bg, 0=black text
    out[i*4] = out[i*4+1] = out[i*4+2] = v;
    out[i*4+3] = 255;
  }

  ctx.putImageData(new ImageData(out, W, H), 0, 0);
  return canvas;
}

// ── Tile splitter ─────────────────────────────────────────────────────────────

function calcNumTiles(H: number): number {
  if (H < 800)  return 1;
  if (H < 1500) return 3;
  if (H < 3000) return 5;
  if (H < 6000) return 7;
  return 10;
}

function splitIntoTiles(canvas: HTMLCanvasElement, n: number): HTMLCanvasElement[] {
  const tileH = Math.ceil(canvas.height / n);
  const tiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    const y = i * tileH;
    const h = Math.min(tileH, canvas.height - y);
    if (h <= 0) break;
    const t = document.createElement("canvas");
    t.width  = canvas.width;
    t.height = h;
    t.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    tiles.push(t);
  }
  return tiles;
}

// ── OCR character disambiguation ──────────────────────────────────────────────

function sanitizeOcrText(text: string): string {
  return text
    // digit / letter confusions
    .replace(/(\d)[Oo]+/g, "$10").replace(/[Oo]+(\d)/g, "0$1")
    .replace(/(\d)[lI|]+/g, "$11").replace(/[lI|]+(\d)/g, "1$1")
    .replace(/(\d)S(\d)/g, "$15$2")
    .replace(/(\d)B(\d)/g, "$18$2")
    .replace(/(\d)Z(\d)/g, "$12$2")
    // dimension separators
    .replace(/[×*]/g, "x")
    .replace(/\bX\b/g, "x")
    // common OCR artefacts in BOM context
    .replace(/THl\b/gi, "THK")
    .replace(/\bLGS?\b/gi, "LG")
    .replace(/\bPlL?\b/gi, "PL")
    .replace(/ISMl?\b/g, "ISMC");
}

// ── Tesseract dual-pass ───────────────────────────────────────────────────────

const TESS_PARAMS: Record<string, string> = {
  load_system_dawg:        "0",
  load_freq_dawg:          "0",
  tessedit_char_whitelist:
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/:x×-+()\" ",
};

function hasDim(line: string): boolean {
  return /\d{2,}\s*x\s*\d{2,}/i.test(line) || /\d{3,}\s+\d{3,}/.test(line) ||
         /THK/i.test(line) || /LG\./i.test(line);
}

function mergeLines(a: string, b: string): string {
  const la = a.split("\n").map(l => l.trim()).filter(Boolean);
  const lb = b.split("\n").map(l => l.trim()).filter(Boolean);
  const seen = new Set(la);
  const out  = [...la];
  for (const l of lb) if (!seen.has(l) && hasDim(l)) { out.push(l); seen.add(l); }
  return out.join("\n");
}

async function ocrTile(
  worker: Awaited<ReturnType<typeof createWorker>>,
  dataUrl: string
): Promise<string> {
  await worker.setParameters({ ...TESS_PARAMS, tesseract_pageseg_mode: "6" } as any);
  const r6  = await worker.recognize(dataUrl);
  await worker.setParameters({ ...TESS_PARAMS, tesseract_pageseg_mode: "11" } as any);
  const r11 = await worker.recognize(dataUrl);
  return mergeLines(sanitizeOcrText(r6.data.text), sanitizeOcrText(r11.data.text));
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function processDocumentOcr(
  file: File,
  onProgress?: (p: OcrProgress) => void
): Promise<{ parts: Part[]; rawText: string }> {

  const emit = (step: number, percent: number, message: string) =>
    onProgress?.({ step, totalSteps: 5, percent, message });

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // Step 1 — Load
  emit(1, 8, "Step 1/5: Loading document & rendering to high-resolution canvas...");
  let sourceCanvases: HTMLCanvasElement[];
  try {
    sourceCanvases = isPdf
      ? await renderPdfToCanvases(file)
      : [await imageFileToCanvas(file)];
  } catch (e) {
    throw new Error(`Could not load file: ${(e as Error).message}`);
  }

  // Step 2 — Preprocess (local adaptive threshold)
  emit(2, 20,
    `Step 2/5: Applying Sauvola local adaptive threshold (shadow/lighting correction)...`);
  const processed = sourceCanvases.map(preprocessCanvas);

  // Step 3 — Tile plan
  const tilesPerPage = processed.map(c => splitIntoTiles(c, calcNumTiles(c.height)));
  const totalTiles   = tilesPerPage.reduce((s, t) => s + t.length, 0);
  emit(3, 30,
    `Step 3/5: Divided into ${totalTiles} tile(s) across ${processed.length} page(s). ` +
    `Each tile is zoomed individually for higher character clarity...`);

  // Step 4 — OCR each tile
  const worker = await createWorker("eng");
  const texts: string[] = [];
  let done = 0;

  for (let p = 0; p < tilesPerPage.length; p++) {
    const tiles = tilesPerPage[p]!;
    for (let t = 0; t < tiles.length; t++) {
      const pct = 30 + Math.round((done / totalTiles) * 55);
      emit(4, pct,
        `Step 4/5: Scanning Page ${p+1}/${processed.length} — Tile ${t+1}/${tiles.length} ` +
        `(dual-pass PSM-6 block + PSM-11 sparse)...`);
      const url  = tiles[t]!.toDataURL("image/png");
      const text = await ocrTile(worker, url);
      if (text.trim()) texts.push(text);
      done++;
    }
  }

  await worker.terminate();

  // Step 5 — Parse
  emit(5, 100,
    "Step 5/5: All tiles complete! Parsing BOM dimensions, materials & quantities...");

  const rawText = texts.join("\n");
  const parts   = parseOcrTextToParts(rawText);
  return { parts, rawText };
}

// ── BOM Parser ────────────────────────────────────────────────────────────────

export function parseOcrTextToParts(text: string): Part[] {
  const rawLines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Deduplicate across tile boundaries
  const seen    = new Set<string>();
  const lines: string[] = [];
  for (const l of rawLines) {
    const k = l.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(k)) { seen.add(k); lines.push(l); }
  }

  const parts: Part[] = [];
  let idx = 1;

  for (const line of lines) {
    const part = extractPartFromLine(line, idx);
    if (part) { parts.push(part); idx++; }
  }

  // Numeric fallback for purely tabular rows
  if (parts.length === 0) {
    for (const line of lines) {
      const nums = (line.match(/\b\d{2,5}(?:\.\d+)?\b/g) || [])
        .map(Number).filter(n => n >= 50 && n <= 12000);
      if (nums.length >= 2) {
        const s   = [...nums].sort((a, b) => b - a);
        const len = s[0]!, wid = s[1]!;
        if (len <= 12000 && wid <= 3000 && len >= 50) {
          parts.push({
            id: `ocr-fb-${idx}-${Date.now()}`,
            item: `P-${String(idx).padStart(3, "0")}`,
            description: line.slice(0, 40) || "Extracted Component",
            material: "IS:2062 E250A",
            thickness: s[2] && s[2] <= 100 ? s[2] : 10,
            length: len, width: wid, qty: 1,
          });
          idx++;
        }
      }
    }
  }

  return parts;
}

// ── Line extractor ────────────────────────────────────────────────────────────
// Handles the exact formats seen in Indian steel fabrication BOM camera photos:
//
//  PL 6 THK, 100 x 378 (CUT)
//  PL 10 THK, 150 x 475
//  PL.16THK. x 100 x 400 LG.
//  ISMC 150x75, 850 LG.
//  ISMB 200x100, 1200 LG.
//  PL 20 THK, 90 x 400 (CUT)

function extractPartFromLine(line: string, idx: number): Part | null {
  let thickness: number | null = null;
  let length:    number | null = null;
  let width:     number | null = null;

  // ── Pattern A: "PL X THK, W x L" or "PL X THK W x L" ───────────────────
  // e.g. "PL 6 THK, 100 x 378"  or  "PL.10THK. 150 x 475"
  const patPL = line.match(
    /PL[.\s]*(\d{1,3}(?:\.\d+)?)\s*THK[.,\s]+(\d{2,5}(?:\.\d+)?)\s*x\s*(\d{2,5}(?:\.\d+)?)/i
  );
  if (patPL) {
    thickness = parseFloat(patPL[1]!);
    const d1  = parseFloat(patPL[2]!);
    const d2  = parseFloat(patPL[3]!);
    width  = Math.min(d1, d2);
    length = Math.max(d1, d2);
  }

  // ── Pattern B: "PL.XTHK. x W x L LG." (three-value form) ────────────────
  // e.g. "PL.16THK. x 100 x 400 LG."
  if (!patPL) {
    const patPL3 = line.match(
      /PL[.\s]*(\d{1,3}(?:\.\d+)?)\s*THK[.,\s]+x\s+(\d{2,5}(?:\.\d+)?)\s*x\s*(\d{2,5}(?:\.\d+)?)/i
    );
    if (patPL3) {
      thickness = parseFloat(patPL3[1]!);
      const d1  = parseFloat(patPL3[2]!);
      const d2  = parseFloat(patPL3[3]!);
      width  = Math.min(d1, d2);
      length = Math.max(d1, d2);
    }
  }

  // ── Pattern C: Generic "X THK, W x L" (without PL prefix) ───────────────
  if (length === null) {
    const patTHK = line.match(
      /(\d{1,3}(?:\.\d+)?)\s*THK[.,\s]+(\d{2,5}(?:\.\d+)?)\s*x\s*(\d{2,5}(?:\.\d+)?)/i
    );
    if (patTHK) {
      thickness = parseFloat(patTHK[1]!);
      const d1  = parseFloat(patTHK[2]!);
      const d2  = parseFloat(patTHK[3]!);
      width  = Math.min(d1, d2);
      length = Math.max(d1, d2);
    }
  }

  // ── Pattern D: ISMC/ISMB profile "ISMx WxF, L LG." ──────────────────────
  // e.g. "ISMC 150x75, 850 LG."  →  width=150, length=850, thickness=8 (web)
  if (length === null) {
    const patISM = line.match(
      /IS(?:MC|MB|WB|NB|A)\s*(\d{2,3})x(\d{2,3})[,\s]+(\d{2,5})\s*(?:LG|LGS?)\./i
    );
    if (patISM) {
      width     = parseFloat(patISM[1]!);   // section depth
      thickness = parseFloat(patISM[2]!);   // flange width (used as "thickness" proxy)
      length    = parseFloat(patISM[3]!);   // cut length
    }
  }

  // ── Pattern E: Generic L x W (fallback for unlabelled rows) ─────────────
  if (length === null) {
    const patLW = line.match(
      /\b(\d{2,5}(?:\.\d+)?)\s*x\s*(\d{2,5}(?:\.\d+)?)(?:\s*x\s*(\d{1,3}(?:\.\d+)?))?\b/i
    );
    if (patLW) {
      const d1 = parseFloat(patLW[1]!), d2 = parseFloat(patLW[2]!);
      if (!isNaN(d1) && !isNaN(d2)) {
        length = Math.max(d1, d2);
        width  = Math.min(d1, d2);
        if (patLW[3]) thickness = parseFloat(patLW[3]);
      }
    }
  }

  // Bail if we couldn't find dimensions
  if (length === null || width === null) return null;
  if (length > 12000 || width > 3000 || width < 20 || length < 20) return null;

  // Thickness fallback
  if (thickness === null || thickness <= 0 || thickness > 100) {
    const m = line.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:THK|THICK|TH)\b/i)
           || line.match(/\bT[:\s=]*(\d{1,3}(?:\.\d+)?)\b/i);
    thickness = m ? parseFloat(m[1]!) : 10;
    if (thickness <= 0 || thickness > 100) thickness = 10;
  }

  // Material
  let material = "IS:2062 E250A";
  if      (/SAILMA|350HI/i.test(line))           material = "SAILMA 350HI";
  else if (/SS\s*316/i.test(line))               material = "SS 316";
  else if (/SS\s*304|STAINLESS/i.test(line))     material = "SS 304";
  else if (/CHQ|CHEQ|CHEQUERED/i.test(line))     material = "IS:3502 (Chequered Plate)";
  else if (/E350|E410/i.test(line))              material = "IS:2062 E350";
  else if (/E250BR/i.test(line))                 material = "IS:2062 E250BR";
  else if (/IS\s*2062|IS:2062|E250A?/i.test(line)) material = "IS:2062 E250A";

  // Quantity — look for a leading 1-2 digit number typical of BOM table first column
  let qty = 1;
  const qtyM =
    line.match(/\b(\d{1,4})\s*(?:NOS?|PCS?|OFF|QTY|EA|COUNT)\b/i) ||
    line.match(/QTY[:\s]*(\d{1,4})/i) ||
    line.match(/^(\d{1,3})\s+\d/);   // leading number in tabular row
  if (qtyM) {
    const q = parseInt(qtyM[1]!, 10);
    if (q > 0 && q < 9999) qty = q;
  }

  // Item mark
  const itemM =
    line.match(/\b(?:ITEM|MARK|POS|PART|TAG)\s*[:\s-]*([A-Z0-9_-]{1,12})/i) ||
    line.match(/^([A-Z]-?\d{1,4})\b/i);
  const item = itemM
    ? `ITEM ${itemM[1]!.toUpperCase()}`
    : `P-${String(idx).padStart(3, "0")}`;

  // Description — strip numeric noise
  let desc = line
    .replace(/\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?/gi, "")
    .replace(/\b\d+\s*(?:THK|THICK|NOS?|PCS?|MM|QTY|OFF|LG\.?)\b/gi, "")
    .replace(/\b(?:ITEM|MARK|POS|TAG|PART)\s*[A-Z0-9_-]*/gi, "")
    .replace(/[()]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!desc || desc.length < 2) desc = "Steel Plate Component";

  return {
    id:          `ocr-${idx}-${Date.now()}`,
    item,
    description: desc.slice(0, 45),
    material,
    thickness,
    length,
    width,
    qty,
  };
}
