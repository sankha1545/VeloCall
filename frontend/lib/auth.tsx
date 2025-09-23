// lib/auth.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Key used to persist Firebase ID token or auth token
 */
const TOKEN_KEY = "authToken";

/* -------------------------
   Storage helpers
   ------------------------- */
async function storageGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn(`storageGet failed for key=${key}:`, e);
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (e) {
    console.warn(`storageSet failed for key=${key}:`, e);
  }
}

async function storageDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (e) {
    console.warn(`storageDelete failed for key=${key}:`, e);
  }
}

/* -------------------------
   Auth context types
   ------------------------- */
type PendingSignup = { email: string; password: string } | null;

type AuthContextType = {
  isLoggedIn: boolean | null; // null = loading
  saving: boolean;
  saveToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
  getToken: () => Promise<string | null>;
  pendingSignup: PendingSignup;
  setPendingSignup: (p: PendingSignup) => void;
  clearPendingSignup: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* -------------------------
   Provider component
   ------------------------- */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingSignup, setPendingSignupState] = useState<PendingSignup>(null);

  // Load token on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await storageGet(TOKEN_KEY);
        if (!mounted) return;
        setIsLoggedIn(!!token);
      } catch (e) {
        console.warn("Error loading auth token:", e);
        if (!mounted) return;
        setIsLoggedIn(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Save token
  const saveToken = async (token: string) => {
    setSaving(true);
    try {
      await storageSet(TOKEN_KEY, token);
      setIsLoggedIn(true);
    } catch (e) {
      console.warn("saveToken failed:", e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  // Clear token
  const clearToken = async () => {
    setSaving(true);
    try {
      await storageDelete(TOKEN_KEY);
      setIsLoggedIn(false);
    } catch (e) {
      console.warn("clearToken failed:", e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const getToken = async () => storageGet(TOKEN_KEY);

  const setPendingSignup = (p: PendingSignup) => setPendingSignupState(p);
  const clearPendingSignup = () => setPendingSignupState(null);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        saving,
        saveToken,
        clearToken,
        getToken,
        pendingSignup,
        setPendingSignup,
        clearPendingSignup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* -------------------------
   Hook for consuming context
   ------------------------- */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
