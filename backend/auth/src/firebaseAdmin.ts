import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Load .env first
dotenv.config();

// Get the service account path from env
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT_PATH is not defined in .env or path is incorrect'
  );
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

export const db = admin.firestore();
export const auth = admin.auth();
