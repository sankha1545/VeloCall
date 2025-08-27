// app/main/login.tsx
import { Feather } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { exchangeCodeAsync, makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../lib/auth";
import { loginWithEmail, signInWithFirebaseGithub, signInWithFirebaseGoogle } from "../lib/authService";

WebBrowser.maybeCompleteAuthSession();

type FormData = {
  email: string;
  password: string;
  remember?: boolean;
};

/** AnimatedLogo component (same design as before) */
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

export default function LoginScreen(): JSX.Element {
  const router = useRouter();
  const { saveToken } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ defaultValues: { email: "", password: "", remember: false }, mode: "onTouched" });

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);

  // Read OAuth client IDs from expo.extra (app.json / app.config.js)
  const expoExtra = (Constants.expoConfig && (Constants.expoConfig.extra as any)) || (Constants.manifest && (Constants.manifest.extra as any));
  const oauth = expoExtra?.oauth ?? {};
  const GOOGLE_EXPO_CLIENT_ID = oauth?.expoGoogleClientId ?? "";
  const GOOGLE_IOS_CLIENT_ID = oauth?.iosGoogleClientId ?? "";
  const GOOGLE_ANDROID_CLIENT_ID = oauth?.androidGoogleClientId ?? "";
  const GOOGLE_WEB_CLIENT_ID = oauth?.webGoogleClientId ?? "";
  const GITHUB_CLIENT_ID = oauth?.githubClientId ?? "";

  /* --------------------------
     GOOGLE AUTH (expo provider)
     -------------------------- */
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: GOOGLE_EXPO_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    if (response?.type === "success") {
      const auth = response.authentication;
      (async () => {
        try {
          setSocialLoading(true);
          const userCred = await signInWithFirebaseGoogle(auth?.idToken ?? null, auth?.accessToken ?? null);
          const idToken = await userCred.user.getIdToken();
          await saveToken(`firebase:${idToken}`);
          router.replace("/");
        } catch (err: any) {
          console.warn("Google -> Firebase sign-in error", err);
          Alert.alert("Sign-in failed", err.message ?? "Unable to sign in with Google");
        } finally {
          setSocialLoading(false);
        }
      })();
    }
  }, [response, saveToken, router]);

  /* --------------------------
     GITHUB AUTH (PKCE + exchange)
     -------------------------- */
  const githubDiscovery = {
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
  };

  async function handleGithubSignIn() {
    try {
      setSocialLoading(true);
      // redirectUri using Expo (useProxy:true for dev with Expo Go)
      const redirectUri = makeRedirectUri({ useProxy: true });

      // Create auth request (this generates codeVerifier + codeChallenge internally)
      const request = new AuthSession.AuthRequest({
        clientId: GITHUB_CLIENT_ID,
        scopes: ["read:user", "user:email"],
        redirectUri,
        responseType: "code",
      });

      // Prepare and open the auth prompt
      const result = await request.promptAsync(githubDiscovery, { useProxy: true });

      if (result.type !== "success" || !result.params?.code) {
        throw new Error("GitHub authentication canceled or failed.");
      }

      const code = result.params.code;
      // Exchange authorization code for access token (PKCE)
      const tokenResult = await exchangeCodeAsync(
        {
          clientId: GITHUB_CLIENT_ID,
          code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier ?? undefined,
          },
        },
        {
          tokenEndpoint: githubDiscovery.tokenEndpoint,
        }
      );

      const accessToken = (tokenResult as any).accessToken ?? (tokenResult as any).access_token;
      if (!accessToken) throw new Error("No access token received from GitHub.");

      const userCred = await signInWithFirebaseGithub(accessToken);
      const idToken = await userCred.user.getIdToken();
      await saveToken(`firebase:${idToken}`);
      router.replace("/");
    } catch (err: any) {
      console.warn("GitHub sign-in error", err);
      Alert.alert("GitHub sign-in failed", err.message ?? "Unable to sign in with GitHub");
    } finally {
      setSocialLoading(false);
    }
  }

  /* --------------------------
     EMAIL/PASSWORD LOGIN
     -------------------------- */
  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      setServerError(null);
      // Use Firebase email login helper
      const userCred = await loginWithEmail(data.email.trim(), data.password);
      const idToken = await userCred.user.getIdToken();
      await saveToken(`firebase:${idToken}`);
      router.replace("/");
    } catch (err: any) {
      console.warn("Email login error", err);
      setServerError(err?.message ?? "Login failed. Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
          <View style={styles.topLogoWrap}>
            <AnimatedLogo size={96} />
            <Text style={styles.appName}>App Name</Text>
          </View>

          <View style={styles.card} accessibilityLabel="Login form" accessibilityRole="header">
            <View style={styles.brandRow}>
              <View style={styles.brandTextWrap}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to your account to continue</Text>
              </View>
            </View>

            <View style={styles.form}>
              <View style={styles.group}>
                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: "Email is required",
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                  }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.input, errors.email && styles.inputError]}>
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
                        editable={!isSubmitting && !socialLoading}
                      />
                    </View>
                  )}
                />
                {errors.email && <Text style={styles.error}>{errors.email.message?.toString()}</Text>}
              </View>

              <View style={styles.group}>
                <Controller
                  control={control}
                  name="password"
                  rules={{ required: "Password is required", minLength: { value: 6, message: "Password must be at least 6 characters" } }}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.input, errors.password && styles.inputError]}>
                      <Feather name="lock" size={16} color="#64748b" style={styles.icon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Your password"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showPassword}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        accessible
                        accessibilityLabel="Password"
                        returnKeyType="done"
                        importantForAutofill="yes"
                        editable={!isSubmitting && !socialLoading}
                      />

                      <Pressable
                        onPress={() => setShowPassword((s) => !s)}
                        style={styles.toggle}
                        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                        accessibilityRole="button"
                        disabled={isSubmitting || socialLoading}
                      >
                        <Feather name={showPassword ? "eye-off" : "eye"} size={16} color="#0b1220" />
                      </Pressable>
                    </View>
                  )}
                />
                {errors.password && <Text style={styles.error}>{errors.password.message?.toString()}</Text>}
              </View>

              <View style={styles.row}>
                <View style={styles.rememberRow}>
                  <Controller
                    control={control}
                    name="remember"
                    render={({ field: { onChange, value } }) => (
                      <Pressable
                        onPress={() => onChange(!value)}
                        style={styles.checkbox}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: !!value }}
                        disabled={isSubmitting || socialLoading}
                      >
                        <View style={[styles.box, value && styles.boxChecked]}>{value && <Feather name="check" size={12} color="#fff" />}</View>
                        <Text style={styles.rememberText}>Remember me</Text>
                      </Pressable>
                    )}
                  />
                </View>

                <Pressable onPress={() => Alert.alert("Reset password", "Password reset flow (implement your flow).")} disabled={isSubmitting || socialLoading}>
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>
              </View>

              {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

              <Pressable
                onPress={handleSubmit(onSubmit)}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, (isSubmitting || socialLoading) && styles.btnDisabled]}
                disabled={isSubmitting || socialLoading}
                accessibilityRole="button"
                accessibilityState={{ busy: isSubmitting || socialLoading }}
              >
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign in</Text>}
              </Pressable>

              <Text style={styles.divider}>or continue with</Text>

              <View style={styles.socials}>
                <Pressable
                  onPress={() => promptAsync({ useProxy: true })}
                  style={styles.outlineBtn}
                  accessibilityRole="button"
                  disabled={!request || socialLoading}
                >
                  {socialLoading ? <ActivityIndicator /> : <><Feather name="log-in" size={16} color="#0b1220" /><Text style={styles.outlineText}>Google</Text></>}
                </Pressable>

                <Pressable
                  onPress={handleGithubSignIn}
                  style={[styles.outlineBtn, { marginLeft: 8 }]}
                  accessibilityRole="button"
                  disabled={!GITHUB_CLIENT_ID || socialLoading}
                >
                  {socialLoading ? <ActivityIndicator /> : <><Feather name="github" size={16} color="#0b1220" /><Text style={styles.outlineText}>GitHub</Text></>}
                </Pressable>
              </View>

              <Text style={styles.signup}>
                Don’t have an account?{" "}
                <Text
                  style={styles.link}
                  onPress={() => {
                    router.push("/main/Signup");
                  }}
                  accessibilityRole="link"
                >
                  Create account
                </Text>
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */
const vars = {
  text: "#0b1220", // dark text for white background
  muted: "#475569",
  primary: "#7c3aed",
  radius: 12,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" }, // white background only
  container: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 20 },

  topLogoWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 28, // sufficient space from top
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
    // IMPORTANT: no borders, no shadows — intentionally omitted
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
    borderWidth: 0, // no border
    borderRadius: 10,
    paddingVertical: 10,
    paddingLeft: 40,
    paddingRight: 12,
    backgroundColor: "#f1f5f9", // subtle light input background on white page
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
  socials: { flexDirection: "row", justifyContent: "space-between" },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0, // no border per request
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: "#eef2ff",
  },
  outlineText: { marginLeft: 8, color: vars.text, fontWeight: "600" },
  signup: { textAlign: "center", marginTop: 12, color: vars.muted },
});
