# Chatwithpdf

## Standalone PDF text extraction (Node.js)

This repo includes a tiny Node.js script to extract text from a PDF file without running the React Native app.

### Run

1. Make sure dependencies are installed.
2. Provide a path to a PDF file.

Example:

```
node scripts/extract-pdf-text.js /absolute/path/to/file.pdf
```

Notes:
- The script uses `pdf-parse`, so it runs in Node and does **not** depend on React Native native modules.
- For in-app extraction, use `PdfTextExtractor` inside the React Native runtime.
