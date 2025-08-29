package com.chatwithpdf

import com.facebook.react.bridge.*
import com.itextpdf.text.pdf.PdfReader
import com.itextpdf.text.pdf.parser.PdfReaderContentParser
import com.itextpdf.text.pdf.parser.SimpleTextExtractionStrategy
import com.itextpdf.text.pdf.parser.TextExtractionStrategy
import java.io.*
import java.util.*
import org.json.JSONObject

class PdfTextExtractorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PdfTextExtractorModule"
    }

    @ReactMethod
    fun extractPdfText(pdfPath: String, promise: Promise) {
        try {
            // Validate input
            if (pdfPath.isEmpty()) {
                val errorJson = createErrorResponse("PDF path cannot be empty")
                promise.resolve(errorJson)
                return
            }

            val file = File(pdfPath)
            if (!file.exists()) {
                val errorJson = createErrorResponse("PDF file does not exist: $pdfPath")
                promise.resolve(errorJson)
                return
            }

            // Extract text from PDF
            val extractedText = extractTextFromPdf(pdfPath)
            val metadata = extractMetadata(pdfPath)
            
            // Create success response
            val result = JSONObject().apply {
                put("success", true)
                put("text", extractedText)
                put("metadata", metadata)
                put("error", "")
            }
            
            promise.resolve(result.toString())
            
        } catch (e: Exception) {
            val errorJson = createErrorResponse("Error extracting PDF text: ${e.message}")
            promise.resolve(errorJson)
        }
    }

    @ReactMethod
    fun extractPdfTextFromPage(pdfPath: String, pageNumber: Int, promise: Promise) {
        try {
            // Validate input
            if (pdfPath.isEmpty()) {
                val errorJson = createErrorResponse("PDF path cannot be empty")
                promise.resolve(errorJson)
                return
            }

            val file = File(pdfPath)
            if (!file.exists()) {
                val errorJson = createErrorResponse("PDF file does not exist: $pdfPath")
                promise.resolve(errorJson)
                return
            }

            // Extract text from specific page
            val extractedText = extractTextFromSpecificPage(pdfPath, pageNumber)
            val metadata = extractMetadata(pdfPath)
            
            // Create success response
            val result = JSONObject().apply {
                put("success", true)
                put("text", extractedText)
                put("metadata", metadata)
                put("page", pageNumber)
                put("error", "")
            }
            
            promise.resolve(result.toString())
            
        } catch (e: Exception) {
            val errorJson = createErrorResponse("Error extracting PDF text from page $pageNumber: ${e.message}")
            promise.resolve(errorJson)
        }
    }

    @ReactMethod
    fun getPdfInfo(pdfPath: String, promise: Promise) {
        try {
            val file = File(pdfPath)
            if (!file.exists()) {
                val errorJson = createErrorResponse("PDF file does not exist: $pdfPath")
                promise.resolve(errorJson)
                return
            }

            val metadata = extractMetadata(pdfPath)
            
            val result = JSONObject().apply {
                put("success", true)
                put("metadata", metadata)
                put("error", "")
            }
            
            promise.resolve(result.toString())
            
        } catch (e: Exception) {
            val errorJson = createErrorResponse("Error getting PDF info: ${e.message}")
            promise.resolve(errorJson)
        }
    }

    private fun extractTextFromPdf(pdfPath: String): String {
        val reader = PdfReader(pdfPath)
        val parser = PdfReaderContentParser(reader)
        val stringBuilder = StringBuilder()
        
        try {
            for (i in 1..reader.numberOfPages) {
                val strategy: TextExtractionStrategy = parser.processContent(i, SimpleTextExtractionStrategy())
                val pageText = strategy.resultantText
                if (pageText.isNotEmpty()) {
                    stringBuilder.append(pageText)
                    if (i < reader.numberOfPages) {
                        stringBuilder.append("\n\n--- Page ${i + 1} ---\n\n")
                    }
                }
            }
        } finally {
            reader.close()
        }
        
        return stringBuilder.toString().trim()
    }

    private fun extractTextFromSpecificPage(pdfPath: String, pageNumber: Int): String {
        val reader = PdfReader(pdfPath)
        
        try {
            if (pageNumber < 1 || pageNumber > reader.numberOfPages) {
                throw IllegalArgumentException("Page number $pageNumber is out of range. PDF has ${reader.numberOfPages} pages.")
            }
            
            val parser = PdfReaderContentParser(reader)
            val strategy: TextExtractionStrategy = parser.processContent(pageNumber, SimpleTextExtractionStrategy())
            return strategy.resultantText.trim()
        } finally {
            reader.close()
        }
    }

    private fun extractMetadata(pdfPath: String): JSONObject {
        val reader = PdfReader(pdfPath)
        val metadata = JSONObject()
        
        try {
            // Basic PDF information
            metadata.put("numberOfPages", reader.numberOfPages)
            metadata.put("pdfVersion", reader.pdfVersion.toString())
            metadata.put("fileSize", File(pdfPath).length())
            
            // PDF document info
            val info = reader.info
            if (info != null) {
                info["Title"]?.let { metadata.put("title", it) }
                info["Author"]?.let { metadata.put("author", it) }
                info["Subject"]?.let { metadata.put("subject", it) }
                info["Keywords"]?.let { metadata.put("keywords", it) }
                info["Creator"]?.let { metadata.put("creator", it) }
                info["Producer"]?.let { metadata.put("producer", it) }
                info["CreationDate"]?.let { metadata.put("creationDate", it) }
                info["ModDate"]?.let { metadata.put("modificationDate", it) }
            }
            
            // Security information
            metadata.put("isEncrypted", reader.isEncrypted())
            if (reader.isEncrypted()) {
                metadata.put("securityType", "Password Protected")
            }
            
        } catch (e: Exception) {
            metadata.put("error", "Could not extract metadata: ${e.message}")
        } finally {
            reader.close()
        }
        
        return metadata
    }

    private fun createErrorResponse(errorMessage: String): String {
        val errorJson = JSONObject().apply {
            put("success", false)
            put("error", errorMessage)
            put("text", "")
            put("metadata", JSONObject())
        }
        return errorJson.toString()
    }

    @ReactMethod
    fun copyAssetToInternalStorage(assetFileName: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val inputStream = context.assets.open(assetFileName)
            val outputFile = File(context.filesDir, assetFileName)
            
            // Copy asset to internal storage
            val outputStream = FileOutputStream(outputFile)
            inputStream.use { input ->
                outputStream.use { output ->
                    input.copyTo(output)
                }
            }
            
            promise.resolve(outputFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("COPY_ERROR", "Failed to copy asset: ${e.message}", e)
        }
    }
}
