import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadow, space, type, webFrame } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ---------- layout ---------- */

export function Screen({
  title,
  subtitle,
  right,
  children,
  onRefresh,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle && <Text style={type.caption}>{subtitle}</Text>}
        <Text style={type.h1}>{title}</Text>
      </View>
      {right}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, webFrame]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined
          }>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, webFrame]}>
          <View style={{ paddingHorizontal: space(4) }}>{header}</View>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.caption}>{children}</Text>
      {right}
    </View>
  );
}

/* ---------- controls ---------- */

export function Button({
  title,
  onPress,
  disabled,
  loading,
  icon,
  variant = 'primary',
  size = 'lg',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'lg' | 'md';
  style?: ViewStyle;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'md' && { minHeight: 44, paddingHorizontal: space(4) },
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && { opacity: 0.35 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'md' ? 17 : 20} color={v.fg} />}
          <Text style={[styles.buttonText, size === 'md' && { fontSize: 15 }, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { bg: colors.accent, fg: colors.accentInk, border: colors.accent },
  secondary: { bg: colors.surface2, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
};

export function IconButton({
  icon,
  onPress,
  label,
  size = 40,
  tone = 'surface',
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'surface' | 'accent' | 'plain';
}) {
  const bg = tone === 'accent' ? colors.accent : tone === 'surface' ? colors.surface2 : 'transparent';
  const fg = tone === 'accent' ? colors.accentInk : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        styles.iconButton,
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icon} size={size * 0.48} color={fg} />
    </Pressable>
  );
}

/** Pill for single choice in a row (days, minutes, meal). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.chipText, selected && { color: colors.accentInk }]}>{label}</Text>
    </Pressable>
  );
}

/** Full-width option row (goals, yes/no answers). */
export function Choice({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && { opacity: 0.85 }]}>
      {icon && <Ionicons name={icon} size={20} color={selected ? colors.accent : colors.muted} />}
      <Text style={[styles.choiceText, selected && { color: colors.text }]}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ flex: 1 }}>
      {label && <Text style={[type.small, { marginBottom: space(1.5) }]}>{label}</Text>}
      <TextInput placeholderTextColor={colors.faint} style={[styles.field, style]} {...props} />
    </View>
  );
}

/* ---------- feedback ---------- */

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Banner tone="danger" icon="alert-circle" text={message} />;
}

export function Banner({
  text,
  icon = 'information-circle',
  tone = 'info',
}: {
  text: string;
  icon?: IconName;
  tone?: 'info' | 'warn' | 'danger';
}) {
  const c = tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warn : colors.accent;
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warn' ? colors.warnSoft : colors.accentSoft;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={c} style={{ marginTop: 1 }} />
      <Text style={[type.small, { color: colors.text, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(28), gap: space(3) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(3),
    paddingTop: space(2),
    paddingBottom: space(2),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(4),
    ...shadow,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(3),
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingHorizontal: space(5),
  },
  buttonText: { fontSize: 17, fontWeight: '700' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 16, fontWeight: '700', color: colors.text, ...type.num },
  choice: {
    minHeight: 58,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
  },
  choiceOn: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  choiceText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.muted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface3 },
  segmentText: { fontSize: 15, fontWeight: '700', color: colors.muted },
  field: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: space(4),
  },
  banner: {
    flexDirection: 'row',
    gap: space(2),
    borderRadius: radius.md,
    padding: space(3),
  },
});
