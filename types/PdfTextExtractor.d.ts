// PdfTextExtractor.d.ts
declare module 'react-native' {
  interface NativeModulesStatic {
    PdfTextExtractorModule: {
      /**
       * Extract text from entire PDF
       * @param pdfPath - Absolute path to the PDF file
       * @returns Promise that resolves to JSON string with extraction result
       */
      extractPdfText(pdfPath: string): Promise<string>;
      
      /**
       * Extract text from a specific page
       * @param pdfPath - Absolute path to the PDF file
       * @param pageNumber - Page number (1-indexed)
       * @returns Promise that resolves to JSON string with extraction result
       */
      extractPdfTextFromPage(pdfPath: string, pageNumber: number): Promise<string>;
      
      /**
       * Get PDF metadata and information
       * @param pdfPath - Absolute path to the PDF file
       * @returns Promise that resolves to JSON string with PDF info
       */
      getPdfInfo(pdfPath: string): Promise<string>;
      
      /**
       * Copy asset from bundle to internal storage
       * @param assetFileName - Name of the asset file
       * @returns Promise that resolves to the copied file path
       */
      copyAssetToInternalStorage(assetFileName: string): Promise<string>;
    };
  }
}

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  error: string;
  metadata: PdfMetadata;
  page?: number;
}

export interface PdfMetadata {
  numberOfPages?: number;
  pdfVersion?: string;
  fileSize?: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  isEncrypted?: boolean;
  securityType?: string;
  error?: string;
}

export interface PdfInfoResult {
  success: boolean;
  metadata: PdfMetadata;
  error: string;
}
