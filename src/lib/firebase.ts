import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "norse-xray-zj9st",
  appId: "1:686619674605:web:9cbefb6c9ec77d803809e4",
  apiKey: "AIzaSyAzOBtvYMbgELJApG5GwFP7D5B-Sw8UvVg",
  authDomain: "norse-xray-zj9st.firebaseapp.com",
  storageBucket: "norse-xray-zj9st.firebasestorage.app",
  messagingSenderId: "686619674605",
};

let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, "ai-studio-mandatosportfoli-5d32d764-dae7-4f6c-a56c-6a8c3566f84a");
export const auth = getAuth(app);
