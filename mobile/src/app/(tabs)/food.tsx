import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutLeft, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { MacroBar, Ring } from '@/components/charts';
import { MEALS, ScanSheet } from '@/components/food-sheets';
import { CountUp, haptic, listLayout, PressScale } from '@/components/motion';
import { Card, ErrorText, IconButton, Loading, Screen, type IconName } from '@/components/ui';
import { api, type FoodDay, type FoodEntry, type Meal } from '@/lib/api';
import { portionText } from '@/lib/food';
import { errorText, useI18n } from '@/lib/i18n';
import { getMealPhoto, isoDate, PermissionDenied, type Photo } from '@/lib/photo';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const MEAL_ICON = { BREAKFAST: 'sunny', LUNCH: 'partly-sunny', DINNER: 'moon', SNACK: 'cafe' } as const;

export default function FoodScreen() {
  const token = useToken();
  const { t, locale, lang } = useI18n();
  const params = useLocalSearchParams<{ scan?: string }>();
  const [date, setDate] = useState(() => new Date());
  const [day, setDay] = useState<FoodDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);

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
          ...d.totals,
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

  /** Optimistic: the glass fills right away. */
  const water = async (delta: number) => {
    if (!day) return;
    const next = Math.max(0, day.waterMl + delta);
    haptic(delta > 0 ? 'tap' : 'select');
    setDay({ ...day, waterMl: next });
    try {
      const w = await api.addWater(token, iso, delta);
      setDay((d) => (d ? { ...d, waterMl: w.ml, waterTargetMl: w.targetMl } : d));
    } catch (e) {
      setError(errorText(e, t));
      load();
    }
  };

  const copyYesterday = async (meal: Meal) => {
    const y = new Date(date);
    y.setDate(y.getDate() - 1);
    try {
      await api.copyMeal(token, isoDate(y), meal, iso, meal);
      haptic('success');
      load();
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  const addTo = (meal: Meal) => router.push({ pathname: '/food/add', params: { meal, date: iso } });

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

        <View style={styles.actions}>
          <QuickAction icon="barcode-outline" label={t('food.scanBarcode')} onPress={() => router.push({ pathname: '/food/scan', params: { date: iso } })} />
          <QuickAction icon="camera-outline" label={t('food.photoMeal')} onPress={() => snap('camera')} />
          <QuickAction icon="images-outline" label={t('food.gallery')} onPress={() => snap('gallery')} />
          <QuickAction icon="bar-chart-outline" label={t('food.report')} onPress={() => router.push('/food/report')} />
        </View>

        {day && <WaterCard ml={day.waterMl} target={day.waterTargetMl} onChange={water} />}

        {!day ? (
          <Loading compact />
        ) : (
          MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={day.entries.filter((e) => e.meal === meal)}
              onDelete={remove}
              onAdd={() => addTo(meal)}
              onCopyYesterday={() => copyYesterday(meal)}
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
    </>
  );
}

function MealSection({
  meal,
  entries,
  onDelete,
  onAdd,
  onCopyYesterday,
}: {
  meal: Meal;
  entries: FoodEntry[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  onCopyYesterday: () => void;
}) {
  const { t, lang } = useI18n();
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
        <IconButton icon="add" label={t('food.add')} tone="accent" size={34} onPress={onAdd} />
      </View>
      {entries.length === 0 ? (
        <Animated.View entering={FadeIn} style={styles.emptyRow}>
          <Text style={[type.small, { color: colors.faint, flex: 1 }]}>{t('food.empty')}</Text>
          <Pressable accessibilityRole="button" onPress={onCopyYesterday} hitSlop={8} style={styles.copy}>
            <Ionicons name="repeat" size={14} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>{t('food.copyYesterday')}</Text>
          </Pressable>
        </Animated.View>
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
                {e.source === 'CATALOG' && e.servingLabel == null && <Ionicons name="scale-outline" size={12} color={colors.muted} />}
                <Text style={[type.body, { fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
                  {e.name}
                </Text>
              </View>
              <Text style={[type.small, type.num, { fontSize: 13 }]} numberOfLines={1}>
                {e.grams ? `${portionText(e.servingLabel, e.servingsCount, e.grams, lang)} · ` : ''}
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

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <PressScale accessibilityRole="button" onPress={onPress} hapticKind="tap" scaleTo={0.94} style={styles.action}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={styles.actionText} numberOfLines={1}>
        {label}
      </Text>
    </PressScale>
  );
}

/** Glasses of 250 ml: tap "+" to drink one, "−" to undo. */
function WaterCard({ ml, target, onChange }: { ml: number; target: number; onChange: (delta: number) => void }) {
  const { t } = useI18n();
  const glasses = Math.min(12, Math.max(6, Math.ceil(target / 250)));
  const full = Math.floor(ml / 250);
  const liters = (n: number) => String(Math.round(n / 10) / 100).replace('.', ',');
  return (
    <Card style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Ionicons name="water" size={18} color={colors.protein} />
        <Text style={[type.h3, { flex: 1 }]}>{t('food.water')}</Text>
        <Text style={[type.small, type.num]}>{t('food.waterOf', { ml: liters(ml), target: liters(target) })}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <IconButton icon="remove" label="-250" size={36} onPress={() => ml > 0 && onChange(-250)} />
        <View style={styles.glasses}>
          {Array.from({ length: glasses }, (_, i) => (
            <Glass key={i} full={i < full} />
          ))}
        </View>
        <IconButton icon="add" label="+250" tone="accent" size={36} onPress={() => onChange(250)} />
      </View>
    </Card>
  );
}

function Glass({ full }: { full: boolean }) {
  return (
    <View style={styles.glass}>
      {full && <Animated.View entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(150)} style={styles.glassFill} />}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space(2) },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: space(1.5),
    paddingVertical: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: colors.text },
  glasses: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  glass: {
    width: 18,
    height: 26,
    borderRadius: 5,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(92,200,255,0.5)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  glassFill: { height: '85%', backgroundColor: colors.protein },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1) },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
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

