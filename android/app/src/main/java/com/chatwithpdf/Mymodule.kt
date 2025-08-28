package com.chatwithpdf

import com.facebook.react.bridge.*
import com.chaquo.python.*
import com.chaquo.python.android.AndroidPlatform

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
    fun addNumbers(a: Int, b: Int, promise: Promise) {
        try {
            val py = Python.getInstance()
            val result = py.getModule("mymodule").callAttr("add", a, b)
            promise.resolve(result.toInt())
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to execute Python code: ${e.message}")
        }
    }
}