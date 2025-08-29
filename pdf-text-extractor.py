#!/usr/bin/env python3
"""
Enhanced Python PDF text extraction with better OCR preprocessing
This script extracts text from PDFs using multiple methods and advanced OCR
"""

import sys
import json
import os
import logging
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def install_required_packages():
    """Install required packages if not available"""
    try:
        import subprocess
        packages = ['multilingual-pdf2text', 'Pillow', 'pytesseract', 'opencv-python', 'pdf2image', 'PyPDF2']
        
        for package in packages:
            try:
                if package == 'opencv-python':
                    __import__('cv2')
                elif package == 'pdf2image':
                    __import__('pdf2image')
                elif package == 'pytesseract':
                    __import__('pytesseract')
                elif package == 'Pillow':
                    __import__('PIL')
                elif package == 'PyPDF2':
                    __import__('PyPDF2')
                else:
                    __import__(package.replace('-', '_'))
            except ImportError:
                logger.info(f"Installing {package}...")
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
                logger.info(f"Successfully installed {package}")
    except Exception as e:
        logger.error(f"Error installing packages: {e}")
        return False
    return True

def preprocess_image_for_ocr(image):
    """
    Preprocess image to improve OCR quality
    
    Args:
        image: PIL Image or numpy array
    
    Returns:
        Preprocessed image
    """
    try:
        import cv2
        import numpy as np
        from PIL import Image
        
        # Convert PIL to OpenCV if needed
        if isinstance(image, Image.Image):
            image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Apply adaptive thresholding for better text extraction
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Morphological operations to clean up the image
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 1))
        processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        # Resize image for better OCR (increase resolution if too small)
        height, width = processed.shape
        if height < 300 or width < 300:
            scale_factor = max(300 / height, 300 / width)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            processed = cv2.resize(processed, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
        
        return processed
        
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}, using original image")
        return image

