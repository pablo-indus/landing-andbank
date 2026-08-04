import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app;

try {
    if (!getApps().length) {
        app = initializeApp({
          credential: applicationDefault(), projectId: "norse-xray-zj9st"
        });
    } else {
        app = getApps()[0];
    }
} catch (e) {
    console.error("Error initializing Firebase Admin", e);
}

export const db = getFirestore(app, "ai-studio-mandatosportfoli-5d32d764-dae7-4f6c-a56c-6a8c3566f84a");
db.settings({ preferRest: true });
export const auth = getAuth();
