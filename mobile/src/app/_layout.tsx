import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { autoSync } from '@/lib/health/sync';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { MeProvider } from '@/lib/me';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** Signed-out users land on the welcome screen (otherwise the router picks the first guest route alphabetically). */
export const unstable_settings = { anchor: 'welcome' };

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent },
};

/** Pushed screens (profile sections, progress): native header with a back button. */
const pushed = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  animation: 'ios_from_right' as const,
};

/** Quietly syncs Apple Health / Health Connect when the app opens or comes back to the foreground. */
function HealthAutoSync({ token }: { token: string }) {
  const { ex } = useI18n();
  useEffect(() => {
    const titleFor = (exercises: string[]) => `Delta · ${exercises.map(ex).join(', ')}`.slice(0, 80);
    autoSync(token, titleFor);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') autoSync(token, titleFor);
    });
    return () => sub.remove();
  }, [token, ex]);
  return null;
}

function RootStack() {
  const { token, ready } = useSession();
  const { t } = useI18n();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const stack = (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'ios_from_right' }}>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ ...pushed, title: '' }} />
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="progress" options={{ ...pushed, title: t('profile.progress') }} />
        <Stack.Screen name="profile/personal" options={{ ...pushed, title: t('profile.personal') }} />
        <Stack.Screen name="profile/goals" options={{ ...pushed, title: t('profile.goals') }} />
        <Stack.Screen name="profile/language" options={{ ...pushed, title: t('profile.language') }} />
        <Stack.Screen name="profile/account" options={{ ...pushed, title: t('profile.account') }} />
        <Stack.Screen name="health" options={{ ...pushed, title: t('hl.title') }} />
        <Stack.Screen name="food/add" options={{ ...pushed, title: t('food.add') }} />
        <Stack.Screen name="food/item" options={{ ...pushed, title: '' }} />
        <Stack.Screen name="food/scan" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="food/new" options={{ ...pushed, title: t('nf.title') }} />
        <Stack.Screen name="food/recipe" options={{ ...pushed, title: t('rc.title') }} />
        <Stack.Screen name="food/report" options={{ ...pushed, title: t('rp.title') }} />
      </Stack.Protected>
    </Stack>
  );

  return token ? (
    <MeProvider>
      <HealthAutoSync token={token} />
      {stack}
    </MeProvider>
  ) : (
    stack
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navTheme}>
      <I18nProvider>
        <SessionProvider>
          <StatusBar style="light" />
          <RootStack />
        </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
