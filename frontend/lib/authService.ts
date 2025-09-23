// lib/authService.ts
/**
 * Enhanced authService with connectivity diagnostics
 *
 * - backendPost(path, body, opts) -> throws BackendError on network/timeouts with diagnostics
 * - diagnoseBackendConnectivity(baseUrl, timeout) -> returns quick probe result with suggestions
 * - setBackendUrl / getBackendUrl / setAuthToken available as before
 *
 * NOTE: The diagnostics probe is lightweight and runs only after a network-level failure/timeouts.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  UserCredential,
  User,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
import { Platform } from "react-native";
import Constants from "expo-constants";

/* -------------------------
   Config & platform helpers
   ------------------------- */

const expoExtra = (Constants.expoConfig && (Constants.expoConfig.extra as any)) || (Constants.manifest && (Constants.manifest.extra as any)) || {};
const CONFIG_BACKEND_URL = (expoExtra?.backendUrl as string) || process.env.EXPO_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "";

let runtimeBackendUrlOverride: string | null = null;
let authTokenForBackend: string | null = null;

const isWeb = typeof Platform !== "undefined" && (Platform as any).OS === "web";
const DEFAULT_BACKEND_PORT = expoExtra?.backendPort ?? 3000;

/* -------------------------
   Helpers: derive host from debuggerHost (for physical device dev)
   ------------------------- */
function deriveHostFromDebuggerHost(port = DEFAULT_BACKEND_PORT): string | null {
  try {
    const maybeDbg = (Constants.manifest && (Constants.manifest as any).debuggerHost) || (Constants.expoConfig && (Constants.expoConfig as any).hostUri);
    if (!maybeDbg || typeof maybeDbg !== "string") return null;
    const hostPart = maybeDbg.split(":")[0];
    if (!hostPart) return null;
    return `http://${hostPart}:${port}`;
  } catch {
    return null;
  }
}

/* -------------------------
   Backend URL resolution
   ------------------------- */
export function getBackendUrl(): string {
  if (runtimeBackendUrlOverride) return runtimeBackendUrlOverride.replace(/\/$/, "");
  if (CONFIG_BACKEND_URL && CONFIG_BACKEND_URL.trim()) return CONFIG_BACKEND_URL.replace(/\/$/, "");
  if (isWeb) {
    return ""; // assume same-origin or EXPO_PUBLIC_BACKEND_URL
  }
  if ((Platform as any).OS === "android") return `http://10.0.2.2:${DEFAULT_BACKEND_PORT}`;
  if ((Platform as any).OS === "ios") return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
  // physical device: attempt derive
  const derived = deriveHostFromDebuggerHost(DEFAULT_BACKEND_PORT);
  return derived ?? "";
}

export function setBackendUrl(url: string | null) {
  runtimeBackendUrlOverride = url ? url.replace(/\/$/, "") : null;
}

export function setAuthToken(token: string | null) {
  authTokenForBackend = token ? token : null;
}

/* -------------------------
   BackendError type
   ------------------------- */
export class BackendError extends Error {
  status?: number;
  payload?: any;
  constructor(message: string, status?: number, payload?: any) {
    super(message);
    this.name = "BackendError";
    this.status = status;
    this.payload = payload;
  }
}

/* -------------------------
   Diagnostics probe
   - tries /health and root, short timeouts
   - returns suggestion messages and raw probe results
   ------------------------- */

type ConnectivityDiag = {
  base: string;
  tried: string[];
  reachable: boolean;
  statusCodes?: Record<string, number | null>;
  error?: string;
  suggestion?: string;
};

async function probeUrl(url: string, timeout = 1500): Promise<{ ok: boolean; status?: number; err?: string }> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let tid: any = null;
  if (controller) tid = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { method: "GET", signal: controller?.signal });
    const status = res.status;
    return { ok: res.ok, status, err: undefined };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "timeout" : e?.message ?? String(e);
    return { ok: false, status: undefined, err: msg };
  } finally {
    if (tid) clearTimeout(tid);
  }
}

/**
 * Diagnose backend connectivity for developer-friendly messages.
 * - base: the base URL to probe (e.g., http://10.0.2.2:3000)
 * - timeoutMs: per-probe timeout
 */
