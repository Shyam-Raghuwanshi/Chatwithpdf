package com.chatwithpdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Log
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.util.concurrent.CountDownLatch

/**
 * Enhanced PDF text extractor inspired by Textricator
 * Combines multiple extraction strategies for optimal results
 */
class TextricatorInspiredExtractor(private val reactContext: ReactApplicationContext) {

    companion object {
        private const val TAG = "TextricatorInspiredExtractor"
    }

    data class TextSegment(
        val text: String,
        val x: Float,
        val y: Float,
        val width: Float,
        val height: Float,
        val fontSize: Float = 0f,
        val fontName: String = "",
        val page: Int = 0,
        val confidence: Float = 1.0f
    )

    data class ExtractionResult(
        val success: Boolean,
        val text: String,
        val segments: List<TextSegment>,
        val pageCount: Int,
        val processingTime: Long,
        val extractionMethod: String,
        val error: String? = null
    )

    /**
     * Multi-strategy text extraction inspired by Textricator's approach
     */
    fun extractTextWithMultipleStrategies(pdfPath: String): ExtractionResult {
        val startTime = System.currentTimeMillis()
        
        try {
            val file = File(pdfPath)
            if (!file.exists()) {
                Log.e(TAG, "PERFORMANCE ERROR: File not found at $pdfPath")
                return ExtractionResult(
                    success = false,
                    text = "",
                    segments = emptyList(),
                    pageCount = 0,
                    processingTime = 0,
                    extractionMethod = "none",
                    error = "File not found: $pdfPath"
                )
            }

            Log.d(TAG, "PERFORMANCE: Opening PDF file descriptor...")
            val fileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            
            if (fileDescriptor == null) {
                Log.e(TAG, "PERFORMANCE ERROR: Failed to open file descriptor")
                return ExtractionResult(
                    success = false,
                    text = "",
                    segments = emptyList(),
                    pageCount = 0,
                    processingTime = 0,
                    extractionMethod = "none",
                    error = "Failed to open file descriptor"
                )
            }
            
            Log.d(TAG, "PERFORMANCE: Creating PDF renderer...")
            val pdfRenderer = PdfRenderer(fileDescriptor)
            val pageCount = pdfRenderer.pageCount

            Log.d(TAG, "=== PERFORMANCE MONITOR: Processing $pageCount pages with multi-strategy extraction ===")

            // Strategy 1: Try extracting native text first (like Textricator's PDFBox approach)
            val nativeStart = System.currentTimeMillis()
            val nativeResult = tryNativeTextExtraction(pdfRenderer, pageCount)
            val nativeTime = System.currentTimeMillis() - nativeStart
            Log.d(TAG, "TIMING: Native extraction took ${nativeTime}ms")
            
            // Strategy 2: If native extraction yields poor results, use enhanced OCR
            val finalResult = if (shouldUseOCR(nativeResult)) {
                Log.d(TAG, "PERFORMANCE: Native text extraction insufficient (${nativeResult.text.length} chars), using enhanced OCR")
                val ocrStart = System.currentTimeMillis()
                val result = enhanceWithOCR(pdfRenderer, pageCount, nativeResult)
                val ocrTime = System.currentTimeMillis() - ocrStart
                Log.d(TAG, "TIMING: OCR enhancement took ${ocrTime}ms")
                result
            } else {
                Log.d(TAG, "PERFORMANCE: Native text extraction successful (${nativeResult.text.length} chars)")
                nativeResult
            }

            pdfRenderer.close()
            fileDescriptor.close()

            val processingTime = System.currentTimeMillis() - startTime
            Log.d(TAG, "=== PERFORMANCE SUMMARY: Total extraction took ${processingTime}ms (${processingTime/1000.0}s) ===")
            Log.d(TAG, "PERFORMANCE: Extracted ${finalResult.text.length} characters from ${finalResult.pageCount} pages")
            Log.d(TAG, "PERFORMANCE: Average time per page: ${if (finalResult.pageCount > 0) processingTime / finalResult.pageCount else 0}ms")
            
            return finalResult.copy(
                processingTime = processingTime
            )

        } catch (e: Exception) {
            Log.e(TAG, "Multi-strategy extraction failed", e)
            return ExtractionResult(
                success = false,
                text = "",
                segments = emptyList(),
                pageCount = 0,
                processingTime = System.currentTimeMillis() - startTime,
                extractionMethod = "error",
                error = e.message
            )
        }
    }