def is_text_garbled(text):
    """
    Check if extracted text appears to be garbled/corrupted
    
    Args:
        text (str): Text to check
    
    Returns:
        bool: True if text appears garbled
    """
    if not text or len(text.strip()) < 10:
        return True
    
    # Count meaningful vs non-meaningful characters
    meaningful_chars = sum(1 for c in text if c.isalnum() or c.isspace() or c in '.,;:!?()-')
    total_chars = len(text)
    
    if total_chars == 0:
        return True
    
    meaningful_ratio = meaningful_chars / total_chars
    
    # Check for OCR artifacts (same as JavaScript version)
    has_excessive_spaces = '   ' in text or text.count(' ') > len(text) * 0.3
    has_random_caps = sum(1 for c in text if c.isupper()) > len(text) * 0.5
    has_repeated_chars = any(char * 5 in text for char in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    
    # Text is garbled if it has low meaningful ratio or OCR artifacts
    return meaningful_ratio < 0.7 or has_excessive_spaces or has_random_caps or has_repeated_chars

def extract_with_enhanced_ocr(pdf_path, language='eng'):
    """
    Extract text using enhanced OCR with image preprocessing
    
    Args:
        pdf_path (str): Path to the PDF file
        language (str): Language code for OCR
    
    Returns:
        str: Extracted text
    """
    try:
        import pytesseract
        from pdf2image import convert_from_path
        from PIL import Image
        
        logger.info(f"Using enhanced OCR extraction for: {pdf_path}")
        
        # Convert PDF to images with high DPI for better quality
        images = convert_from_path(pdf_path, dpi=300)
        
        extracted_text = ""
        
        for i, image in enumerate(images):
            logger.info(f"Processing page {i + 1}/{len(images)}")
            
            # Preprocess image for better OCR
            processed_image = preprocess_image_for_ocr(image)
            
            # Configure Tesseract for better accuracy
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,;:!?()[]{}+-=*/\\<>@#$%^&|~`"\' '
            
            # Extract text with multiple attempts for better accuracy
            try:
                # First attempt: Default settings
                page_text = pytesseract.image_to_string(processed_image, lang=language, config=custom_config)
                
                # If text is mostly garbled, try different PSM modes
                if is_text_garbled(page_text):
                    logger.info(f"Retrying page {i + 1} with different OCR settings")
                    
                    # Try PSM 3 (fully automatic page segmentation)
                    config_psm3 = r'--oem 3 --psm 3'
                    page_text_alt = pytesseract.image_to_string(processed_image, lang=language, config=config_psm3)
                    
                    # Use the better result
                    if len(page_text_alt) > len(page_text) and not is_text_garbled(page_text_alt):
                        page_text = page_text_alt
                
                extracted_text += page_text + "\n\n"
                
            except Exception as e:
                logger.warning(f"OCR failed for page {i + 1}: {e}")
                continue
        
        return extracted_text.strip()
        
    except Exception as e:
        logger.error(f"Enhanced OCR extraction failed: {e}")
        raise e

def post_process_extracted_text(text):
    """
    Post-process extracted text to clean up OCR artifacts
    
    Args:
        text (str): Raw extracted text
    
    Returns:
        str: Cleaned text
    """
    if not text:
        return text
    
    # Fix common OCR errors
    cleaned = text
    
    # Fix spacing issues
    cleaned = cleaned.replace('  ', ' ')  # Double spaces to single
    cleaned = cleaned.replace(' \n', '\n')  # Space before newline
    cleaned = cleaned.replace('\n ', '\n')  # Space after newline
    
    # Fix broken words (common in OCR)
    import re
    
    # Fix hyphenated words split across lines
    cleaned = re.sub(r'([a-z])-\s*\n\s*([a-z])', r'\1\2', cleaned)
    
    # Fix words split without hyphen
    cleaned = re.sub(r'([a-z])\s*\n\s*([a-z])', r'\1\2', cleaned)
    
    # Fix sentences split across lines
    cleaned = re.sub(r'([a-z,])\s*\n\s*([a-z])', r'\1 \2', cleaned)
    
    # Remove excessive line breaks
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    
    # Clean up common OCR character substitutions
    ocr_fixes = {
        'rn': 'm',  # Common OCR error
        'vv': 'w',  # Another common error
        '0': 'O',   # Zero to O in text context
        '1': 'l',   # One to l in text context (context-dependent)
    }
    
    # Apply fixes carefully (only in obviously text contexts)
    for wrong, correct in ocr_fixes.items():
        # Use word boundaries to avoid false replacements
        pattern = r'\b' + re.escape(wrong) + r'\b'
        # Only replace if it's clearly in a text context
        if wrong in ['rn', 'vv'] and pattern in cleaned:
            cleaned = re.sub(pattern, correct, cleaned)
    
    return cleaned.strip()

def extract_text_from_pdf(pdf_path, language='eng'):
    """
    Extract text from PDF using multiple methods with fallback
    
    Args:
        pdf_path (str): Path to the PDF file
        language (str): Language code (default: 'eng')
    
    Returns:
        dict: Extracted text and metadata
    """
    try:
        logger.info(f"Extracting text from: {pdf_path}")
        
        # Check if file exists
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        extracted_text = ""
        extraction_method = "none"
        
        # Method 1: Try enhanced OCR first (best quality for scanned PDFs)
        try:
            logger.info("Attempting enhanced OCR extraction...")
            extracted_text = extract_with_enhanced_ocr(pdf_path, language)
            extraction_method = "enhanced_ocr"
            logger.info(f"Enhanced OCR successful: {len(extracted_text)} characters")
        except Exception as e:
            logger.warning(f"Enhanced OCR failed: {e}")
        
        # Method 2: Fallback to multilingual_pdf2text
        if not extracted_text or len(extracted_text.strip()) < 100:
            try:
                logger.info("Attempting multilingual_pdf2text extraction...")
                from multilingual_pdf2text.pdf2text import PDF2Text
                from multilingual_pdf2text.models.document_model.document import Document
                
                # Create document for extraction with configurations
                pdf_document = Document(
                    document_path=pdf_path,
                    language=language
                )
                
                # Initialize PDF2Text extractor
                pdf2text = PDF2Text(document=pdf_document)
                
                # Extract content
                content = pdf2text.extract()
                
                # Flatten the text content if it's a list of pages
                if isinstance(content, list):
                    combined_text = ""
                    for page_data in content:
                        if isinstance(page_data, dict) and 'text' in page_data:
                            combined_text += page_data['text'] + "\n\n"
                        elif isinstance(page_data, str):
                            combined_text += page_data + "\n\n"
                    content = combined_text.strip()
                elif not isinstance(content, str):
                    content = str(content)
                
                if len(content.strip()) > len(extracted_text.strip()):
                    extracted_text = content
                    extraction_method = "multilingual_pdf2text"
                    logger.info(f"Multilingual PDF2Text successful: {len(extracted_text)} characters")
                
            except Exception as e:
                logger.warning(f"Multilingual PDF2Text failed: {e}")
        
        # Method 3: Final fallback to basic PyPDF2
        if not extracted_text or len(extracted_text.strip()) < 50:
            try:
                logger.info("Attempting basic PDF extraction...")
                import PyPDF2
                
                with open(pdf_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    basic_text = ""
                    for page in pdf_reader.pages:
                        basic_text += page.extract_text() + "\n\n"
                
                if len(basic_text.strip()) > len(extracted_text.strip()):
                    extracted_text = basic_text
                    extraction_method = "pypdf2"
                    logger.info(f"Basic PDF extraction successful: {len(extracted_text)} characters")
                
            except Exception as e:
                logger.warning(f"Basic PDF extraction failed: {e}")
        
        # Apply post-processing to clean up the text
        if extracted_text:
            extracted_text = post_process_extracted_text(extracted_text)
        
        # Get file stats
        file_stats = os.stat(pdf_path)
        file_size = file_stats.st_size
        
        # Basic metadata
        filename = os.path.basename(pdf_path)
        
        result = {
            'success': True,
            'text': extracted_text,
            'metadata': {
                'filename': filename,
                'file_size': file_size,
                'language': language,
                'extraction_method': extraction_method,
                'text_length': len(extracted_text)
            }
        }
        
        logger.info(f"Successfully extracted {len(extracted_text)} characters from {filename} using {extraction_method}")
        return result
        
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return {
            'success': False,
            'error': str(e),
            'text': '',
            'metadata': {
                'filename': os.path.basename(pdf_path) if pdf_path else 'unknown',
                'file_size': 0,
                'language': language,
                'extraction_method': 'failed'
            }
        }

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'PDF file path is required as argument',
            'text': '',
            'metadata': {}
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else 'eng'
    
    # Install required packages if needed
    if not install_required_packages():
        print(json.dumps({
            'success': False,
            'error': 'Failed to install required packages',
            'text': '',
            'metadata': {}
        }))
        sys.exit(1)
    
    # Extract text
    result = extract_text_from_pdf(pdf_path, language)
    
    # Output result as JSON
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
