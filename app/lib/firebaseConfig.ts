// lib/firebaseConfig.ts
import Constants from "expo-constants";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

/**
 * Prefer reading config from expo.extra (app.json / app.config.js) or env vars.
 * This keeps keys out of source control for production builds.
 */
const expoExtra = (Constants.expoConfig && (Constants.expoConfig.extra as any)) || (Constants.manifest && (Constants.manifest.extra as any));
const firebaseFromExtra = expoExtra?.firebase ?? {};

const firebaseConfig = {
  apiKey: firebaseFromExtra?.apiKey ?? process.env.FIREBASE_API_KEY ?? "<YOUR_API_KEY>",
  authDomain: firebaseFromExtra?.authDomain ?? process.env.FIREBASE_AUTH_DOMAIN ?? "<YOUR_PROJECT>.firebaseapp.com",
  projectId: firebaseFromExtra?.projectId ?? process.env.FIREBASE_PROJECT_ID ?? "<YOUR_PROJECT_ID>",
  storageBucket: firebaseFromExtra?.storageBucket ?? process.env.FIREBASE_STORAGE_BUCKET ?? "<YOUR_PROJECT>.appspot.com",
  messagingSenderId: firebaseFromExtra?.messagingSenderId ?? process.env.FIREBASE_MESSAGING_SENDER_ID ?? "<YOUR_MSG_SENDER_ID>",
  appId: firebaseFromExtra?.appId ?? process.env.FIREBASE_APP_ID ?? "<YOUR_APP_ID>",
  // measurementId: firebaseFromExtra?.measurementId ?? process.env.FIREBASE_MEASUREMENT_ID, // optional for analytics on web
};

/**
 * Initialize Firebase only once (protects against Fast Refresh re-inits)
 */
let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

/** Export app + auth for use across the app */
export { firebaseApp };
export const auth: Auth = getAuth(firebaseApp);
export default firebaseApp;
