// (tabs)/_layout.tsx
import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import {
  Platform,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  GestureResponderEvent,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import IconSymbol from '@/components/ui/IconSymbol';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Background } from '@react-navigation/elements';

const { width } = Dimensions.get('window');

type TabItemProps = {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress?: (e?: GestureResponderEvent) => void;
  badge?: number | string | undefined;
  accessibilityLabel?: string;
};

function TabItem({ active = false, icon, label, onPress, badge, accessibilityLabel }: TabItemProps) {
  const scale = useRef(new Animated.Value(active ? 1.03 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.03 : 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.85 }]}
    >
      <Animated.View style={[styles.tabItemInner, { transform: [{ scale }] }]}>
        <View style={styles.iconWrapper}>{icon}</View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        {badge !== undefined && badge !== null ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{String(badge)}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function InlineCustomTabBar(props?: BottomTabBarProps | null) {
  try {
    if (!props) return null;

    const state = (props as any).state ?? { routes: [], index: 0 };
    const descriptors = (props as any).descriptors ?? {};
    const navigation = (props as any).navigation ?? {};

    if (!state || !Array.isArray(state.routes)) return null;

    // RAW routes as provided by navigator:
    const rawRoutes = state.routes as any[];

    // === IMPORTANT: filter out any routes whose name/key mentions calls/contacts ===
  

    const colorScheme = useColorScheme();
    const theme = (Colors && Colors[colorScheme ?? 'dark']) || Colors?.dark || {
      background: '#071028',
      tint: '#FFFFFF',
      muted: '#9ca3af',
    };

    const insets = useSafeAreaInsets();
    const bottomInset = typeof insets.bottom === 'number' ? insets.bottom : 0;

    const goToSchedule = () => {
      try {
        if (navigation && typeof navigation.navigate === 'function') navigation.navigate('schedule');
      } catch (e) {
        console.warn('[TabLayout] goToSchedule navigation error', e);
      }
    };

    const renderTabForRoute = (route: any) => {
      try {
        if (!route || typeof route !== 'object') return null;

        // Determine focus by comparing route key with currently focused route key from state
        const currentFocusedKey = state.routes[state.index]?.key ?? state.routes[state.index]?.name;
        const focused = currentFocusedKey === (route.key ?? route.name);

        const key = route.key ?? route.name ?? `route-${Math.random().toString(36).slice(2, 9)}`;
        const descriptor = descriptors && Object.prototype.hasOwnProperty.call(descriptors, key) ? descriptors[key] : undefined;
        const options = descriptor && typeof descriptor === 'object' ? descriptor.options ?? {} : {};

        const label = (options.tabBarLabel ?? options.title ?? route.name ?? `Tab`) as string;
        const badge = options.tabBarBadge;

        const iconColor = '#FFFFFF';

        let tabBarIcon: React.ReactNode = null;
        if (typeof options.tabBarIcon === 'function') {
          try {
            tabBarIcon = options.tabBarIcon({ focused, color: iconColor, size: 22 });
          } catch (e) {
            tabBarIcon = null;
          }
        }

        if (!tabBarIcon) {
          let name = 'question';
          try {
            const nm = String(route.name ?? '').toLowerCase();
            if (/index|home/.test(nm)) name = 'home';
            else if (/explore|discover/.test(nm)) name = 'paper-plane';
            else if (/settings/.test(nm)) name = 'cog';
          } catch {}
          tabBarIcon = <FontAwesome5 name={name as any} size={20} color={iconColor} />;
        }

        const onPress = () => {
          try {
            let event = { defaultPrevented: false } as any;
            if (navigation && typeof navigation.emit === 'function') {
              event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }) ?? event;
            }
            if (!event.defaultPrevented) {
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate(route.name);
              }
            }
          } catch (e) {
            console.warn('[TabLayout] navigation emit/navigate error:', e);
          }
        };

        return (
          <TabItem
            key={key}
            label={String(label)}
            icon={tabBarIcon}
            active={!!focused}
            badge={badge}
            onPress={onPress}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? `${label} tab`}
          />
        );
      } catch (e) {
        console.warn('[TabLayout] failed to render route', e);
        return null;
      }
    };

    const containerStyle: ViewStyle = { left: 0, right: 0, bottom: 0 };
    const innerBarHeight = Platform.OS === 'ios' ? 92 : 72;

    return (
      <View style={[styles.tabBarWrap, containerStyle]} pointerEvents="box-none">
        <LinearGradient
          colors={['#071028', '#0b1220']}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 1.0, y: 1.0 }}
          style={[styles.gradient, { paddingBottom: bottomInset }]}
        >
          <View style={[styles.tabBar, { height: innerBarHeight }]} accessibilityRole="tablist">
            {filteredRoutes.map((r) => renderTabForRoute(r))}
          </View>
        </LinearGradient>

        <View style={[styles.centerButtonContainer, { bottom: (Platform.OS === 'ios' ? 28 : 16) + bottomInset }]} pointerEvents="box-none">
          <Pressable
            activeOpacity={0.9}
            onPress={goToSchedule}
            accessibilityRole="button"
            accessibilityLabel="Schedule meeting"
            style={({ pressed }) => [styles.scheduleButton, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <FontAwesome5 name="calendar-plus" size={18} color="#071028" />
            <Text style={styles.scheduleLabel}>Schedule</Text>
          </Pressable>
        </View>
      </View>
    );
  } catch (err) {
    console.warn('[TabLayout] InlineCustomTabBar render error:', err);
    return null;
  }
}

export default function TabLayout(): JSX.Element {
  return (
    <Tabs
        

      screenOptions={{
        headerShown: false,
        tabBar: (props: BottomTabBarProps) => <InlineCustomTabBar {...props} />,
        tabBarIconStyle: { marginTop: 4 },
        tabBarLabelStyle: { paddingBottom: 6, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }: { color?: string }) => <IconSymbol size={24} name="house.fill" color="#000" />,
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }: { color?: string }) => <IconSymbol size={24} name="paperplane.fill" color="#FFFFFF" />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }: { color?: string }) => <IconSymbol size={24} name="gear.fill" color="#FFFFFF" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    left: 0,
    right: 0,
    bottom: 0,
    position: 'absolute',
  },
  gradient: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    width: width,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: width,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconWrapper: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    marginTop: 0,
    fontSize: 11,
    color: '#9ca3af',
  },
  labelActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 18,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  centerButtonContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 50,
  },
  scheduleButton: {
    minWidth: 124,
    height: 48,
    borderRadius: 28,
    backgroundColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  scheduleLabel: {
    marginLeft: 8,
    color: '#071028',
    fontWeight: '700',
    fontSize: 14,
  },
});
