// app/index.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
  GestureResponderEvent,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

type ActionItemProps = {
  bg: string;
  icon: React.ReactNode;
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
};

type TabItemProps = {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
};

export default function HomeScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Dropdown/menu visibility + logout loading state
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // NOTE: we no longer attempt to pass params to /join (avoid useSearchParams incompatibilities).
  const goToJoin = () => {
    router.push('/routes/join');
  };

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const goToProfile = () => {
    closeMenu();
    // navigate to profile screen (adjust path if your app uses something else)
    router.push('/routes/profile');
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Try to remove auth token - change key if your app stores it under a different key.
      await AsyncStorage.removeItem('authToken');
    } catch (e) {
      // Non-fatal — still proceed to navigate to login screen.
      console.warn('[HomeScreen] AsyncStorage removeItem failed', e);
    } finally {
      setIsLoggingOut(false);
      closeMenu();
      // Replace the navigation stack with login so user can't go back to protected screens.
      // Adjust path if your login route is different.
      try {
        router.replace('/main/Signup');
      } catch (e) {
        // Fallback: push to login if replace fails
        router.push('/main/login');
      }
    }
  };

  const confirmLogout = () => {
    // Show a confirmation Alert. On "Yes" perform logout.
    Alert.alert(
      'Log out',
      'Are you sure you want to log out? You will be returned to the login screen.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            /* keep menu open? close it for clarity */
            closeMenu();
          },
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: performLogout,
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" translucent={false} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Home</Text>
        </View>

        <View style={styles.headerRightWrapper}>
          <TouchableOpacity
            style={styles.headerAction}
            accessibilityLabel="More options"
            accessibilityHint="Open menu"
            onPress={openMenu}
            activeOpacity={0.8}
          >
            <MaterialIcons name="more-vert" size={26} color="#9aa0a6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown menu (Modal anchored near top-right) */}
      <Modal
        visible={menuVisible}
        animationType="fade"
        transparent
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuContainer, { top: (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + 56 + insets.top }]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={goToProfile}
                  accessibilityRole="menuitem"
                >
                  <View style={styles.menuItemLeft}>
                    <FontAwesome5 name="user" size={16} color="#fff" />
                  </View>
                  <Text style={styles.menuItemText}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={confirmLogout}
                  accessibilityRole="menuitem"
                >
                  <View style={styles.menuItemLeft}>
                    <MaterialIcons name="logout" size={16} color="#fff" />
                  </View>
                  <Text style={styles.menuItemText}>Logout</Text>
                  {/* show spinner on the right when logging out */}
                  {isLoggingOut ? <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 10 }} /> : null}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Action row */}
      <View style={styles.actionsRow}>
        <ActionItem
          bg="#FF7A2D"
          icon={<MaterialIcons name="videocam" size={26} color="white" />}
          label="Meet"
          onPress={() => router.push('/routes/meet')}
        />
        <ActionItem
          bg="#2B7CF0"
          icon={<Ionicons name="add-circle" size={26} color="white" />}
          label="Join"
          onPress={goToJoin}
        />
        <ActionItem
          bg="#0ea5a4"
          icon={<MaterialIcons name="event" size={26} color="white" />}
          label="Schedule"
          onPress={() => router.push('/routes/schedule')}
        />
        <ActionItem
          bg="#7C5CF0"
          icon={<MaterialIcons name="file-upload" size={26} color="white" />}
          label="Share"
          onPress={() => Alert.alert('Share', 'Share pressed')}
        />
      </View>

      <View style={styles.separator} />

      {/* Main content */}
      <View style={styles.centerArea}>
        <Text style={styles.addCalendar}>Add a calendar</Text>
      </View>

      {/* Bottom Tab Bar (visual only) */}
    </SafeAreaView>
  );
}

/* Small reusable components */
function ActionItem({ bg, icon, label, onPress }: ActionItemProps): JSX.Element {
  return (
    <TouchableOpacity
      style={styles.actionItem}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function TabItem({ active = false, icon, label, children }: TabItemProps): JSX.Element {
  return (
    <TouchableOpacity
      style={styles.tabItem}
      activeOpacity={0.85}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!active }}
    >
      <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>{icon}</View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {children}
    </TouchableOpacity>
  );
}

/* Styles */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f1112',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '700' },

  headerRightWrapper: { flexDirection: 'row', alignItems: 'center' },
  headerAction: { padding: 6, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  actionsRow: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: { flex: 1, alignItems: 'center' },
  actionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  actionLabel: { color: '#c4c8cc', fontSize: 13, textAlign: 'center' },

  separator: { height: 1, backgroundColor: '#161717', marginHorizontal: 8 },

  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  addCalendar: { color: '#2b7cf0', fontSize: 18, fontWeight: '600' },

  tabBar: {
    height: 72,
    borderTopWidth: 1,
    borderColor: '#151617',
    backgroundColor: '#0e1011',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', width: width / 5 },
  tabIconWrap: { width: 42, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabIconWrapActive: { backgroundColor: '#133f86', width: 46, height: 34, borderRadius: 12 },
  tabLabel: { marginTop: 4, fontSize: 11, color: '#8b9096' },
  tabLabelActive: { color: '#2b7cf0', fontWeight: '600' },

  badge: {
    position: 'absolute',
    top: 6,
    right: width / 10 - 6,
    backgroundColor: '#ff3b30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '700' },

  /* Dropdown/modal styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    right: 12,
    width: 180,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    paddingVertical: 8,
    // subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemLeft: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
