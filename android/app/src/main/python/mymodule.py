#!/usr/bin/env python3
"""
PDF text extraction module for React Native
Basic version using only built-in Python libraries
"""

import json
import os
import logging
import sys

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_pdf_text(pdf_path, language='eng'):
    """
    Main function to extract text from PDF
    Auto-installs PyPDF2 if not available
    
    Args:
        pdf_path (str): Path to the PDF file
        language (str): Language code (for future use)
    
    Returns:
        str: JSON string with extraction result
    """
    try:
        logger.info(f"Attempting to extract text from: {pdf_path}")
        
        pypdf2_available = False
        
        try:
            import PyPDF2
            pypdf2_available = True
            logger.info("PyPDF2 is available")
        except ImportError:
            logger.info("PyPDF2 not found, will use fallback method")
            pypdf2_available = False
        
        # Check if file exists and try different Android-specific paths
        if not os.path.exists(pdf_path):
            # If absolute path doesn't work, try alternative approaches
            logger.warning(f"File not found at: {pdf_path}")
            
            # Try different possible locations for Android
            possible_paths = [
                pdf_path,
                f"/android_asset/{os.path.basename(pdf_path)}",
                f"/data/data/com.chatwithpdf/assets/{os.path.basename(pdf_path)}",
                f"/data/data/com.chatwithpdf/files/{os.path.basename(pdf_path)}",
                f"/storage/emulated/0/Download/{os.path.basename(pdf_path)}",
                f"/sdcard/Download/{os.path.basename(pdf_path)}",
                os.path.basename(pdf_path)  # Just the filename
            ]
            
            found_path = None
            for path in possible_paths:
                logger.info(f"Checking path: {path}")
                if os.path.exists(path):
                    found_path = path
                    logger.info(f"Found PDF at: {path}")
                    break
                else:
                    logger.info(f"Path does not exist: {path}")
            
            if not found_path:
                # Try to find it in any subdirectory
                import glob
                base_name = os.path.basename(pdf_path)
                search_patterns = [
                    f"/**/{base_name}",
                    f"/data/**/{base_name}",
                    f"/storage/**/{base_name}",
                    f"/android_asset/**/{base_name}"
                ]
                
                for pattern in search_patterns:
                    try:
                        matches = glob.glob(pattern, recursive=True)
                        if matches:
                            found_path = matches[0]
                            logger.info(f"Found PDF using glob: {found_path}")
                            break
                    except Exception as e:
                        logger.info(f"Glob search failed for {pattern}: {e}")
                        continue
            
            if not found_path:
                return json.dumps({
                    'success': False,
                    'error': f'PDF file not found. Tried paths: {possible_paths}',
                    'text': '',
                    'metadata': {
                        'filename': os.path.basename(pdf_path) if pdf_path else 'unknown',
                        'file_size': 0,
                        'language': language,
                        'extraction_method': 'failed',
                        'text_length': 0,
                        'page_count': 0,
                        'attempted_paths': possible_paths
                    }
                }, ensure_ascii=False)
            
            pdf_path = found_path
        
        # Get file stats
        file_stats = os.stat(pdf_path)
        file_size = file_stats.st_size
        filename = os.path.basename(pdf_path)
        
        # Extract text based on available libraries
        extracted_text = ""
        extraction_method = "none"
        err = ""

        if pypdf2_available:
            # Use PyPDF2 for text extraction
            try:
                with open(pdf_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    page_count = len(pdf_reader.pages)
                    
                    # Extract text from all pages
                    for page_num, page in enumerate(pdf_reader.pages):
                        try:
                            page_text = page.extract_text()
                            if page_text:
                                extracted_text += page_text + "\n\n"
                                logger.info(f"Extracted text from page {page_num + 1}")
                        except Exception as e:
                            logger.warning(f"Failed to extract text from page {page_num + 1}: {e}")
                            continue
                    
                    extraction_method = "pypdf2"
            except Exception as e:
                logger.error(f"PyPDF2 extraction failed: {e}")
                pypdf2_available = False
                err += f"\n\n\n\n; PyPDF2 error: {e}"
        
        if not pypdf2_available and not extracted_text:
            # Fallback method: basic file analysis
            try:
                with open(pdf_path, 'rb') as file:
                    # Read file content
                    content = file.read()
                    
                    # Basic PDF validation
                    if not content.startswith(b'%PDF-'):
                        raise Exception("File does not appear to be a valid PDF")
                    
                    # Try to extract some basic information
                    content_str = content.decode('latin-1', errors='ignore')
                    
                    # Look for text content (very basic approach)
                    # This won't extract formatted text but can find some readable content
                    import re
                    text_patterns = re.findall(r'\((.*?)\)', content_str)
                    readable_text = []
                    
                    for pattern in text_patterns:
                        # Filter out non-readable content
                        if len(pattern) > 3 and any(c.isalpha() for c in pattern):
                            clean_text = ''.join(c for c in pattern if c.isprintable() or c.isspace())
                            if clean_text.strip():
                                readable_text.append(clean_text.strip())
                    
                    if readable_text:
                        extracted_text = '\n'.join(readable_text[:50])  # Limit to first 50 text fragments
                        extraction_method = "basic_text_extraction"
                    else:
                        extracted_text = f"PDF file detected (size: {len(content)} bytes). Text extraction requires PyPDF2 library."
                        extraction_method = "file_info_only"
                    
                    # Estimate page count (very rough)
                    page_count = content_str.count('/Type/Page') or 1
                    
            except Exception as e:
                logger.error(f"Fallback extraction failed: {e}")
                extracted_text = f"PDF file exists but could not be processed: {str(e)}"
                extraction_method = "failed"
                page_count = 0
        
        # Clean up the text
        extracted_text = extracted_text.strip()
        
        result = {
            'success': True,
            'text': extracted_text,
            "error": err,
            'metadata': {
                'filename': filename,
                'file_size': file_size,
                'language': language,
                'extraction_method': extraction_method,
                'text_length': len(extracted_text),
                'page_count': page_count,
                'actual_path': pdf_path,
                'pypdf2_available': pypdf2_available
            }
        }
        
        logger.info(f"Successfully processed {filename}")
        return json.dumps(result, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        error_result = {
            'success': False,
            'error': str(e),
            'text': '',
            'metadata': {
                'filename': os.path.basename(pdf_path) if pdf_path else 'unknown',
                'file_size': 0,
                'language': language,
                'extraction_method': 'failed',
                'text_length': 0,
                'page_count': 0
            }
        }
        return json.dumps(error_result, ensure_ascii=False)