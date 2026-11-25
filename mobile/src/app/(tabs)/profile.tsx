import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Animated, { ZoomIn } from 'react-native-reanimated';

import { CountUp } from '@/components/motion';
import { Avatar, Card, ListGroup, ListRow, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/me';
import { useSession, useToken } from '@/lib/session';
import { colors, space, type } from '@/lib/theme';

export default function ProfileScreen() {
  const token = useToken();
  const { signOut } = useSession();
  const { me, reload } = useMe();
  const { t, lang, locale } = useI18n();
  const [streak, setStreak] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload().catch(() => undefined);
      api
        .dashboard(token)
        .then((d) => setStreak(d.streakDays))
        .catch(() => undefined);
    }, [reload, token]),
  );

  if (!me) return <Loading />;

  const since = new Date(me.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const body = [me.heightCm ? `${me.heightCm} cm` : null, me.weightKg ? `${me.weightKg} ${t('common.kg')}` : null]
    .filter(Boolean)
    .join(' · ')
    .replace('cm', lang === 'ru' ? 'см' : 'cm');

  return (
    <Screen onRefresh={() => reload()}>
      <View style={styles.header}>
        <Animated.View entering={ZoomIn.springify().damping(13)}>
          <Avatar name={me.name} size={84} />
        </Animated.View>
        <Text style={[type.h1, { textAlign: 'center' }]}>{me.name || 'Delta'}</Text>
        {me.email && <Text style={type.small}>{me.email}</Text>}
        <Text style={[type.small, { fontSize: 12, color: colors.faint }]}>{t('profile.since', { d: since })}</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={me.weightKg} label={t('profile.statWeight')} />
        <Stat value={streak} label={t('profile.statStreak')} />
        <Stat value={me.targets?.kcal} label={t('profile.statTarget')} />
      </View>

      <ListGroup title={t('profile.secYou')}>
        <ListRow
          icon="person"
          title={t('profile.personal')}
          value={body || t('profile.notSet')}
          onPress={() => router.push('/profile/personal')}
        />
        <ListRow
          icon="flag"
          iconColor={colors.fat}
          title={t('profile.goals')}
          value={t(`goal.${me.goal}`)}
          onPress={() => router.push('/profile/goals')}
        />
        <ListRow
          icon="trending-up"
          iconColor={colors.up}
          title={t('profile.progress')}
          value={t('profile.progressSub')}
          onPress={() => router.push('/progress')}
          last
        />
      </ListGroup>

      <ListGroup title={t('profile.secApp')}>
        <ListRow
          icon="language"
          iconColor={colors.protein}
          title={t('profile.language')}
          value={lang === 'ru' ? 'Русский' : 'English'}
          onPress={() => router.push('/profile/language')}
        />
        <ListRow
          icon="shield-checkmark"
          iconColor={colors.carbs}
          title={t('profile.account')}
          onPress={() => router.push('/profile/account')}
          last
        />
      </ListGroup>

      <ListGroup>
        <ListRow icon="log-out-outline" title={t('profile.signOut')} onPress={signOut} danger last />
      </ListGroup>

      <Text style={styles.version}>Delta · MVP</Text>
    </Screen>
  );
}

function Stat({ value, label }: { value: number | null | undefined; label: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={[type.h2, type.num]}>{value == null ? '–' : <CountUp value={value} decimals={value % 1 ? 1 : 0} />}</Text>
      <Text style={[type.small, { fontSize: 12, textAlign: 'center' }]} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space(1.5), paddingTop: space(4), paddingBottom: space(2) },
  stats: { flexDirection: 'row', gap: space(3) },
  stat: { flex: 1, alignItems: 'center', gap: space(1), paddingVertical: space(3) },
  version: { ...type.small, fontSize: 12, textAlign: 'center', color: colors.faint, marginTop: space(2) },
});
