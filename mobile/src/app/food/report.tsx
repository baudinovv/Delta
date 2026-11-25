import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BarChart, MacroBar } from '@/components/charts';
import { CountUp } from '@/components/motion';
import { Card, ErrorText, Loading, Screen, Segmented } from '@/components/ui';
import { api, type Report } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

type Range = '7' | '14' | '30';

export default function ReportScreen() {
  const token = useToken();
  const { t, locale } = useI18n();
  const [range, setRange] = useState<Range>('7');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await api.report(token, Number(range) as 7 | 14 | 30));
      setError(null);
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [token, range, t]);

  useEffect(() => {
    load();
  }, [load]);

  const picker = (
    <Segmented<Range>
      options={[
        { value: '7', label: t('rp.days', { n: 7 }) },
        { value: '14', label: t('rp.days', { n: 14 }) },
        { value: '30', label: t('rp.days', { n: 30 }) },
      ]}
      value={range}
      onChange={(v) => {
        setRange(v);
        setReport(null);
      }}
    />
  );

  if (!report) {
    return (
      <Screen inStack>
        {picker}
        {error ? <ErrorText message={error} /> : <Loading compact />}
      </Screen>
    );
  }

  const r = report;
  const n = r.byDay.length;
  const labels = r.byDay.map((d, i) => {
    const date = new Date(`${d.date}T12:00:00`);
    if (n <= 7) return date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 2);
    return i % (n > 14 ? 5 : 2) === 0 || i === n - 1 ? String(date.getDate()) : '';
  });

  return (
    <Screen inStack onRefresh={load}>
      {picker}

      {r.loggedDays === 0 ? (
        <Card>
          <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>{t('rp.empty')}</Text>
        </Card>
      ) : (
        <>
          <Card style={{ gap: space(1) }}>
            <Text style={type.caption}>{t('rp.avg')}</Text>
            <Text style={type.display}>
              <CountUp value={r.avgKcal} />
              <Text style={[type.small, { fontSize: 16, letterSpacing: 0 }]}>
                {' '}
                {t('common.kcal')}
                {r.targets ? ` / ${r.targets.kcal}` : ''}
              </Text>
            </Text>
            <Text style={type.small}>{t('rp.logged', { n: r.loggedDays, d: r.days })}</Text>
            {r.targets && <Text style={type.small}>{t('rp.onTarget', { n: r.daysOnTarget })}</Text>}
            <View style={{ marginTop: space(4) }}>
              <BarChart
                values={r.byDay.map((d) => d.kcal)}
                labels={labels}
                target={r.targets?.kcal}
                showValues={n <= 7}
                height={130}
              />
            </View>
          </Card>

          <Card style={{ gap: space(3) }}>
            <Text style={type.caption}>{t('rp.split')}</Text>
            <SplitBar p={r.proteinPct} f={r.fatPct} c={r.carbsPct} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Legend color={colors.protein} label={t('macro.protein')} pct={r.proteinPct} />
              <Legend color={colors.fat} label={t('macro.fat')} pct={r.fatPct} />
              <Legend color={colors.carbs} label={t('macro.carbs')} pct={r.carbsPct} />
            </View>
            <View style={{ gap: space(3), marginTop: space(2) }}>
              <MacroBar label={t('macro.protein')} value={r.avgProteinG} target={r.targets?.proteinG} color={colors.protein} unit={t('common.g')} />
              <MacroBar label={t('macro.fat')} value={r.avgFatG} target={r.targets?.fatG} color={colors.fat} unit={t('common.g')} />
              <MacroBar label={t('macro.carbs')} value={r.avgCarbsG} target={r.targets?.carbsG} color={colors.carbs} unit={t('common.g')} />
            </View>
          </Card>

          <Card style={{ gap: space(3) }}>
            <Text style={type.caption}>{t('rp.more')}</Text>
            <MacroBar label={t('food.fiber')} value={r.avgFiberG} target={30} color={colors.up} unit={t('common.g')} />
            <MacroBar label={t('food.sugar')} value={r.avgSugarG} target={50} color={colors.down} unit={t('common.g')} />
            <MacroBar label={t('food.water')} value={r.avgWaterMl} target={2500} color={colors.protein} unit="ml" />
          </Card>

          {r.topFoods.length > 0 && (
            <Card style={{ gap: space(1) }}>
              <Text style={[type.caption, { marginBottom: space(1) }]}>{t('rp.top')}</Text>
              {r.topFoods.map((f, i) => (
                <View key={f.name} style={[styles.topRow, i > 0 && styles.divider]}>
                  <Text style={[styles.rank, i === 0 && { color: colors.accent }]}>{i + 1}</Text>
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={[type.small, type.num]}>{f.times}×</Text>
                  <Text style={[type.body, type.num, { fontWeight: '700', minWidth: 64, textAlign: 'right' }]}>
                    {f.kcal}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function SplitBar({ p, f, c }: { p: number; f: number; c: number }) {
  return (
    <View style={styles.split}>
      <Segment pct={p} color={colors.protein} />
      <Segment pct={f} color={colors.fat} />
      <Segment pct={c} color={colors.carbs} />
    </View>
  );
}

function Segment({ pct, color }: { pct: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [pct, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <Animated.View style={[{ height: 14, backgroundColor: color }, style]} />;
}

function Legend({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={type.small}>
        {label} <Text style={{ color: colors.text, fontWeight: '700' }}>{pct}%</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surface3 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rank: { width: 18, fontSize: 15, fontWeight: '800', color: colors.muted },
});
