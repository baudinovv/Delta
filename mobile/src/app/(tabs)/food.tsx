import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Animated, { FadeIn, FadeInDown, FadeOutLeft } from 'react-native-reanimated';

import { MacroBar, Ring } from '@/components/charts';
import { ManualSheet, MEALS, ScanSheet } from '@/components/food-sheets';
import { CountUp, haptic, listLayout, PressScale } from '@/components/motion';
import { Button, Card, ErrorText, IconButton, Loading, Screen } from '@/components/ui';
import { api, type FoodDay, type FoodEntry, type Meal } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { getMealPhoto, isoDate, PermissionDenied, type Photo } from '@/lib/photo';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const MEAL_ICON = { BREAKFAST: 'sunny', LUNCH: 'partly-sunny', DINNER: 'moon', SNACK: 'cafe' } as const;

export default function FoodScreen() {
  const token = useToken();
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ scan?: string }>();
  const [date, setDate] = useState(() => new Date());
  const [day, setDay] = useState<FoodDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [manual, setManual] = useState(false);

  const iso = isoDate(date);
  const isToday = iso === isoDate(new Date());

  const load = useCallback(async () => {
    try {
      setDay(await api.foodDay(token, iso));
      setError(null);
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [token, iso, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const snap = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        const p = await getMealPhoto(source);
        if (p) setPhoto(p);
      } catch (e) {
        const msg = e instanceof PermissionDenied ? t('food.permission') : t('err.generic');
        if (Platform.OS === 'web') setError(msg);
        else Alert.alert(msg);
      }
    },
    [t],
  );

  // "Snap a meal" on the home screen lands here with ?scan=1
  useEffect(() => {
    if (params.scan) {
      router.setParams({ scan: undefined });
      snap('camera');
    }
  }, [params.scan, snap]);

  /** Optimistic: the row slides out right away, the server catches up; on failure we reload. */
  const remove = async (id: string) => {
    haptic('tap');
    setDay((d) => {
      if (!d) return d;
      const gone = d.entries.find((x) => x.id === id);
      if (!gone) return d;
      return {
        ...d,
        entries: d.entries.filter((x) => x.id !== id),
        totals: {
          kcal: d.totals.kcal - gone.kcal,
          proteinG: d.totals.proteinG - (gone.proteinG ?? 0),
          fatG: d.totals.fatG - (gone.fatG ?? 0),
          carbsG: d.totals.carbsG - (gone.carbsG ?? 0),
        },
      };
    });
    try {
      await api.deleteFood(token, id);
    } catch (e) {
      setError(errorText(e, t));
      load();
    }
  };

  const shift = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
    setDay(null);
  };

  const dateTitle = isToday
    ? t('common.today')
    : iso === isoDate(new Date(Date.now() - 864e5))
      ? t('common.yesterday')
      : date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  const target = day?.targets;
  const totals = day?.totals ?? { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };

  return (
    <>
      <Screen
        title={t('food.title')}
        onRefresh={load}
        right={
          <View style={styles.dateNav}>
            <IconButton icon="chevron-back" label="prev" size={34} onPress={() => shift(-1)} />
            <Text style={[type.h3, { minWidth: 84, textAlign: 'center' }]}>{dateTitle}</Text>
            <View style={{ opacity: isToday ? 0.3 : 1 }}>
              <IconButton icon="chevron-forward" label="next" size={34} onPress={() => !isToday && shift(1)} />
            </View>
          </View>
        }>
        <ErrorText message={error} />

        <Card style={styles.summary}>
          <Ring value={totals.kcal} max={target?.kcal ?? 0} size={112} stroke={10}>
            <Text style={[type.display, { fontSize: 24 }]}>
              <CountUp value={totals.kcal} />
            </Text>
            <Text style={[type.small, { fontSize: 12 }]}>
              {target ? `/ ${target.kcal}` : t('common.kcal')}
            </Text>
          </Ring>
          <View style={{ flex: 1, gap: space(2.5) }}>
            <MacroBar label={t('macro.protein')} value={totals.proteinG} target={target?.proteinG} color={colors.protein} unit={t('common.g')} />
            <MacroBar label={t('macro.fat')} value={totals.fatG} target={target?.fatG} color={colors.fat} unit={t('common.g')} />
            <MacroBar label={t('macro.carbs')} value={totals.carbsG} target={target?.carbsG} color={colors.carbs} unit={t('common.g')} />
          </View>
        </Card>

        <View style={styles.snapCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={styles.snapIcon}>
              <Ionicons name="scan" size={24} color={colors.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: colors.accentInk }]}>{t('food.snap')}</Text>
              <Text style={[type.small, { color: 'rgba(10,12,15,0.7)' }]}>{t('food.snapSub')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <PressScale
              style={styles.snapBtn}
              onPress={() => snap('camera')}
              accessibilityRole="button"
              hapticKind="tap"
              scaleTo={0.94}>
              <Ionicons name="camera" size={18} color={colors.accent} />
              <Text style={styles.snapBtnText}>{t('food.camera')}</Text>
            </PressScale>
            <PressScale
              style={styles.snapBtn}
              onPress={() => snap('gallery')}
              accessibilityRole="button"
              hapticKind="tap"
              scaleTo={0.94}>
              <Ionicons name="images" size={18} color={colors.accent} />
              <Text style={styles.snapBtnText}>{t('food.gallery')}</Text>
            </PressScale>
          </View>
        </View>

        <Button title={t('food.manual')} icon="add" variant="secondary" size="md" onPress={() => setManual(true)} />

        {!day ? (
          <Loading compact />
        ) : (
          MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={day.entries.filter((e) => e.meal === meal)}
              onDelete={remove}
            />
          ))
        )}
      </Screen>

      <ScanSheet
        photo={photo}
        date={iso}
        onClose={() => setPhoto(null)}
        onSaved={() => {
          setPhoto(null);
          load();
        }}
      />
      <ManualSheet
        visible={manual}
        date={iso}
        onClose={() => setManual(false)}
        onSaved={() => {
          setManual(false);
          load();
        }}
      />
    </>
  );
}

