import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, ErrorText } from '@/components/ui';
import { api, ApiError, type BestSet, type Trend, type WeeklySummary } from '@/lib/api';
import { useToken } from '@/lib/session';
import { colors, space } from '@/lib/theme';

const TREND_LABEL: Record<Trend, { text: string; color: string }> = {
  UP: { text: '▲ Up', color: colors.up },
  FLAT: { text: '■ Holding steady', color: colors.navy },
  DOWN: { text: '▼ Lower than your first week', color: colors.down },
  NEW: { text: '● New, compare next week', color: colors.muted },
};

const fmt = (b: BestSet) => `${b.weightKg} kg × ${b.reps}`;
const weekLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function SummaryScreen() {
  const token = useToken();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await api.weeklySummary(token));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load your summary.');
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!summary && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <ErrorText message={error} />

      {summary && summary.exercises.length === 0 && (
        <Card>
          <Text style={styles.body}>Log your first sets and your summary will appear here on Sunday.</Text>
        </Card>
      )}

      {summary && summary.mode === 'BASELINE' && summary.exercises.length > 0 && (
        <>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{summary.message}</Text>
          </View>
          <Text style={styles.sectionLabel}>Your best set this week</Text>
          {summary.exercises.map((e) => (
            <Card key={e.exercise} style={styles.item}>
              <Text style={styles.exercise}>{e.exercise}</Text>
              <Text style={styles.big}>{fmt(e.latest)}</Text>
            </Card>
          ))}
        </>
      )}

      {summary && summary.mode === 'COMPARISON' && (
        <>
          <Text style={styles.headline}>
            {summary.weeksLogged} weeks logged. Here's what changed since your first week.
          </Text>
          {summary.exercises.map((e) => {
            const trend = TREND_LABEL[e.trend ?? 'NEW'];
            return (
              <Card key={e.exercise} style={styles.item}>
                <View style={styles.titleRow}>
                  <Text style={styles.exercise}>{e.exercise}</Text>
                  <Text style={[styles.trend, { color: trend.color }]}>{trend.text}</Text>
                </View>
                {e.first && e.trend !== 'NEW' ? (
                  <View style={styles.compare}>
                    <View>
                      <Text style={styles.caption}>Week of {weekLabel(e.first.weekStart)}</Text>
                      <Text style={styles.big}>{fmt(e.first)}</Text>
                    </View>
                    <Text style={styles.arrow}>→</Text>
                    <View>
                      <Text style={styles.caption}>Week of {weekLabel(e.latest.weekStart)}</Text>
                      <Text style={styles.big}>{fmt(e.latest)}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.big}>{fmt(e.latest)}</Text>
                )}
                {e.weeks && e.weeks.length > 2 && (
                  <Text style={styles.history}>
                    {e.weeks.map((w) => `${weekLabel(w.weekStart)}: ${fmt(w)}`).join('   ·   ')}
                  </Text>
                )}
              </Card>
            );
          })}
          <Text style={styles.footnote}>
            Best set = the heaviest set once reps are taken into account (estimated 1-rep max).
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(12) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  banner: { backgroundColor: colors.navy, borderRadius: 12, padding: space(4), marginBottom: space(5) },
  bannerText: { color: '#fff', fontSize: 17, fontWeight: '600', lineHeight: 24 },
  headline: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: space(4), lineHeight: 24 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: space(2) },
  item: { marginBottom: space(3) },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' },
  exercise: { fontSize: 18, fontWeight: '700', color: colors.text },
  trend: { fontSize: 14, fontWeight: '700' },
  compare: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(3) },
  arrow: { fontSize: 22, color: colors.muted },
  caption: { fontSize: 12, color: colors.muted },
  big: { fontSize: 22, fontWeight: '800', color: colors.navy, marginTop: space(1) },
  history: { fontSize: 13, color: colors.muted, marginTop: space(3), lineHeight: 20 },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  footnote: { fontSize: 13, color: colors.muted, marginTop: space(2) },
});
