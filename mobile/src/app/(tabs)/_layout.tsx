import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, type ColorValue } from 'react-native';

import type { IconName } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/lib/theme';

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={23} color={color as string} />
  );

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
        name="progress"
        options={{ title: t('tab.progress'), tabBarIcon: icon('trending-up-outline', 'trending-up') }}
      />
    </Tabs>
  );
}
