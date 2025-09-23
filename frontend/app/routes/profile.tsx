// app/profile.tsx
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileForm, { ProfileData } from '../modal/Profile-form';

export default function ProfileScreen(): JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editVisible, setEditVisible] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userProfile');
        if (!mounted) return;
        if (raw) {
          setProfile(JSON.parse(raw));
        } else {
          // default demo values
          setProfile({
            name: 'Your Name',
            email: 'you@example.com',
            phone: '+91 98765 43210',
            imageUri: null,
          });
        }
      } catch (e) {
        console.warn('Failed to load profile', e);
        Alert.alert('Error', 'Failed to load profile from storage.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const openEdit = () => setEditVisible(true);
  const closeEdit = () => setEditVisible(false);

  const saveProfile = async (data: ProfileData) => {
    try {
      setLoading(true);
      await AsyncStorage.setItem('userProfile', JSON.stringify(data));
      setProfile(data);
      setEditVisible(false);
    } catch (e) {
      console.warn('Failed to save profile', e);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Profile</Text>

        <View style={{ width: 48 }} />
      </View>

      {/* Profile card */}
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          {profile?.imageUri ? (
            <Image source={{ uri: profile.imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.placeholderInitial}>
                {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoWrap}>
          <Text style={styles.name}>{profile?.name ?? '-'}</Text>
          <Text style={styles.email}>{profile?.email ?? '-'}</Text>
          <Text style={styles.phone}>{profile?.phone ?? '-'}</Text>

          <TouchableOpacity style={styles.editButton} onPress={openEdit} accessibilityRole="button">
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit modal renders the separate form file */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={closeEdit}>
        <ProfileForm
          initial={
            profile ?? {
              name: '',
              email: '',
              phone: '',
              imageUri: null,
            }
          }
          onCancel={closeEdit}
          onSave={saveProfile}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1112',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 8 },
  backText: { color: '#9aa0a6' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },

  card: {
    margin: 16,
    padding: 16,
    backgroundColor: '#0b1220',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarWrap: { marginRight: 14 },
  avatar: { width: 96, height: 96, borderRadius: 20 },
  placeholderAvatar: {
    width: 96,
    height: 96,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  placeholderInitial: { color: '#fff', fontSize: 36, fontWeight: '700' },
  infoWrap: { flex: 1 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  email: { color: '#9aa0a6', marginBottom: 6 },
  phone: { color: '#9aa0a6', marginBottom: 12 },
  editButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#06b6d4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editButtonText: { color: '#fff', fontWeight: '700' },
});
