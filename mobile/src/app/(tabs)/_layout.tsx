import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';

import { colors } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ color, fontSize: 18, fontWeight: '700' }}>{glyph}</Text>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Log', tabBarIcon: icon('＋') }} />
      <Tabs.Screen name="summary" options={{ title: 'This week', tabBarIcon: icon('Δ') }} />
    </Tabs>
  );
}
