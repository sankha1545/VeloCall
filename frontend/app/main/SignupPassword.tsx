// app/main/SignupPassword.tsx
import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { signupWithEmail } from "../../lib/authService";
import { useAuth } from "../../lib/auth";

type FormData = {
  password: string;
  confirmPassword: string;
};

export default function SignupPasswordScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const emailParam = (params.email as string) ?? "";
  const mode = (params.mode as string) ?? "signup";

  const { pendingSignup, clearPendingSignup } = useAuth();
  const emailFromContext = pendingSignup?.email ?? null;
  const email = emailParam || emailFromContext || "";

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ defaultValues: { password: "", confirmPassword: "" }, mode: "onTouched" });

  const passwordValue = watch("password");

  // Password policy: min 10 chars, >=1 uppercase, >=1 lowercase, >=1 special char
  const passwordPattern = /(?=.{10,})(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])/;

  async function onSubmit(data: FormData) {
    try {
      if (!email) throw new Error("Missing email. Please start the sign-up flow again.");

      // create firebase user
      const userCred = await signupWithEmail(email.trim(), data.password);
      // If you want to auto-login, you could get idToken and save token; user asked to redirect to login
      clearPendingSignup();
      Alert.alert("Your account is successfully created", "You can now sign in with your email and password.");
      router.replace("/main/login");
    } catch (err: any) {
      console.warn("Signup (password) failed:", err);
      Alert.alert("Signup failed", err?.message ?? "Unable to create account.");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Set a password</Text>
        <Text style={styles.subtitle}>Create a secure password for {email || "your account"}</Text>

        <Controller
          control={control}
          name="password"
          rules={{
            required: "Password is required",
            pattern: { value: passwordPattern, message: "Password must be 10+ chars, include uppercase, lowercase and special character" },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.password && <Text style={styles.error}>{errors.password.message?.toString()}</Text>}

        <Controller
          control={control}
          name="confirmPassword"
          rules={{
            required: "Please confirm password",
            validate: (v) => v === passwordValue || "Passwords do not match",
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput style={styles.input} placeholder="Confirm password" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} />
          )}
        />
        {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword.message?.toString()}</Text>}

        <Pressable style={[styles.button, isSubmitting && styles.btnDisabled]} onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Create account</Text>}
        </Pressable>

        <View style={styles.row}>
          <Pressable onPress={() => router.replace("/main/login")}>
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
  error: { color: "#ef4444", marginBottom: 8 },
  button: { marginTop: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: "#7c3aed", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  linkText: { color: "#7c3aed", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
});
