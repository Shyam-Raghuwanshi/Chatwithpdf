import { NativeModules } from 'react-native';
import type { PdfExtractionResult, PdfInfoResult } from '../types/PdfTextExtractor';

const { PdfTextExtractorModule } = NativeModules;

export class PdfTextExtractor {
  /**
   * Extract text from entire PDF using iText library
   * @param pdfPath - Absolute path to the PDF file
   * @returns Promise with extraction result
   */
  static async extractPdfText(pdfPath: string): Promise<PdfExtractionResult> {
    try {
      const resultJson = await PdfTextExtractorModule.extractPdfText(pdfPath);
      return JSON.parse(resultJson);
    } catch (error) {
      return {
        success: false,
        text: '',
        error: `Native module error: ${error}`,
        metadata: {}
      };
    }
  }

  /**
   * Extract text from a specific page using iText library
   * @param pdfPath - Absolute path to the PDF file
   * @param pageNumber - Page number (1-indexed)
   * @returns Promise with extraction result
   */
  static async extractPdfTextFromPage(pdfPath: string, pageNumber: number): Promise<PdfExtractionResult> {
    try {
      const resultJson = await PdfTextExtractorModule.extractPdfTextFromPage(pdfPath, pageNumber);
      return JSON.parse(resultJson);
    } catch (error) {
      return {
        success: false,
        text: '',
        error: `Native module error: ${error}`,
        metadata: {},
        page: pageNumber
      };
    }
  }

  /**
   * Get PDF metadata and information using iText library
   * @param pdfPath - Absolute path to the PDF file
   * @returns Promise with PDF info result
   */
  static async getPdfInfo(pdfPath: string): Promise<PdfInfoResult> {
    try {
      const resultJson = await PdfTextExtractorModule.getPdfInfo(pdfPath);
      return JSON.parse(resultJson);
    } catch (error) {
      return {
        success: false,
        metadata: {},
        error: `Native module error: ${error}`
      };
    }
  }

  /**
   * Copy PDF asset from app bundle to internal storage
   * @param assetFileName - Name of the asset file (e.g., 'sample.pdf')
   * @returns Promise with the copied file path
   */
  static async copyAssetToInternalStorage(assetFileName: string): Promise<string> {
    try {
      return await PdfTextExtractorModule.copyAssetToInternalStorage(assetFileName);
    } catch (error) {
      throw new Error(`Failed to copy asset: ${error}`);
    }
  }

  /**
   * Copy PDF from content URI to internal storage
   * @param contentUri - Content URI from document picker (e.g., 'content://...')
   * @returns Promise with the copied file path
   */
  static async copyContentUriToInternalStorage(contentUri: string): Promise<string> {
    try {
      return await PdfTextExtractorModule.copyContentUriToInternalStorage(contentUri);
    } catch (error) {
      throw new Error(`Failed to copy content URI: ${error}`);
    }
  }

  /**
   * Extract text from a PDF asset file
   * @param assetFileName - Name of the PDF asset file
   * @returns Promise with extraction result
   */
  static async extractFromAsset(assetFileName: string): Promise<PdfExtractionResult> {
    try {
      const copiedPath = await this.copyAssetToInternalStorage(assetFileName);
      return await this.extractPdfText(copiedPath);
    } catch (error) {
      return {
        success: false,
        text: '',
        error: `Asset extraction error: ${error}`,
        metadata: {}
      };
    }
  }

  /**
   * Check if PDF file exists and is readable
   * @param pdfPath - Absolute path to the PDF file
   * @returns Promise with validation result
   */
  static async validatePdfFile(pdfPath: string): Promise<{isValid: boolean, error?: string}> {
    try {
      const info = await this.getPdfInfo(pdfPath);
      return {
        isValid: info.success,
        error: info.success ? undefined : info.error
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error}`
      };
    }
  }
}

export default PdfTextExtractor;
