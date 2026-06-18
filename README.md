# Doc Editor — PDF Editor

A Next.js serverless web app for editing any PDF: upload, annotate, save changes, and download the updated file.

## Features

- **Upload** — drag-and-drop or file picker for any PDF
- **Edit** — add text, highlights, and freehand drawings on any page
- **Save** — persists edits via a serverless API route (`/api/pdf/export`)
- **Download** — export the annotated PDF to your device

## Tools

| Tool | Action |
|------|--------|
| Select | Double-click an annotation to delete it |
| Text | Click to place text on the page |
| Highlight | Drag to create a highlight box |
| Draw | Freehand pen strokes |
| Eraser | Click annotations to remove them |

Use **Prev / Next** to switch the active page (only the highlighted page receives edits).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel)

```bash
npm run build
```

The export API runs as a serverless function on Vercel. PDF processing uses `pdf-lib` on the server; the client uses `pdfjs-dist` for rendering.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router, serverless API routes)
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [pdf-lib](https://pdf-lib.js.org/) — merge annotations into the PDF

## Project structure

```
src/
  app/
    api/pdf/export/route.ts   # Serverless PDF export
    page.tsx
  components/pdf/             # Editor UI
  lib/pdf/                    # PDF load, render, export
  types/annotations.ts
```
