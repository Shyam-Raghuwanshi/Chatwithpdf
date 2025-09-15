import { NativeModules } from 'react-native';
import type { WordExtractionResult, WordExtractorInfo, WordTestResult } from '../types/WordTextExtractor';

const { WordTextExtractorModule } = NativeModules;

class WordTextExtractor {
  /**
   * Extract text from a Word document (.doc or .docx)
   * Automatically detects the file format and uses the appropriate extractor
   */
  static async extractText(filePath: string): Promise<WordExtractionResult> {
    if (!WordTextExtractorModule) {
      throw new Error('WordTextExtractorModule is not available. Make sure the native module is properly linked.');
    }

    try {
      const result = await WordTextExtractorModule.extractTextFromWordDocument(filePath);
      console.log(`Word text extraction completed: ${result.textLength} characters extracted using ${result.extractionMethod}`);
      return result;
    } catch (error: any) {
      console.error('Word text extraction failed:', error);
      throw new Error(`Failed to extract text from Word document: ${error.message}`);
    }
  }

  /**
   * Extract text specifically from a .doc file
   */
  static async extractTextFromDoc(filePath: string): Promise<WordExtractionResult> {
    if (!WordTextExtractorModule) {
      throw new Error('WordTextExtractorModule is not available.');
    }

    try {
      return await WordTextExtractorModule.extractTextFromDocFile(filePath);
    } catch (error: any) {
      console.error('.doc text extraction failed:', error);
      throw new Error(`Failed to extract text from .doc file: ${error.message}`);
    }
  }

  /**
   * Extract text specifically from a .docx file
   */
  static async extractTextFromDocx(filePath: string): Promise<WordExtractionResult> {
    if (!WordTextExtractorModule) {
      throw new Error('WordTextExtractorModule is not available.');
    }

    try {
      return await WordTextExtractorModule.extractTextFromDocxFile(filePath);
    } catch (error: any) {
      console.error('.docx text extraction failed:', error);
      throw new Error(`Failed to extract text from .docx file: ${error.message}`);
    }
  }

  /**
   * Copy a content URI to internal storage for processing
   */
  static async copyContentUriToInternalStorage(uriString: string): Promise<string> {
    if (!WordTextExtractorModule) {
      throw new Error('WordTextExtractorModule is not available.');
    }

    try {
      const internalPath = await WordTextExtractorModule.copyContentUriToInternalStorage(uriString);
      console.log(`Word document copied to internal storage: ${internalPath}`);
      return internalPath;
    } catch (error: any) {
      console.error('Failed to copy Word document to internal storage:', error);
      throw new Error(`Failed to copy document: ${error.message}`);
    }
  }

  /**
   * Get information about supported Word document formats
   */
  static async getSupportedFormats(): Promise<WordExtractorInfo> {
    if (!WordTextExtractorModule) {
      throw new Error('WordTextExtractorModule is not available.');
    }

    try {
      return await WordTextExtractorModule.getSupportedFormats();
    } catch (error: any) {
      console.error('Failed to get supported formats:', error);
      throw new Error(`Failed to get supported formats: ${error.message}`);
    }
  }

  /**
   * Test the Word extraction functionality
   */
  static async testExtraction(): Promise<WordTestResult> {
    if (!WordTextExtractorModule) {
      throw new Error('WordTextExtractorModule is not available.');
    }

    try {
      return await WordTextExtractorModule.testWordExtraction();
    } catch (error: any) {
      console.error('Word extraction test failed:', error);
      throw new Error(`Word extraction test failed: ${error.message}`);
    }
  }

  /**
   * Check if a file is a supported Word document
   */
  static isSupportedWordFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
  }

  /**
   * Get the file type from filename
   */
  static getWordFileType(fileName: string): 'doc' | 'docx' | null {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.doc')) return 'doc';
    if (lowerName.endsWith('.docx')) return 'docx';
    return null;
  }

  /**
   * Validate if the module is available
   */
  static isAvailable(): boolean {
    return !!WordTextExtractorModule;
  }
}

export default WordTextExtractor;
