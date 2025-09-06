/**
 * Simple Usage Examples for Enhanced PDF Text Extraction
 * Shows how to use the automatic OCR fallback system
 */

import { NativeModules } from 'react-native';
import EnhancedPdfTextExtractor from './utils/EnhancedPdfTextExtractor';

const { PdfTextExtractorModule } = NativeModules;

// Example 1: Simple extraction (automatically handles OCR fallback)
export const extractPdfTextSimple = async (pdfPath: string) => {
  try {
    // This single call automatically:
    // 1. Tries basic PDF text extraction first
    // 2. Detects if text is garbled/weird
    // 3. Falls back to OCR if needed
    // 4. Returns the best result
    const result = await EnhancedPdfTextExtractor.extractText(pdfPath);
    
    if (result.success) {
      console.log('✅ Text extracted successfully!');
      console.log('📄 Text length:', result.text.length);
      console.log('🔧 Method used:', result.metadata.extractionMethod);
      console.log('📝 Preview:', result.text.substring(0, 200) + '...');
      return result.text;
    } else {
      console.error('❌ Extraction failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('💥 Error:', error);
    return null;
  }
};

// Example 2: Extract from specific page (also with automatic fallback)
export const extractFromPage = async (pdfPath: string, pageNumber: number) => {
  try {
    const result = await EnhancedPdfTextExtractor.extractTextFromPage(pdfPath, pageNumber);
    
    if (result.success) {
      console.log(`✅ Page ${pageNumber} extracted successfully!`);
      console.log('🔧 Method used:', result.metadata.extractionMethod);
      return result.text;
    } else {
      console.error(`❌ Page ${pageNumber} extraction failed:`, result.error);
      return null;
    }
  } catch (error) {
    console.error('💥 Error:', error);
    return null;
  }
};

// Example 3: Force OCR (when you specifically want OCR)
export const extractWithOCROnly = async (pdfPath: string, language = 'eng') => {
  try {
    const result = await EnhancedPdfTextExtractor.extractTextWithOCR(pdfPath, language);
    
    if (result.success) {
      console.log('✅ OCR extraction successful!');
      console.log('🌐 Language:', language);
      return result.text;
    } else {
      console.error('❌ OCR extraction failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('💥 Error:', error);
    return null;
  }
};

// Example 4: Get quality assessment
export const getExtractionQuality = async (pdfPath: string) => {
  try {
    const result = await EnhancedPdfTextExtractor.extractTextWithQualityAssessment(pdfPath);
    
    if (result.success) {
      console.log('✅ Quality assessment complete!');
      console.log('📊 Quality score:', result.qualityScore.toFixed(2));
      console.log('🎯 Recommended method:', result.recommendedMethod);
      console.log('🔧 Method used:', result.metadata.extractionMethod);
      
      // Interpret quality score
      if (result.qualityScore > 0.8) {
        console.log('🌟 Excellent quality text!');
      } else if (result.qualityScore > 0.6) {
        console.log('👍 Good quality text');
      } else if (result.qualityScore > 0.4) {
        console.log('⚠️ Fair quality - may need review');
      } else {
        console.log('❌ Poor quality - likely issues');
      }
      
      return {
        text: result.text,
        quality: result.qualityScore,
        method: result.metadata.extractionMethod
      };
    } else {
      console.error('❌ Quality assessment failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('💥 Error:', error);
    return null;
  }
};

// Example 5: Process multiple PDFs
export const processMultiplePDFs = async (pdfPaths: string[]) => {
  try {
    console.log(`🔄 Processing ${pdfPaths.length} PDFs...`);
    
    const results = await EnhancedPdfTextExtractor.extractTextFromMultiplePDFs(pdfPaths, {
      concurrency: 2 // Process 2 at a time to avoid memory issues
    });
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successfully processed: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    // Show summary
    successful.forEach((result, index) => {
      console.log(`📄 ${result.pdfPath}: ${result.text.length} chars (${result.metadata.extractionMethod})`);
    });
    
    if (failed.length > 0) {
      console.log('❌ Failed files:');
      failed.forEach((result) => {
        console.log(`📄 ${result.pdfPath}: ${result.error}`);
      });
    }
    
    return {
      successful: successful.map(r => ({ path: r.pdfPath, text: r.text, method: r.metadata.extractionMethod })),
      failed: failed.map(r => ({ path: r.pdfPath, error: r.error }))
    };
  } catch (error) {
    console.error('💥 Error processing multiple PDFs:', error);
    return null;
  }
};

// Example 6: Using the native module directly (lower level)
export const extractWithNativeModule = async (pdfPath: string) => {
  try {
    // This is the direct native module call
    // It automatically handles OCR fallback internally
    const resultJson = await PdfTextExtractorModule.extractPdfText(pdfPath);
    const result = JSON.parse(resultJson);
    
    if (result.success) {
      console.log('✅ Native extraction successful!');
      console.log('🔧 Method used:', result.metadata.extractionMethod);
      return result.text;
    } else {
      console.error('❌ Native extraction failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('💥 Error:', error);
    return null;
  }
};

// Example 7: Check if text looks garbled (utility function)
export const checkTextQuality = (text: string) => {
  const isGarbled = EnhancedPdfTextExtractor.isTextGarbled(text);
  
  console.log('📝 Text sample:', text.substring(0, 100) + '...');
  console.log('🔍 Is garbled:', isGarbled ? 'YES' : 'NO');
  
  return !isGarbled;
};

// Example usage in a React component:
/*
import { extractPdfTextSimple } from './PdfExtractionExamples';

const MyComponent = () => {
  const handlePdfExtraction = async (pdfUri: string) => {
    const text = await extractPdfTextSimple(pdfUri);
    if (text) {
      // Use the extracted text
      console.log('Extracted text:', text);
    }
  };

  // ... rest of component
};
*/
