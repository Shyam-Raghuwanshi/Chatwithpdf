package com.chatwithpdf;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;

public class SimpleDocumentPickerModule extends ReactContextBaseJavaModule {
    private static final int PICK_FILE_REQUEST = 1001;
    private Promise documentPickerPromise;

    private final ActivityEventListener activityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == PICK_FILE_REQUEST) {
                if (documentPickerPromise != null) {
                    if (resultCode == Activity.RESULT_OK && data != null) {
                        Uri uri = data.getData();
                        if (uri != null) {
                            try {
                                WritableMap result = new WritableNativeMap();
                                result.putString("uri", uri.toString());
                                result.putString("name", getFileName(uri));
                                result.putString("type", getReactApplicationContext().getContentResolver().getType(uri));
                                documentPickerPromise.resolve(result);
                            } catch (Exception e) {
                                documentPickerPromise.reject("ERROR", e.getMessage());
                            }
                        } else {
                            documentPickerPromise.reject("ERROR", "No file selected");
                        }
                    } else {
                        documentPickerPromise.reject("CANCELLED", "User cancelled");
                    }
                    documentPickerPromise = null;
                }
            }
        }
    };

    public SimpleDocumentPickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(activityEventListener);
    }

    @Override
    public String getName() {
        return "SimpleDocumentPicker";
    }

    @ReactMethod
    public void pickDocument(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("ERROR", "Activity doesn't exist");
            return;
        }

        documentPickerPromise = promise;

        try {
            Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.setType("*/*");
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            
            // Add extra MIME types for documents
            String[] mimeTypes = {"application/pdf", "application/msword", 
                                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                 "text/plain"};
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            
            currentActivity.startActivityForResult(Intent.createChooser(intent, "Select Document"), PICK_FILE_REQUEST);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
            documentPickerPromise = null;
        }
    }

    private String getFileName(Uri uri) {
        String result = null;
        if (uri.getScheme().equals("content")) {
            Cursor cursor = getReactApplicationContext().getContentResolver().query(uri, null, null, null, null);
            try {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex >= 0) {
                        result = cursor.getString(nameIndex);
                    }
                }
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result.lastIndexOf('/');
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return result;
    }
}