export async function diagnoseBackendConnectivity(base: string | null, timeoutMs = 1500): Promise<ConnectivityDiag> {
  const resolvedBase = base ?? getBackendUrl();
  const diag: ConnectivityDiag = { base: resolvedBase, tried: [], reachable: false, statusCodes: {} };
  if (!resolvedBase) {
    diag.error = "No backend URL configured (getBackendUrl() returned empty).";
    diag.suggestion =
      "Set EXPO_PUBLIC_BACKEND_URL in .env or call setBackendUrl('http://<your-lan-ip>:3000') before making requests. For Android emulator use http://10.0.2.2:3000";
    return diag;
  }

  // create candidate endpoints to try
  const candidates = [`${resolvedBase}/health`, `${resolvedBase.replace(/\/$/, "")}/`, resolvedBase];

  for (const url of candidates) {
    diag.tried.push(url);
    try {
      // probeUrl uses GET and small timeout
      // eslint-disable-next-line no-await-in-loop
      const r = await probeUrl(url, timeoutMs);
      diag.statusCodes![url] = r.status ?? null;
      if (r.ok) {
        diag.reachable = true;
        diag.error = undefined;
        diag.suggestion = "Backend reachable. If requests still timeout, check the specific endpoint and server logs.";
        return diag;
      }
      // if probe returned non-ok, keep trying
      if (r.err) diag.error = r.err;
    } catch (e: any) {
      diag.error = e?.message ?? String(e);
    }
  }

  // not reachable - craft suggestion based on platform + base
  let suggestion = "Backend not reachable from this device/emulator.";
  if (resolvedBase.includes("localhost") || resolvedBase.includes("127.0.0.1")) {
    if ((Platform as any).OS === "android") suggestion += " On Android emulator use http://10.0.2.2:3000 instead of localhost.";
    else if ((Platform as any).OS === "ios") suggestion += " On iOS simulator localhost should work (use 127.0.0.1). For physical devices use your machine's LAN IP.";
    else suggestion += " For physical devices use your machine's LAN IP (e.g. http://192.168.x.y:3000).";
  } else {
    suggestion += " Ensure your backend is running, binds to 0.0.0.0 (not only 127.0.0.1), and firewall allows incoming connections on that port.";
  }

  diag.suggestion = suggestion;
  return diag;
}

/* -------------------------
   Safe JSON parse
   ------------------------- */
async function safeParseJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text;
  }
}

/* -------------------------
   backendPost with improved diagnostics on failure
   ------------------------- */
const DEFAULT_TIMEOUT_MS = 10_000;

export async function backendPost(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number; retries?: number }
): Promise<{ ok: boolean; [k: string]: any }> {
  const base = getBackendUrl();
  if (!base) {
    throw new BackendError(
      "Backend URL not configured. Call setBackendUrl('http://<your-lan-ip>:3000') or set EXPO_PUBLIC_BACKEND_URL in .env",
      undefined,
      { diagnostics: { error: "no-backend-url", suggestion: "setBackendUrl or EXPO_PUBLIC_BACKEND_URL" } }
    );
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, opts?.retries ?? 0);

  let attempt = 0;
  let lastErr: any = null;

  while (attempt <= retries) {
    attempt++;
    let controller: AbortController | null = null;
    let timer: any = null;
    try {
      controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (controller) timer = setTimeout(() => controller!.abort(), timeoutMs);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authTokenForBackend) headers["Authorization"] = `Bearer ${authTokenForBackend}`;

      // lightweight masked log
      // eslint-disable-next-line no-console
      console.log(`backendPost -> [${attempt}/${retries + 1}]`, { auth: !!authTokenForBackend, body: typeof body === "object" ? "[object]" : body, url });

      const res = await fetch(url, {
        method: "POST",
        signal: controller?.signal,
        headers,
        body: JSON.stringify(body)
      });

      const text = await res.text().catch(() => "");
      const payload = await safeParseJson(text);

      if (!res.ok) {
        const message = (payload && payload.message) || (typeof payload === "string" ? payload : `Request failed: ${res.status}`);
        throw new BackendError(message, res.status, payload);
      }

      return (payload && typeof payload === "object" ? payload : { ok: true, data: payload });
    } catch (err: any) {
      // timeout
      if (err?.name === "AbortError") {
        // do quick diagnostic probe (short) to provide actionable hints
        const diag = await diagnoseBackendConnectivity(base, 1000).catch(() => null);
        lastErr = new BackendError("Request timed out", undefined, { diagnostics: diag });
      } else if (err instanceof BackendError) {
        // backend returned structured error - for client errors we return immediately
        if (err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }
        lastErr = err;
      } else {
        // network-level error - probe and attach diagnostics
        const diag = await diagnoseBackendConnectivity(base, 1000).catch(() => null);
        lastErr = new BackendError(err?.message ?? "Network error", undefined, { diagnostics: diag });
      }

      // if retry remains, backoff and retry
      if (attempt <= retries) {
        const backoffMs = 200 * Math.pow(2, attempt - 1);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      // no retries left -> throw lastErr (with diagnostics if available)
      throw lastErr;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new BackendError("Unreachable: backendPost exhausted retries", undefined, null);
}

/* -------------------------
   Email validation helper
   ------------------------- */
export function isValidEmail(email?: string) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* -------------------------
   Firebase helpers (unchanged)
   ------------------------- */
export const signupWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    throw new Error(err?.message ?? "Failed to sign up with email");
  }
};

