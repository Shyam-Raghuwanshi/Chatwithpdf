// PdfTextExtractor.d.ts
declare module 'react-native' {
  interface NativeModulesStatic {
    PdfTextExtractorModule: {
      /**
       * Extract text using Textricator-inspired multi-strategy approach
       * @param pdfPath - Absolute path to the PDF file
       * @returns Promise that resolves to enhanced extraction result
       */
      extractTextWithTextricatorApproach(pdfPath: string): Promise<{
        text: string;
        processingTime: number;
        pageCount: number;
        extractionMethod: string;
        segmentCount: number;
        segments: Array<{
          text: string;
          x: number;
          y: number;
          width: number;
          height: number;
          page: number;
          confidence: number;
        }>;
      }>;
      
      /**
       * Extract text from entire PDF using fast Google ML Kit OCR (ALL pages)
       * @param pdfPath - Absolute path to the PDF file
       * @returns Promise that resolves to extraction result object
       */
      extractTextWithFastOCR(pdfPath: string): Promise<{
        text: string;
        processingTime: number;
        pageCount: number;
        extractionMethod: string;
        segmentCount: number;
        totalPages: number;
      }>;
      
      /**
       * Extract text from PDF using extended OCR with custom page limit
       * @param pdfPath - Absolute path to the PDF file
       * @param maxPages - Maximum number of pages to process (set to total pages to process all)
       * @returns Promise that resolves to extraction result object
       */
      extractTextWithExtendedOCR(pdfPath: string, maxPages: number): Promise<{
        text: string;
        processingTime: number;
        pageCount: number;
        extractionMethod: string;
        segmentCount: number;
        totalPages: number;
      }>;
      
      /**
       * Extract text from entire PDF (alias for extractTextWithFastOCR)
       * @param pdfPath - Absolute path to the PDF file
       * @returns Promise that resolves to extraction result object
       */
      extractTextFromPdf(pdfPath: string): Promise<{
        text: string;
        processingTime: number;
        pageCount: number;
      }>;
      
      /**
       * Extract text from entire PDF (with OCR fallback if needed)
       * @param pdfPath - Absolute path to the PDF file
       * @returns Promise that resolves to JSON string with extraction result
       */
      extractPdfText(pdfPath: string): Promise<string>;
      
      /**
       * Extract text from entire PDF using advanced OCR
       * @param pdfPath - Absolute path to the PDF file
       * @param language - OCR language code (default: 'eng')
       * @returns Promise that resolves to JSON string with extraction result
       */
      extractPdfTextWithAdvancedOCR(pdfPath: string, language?: string): Promise<string>;
      
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
      
      /**
       * Copy content URI to internal storage
       * @param contentUri - Content URI from document picker
       * @returns Promise that resolves to the copied file path
       */
      copyContentUriToInternalStorage(contentUri: string): Promise<string>;
      
      /**
       * Create a test PDF with readable text and extract text from it
       * @returns Promise that resolves to extraction result
       */
      createTestPdfAndExtract(): Promise<{
        text: string;
        processingTime: number;
        pageCount: number;
        extractionMethod: string;
        segmentCount: number;
        testPdfPath: string;
      }>;
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
  source?: string;
  originalPath?: string;
  extractionMethod?: 'basic' | 'enhanced_ocr' | 'multilingual_pdf2text' | 'pypdf2';
  ocrLanguage?: string;
  textLength?: number;
  error?: string;
}

export interface PdfInfoResult {
  success: boolean;
  metadata: PdfMetadata;
  error: string;
}

export interface OCRConfig {
  language: string;
  preprocessImage: boolean;
  useMultiplePSM: boolean;
  postProcessText: boolean;
}

export type ExtractionMethod = 'auto' | 'basic' | 'ocr_only' | 'enhanced_ocr';
