import { Ionicons } from '@expo/vector-icons';
import { Children, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
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
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear, PressScale, Skeleton, spring } from '@/components/motion';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/* ---------- layout ---------- */

export function Screen({
  title,
  subtitle,
  right,
  children,
  onRefresh,
  scroll = true,
  inStack = false,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  scroll?: boolean;
  /** Pushed screen with a native header: the header already handles the top inset. */
  inStack?: boolean;
}) {
  // Each top-level block fades/lifts in one after another when the screen first shows content.
  const offset = title ? 1 : 0;
  const blocks = Children.map(children, (child, i) =>
    child == null || child === false ? child : <Appear index={i + offset}>{child}</Appear>,
  );

  const header = title ? (
    <Appear>
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle && <Text style={type.caption}>{subtitle}</Text>}
        <Text style={type.h1}>{title}</Text>
      </View>
      {right}
    </View>
    </Appear>
  ) : null;

  return (
    <SafeAreaView style={styles.screen} edges={inStack ? [] : ['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, webFrame]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.muted} /> : undefined
          }>
          {header}
          {blocks}
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

/** Placeholder shaped like a typical screen while data loads. */
export function Loading({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={{ gap: space(3) }}>
        <Skeleton style={{ height: 72 }} />
        <Skeleton style={{ height: 72 }} />
      </View>
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={[styles.content, webFrame]}>
        <Skeleton style={{ height: 14, width: 140, borderRadius: 7, marginTop: space(3) }} />
        <Skeleton style={{ height: 30, width: 210, borderRadius: 10 }} />
        <Skeleton style={{ height: 230, marginTop: space(2) }} />
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          <Skeleton style={{ flex: 1, height: 110 }} />
          <Skeleton style={{ flex: 1, height: 110 }} />
          <Skeleton style={{ flex: 1, height: 110 }} />
        </View>
        <Skeleton style={{ height: 150 }} />
      </View>
    </SafeAreaView>
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
    <PressScale
      accessibilityRole="button"
      onPress={onPress}
      hapticKind="tap"
      disabled={disabled || loading}
      style={[
        styles.button,
        size === 'md' && { minHeight: 44, paddingHorizontal: space(4) },
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && !loading && { opacity: 0.35 },
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
    </PressScale>
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
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      scaleTo={0.88}
      hapticKind="tap"
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, styles.iconButton]}>
      <Ionicons name={icon} size={size * 0.48} color={fg} />
    </PressScale>
  );
}

/** Pill for single choice in a row (days, minutes, meal). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      hapticKind="select"
      scaleTo={0.92}
      style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && { color: colors.accentInk }]}>{label}</Text>
    </PressScale>
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
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      hapticKind="select"
      style={[styles.choice, selected && styles.choiceOn]}>
      {icon && <Ionicons name={icon} size={20} color={selected ? colors.accent : colors.muted} />}
      <Text style={[styles.choiceText, selected && { color: colors.text }]}>{label}</Text>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <Animated.View entering={FadeIn.duration(160)} style={styles.radioDot} />}
      </View>
    </PressScale>
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
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segW = width > 0 ? (width - 8 - 4 * (options.length - 1)) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withSpring(index * (segW + 4), spring);
  }, [index, segW, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const known = options.some((o) => o.value === value);

  return (
    <View style={styles.segmented} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segW > 0 && known && <Animated.View style={[styles.segmentThumb, { width: segW }, thumb]} />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={styles.segment}>
            <Text style={[styles.segmentText, on && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      {label && <Text style={[type.small, { marginBottom: space(1.5) }, focused && { color: colors.accent }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.field, focused && styles.fieldFocused, style]}
      />
      {hint && <Text style={[type.small, { fontSize: 12, marginTop: space(1.5) }]}>{hint}</Text>}
    </View>
  );
}

export function PasswordField({
  showLabel,
  ...props
}: TextInputProps & { label?: string; hint?: string; showLabel: string }) {
  const [shown, setShown] = useState(false);
  return (
    <View>
      <Field
        {...props}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ paddingRight: 52 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showLabel}
        onPress={() => setShown((v) => !v)}
        hitSlop={8}
        style={[styles.eye, { top: props.label ? 27 : 0 }]}>
        <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

export function Avatar({ name, size = 72 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {initials ? (
        <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: colors.accentInk }}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={size * 0.45} color={colors.accentInk} />
      )}
    </View>
  );
}

/** Grouped settings list: wrap rows in <ListGroup>. */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: space(2) }}>
      {title && <Text style={[type.caption, { marginLeft: space(1) }]}>{title}</Text>}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function ListRow({
  icon,
  iconColor = colors.accent,
  title,
  value,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const c = danger ? colors.danger : iconColor;
  return (
    <PressScale
      accessibilityRole="button"
      onPress={onPress}
      hapticKind="tap"
      scaleTo={0.985}
      style={styles.listRow}>
      <View style={[styles.listIcon, { backgroundColor: `${c}22` }]}>
        <Ionicons name={icon} size={18} color={c} />
      </View>
      <View style={[styles.listBody, !last && styles.listDivider]}>
        <Text style={[type.body, { flex: 1, fontWeight: '600' }, danger && { color: colors.danger }]}>{title}</Text>
        {value != null && (
          <Text style={[type.small, { maxWidth: '50%' }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {!danger && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
      </View>
    </PressScale>
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
    <Animated.View
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(160)}
      style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={c} style={{ marginTop: 1 }} />
      <Text style={[type.small, { color: colors.text, flex: 1 }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(28), gap: space(3) },
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
  },
  chipOn: { backgroundColor: colors.accent },
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
  segmentThumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
  },
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
  eye: { position: 'absolute', right: 0, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  avatar: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: space(4), gap: space(3), minHeight: 56 },
  listIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  listBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    alignSelf: 'stretch',
    paddingRight: space(4),
  },
  listDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  fieldFocused: { borderColor: colors.accent },
  banner: {
    flexDirection: 'row',
    gap: space(2),
    borderRadius: radius.md,
    padding: space(3),
  },
});
