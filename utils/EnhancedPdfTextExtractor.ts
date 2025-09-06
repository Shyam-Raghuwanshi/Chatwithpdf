import { NativeModules } from 'react-native';
import { PdfExtractionResult, PdfMetadata, PdfInfoResult, OCRConfig, ExtractionMethod } from '../types/PdfTextExtractor';

const { PdfTextExtractorModule } = NativeModules;

/**
 * Enhanced PDF Text Extractor with automatic OCR fallback
 * The system automatically detects garbled text and switches to OCR when needed
 */
export class EnhancedPdfTextExtractor {
  
  /**
   * Extract text from PDF with automatic OCR fallback
   * This is the main method - it automatically handles method selection
   */
  static async extractText(pdfPath: string): Promise<PdfExtractionResult> {
    try {
      // The Kotlin module now handles OCR fallback automatically
      const resultJson = await PdfTextExtractorModule.extractPdfText(pdfPath);
      const result: PdfExtractionResult = JSON.parse(resultJson);
      
      // Additional post-processing if needed
      if (result.success && result.text) {
        result.text = this.postProcessText(result.text);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        text: '',
        error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {}
      };
    }
  }

  /**
   * Extract text from a specific page with automatic OCR fallback
   */
  static async extractTextFromPage(
    pdfPath: string, 
    pageNumber: number
  ): Promise<PdfExtractionResult> {
    try {
      // The Kotlin module now handles OCR fallback automatically for pages too
      const resultJson = await PdfTextExtractorModule.extractPdfTextFromPage(pdfPath, pageNumber);
      const result: PdfExtractionResult = JSON.parse(resultJson);
      
      if (result.success && result.text) {
        result.text = this.postProcessText(result.text);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        text: '',
        error: `Page extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {},
        page: pageNumber
      };
    }
  }

  /**
   * Force OCR extraction (for when you specifically want OCR)
   * This bypasses the automatic fallback and goes straight to OCR
   */
  static async extractTextWithOCR(
    pdfPath: string, 
    language: string = 'eng'
  ): Promise<PdfExtractionResult> {
    try {
      // Use the advanced OCR method directly
      const resultJson = await PdfTextExtractorModule.extractPdfTextWithAdvancedOCR(pdfPath, language);
      const result: PdfExtractionResult = JSON.parse(resultJson);
      
      if (result.success && result.text) {
        result.text = this.postProcessText(result.text);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        text: '',
        error: `OCR extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {}
      };
    }
  }

