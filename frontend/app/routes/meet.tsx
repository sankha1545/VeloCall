// mobile-app/app/meet.tsx
import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Switch,
  Alert,
  Share,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

/**
 * MeetScreen (Expo / expo-router)
 *
 * - Starts or shares a meeting link served by your signalling/static server.
 * - Fixes navigation issues by using router.push with a pathname+params object
 *   and providing a safe fallback (query-string push) for older expo-router versions.
 */

const SERVER_HOST = "10.0.2.2"; // <- CHANGE to your machine IP or hostname
const SERVER_PORT = "5000"; // <- CHANGE to the port your signalling server is listening on

export default function MeetScreen(): JSX.Element {
  const router = useRouter();
  const [videoOn, setVideoOn] = useState<boolean>(true);
  const [usePMI, setUsePMI] = useState<boolean>(true);

  // Example Personal Meeting ID — replace with a persistent user-specific value if desired
  const PERSONAL_MEETING_ID = "873-448-2461";

  // sanitize PMI -> only keep characters safe for URL/room names
  function sanitizeRoomName(raw: string): string {
    return raw.replace(/[^a-zA-Z0-9-_]/g, "");
  }

  // generate a readable random room name when not using PMI
  function generateRoomName(): string {
    return "room-" + Math.random().toString(36).slice(2, 8);
  }

  // Build the direct client URL (served by your node static server)
  function buildRoomUrl(roomName: string, videoOnBool: boolean) {
    const urlRoom = encodeURIComponent(roomName);
    const videoParam = videoOnBool ? "true" : "false";
    return `http://${SERVER_HOST}:${SERVER_PORT}/client.html?room=${urlRoom}&video=${videoParam}`;
  }

  // Native share dialog
  async function shareMeeting(link: string) {
    try {
      await Share.share({
        message: `Join my meeting: ${link}`,
        url: link,
        title: "Join my meeting",
      });
    } catch (err) {
      console.warn("Share failed", err);
      Alert.alert("Could not share meeting", String(err));
    }
  }

  // Copy link to clipboard using expo-clipboard
  async function copyToClipboard(link: string) {
    try {
      // setStringAsync exists; keep it for async behaviour
      if (Clipboard && typeof Clipboard.setStringAsync === "function") {
        await Clipboard.setStringAsync(link);
      } else if (Clipboard && typeof Clipboard.setString === "function") {
        // older API fallback
        // @ts-ignore
        Clipboard.setString(link);
      } else {
        // ultimate fallback: try Linking (not ideal)
        console.warn("Clipboard API not available");
      }
      Alert.alert("Copied", "Meeting link copied to clipboard");
    } catch (e) {
      console.warn("Clipboard failed", e);
      Alert.alert("Could not copy link", String(e));
    }
  }

  // Start meeting: build link, confirm, then open in-app or share/copy
  async function startMeeting() {
    const roomName = usePMI ? sanitizeRoomName(PERSONAL_MEETING_ID) : generateRoomName();
    const link = buildRoomUrl(roomName, videoOn);

    // Confirm + actions
    Alert.alert(
      "Start meeting",
      `You will create/join the meeting with:\n\n• Room: ${roomName}\n• Video: ${videoOn ? "On" : "Off"}\n\nOpen in app or share link?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open in app",
// inside startMeeting() — use this navigation block
onPress: async () => {
  console.log("Navigating to meeting route with url:", link);

  try {
    // Use the pathname that TypeScript's union accepts.
    // From the error message you showed, the correct path appears to be "/routes/subroutes/meeting"
    await router.push({ pathname: "/routes/subroutes/meeting", params: { url: link } });
  } catch (err) {
    console.warn("router.push(object) failed, falling back to string push:", err);
    try {
      // Fallback string push — cast to any so TS won't complain about the template string.
      // Runtime still receives the correct path+query.
      await router.push((`/routes/subroutes/meeting?url=${encodeURIComponent(link)}`) as unknown as any);
    } catch (err2) {
      console.error("Navigation failed (both methods):", err2);
      Alert.alert("Navigation error", "Could not open meeting route in-app.\nOpening external link instead.");
      Linking.openURL(link).catch((e) => console.error("Linking.openURL failed:", e));
    }
  }
}

        },
        {
          text: "Share",
          onPress: () => shareMeeting(link),
        },
        {
          text: "Copy",
          onPress: () => copyToClipboard(link),
        },
      ],
      { cancelable: true }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => {}} style={styles.headerLeft}>
          <Text style={styles.cancelText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start a meeting</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Video on</Text>
        <Switch
          value={videoOn}
          onValueChange={setVideoOn}
          trackColor={{ false: "#555", true: "#34c759" }}
          thumbColor={Platform.OS === "android" ? (videoOn ? "#fff" : "#fff") : undefined}
          accessibilityLabel="Toggle video on"
        />
      </View>

      <View style={styles.optionRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.optionLabel}>Use personal meeting ID (PMI)</Text>
          <Text style={styles.subText}>{PERSONAL_MEETING_ID}</Text>
        </View>
        <Switch
          value={usePMI}
          onValueChange={setUsePMI}
          trackColor={{ false: "#555", true: "#34c759" }}
          thumbColor={Platform.OS === "android" ? (usePMI ? "#fff" : "#fff") : undefined}
          accessibilityLabel="Toggle use personal meeting ID"
        />
      </View>

      <TouchableOpacity
        style={styles.startButton}
        activeOpacity={0.9}
        onPress={startMeeting}
        accessibilityRole="button"
        accessibilityLabel="Start a meeting"
      >
        <Text style={styles.startButtonText}>Start a meeting</Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }} />
    </SafeAreaView>
  );
}

/* Styles (unchanged) */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1112",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  cancelText: {
    color: "#2b7cf0",
    fontSize: 16,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 48,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: "#161617",
  },
  optionLabel: {
    color: "#cfcfcf",
    fontSize: 16,
  },
  subText: {
    color: "#9aa0a6",
    fontSize: 12,
    marginTop: 4,
  },
  startButton: {
    marginTop: 30,
    alignSelf: "center",
    width: "90%",
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e6fff",
  },
  startButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