    /**
     * Try native text extraction first (similar to Textricator's approach)
     */
    private fun tryNativeTextExtraction(pdfRenderer: PdfRenderer, pageCount: Int): ExtractionResult {
        Log.d(TAG, "Attempting native text extraction")
        
        // For now, return empty result to force OCR
        // In a full implementation, we'd use a library like PDFBox or iText
        // but these are complex to integrate into Android
        return ExtractionResult(
            success = false,
            text = "",
            segments = emptyList(),
            pageCount = pageCount,
            processingTime = 0,
            extractionMethod = "native_unavailable"
        )
    }

    /**
     * Determine if we should use OCR based on native extraction results
     */
    private fun shouldUseOCR(nativeResult: ExtractionResult): Boolean {
        return !nativeResult.success || 
               nativeResult.text.length < 50 || 
               nativeResult.segments.isEmpty()
    }

    /**
     * Enhanced OCR with Textricator-inspired text positioning - OPTIMIZED FOR SPEED
     */
    private fun enhanceWithOCR(
        pdfRenderer: PdfRenderer, 
        pageCount: Int, 
        nativeResult: ExtractionResult
    ): ExtractionResult {
        
        val allSegments = mutableListOf<TextSegment>()
        val extractedText = StringBuilder()

        try {
            // OPTIMIZATION 1: Limit pages for faster processing
            val maxPagesToProcess = minOf(pageCount, 5) // Increased to 5 pages with optimizations
            Log.d(TAG, "SPEED OPTIMIZATION: Processing only $maxPagesToProcess of $pageCount pages")

            // DEBUGGING: Test ML Kit first with a simple test
            testMLKitFunctionality()

            // OPTIMIZATION 2: Process pages sequentially to avoid "Current page not closed" error
            Log.d(TAG, "ENHANCED OCR: Starting to process $maxPagesToProcess pages")
            
            for (pageIndex in 0 until maxPagesToProcess) {
                val pageStartTime = System.currentTimeMillis()
                var page: PdfRenderer.Page? = null
                var bitmap: Bitmap? = null
                
                try {
                    Log.d(TAG, "ENHANCED OCR: Opening page ${pageIndex + 1}/$maxPagesToProcess")
                    page = pdfRenderer.openPage(pageIndex)
                    
                    // OPTIMIZATION 3: Reduce resolution for faster OCR (balance speed vs accuracy)
                    val scaleFactor = 1.5f // Reduced from 2.0f for speed
                    val width = (page.width * scaleFactor).toInt()
                    val height = (page.height * scaleFactor).toInt()
                    
                    Log.d(TAG, "ENHANCED OCR: Creating bitmap ${width}x${height} for page $pageIndex")
                    bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
                    
                    val canvas = Canvas(bitmap)
                    canvas.drawColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    
                    Log.d(TAG, "ENHANCED OCR: Bitmap created and rendered for page $pageIndex")
                    
                    // OPTIMIZATION 4: Fast text extraction with timeout
                    val pageSegments = extractTextSegmentsFast(bitmap, pageIndex, scaleFactor)
                    
                    Log.d(TAG, "ENHANCED OCR: Got ${pageSegments.size} segments from page $pageIndex")
                    
                    // Sort segments by position (top-to-bottom, left-to-right like Textricator)
                    val sortedSegments = pageSegments.sortedWith(
                        compareBy<TextSegment> { it.y }.thenBy { it.x }
                    )
                    
                    allSegments.addAll(sortedSegments)
                    
                    // Combine text with proper spacing
                    val pageText = combineTextSegments(sortedSegments)
                    Log.d(TAG, "ENHANCED OCR: Combined text for page $pageIndex: '${pageText.take(100)}...' (${pageText.length} chars)")
                    
                    if (pageText.isNotEmpty()) {
                        if (extractedText.isNotEmpty()) {
                            extractedText.append("\n\n")
                        }
                        extractedText.append(pageText)
                    }
                    
                    val pageTime = System.currentTimeMillis() - pageStartTime
                    Log.d(TAG, "ENHANCED OCR: Page ${pageIndex + 1}/$maxPagesToProcess: ${sortedSegments.size} segments, ${pageText.length} chars (${pageTime}ms)")
                    
                    // OPTIMIZATION 5: Early exit if we have enough text
                    if (extractedText.length > 1000) {
                        Log.d(TAG, "SPEED OPTIMIZATION: Early exit with ${extractedText.length} characters")
                        break
                    }
                    
                } catch (e: Exception) {
                    Log.e(TAG, "ENHANCED OCR ERROR: Failed to process page $pageIndex", e)
                    // Continue with next page on error
                } finally {
                    // CRITICAL: Always close resources in the correct order
                    bitmap?.recycle()
                    page?.close()
                    Log.d(TAG, "ENHANCED OCR: Resources cleaned up for page $pageIndex")
                }
            }
            
            Log.d(TAG, "ENHANCED OCR: Completed processing all pages. Total extracted text length: ${extractedText.length}")
            Log.d(TAG, "ENHANCED OCR: Total segments found: ${allSegments.size}")
            Log.d(TAG, "ENHANCED OCR: First 200 chars of extracted text: '${extractedText.take(200)}...'")
            
            val finalText = extractedText.toString()
            if (finalText.trim().isEmpty()) {
                Log.w(TAG, "ENHANCED OCR WARNING: No text extracted from any page!")
                Log.w(TAG, "DIAGNOSTIC INFO: Total pages processed: $maxPagesToProcess, Total segments: ${allSegments.size}")
                
                // Create detailed diagnostic message
                val diagnosticInfo = StringBuilder()
                diagnosticInfo.append("OCR completed but no text found.\n")
                diagnosticInfo.append("Pages processed: $maxPagesToProcess/$pageCount\n")
                diagnosticInfo.append("Total segments found: ${allSegments.size}\n")
                
                if (allSegments.isNotEmpty()) {
                    diagnosticInfo.append("Segments exist but contain no readable text.\n")
                    diagnosticInfo.append("First few segments:\n")
                    allSegments.take(3).forEachIndexed { index, segment ->
                        diagnosticInfo.append("  $index: '${segment.text}' (${segment.text.length} chars)\n")
                    }
                } else {
                    diagnosticInfo.append("No text segments detected - possible causes:\n")
                    diagnosticInfo.append("• PDF contains only images\n")
                    diagnosticInfo.append("• Text is too small/blurry for OCR\n")
                    diagnosticInfo.append("• ML Kit OCR not functioning properly\n")
                }
                
                return ExtractionResult(
                    success = false,
                    text = "",
                    segments = allSegments,
                    pageCount = pageCount,
                    processingTime = 0,
                    extractionMethod = "enhanced_ocr_no_text",
                    error = diagnosticInfo.toString()
                )
            }

            return ExtractionResult(
                success = true,
                text = extractedText.toString(),
                segments = allSegments,
                pageCount = pageCount,
                processingTime = 0, // Will be set by caller
                extractionMethod = "fast_enhanced_mlkit_ocr"
            )

        } catch (e: Exception) {
            Log.e(TAG, "Enhanced OCR failed", e)
            return ExtractionResult(
                success = false,
                text = "",
                segments = emptyList(),
                pageCount = pageCount,
                processingTime = 0,
                extractionMethod = "enhanced_ocr_error",
                error = e.message
            )
        }
    }

