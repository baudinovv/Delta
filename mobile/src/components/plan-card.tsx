import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button, Card } from '@/components/ui';
import type { PlanDay, WorkoutPlan } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space, type } from '@/lib/theme';

/** 1 = Monday … 7 = Sunday, like the plan. */
export const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1;

/** The coach's weekly plan: today's exercises, or the next training day; the whole week on demand. */
export function PlanCard({ plan }: { plan: WorkoutPlan | null }) {
  const { t, ex, locale } = useI18n();
  const [open, setOpen] = useState(false);

  const dayName = (weekday: number) => {
    const d = new Date(2024, 0, weekday); // 2024-01-01 is a Monday
    return d.toLocaleDateString(locale, { weekday: 'long' });
  };

  if (!plan) {
    return (
      <Card style={styles.empty}>
        <Ionicons name="calendar-outline" size={22} color={colors.muted} />
        <Text style={[type.small, { flex: 1 }]}>{t('planCard.none')}</Text>
        <Button
          title={t('planCard.ask')}
          icon="sparkles"
          size="md"
          variant="secondary"
          onPress={() => router.navigate({ pathname: '/coach', params: { ask: t('planCard.askText') } })}
        />
      </Card>
    );
  }

  const wd = todayWeekday();
  const today = plan.days.find((d) => d.weekday === wd);
  const next = plan.days.find((d) => d.weekday > wd) ?? plan.days[0];

  return (
    <Card style={{ gap: space(3) }}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Ionicons name="calendar" size={16} color={colors.accentInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>{today ? t('planCard.today') : t('planCard.rest')}</Text>
          <Text style={type.h3} numberOfLines={1}>
            {today ? today.focus : plan.title}
          </Text>
        </View>
      </View>

      {today ? (
        <DayList day={today} ex={ex} />
      ) : (
        next && (
          <Text style={type.small}>
            {t('planCard.next', { day: dayName(next.weekday), focus: next.focus })}
          </Text>
        )
      )}

      <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8} style={styles.toggle}>
        <Text style={styles.link}>{open ? t('planCard.hide') : t('planCard.week')}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn} style={{ gap: space(3) }}>
          {plan.days.map((d) => (
            <View key={d.weekday} style={[styles.weekDay, d.weekday === wd && styles.weekDayToday]}>
              <Text style={[type.small, { color: colors.text, fontWeight: '700' }]}>
                {dayName(d.weekday)} · {d.focus}
              </Text>
              <DayList day={d} ex={ex} compact />
            </View>
          ))}
        </Animated.View>
      )}
    </Card>
  );
}

function DayList({ day, ex, compact }: { day: PlanDay; ex: (n: string) => string; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: compact ? space(1) : space(2) }}>
      {day.exercises.map((e, i) => (
        <Animated.View key={`${e.name}-${i}`} entering={FadeInDown.delay(i * 40)} style={styles.row}>
          <Text style={[compact ? type.small : type.body, { flex: 1, color: colors.text }]} numberOfLines={1}>
            {ex(e.name)}
          </Text>
          <Text style={[type.small, type.num, { color: colors.text, fontWeight: '700' }]}>
            {e.sets}×{e.reps}
            {e.weightKg ? ` · ${e.weightKg} ${t('common.kg')}` : ''}
          </Text>
        </Animated.View>
      ))}
      {!compact && day.exercises.some((e) => e.note) && (
        <Text style={[type.small, { fontSize: 12 }]}>
          {day.exercises
            .filter((e) => e.note)
            .map((e) => `${ex(e.name)}: ${e.note}`)
            .join(' · ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  weekDay: { gap: space(1.5), padding: space(3), borderRadius: radius.md, backgroundColor: colors.surface2 },
  weekDayToday: { borderWidth: 1, borderColor: colors.accent },
});
