import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { haptic, PressScale } from '@/components/motion';
import type { Food, Serving } from '@/lib/api';
import { defaultPortion, nutritionFor } from '@/lib/food';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space, type } from '@/lib/theme';

const SOURCE_ICON = { BUILTIN: null, OFF: 'barcode-outline', CUSTOM: 'person-outline', RECIPE: 'restaurant-outline' } as const;

/**
 * One food in a list: name, brand, portion and its calories. Tapping opens details; the round "+"
 * adds the shown portion right away (one-tap logging like in FatSecret).
 */
export function FoodRow({
  food,
  portion,
  index = 0,
  onOpen,
  onQuickAdd,
}: {
  food: Food;
  /** Portion to show and quick-add; defaults to the food's first serving or 100 g. */
  portion?: Serving;
  index?: number;
  onOpen: () => void;
  onQuickAdd?: (portion: Serving) => Promise<void>;
}) {
  const { lang } = useI18n();
  const p = portion ?? defaultPortion(food, lang);
  const kcal = nutritionFor(food.per100, p.grams).kcal;
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const icon = SOURCE_ICON[food.source];

  const quick = async () => {
    if (!onQuickAdd || state === 'busy') return;
    setState('busy');
    try {
      await onQuickAdd(p);
      haptic('success');
      setState('done');
      setTimeout(() => setState('idle'), 1400);
    } catch {
      setState('idle');
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30).duration(260)}>
      <View style={styles.row}>
        <PressScale accessibilityRole="button" onPress={onOpen} scaleTo={0.985} style={styles.main}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
              {icon && <Ionicons name={icon} size={13} color={colors.muted} />}
              <Text style={[type.body, { fontWeight: '600', flexShrink: 1 }]} numberOfLines={2}>
                {food.name}
              </Text>
            </View>
            <Text style={[type.small, { fontSize: 13 }]} numberOfLines={1}>
              {food.brand ? `${food.brand} · ` : ''}
              {p.label}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.h3, type.num]}>{kcal}</Text>
            <Text style={[type.small, { fontSize: 11 }]}>{lang === 'ru' ? 'ккал' : 'kcal'}</Text>
          </View>
        </PressScale>
        {onQuickAdd && (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="+"
            onPress={quick}
            scaleTo={0.85}
            hitSlop={6}
            style={[styles.plus, state === 'done' && { backgroundColor: colors.accent }]}>
            {state === 'busy' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : state === 'done' ? (
              <Animated.View entering={ZoomIn.springify()}>
                <Ionicons name="checkmark" size={20} color={colors.accentInk} />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn}>
                <Ionicons name="add" size={22} color={colors.accent} />
              </Animated.View>
            )}
          </PressScale>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingRight: space(4),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    paddingLeft: space(4),
  },
  plus: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
