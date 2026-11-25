import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { MacroBar, Ring } from '@/components/charts';
import { mealForNow, MEALS } from '@/components/food-sheets';
import { CountUp, haptic, PressScale } from '@/components/motion';
import { Banner, Button, Card, Chip, ErrorText, IconButton, Loading, Screen } from '@/components/ui';
import { api, ApiError, type Food, type Meal, type Serving } from '@/lib/api';
import { fmtNum, nutritionFor, portionsOf } from '@/lib/food';
import { errorText, useI18n } from '@/lib/i18n';
import { isoDate } from '@/lib/photo';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const GRAMS = '__grams__';

/** Food details: pick a portion and amount, see nutrition live, add to a meal. */
export default function FoodItemScreen() {
  const token = useToken();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ id?: string; barcode?: string; meal?: Meal; date?: string }>();
  const date = params.date ?? isoDate(new Date());

  const [food, setFood] = useState<Food | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [portion, setPortion] = useState<string>('');
  const [count, setCount] = useState('1');
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<Meal>(params.meal ?? mealForNow());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = params.id
      ? api.food(token, params.id, lang)
      : api.foodByBarcode(token, params.barcode ?? '', lang);
    load
      .then((f) => {
        setFood(f);
        setPortion(portionsOf(f, lang)[0].label);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.code === 'BARCODE_NOT_FOUND') setNotFound(true);
        else setError(errorText(e, t));
      });
  }, [params.id, params.barcode, token, lang, t]);

  if (notFound) {
    return (
      <Screen inStack>
        <Banner tone="warn" icon="help-circle" text={t('scan.notFound')} />
        <Button
          title={t('scan.create')}
          icon="add"
          onPress={() => router.replace({ pathname: '/food/new', params: { barcode: params.barcode ?? '' } })}
        />
      </Screen>
    );
  }
  if (!food) return error ? <Screen inStack><ErrorText message={error} /></Screen> : <Loading />;

  const portions = portionsOf(food, lang);
  const selected: Serving | undefined = portions.find((p) => p.label === portion);
  const n = Number(count.replace(',', '.'));
  const g = Number(grams.replace(',', '.'));
  const totalGrams = selected ? selected.grams * (Number.isFinite(n) ? n : 0) : Number.isFinite(g) ? g : 0;
  const nut = nutritionFor(food.per100, totalGrams);
  const valid = totalGrams > 0 && totalGrams <= 5000;

  const step = (d: number) => {
    const next = Math.max(0.25, Math.round(((Number.isFinite(n) ? n : 1) + d) * 4) / 4);
    setCount(fmtNum(next));
  };

  const toggleFavorite = async () => {
    if (!food.id) return;
    const on = !food.favorite;
    setFood({ ...food, favorite: on });
    haptic('select');
    try {
      await api.setFavorite(token, food.id, on);
    } catch (e) {
      setFood({ ...food, favorite: !on });
      setError(errorText(e, t));
    }
  };

  const add = async () => {
    if (!food.id || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await api.addFood(token, {
        date,
        meal,
        lang,
        items: [
          {
            foodId: food.id,
            grams: Math.round(totalGrams),
            servingLabel: selected?.label,
            servingsCount: selected ? n : undefined,
          },
        ],
      });
      haptic('success');
      router.dismissTo('/food');
    } catch (e) {
      setError(errorText(e, t));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!food.id) return;
    try {
      await api.deleteCatalogFood(token, food.id);
      router.back();
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () =>
            food.id ? (
              <IconButton
                icon={food.favorite ? 'star' : 'star-outline'}
                label="favorite"
                tone="plain"
                onPress={toggleFavorite}
              />
            ) : null,
        }}
      />
      <Screen inStack>
        <View style={{ gap: space(1) }}>
          <Text style={type.h1}>{food.name}</Text>
          <Text style={type.small}>
            {food.brand ? `${food.brand} · ` : ''}
            {t(`fd.source.${food.source}`)}
          </Text>
        </View>

        <Card style={styles.summary}>
          <Ring value={nut.kcal} max={Math.max(nut.kcal, 1)} size={118} stroke={10}>
            <Animated.Text entering={ZoomIn} style={[type.display, { fontSize: 28 }]}>
              <CountUp value={nut.kcal} />
            </Animated.Text>
            <Text style={[type.small, { fontSize: 12 }]}>{t('common.kcal')}</Text>
          </Ring>
          <View style={{ flex: 1, gap: space(2.5) }}>
            <MacroBar label={t('macro.protein')} value={nut.proteinG} target={macroScale(nut)} color={colors.protein} unit={t('common.g')} />
            <MacroBar label={t('macro.fat')} value={nut.fatG} target={macroScale(nut)} color={colors.fat} unit={t('common.g')} />
            <MacroBar label={t('macro.carbs')} value={nut.carbsG} target={macroScale(nut)} color={colors.carbs} unit={t('common.g')} />
          </View>
        </Card>

        <Card style={{ gap: space(3) }}>
          <Text style={type.caption}>{t('fd.portion')}</Text>
          <View style={styles.wrap}>
            {portions.map((p) => (
              <PortionChip
                key={p.label}
                label={p.label}
                sub={p.label.replace(/\s/g, '') === `${fmtNum(p.grams)}${t('common.g')}` ? undefined : `${fmtNum(p.grams)} ${t('common.g')}`}
                on={portion === p.label}
                onPress={() => {
                  setPortion(p.label);
                  setCount('1');
                }}
              />
            ))}
            <PortionChip label={t('fd.customGrams')} on={portion === GRAMS} onPress={() => setPortion(GRAMS)} />
          </View>

          <Text style={[type.caption, { marginTop: space(2) }]}>{t('fd.amount')}</Text>
          {selected ? (
            <View style={styles.stepper}>
              <IconButton icon="remove" label="-" onPress={() => step(-0.5)} size={44} />
              <TextInput
                value={count}
                onChangeText={setCount}
                keyboardType="decimal-pad"
                style={styles.amount}
                selectTextOnFocus
              />
              <IconButton icon="add" label="+" onPress={() => step(0.5)} size={44} />
              <Text style={[type.small, { minWidth: 70, textAlign: 'right' }]}>
                = {Math.round(totalGrams)} {t('common.g')}
              </Text>
            </View>
          ) : (
            <View style={styles.stepper}>
              <TextInput
                value={grams}
                onChangeText={setGrams}
                keyboardType="decimal-pad"
                style={[styles.amount, { flex: 1 }]}
                selectTextOnFocus
                autoFocus
              />
              <Text style={type.h3}>{t('common.g')}</Text>
            </View>
          )}
        </Card>

        <Card style={{ gap: space(3) }}>
          <Text style={type.caption}>{t('fd.meal')}</Text>
          <View style={{ flexDirection: 'row', gap: space(1.5) }}>
            {MEALS.map((m) => (
              <Chip key={m} label={t(`food.meal.${m}`)} selected={meal === m} onPress={() => setMeal(m)} />
            ))}
          </View>
        </Card>

        <Card style={{ gap: space(2) }}>
          <Text style={type.caption}>{t('fd.nutrition')}</Text>
          <NutRow label={t('common.kcal')} value={nut.kcal} per100={food.per100.kcal} unit="" />
          <NutRow label={t('macro.protein')} value={nut.proteinG} per100={food.per100.proteinG} unit={t('common.g')} />
          <NutRow label={t('macro.fat')} value={nut.fatG} per100={food.per100.fatG} unit={t('common.g')} />
          <NutRow label={t('macro.carbs')} value={nut.carbsG} per100={food.per100.carbsG} unit={t('common.g')} />
          {nut.fiberG != null && (
            <NutRow label={t('food.fiber')} value={nut.fiberG} per100={food.per100.fiberG ?? 0} unit={t('common.g')} />
          )}
          {nut.sugarG != null && (
            <NutRow label={t('food.sugar')} value={nut.sugarG} per100={food.per100.sugarG ?? 0} unit={t('common.g')} />
          )}
          <Text style={[type.small, { fontSize: 12, textAlign: 'right' }]}>{t('fs.per100')} →</Text>
        </Card>

        {food.ingredients && food.ingredients.length > 0 && (
          <Card style={{ gap: space(2) }}>
            <Text style={type.caption}>{t('fd.ingredients')}</Text>
            {food.ingredients.map((i) => (
              <View key={`${i.foodId}-${i.grams}`} style={styles.nutRow}>
                <Text style={[type.body, { flex: 1 }]}>{i.name}</Text>
                <Text style={[type.small, type.num]}>
                  {fmtNum(i.grams)} {t('common.g')} · {i.kcal} {t('common.kcal')}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <ErrorText message={error} />
        <Button title={t('fd.add', { kcal: nut.kcal })} icon="add" onPress={add} loading={saving} disabled={!valid} />
        {food.own && <Button title={t('fd.delete')} icon="trash-outline" variant="danger" size="md" onPress={remove} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Bars show each macro relative to the biggest one, so the shape of the food is visible at a glance. */
const macroScale = (n: { proteinG: number; fatG: number; carbsG: number }) =>
  Math.max(1, Math.ceil(Math.max(n.proteinG, n.fatG, n.carbsG)));

function PortionChip({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      hapticKind="select"
      scaleTo={0.94}
      style={[styles.portion, on && styles.portionOn]}>
      <Text style={[type.small, { color: on ? colors.accentInk : colors.text, fontWeight: '700' }]} numberOfLines={1}>
        {label}
      </Text>
      {sub && (
        <Animated.Text entering={FadeIn} style={[type.small, { fontSize: 11, color: on ? 'rgba(10,12,15,0.65)' : colors.muted }]}>
          {sub}
        </Animated.Text>
      )}
    </PressScale>
  );
}

function NutRow({ label, value, per100, unit }: { label: string; value: number; per100: number; unit: string }) {
  return (
    <View style={styles.nutRow}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Text style={[type.body, type.num, { fontWeight: '700', minWidth: 70, textAlign: 'right' }]}>
        {fmtNum(value)} {unit}
      </Text>
      <Text style={[type.small, type.num, { minWidth: 64, textAlign: 'right' }]}>
        {fmtNum(Number(per100))} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  portion: {
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    maxWidth: '100%',
  },
  portionOn: { backgroundColor: colors.accent },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  amount: {
    minWidth: 80,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    color: colors.text,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: space(3),
  },
  nutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(1.5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
