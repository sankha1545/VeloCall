
import "dotenv/config";

export default ({ config }) => {
  // Read env-first, then fall back to existing config.extra if present.
  // Client-facing env variables should use EXPO_PUBLIC_ prefix (Expo requirement).
  const firebase = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? config?.extra?.firebase?.apiKey ?? null,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? config?.extra?.firebase?.authDomain ?? null,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? config?.extra?.firebase?.projectId ?? null,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? config?.extra?.firebase?.storageBucket ?? null,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? config?.extra?.firebase?.messagingSenderId ?? null,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? config?.extra?.firebase?.appId ?? null,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? config?.extra?.firebase?.measurementId ?? undefined, // optional
  };

  
  const envBackend = process.env.EXPO_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL ?? config?.extra?.backendUrl ?? null;
  const DEFAULT_DEV_BACKEND = "http://192.168.0.128:3000"; // safe default for Android emulator
  const backendUrl = envBackend ?? DEFAULT_DEV_BACKEND;

  // OAuth / other extras
  const oauth = {
    expoGoogleClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? config?.extra?.oauth?.expoGoogleClientId ?? null,
    iosGoogleClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? config?.extra?.oauth?.iosGoogleClientId ?? null,
    androidGoogleClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? config?.extra?.oauth?.androidGoogleClientId ?? null,
    webGoogleClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? config?.extra?.oauth?.webGoogleClientId ?? null,
    githubClientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? config?.extra?.oauth?.githubClientId ?? null,
  };

  const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? config?.extra?.appScheme ?? "myapp";

  return {
    ...config,

    extra: {
      backendUrl,
      firebase,
      oauth,
      appScheme,
    },
  };
};
