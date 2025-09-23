// lib/firebaseConfig.ts
import Constants from "expo-constants";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence, Auth } from "firebase/auth";
import { Platform } from "react-native";

/**
 * Read config from expo.extra or process.env (same as before)
 */
const expoExtra = (Constants.expoConfig && (Constants.expoConfig.extra as any)) || (Constants.manifest && (Constants.manifest.extra as any));
const firebaseFromExtra = expoExtra?.firebase ?? {};

const env = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? process.env.FIREBASE_MEASUREMENT_ID,
};

const firebaseConfig = {
  apiKey: firebaseFromExtra?.apiKey ?? env.apiKey ?? "<MISSING_FIREBASE_API_KEY>",
  authDomain: firebaseFromExtra?.authDomain ?? env.authDomain ?? "<MISSING_FIREBASE_AUTH_DOMAIN>",
  projectId: firebaseFromExtra?.projectId ?? env.projectId ?? "<MISSING_FIREBASE_PROJECT_ID>",
  storageBucket: firebaseFromExtra?.storageBucket ?? env.storageBucket ?? "<MISSING_FIREBASE_STORAGE_BUCKET>",
  messagingSenderId: firebaseFromExtra?.messagingSenderId ?? env.messagingSenderId ?? "<MISSING_FIREBASE_MESSAGING_SENDER_ID>",
  appId: firebaseFromExtra?.appId ?? env.appId ?? "<MISSING_FIREBASE_APP_ID>",
  measurementId: firebaseFromExtra?.measurementId ?? env.measurementId ?? undefined,
};

/**
 * Initialize Firebase app once (protects against Fast Refresh)
 */
let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

/**
 * Initialize Auth:
 * - On web: use getAuth (default web persistence)
 * - On native: use initializeAuth + getReactNativePersistence(AsyncStorage)
 *
 * We import AsyncStorage lazily only on native to avoid bundling issues for web.
 */
let firebaseAuth: Auth;
if (Platform.OS === "web") {
  firebaseAuth = getAuth(firebaseApp);
} else {
  // dynamic require to avoid errors in web bundling
  // (expo managed + react-native allow normal import but this is safer)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RNAsyncStorage = require("@react-native-async-storage/async-storage").default;
  firebaseAuth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(RNAsyncStorage),
  });
}

export { firebaseApp };
export const auth: Auth = firebaseAuth;
export default firebaseApp;

/**
 * Optional analytics init helper for web-only (unchanged)
 */
export async function initAnalyticsIfWeb() {
  if (typeof window === "undefined") return;
  try {
    const { getAnalytics } = await import("firebase/analytics");
    try {
      getAnalytics(firebaseApp);
      console.log("Firebase analytics initialized");
    } catch (e) {
      console.warn("Failed to init analytics:", e);
    }
  } catch (e) {
    console.warn("Analytics package not available:", e);
  }
}
