export interface WordExtractionResult {
  text: string;
  processingTime: number;
  extractionMethod: string;
  fileType: 'doc' | 'docx';
  textLength: number;
  paragraphCount?: number; // Only available for .docx files
  tableCount?: number;     // Only available for .docx files
}

export interface WordExtractorInfo {
  formats: string[];
  library: string;
  version: string;
  docReader: string;
  docxReader: string;
}

export interface WordTestResult {
  poiAvailable: boolean;
  status: string;
  hwpfVersion: string;
  xwpfVersion: string;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    WordTextExtractorModule: {
      /**
       * Extract text from a .doc file using Apache POI HWPF
       * @param docPath Absolute path to the .doc file
       * @returns Promise with extraction result
       */
      extractTextFromDocFile(docPath: string): Promise<WordExtractionResult>;

      /**
       * Extract text from a .docx file using Apache POI XWPF
       * @param docxPath Absolute path to the .docx file
       * @returns Promise with extraction result
       */
      extractTextFromDocxFile(docxPath: string): Promise<WordExtractionResult>;

      /**
       * Extract text from a Word document (auto-detects .doc or .docx)
       * @param filePath Absolute path to the Word document
       * @returns Promise with extraction result
       */
      extractTextFromWordDocument(filePath: string): Promise<WordExtractionResult>;

      /**
       * Copy a content URI to internal storage
       * @param uriString Content URI string
       * @returns Promise with the internal storage path
       */
      copyContentUriToInternalStorage(uriString: string): Promise<string>;

      /**
       * Get information about supported Word document formats
       * @returns Promise with supported formats info
       */
      getSupportedFormats(): Promise<WordExtractorInfo>;

      /**
       * Test Word extraction functionality
       * @returns Promise with test result
       */
      testWordExtraction(): Promise<WordTestResult>;
    };
  }
}
