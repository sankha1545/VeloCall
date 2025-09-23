// app/join.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function JoinScreen(): JSX.Element {
  const router = useRouter();

  // Default name used when no param passing is available
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('sankha subhra das');
  const [dontConnectAudio, setDontConnectAudio] = useState(false);
  const [turnOffVideo, setTurnOffVideo] = useState(false);

  const canJoin = meetingId.trim().length > 0;

  const onJoin = () => {
    if (!canJoin) {
      Alert.alert('Meeting ID required', 'Please enter a Meeting ID or personal link name.');
      return;
    }
    console.log('Joining meeting', { meetingId, displayName, dontConnectAudio, turnOffVideo });
    Alert.alert('Joining', `Joining meeting ${meetingId} as ${displayName}`);
    router.back();
  };

  return (
    <View style={joinStyles.overlay}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={joinStyles.container}>
        <View style={joinStyles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={joinStyles.backWrap}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <Text style={joinStyles.headerTitle}>Join a meeting</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={joinStyles.form}>
          <View style={joinStyles.inputWrap}>
            <TextInput
              placeholder="Meeting ID"
              placeholderTextColor="#6b7280"
              value={meetingId}
              onChangeText={setMeetingId}
              style={joinStyles.input}
              keyboardType="default"
              returnKeyType="done"
              accessible
              accessibilityLabel="Meeting ID"
            />
          </View>

          <TouchableOpacity onPress={() => Alert.alert('Personal link', 'Join with a personal link name')}>
            <Text style={joinStyles.personalLink}>Join with a personal link name</Text>
          </TouchableOpacity>

          <View style={[joinStyles.inputWrap, { marginTop: 18 }]}>
            <TextInput
              placeholder="Your name"
              placeholderTextColor="#6b7280"
              value={displayName}
              onChangeText={setDisplayName}
              style={joinStyles.input}
              accessible
              accessibilityLabel="Your display name"
            />
          </View>

          <TouchableOpacity
            style={[joinStyles.joinButton, !canJoin && joinStyles.joinButtonDisabled]}
            onPress={onJoin}
            disabled={!canJoin}
            accessibilityRole="button"
            accessibilityLabel="Join meeting"
            accessibilityState={{ disabled: !canJoin }}
          >
            <Text style={[joinStyles.joinButtonText, !canJoin && joinStyles.joinButtonTextDisabled]}>Join</Text>
          </TouchableOpacity>

          <Text style={joinStyles.helperText}>If you received an invitation link, tap on the link to join the meeting</Text>

          <View style={joinStyles.joinOptions}>
            <Text style={joinStyles.joinOptionsTitle}>Join options</Text>

            <View style={joinStyles.optionRow}>
              <Text style={joinStyles.optionLabel}>Don't connect to audio</Text>
              <Switch value={dontConnectAudio} onValueChange={setDontConnectAudio} thumbColor={dontConnectAudio ? '#fff' : '#fff'} trackColor={{ false: '#4b5563', true: '#2b7cf0' }} accessibilityLabel="Don't connect to audio" />
            </View>

            <View style={joinStyles.optionRow}>
              <Text style={joinStyles.optionLabel}>Turn off my video</Text>
              <Switch value={turnOffVideo} onValueChange={setTurnOffVideo} thumbColor={turnOffVideo ? '#fff' : '#fff'} trackColor={{ false: '#4b5563', true: '#2b7cf0' }} accessibilityLabel="Turn off my video" />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* Join styles */
const joinStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,10,12,0.98)' },
  container: { flex: 1 },
  header: {
    height: 64,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 12 : 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
  },
  backWrap: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  form: { paddingHorizontal: 16, paddingTop: 18 },
  inputWrap: {
    backgroundColor: '#111214',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderWidth: 1,
    borderColor: '#222224',
  },
  input: { color: '#fff', fontSize: 16, padding: 0 },
  personalLink: { color: '#2b7cf0', marginTop: 12, fontSize: 14 },
  joinButton: { marginTop: 18, backgroundColor: '#2b7cf0', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  joinButtonDisabled: { backgroundColor: '#374151' },
  joinButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  joinButtonTextDisabled: { color: '#9ca3af' },
  helperText: { color: '#9ca3af', marginTop: 12, fontSize: 13 },
  joinOptions: { marginTop: 22, borderTopWidth: 1, borderTopColor: '#1f2223', paddingTop: 12 },
  joinOptionsTitle: { color: '#9ca3af', marginBottom: 12, fontSize: 13 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#171819' },
  optionLabel: { color: '#e5e7eb', fontSize: 16 },
});