    /**
     * FAST text segment extraction with timeout and optimizations
     * ENHANCED WITH DEBUGGING
     */
    private fun extractTextSegmentsFast(
        bitmap: Bitmap, 
        pageIndex: Int, 
        scaleFactor: Float
    ): List<TextSegment> {
        
        Log.d(TAG, "FAST OCR: Starting extraction for page $pageIndex (bitmap: ${bitmap.width}x${bitmap.height})")
        
        val latch = CountDownLatch(1)
        val segments = mutableListOf<TextSegment>()
        var error: Exception? = null

        try {
            val image = InputImage.fromBitmap(bitmap, 0)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

                    recognizer.process(image)
                        .addOnSuccessListener { visionText ->
                            Log.d(TAG, "FAST OCR: ML Kit success for page $pageIndex - found ${visionText.textBlocks.size} text blocks")
                            Log.d(TAG, "FAST OCR: Raw text from ML Kit: '${visionText.text}'")
                            
                            // OPTIMIZATION: Extract larger blocks instead of individual words for speed
                            for ((blockIndex, block) in visionText.textBlocks.withIndex()) {
                                val boundingBox = block.boundingBox
                                val cleanText = block.text.trim()
                                
                                if (boundingBox != null && cleanText.isNotEmpty()) {
                                    // Accept all non-empty text - let the user decide what's valid
                                    Log.d(TAG, "FAST OCR: Block $blockIndex text: '${cleanText.take(50)}...' at (${boundingBox.left}, ${boundingBox.top})")
                                    segments.add(
                                        TextSegment(
                                            text = cleanText,
                                            x = boundingBox.left / scaleFactor,
                                            y = boundingBox.top / scaleFactor,
                                            width = boundingBox.width() / scaleFactor,
                                            height = boundingBox.height() / scaleFactor,
                                            page = pageIndex,
                                            confidence = 1.0f // Simplified confidence
                                        )
                                    )
                                }
                            }
                            Log.d(TAG, "FAST OCR: Extracted ${segments.size} segments from page $pageIndex")
                            latch.countDown()
                }
                .addOnFailureListener { exception ->
                    Log.e(TAG, "FAST OCR: ML Kit failed for page $pageIndex", exception)
                    error = exception
                    latch.countDown()
                }

            // OPTIMIZATION: Add timeout to prevent hanging
            val timeoutMs = 10000L // 10 second timeout per page
            val completed = latch.await(timeoutMs, java.util.concurrent.TimeUnit.MILLISECONDS)
            
            if (!completed) {
                Log.w(TAG, "FAST OCR: Timeout for page $pageIndex after ${timeoutMs}ms")
                throw Exception("OCR timeout after ${timeoutMs}ms")
            }
            
            error?.let { throw it }

        } catch (e: Exception) {
            Log.e(TAG, "FAST OCR: Text segment extraction failed for page $pageIndex", e)
            throw e
        }

        Log.d(TAG, "FAST OCR: Returning ${segments.size} segments for page $pageIndex")
        return segments
    }

