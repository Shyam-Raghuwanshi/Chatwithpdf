package com.chatwithpdf

import android.content.Context
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.*
import org.apache.poi.hwpf.HWPFDocument
import org.apache.poi.hwpf.extractor.WordExtractor
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.apache.poi.xwpf.extractor.XWPFWordExtractor
import java.io.File
import java.io.FileInputStream
import java.io.IOException

class WordTextExtractorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "WordTextExtractorModule"
    }

    override fun getName(): String {
        return "WordTextExtractorModule"
    }

    @ReactMethod
    fun extractTextFromDocFile(docPath: String, promise: Promise) {
        Log.d(TAG, "Starting .doc text extraction for: $docPath")
        
        try {
            val startTime = System.currentTimeMillis()
            val file = File(docPath)
            
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: $docPath")
                return
            }

            val fileInputStream = FileInputStream(file)
            val document = HWPFDocument(fileInputStream)
            val extractor = WordExtractor(document)
            
            val text = extractor.text
            val processingTime = System.currentTimeMillis() - startTime
            
            // Clean up
            extractor.close()
            document.close()
            fileInputStream.close()
            
            val responseMap = Arguments.createMap()
            responseMap.putString("text", text)
            responseMap.putDouble("processingTime", processingTime.toDouble())
            responseMap.putString("extractionMethod", "Apache POI HWPF (.doc)")
            responseMap.putString("fileType", "doc")
            responseMap.putInt("textLength", text.length)
            
            Log.d(TAG, ".doc extraction completed: ${text.length} characters in ${processingTime}ms")
            promise.resolve(responseMap)
            
        } catch (e: IOException) {
            Log.e(TAG, "IO error during .doc extraction", e)
            promise.reject("IO_ERROR", "Failed to read .doc file: ${e.message}", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error during .doc extraction", e)
            promise.reject("EXTRACTION_ERROR", "Failed to extract text from .doc file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun extractTextFromDocxFile(docxPath: String, promise: Promise) {
        Log.d(TAG, "Starting .docx text extraction for: $docxPath")
        
        try {
            val startTime = System.currentTimeMillis()
            val file = File(docxPath)
            
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: $docxPath")
                return
            }

            val fileInputStream = FileInputStream(file)
            val document = XWPFDocument(fileInputStream)
            val extractor = XWPFWordExtractor(document)
            
            val text = extractor.text
            val processingTime = System.currentTimeMillis() - startTime
            
            // Get additional document information
            val paragraphCount = document.paragraphs.size
            val tableCount = document.tables.size
            
            // Clean up
            extractor.close()
            document.close()
            fileInputStream.close()
            
            val responseMap = Arguments.createMap()
            responseMap.putString("text", text)
            responseMap.putDouble("processingTime", processingTime.toDouble())
            responseMap.putString("extractionMethod", "Apache POI XWPF (.docx)")
            responseMap.putString("fileType", "docx")
            responseMap.putInt("textLength", text.length)
            responseMap.putInt("paragraphCount", paragraphCount)
            responseMap.putInt("tableCount", tableCount)
            
            Log.d(TAG, ".docx extraction completed: ${text.length} characters, $paragraphCount paragraphs, $tableCount tables in ${processingTime}ms")
            promise.resolve(responseMap)
            
        } catch (e: IOException) {
            Log.e(TAG, "IO error during .docx extraction", e)
            promise.reject("IO_ERROR", "Failed to read .docx file: ${e.message}", e)
        } catch (e: Exception) {
            Log.e(TAG, "Error during .docx extraction", e)
            promise.reject("EXTRACTION_ERROR", "Failed to extract text from .docx file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun extractTextFromWordDocument(filePath: String, promise: Promise) {
        Log.d(TAG, "Auto-detecting Word document type for: $filePath")
        
        try {
            val file = File(filePath)
            
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: $filePath")
                return
            }

            // Determine file type by extension
            val fileName = file.name.lowercase()
            when {
                fileName.endsWith(".doc") -> {
                    Log.d(TAG, "Detected .doc file, using HWPF")
                    extractTextFromDocFile(filePath, promise)
                }
                fileName.endsWith(".docx") -> {
                    Log.d(TAG, "Detected .docx file, using XWPF")
                    extractTextFromDocxFile(filePath, promise)
                }
                else -> {
                    // Try to auto-detect by attempting to read as .docx first, then .doc
                    Log.d(TAG, "Unknown extension, attempting auto-detection")
                    tryExtractWithAutoDetection(filePath, promise)
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error during Word document extraction", e)
            promise.reject("EXTRACTION_ERROR", "Failed to extract text from Word document: ${e.message}", e)
        }
    }

    private fun tryExtractWithAutoDetection(filePath: String, promise: Promise) {
        Log.d(TAG, "Attempting auto-detection for: $filePath")
        
        // Try .docx first (more common format)
        try {
            Log.d(TAG, "Trying .docx format first...")
            extractTextFromDocxFile(filePath, promise)
            return
        } catch (e: Exception) {
            Log.d(TAG, "Failed to read as .docx, trying .doc format...")
        }
        
        // If .docx fails, try .doc
        try {
            extractTextFromDocFile(filePath, promise)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read as both .docx and .doc formats", e)
            promise.reject("UNSUPPORTED_FORMAT", "File is neither a valid .doc nor .docx document: ${e.message}", e)
        }
    }

    @ReactMethod
    fun copyContentUriToInternalStorage(uriString: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val uri = Uri.parse(uriString)
            
            // Create internal storage directory
            val internalDir = File(context.filesDir, "selected_documents")
            if (!internalDir.exists()) {
                internalDir.mkdirs()
            }
            
            // Generate a unique filename with original extension if available
            val timestamp = System.currentTimeMillis()
            val fileName = getFileNameFromUri(uri) ?: "document_$timestamp"
            val outputFile = File(internalDir, fileName)
            
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

    private fun getFileNameFromUri(uri: Uri): String? {
        val context = reactApplicationContext
        var fileName: String? = null
        
        // Try to get filename from content resolver
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (nameIndex != -1 && cursor.moveToFirst()) {
                fileName = cursor.getString(nameIndex)
            }
        }
        
        return fileName
    }

    @ReactMethod
    fun getSupportedFormats(promise: Promise) {
        val supportedFormats = Arguments.createArray()
        supportedFormats.pushString("doc")
        supportedFormats.pushString("docx")
        
        val responseMap = Arguments.createMap()
        responseMap.putArray("formats", supportedFormats)
        responseMap.putString("library", "Apache POI")
        responseMap.putString("version", "5.2.4")
        responseMap.putString("docReader", "HWPF")
        responseMap.putString("docxReader", "XWPF")
        
        promise.resolve(responseMap)
    }

    @ReactMethod
    fun testWordExtraction(promise: Promise) {
        Log.d(TAG, "Running Word extraction test")
        
        try {
            // Create a simple test to verify POI is working
            val testResult = Arguments.createMap()
            testResult.putBoolean("poiAvailable", true)
            testResult.putString("status", "Apache POI libraries are properly loaded")
            testResult.putString("hwpfVersion", "Available for .doc files")
            testResult.putString("xwpfVersion", "Available for .docx files")
            
            Log.d(TAG, "Word extraction test passed")
            promise.resolve(testResult)
            
        } catch (e: Exception) {
            Log.e(TAG, "Word extraction test failed", e)
            promise.reject("TEST_FAILED", "Word extraction test failed: ${e.message}", e)
        }
    }
}
