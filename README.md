# PLS601 QR Label Sheet Generator

A lightweight React web application for generating sequential QR code
labels formatted specifically for **Premium Label Supply PLS601** (1" ×
1", 63 labels per US Letter sheet).

This tool is designed for deterministic barcode generation in structured
document workflows (e.g., Paperless-ngx ingestion systems).

This app was "vibe coded" with ChatGPT. I did not write this README or the react code, but I've used it. I will likely style it out a bit more in the future and galvanize the README.

------------------------------------------------------------------------

## Features

-   Generate sequential codes (e.g., `T-006519`)
-   Fixed-width 6-digit numbering
-   QR code generation with configurable error correction
-   Precise layout for **PLS601 (7 columns × 9 rows)**
-   Skip-label support for partially used sheets
-   Adjustable X/Y print offsets
-   Human-readable text under QR (optional)
-   CSV export for Git-based barcode registry
-   CSV import to auto-detect next available number
-   Print-ready PDF output (Letter, no scaling)

------------------------------------------------------------------------

## Label Specification

Hardcoded geometry for:

-   **Product:** PLS601\
-   **Label size:** 1" × 1"\
-   **Sheet size:** US Letter (8.5" × 11")\
-   **Grid:** 7 columns × 9 rows\
-   **Total labels:** 63\
-   **Pitch:** 1.125"\
-   **Gap:** 0.125"

If you use a different label format, geometry constants will need
adjustment.

------------------------------------------------------------------------

## Installation

### 1. Create the React App (Vite)

``` bash
npm create vite@latest pls601-labels -- --template react
cd pls601-labels
npm install
```

### 2. Install Dependencies

``` bash
npm install pdf-lib qrcode
```

### 3. Replace `src/App.jsx`

Replace the contents of `src/App.jsx` with the provided application
code.

### 4. Start Development Server

``` bash
npm run dev
```

The app will typically be available at:

    http://localhost:5173

------------------------------------------------------------------------

## Usage

### Generate Labels

1.  Set prefix (e.g., `T`)
2.  Enter starting number (e.g., `6519`)
3.  Set count (max 63 minus skipped labels)
4.  Adjust skip if reusing a sheet
5.  Click **Generate printable PDF**

The PDF will download automatically.

------------------------------------------------------------------------

### Export Registry CSV

Click **Export CSV for Git registry** to generate a file:

    code,printed_at
    T-006519,2026-02-12T15:01:02.123Z
    ...

Commit this file to your Git repository as your barcode registry.

------------------------------------------------------------------------

### Import Existing Registry

Click **Import registry CSV** to:

-   Scan for the highest 6-digit code
-   Automatically set the next starting number

This prevents accidental reuse.

------------------------------------------------------------------------

## Printing Instructions

**Important:**

-   Print setting: **Actual Size / 100%**
-   Disable: **Fit to page**
-   Disable: Any scaling options

First print a calibration sheet on plain paper and align with a label
sheet before printing onto actual labels.

Use X/Y offset fields to correct minor printer drift (adjust in 1--3
point increments).

------------------------------------------------------------------------

## Recommended QR Settings

Default values are suitable for 1" labels:

-   QR size: `54 pt` (\~0.75")
-   Error correction: `M`
-   Text size: `7 pt`

If codes become unreadable:

-   Increase QR size slightly
-   Lower error correction level (if overly dense)
-   Ensure matte labels (no gloss)

------------------------------------------------------------------------

## Design Philosophy

-   Barcodes encode identity only (e.g., `T-006519`)
-   Document meaning (type, tags, correspondent) lives in the archive
    system
-   No document-type encoding inside barcode
-   Sequential, immutable namespace
-   No reuse of printed codes

This preserves flexibility while maintaining deterministic ingestion.

------------------------------------------------------------------------

## License

MIT License

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
