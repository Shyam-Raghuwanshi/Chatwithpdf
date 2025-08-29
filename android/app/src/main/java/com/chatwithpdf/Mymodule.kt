package com.chatwithpdf

import com.facebook.react.bridge.*
import com.chaquo.python.*
import com.chaquo.python.android.AndroidPlatform
import java.io.*

class PythonModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(reactContext))
        }
    }

    override fun getName(): String {
        return "PythonModule"
    }

    @ReactMethod
    fun extractPdfText(pdfPath: String, language: String, promise: Promise) {
        try {
            // If the path refers to an asset, copy it to internal storage first
            // val actualPath = if (pdfPath.startsWith("/android_asset/")) {
            //     copyAssetToInternalStorage("set.pdf")
            // } else {
            //     pdfPath
            // }
            
            val py = Python.getInstance()
            val module = py.getModule("mymodule")
            
            // Call the PDF extraction function
            val result = module.callAttr("extract_pdf_text", pdfPath, language)
            
            // Convert PyObject to string (the function returns JSON string)
            val jsonResult = result.toString()
            
            promise.resolve(jsonResult)
        } catch (e: Exception) {
            val errorJson = """
                {
                    "success": false,
                    "error": "${e.message}",
                    "text": "",
                    "metadata": {}
                }
            """.trimIndent()
            promise.resolve(errorJson)
        }
    }

    private fun copyAssetToInternalStorage(assetFileName: String): String {
        val context = reactApplicationContext
        val inputStream = context.assets.open(assetFileName)
        val outputFile = File(context.filesDir, assetFileName)
        
        // Only copy if file doesn't exist or is outdated
        if (!outputFile.exists()) {
            val outputStream = FileOutputStream(outputFile)
            inputStream.use { input ->
                outputStream.use { output ->
                    input.copyTo(output)
                }
            }
        }
        
        return outputFile.absolutePath
    }
}