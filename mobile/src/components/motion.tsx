import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** One spring for the whole app so everything moves the same way. */
export const spring = { damping: 18, stiffness: 220, mass: 0.8 };

/**
 * Smooth re-layout when list items appear or leave. Native only: on web Reanimated animates layout
 * with a scale transform, which squashes text mid-animation.
 */
export const listLayout = Platform.OS === 'web' ? undefined : LinearTransition.springify().damping(18);

/* ---------- haptics ---------- */

type HapticKind = 'tap' | 'select' | 'success' | 'warn';

export function haptic(kind: HapticKind = 'tap') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  else if (kind === 'select') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/* ---------- press feedback ---------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that shrinks slightly under the finger and springs back. */
export function PressScale({
  children,
  style,
  scaleTo = 0.97,
  hapticKind,
  onPress,
  disabled,
  ...rest
}: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticKind?: HapticKind;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, spring);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, spring);
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticKind) haptic(hapticKind);
        onPress?.(e);
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

/* ---------- entering ---------- */

/** Fades and lifts content in, staggered by index. Plays once, when it mounts. */
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(380)}
      style={style}>
      {children}
    </Animated.View>
  );
}

/* ---------- numbers ---------- */

/** Animates a number from its previous value (0 at first) to `target`. */
export function useTween(target: number, duration = 750) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const from = useRef(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (target - start) * eased;
      setValue(v);
      from.current = v;
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);

  return value;
}

export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const v = useTween(value);
  return <>{decimals ? v.toFixed(decimals) : Math.round(v)}</>;
}

/* ---------- loading ---------- */

/** Softly pulsing placeholder block. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: '#1C2027', borderRadius: 20 }, style, animated]} />;
}

/** Three bouncing dots, e.g. "coach is typing". */
export function TypingDots({ color }: { color: string }) {
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 5, paddingVertical: 6 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 150} color={color} />
      ))}
    </Animated.View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      y.value = withRepeat(
        withSequence(
          withTiming(-5, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 260 }),
        ),
        -1,
      );
    }, delay);
    return () => clearTimeout(t);
  }, [delay, y]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, animated]} />;
}
