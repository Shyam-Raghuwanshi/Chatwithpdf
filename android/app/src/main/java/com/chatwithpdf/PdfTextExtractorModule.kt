package com.chatwithpdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.util.concurrent.CountDownLatch

class PdfTextExtractorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "PdfTextExtractorModule"
    }

    override fun getName(): String {
        return "PdfTextExtractorModule"
    }

    @ReactMethod
    fun extractTextWithTextricatorApproach(pdfPath: String, promise: Promise) {
        Log.d(TAG, "Starting Textricator-inspired extraction for: $pdfPath")
        
        try {
            val extractor = TextricatorInspiredExtractor(reactApplicationContext)
            val result = extractor.extractTextWithMultipleStrategies(pdfPath)
            
            if (result.success) {
                val responseMap = Arguments.createMap()
                responseMap.putString("text", result.text)
                responseMap.putDouble("processingTime", result.processingTime.toDouble())
                responseMap.putInt("pageCount", result.pageCount)
                responseMap.putString("extractionMethod", result.extractionMethod)
                responseMap.putInt("segmentCount", result.segments.size)
                
                // Add segment details for advanced use cases
                val segmentsArray = Arguments.createArray()
                result.segments.take(10).forEach { segment -> // Limit to first 10 for performance
                    val segmentMap = Arguments.createMap()
                    segmentMap.putString("text", segment.text)
                    segmentMap.putDouble("x", segment.x.toDouble())
                    segmentMap.putDouble("y", segment.y.toDouble())
                    segmentMap.putDouble("width", segment.width.toDouble())
                    segmentMap.putDouble("height", segment.height.toDouble())
                    segmentMap.putInt("page", segment.page)
                    segmentMap.putDouble("confidence", segment.confidence.toDouble())
                    segmentsArray.pushMap(segmentMap)
                }
                responseMap.putArray("segments", segmentsArray)
                
                Log.d(TAG, "Textricator extraction completed: ${result.text.length} chars, ${result.segments.size} segments, ${result.processingTime}ms")
                promise.resolve(responseMap)
            } else {
                promise.reject("TEXTRICATOR_ERROR", result.error ?: "Textricator extraction failed")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error during Textricator extraction", e)
            promise.reject("TEXTRICATOR_ERROR", "Failed to extract text: ${e.message}", e)
        }
    }

    @ReactMethod
    fun extractTextWithFastOCR(pdfPath: String, promise: Promise) {
        Log.d(TAG, "Starting FAST OCR extraction for: $pdfPath")
        
        try {
            val extractor = TextricatorInspiredExtractor(reactApplicationContext)
            
            // First, get PDF info to determine page count
            val file = File(pdfPath)
            val fileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val pdfRenderer = PdfRenderer(fileDescriptor)
            val totalPages = pdfRenderer.pageCount
            pdfRenderer.close()
            fileDescriptor.close()
            
            // Process ALL pages - no limits!
            Log.d(TAG, "PDF has $totalPages pages, processing ALL pages (no limit)")
            
            val result = extractor.extractTextWithLimitedPages(pdfPath, maxPages = totalPages)
            
            if (result.success) {
                val responseMap = Arguments.createMap()
                responseMap.putString("text", result.text)
                responseMap.putDouble("processingTime", result.processingTime.toDouble())
                responseMap.putInt("pageCount", result.pageCount)
                responseMap.putString("extractionMethod", "Fast OCR (ALL $totalPages pages)")
                responseMap.putInt("segmentCount", result.segments.size)
                responseMap.putInt("totalPages", totalPages)
                
                Log.d(TAG, "FAST OCR completed successfully: ${result.text.length} chars, ${result.processingTime}ms")
                promise.resolve(responseMap)
            } else {
                Log.e(TAG, "FAST OCR failed: ${result.error}")
                promise.reject("FAST_OCR_ERROR", result.error)
            }
        } catch (e: Exception) {
            Log.e(TAG, "FAST OCR exception", e)
            promise.reject("FAST_OCR_EXCEPTION", "Fast OCR failed: ${e.message}")
        }
    }

    @ReactMethod
    fun extractTextWithExtendedOCR(pdfPath: String, maxPages: Int, promise: Promise) {
        Log.d(TAG, "Starting EXTENDED OCR extraction for: $pdfPath")
        
        try {
            val extractor = TextricatorInspiredExtractor(reactApplicationContext)
            
            // Get total page count
            val file = File(pdfPath)
            val fileDescriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val pdfRenderer = PdfRenderer(fileDescriptor)
            val totalPages = pdfRenderer.pageCount
            pdfRenderer.close()
            fileDescriptor.close()
            
            // Use the minimum of requested pages or total pages (process all if maxPages >= totalPages)
            val pagesToProcess = minOf(maxPages, totalPages)
            
            Log.d(TAG, "PDF has $totalPages pages, processing $pagesToProcess pages")
            
            val result = extractor.extractTextWithLimitedPages(pdfPath, maxPages = pagesToProcess)
            
            if (result.success) {
                val responseMap = Arguments.createMap()
                responseMap.putString("text", result.text)
                responseMap.putDouble("processingTime", result.processingTime.toDouble())
                responseMap.putInt("pageCount", result.pageCount)
                responseMap.putString("extractionMethod", "Extended OCR ($pagesToProcess/$totalPages pages)")
                responseMap.putInt("segmentCount", result.segments.size)
                responseMap.putInt("totalPages", totalPages)
                
                Log.d(TAG, "EXTENDED OCR completed successfully: ${result.text.length} chars, ${result.processingTime}ms")
                promise.resolve(responseMap)
            } else {
                Log.e(TAG, "EXTENDED OCR failed: ${result.error}")
                promise.reject("EXTENDED_OCR_ERROR", result.error)
            }
        } catch (e: Exception) {
            Log.e(TAG, "EXTENDED OCR exception", e)
            promise.reject("EXTENDED_OCR_EXCEPTION", "Extended OCR failed: ${e.message}")
        }
    }

    private fun extractTextFromBitmapWithMLKit(bitmap: Bitmap): String {
        val latch = CountDownLatch(1)
        var result = ""
        var error: Exception? = null

        try {
            val image = InputImage.fromBitmap(bitmap, 0)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    result = visionText.text
                    latch.countDown()
                }
                .addOnFailureListener { exception ->
                    error = exception
                    latch.countDown()
                }

            // Wait for ML Kit to complete (with timeout)
            latch.await()

            error?.let { throw it }

        } catch (e: Exception) {
            Log.e(TAG, "ML Kit OCR failed", e)
            throw e
        }

        return result
    }

    @ReactMethod
    fun extractTextFromPdf(pdfPath: String, promise: Promise) {
        // Delegate to the fast OCR method
        extractTextWithFastOCR(pdfPath, promise)
    }

    @ReactMethod
    fun copyAssetToInternalStorage(assetFileName: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val assetManager = context.assets
            
            // Create internal storage directory
            val internalDir = File(context.filesDir, "pdfs")
            if (!internalDir.exists()) {
                internalDir.mkdirs()
            }
            
            // Copy asset to internal storage
            val outputFile = File(internalDir, assetFileName)
            assetManager.open(assetFileName).use { inputStream ->
                outputFile.outputStream().use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
            
            Log.d(TAG, "Asset copied to: ${outputFile.absolutePath}")
            promise.resolve(outputFile.absolutePath)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error copying asset to internal storage", e)
            promise.reject("COPY_ERROR", "Failed to copy asset: ${e.message}", e)
        }
    }

    @ReactMethod
    fun createTestPdfAndExtract(promise: Promise) {
        Log.d(TAG, "Creating test PDF for OCR verification")
        
        try {
            val testPdfPath = createSimpleTestPdf()
            Log.d(TAG, "Test PDF created at: $testPdfPath")
            
            // Extract text from the test PDF
            val extractor = TextricatorInspiredExtractor(reactApplicationContext)
            val result = extractor.extractTextWithMultipleStrategies(testPdfPath)
            
            val responseMap = Arguments.createMap()
            responseMap.putString("testPdfPath", testPdfPath)
            responseMap.putBoolean("success", result.success)
            responseMap.putString("text", result.text)
            responseMap.putString("extractionMethod", result.extractionMethod)
            responseMap.putInt("pageCount", result.pageCount)
            responseMap.putDouble("processingTime", result.processingTime.toDouble())
            
            if (result.success) {
                Log.d(TAG, "Test PDF OCR successful: ${result.text.length} chars extracted")
            } else {
                Log.e(TAG, "Test PDF OCR failed: ${result.error}")
                responseMap.putString("error", result.error)
            }
            
            promise.resolve(responseMap)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error creating/testing PDF", e)
            promise.reject("TEST_PDF_ERROR", "Failed to create test PDF: ${e.message}", e)
        }
    }

    private fun createSimpleTestPdf(): String {
        val outputDir = File(reactApplicationContext.filesDir, "test_pdfs")
        if (!outputDir.exists()) {
            outputDir.mkdirs()
        }
        
        val outputFile = File(outputDir, "simple_test.pdf")
        
        // Create a simple PDF with text
        val document = android.graphics.pdf.PdfDocument()
        val pageInfo = android.graphics.pdf.PdfDocument.PageInfo.Builder(595, 842, 1).create() // A4 size
        val page = document.startPage(pageInfo)
        
        val canvas = page.canvas
        val paint = android.graphics.Paint().apply {
            color = android.graphics.Color.BLACK
            textSize = 24f
            isAntiAlias = true
        }
        
        // Draw some test text
        canvas.drawText("This is a simple test document.", 50f, 100f, paint)
        canvas.drawText("It contains multiple lines of text.", 50f, 150f, paint)
        canvas.drawText("The text should be easy to read.", 50f, 200f, paint)
        canvas.drawText("OCR should extract this content.", 50f, 250f, paint)
        canvas.drawText("Testing 123 numbers and symbols!", 50f, 300f, paint)
        
        document.finishPage(page)
        
        // Write to file
        outputFile.outputStream().use { outputStream ->
            document.writeTo(outputStream)
        }
        document.close()
        
        Log.d(TAG, "Simple test PDF created: ${outputFile.absolutePath}")
        return outputFile.absolutePath
    }

    @ReactMethod
    fun copyContentUriToInternalStorage(uriString: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val uri = Uri.parse(uriString)
            
            // Create internal storage directory
            val internalDir = File(context.filesDir, "selected_pdfs")
            if (!internalDir.exists()) {
                internalDir.mkdirs()
            }
            
            // Generate a unique filename
            val timestamp = System.currentTimeMillis()
            val outputFile = File(internalDir, "selected_pdf_$timestamp.pdf")
            
            // Copy content URI to internal storage
            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                outputFile.outputStream().use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
            
            Log.d(TAG, "Content URI copied to: ${outputFile.absolutePath}")
            promise.resolve(outputFile.absolutePath)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error copying content URI to internal storage", e)
            promise.reject("COPY_URI_ERROR", "Failed to copy content URI: ${e.message}", e)
        }
    }
}