function MealSection({
  meal,
  entries,
  onDelete,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  return (
    <Animated.View layout={listLayout}>
    <Card style={{ paddingVertical: space(3) }}>
      <View style={styles.mealHead}>
        <Ionicons name={MEAL_ICON[meal]} size={18} color={colors.muted} />
        <Text style={[type.h3, { flex: 1 }]}>{t(`food.meal.${meal}`)}</Text>
        <Text style={[type.h3, type.num, { color: kcal ? colors.text : colors.faint }]}>
          <CountUp value={kcal} /> <Text style={type.small}>{t('common.kcal')}</Text>
        </Text>
      </View>
      {entries.length === 0 ? (
        <Animated.Text entering={FadeIn} style={[type.small, { color: colors.faint, marginTop: space(1) }]}>
          {t('food.empty')}
        </Animated.Text>
      ) : (
        entries.map((e) => (
          <Animated.View
            key={e.id}
            entering={FadeInDown.duration(300)}
            exiting={FadeOutLeft.duration(220)}
            layout={listLayout}
            style={styles.entry}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
                {e.source === 'PHOTO' && <Ionicons name="camera" size={12} color={colors.accent} />}
                <Text style={[type.body, { fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
                  {e.name}
                </Text>
              </View>
              <Text style={[type.small, type.num, { fontSize: 13 }]}>
                {e.grams ? `${e.grams} ${t('common.g')} · ` : ''}
                {t('macro.p')} {Math.round(e.proteinG ?? 0)} · {t('macro.f')} {Math.round(e.fatG ?? 0)} · {t('macro.c')}{' '}
                {Math.round(e.carbsG ?? 0)}
              </Text>
            </View>
            <Text style={[type.body, type.num, { fontWeight: '700' }]}>{e.kcal}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}
              hitSlop={10}
              onPress={() => onDelete(e.id)}>
              <Ionicons name="close-circle" size={20} color={colors.faint} />
            </Pressable>
          </Animated.View>
        ))
      )}
    </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  snapCard: { backgroundColor: colors.accent, borderRadius: radius.lg, padding: space(4), gap: space(4) },
  snapIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10,12,15,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentInk,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
  snapBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1) },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: space(1),
  },
});

