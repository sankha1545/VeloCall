import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithCredential,
  UserCredential,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
import { Platform } from "react-native";

/**
 * Email / Password
 */
export const signupWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

/**
 * Google Login
 * - Web: uses popup
 * - Native (iOS/Android): expects idToken (from expo-auth-session)
 */
export const loginWithGoogle = async (
  idToken?: string,
  accessToken?: string
): Promise<UserCredential> => {
  if (Platform.OS === "web") {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  } else {
    if (!idToken) throw new Error("Missing Google idToken");
    const credential = GoogleAuthProvider.credential(idToken, accessToken ?? undefined);
    return signInWithCredential(auth, credential);
  }
};

/**
 * GitHub Login
 * - Web: uses popup
 * - Native: expects accessToken (from expo-auth-session)
 */
export const loginWithGithub = async (accessToken?: string): Promise<UserCredential> => {
  if (Platform.OS === "web") {
    const provider = new GithubAuthProvider();
    return signInWithPopup(auth, provider);
  } else {
    if (!accessToken) throw new Error("Missing GitHub accessToken");
    const credential = GithubAuthProvider.credential(accessToken);
    return signInWithCredential(auth, credential);
  }
};
