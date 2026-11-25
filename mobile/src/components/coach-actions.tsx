import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { haptic } from '@/components/motion';
import type { IconName } from '@/components/ui';
import { api, type CoachAction } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const ICON: Record<CoachAction['type'], { icon: IconName; color: string }> = {
  SET: { icon: 'barbell', color: colors.accent },
  FOOD: { icon: 'restaurant', color: colors.fat },
  WATER: { icon: 'water', color: colors.protein },
  WEIGHT: { icon: 'scale-outline', color: colors.carbs },
  PLAN: { icon: 'calendar', color: colors.up },
};

/** What the coach did for a reply, with undo (sets, food, water) or a shortcut (plan). */
export function ActionChips({ actions }: { actions: CoachAction[] }) {
  return (
    <View style={{ gap: space(1.5), marginTop: space(1) }}>
      {actions.map((a, i) => (
        <Chip key={`${a.type}-${i}`} action={a} index={i} />
      ))}
    </View>
  );
}

function Chip({ action, index }: { action: CoachAction; index: number }) {
  const token = useToken();
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'busy' | 'undone' | 'failed'>('idle');
  const look = ICON[action.type];
  const canUndo = action.type === 'SET' || action.type === 'FOOD' || action.type === 'WATER';

  const undo = async () => {
    setState('busy');
    try {
      if (action.type === 'SET') for (const id of action.ids ?? []) await api.deleteSet(token, id);
      if (action.type === 'FOOD') for (const id of action.ids ?? []) await api.deleteFood(token, id);
      if (action.type === 'WATER' && action.ml && action.date) await api.addWater(token, action.date, -action.ml);
      haptic('select');
      setState('undone');
    } catch {
      setState('failed');
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(150 + index * 80).springify().damping(16)}
      style={[styles.chip, state === 'undone' && { opacity: 0.5 }]}>
      <View style={[styles.icon, { backgroundColor: `${look.color}22` }]}>
        <Ionicons name={state === 'undone' ? 'arrow-undo' : look.icon} size={14} color={look.color} />
      </View>
      <Text
        style={[type.small, { flex: 1, color: colors.text, fontSize: 13 }, state === 'undone' && styles.struck]}
        numberOfLines={2}>
        {action.label}
      </Text>
      {action.type === 'PLAN' ? (
        <Pressable hitSlop={8} onPress={() => router.navigate('/workout')}>
          <Text style={styles.link}>{t('coach.open')}</Text>
        </Pressable>
      ) : canUndo && state !== 'undone' ? (
        state === 'busy' ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : (
          <Pressable hitSlop={8} onPress={undo}>
            <Text style={[styles.link, state === 'failed' && { color: colors.danger }]}>{t('coach.undo')}</Text>
          </Pressable>
        )
      ) : state === 'undone' ? (
        <Text style={[type.small, { fontSize: 12 }]}>{t('coach.undone')}</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: space(2),
    paddingHorizontal: space(2.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  struck: { textDecorationLine: 'line-through' },
});
