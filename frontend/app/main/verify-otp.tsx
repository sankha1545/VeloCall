// app/main/verify-otp.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useSearchParams } from "expo-router";
import { verifySignupOtp, requestPasswordResetOtp, verifyPasswordResetOtp, sendSignupOtp } from "../../lib/authService";
import { useAuth } from "../../lib/auth";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const rawMode = params.mode as string | undefined;
  const mode = rawMode === "reset" ? "reset" : "signup"; // default to signup
  const emailParam = (params.email as string) ?? "";

  const { pendingSignup, setPendingSignup, clearPendingSignup } = useAuth();

  const emailFromContext = pendingSignup?.email ?? null;
  const [email, setEmail] = useState<string>(emailParam ?? emailFromContext ?? "");
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Resend timer
  const [countdown, setCountdown] = useState<number>(60);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000) as unknown as number;
  }

  async function handleVerify() {
    setLoading(true);
    try {
      if (!email) {
        throw new Error("Email is required.");
      }
      if (!otp) {
        throw new Error("Please enter the verification code.");
      }

      if (mode === "signup") {
        await verifySignupOtp(email, otp); // server verifies OTP
        // OTP valid -> proceed to password entry
        setPendingSignup({ email, password: "" });
        router.replace({ pathname: "/main/SignupPassword", params: { email } });
      } else {
        // password reset flow
        // user must supply new password on this screen or on next screen; we'll expect newPassword param via prompt below
        // For simplicity we redirect to SignupPassword-like flow but in 'reset' mode.
        // Instead, we'll ask user for new password inline if you prefer; for now redirect to SignupPassword and include mode=reset
        router.replace({ pathname: "/main/SignupPassword", params: { mode: "reset", email } });
      }
    } catch (err: any) {
      console.warn("OTP verify error", err);
      Alert.alert("please enter the correct otp", err?.message ?? "Unable to verify code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      Alert.alert("Enter email", "Please provide your email first.");
      return;
    }

    try {
      setLoading(true);
      await sendSignupOtp(email); // reuse same send endpoint for signup OTP
      startCountdown();
      Alert.alert("Code resent", "A new verification code was sent to your email.");
    } catch (err: any) {
      console.warn("Resend OTP failed", err);
      Alert.alert("Resend failed", err?.message ?? "Unable to resend code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{mode === "signup" ? "Verify your email" : "Reset password"}</Text>
        <Text style={styles.subtitle}>
          {mode === "signup" ? "Enter the OTP sent to your email to continue." : "Enter the OTP sent to your email to reset your password."}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!loading && mode === "reset" /* for reset allow changing email here */ ? true : !loading}
        />

        <TextInput style={styles.input} placeholder="One-time code" value={otp} onChangeText={setOtp} keyboardType="number-pad" />

        <Pressable style={[styles.button, loading && styles.btnDisabled]} onPress={handleVerify} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>{mode === "signup" ? "Verify & continue" : "Verify code"}</Text>}
        </Pressable>

        <View style={styles.row}>
          <Text style={styles.smallText}>Didn't receive it?</Text>
          <Pressable style={countdown > 0 ? styles.disabledResend : styles.resendBtn} onPress={handleResend} disabled={countdown > 0 || loading}>
            <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable style={styles.linkBtn} onPress={() => router.replace("/main/signup")}>
            <Text style={styles.linkText}>Back to signup</Text>
          </Pressable>

          <Pressable style={styles.linkBtn} onPress={() => router.replace("/main/login")}>
            <Text style={styles.linkText}>Back to login</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "#fff" },
  card: { width: "100%", maxWidth: 420, padding: 18, borderRadius: 12, backgroundColor: "#fff" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6, color: "#0b1220" },
  subtitle: { fontSize: 13, color: "#475569", marginBottom: 12 },
  input: { borderRadius: 8, padding: 12, backgroundColor: "#f1f5f9", marginBottom: 8 },
  button: { marginTop: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: "#7c3aed", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, alignItems: "center" },
  smallText: { color: "#475569" },
  resendBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  disabledResend: { paddingHorizontal: 8, paddingVertical: 4, opacity: 0.6 },
  resendText: { color: "#7c3aed", fontWeight: "700" },
  resendTextDisabled: { color: "#9aa8d3" },
  linkBtn: {},
  linkText: { color: "#7c3aed", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
});