    /**
     * Extract text segments with positioning using ML Kit (Textricator-inspired)
     * DEPRECATED: Use extractTextSegmentsFast instead for better performance
     */
    private fun extractTextSegmentsWithMLKit(
        bitmap: Bitmap, 
        pageIndex: Int, 
        scaleFactor: Float
    ): List<TextSegment> {
        
        val latch = CountDownLatch(1)
        val segments = mutableListOf<TextSegment>()
        var error: Exception? = null

        try {
            val image = InputImage.fromBitmap(bitmap, 0)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    // Extract individual text blocks with positioning
                    for (block in visionText.textBlocks) {
                        val boundingBox = block.boundingBox
                        if (boundingBox != null) {
                            segments.add(
                                TextSegment(
                                    text = block.text,
                                    x = boundingBox.left / scaleFactor,
                                    y = boundingBox.top / scaleFactor,
                                    width = boundingBox.width() / scaleFactor,
                                    height = boundingBox.height() / scaleFactor,
                                    page = pageIndex,
                                    confidence = block.cornerPoints?.size?.toFloat() ?: 1.0f
                                )
                            )
                        }
                    }
                    latch.countDown()
                }
                .addOnFailureListener { exception ->
                    error = exception
                    latch.countDown()
                }

            latch.await()
            error?.let { throw it }

        } catch (e: Exception) {
            Log.e(TAG, "ML Kit text segment extraction failed", e)
            throw e
        }

