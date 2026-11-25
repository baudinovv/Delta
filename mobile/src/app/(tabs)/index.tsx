import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { BarChart, MacroBar, Ring, Sparkline } from '@/components/charts';
import { CountUp, PressScale } from '@/components/motion';
import { Avatar, Button, Card, ErrorText, Loading, Screen, SectionTitle, type IconName } from '@/components/ui';
import { api, type Dashboard } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useMe } from '@/lib/me';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

export default function HomeScreen() {
  const token = useToken();
  const { t, ex, locale } = useI18n();
  const { me } = useMe();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.dashboard(token));
      setError(null);
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data && !error) return <Loading />;

  const dateLabel = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const dayLabels = (data?.days ?? []).map((d) =>
    new Date(`${d.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 2),
  );

  return (
    <Screen
      subtitle={dateLabel}
      title={me?.name ? `${t('home.hi')}, ${me.name.split(' ')[0]}` : t('home.hello')}
      onRefresh={load}
      right={
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t('tab.profile')}
          onPress={() => router.push('/profile')}
          scaleTo={0.9}
          hapticKind="tap">
          <Avatar name={me?.name} size={44} />
        </PressScale>
      }>
      <ErrorText message={error} />

      {data && (
        <>
          <CaloriesCard data={data} />

          <View style={styles.statsRow}>
            <Stat icon="barbell" value={`${data.workoutsThisWeek}/${data.plannedPerWeek}`} label={t('home.statWorkouts')}>
              <View style={styles.dots}>
                {Array.from({ length: data.plannedPerWeek }, (_, i) => (
                  <Animated.View
                    key={i}
                    entering={ZoomIn.delay(300 + i * 90).springify()}
                    style={[styles.dot, i < data.workoutsThisWeek && { backgroundColor: colors.accent }]}
                  />
                ))}
              </View>
            </Stat>
            <Stat
              icon="flame"
              iconColor={data.streakDays > 0 ? colors.fat : colors.faint}
              value={<CountUp value={data.streakDays} />}
              label={t('home.statStreak')}
              pulse={data.streakDays > 0}
            />
            <Stat icon="layers" iconColor={colors.protein} value={<CountUp value={data.setsToday} />} label={t('home.statSets')} />
          </View>

          {data.stepsToday != null && (
            <PressScale accessibilityRole="button" onPress={() => router.push('/health')} scaleTo={0.98} hapticKind="tap">
              <Card style={styles.steps}>
                <Ionicons name="footsteps" size={20} color={colors.accent} />
                <Text style={[type.h2, type.num]}>
                  <CountUp value={data.stepsToday} />
                </Text>
                <Text style={[type.small, { flex: 1 }]}>{t('hl.stepsToday')}</Text>
                {data.activeKcalToday != null && (
                  <Text style={[type.small, type.num]}>
                    <Text style={{ color: colors.fat, fontWeight: '700' }}>{data.activeKcalToday}</Text> {t('hl.activeToday')}
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.faint} />
              </Card>
            </PressScale>
          )}

          <View style={styles.actions}>
            <Action
              icon="camera"
              title={t('home.snap')}
              sub={t('home.snapSub')}
              accent
              onPress={() => router.push({ pathname: '/food', params: { scan: '1' } })}
            />
            <Action icon="sparkles" title={t('home.ask')} sub={t('home.askSub')} onPress={() => router.push('/coach')} />
          </View>

          <SectionTitle>{t('home.calories7')}</SectionTitle>
          <Card>
            <BarChart
              values={data.days.map((d) => d.kcal)}
              labels={dayLabels}
              target={data.targets?.kcal}
              color={colors.accent}
            />
          </Card>

          <SectionTitle>{t('home.volume7')}</SectionTitle>
          <Card>
            <BarChart
              values={data.days.map((d) => d.volumeKg)}
              labels={dayLabels}
              color={colors.protein}
              format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}${t('common.t')}` : String(n))}
            />
          </Card>

          <SectionTitle
            right={
              <Pressable accessibilityRole="button" onPress={() => router.push('/progress')} hitSlop={8}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{t('progress.all')} ›</Text>
              </Pressable>
            }>
            {t('home.lifts')}
          </SectionTitle>
          <Card style={{ gap: space(4) }}>
            {data.lifts.length === 0 ? (
              <Text style={type.small}>{t('home.noLifts')}</Text>
            ) : (
              <>
                <Text style={type.small}>{t('home.liftsHint')}</Text>
                {data.lifts.map((l) => {
                  const pts = l.e1rmByWeek.filter((v): v is number => v != null);
                  const change = pts.length > 1 ? pts[pts.length - 1] - pts[0] : 0;
                  return (
                    <View key={l.exercise} style={styles.liftRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={type.h3}>{ex(l.exercise)}</Text>
                        <Text style={[type.small, type.num]}>
                          {l.weightKg} {t('common.kg')} × {l.reps}
                        </Text>
                      </View>
                      <Sparkline values={l.e1rmByWeek} />
                      <View style={{ width: 68, alignItems: 'flex-end' }}>
                        <Text style={[type.h3, type.num]}>{Math.round(pts[pts.length - 1] ?? 0)}</Text>
                        {change !== 0 && (
                          <Text style={[styles.delta, { color: change > 0 ? colors.up : colors.down }]}>
                            {change > 0 ? '+' : ''}
                            {change.toFixed(1)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

function CaloriesCard({ data }: { data: Dashboard }) {
  const { t } = useI18n();
  const target = data.targets;
  const left = target ? target.kcal - data.kcalToday : 0;
  return (
    <Card style={{ padding: space(5) }}>
      <View style={styles.calRow}>
        <Ring value={data.kcalToday} max={target?.kcal ?? 0} size={150} stroke={13}>
          <Text style={[type.display, { fontSize: 32 }]}>
            <CountUp value={data.kcalToday} />
          </Text>
          <Text style={type.small}>{t('home.eaten')}</Text>
        </Ring>
        <View style={{ flex: 1, gap: space(1) }}>
          {target ? (
            <>
              <Text style={type.caption}>{left >= 0 ? t('home.left') : t('home.over')}</Text>
              <Text style={[type.display, { fontSize: 34, color: left >= 0 ? colors.text : colors.down }]}>
                <CountUp value={Math.abs(left)} />
              </Text>
              <Text style={type.small}>
                {t('common.kcal')} · {t('home.target')} {target.kcal}
              </Text>
            </>
          ) : (
            <>
              <Text style={type.small}>{t('home.noTargets')}</Text>
              <Button
                title={t('home.fillProfile')}
                size="md"
                variant="secondary"
                onPress={() => router.push('/profile/personal')}
                style={{ marginTop: space(2) }}
              />
            </>
          )}
        </View>
      </View>
      <View style={{ gap: space(3), marginTop: space(5) }}>
        <MacroBar
          label={t('macro.protein')}
          value={data.proteinToday}
          target={target?.proteinG}
          color={colors.protein}
          unit={t('common.g')}
        />
        <MacroBar
          label={t('macro.fat')}
          value={data.fatToday}
          target={target?.fatG}
          color={colors.fat}
          unit={t('common.g')}
        />
        <MacroBar
          label={t('macro.carbs')}
          value={data.carbsToday}
          target={target?.carbsG}
          color={colors.carbs}
          unit={t('common.g')}
        />
      </View>
    </Card>
  );
}

function Stat({
  icon,
  iconColor = colors.accent,
  value,
  pulse,
  label,
  children,
}: {
  icon: IconName;
  iconColor?: string;
  value: React.ReactNode;
  pulse?: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Card style={styles.stat}>
      <Pulse active={!!pulse}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </Pulse>
      <Text style={[type.display, { fontSize: 28, marginTop: space(2) }]}>{value}</Text>
      {children}
      <Text style={[type.small, { fontSize: 12, lineHeight: 15, marginTop: space(1) }]} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

function Action({
  icon,
  title,
  sub,
  onPress,
  accent,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <PressScale
      accessibilityRole="button"
      onPress={onPress}
      hapticKind="tap"
      scaleTo={0.96}
      style={[styles.action, accent && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
      <View style={[styles.actionIcon, accent && { backgroundColor: 'rgba(10,12,15,0.12)' }]}>
        <Ionicons name={icon} size={20} color={accent ? colors.accentInk : colors.accent} />
      </View>
      <Text style={[type.h3, { fontSize: 16 }, accent && { color: colors.accentInk }]}>{title}</Text>
      <Text style={[type.small, { fontSize: 13 }, accent && { color: 'rgba(10,12,15,0.7)' }]}>{sub}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  calRow: { flexDirection: 'row', alignItems: 'center', gap: space(5) },
  statsRow: { flexDirection: 'row', gap: space(3) },
  stat: { flex: 1, padding: space(3.5) },
  dots: { flexDirection: 'row', gap: 4, marginTop: space(1.5) },
  dot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface3 },
  actions: { flexDirection: 'row', gap: space(3) },
  steps: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingVertical: space(3) },
  action: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space(4),
    gap: space(1),
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(2),
  },
  liftRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  delta: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

/** Gentle heartbeat for the streak flame. */
function Pulse({ active, children }: { active: boolean; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = active
      ? withRepeat(withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true)
      : withTiming(1);
  }, [active, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[{ alignSelf: 'flex-start' }, animated]}>{children}</Animated.View>;
}
