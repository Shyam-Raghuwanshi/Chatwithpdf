package com.chatwithpdf

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.bridge.ReadableArray
import io.appwrite.Client
import io.appwrite.services.Account
import io.appwrite.enums.OAuthProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AuthModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private lateinit var client: Client
    private lateinit var account: Account

    override fun getName(): String {
        return "AuthModule"
    }
    
    @ReactMethod
    fun initializeClient(endpoint: String, projectId: String, promise: Promise) {
        try {
            client = Client(reactApplicationContext)
                .setEndpoint(endpoint)
                .setProject(projectId)
            account = Account(client)
            promise.resolve("Client initialized successfully")
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize client: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun createOAuth2Session(provider: String, scopes: ReadableArray?, promise: Promise) {
        if (!::account.isInitialized) {
            promise.reject("NOT_INITIALIZED", "Client not initialized. Call initializeClient first.")
            return
        }
        
        try {
            val oauthProvider = when (provider.lowercase()) {
                "google" -> OAuthProvider.GOOGLE
                "facebook" -> OAuthProvider.FACEBOOK
                "apple" -> OAuthProvider.APPLE
                "github" -> OAuthProvider.GITHUB
                else -> OAuthProvider.GOOGLE // Default to Google
            }
            
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No current activity available for OAuth flow")
                return
            }
            
            CoroutineScope(Dispatchers.IO).launch {
                try {
                // Create OAuth2 session using Appwrite's OAuth2 method
                account.createOAuth2Session(
                    activity = activity as androidx.activity.ComponentActivity,
                    provider = oauthProvider,
                    scopes = if (scopes != null && scopes.size() > 0) {
                        scopes.toArrayList().map { it.toString() }
                    } else {
                        null // Let Appwrite use default scopes
                    }
                )                    // If we get here, OAuth was successful
                    val result = WritableNativeMap().apply {
                        putString("type", "success")
                        putString("message", "OAuth flow initiated successfully")
                    }
                    
                    withContext(Dispatchers.Main) {
                        promise.resolve(result)
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        promise.reject("OAUTH_ERROR", "OAuth session creation failed: ${e.message}", e)
                    }
                }
            }
        } catch (e: Exception) {
            promise.reject("OAUTH_ERROR", "OAuth setup failed: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun getCurrentUser(promise: Promise) {
        if (!::account.isInitialized) {
            promise.reject("NOT_INITIALIZED", "Client not initialized. Call initializeClient first.")
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val user = account.get()
                val userMap = WritableNativeMap().apply {
                    putString("id", user.id)
                    putString("name", user.name)
                    putString("email", user.email)
                    putBoolean("emailVerification", user.emailVerification)
                    putString("phone", user.phone ?: "")
                    putBoolean("phoneVerification", user.phoneVerification)
                    putString("registration", user.registration)
                    putBoolean("status", user.status)
                    putString("passwordUpdate", user.passwordUpdate)
                    
                    // Add empty preferences map for now
                    val prefsMap = WritableNativeMap()
                    putMap("prefs", prefsMap)
                }
                
                withContext(Dispatchers.Main) {
                    promise.resolve(userMap)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("GET_USER_ERROR", "Failed to get current user: ${e.message}", e)
                }
            }
        }
    }
    
    @ReactMethod
    fun logout(promise: Promise) {
        if (!::account.isInitialized) {
            promise.reject("NOT_INITIALIZED", "Client not initialized. Call initializeClient first.")
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                account.deleteSession("current")
                withContext(Dispatchers.Main) {
                    promise.resolve("Logged out successfully")
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("LOGOUT_ERROR", "Failed to logout: ${e.message}", e)
                }
            }
        }
    }
    
    @ReactMethod
    fun createEmailPasswordSession(email: String, password: String, promise: Promise) {
        if (!::account.isInitialized) {
            promise.reject("NOT_INITIALIZED", "Client not initialized. Call initializeClient first.")
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val session = account.createEmailPasswordSession(email, password)
                val sessionMap = WritableNativeMap().apply {
                    putString("id", session.id)
                    putString("userId", session.userId)
                    putString("provider", session.provider)
                    putString("providerUid", session.providerUid ?: "")
                    putString("providerAccessToken", session.providerAccessToken ?: "")
                    putString("expire", session.expire)
                }
                
                withContext(Dispatchers.Main) {
                    promise.resolve(sessionMap)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("LOGIN_ERROR", "Failed to create email/password session: ${e.message}", e)
                }
            }
        }
    }
    
    @ReactMethod
    fun createAccount(email: String, password: String, name: String?, promise: Promise) {
        if (!::account.isInitialized) {
            promise.reject("NOT_INITIALIZED", "Client not initialized. Call initializeClient first.")
            return
        }
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val user = account.create(
                    userId = "unique()",
                    email = email,
                    password = password,
                    name = name
                )
                
                val userMap = WritableNativeMap().apply {
                    putString("id", user.id)
                    putString("name", user.name)
                    putString("email", user.email)
                    putBoolean("emailVerification", user.emailVerification)
                    putString("phone", user.phone ?: "")
                    putBoolean("phoneVerification", user.phoneVerification)
                    putString("registration", user.registration)
                    putBoolean("status", user.status)
                }
                
                withContext(Dispatchers.Main) {
                    promise.resolve(userMap)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("REGISTER_ERROR", "Failed to create account: ${e.message}", e)
                }
            }
        }
    }
}