        return segments
    }

    /**
     * Combine text segments with proper spacing (Textricator-inspired)
     */
    private fun combineTextSegments(segments: List<TextSegment>): String {
        if (segments.isEmpty()) return ""
        
        val result = StringBuilder()
        var lastY = segments.first().y
        
        for ((index, segment) in segments.withIndex()) {
            // Add line breaks for segments that are clearly on different lines
            if (index > 0) {
                val yDifference = segment.y - lastY
                if (yDifference > segment.height * 0.5) {
                    result.append("\n")
                } else {
                    result.append(" ")
                }
            }
            
            result.append(segment.text.trim())
            lastY = segment.y
        }
        
        return result.toString()
    }
    
    /**
     * Test ML Kit functionality with a simple text bitmap
     */
    private fun testMLKitFunctionality() {
        try {
            Log.d(TAG, "ML KIT TEST: Creating test bitmap...")
            
            // Create a simple bitmap with text
            val testBitmap = Bitmap.createBitmap(400, 200, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(testBitmap)
            canvas.drawColor(Color.WHITE)
            
            // Draw some text
            val paint = Paint().apply {
                color = Color.BLACK
                textSize = 48f
                isAntiAlias = true
            }
            canvas.drawText("Hello World Test", 50f, 100f, paint)
            
            Log.d(TAG, "ML KIT TEST: Created test bitmap ${testBitmap.width}x${testBitmap.height}")
            
            // Test ML Kit
            val latch = CountDownLatch(1)
            var testResult = ""
            var testError: Exception? = null
            
            val image = InputImage.fromBitmap(testBitmap, 0)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            
            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    testResult = visionText.text
                    Log.d(TAG, "ML KIT TEST SUCCESS: Found text: '$testResult'")
                    latch.countDown()
                }
                .addOnFailureListener { exception ->
                    testError = exception
                    Log.e(TAG, "ML KIT TEST FAILED", exception)
                    latch.countDown()
                }
            
            val completed = latch.await(5000, java.util.concurrent.TimeUnit.MILLISECONDS)
            if (!completed) {
                Log.w(TAG, "ML KIT TEST: Timeout after 5 seconds")
            } else if (testError != null) {
                Log.e(TAG, "ML KIT TEST: Error occurred", testError)
            } else {
                Log.d(TAG, "ML KIT TEST: Completed successfully with result: '$testResult'")
            }
            
            testBitmap.recycle()
            
        } catch (e: Exception) {
            Log.e(TAG, "ML KIT TEST: Exception during test", e)
        }
    }

    /**
     * Fast text extraction - processes only limited number of pages for speed
     */
    fun extractTextWithLimitedPages(pdfPath: String, maxPages: Int = 10): ExtractionResult {
        val startTime = System.currentTimeMillis()
        
        try {
            val file = File(pdfPath)
            if (!file.exists()) {
                Log.e(TAG, "FAST ERROR: File not found at $pdfPath")
                return ExtractionResult(
                    success = false,
                    text = "",
                    segments = emptyList(),
                    pageCount = 0,
                    processingTime = 0,
                    extractionMethod = "none",
                    error = "File not found: $pdfPath"
                )
            }

            Log.d(TAG, "FAST: Opening PDF (max $maxPages pages)...")
            val fileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            
            if (fileDescriptor == null) {
                Log.e(TAG, "FAST ERROR: Failed to open file descriptor")
                return ExtractionResult(
                    success = false,
                    text = "",
                    segments = emptyList(),
                    pageCount = 0,
                    processingTime = 0,
                    extractionMethod = "none",
                    error = "Failed to open PDF file"
                )
            }

            val pdfRenderer = PdfRenderer(fileDescriptor)
            val totalPages = pdfRenderer.pageCount
            val pagesToProcess = minOf(maxPages, totalPages)
            
            Log.d(TAG, "FAST: PDF has $totalPages pages, processing first $pagesToProcess pages")
            
            val allSegments = mutableListOf<TextSegment>()
            
            for (pageIndex in 0 until pagesToProcess) {
                try {
                    Log.d(TAG, "FAST: Processing page ${pageIndex + 1}/$pagesToProcess")
                    
                    // Render page to bitmap
                    val page = pdfRenderer.openPage(pageIndex)
                    val scaleFactor = 2.0f // Fixed scale for speed
                    val bitmap = Bitmap.createBitmap(
                        (page.width * scaleFactor).toInt(),
                        (page.height * scaleFactor).toInt(),
                        Bitmap.Config.ARGB_8888
                    )
                    
                    // Fill with white background
                    val canvas = Canvas(bitmap)
                    canvas.drawColor(Color.WHITE)
                    
                    // Render page to bitmap
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    page.close()
                    
                    // Extract text from bitmap
                    val segments = extractTextSegmentsFast(bitmap, pageIndex, scaleFactor)
                    allSegments.addAll(segments)
                    
                    Log.d(TAG, "FAST: Page ${pageIndex + 1} completed - ${segments.size} segments found")
                } catch (e: Exception) {
                    Log.w(TAG, "FAST: Page ${pageIndex + 1} failed: ${e.message}")
                    // Continue with other pages
                }
            }
            
            pdfRenderer.close()
            fileDescriptor.close()
            
            val endTime = System.currentTimeMillis()
            val processingTime = endTime - startTime
            
            val extractedText = allSegments.joinToString(" ") { it.text }
            
            Log.d(TAG, "FAST: Extraction completed in ${processingTime}ms")
            Log.d(TAG, "FAST: Total text length: ${extractedText.length} characters")
            Log.d(TAG, "FAST: Total segments: ${allSegments.size}")
            
            if (extractedText.isBlank()) {
                return ExtractionResult(
                    success = false,
                    text = "",
                    segments = allSegments,
                    pageCount = pagesToProcess,
                    processingTime = processingTime,
                    extractionMethod = "Fast OCR Limited",
                    error = "No text found in first $pagesToProcess pages"
                )
            }
            
            return ExtractionResult(
                success = true,
                text = extractedText,
                segments = allSegments,
                pageCount = pagesToProcess,
                processingTime = processingTime,
                extractionMethod = "Fast OCR Limited"
            )
            
        } catch (e: Exception) {
            val endTime = System.currentTimeMillis()
            val processingTime = endTime - startTime
            
            Log.e(TAG, "FAST: Fatal error during extraction", e)
            return ExtractionResult(
                success = false,
                text = "",
                segments = emptyList(),
                pageCount = 0,
                processingTime = processingTime,
                extractionMethod = "Fast OCR Limited",
                error = "Fatal error: ${e.message}"
            )
        }
    }
}
