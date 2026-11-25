import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear } from '@/components/motion';
import { Button, type IconName } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

const FEATURES: { icon: IconName; color: string; key: 'tab.workout' | 'tab.food' | 'tab.coach' | 'tab.progress' }[] = [
  { icon: 'barbell', color: colors.accent, key: 'tab.workout' },
  { icon: 'camera', color: colors.fat, key: 'tab.food' },
  { icon: 'sparkles', color: colors.protein, key: 'tab.coach' },
  { icon: 'stats-chart', color: colors.carbs, key: 'tab.progress' },
];

export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.content, webFrame]}>
        <View style={styles.top}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>Δ</Text>
            </View>
            <Text style={type.h3}>Delta</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLang(lang === 'ru' ? 'en' : 'ru')}
            style={styles.langBtn}
            hitSlop={8}>
            <Ionicons name="language" size={16} color={colors.muted} />
            <Text style={[type.small, { color: colors.text, fontWeight: '700' }]}>{lang === 'ru' ? 'RU' : 'EN'}</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.grid}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.key}
                entering={ZoomIn.delay(100 + i * 90).springify().damping(14)}
                style={[styles.tile, { backgroundColor: `${f.color}14`, borderColor: `${f.color}33` }]}>
                <Ionicons name={f.icon} size={26} color={f.color} />
                <Text style={[type.h3, { fontSize: 15 }]}>{t(f.key)}</Text>
              </Animated.View>
            ))}
          </View>
          <Appear index={8}>
            <Text style={[type.display, { fontSize: 36, lineHeight: 42 }]}>{t('ob.tagline')}</Text>
          </Appear>
          <Appear index={9}>
            <Text style={[type.body, { color: colors.muted, fontSize: 17, lineHeight: 24 }]}>{t('ob.lead')}</Text>
          </Appear>
        </View>

        <Animated.View entering={FadeInDown.delay(700).duration(400)} style={{ gap: space(3) }}>
          <Button title={t('auth.getStarted')} icon="arrow-forward" onPress={() => router.push('/onboarding')} />
          <Button title={t('auth.haveAccount')} variant="secondary" onPress={() => router.push('/login')} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: space(5), justifyContent: 'space-between', gap: space(6) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '900', color: colors.accentInk },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
  },
  hero: { gap: space(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginBottom: space(4) },
  tile: {
    width: '47%',
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(4),
    gap: space(3),
  },
});
