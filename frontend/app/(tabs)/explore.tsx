// app/(tabs)/explore.tsx
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";

export default function TabTwoScreen() {
  const router = useRouter();
  const { clearToken, saving } = useAuth();

  const onLogoutConfirm = useCallback(() => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              await clearToken();
              // navigate to login. index.tsx will decide final redirect if you use that.
              router.replace("/main/login");
            } catch (e) {
              console.warn("Logout failed", e);
              Alert.alert("Logout failed", "Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [clearToken, router]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ dark: "#ffff" }}
      // you can pass other props your ParallaxScrollView expects
    >
      {/* Header row with title + logout button */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Explore</Text>

        {/* Logout button */}
        <Pressable
          onPress={onLogoutConfirm}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          accessibilityHint="Signs you out and returns to the login screen"
        >
          {saving ? (
            <ActivityIndicator size="small" />
          ) : (
            <Feather
              name="log-out"
              size={20}
              color={Platform.OS === "web" ? "#f4f7ffff" : "#497ccaff"}
            />
          )}
        </Pressable>
      </View>

      {/* Keep your content below — this is placeholder content */}
      <View style={styles.content}>
        <Text style={styles.paragraph}>
          Welcome to Explore — your app content goes here.
        </Text>
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  logoutBtn: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  btnPressed: {
    opacity: 0.75,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  paragraph: {
    fontSize: 15,
    color: "#0f172a",
  },
});
