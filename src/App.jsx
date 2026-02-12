import React, { useMemo, useRef, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

/**
 * PLS601 (1" x 1") — 63 labels per Letter sheet.
 * Grid: 7 columns x 9 rows.
 * Derived from the manufacturer PDF template coordinates.
 *
 * Units below are PDF points (1 inch = 72 pt)
 */
const PLS601 = {
  page: { w: 612, h: 792 }, // Letter
  label: { w: 72, h: 72 }, // 1" x 1"
  grid: { cols: 7, rows: 9 },
  pitch: { x: 81, y: 81 }, // 1.125" pitch => 0.125" gap
  originTopLeft: { x: 28, yBottom: 684 }, // top-left label bottom-left corner
  // yBottom for row r (0 = top): y = originTopLeft.yBottom - r * pitch.y
};

function clampInt(n, min, max) {
  const x = Math.trunc(Number(n));
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function pad6(n) {
  return String(n).padStart(6, "0");
}

function buildCodes({ prefix, start, count }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(`${prefix}-${pad6(start + i)}`);
  }
  return out;
}

function downloadTextFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseHighestFromCsv(text) {
  // Looks for tokens like "T-006519" and returns the max numeric part.
  const re = /\b([A-Za-z])-([0-9]{6})\b/g;
  let m;
  let max = null;
  while ((m = re.exec(text))) {
    const num = Number(m[2]);
    if (!Number.isNaN(num)) max = max === null ? num : Math.max(max, num);
  }
  return max;
}

async function codeToQrPngBytes(code, { ecLevel = "M", px = 512 }) {
  // Generate a crisp QR PNG data URL and convert to bytes for pdf-lib.
  const dataUrl = await QRCode.toDataURL(code, {
    errorCorrectionLevel: ecLevel,
    margin: 2, // quiet zone (modules). keep small; label is tiny.
    width: px,
    scale: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}

async function generatePls601Pdf({
  codes,
  skip,
  qrSizePt,
  showText,
  textSizePt,
  textOffsetPt,
  ecLevel,
  xOffsetPt,
  yOffsetPt,
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PLS601.page.w, PLS601.page.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const totalLabels = PLS601.grid.cols * PLS601.grid.rows;
  const usable = clampInt(totalLabels - skip, 0, totalLabels);
  const toPlace = Math.min(codes.length, usable);

  // Pre-generate QR images (sequential) to keep code simple.
  const qrPngs = [];
  for (let i = 0; i < toPlace; i++) {
    qrPngs.push(await codeToQrPngBytes(codes[i], { ecLevel, px: 512 }));
  }

  for (let i = 0; i < toPlace; i++) {
    const labelIndex = skip + i;
    const col = labelIndex % PLS601.grid.cols;
    const row = Math.floor(labelIndex / PLS601.grid.cols); // 0 is top row

    const x = PLS601.originTopLeft.x + col * PLS601.pitch.x + xOffsetPt;
    const y = PLS601.originTopLeft.yBottom - row * PLS601.pitch.y + yOffsetPt;

    // Place QR centered, with optional text below.
    const textBlock = showText ? textSizePt + textOffsetPt : 0;
    const qrX = x + (PLS601.label.w - qrSizePt) / 2;
    const qrY = y + (PLS601.label.h - qrSizePt) / 2 + (showText ? textBlock / 2 : 0);

    const png = await pdf.embedPng(qrPngs[i]);
    page.drawImage(png, {
      x: qrX,
      y: qrY,
      width: qrSizePt,
      height: qrSizePt,
    });

    if (showText) {
      const code = codes[i];
      const textWidth = font.widthOfTextAtSize(code, textSizePt);
      const tx = x + (PLS601.label.w - textWidth) / 2;
      const ty = y + textOffsetPt;
      page.drawText(code, {
        x: tx,
        y: ty,
        size: textSizePt,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  const bytes = await pdf.save();
  return bytes;
}

export default function Pls601QrLabelGenerator() {
  const [prefix, setPrefix] = useState("T");
  const [start, setStart] = useState(6519);
  const [count, setCount] = useState(63);
  const [skip, setSkip] = useState(0);

  // Layout / print tuning
  const [qrSizePt, setQrSizePt] = useState(54); // 0.75" default
  const [showText, setShowText] = useState(true);
  const [textSizePt, setTextSizePt] = useState(7);
  const [textOffsetPt, setTextOffsetPt] = useState(4);
  const [ecLevel, setEcLevel] = useState("M");
  const [xOffsetPt, setXOffsetPt] = useState(0);
  const [yOffsetPt, setYOffsetPt] = useState(0);

  const fileInputRef = useRef(null);

  const safe = useMemo(() => {
    const p = (prefix || "T").trim().slice(0, 1).toUpperCase();
    const s = clampInt(start, 0, 999999);
    const c = clampInt(count, 1, 999999);
    const sk = clampInt(skip, 0, 62);
    return { prefix: p, start: s, count: c, skip: sk };
  }, [prefix, start, count, skip]);

  const codes = useMemo(() => buildCodes(safe), [safe]);

  async function onGeneratePdf() {
    const totalLabels = PLS601.grid.cols * PLS601.grid.rows;
    const maxCount = Math.max(0, totalLabels - safe.skip);
    const effectiveCount = Math.min(codes.length, maxCount);

    const pdfBytes = await generatePls601Pdf({
      codes: codes.slice(0, effectiveCount),
      skip: safe.skip,
      qrSizePt: clampInt(qrSizePt, 20, 72),
      showText,
      textSizePt: clampInt(textSizePt, 5, 10),
      textOffsetPt: clampInt(textOffsetPt, 0, 12),
      ecLevel,
      xOffsetPt: Number(xOffsetPt) || 0,
      yOffsetPt: Number(yOffsetPt) || 0,
    });

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PLS601_${safe.prefix}-${pad6(safe.start)}_${effectiveCount}labels.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onExportCsv() {
    const now = new Date().toISOString();
    // Simple append-friendly CSV: code,printed_at
    const lines = ["code,printed_at"].concat(codes.map((c) => `${c},${now}`));
    downloadTextFile(
      `barcodes_${safe.prefix}-${pad6(safe.start)}_${clampInt(count, 1, 999999)}.csv`,
      lines.join("\n"),
      "text/csv"
    );
  }

  async function onImportRegistryCsv(file) {
    const text = await file.text();
    const max = parseHighestFromCsv(text);
    if (max !== null) {
      setPrefix((prefix || "T").trim().slice(0, 1).toUpperCase());
      setStart(Math.min(999999, max + 1));
    }
  }

  function onClickImport() {
    fileInputRef.current?.click();
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">PLS601 QR Label Sheet Generator</h1>
          <p className="mt-2 text-sm text-neutral-300">
            Generates sequential QR codes like <span className="font-mono">T-006519</span> and lays them out on the
            Premium Label Supply <span className="font-mono">PLS601</span> (63-up, 1\"×1\") Letter sheet.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow">
            <h2 className="text-lg font-medium">Sequence</h2>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="text-sm">
                Prefix (1 char)
                <input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
              </label>

              <label className="text-sm">
                Start number
                <input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
              </label>

              <label className="text-sm">
                Count (max 63 - skip)
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
              </label>

              <label className="text-sm">
                Skip labels (reuse sheet)
                <input
                  type="number"
                  value={skip}
                  onChange={(e) => setSkip(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl bg-neutral-950 p-4">
              <div className="text-xs text-neutral-400">Preview</div>
              <div className="mt-1 font-mono text-sm">
                {safe.prefix}-{pad6(safe.start)} … {safe.prefix}-{pad6(safe.start + Math.max(0, clampInt(count, 1, 999999) - 1))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={onGeneratePdf}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200"
              >
                Generate printable PDF
              </button>

              <button
                onClick={onExportCsv}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm hover:bg-neutral-900"
              >
                Export CSV for Git registry
              </button>

              <button
                onClick={onClickImport}
                className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm hover:bg-neutral-900"
              >
                Import registry CSV (set next start)
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportRegistryCsv(f);
                  e.target.value = "";
                }}
              />
            </div>

            <p className="mt-4 text-xs text-neutral-400">
              Tip: print one calibration sheet, then tweak X/Y offset (below) by 1–3 points at a time to dial in your
              printer feed.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow">
            <h2 className="text-lg font-medium">Label layout tuning</h2>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className="text-sm">
                QR size (pt)
                <input
                  type="number"
                  value={qrSizePt}
                  onChange={(e) => setQrSizePt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
                <div className="mt-1 text-xs text-neutral-400">54 pt ≈ 0.75\" (good default)</div>
              </label>

              <label className="text-sm">
                Error correction
                <select
                  value={ecLevel}
                  onChange={(e) => setEcLevel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                >
                  <option value="L">L (7%)</option>
                  <option value="M">M (15%)</option>
                  <option value="Q">Q (25%)</option>
                  <option value="H">H (30%)</option>
                </select>
              </label>

              <label className="text-sm">
                X offset (pt)
                <input
                  type="number"
                  value={xOffsetPt}
                  onChange={(e) => setXOffsetPt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
              </label>

              <label className="text-sm">
                Y offset (pt)
                <input
                  type="number"
                  value={yOffsetPt}
                  onChange={(e) => setYOffsetPt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                />
              </label>
            </div>

            <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Human-readable code text</div>
                  <div className="text-xs text-neutral-400">Useful when you’re holding paper and not a scanner.</div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showText}
                    onChange={(e) => setShowText(e.target.checked)}
                  />
                  Show
                </label>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="text-sm">
                  Text size (pt)
                  <input
                    type="number"
                    value={textSizePt}
                    onChange={(e) => setTextSizePt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                    disabled={!showText}
                  />
                </label>
                <label className="text-sm">
                  Text bottom padding (pt)
                  <input
                    type="number"
                    value={textOffsetPt}
                    onChange={(e) => setTextOffsetPt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono"
                    disabled={!showText}
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-neutral-950 p-4 text-xs text-neutral-300">
              <div className="font-mono">PLS601 geometry (hardcoded):</div>
              <ul className="mt-2 list-disc pl-5 text-neutral-400">
                <li>63 labels: 7 cols × 9 rows</li>
                <li>Label: 72×72 pt (1\"×1\")</li>
                <li>Pitch: 81 pt (1.125\") → 0.125\" gaps</li>
                <li>Margins: ~0.5\" top/bottom; ~0.36–0.39\" left/right</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-neutral-500">
          Printing note: set your print dialog to <span className="font-semibold">Actual size</span> (no scaling) and
          disable “Fit to page.”
        </div>
      </div>
    </div>
  );
}
