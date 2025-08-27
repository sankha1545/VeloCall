// lib/auth.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Cross-platform storage wrapper:
 * - On web: localStorage
 * - On native: expo-secure-store (wrapped safely)
 *
 * This avoids calling internal/native-only methods that may not exist
 * in some environments (which was causing getValueWithKeyAsync errors).
 */

const TOKEN_KEY = "authToken";

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return Promise.resolve(localStorage.getItem(key));
    } catch (e) {
      console.warn("localStorage.getItem failed:", e);
      return null;
    }
  }

  try {
    // use the documented expo-secure-store API surface
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn("SecureStore.getItemAsync failed:", e);
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (e) {
      console.warn("localStorage.setItem failed:", e);
      return Promise.resolve();
    }
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn("SecureStore.setItemAsync failed:", e);
  }
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (e) {
      console.warn("localStorage.removeItem failed:", e);
      return Promise.resolve();
    }
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn("SecureStore.deleteItemAsync failed:", e);
  }
}

/* ---------- Auth context & provider ---------- */

type AuthContextType = {
  isLoggedIn: boolean | null; // null = still loading
  saving: boolean;
  saveToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await storageGet(TOKEN_KEY);
        if (!mounted) return;
        setIsLoggedIn(!!token);
      } catch (e) {
        console.warn("Error loading token:", e);
        if (!mounted) return;
        setIsLoggedIn(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveToken = async (token: string) => {
    setSaving(true);
    try {
      await storageSet(TOKEN_KEY, token);
      setIsLoggedIn(true);
    } catch (e) {
      console.warn("saveToken failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const clearToken = async () => {
    setSaving(true);
    try {
      await storageDelete(TOKEN_KEY);
      setIsLoggedIn(false);
    } catch (e) {
      console.warn("clearToken failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const getToken = async () => {
    try {
      return await storageGet(TOKEN_KEY);
    } catch (e) {
      console.warn("getToken failed:", e);
      return null;
    }
  };

  // while isLoggedIn is null we are "loading" — return children anyway,
  // but screens should check isLoggedIn === null if they need to wait.
  return (
    <AuthContext.Provider value={{ isLoggedIn, saving, saveToken, clearToken, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
