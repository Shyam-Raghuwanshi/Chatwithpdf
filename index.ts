// PDF Text Extractor Module Exports
export { default as PdfTextExtractor } from './utils/PdfTextExtractor';
export { default as testPdfTextExtractor } from './tests/testPdfTextExtractor';
export { default as PdfTextExtractorExample } from './examples/PdfTextExtractorExample';

// Type exports
export type {
  PdfExtractionResult,
  PdfMetadata,
  PdfInfoResult,
} from './types/PdfTextExtractor';

// Native module direct access (if needed)
import { NativeModules } from 'react-native';
export const { PdfTextExtractorModule } = NativeModules;
