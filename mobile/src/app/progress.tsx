import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { Banner, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { api, type BestSet, type Trend, type WeeklySummary } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const TREND: Record<Trend, { icon: 'trending-up' | 'remove' | 'trending-down' | 'ellipse'; color: string }> = {
  UP: { icon: 'trending-up', color: colors.up },
  FLAT: { icon: 'remove', color: colors.muted },
  DOWN: { icon: 'trending-down', color: colors.down },
  NEW: { icon: 'ellipse', color: colors.faint },
};

const e1rm = (b: BestSet) => b.weightKg * (1 + b.reps / 30);

export default function ProgressScreen() {
  const token = useToken();
  const { t, ex, locale } = useI18n();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await api.weeklySummary(token));
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

  if (!summary && !error) return <Loading />;

  const fmt = (b: BestSet) => `${b.weightKg} ${t('common.kg')} × ${b.reps}`;
  const week = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <Screen inStack onRefresh={load}>
      <ErrorText message={error} />

      {summary && summary.exercises.length === 0 && (
        <Card style={styles.emptyCard}>
          <Ionicons name="trending-up" size={36} color={colors.accent} />
          <Text style={[type.body, { textAlign: 'center', color: colors.muted }]}>{t('progress.empty')}</Text>
        </Card>
      )}

      {summary?.mode === 'BASELINE' && summary.exercises.length > 0 && (
        <>
          <Banner icon="flag" text={t('progress.baseline')} />
          <Text style={type.caption}>{t('progress.best')}</Text>
          {summary.exercises.map((e) => (
            <Card key={e.exercise} style={styles.row}>
              <Text style={[type.h3, { flex: 1 }]}>{ex(e.exercise)}</Text>
              <Text style={[type.h2, type.num, { color: colors.accent }]}>{fmt(e.latest)}</Text>
            </Card>
          ))}
        </>
      )}

      {summary?.mode === 'COMPARISON' && (
        <>
          <Text style={[type.body, { color: colors.muted }]}>{t('progress.weeks', { n: summary.weeksLogged })}</Text>
          {summary.exercises.map((e) => {
            const trend = TREND[e.trend ?? 'NEW'];
            return (
              <Card key={e.exercise} style={{ gap: space(3) }}>
                <View style={styles.titleRow}>
                  <Text style={[type.h2, { flex: 1 }]}>{ex(e.exercise)}</Text>
                  <View style={[styles.trendPill, { borderColor: trend.color }]}>
                    <Ionicons name={trend.icon} size={14} color={trend.color} />
                    <Text style={[styles.trendText, { color: trend.color }]}>{t(`progress.${e.trend ?? 'NEW'}`)}</Text>
                  </View>
                </View>
                {e.first && e.trend !== 'NEW' ? (
                  <View style={styles.compare}>
                    <View style={{ flex: 1 }}>
                      <Text style={type.small}>{t('progress.weekOf', { d: week(e.first.weekStart) })}</Text>
                      <Text style={[type.h2, type.num, { color: colors.muted }]}>{fmt(e.first)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={20} color={colors.faint} />
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={type.small}>{t('progress.weekOf', { d: week(e.latest.weekStart) })}</Text>
                      <Text style={[type.h2, type.num, { color: colors.accent }]}>{fmt(e.latest)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[type.h2, type.num, { color: colors.accent }]}>{fmt(e.latest)}</Text>
                )}
                {e.weeks && e.weeks.length > 2 && e.first && (
                  <View style={styles.history}>
                    <Sparkline values={e.weeks.map(e1rm)} width={150} height={40} color={trend.color} />
                    <Text style={[type.small, type.num, { flex: 1, textAlign: 'right' }]}>
                      {t('progress.gain', {
                        n: `${e.latest.weightKg > e.first.weightKg ? '+' : ''}${Math.round((e.latest.weightKg - e.first.weightKg) * 10) / 10}`,
                        w: e.weeks.length,
                      })}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })}
          <Text style={[type.small, { fontSize: 12 }]}>{t('progress.footnote')}</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', gap: space(3), paddingVertical: space(8) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
  },
  trendText: { fontSize: 12, fontWeight: '700' },
  compare: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  history: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space(3),
  },
});
