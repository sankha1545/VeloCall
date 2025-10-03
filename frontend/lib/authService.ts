// app/lib/authService.ts
import axios, { AxiosInstance } from "axios";

/**
 * Small TypeScript helper that mirrors the JavaScript helper.
 * It intentionally returns a "firebase-like" userCred object:
 *   { user: { getIdToken(): Promise<string> } }
 *
 * That preserves compatibility with your existing UI code which
 * calls userCred.user.getIdToken().
 */

/* ---------- Types ---------- */
export class BackendError extends Error {
  payload?: any;
  constructor(message?: string, payload?: any) {
    super(message);
    this.name = "BackendError";
    this.payload = payload;
  }
}

type UserCred = {
  user: {
    getIdToken: () => Promise<string>;
  };
};

let backendUrl = "";
export function setBackendUrl(url: string) {
  backendUrl = url.replace(/\/+$/, "");
}
export function getBackendUrl() {
  return backendUrl;
}

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

function api(): AxiosInstance {
  const instance = axios.create({
    baseURL: (backendUrl || "") + "/api/auth",
    timeout: 15000,
  });
  if (authToken) instance.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
  return instance;
}

function makeUserCred(accessToken: string): UserCred {
  return {
    user: {
      async getIdToken() {
        return accessToken;
      },
    },
  };
}

/* ---------- Auth functions (called by your screens) ---------- */

export async function sendSignupOtp(email: string): Promise<boolean> {
  try {
    await api().post("/signup/otp", { email });
    return true;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Network error", e?.response?.data);
  }
}

export async function verifySignupOtp(email: string, otp: string): Promise<boolean> {
  try {
    await api().post("/signup/otp/verify", { email, otp });
    return true;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Verification failed", e?.response?.data);
  }
}

export async function signupWithEmail(email: string, password: string): Promise<UserCred> {
  try {
    const r = await api().post("/signup", { email, password });
    const accessToken: string = r.data.accessToken;
    // keep compatibility with front-end expecting userCred.user.getIdToken()
    return makeUserCred(accessToken);
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Signup failed", e?.response?.data);
  }
}

export async function loginWithEmail(email: string, password: string): Promise<UserCred> {
  try {
    const r = await api().post("/login", { email, password });
    const at: string = r.data.accessToken;
    const rt: string | undefined = r.data.refreshToken;
    // set auth header for subsequent backend calls (optional)
    setAuthToken(at);
    return makeUserCred(at);
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Login failed", e?.response?.data);
  }
}

export async function requestPasswordResetOtp(email: string): Promise<boolean> {
  try {
    await api().post("/password-reset/otp", { email });
    return true;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Failed to request reset OTP", e?.response?.data);
  }
}

export async function verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
  try {
    await api().post("/password-reset/otp/verify", { email, otp });
    return true;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Reset OTP verification failed", e?.response?.data);
  }
}

export async function resetPassword(email: string, newPassword: string): Promise<boolean> {
  try {
    await api().post("/password-reset", { email, newPassword });
    return true;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Password reset failed", e?.response?.data);
  }
}

/* ---------- Social login wrappers ---------- */

export async function loginWithGoogle(idToken?: string, accessToken?: string): Promise<UserCred> {
  try {
    const r = await api().post("/oauth/google", { idToken, accessToken });
    const at: string = r.data.accessToken;
    setAuthToken(at);
    return makeUserCred(at);
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Google login failed", e?.response?.data);
  }
}

export async function loginWithGithub(accessToken: string): Promise<UserCred> {
  try {
    const r = await api().post("/oauth/github", { accessToken });
    const at: string = r.data.accessToken;
    setAuthToken(at);
    return makeUserCred(at);
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Github login failed", e?.response?.data);
  }
}

/* ---------- Token helpers ---------- */

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  try {
    const r = await api().post("/refresh", { refreshToken });
    const at: string = r.data.accessToken;
    setAuthToken(at);
    return at;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Refresh failed", e?.response?.data);
  }
}

export async function logout(refreshToken: string): Promise<boolean> {
  try {
    await api().post("/logout", { refreshToken });
    setAuthToken(null);
    return true;
  } catch (e: any) {
    throw new BackendError(e?.response?.data?.message ?? e?.message ?? "Logout failed", e?.response?.data);
  }
}
