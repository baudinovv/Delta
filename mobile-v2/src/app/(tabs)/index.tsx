import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BarChart, MacroBar, Ring, Sparkline } from '@/components/charts';
import { Button, Card, ErrorText, IconButton, Loading, Screen, SectionTitle, type IconName } from '@/components/ui';
import { api, type Dashboard } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

export default function HomeScreen() {
  const token = useToken();
  const { t, ex, locale } = useI18n();
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
      title={t('home.hello')}
      onRefresh={load}
      right={<IconButton icon="person-outline" label={t('settings.title')} onPress={() => router.push('/settings')} />}>
      <ErrorText message={error} />

      {data && (
        <>
          <CaloriesCard data={data} />

          <View style={styles.statsRow}>
            <Stat icon="barbell" value={`${data.workoutsThisWeek}/${data.plannedPerWeek}`} label={t('home.statWorkouts')}>
              <View style={styles.dots}>
                {Array.from({ length: data.plannedPerWeek }, (_, i) => (
                  <View key={i} style={[styles.dot, i < data.workoutsThisWeek && { backgroundColor: colors.accent }]} />
                ))}
              </View>
            </Stat>
            <Stat
              icon="flame"
              iconColor={data.streakDays > 0 ? colors.fat : colors.faint}
              value={String(data.streakDays)}
              label={t('home.statStreak')}
            />
            <Stat icon="layers" iconColor={colors.protein} value={String(data.setsToday)} label={t('home.statSets')} />
          </View>

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
          <View style={styles.actions}>
            <Action icon="calculator" title={t('home.calc')} sub={t('home.calcSub')} onPress={() => router.push('/calculator')} />
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

          <SectionTitle>{t('home.lifts')}</SectionTitle>
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
          <Text style={[type.display, { fontSize: 32 }]}>{data.kcalToday}</Text>
          <Text style={type.small}>{t('home.eaten')}</Text>
        </Ring>
        <View style={{ flex: 1, gap: space(1) }}>
          {target ? (
            <>
              <Text style={type.caption}>{left >= 0 ? t('home.left') : t('home.over')}</Text>
              <Text style={[type.display, { fontSize: 34, color: left >= 0 ? colors.text : colors.down }]}>
                {Math.abs(left)}
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
                onPress={() => router.push('/settings')}
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
  label,
  children,
}: {
  icon: IconName;
  iconColor?: string;
  value: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Card style={styles.stat}>
      <Ionicons name={icon} size={18} color={iconColor} />
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        accent && { backgroundColor: colors.accent, borderColor: colors.accent },
        pressed && { opacity: 0.85 },
      ]}>
      <View style={[styles.actionIcon, accent && { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
        <Ionicons name={icon} size={20} color={accent ? colors.accentInk : colors.accent} />
      </View>
      <Text style={[type.h3, { fontSize: 16 }, accent && { color: colors.accentInk }]}>{title}</Text>
      <Text style={[type.small, { fontSize: 13 }, accent && { color: 'rgba(255,255,255,0.75)' }]}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  calRow: { flexDirection: 'row', alignItems: 'center', gap: space(5) },
  statsRow: { flexDirection: 'row', gap: space(3) },
  stat: { flex: 1, padding: space(3.5) },
  dots: { flexDirection: 'row', gap: 4, marginTop: space(1.5) },
  dot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface3 },
  actions: { flexDirection: 'row', gap: space(3) },
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
