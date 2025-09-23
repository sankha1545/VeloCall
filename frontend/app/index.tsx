// app/index.tsx
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../lib/auth"; // adjust path if needed

export default function Index() {
  const { isLoggedIn } = useAuth(); // isLoggedIn === null while loading
  const router = useRouter();

  useEffect(() => {
    // Wait until auth provider finishes initializing
    if (isLoggedIn === null) return;

    if (isLoggedIn) {
      // Already authenticated — go to tabs
      router.replace("/(tabs)");
    } else {
      // Not authenticated — show login
      router.replace("/main/login");
    }
  }, [isLoggedIn, router]);

  // show a small loader while checking auth state
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessible>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
