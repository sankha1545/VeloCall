// app/main/Signup.tsx
import React, { useEffect, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { Controller, useForm } from "react-hook-form";

import { useAuth } from "../../lib/auth";
import {
  sendSignupOtp,
  verifySignupOtp,
  signupWithEmail,
  setBackendUrl,
  getBackendUrl,
  BackendError,
  setAuthToken,
} from "../../lib/authService";

/* ---------- Animated Logo (matching Login) ---------- */
function AnimatedLogo({ size = 88 }: { size?: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    const rot = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }));

    pulse.start();
    rot.start();
    return () => {
      pulse.stop();
      rot.stop();
    };
  }, [scale, spin]);

  const interpolatedScale = scale.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      accessible
      accessibilityLabel="App logo"
      accessibilityHint="Animated branding logo"
      style={[
        styles.logoContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 6,
          transform: [{ scale: interpolatedScale }, { rotate }],
        },
      ]}
    >
      <LinearGradient colors={["#7c3aed", "#06b6d4"]} style={[StyleSheet.absoluteFill, { borderRadius: size / 6 }]} start={[0, 0]} end={[1, 1]} />
      <View style={[StyleSheet.absoluteFill, styles.logoOverlay]}>
        <Text style={styles.logoLetter}>A</Text>
      </View>
    </Animated.View>
  );
}

/* ---------- Form types ---------- */
type EmailForm = { email: string };
type OtpForm = { otp: string; password: string; confirmPassword: string };