export const loginWithEmail = async (email: string, password: string): Promise<UserCredential> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    throw new Error(err?.message ?? "Failed to sign in with email");
  }
};

export const loginWithGoogle = async (idToken?: string, accessToken?: string): Promise<UserCredential> => {
  try {
    if (isWeb) {
      const provider = new GoogleAuthProvider();
      return await signInWithPopup(auth, provider);
    } else {
      if (!idToken) throw new Error("Missing Google idToken for native sign-in");
      const credential = GoogleAuthProvider.credential(idToken, accessToken ?? undefined);
      return await signInWithCredential(auth, credential);
    }
  } catch (err: any) {
    throw new Error(err?.message ?? "Google login failed");
  }
};

export const loginWithGithub = async (accessToken?: string): Promise<UserCredential> => {
  try {
    if (isWeb) {
      const provider = new GithubAuthProvider();
      return await signInWithPopup(auth, provider);
    } else {
      if (!accessToken) throw new Error("Missing GitHub accessToken for native sign-in");
      const credential = GithubAuthProvider.credential(accessToken);
      return await signInWithCredential(auth, credential);
    }
  } catch (err: any) {
    throw new Error(err?.message ?? "GitHub login failed");
  }
};

export const signInWithFirebaseGoogle = loginWithGoogle;
export const signInWithFirebaseGithub = loginWithGithub;

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (err: any) {
    throw new Error(err?.message ?? "Sign out failed");
  }
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    throw new Error(err?.message ?? "Sending password reset email failed");
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

/* -------------------------
   Backend OTP / password reset helpers
   ------------------------- */

export async function sendSignupOtp(email: string, opts?: { retries?: number }): Promise<void> {
  if (!isValidEmail(email)) throw new BackendError("Invalid email", 400, null);
  const res = await backendPost("/auth/send-otp", { email, purpose: "signup" }, { retries: opts?.retries ?? 0 });
  if (!res.ok) throw new BackendError(res.message ?? "Failed to request signup OTP", res.status ?? undefined, res);
}

export async function verifySignupOtp(email: string, otp: string): Promise<void> {
  if (!isValidEmail(email) || !otp) throw new BackendError("Email and OTP required", 400, null);
  const res = await backendPost("/auth/verify-otp", { email, otp, purpose: "signup" });
  if (!res.ok) throw new BackendError(res.message ?? "Failed to verify signup OTP", res.status ?? undefined, res);
}

export async function requestPasswordResetOtp(email: string): Promise<void> {
  if (!isValidEmail(email)) throw new BackendError("Invalid email", 400, null);
  const res = await backendPost("/auth/send-otp", { email, purpose: "reset" });
  if (!res.ok) throw new BackendError(res.message ?? "Failed to request password reset OTP", res.status ?? undefined, res);
}

export async function verifyPasswordResetOtp(email: string, otp: string, newPassword: string): Promise<void> {
  if (!isValidEmail(email) || !otp || !newPassword) throw new BackendError("email, otp and newPassword are required", 400, null);
  const res = await backendPost("/auth/reset-password", { email, otp, newPassword });
  if (!res.ok) throw new BackendError(res.message ?? "Failed to reset password", res.status ?? undefined, res);
}

/* -------------------------
   Exports
   ------------------------- */

export default {
  signupWithEmail,
  loginWithEmail,
  loginWithGoogle,
  loginWithGithub,
  signInWithFirebaseGoogle,
  signInWithFirebaseGithub,
  signOut,
  sendPasswordReset,
  getCurrentUser,
  onAuthStateChanged,
  sendSignupOtp,
  verifySignupOtp,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  getBackendUrl,
  setBackendUrl,
  setAuthToken,
  isValidEmail,
  backendPost,
  diagnoseBackendConnectivity,
  BackendError,
};
