#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const inputPath = process.argv[2];

if (!inputPath) {
      console.error('Usage: node scripts/extract-pdf-text.js <absolute-or-relative-pdf-path>');
      process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), inputPath);

if (!fs.existsSync(resolvedPath)) {
      console.error(`File not found: ${resolvedPath}`);
      process.exit(1);
}

const fileBuffer = fs.readFileSync(resolvedPath);

pdf(fileBuffer)
      .then((data) => {
            if (data?.text) {
                  fs.writeFileSync
                  fs.writeFileSync(`./pdfData/${data.info.Title}.txt`, data.text.trim())
            } else {
                  console.log('No text extracted.');
            }
      })
      .catch((error) => {
            console.error(`Failed to extract PDF text: ${error?.message || error}`);
            process.exit(1);
      });
