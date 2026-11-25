import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, type ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { haptic, spring } from '@/components/motion';
import type { IconName } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/lib/theme';

/** Tab icon that pops when its tab becomes active. */
function TabIcon({ name, active, color, focused }: { name: IconName; active: IconName; color: ColorValue; focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) scale.value = withSequence(withSpring(1.22, { ...spring, stiffness: 400 }), withSpring(1, spring));
  }, [focused, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animated}>
      <Ionicons name={focused ? active : name} size={23} color={color as string} />
    </Animated.View>
  );
}

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <TabIcon name={name} active={active} color={color} focused={focused} />
  );

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic('select') }}
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === 'web' ? { height: 76, paddingTop: 6, paddingBottom: 10 } : null),
        },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarIcon: icon('grid-outline', 'grid') }} />
      <Tabs.Screen
        name="workout"
        options={{ title: t('tab.workout'), tabBarIcon: icon('barbell-outline', 'barbell') }}
      />
      <Tabs.Screen
        name="food"
        options={{ title: t('tab.food'), tabBarIcon: icon('restaurant-outline', 'restaurant') }}
      />
      <Tabs.Screen
        name="coach"
        options={{ title: t('tab.coach'), tabBarIcon: icon('sparkles-outline', 'sparkles') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tab.profile'), tabBarIcon: icon('person-circle-outline', 'person-circle') }}
      />
    </Tabs>
  );
}
