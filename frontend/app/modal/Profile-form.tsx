// File: components/ProfileForm.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

export type ProfileData = {
  name: string;
  email: string;
  phone: string;
  imageUri: string | null;
};

type Props = {
  initial: ProfileData;
  onSave: (p: ProfileData) => void;
  onCancel: () => void;
};

export default function ProfileForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState<string>(initial.name ?? '');
  const [email, setEmail] = useState<string>(initial.email ?? '');
  const [phone, setPhone] = useState<string>(initial.phone ?? '');
  const [imageUri, setImageUri] = useState<string | null>(initial.imageUri ?? null);
  const [loadingImage, setLoadingImage] = useState<boolean>(false);

  async function requestMediaLibraryPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access photos is required to pick an image.');
        return false;
      }
      return true;
    } catch (e) {
      console.warn('media permission error', e);
      return false;
    }
  }

  async function requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take a photo.');
        return false;
      }
      return true;
    } catch (e) {
      console.warn('camera permission error', e);
      return false;
    }
  }

  const pickImage = async () => {
    const ok = await requestMediaLibraryPermission();
    if (!ok) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        selectionLimit: 1,
      });

      // handle both legacy and modern shapes
      // @ts-ignore
      const uri = result.uri ?? (result.assets && result.assets[0] && result.assets[0].uri);
      if (uri) {
        setImageUri(uri as string);
      }
    } catch (e) {
      console.warn('Image pick error', e);
      Alert.alert('Error', 'Could not pick the image.');
    }
  };

  const takePhoto = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      // @ts-ignore
      const uri = result.uri ?? (result.assets && result.assets[0] && result.assets[0].uri);
      if (uri) setImageUri(uri as string);
    } catch (e) {
      console.warn('Camera error', e);
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const validateAndSave = () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter your name.');
      return;
    }

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Validation', 'Please enter a phone number.');
      return;
    }

    const payload: ProfileData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      imageUri,
    };

    onSave(payload);
  };

  return (
    <SafeAreaView style={formStyles.safe}>
      <ScrollView contentContainerStyle={formStyles.container} keyboardShouldPersistTaps="handled">
        <Text style={formStyles.heading}>Edit profile</Text>

        <View style={formStyles.avatarRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={formStyles.avatarLarge} />
          ) : (
            <View style={formStyles.placeholderLarge}>
              <MaterialIcons name="person" size={48} color="#fff" />
            </View>
          )}

          <View style={formStyles.avatarButtons}>
            <TouchableOpacity style={formStyles.smallBtn} onPress={pickImage} accessibilityRole="button">
              <Text style={formStyles.smallBtnText}>Upload</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[formStyles.smallBtn, { marginTop: 8 }]}
              onPress={takePhoto}
              accessibilityRole="button"
            >
              <Text style={formStyles.smallBtnText}>Take photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={formStyles.field}>
          <Text style={formStyles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor="#9aa0a6"
            style={formStyles.input}
            returnKeyType="next"
          />
        </View>

        <View style={formStyles.field}>
          <Text style={formStyles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9aa0a6"
            style={formStyles.input}
            returnKeyType="next"
          />
        </View>

        <View style={formStyles.field}>
          <Text style={formStyles.label}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            placeholderTextColor="#9aa0a6"
            style={formStyles.input}
            returnKeyType="done"
          />
        </View>

        <View style={formStyles.actionsRow}>
          <TouchableOpacity style={[formStyles.actionBtn, formStyles.cancelBtn]} onPress={onCancel}>
            <Text style={formStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[formStyles.actionBtn, formStyles.saveBtn]} onPress={validateAndSave}>
            <Text style={formStyles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const formStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1112' },
  container: { padding: 16 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarLarge: { width: 110, height: 110, borderRadius: 18 },
  placeholderLarge: {
    width: 110,
    height: 110,
    borderRadius: 18,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButtons: { marginLeft: 16, flex: 1 },
  smallBtn: { backgroundColor: '#06b6d4', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  field: { marginBottom: 12 },
  label: { color: '#9aa0a6', marginBottom: 6 },
  input: {
    backgroundColor: '#0b1220',
    padding: 12,
    borderRadius: 10,
    color: '#fff',
    // for iOS subtle inner shadow look
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#1f2937', marginRight: 12 },
  saveBtn: { backgroundColor: '#06b6d4' },
  cancelText: { color: '#fff', fontWeight: '700' },
  saveText: { color: '#fff', fontWeight: '700' },
});