  /**
   * Get PDF information and metadata
   */
  static async getPdfInfo(pdfPath: string): Promise<PdfInfoResult> {
    try {
      const resultJson = await PdfTextExtractorModule.getPdfInfo(pdfPath);
      return JSON.parse(resultJson);
    } catch (error) {
      return {
        success: false,
        metadata: {},
        error: `Failed to get PDF info: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract text with quality assessment
   * Returns extraction quality score and method used
   */
  static async extractTextWithQualityAssessment(
    pdfPath: string
  ): Promise<PdfExtractionResult & { qualityScore: number; recommendedMethod: ExtractionMethod }> {
    // Use the automatic extraction (which now includes OCR fallback)
    const result = await this.extractText(pdfPath);
    
    if (result.success) {
      const qualityScore = this.assessTextQuality(result.text);
      const methodUsed = result.metadata.extractionMethod || 'basic';
      
      return {
        ...result,
        qualityScore,
        recommendedMethod: methodUsed as ExtractionMethod
      };
    }
    
    // If extraction failed, return minimal result
    return {
      ...result,
      qualityScore: 0,
      recommendedMethod: 'basic'
    };
  }

  /**
   * Batch extract text from multiple PDFs
   */
  static async extractTextFromMultiplePDFs(
    pdfPaths: string[],
    options: {
      concurrency?: number;
    } = {}
  ): Promise<Array<PdfExtractionResult & { pdfPath: string }>> {
    const { concurrency = 3 } = options;
    const results: Array<PdfExtractionResult & { pdfPath: string }> = [];
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < pdfPaths.length; i += concurrency) {
      const batch = pdfPaths.slice(i, i + concurrency);
      const batchPromises = batch.map(async (pdfPath) => {
        const result = await this.extractText(pdfPath);
        return { ...result, pdfPath };
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Copy asset to internal storage for processing
   */
  static async copyAssetToStorage(assetFileName: string): Promise<string> {
    try {
      return await PdfTextExtractorModule.copyAssetToInternalStorage(assetFileName);
    } catch (error) {
      throw new Error(`Failed to copy asset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Assess the quality of extracted text
   */
  private static assessTextQuality(text: string): number {
    if (!text || text.trim().length < 10) {
      return 0;
    }

    const totalChars = text.length;
    let score = 0;

    // Check character distribution
    const meaningfulChars = text.split('').filter(c => 
      /[a-zA-Z0-9\s.,;:!?()[\]{}'"@#$%^&*+=<>/\\|~`-]/.test(c)
    ).length;
    
    const meaningfulRatio = meaningfulChars / totalChars;
    score += meaningfulRatio * 0.4;

    // Check for proper word structure
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const properWords = words.filter(word => 
      /^[a-zA-Z0-9][a-zA-Z0-9.,;:!?'"()-]*[a-zA-Z0-9.,;:!?'"]?$/.test(word)
    ).length;
    
    if (words.length > 0) {
      const wordQuality = properWords / words.length;
      score += wordQuality * 0.3;
    }

    // Check for sentence structure
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 ? 
      sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length : 0;
    
    // Ideal sentence length is 10-30 words
    const sentenceScore = avgSentenceLength >= 5 && avgSentenceLength <= 50 ? 1 : 
      Math.max(0, 1 - Math.abs(avgSentenceLength - 15) / 15);
    score += sentenceScore * 0.2;

    // Check for excessive repetition or OCR artifacts
    const excessiveSpaces = (text.match(/\s{3,}/g) || []).length;
    const excessiveRepeats = /(.)\1{4,}/.test(text);
    const artifactPenalty = (excessiveSpaces + (excessiveRepeats ? 1 : 0)) * 0.1;
    score -= artifactPenalty;

    // Text length bonus (longer text generally indicates better extraction)
    const lengthBonus = Math.min(0.1, text.length / 10000);
    score += lengthBonus;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Post-process extracted text to improve quality
   */
  private static postProcessText(text: string): string {
    if (!text) return text;

    let processed = text;

    // Fix common spacing issues
    processed = processed.replace(/\s{2,}/g, ' '); // Multiple spaces to single
    processed = processed.replace(/\s+\n/g, '\n'); // Space before newline
    processed = processed.replace(/\n\s+/g, '\n'); // Space after newline

    // Fix broken words across lines
    processed = processed.replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2');
    processed = processed.replace(/([a-z])\s*\n\s*([a-z])/gi, '$1$2');

    // Fix sentence breaks
    processed = processed.replace(/([a-z,])\s*\n\s*([a-z])/gi, '$1 $2');

    // Clean up excessive line breaks
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // Fix common OCR character errors (contextual)
    const ocrFixes: [RegExp, string][] = [
      [/\brn\b/g, 'm'],      // 'rn' to 'm'
      [/\bvv\b/g, 'w'],      // 'vv' to 'w'
      [/\b1l\b/g, 'll'],     // '1l' to 'll'
      [/\bo0\b/g, 'oo'],     // 'o0' to 'oo'
    ];

    ocrFixes.forEach(([pattern, replacement]) => {
      processed = processed.replace(pattern, replacement);
    });

    return processed.trim();
  }

  /**
   * Check if text appears to be garbled or corrupted
   */
  static isTextGarbled(text: string): boolean {
    if (!text || text.trim().length < 10) {
      return true;
    }

    const qualityScore = this.assessTextQuality(text);
    return qualityScore < 0.3;
  }

  /**
   * Get supported OCR languages
   */
  static getSupportedLanguages(): string[] {
    return [
      'eng', // English
      'spa', // Spanish
      'fra', // French
      'deu', // German
      'ita', // Italian
      'por', // Portuguese
      'rus', // Russian
      'ara', // Arabic
      'hin', // Hindi
      'chi_sim', // Chinese Simplified
      'chi_tra', // Chinese Traditional
      'jpn', // Japanese
      'kor', // Korean
    ];
  }
}

export default EnhancedPdfTextExtractor;