/* ---------- Component ---------- */
export default function SignupScreen(): JSX.Element {
  const router = useRouter();
  const { saveToken } = useAuth();

  // Forms
  const {
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors, isSubmitting: emailSubmitting },
  } = useForm<EmailForm>({ defaultValues: { email: "" }, mode: "onTouched" });

  const {
    control: otpControl,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: otpSubmitting },
  } = useForm<OtpForm>({ defaultValues: { otp: "", password: "", confirmPassword: "" }, mode: "onTouched" });

  // Flow state
  const [step, setStep] = useState<"enterEmail" | "verifyOtp">("enterEmail");
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP resend cooldown
  const RESEND_COOLDOWN = 60; // seconds
  const [cooldown, setCooldown] = useState<number>(0);
  const cooldownRef = useRef<number | null>(null);

  // last email used (for verify)
  const [pendingEmail, setPendingEmail] = useState<string>("");

  // On mount: set backend url if expo.extra provides backendUrl OR derive from debuggerHost if none
  useEffect(() => {
    const expoExtra = (Constants.expoConfig && (Constants.expoConfig.extra as any)) || (Constants.manifest && (Constants.manifest.extra as any));
    const backend = expoExtra?.backendUrl as string | undefined;
    if (backend && typeof backend === "string" && backend.trim()) {
      setBackendUrl(backend);
      // eslint-disable-next-line no-console
      console.log("Using expo.extra.backendUrl =>", backend);
    } else {
      // try to derive host from debuggerHost (useful when testing on physical device)
      const maybeDebuggerHost = (Constants.manifest && (Constants.manifest as any).debuggerHost) || (Constants.expoConfig && (Constants.expoConfig as any).hostUri);
      if (maybeDebuggerHost && typeof maybeDebuggerHost === "string") {
        const host = maybeDebuggerHost.split(":")[0];
        if (host && host !== "localhost") {
          const inferred = `http://${host}:3000`; // default backend port 3000
          setBackendUrl(inferred);
          // eslint-disable-next-line no-console
          console.log("Inferred backend URL from debuggerHost =>", inferred);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log("Final resolved backend URL:", getBackendUrl() || "<none>");
    return () => {
      // cleanup no-op
    };
  }, []);

  // countdown ticker
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }
    if (!cooldownRef.current) {
      cooldownRef.current = setInterval(() => {
        setCooldown((s) => Math.max(0, s - 1));
      }, 1000) as unknown as number;
    }
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [cooldown]);

  // cleanup interval on unmount just in case
  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, []);

  /* ---------- Handlers ---------- */

  async function onRequestOtp(data: EmailForm) {
    setServerError(null);
    Keyboard.dismiss();
    setLoading(true);
    try {
      await sendSignupOtp(data.email.trim());
      setPendingEmail(data.email.trim());
      setStep("verifyOtp");
      setCooldown(RESEND_COOLDOWN);
      Alert.alert("OTP sent", `A one-time password has been sent to ${data.email.trim()}`);
    } catch (err: any) {
      // unify error handling
      console.warn("Send signup OTP error:", err);
      if (err instanceof BackendError) {
        // show backend message if available (e.g., SMTP 550)
        const payloadMsg = err.payload?.message ?? err.message;
        Alert.alert("OTP failed", payloadMsg ?? "Unable to send OTP");
        setServerError(payloadMsg ?? err.message);
      } else {
        Alert.alert("OTP failed", err?.message ?? "Unable to send OTP");
        setServerError(err?.message ?? "Unable to send OTP");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyAndSignup(data: OtpForm) {
    setServerError(null);
    Keyboard.dismiss();

    if (data.password !== data.confirmPassword) {
      setServerError("Passwords do not match");
      return;
    }
    if (data.password.length < 6) {
      setServerError("Password must be at least 6 characters");
      return;
    }
    if (!pendingEmail) {
      setServerError("No email found to verify. Please request an OTP first.");
      return;
    }

    setLoading(true);
    try {
      // verify OTP server-side
      await verifySignupOtp(pendingEmail, data.otp.trim());

      // create Firebase user
      const userCred = await signupWithEmail(pendingEmail, data.password);
      // get id token
      const idToken = await userCred.user.getIdToken();
      // set backend auth token (raw id token) for subsequent backend calls
      try {
        setAuthToken(idToken);
      } catch (e) {
        // non-fatal — continue
        // eslint-disable-next-line no-console
        console.warn("setAuthToken failed:", e);
      }
      // persist token via useAuth; keep legacy prefix used elsewhere if present
      await saveToken(`firebase:${idToken}`);

      Alert.alert("Account created", "Your account has been created successfully.");
      router.replace("/");
    } catch (err: any) {
      console.warn("Verify signup error:", err);
      if (err instanceof BackendError) {
        const payloadMsg = err.payload?.message ?? err.message;
        Alert.alert("Signup failed", payloadMsg ?? "Unable to verify OTP or create account");
        setServerError(payloadMsg ?? err.message);
      } else {
        Alert.alert("Signup failed", err?.message ?? "Unable to verify OTP or create account");
        setServerError(err?.message ?? "Unable to verify OTP or create account");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResendOtp() {
    if (cooldown > 0) return;
    if (!pendingEmail) {
      setServerError("No email to resend OTP to. Please enter your email first.");
      return;
    }
    setLoading(true);
    try {
      await sendSignupOtp(pendingEmail);
      setCooldown(RESEND_COOLDOWN);
      Alert.alert("OTP resent", `A new OTP has been sent to ${pendingEmail}`);
    } catch (err: any) {
      console.warn("Resend OTP error:", err);
      Alert.alert("Resend failed", err?.message ?? "Unable to resend OTP");
      setServerError(err?.message ?? "Resend failed");
    } finally {
      setLoading(false);
    }
  }

  function onBackToEmail() {
    setServerError(null);
    setStep("enterEmail");
  }

  /* ---------- UI ---------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
          <View style={styles.topLogoWrap}>
            <AnimatedLogo size={96} />
            <Text style={styles.appName}>App Name</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.brandTextWrap}>
                <Text style={styles.title}>Create an account</Text>
                <Text style={styles.subtitle}>Sign up with email and a one-time code</Text>
              </View>
            </View>

            {step === "enterEmail" && (
              <View style={styles.form}>
                <Controller
                  control={emailControl}
                  name="email"
                  rules={{
                    required: "Email is required",
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.group}>
                      <View style={[styles.input, emailErrors.email && styles.inputError]}>
                        <Feather name="mail" size={16} color="#64748b" style={styles.icon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="you@company.com"
                          placeholderTextColor="#94a3b8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          accessible
                          accessibilityLabel="Email"
                          returnKeyType="next"
                          importantForAutofill="yes"
                          editable={!emailSubmitting && !loading}
                        />
                      </View>
                      {emailErrors.email && <Text style={styles.error}>{emailErrors.email.message?.toString()}</Text>}
                    </View>
                  )}
                />

                {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

                <Pressable
                  onPress={handleEmailSubmit(onRequestOtp)}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, (emailSubmitting || loading) && styles.btnDisabled]}
                  disabled={emailSubmitting || loading}
                  accessibilityRole="button"
                  accessibilityState={{ busy: emailSubmitting || loading }}
                >
                  {emailSubmitting || loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
                </Pressable>

                <Text style={styles.divider}>or continue with</Text>

                <Text style={styles.signup}>
                  Already have an account?{" "}
                  <Text
                    style={styles.link}
                    onPress={() => {
                      router.replace("/main/login");
                    }}
                    accessibilityRole="link"
                  >
                    Sign in
                  </Text>
                </Text>
              </View>
            )}

            {step === "verifyOtp" && (
              <View style={styles.form}>
                <Text style={{ marginBottom: 8, color: "#374151" }}>OTP sent to {pendingEmail}</Text>

                <Controller
                  control={otpControl}
                  name="otp"
                  rules={{
                    required: "OTP is required",
                    minLength: { value: 4, message: "Invalid OTP" },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.group}>
                      <View style={[styles.input, otpErrors.otp && styles.inputError]}>
                        <Feather name="hash" size={16} color="#64748b" style={styles.icon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter OTP"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          accessible
                          accessibilityLabel="OTP"
                          returnKeyType="next"
                          editable={!otpSubmitting && !loading}
                        />
                      </View>
                      {otpErrors.otp && <Text style={styles.error}>{otpErrors.otp.message?.toString()}</Text>}
                    </View>
                  )}
                />

                <Controller
                  control={otpControl}
                  name="password"
                  rules={{
                    required: "Password is required",
                    minLength: { value: 6, message: "Password must be at least 6 characters" },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.group}>
                      <View style={[styles.input, otpErrors.password && styles.inputError]}>
                        <Feather name="lock" size={16} color="#64748b" style={styles.icon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Choose a password"
                          placeholderTextColor="#94a3b8"
                          secureTextEntry
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          accessible
                          accessibilityLabel="Password"
                          returnKeyType="next"
                          editable={!otpSubmitting && !loading}
                        />
                      </View>
                      {otpErrors.password && <Text style={styles.error}>{otpErrors.password.message?.toString()}</Text>}
                    </View>
                  )}
                />

                <Controller
                  control={otpControl}
                  name="confirmPassword"
                  rules={{
                    required: "Please confirm password",
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.group}>
                      <View style={[styles.input, otpErrors.confirmPassword && styles.inputError]}>
                        <Feather name="lock" size={16} color="#64748b" style={styles.icon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Confirm password"
                          placeholderTextColor="#94a3b8"
                          secureTextEntry
                          onBlur={onBlur}
                          onChangeText={onChange}
                          value={value}
                          accessible
                          accessibilityLabel="Confirm password"
                          returnKeyType="done"
                          editable={!otpSubmitting && !loading}
                        />
                      </View>
                      {otpErrors.confirmPassword && <Text style={styles.error}>{otpErrors.confirmPassword.message?.toString()}</Text>}
                    </View>
                  )}
                />

                {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

                <Pressable
                  onPress={handleOtpSubmit(onVerifyAndSignup)}
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, (otpSubmitting || loading) && styles.btnDisabled]}
                  disabled={otpSubmitting || loading}
                  accessibilityRole="button"
                  accessibilityState={{ busy: otpSubmitting || loading }}
                >
                  {otpSubmitting || loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify & Create Account</Text>}
                </Pressable>

                <View style={{ flexDirection: "row", marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
                  <Pressable onPress={onBackToEmail} accessibilityRole="button" disabled={loading}>
                    <Text style={[styles.link, { fontSize: 14 }]}>Back</Text>
                  </Pressable>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ marginRight: 8, color: "#374151", fontSize: 13 }}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it?"}
                    </Text>
                    <Pressable onPress={onResendOtp} disabled={cooldown > 0 || loading} accessibilityRole="button">
                      <Text style={[styles.link, { fontSize: 14 }]}>{cooldown > 0 ? "Wait" : "Resend"}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </SafeAreaView>
  );
}

/* ---------- styles (reused + adapted from Login) ---------- */
const vars = {
  text: "#0b1220",
  muted: "#475569",
  primary: "#7c3aed",
  radius: 12,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 20 ,marginTop: 50 },

  topLogoWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 16,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  logoLetter: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 32,
    letterSpacing: 1,
  },
  appName: {
    marginTop: 10,
    color: vars.text,
    fontWeight: "700",
    fontSize: 16,
  },

  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: vars.radius,
    padding: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  brandTextWrap: { marginLeft: 0 },
  title: { fontSize: 18, color: vars.text, fontWeight: "600" },
  subtitle: { fontSize: 13, color: vars.muted },

  form: { marginTop: 6 },
  group: { marginBottom: 10 },
  input: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0,
    borderRadius: 10,
    paddingVertical: 10,
    paddingLeft: 40,
    paddingRight: 12,
    backgroundColor: "#f1f5f9",
  },
  icon: { position: "absolute", left: 12, color: "#64748b" },
  textInput: { flex: 1, color: vars.text, fontSize: 15, padding: 0 },
  toggle: { position: "absolute", right: 10, padding: 6 },
  inputError: {},
  error: { marginTop: 6, color: "#ef4444", fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 6 },
  rememberRow: { flexDirection: "row", alignItems: "center" },
  checkbox: { flexDirection: "row", alignItems: "center" },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "rgba(11,18,32,0.05)", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  boxChecked: { backgroundColor: vars.primary, borderColor: vars.primary },
  rememberText: { color: vars.muted, marginLeft: 8 },
  link: { color: vars.primary, fontWeight: "700" },
  serverError: { color: "#ef4444", marginTop: 6, marginBottom: 6 },
  primaryBtn: { marginTop: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: vars.primary, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnPressed: { opacity: 0.95 },
  btnDisabled: { opacity: 0.6 },
  divider: { textAlign: "center", marginTop: 12, marginBottom: 8, color: vars.muted },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#eef2ff",
  },
  outlineText: { marginLeft: 8, color: vars.text, fontWeight: "600" },
  signup: { textAlign: "center", marginTop: 12, color: vars.muted },
});
