import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/lib/theme';

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        (disabled || loading) && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? colors.navy : colors.navy} />
      ) : (
        <Text style={[styles.buttonText, { color: colors.navy }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && { color: colors.lime }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(5),
  },
  primary: { backgroundColor: colors.lime },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 17, fontWeight: '700' },
  choice: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
  },
  choiceSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  choiceText: { fontSize: 16, fontWeight: '600', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space(4),
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.warn, fontSize: 15, marginTop: space(2) },
});
