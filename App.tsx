import { StatusBar, Text, View, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import React, { useState } from 'react';

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import * as firebaseAuth from "firebase/auth";
import CustomBox from "react-native-customized-box";
import { NativeModules } from 'react-native';
import PdfTextExtractor from './utils/PdfTextExtractor';
// import { pick } from '@react-native-documents/picker'

const firebaseConfig = {
  apiKey: "config.API_KEY",
  authDomain: "config.AUTH_DOMAIN",
  projectId: "config.PROJECT_ID",
  storageBucket: "config.STORAGE_BUCKET",
  messagingSenderId: "config.MESSAGING_SENDER_ID",
  appId: "config.APP_ID",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const dbAuth = getFirestore(app);


function App() {

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={'light-content'} />
      <AppContent />
    </View>
  );
}


function Login() {

  const [getEmailId, setEmailId] = useState("");
  const [getPassword, setPassword] = useState("");
  const [getError, setError] = useState(false);
  const [throwError, setThrowError] = useState("");
  const [getDisabled, setDisabled] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);


  const loginFunction = () => {
    setDisabled(true);
    setLoading(true);
    if (getEmailId === "") {
      setEmailError("*This is Required");
    }
    if (getPassword === "") {
      setPasswordError("*This is Required");
    }
    if (getEmailId !== "" && getPassword !== "") {
      firebaseAuth
        .signInWithEmailAndPassword(auth, getEmailId, getPassword)
        .then((u) => {
          setEmailId("");
          setPassword("");
          // navigation.replace("Splash");
        })
        .catch((err) => {
          setDisabled(false);
          setLoading(false);
          setError(true);
          setThrowError("Sorry! User not found / Incoreect Password");
          setPassword("");
        });
    } else {
      setDisabled(false);
      setLoading(false);
      setError(true);
      setThrowError("Please Enter the Email and Password carefully");
    }
  };

  return (
    <View style={styles.container}>
      {getError ? (
        <View style={styles.errorCard}>
          <TouchableOpacity
            style={styles.cross}
            onPress={() => {
              setError(false);
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>X</Text>
          </TouchableOpacity>
          <Text style={styles.errorCardText}>{throwError}</Text>
        </View>
      ) : null}

      <CustomBox
        placeholder={"Email"}
        boxColor={"dodgerblue"}
        focusColor={"#e65c40"}
        keyboardType="email-address"
        boxStyle={{ borderRadius: 40, borderWidth: 2 }}
        inputStyle={{
          fontWeight: "bold",
          color: "#30302e",
          paddingLeft: 20,
          borderRadius: 40,
        }}
        labelConfig={{
          text: "Email",
          style: {
            color: "#0e0e21",
            fontWeight: "bold",
          },
        }}
        requiredConfig={{
          text: emailError,
          style: {}
        }}
        values={getEmailId}
        onChangeText={(value) => {
          setEmailId(value);
          setError(false);
          setEmailError("");
        }}
      />
      <CustomBox
        placeholder={"Password"}
        toggle={true}
        boxColor={"dodgerblue"}
        focusColor={"#e65c40"}
        boxStyle={{ borderRadius: 40, borderWidth: 2 }}
        inputStyle={{
          fontWeight: "bold",
          color: "#30302e",
          paddingLeft: 20,
          borderRadius: 40,
        }}
        labelConfig={{
          text: "Password",
          style: {
            color: "#0e0e21",
            fontWeight: "bold",
          },
        }}
        requiredConfig={{
          text: passwordError,
          style: {}
        }}
        values={getPassword}
        onChangeText={(value) => {
          setPassword(value);
          setError(false);
          setPasswordError("");
        }}
      />


      <TouchableOpacity
        style={styles.forgotBtn}
        onPress={() => {
          // navigation.navigate("ForgotPassword");
        }}
      >
        <Text style={styles.forgotBtnText}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Login Button */}
      <TouchableOpacity
        style={styles.loginBtn}
        onPress={loginFunction}
        disabled={getDisabled}
      >
        <Text style={styles.loginBtnText}>LogIn</Text>
        {loading && loading ? (
          <ActivityIndicator color={"white"} />
        ) : null}
      </TouchableOpacity>

      {/* Register Button */}
      <View style={styles.createAccount}>
        <Text style={styles.createAccountText}>
          {`Don't have an Account? `}
        </Text>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => {
            // navigation.navigate("Register");
          }}
        >
          <Text style={styles.registerBtnText}>Register for Free!</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  errorCard: {
    width: 300,
    height: 50,
    backgroundColor: "#de3138",
    justifyContent: "center",
    paddingLeft: 15,
    borderRadius: 40,
  },
  errorCardText: {
    paddingLeft: 15,
    color: "white",
    fontSize: 12,
    fontWeight: "500",
    position: "absolute",
  },
  cross: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -20,
    left: 250,
    position: "relative",
  },
  loginImage: {
    marginTop: 20,
    width: 200,
    height: 200,
  },
  header: {
    fontSize: 25,
  },
  loginBtn: {
    marginTop: 10,
    backgroundColor: "dodgerblue",
    width: 300,
    height: 50,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  loginBtnText: {
    color: "white",
    fontSize: 22,
  },
  forgotBtn: {
    marginTop: -20,
    width: 280,
    height: 20,
    justifyContent: "center",
  },
  forgotBtnText: {
    color: "#c29700",
    fontSize: 12,
    alignSelf: "flex-end",
    textDecorationLine: "underline",
  },
  createAccount: {
    marginTop: 10,
    width: 280,
    height: 20,
    flexDirection: "row",
  },
  createAccountText: {
    color: "grey",
  },
  registerBtn: {},
  registerBtnText: {
    color: "#e65c40",
    textDecorationLine: "underline",
  },
  myLogo: {
    width: 100,
    height: 70,
    borderRadius: 40,
    left: 150,
    top: 10,
    marginBottom: 10,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 10,
    minWidth: 250,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});




function AppContent() {
  // const Stack = createNativeStackNavigator();

  // State for PDF extraction result
  const [uploading, setUploading] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  // Upload and extract PDF
  const handleUploadAndExtract = async () => {
    setUploading(true);
    setExtractedText(null);
    setPdfInfo(null);
    setError(null);
    try {
      // const [result] = await pick({
      //   mode: 'open',
      // })
      // console.log(result)
      // const res = await PdfTextExtractor.extractPdfText(result.uri);

      // console.log('Extraction result:', res);
      // if (result.) {
      //   setExtractedText(result.text);
      //   setPdfInfo(result.metadata);
      // } else {
      //   setError(result.error || 'Unknown extraction error');
      // }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' }}>
        PDF Text Extraction
      </Text>
      <Text style={{ fontSize: 16, color: '#666', marginBottom: 20, textAlign: 'center' }}>
        Native iText Module
      </Text>

      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: uploading ? '#aaa' : '#2196F3' }]}
        onPress={handleUploadAndExtract}
        disabled={uploading}
      >
        <Text style={styles.testButtonText}>{uploading ? 'Processing...' : '📤 Upload & Extract PDF'}</Text>
      </TouchableOpacity>

      {uploading && (
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={{ marginTop: 10, color: '#666' }}>Extracting text using iText...</Text>
        </View>
      )}

      {extractedText && (
        <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginVertical: 10, width: '90%', maxHeight: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16, color: '#333' }}>📝 Extracted Text</Text>
          <Text style={{ fontSize: 12, color: '#333', lineHeight: 16 }} numberOfLines={20} ellipsizeMode="tail">{extractedText}</Text>
        </View>
      )}

      <Text style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 20, paddingHorizontal: 20 }}>
        ✨ Using native iText library for high-quality PDF text extraction{'\n'}
        🚀 Better performance than Python-based extraction{'\n'}
        📱 Built for React Native Android
      </Text>
    </View>
  );
}

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'white',
//     paddingHorizontal: 20,
//   },
//   loginButton: {
//     backgroundColor: '#4285F4',
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     borderRadius: 8,
//     elevation: 2,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//     minWidth: 200,
//     alignItems: 'center',
//   },
//   loginButtonText: {
//     color: 'white',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   loginButtonDisabled: {
//     opacity: 0.6,
//   },
// });

export default App;
