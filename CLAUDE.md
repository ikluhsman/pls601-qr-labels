# pls601-qr-labels

React + Express + SQLite app for allocating and printing QR codes on Avery PLS601 label sheets (7×9 grid, 63 per page, 1"×1").

## Stack
- React 18 + Vite + Tailwind CSS v3 (orange/zinc theme, dark mode via `class` strategy)
- Express API on port 4000
- SQLite for label allocation tracking (`DB_PATH` env, default `/data/labels.db`)
- pdf-lib for PDF generation
- Docker/docker-compose deploy — image: `registry.kluhsman.com/pls-qr:1.0.0`

## Label format
- Prefix (1–3 alphanumeric chars) + 5-digit zero-padded number
- Example: `ASN00001`, `ASN00042`, `T00001`
- Max 99,999 labels per prefix

## PDF layout constants (calibrated — do not change without calibration prints)
Located in `server/server.js`:
- `LABEL = 72` (1 inch in points)
- `COLS = 7`, `ROWS = 9`, `LABELS_PER_PAGE = 63`
- `MARGIN_L = 22.68`, `MARGIN_T = 35.43`
- `GAP_X = 8.97`, `GAP_Y = 8.50`

## Paperless-ngx integration
This app is used to print ASN barcode labels for Technicom's paperless-ngx instance.

**Prefix to use:** `ASN` — generates codes like `ASN00001`, `ASN00042`, which match the
format paperless-ngx expects for barcode-based ASN assignment (`PAPERLESS_CONSUMER_ENABLE_BARCODES=true`).

**Workflow:**
1. Allocate a batch with prefix `ASN`
2. Print the sheet (Avery PLS601, 1"×1" labels)
3. For documents going through the scanner with the label attached — paperless-ngx reads the barcode and assigns that ASN automatically
4. For irreplaceable originals (deeds, stock certificates, notarized docs) — affix label to the folder or sleeve, not the document face; note the ASN from paperless-ngx after scanning and print the matching label

**Do not use `PAPERLESS_AUTO_ASSIGN_ASN=true`** — only documents with a physical label should get an ASN. Recurring docs (invoices, receipts, statements) have no physical label and should have no ASN.

## API
- `POST /api/allocate-batch` — `{ prefix, count }` → `{ codes: [...] }`
- `POST /api/generate-sheet` — `{ codes, startIndex }` → PDF blob
- `GET /api/test-grid` → calibration PDF
- `GET /api/health` → `{ status: "ok" }`

## Running standalone for testing
```
sudo docker run -d --name pls-qr-test -p 0.0.0.0:4001:4000 registry.kluhsman.com/pls-qr:1.0.0
sudo docker rm -f pls-qr-test
```
Access at http://172.30.3.130:4001
